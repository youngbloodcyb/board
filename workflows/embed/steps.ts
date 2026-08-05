import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { embeddings, nodes } from "@/db/schema";
import { embedSearchText } from "@/lib/embedding";

export async function stepGetNodeSearchText(
  nodeId: string,
): Promise<string | null> {
  "use step";

  const rows = await db
    .select({ searchText: nodes.searchText })
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1);
  return rows[0]?.searchText || null;
}

export async function stepEmbedText(text: string): Promise<number[]> {
  "use step";

  return embedSearchText(text);
}

export async function stepUpsertEmbedding(params: {
  nodeId: string;
  content: string;
  embedding: number[];
}) {
  "use step";

  const vector = JSON.stringify(params.embedding);
  await db.execute(sql`
    INSERT INTO ${embeddings} (
      ${sql.identifier(embeddings.nodeId.name)},
      ${sql.identifier(embeddings.boardId.name)},
      ${sql.identifier(embeddings.userId.name)},
      ${sql.identifier(embeddings.content.name)},
      ${sql.identifier(embeddings.embedding.name)}
    )
    SELECT
      ${nodes.id},
      ${nodes.boardId},
      ${nodes.userId},
      ${nodes.searchText},
      ${vector}::vector
    FROM ${nodes}
    WHERE ${nodes.id} = ${params.nodeId}
      AND ${nodes.searchText} = ${params.content}
    ON CONFLICT (${sql.identifier(embeddings.nodeId.name)}) DO UPDATE SET
      ${sql.identifier(embeddings.boardId.name)} = EXCLUDED.${sql.identifier(
        embeddings.boardId.name,
      )},
      ${sql.identifier(embeddings.userId.name)} = EXCLUDED.${sql.identifier(
        embeddings.userId.name,
      )},
      ${sql.identifier(embeddings.content.name)} = EXCLUDED.${sql.identifier(
        embeddings.content.name,
      )},
      ${sql.identifier(embeddings.embedding.name)} = EXCLUDED.${sql.identifier(
        embeddings.embedding.name,
      )}
  `);
}

export async function stepDeleteEmbedding(nodeId: string) {
  "use step";

  await db.delete(embeddings).where(eq(embeddings.nodeId, nodeId));
}
