import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { embeddings } from "@/db/schema";
import { getSession } from "@/lib/auth-server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { nodeId } = await params;
  await db
    .delete(embeddings)
    .where(
      and(
        eq(embeddings.nodeId, nodeId),
        eq(embeddings.userId, session.user.id),
      ),
    );
  return NextResponse.json({ ok: true });
}
