import { createHash } from "node:crypto";
import type { NodeData } from "@/db/schema";

export function nodeEmbeddingSourceKey(
  data: NodeData,
  searchText: string,
): string | null {
  const source =
    data.kind === "image"
      ? data.objectKey
        ? `image:${data.objectKey}`
        : null
      : searchText
        ? `text:${searchText}`
        : null;

  return source ? createHash("sha256").update(source).digest("hex") : null;
}
