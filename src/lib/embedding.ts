import { GoogleGenAI } from "@google/genai";

export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 1536;

const DOCUMENT_CHUNK_CHARS = 4_000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function embeddingValues(response: {
  embeddings?: Array<{ values?: number[] }>;
}): number[] {
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Gemini returned an invalid embedding");
  }
  return values;
}

function chunkText(text: string): string[] {
  const characters = Array.from(text);
  const chunks: string[] = [];
  for (
    let offset = 0;
    offset < characters.length;
    offset += DOCUMENT_CHUNK_CHARS
  ) {
    chunks.push(
      characters.slice(offset, offset + DOCUMENT_CHUNK_CHARS).join(""),
    );
  }
  return chunks.length > 0 ? chunks : [""];
}

function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 1) return embeddings[0];

  const average = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  for (const embedding of embeddings) {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("Cannot combine embeddings with different dimensions");
    }
    for (let index = 0; index < embedding.length; index += 1) {
      average[index] += embedding[index] / embeddings.length;
    }
  }

  const magnitude = Math.sqrt(
    average.reduce((sum, value) => sum + value * value, 0),
  );
  return magnitude === 0 ? average : average.map((value) => value / magnitude);
}

async function embedContent(
  contents: Parameters<GoogleGenAI["models"]["embedContent"]>[0]["contents"],
) {
  const response = await getClient().models.embedContent({
    model: EMBEDDING_MODEL,
    contents,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  return embeddingValues(response);
}

export async function embedSearchQuery(query: string): Promise<number[]> {
  return embedContent(`task: search result | query: ${query}`);
}

export async function embedSearchDocument(input: {
  title: string;
  text: string;
}): Promise<number[]> {
  const embeddings: number[][] = [];
  for (const chunk of chunkText(input.text)) {
    embeddings.push(
      await embedContent(`title: ${input.title || "none"} | text: ${chunk}`),
    );
  }
  return averageEmbeddings(embeddings);
}

export async function embedSearchImage(input: {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
}): Promise<number[]> {
  return embedContent([
    {
      inlineData: {
        data: Buffer.from(input.bytes).toString("base64"),
        mimeType: input.mimeType,
      },
    },
  ]);
}
