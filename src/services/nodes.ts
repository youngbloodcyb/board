"use server";

import { workflowEmbedNode } from "@workflows/embed";
import { and, eq } from "drizzle-orm";
import { start } from "workflow/api";
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
import { blobExists, deleteBlob, nodeObjectKey } from "@/lib/blob";
import { nodeSearchText } from "@/lib/node-search";

async function scheduleNodeEmbedding(nodeId: string): Promise<void> {
  try {
    await start(workflowEmbedNode, [nodeId]);
  } catch (error) {
    console.error("embedding workflow failed to start", { nodeId, error });
  }
}

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

function toClientData(data: NodeData, nodeId: string): ClientNodeData {
  if (data.kind === "image") {
    return {
      kind: "image",
      src: data.objectKey ? `/api/files/${nodeId}` : (data.url ?? ""),
      alt: data.alt,
      fit: data.fit,
    };
  }
  if (data.kind === "pdf") {
    return {
      kind: "pdf",
      src: data.objectKey ? `/api/files/${nodeId}` : (data.url ?? ""),
      name: data.name,
    };
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
    data: toClientData(row.data, row.id),
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

  const key = nodeObjectKey(input.data);
  if (key) {
    const exists = await blobExists(key);
    if (!exists) throw new Error("Upload not found");
  }

  const id = crypto.randomUUID();
  const searchText = nodeSearchText(input.data);
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
    searchText,
  });
  if (searchText) await scheduleNodeEmbedding(id);
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
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.position) {
    set.positionX = input.position.x;
    set.positionY = input.position.y;
  }
  if (input.data) {
    set.data = input.data;
    set.searchText = nodeSearchText(input.data);
  }
  if (input.style) {
    set.width = input.style.width;
    set.height = input.style.height;
  }
  if (input.zIndex !== undefined) set.zIndex = input.zIndex;
  const result = await db
    .update(nodes)
    .set(set)
    .where(and(eq(nodes.id, input.nodeId), eq(nodes.userId, user.id)));
  if (result.rowCount === 0) throw new Error("Node not found");
  if (input.data) await scheduleNodeEmbedding(input.nodeId);
}

export async function patchImageNode(input: {
  nodeId: string;
  fit?: "cover" | "contain";
  objectKey?: string;
}): Promise<void> {
  const user = await requireUser();
  const node = await requireOwnedNode(input.nodeId, user.id);
  if (node.data.kind !== "image") return;

  const next = { ...node.data };
  let oldKey: string | undefined;
  if (input.fit !== undefined) next.fit = input.fit;
  if (input.objectKey !== undefined) {
    if (next.objectKey) oldKey = next.objectKey;
    next.objectKey = input.objectKey;
    next.url = undefined;
  }

  const result = await db
    .update(nodes)
    .set({ data: next, updatedAt: new Date() })
    .where(and(eq(nodes.id, input.nodeId), eq(nodes.userId, user.id)));
  if (result.rowCount === 0) throw new Error("Node not found");

  if (oldKey) await deleteBlob(oldKey);
}

export async function removeNode(nodeId: string): Promise<void> {
  const user = await requireUser();
  const node = await requireOwnedNode(nodeId, user.id);
  const key = nodeObjectKey(node.data as NodeData);
  const result = await db
    .delete(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.userId, user.id)));
  if (result.rowCount === 0) throw new Error("Node not found");
  if (key) await deleteBlob(key);
}

export async function duplicateNode(input: {
  nodeId: string;
  boardId: string;
  position: { x: number; y: number };
  style?: { width: number; height: number };
}): Promise<string> {
  const user = await requireUser();
  const src = await requireOwnedNode(input.nodeId, user.id);
  await requireOwnedBoard(input.boardId, user.id);
  const id = crypto.randomUUID();
  const searchText = nodeSearchText(src.data);
  await db.insert(nodes).values({
    id,
    boardId: input.boardId,
    userId: user.id,
    type: src.type,
    positionX: input.position.x,
    positionY: input.position.y,
    width: input.style?.width ?? src.width ?? undefined,
    height: input.style?.height ?? src.height ?? undefined,
    zIndex: src.zIndex ?? undefined,
    data: src.data,
    searchText,
  });
  if (searchText) await scheduleNodeEmbedding(id);
  return id;
}
