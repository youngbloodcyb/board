import { embedNode } from "@workflows/embed";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import type { NodeData } from "@/db/schema";

export async function POST(req: Request) {
  const { nodeId, boardId, userId, data } = (await req.json()) as {
    nodeId: string;
    boardId: string;
    userId: string;
    data: NodeData;
  };

  await start(embedNode, [{ nodeId, boardId, userId, data }]);

  return NextResponse.json({ ok: true });
}
