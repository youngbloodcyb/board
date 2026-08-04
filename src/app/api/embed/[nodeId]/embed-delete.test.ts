import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: vi.fn(),
  },
}));

import { db as _db } from "@/db";
import { getSession } from "@/lib/auth-server";
import { DELETE } from "./route";

const db = _db as any;
const mockGetSession = vi.mocked(getSession);

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

  it("scopes the delete by both nodeId and the session user id", async () => {
    db.delete.mockReturnValue(chainable(undefined));
    const [req, ctx] = makeReq("n1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    expect(db.delete).toHaveBeenCalled();
    const whereChain = db.delete.mock.results[0].value;
    expect(whereChain.where).toHaveBeenCalled();
  });
});
