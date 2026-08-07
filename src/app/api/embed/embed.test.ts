import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  getSession: vi.fn(),
}));

vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@workflows/embed", () => ({
  workflowEmbedNode: vi.fn(),
}));

vi.mock("@/services/board-access", () => ({
  requireNodeAccess: vi.fn(),
}));

import { workflowEmbedNode } from "@workflows/embed";
import { start } from "workflow/api";
import { getSession } from "@/lib/auth-server";
import { requireNodeAccess } from "@/services/board-access";
import { POST } from "./route";

const mockGetSession = vi.mocked(getSession);
const mockStart = vi.mocked(start);
const mockWorkflowEmbedNode = vi.mocked(workflowEmbedNode);
const mockRequireNodeAccess = vi.mocked(requireNodeAccess);

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
    mockRequireNodeAccess.mockRejectedValue(new Error("Forbidden"));
    const res = await POST(jsonReq({ nodeId: "n-other" }));
    expect(res.status).toBe(404);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("starts the embed workflow when the node is owned", async () => {
    mockRequireNodeAccess.mockResolvedValue({
      node: { id: "n1" },
      access: {},
    } as any);
    const res = await POST(jsonReq({ nodeId: "n1" }));
    expect(res.status).toBe(200);
    expect(mockStart).toHaveBeenCalledWith(mockWorkflowEmbedNode, ["n1"]);
  });

  it("ignores untrusted workflow parameters in the request body", async () => {
    mockRequireNodeAccess.mockResolvedValue({
      node: { id: "n1" },
      access: {},
    } as any);
    await POST(
      jsonReq({
        nodeId: "n1",
        boardId: "board-attacker",
        userId: "user-attacker",
        data: { kind: "text", text: "Untrusted" },
      }),
    );
    expect(mockStart).toHaveBeenCalledWith(mockWorkflowEmbedNode, ["n1"]);
  });
});
