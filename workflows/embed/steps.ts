import { embed } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { embeddings } from "@/db/schema";

export async function stepEmbedText(text: string): Promise<number[]> {
  "use step";

  const { embedding } = await embed({
    model: "google/gemini-embedding-2",
    value: text,
    providerOptions: { google: { outputDimensionality: 1536 } },
  });
  return embedding;
}

export async function stepUpsertEmbedding(params: {
  nodeId: string;
  boardId: string;
  userId: string;
  embedding: number[];
}) {
  "use step";

  await db
    .insert(embeddings)
    .values({
      nodeId: params.nodeId,
      boardId: params.boardId,
      userId: params.userId,
      embedding: params.embedding,
    })
    .onConflictDoUpdate({
      target: embeddings.nodeId,
      set: {
        embedding: params.embedding,
        boardId: params.boardId,
        userId: params.userId,
      },
    });
}

export async function stepDeleteEmbedding(nodeId: string) {
  "use step";

  await db.delete(embeddings).where(eq(embeddings.nodeId, nodeId));
}
