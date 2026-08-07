import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  type Board,
  type BoardShareRole,
  boardShares,
  boards,
  nodes,
  type StoredNode,
} from "@/db/schema";

export type BoardAccessRole = "owner" | BoardShareRole;
export type BoardPermission = "view" | "edit" | "owner";

export type BoardAccess = {
  board: Board;
  role: BoardAccessRole;
};

function permits(role: BoardAccessRole, permission: BoardPermission): boolean {
  if (role === "owner") return true;
  if (permission === "owner") return false;
  if (permission === "edit") return role === "editor";
  return true;
}

export async function findBoardAccess(
  boardId: string,
  userId: string,
): Promise<BoardAccess | null> {
  const rows = await db
    .select({ board: boards, sharedRole: boardShares.role })
    .from(boards)
    .leftJoin(
      boardShares,
      and(eq(boardShares.boardId, boards.id), eq(boardShares.userId, userId)),
    )
    .where(
      and(
        eq(boards.id, boardId),
        or(eq(boards.userId, userId), isNotNull(boardShares.userId)),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    board: row.board,
    role:
      row.board.userId === userId
        ? "owner"
        : (row.sharedRole as BoardShareRole),
  };
}

export async function requireBoardAccess(
  boardId: string,
  userId: string,
  permission: BoardPermission,
): Promise<BoardAccess> {
  const access = await findBoardAccess(boardId, userId);
  if (!access) throw new Error("Board not found");
  if (!permits(access.role, permission)) throw new Error("Forbidden");
  return access;
}

export async function requireNodeAccess(
  nodeId: string,
  userId: string,
  permission: BoardPermission,
): Promise<{ node: StoredNode; access: BoardAccess }> {
  const rows = await db
    .select()
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1);
  const node = rows[0];
  if (!node) throw new Error("Node not found");
  const access = await requireBoardAccess(node.boardId, userId, permission);
  return { node, access };
}
