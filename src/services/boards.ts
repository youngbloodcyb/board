"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { type Board, boards } from "@/db/schema";
import { requireUser } from "@/lib/auth-server";

export async function listBoards(): Promise<Board[]> {
  const user = await requireUser();
  return db
    .select()
    .from(boards)
    .where(eq(boards.userId, user.id))
    .orderBy(desc(boards.createdAt));
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, user.id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBoard(name: string): Promise<string> {
  const user = await requireUser();
  const id = crypto.randomUUID();
  await db.insert(boards).values({ id, userId: user.id, name });
  return id;
}

export async function updateBoard(
  boardId: string,
  patch: { name?: string },
): Promise<void> {
  const user = await requireUser();
  const result = await db
    .update(boards)
    .set(patch)
    .where(and(eq(boards.id, boardId), eq(boards.userId, user.id)));
  if (result.rowCount === 0) throw new Error("Board not found");
}

export async function deleteBoard(boardId: string): Promise<void> {
  const user = await requireUser();
  const result = await db
    .delete(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, user.id)));
  if (result.rowCount === 0) throw new Error("Board not found");
}
