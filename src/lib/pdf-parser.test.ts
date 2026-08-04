import { beforeEach, describe, expect, it, vi } from "vitest";

type WorkerListener = EventListenerOrEventListenerObject;

class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly listeners = new Map<string, WorkerListener[]>();
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  constructor(
    readonly url: string | URL,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: WorkerListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  }
}

function fileWithBuffer(buffer: ArrayBuffer): Blob {
  return {
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  } as unknown as Blob;
}

async function loadParser() {
  vi.resetModules();
  return import("./pdf-parser");
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
});

describe("extractPdfMarkdown", () => {
  it("transfers PDF bytes to a module worker and resolves its markdown", async () => {
    const { extractPdfMarkdown } = await loadParser();
    const buffer = new ArrayBuffer(8);
    const result = extractPdfMarkdown(fileWithBuffer(buffer));
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    const request = worker.postMessage.mock.calls[0][0] as { id: string };

    expect(worker.options).toEqual({ type: "module" });
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: request.id, buffer }),
      [buffer],
    );

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: { id: request.id, ok: true, markdown: "# Report" },
      }),
    );
    await expect(result).resolves.toBe("# Report");
  });

  it("correlates concurrent responses by request id", async () => {
    const { extractPdfMarkdown } = await loadParser();
    const first = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(1)));
    const second = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(2)));
    await vi.waitFor(() => {
      expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledTimes(2);
    });
    const worker = FakeWorker.instances[0];
    const firstId = worker.postMessage.mock.calls[0][0].id as string;
    const secondId = worker.postMessage.mock.calls[1][0].id as string;

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: { id: secondId, ok: true, markdown: "second" },
      }),
    );
    worker.emit(
      "message",
      new MessageEvent("message", {
        data: { id: firstId, ok: true, markdown: "first" },
      }),
    );

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("rejects parser errors returned by the worker", async () => {
    const { extractPdfMarkdown } = await loadParser();
    const result = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(1)));
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    const id = worker.postMessage.mock.calls[0][0].id as string;

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: { id, ok: false, error: "Encrypted PDF" },
      }),
    );

    await expect(result).rejects.toThrow("Encrypted PDF");
  });

  it("caps markdown before it is sent through a Server Action", async () => {
    const { extractPdfMarkdown, MAX_PDF_MARKDOWN_CHARS } = await loadParser();
    const result = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(1)));
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];
    const id = worker.postMessage.mock.calls[0][0].id as string;

    worker.emit(
      "message",
      new MessageEvent("message", {
        data: {
          id,
          ok: true,
          markdown: "x".repeat(MAX_PDF_MARKDOWN_CHARS + 1),
        },
      }),
    );

    await expect(result).resolves.toHaveLength(MAX_PDF_MARKDOWN_CHARS);
  });

  it("rejects pending work and recreates a worker after a fatal error", async () => {
    const { extractPdfMarkdown } = await loadParser();
    const first = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(1)));
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    const worker = FakeWorker.instances[0];

    worker.emit(
      "error",
      new ErrorEvent("error", { message: "Worker crashed" }),
    );

    await expect(first).rejects.toThrow("Worker crashed");
    expect(worker.terminate).toHaveBeenCalledOnce();

    const second = extractPdfMarkdown(fileWithBuffer(new ArrayBuffer(1)));
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    const replacementWorker = FakeWorker.instances[1];
    const id = replacementWorker.postMessage.mock.calls[0][0].id as string;
    replacementWorker.emit(
      "message",
      new MessageEvent("message", {
        data: { id, ok: true, markdown: null },
      }),
    );
    await expect(second).resolves.toBeNull();
  });
});
