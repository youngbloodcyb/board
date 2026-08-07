import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { embeddings } from "@/db/schema";
import { getSession } from "@/lib/auth-server";
import { requireNodeAccess } from "@/services/board-access";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { nodeId } = await params;
  try {
    await requireNodeAccess(nodeId, session.user.id, "edit");
  } catch {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }
  await db.delete(embeddings).where(eq(embeddings.nodeId, nodeId));
  return NextResponse.json({ ok: true });
}
