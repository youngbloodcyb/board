import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db as database } from "@/db";
import type { Board, StoredNode } from "@/db/schema";
import {
  findBoardAccess,
  requireBoardAccess,
  requireNodeAccess,
} from "./board-access";

const db = database as unknown as { select: ReturnType<typeof vi.fn> };

function chainable(value: unknown) {
  const promise = Promise.resolve(value) as Promise<unknown> & {
    from: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
  promise.from = vi.fn().mockReturnValue(promise);
  promise.leftJoin = vi.fn().mockReturnValue(promise);
  promise.where = vi.fn().mockReturnValue(promise);
  promise.limit = vi.fn().mockReturnValue(promise);
  return promise;
}

const board: Board = {
  id: "board-a",
  userId: "owner-a",
  name: "Board A",
  createdAt: new Date("2026-01-01"),
};

const node = {
  id: "node-a",
  boardId: board.id,
  userId: board.userId,
  type: "text",
  positionX: 0,
  positionY: 0,
  width: null,
  height: null,
  zIndex: null,
  data: { kind: "text", text: "Hello" },
  searchText: "Hello",
  embeddingSource: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
} satisfies StoredNode;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("board access", () => {
  it("resolves the board owner as owner", async () => {
    db.select.mockReturnValue(chainable([{ board, sharedRole: null }]));

    await expect(findBoardAccess(board.id, board.userId)).resolves.toEqual({
      board,
      role: "owner",
    });
  });

  it("resolves a shared viewer", async () => {
    db.select.mockReturnValue(chainable([{ board, sharedRole: "viewer" }]));

    await expect(findBoardAccess(board.id, "viewer-a")).resolves.toEqual({
      board,
      role: "viewer",
    });
  });

  it("conceals boards with no matching access", async () => {
    db.select.mockReturnValue(chainable([]));
    await expect(findBoardAccess(board.id, "stranger")).resolves.toBeNull();
  });

  it("allows viewers to read but not edit", async () => {
    db.select.mockReturnValue(chainable([{ board, sharedRole: "viewer" }]));
    await expect(
      requireBoardAccess(board.id, "viewer-a", "view"),
    ).resolves.toMatchObject({ role: "viewer" });

    db.select.mockReturnValue(chainable([{ board, sharedRole: "viewer" }]));
    await expect(
      requireBoardAccess(board.id, "viewer-a", "edit"),
    ).rejects.toThrow("Forbidden");
  });

  it("allows editors to edit but not manage sharing", async () => {
    db.select.mockReturnValue(chainable([{ board, sharedRole: "editor" }]));
    await expect(
      requireBoardAccess(board.id, "editor-a", "edit"),
    ).resolves.toMatchObject({ role: "editor" });

    db.select.mockReturnValue(chainable([{ board, sharedRole: "editor" }]));
    await expect(
      requireBoardAccess(board.id, "editor-a", "owner"),
    ).rejects.toThrow("Forbidden");
  });

  it("authorizes nodes through their board rather than node userId", async () => {
    let query = 0;
    db.select.mockImplementation(() => {
      query += 1;
      return query === 1
        ? chainable([node])
        : chainable([{ board, sharedRole: "viewer" }]);
    });

    await expect(
      requireNodeAccess(node.id, "viewer-a", "view"),
    ).resolves.toMatchObject({ node, access: { role: "viewer" } });
  });
});
