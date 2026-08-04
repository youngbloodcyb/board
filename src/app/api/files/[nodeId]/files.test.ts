import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
}));

import { get } from "@vercel/blob";
import { db as _db } from "@/db";
import { getSession } from "@/lib/auth-server";
import { GET } from "./route";

const db = _db as any;
const mockGetSession = vi.mocked(getSession);
const mockGet = vi.mocked(get);

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

function makeReq(nodeId: string) {
  return [
    new Request(`http://localhost/api/files/${nodeId}`),
    { params: Promise.resolve({ nodeId }) },
  ] as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.select.mockReset();
  mockGetSession.mockResolvedValue(SESSION_A as any);
});

describe("GET /api/files/[nodeId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null as any);
    const [req, ctx] = makeReq("n1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the node does not exist", async () => {
    db.select.mockReturnValue(chainable([]));
    const [req, ctx] = makeReq("missing");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 404 when the node is owned by another user", async () => {
    db.select.mockReturnValue(
      chainable([
        {
          id: "n1",
          userId: "user-b",
          data: { kind: "image", objectKey: "user-b/board-b/img1" },
        },
      ]),
    );
    const [req, ctx] = makeReq("n1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("redirects to the external url when there is no objectKey", async () => {
    db.select.mockReturnValue(
      chainable([
        {
          id: "n1",
          userId: "user-a",
          data: { kind: "image", url: "https://example.com/img.png" },
        },
      ]),
    );
    const [req, ctx] = makeReq("n1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/img.png");
  });

  it("returns 404 when there is no objectKey and no external url", async () => {
    db.select.mockReturnValue(
      chainable([
        {
          id: "n1",
          userId: "user-a",
          data: { kind: "text", text: "hi" },
        },
      ]),
    );
    const [req, ctx] = makeReq("n1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("streams the blob for an owned image node with an objectKey", async () => {
    db.select.mockReturnValue(
      chainable([
        {
          id: "n1",
          userId: "user-a",
          data: { kind: "image", objectKey: "user-a/board-a/img1" },
        },
      ]),
    );
    mockGet.mockResolvedValue({
      statusCode: 200,
      blob: {
        contentType: "image/png",
        size: 1024,
        etag: "abc123",
      },
      stream: new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    } as any);
    const [req, ctx] = makeReq("n1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("etag")).toBe("abc123");
  });
});
