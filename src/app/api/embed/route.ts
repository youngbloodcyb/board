import { workflowEmbedNode } from "@workflows/embed";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getSession } from "@/lib/auth-server";
import { requireNodeAccess } from "@/services/board-access";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nodeId } = (await req.json()) as { nodeId: string };

  const access = await requireNodeAccess(nodeId, session.user.id, "edit").catch(
    () => null,
  );
  if (!access) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }
  const { node } = access;

  await start(workflowEmbedNode, [node.id]);

  return NextResponse.json({ ok: true });
}
