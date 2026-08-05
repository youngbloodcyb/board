import { embed } from "ai";

export const EMBEDDING_MODEL = "google/gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 1536;

export async function embedSearchText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS },
    },
  });
  return embedding;
}
