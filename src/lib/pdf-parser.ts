type PdfParserRequest = {
  id: string;
  buffer: ArrayBuffer;
};

type PdfParserResponse =
  | { id: string; ok: true; markdown: string | null }
  | { id: string; ok: false; error: string };

type PendingRequest = {
  resolve: (markdown: string | null) => void;
  reject: (error: Error) => void;
};

export const MAX_PDF_MARKDOWN_CHARS = 30_000;

let parserWorker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

function rejectPendingRequests(error: Error) {
  for (const request of pendingRequests.values()) request.reject(error);
  pendingRequests.clear();
}

function getParserWorker(): Worker {
  if (parserWorker) return parserWorker;

  const worker = new Worker(
    new URL("../workers/pdf-parser.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.addEventListener(
    "message",
    (event: MessageEvent<PdfParserResponse>) => {
      const response = event.data;
      const pending = pendingRequests.get(response.id);
      if (!pending) return;

      pendingRequests.delete(response.id);
      if (response.ok) {
        pending.resolve(
          response.markdown?.slice(0, MAX_PDF_MARKDOWN_CHARS) ?? null,
        );
      } else {
        pending.reject(new Error(response.error));
      }
    },
  );
  worker.addEventListener("error", (event) => {
    rejectPendingRequests(
      new Error(event.message || "The PDF parser worker stopped unexpectedly"),
    );
    worker.terminate();
    parserWorker = null;
  });
  parserWorker = worker;
  return worker;
}

export async function extractPdfMarkdown(file: Blob): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  const request: PdfParserRequest = {
    id: crypto.randomUUID(),
    buffer,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(request.id, { resolve, reject });
    try {
      getParserWorker().postMessage(request, [buffer]);
    } catch (error) {
      pendingRequests.delete(request.id);
      reject(
        error instanceof Error ? error : new Error("Couldn't parse the PDF"),
      );
    }
  });
}
