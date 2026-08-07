import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(),
  },
}));

vi.mock("@/services/board-access", () => ({
  requireNodeAccess: vi.fn(),
}));

import { db as _db } from "@/db";
import { getSession } from "@/lib/auth-server";
import { requireNodeAccess } from "@/services/board-access";
import { DELETE } from "./route";

const db = _db as any;
const mockGetSession = vi.mocked(getSession);
const mockRequireNodeAccess = vi.mocked(requireNodeAccess);

function chainable(value: unknown) {
  const p = Promise.resolve(value) as any;
  p.where = vi.fn().mockReturnThis();
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

beforeEach(() => {
  vi.clearAllMocks();
  db.delete.mockReset();
  mockGetSession.mockResolvedValue(SESSION_A as any);
  mockRequireNodeAccess.mockResolvedValue({
    node: { id: "n1" },
    access: {},
  } as any);
});

function makeReq(nodeId: string) {
  return [
    new Request(`http://localhost/api/embed/${nodeId}`, { method: "DELETE" }),
    { params: Promise.resolve({ nodeId }) },
  ] as const;
}

describe("DELETE /api/embed/[nodeId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null as any);
    const [req, ctx] = makeReq("n1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("requires edit access before deleting by node id", async () => {
    db.delete.mockReturnValue(chainable(undefined));
    const [req, ctx] = makeReq("n1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    expect(db.delete).toHaveBeenCalled();
    expect(mockRequireNodeAccess).toHaveBeenCalledWith("n1", "user-a", "edit");
    const whereChain = db.delete.mock.results[0].value;
    expect(whereChain.where).toHaveBeenCalled();
  });
});
