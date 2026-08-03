"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  type Board,
  boards,
  type ClientNode,
  type ClientNodeData,
  type NodeData,
  type NodeType,
  nodes,
  type StoredNode,
} from "@/db/schema";
import { requireUser } from "@/lib/auth-server";

async function requireOwnedBoard(
  boardId: string,
  userId: string,
): Promise<Board> {
  const rows = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Board not found");
  return rows[0];
}

async function requireOwnedNode(nodeId: string, userId: string) {
  const rows = await db
    .select()
    .from(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Node not found");
  return rows[0];
}

function toClientData(data: NodeData): ClientNodeData {
  if (data.kind === "image") {
    return {
      kind: "image",
      src: data.url ?? "",
      alt: data.alt,
      fit: data.fit,
    };
  }
  if (data.kind === "pdf") {
    return { kind: "pdf", src: data.url ?? "", name: data.name };
  }
  return data;
}

function toClientNode(row: StoredNode): ClientNode {
  return {
    id: row.id,
    type: row.type,
    position: { x: row.positionX, y: row.positionY },
    style:
      row.width != null && row.height != null
        ? { width: row.width, height: row.height }
        : undefined,
    zIndex: row.zIndex ?? undefined,
    data: toClientData(row.data),
  };
}

export async function listNodesByBoard(boardId: string): Promise<ClientNode[]> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(nodes)
    .where(and(eq(nodes.boardId, boardId), eq(nodes.userId, user.id)));
  return rows.map(toClientNode);
}

export async function createNode(input: {
  boardId: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  style?: { width: number; height: number };
}): Promise<string> {
  const user = await requireUser();
  await requireOwnedBoard(input.boardId, user.id);
  const id = crypto.randomUUID();
  await db.insert(nodes).values({
    id,
    boardId: input.boardId,
    userId: user.id,
    type: input.type,
    positionX: input.position.x,
    positionY: input.position.y,
    width: input.style?.width,
    height: input.style?.height,
    data: input.data,
  });
  return id;
}

export async function updateNode(input: {
  nodeId: string;
  position?: { x: number; y: number };
  data?: NodeData;
  style?: { width: number; height: number };
  zIndex?: number;
}): Promise<void> {
  const user = await requireUser();
  await requireOwnedNode(input.nodeId, user.id);
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.position) {
    set.positionX = input.position.x;
    set.positionY = input.position.y;
  }
  if (input.data) set.data = input.data;
  if (input.style) {
    set.width = input.style.width;
    set.height = input.style.height;
  }
  if (input.zIndex !== undefined) set.zIndex = input.zIndex;
  await db.update(nodes).set(set).where(eq(nodes.id, input.nodeId));
}

export async function patchImageNode(input: {
  nodeId: string;
  fit?: "cover" | "contain";
  storageId?: string;
}): Promise<void> {
  const user = await requireUser();
  const node = await requireOwnedNode(input.nodeId, user.id);
  if (node.data.kind !== "image") return;

  const next = { ...node.data };
  if (input.fit !== undefined) next.fit = input.fit;
  if (input.storageId !== undefined) {
    next.storageId = input.storageId;
    next.url = undefined;
  }
  await db
    .update(nodes)
    .set({ data: next, updatedAt: new Date() })
    .where(eq(nodes.id, input.nodeId));
}

export async function removeNode(nodeId: string): Promise<void> {
  const user = await requireUser();
  await requireOwnedNode(nodeId, user.id);
  await db.delete(nodes).where(eq(nodes.id, nodeId));
}

export async function generateUploadUrl(): Promise<string> {
  await requireUser();
  throw new Error(
    "generateUploadUrl is not implemented — no file storage backend is configured",
  );
}
