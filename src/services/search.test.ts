import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  requireUser: vi.fn(),
  embedSearchText: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/embedding", () => ({
  embedSearchText: mocks.embedSearchText,
}));

vi.mock("@/db", () => ({
  db: {
    execute: mocks.execute,
  },
}));

import { PgDialect } from "drizzle-orm/pg-core";
import { searchNodes } from "./search";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "user-a" });
  mocks.embedSearchText.mockResolvedValue([0.1, 0.2, 0.3]);
  mocks.execute.mockResolvedValue({ rows: [] });
});

describe("searchNodes", () => {
  it("requires authentication", async () => {
    mocks.requireUser.mockRejectedValue(new Error("Unauthorized"));

    await expect(searchNodes({ query: "quarterly report" })).rejects.toThrow(
      "Unauthorized",
    );
    expect(mocks.embedSearchText).not.toHaveBeenCalled();
  });

  it("returns no results for an empty query without embedding it", async () => {
    await expect(searchNodes({ query: "   " })).resolves.toEqual([]);
    expect(mocks.embedSearchText).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("scopes both retrieval branches and the final result to the user", async () => {
    await searchNodes({
      query: "quarterly report",
      boardId: "board-a",
      limit: 10,
    });

    const statement = mocks.execute.mock.calls[0][0];
    const compiled = new PgDialect().sqlToQuery(statement);
    expect(compiled.sql).toContain("e.user_id =");
    expect(compiled.sql).toContain("n.user_id =");
    expect(compiled.sql).toContain("e.board_id =");
    expect(compiled.sql).toContain("n.board_id =");
    expect(compiled.params).toContain("user-a");
    expect(compiled.params).toContain("board-a");
    expect(compiled.params.filter((value) => value === "board-a")).toHaveLength(
      3,
    );
  });

  it("maps ranked database rows to the public search result", async () => {
    mocks.execute.mockResolvedValue({
      rows: [
        {
          nodeId: "node-1",
          boardId: "board-1",
          boardName: "Research",
          type: "pdf",
          data: {
            kind: "pdf",
            name: "roadmap.pdf",
            markdown: "Secret backing content",
            objectKey: "private/object",
          },
          excerpt: "roadmap.pdf Product direction",
          positionX: 12,
          positionY: 34,
          score: "0.0315",
          keywordMatch: true,
          semanticMatch: true,
        },
      ],
    });

    await expect(searchNodes({ query: "product plan" })).resolves.toEqual([
      {
        nodeId: "node-1",
        boardId: "board-1",
        boardName: "Research",
        type: "pdf",
        title: "roadmap.pdf",
        excerpt: "roadmap.pdf Product direction",
        position: { x: 12, y: 34 },
        score: 0.0315,
        matchedBy: { keyword: true, semantic: true },
      },
    ]);
  });

  it("rejects oversized queries and result limits", async () => {
    await expect(searchNodes({ query: "x".repeat(501) })).rejects.toThrow(
      "Invalid search query",
    );
    await expect(searchNodes({ query: "hello", limit: 51 })).rejects.toThrow(
      "Invalid search query",
    );
    expect(mocks.embedSearchText).not.toHaveBeenCalled();
  });
});
