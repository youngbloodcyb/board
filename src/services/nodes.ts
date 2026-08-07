"use server";

import { workflowEmbedNode } from "@workflows/embed";
import { eq } from "drizzle-orm";
import { start } from "workflow/api";
import { db } from "@/db";
import {
  type ClientNode,
  type ClientNodeData,
  type NodeData,
  type NodeType,
  nodes,
  type StoredNode,
} from "@/db/schema";
import { requireUser } from "@/lib/auth-server";
import { blobExists, deleteBlob, nodeObjectKey } from "@/lib/blob";
import { nodeEmbeddingSourceKey } from "@/lib/embedding-source";
import { nodeSearchText } from "@/lib/node-search";
import { requireBoardAccess, requireNodeAccess } from "@/services/board-access";

async function scheduleNodeEmbedding(nodeId: string): Promise<void> {
  try {
    await start(workflowEmbedNode, [nodeId]);
  } catch (error) {
    console.error("embedding workflow failed to start", { nodeId, error });
  }
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
  await requireBoardAccess(boardId, user.id, "view");
  const rows = await db.select().from(nodes).where(eq(nodes.boardId, boardId));
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
  const { board } = await requireBoardAccess(input.boardId, user.id, "edit");

  const key = nodeObjectKey(input.data);
  if (key) {
    if (!key.startsWith(`${user.id}/${input.boardId}/`)) {
      throw new Error("Upload does not belong to this board");
    }
    const exists = await blobExists(key);
    if (!exists) throw new Error("Upload not found");
  }

  const id = crypto.randomUUID();
  const searchText = nodeSearchText(input.data);
  const embeddingSource = nodeEmbeddingSourceKey(input.data, searchText);
  await db.insert(nodes).values({
    id,
    boardId: input.boardId,
    userId: board.userId,
    type: input.type,
    positionX: input.position.x,
    positionY: input.position.y,
    width: input.style?.width,
    height: input.style?.height,
    data: input.data,
    searchText,
    embeddingSource,
  });
  if (embeddingSource) await scheduleNodeEmbedding(id);
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
  await requireNodeAccess(input.nodeId, user.id, "edit");
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (input.position) {
    set.positionX = input.position.x;
    set.positionY = input.position.y;
  }
  if (input.data) {
    const searchText = nodeSearchText(input.data);
    set.data = input.data;
    set.searchText = searchText;
    set.embeddingSource = nodeEmbeddingSourceKey(input.data, searchText);
  }
  if (input.style) {
    set.width = input.style.width;
    set.height = input.style.height;
  }
  if (input.zIndex !== undefined) set.zIndex = input.zIndex;
  const result = await db
    .update(nodes)
    .set(set)
    .where(eq(nodes.id, input.nodeId));
  if (result.rowCount === 0) throw new Error("Node not found");
  if (input.data) await scheduleNodeEmbedding(input.nodeId);
}

export async function patchImageNode(input: {
  nodeId: string;
  fit?: "cover" | "contain";
  objectKey?: string;
}): Promise<void> {
  const user = await requireUser();
  const { node } = await requireNodeAccess(input.nodeId, user.id, "edit");
  if (node.data.kind !== "image") return;

  const next = { ...node.data };
  let oldKey: string | undefined;
  if (input.fit !== undefined) next.fit = input.fit;
  if (input.objectKey !== undefined) {
    if (!input.objectKey.startsWith(`${user.id}/${node.boardId}/`)) {
      throw new Error("Upload does not belong to this board");
    }
    if (!(await blobExists(input.objectKey))) {
      throw new Error("Upload not found");
    }
    if (next.objectKey) oldKey = next.objectKey;
    next.objectKey = input.objectKey;
    next.url = undefined;
  }

  const searchText = nodeSearchText(next);
  const embeddingSource = nodeEmbeddingSourceKey(next, searchText);

  const result = await db
    .update(nodes)
    .set({
      data: next,
      searchText,
      embeddingSource,
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, input.nodeId));
  if (result.rowCount === 0) throw new Error("Node not found");

  if (input.objectKey !== undefined) await scheduleNodeEmbedding(input.nodeId);
  if (oldKey) await deleteBlob(oldKey);
}

export async function removeNode(nodeId: string): Promise<void> {
  const user = await requireUser();
  const { node } = await requireNodeAccess(nodeId, user.id, "edit");
  const key = nodeObjectKey(node.data as NodeData);
  const result = await db.delete(nodes).where(eq(nodes.id, nodeId));
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
  const { node: src } = await requireNodeAccess(input.nodeId, user.id, "edit");
  const { board } = await requireBoardAccess(input.boardId, user.id, "edit");
  const id = crypto.randomUUID();
  const searchText = nodeSearchText(src.data);
  const embeddingSource = nodeEmbeddingSourceKey(src.data, searchText);
  await db.insert(nodes).values({
    id,
    boardId: input.boardId,
    userId: board.userId,
    type: src.type,
    positionX: input.position.x,
    positionY: input.position.y,
    width: input.style?.width ?? src.width ?? undefined,
    height: input.style?.height ?? src.height ?? undefined,
    zIndex: src.zIndex ?? undefined,
    data: src.data,
    searchText,
    embeddingSource,
  });
  if (embeddingSource) await scheduleNodeEmbedding(id);
  return id;
}
