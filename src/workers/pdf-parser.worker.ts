import init, { processPdf } from "@firecrawl/pdf-inspector-wasm";

type PdfParserRequest = {
  id: string;
  buffer: ArrayBuffer;
};

type PdfParserResponse =
  | { id: string; ok: true; markdown: string | null }
  | { id: string; ok: false; error: string };

const worker = self as unknown as Worker;
const wasmReady = init();

worker.addEventListener(
  "message",
  async (event: MessageEvent<PdfParserRequest>) => {
    const { id, buffer } = event.data;
    let response: PdfParserResponse;

    try {
      await wasmReady;
      const result = processPdf(new Uint8Array(buffer), {
        profile: "compact",
        includePageMarkers: false,
        includeImages: false,
      });
      response = {
        id,
        ok: true,
        markdown: result.markdown?.trim() || null,
      };
    } catch (error) {
      response = {
        id,
        ok: false,
        error: error instanceof Error ? error.message : "Couldn't parse PDF",
      };
    }

    worker.postMessage(response);
  },
);
