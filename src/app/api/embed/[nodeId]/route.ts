import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { embeddings } from "@/db/schema";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const { nodeId } = await params;
  await db.delete(embeddings).where(eq(embeddings.nodeId, nodeId));
  return NextResponse.json({ ok: true });
}
