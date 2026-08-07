import { describe, expect, it } from "vitest";
import { nodeEmbeddingSourceKey } from "./embedding-source";

describe("nodeEmbeddingSourceKey", () => {
  it("versions text and extracted PDF content", () => {
    const first = nodeEmbeddingSourceKey(
      { kind: "pdf", name: "report.pdf", markdown: "First version" },
      "report.pdf First version",
    );
    const second = nodeEmbeddingSourceKey(
      { kind: "pdf", name: "report.pdf", markdown: "Second version" },
      "report.pdf Second version",
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });

  it("versions images by object key, independently of alt text", () => {
    const first = nodeEmbeddingSourceKey(
      { kind: "image", objectKey: "private/image", alt: "First label" },
      "First label",
    );
    const relabeled = nodeEmbeddingSourceKey(
      { kind: "image", objectKey: "private/image", alt: "Second label" },
      "Second label",
    );
    const replaced = nodeEmbeddingSourceKey(
      { kind: "image", objectKey: "private/replacement" },
      "",
    );

    expect(relabeled).toBe(first);
    expect(replaced).not.toBe(first);
  });

  it("does not claim unsupported external images are embedded", () => {
    expect(
      nodeEmbeddingSourceKey(
        { kind: "image", url: "https://example.com/image.png", alt: "Image" },
        "Image",
      ),
    ).toBeNull();
  });
});
