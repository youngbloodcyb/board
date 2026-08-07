import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get: mocks.get }));

import { loadImageEmbeddingInput } from "./image-embedding";

let transparentPng: Buffer;

beforeAll(async () => {
  transparentPng = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({
    stream: new Response(Uint8Array.from(transparentPng)).body,
  });
});

describe("loadImageEmbeddingInput", () => {
  it("loads a private blob and normalizes it to a Gemini image format", async () => {
    const result = await loadImageEmbeddingInput("private/image");

    expect(mocks.get).toHaveBeenCalledWith("private/image", {
      access: "private",
      useCache: false,
    });
    expect(result.mimeType).toBe("image/png");
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it("fails instead of silently embedding alt text when the blob is gone", async () => {
    mocks.get.mockResolvedValue(null);

    await expect(loadImageEmbeddingInput("missing")).rejects.toThrow(
      "Image blob not found",
    );
  });
});
