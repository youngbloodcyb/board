import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  embedContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = { embedContent: mocks.embedContent };
  },
}));

import {
  EMBEDDING_DIMENSIONS,
  embedSearchDocument,
  embedSearchImage,
  embedSearchQuery,
} from "./embedding";

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, offset) =>
    offset === index ? 1 : 0,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key";
  mocks.embedContent.mockResolvedValue({
    embeddings: [{ values: unitVector(0) }],
  });
});

describe("Gemini embeddings", () => {
  it("formats text queries for search retrieval", async () => {
    await embedSearchQuery("find the roadmap");

    expect(mocks.embedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-2",
      contents: "task: search result | query: find the roadmap",
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
  });

  it("embeds every chunk of extracted PDF text and combines the vectors", async () => {
    mocks.embedContent
      .mockResolvedValueOnce({ embeddings: [{ values: unitVector(0) }] })
      .mockResolvedValueOnce({ embeddings: [{ values: unitVector(1) }] });

    const embedding = await embedSearchDocument({
      title: "report.pdf",
      text: "x".repeat(4_001),
    });

    expect(mocks.embedContent).toHaveBeenCalledTimes(2);
    expect(embedding[0]).toBeCloseTo(Math.SQRT1_2);
    expect(embedding[1]).toBeCloseTo(Math.SQRT1_2);
  });

  it("sends image bytes as native inline image data", async () => {
    await embedSearchImage({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });

    expect(mocks.embedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-2",
      contents: [
        {
          inlineData: {
            data: "AQID",
            mimeType: "image/png",
          },
        },
      ],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
  });
});
