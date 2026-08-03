import type { NodeData } from "@/db/schema";

export function embeddableText(data: NodeData): string | null {
  if (data.kind === "text") {
    const text = data.text
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }
  if (data.kind === "link") {
    const text = [data.og?.title, data.og?.description, data.url]
      .filter(Boolean)
      .join(" ")
      .trim();
    return text || null;
  }
  return null;
}
