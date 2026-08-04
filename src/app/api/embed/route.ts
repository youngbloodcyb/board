import { workflowEmbedNode } from "@workflows/embed";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { db } from "@/db";
import { nodes } from "@/db/schema";
import { getSession } from "@/lib/auth-server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = (await req.json()) as { nodeId: string };

  const rows = await db
    .select({
      id: nodes.id,
      boardId: nodes.boardId,
      data: nodes.data,
    })
    .from(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.userId, session.user.id)))
    .limit(1);
  const node = rows[0];
  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  await start(workflowEmbedNode, [
    {
      nodeId: node.id,
      boardId: node.boardId,
      userId: session.user.id,
      data: node.data,
    },
  ]);

  return NextResponse.json({ ok: true });
}
