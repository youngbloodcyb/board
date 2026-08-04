import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@workflows/embed", () => ({
  workflowEmbedNode: vi.fn(),
}));

import { workflowEmbedNode } from "@workflows/embed";
import { start } from "workflow/api";
import { db as _db } from "@/db";
import { getSession } from "@/lib/auth-server";
import { POST } from "./route";

const db = _db as any;
const mockGetSession = vi.mocked(getSession);
const mockStart = vi.mocked(start);
const mockWorkflowEmbedNode = vi.mocked(workflowEmbedNode);

function chainable(value: unknown) {
  const p = Promise.resolve(value) as any;
  p.from = vi.fn().mockReturnThis();
  p.where = vi.fn().mockReturnThis();
  p.limit = vi.fn().mockReturnThis();
  return p;
}

const SESSION_A = {
  user: {
    id: "user-a",
    name: "A",
    email: "a@test.com",
    emailVerified: false,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: "sess-a",
    userId: "user-a",
    expiresAt: new Date(),
    token: "tok-a",
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
  },
};

function jsonReq(body: unknown) {
  return new Request("http://localhost/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.select.mockReset();
  db.delete.mockReset();
  mockGetSession.mockResolvedValue(SESSION_A as any);
});

describe("POST /api/embed", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null as any);
    const res = await POST(jsonReq({ nodeId: "n1" }));
    expect(res.status).toBe(401);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("returns 404 when the node is not owned by the caller", async () => {
    db.select.mockReturnValue(chainable([]));
    const res = await POST(jsonReq({ nodeId: "n-other" }));
    expect(res.status).toBe(404);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("starts the embed workflow with the session user id when the node is owned", async () => {
    const data = { kind: "text", text: "hello" };
    db.select.mockReturnValue(chainable([{ id: "n1", boardId: "b1", data }]));
    const res = await POST(jsonReq({ nodeId: "n1" }));
    expect(res.status).toBe(200);
    expect(mockStart).toHaveBeenCalledWith(mockWorkflowEmbedNode, [
      { nodeId: "n1", boardId: "b1", userId: "user-a", data },
    ]);
  });

  it("uses authoritative node data instead of request body fields", async () => {
    const data = { kind: "pdf", name: "report.pdf", markdown: "# Stored" };
    db.select.mockReturnValue(
      chainable([{ id: "n1", boardId: "board-owned", data }]),
    );
    await POST(
      jsonReq({
        nodeId: "n1",
        boardId: "board-attacker",
        userId: "user-attacker",
        data: { kind: "text", text: "Untrusted" },
      }),
    );
    expect(mockStart).toHaveBeenCalledWith(mockWorkflowEmbedNode, [
      {
        nodeId: "n1",
        boardId: "board-owned",
        userId: "user-a",
        data,
      },
    ]);
  });
});
