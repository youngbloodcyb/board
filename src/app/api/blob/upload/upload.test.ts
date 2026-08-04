import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-server", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(),
}));

import { handleUpload } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth-server";
import { POST } from "./route";

const mockRequireUser = vi.mocked(requireUser);
const mockHandleUpload = vi.mocked(handleUpload) as any;

const USER_A = {
  id: "user-a",
  name: "A",
  email: "a@test.com",
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/blob/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(USER_A as any);
  mockHandleUpload.mockImplementation(
    async ({
      onBeforeGenerateToken,
    }: {
      onBeforeGenerateToken: (pathname: string) => Promise<unknown>;
    }) => {
      await onBeforeGenerateToken("user-a/board-a/file.png");
      return { ok: true } as any;
    },
  );
});

describe("POST /api/blob/upload", () => {
  it("rejects when not authenticated", async () => {
    mockRequireUser.mockRejectedValue(new Error("Unauthorized"));
    await expect(
      POST(makeReq({ pathname: "user-a/board-a/file.png" })),
    ).rejects.toThrow("Unauthorized");
  });

  it("rejects when the object key is not scoped to the authenticated user", async () => {
    mockHandleUpload.mockImplementation(
      async ({
        onBeforeGenerateToken,
      }: {
        onBeforeGenerateToken: (pathname: string) => Promise<unknown>;
      }) => {
        await onBeforeGenerateToken("user-b/board-a/file.png");
        return { ok: true } as any;
      },
    );
    await expect(
      POST(makeReq({ pathname: "user-b/board-a/file.png" })),
    ).rejects.toThrow("Object key must be scoped to the authenticated user");
  });

  it("allows when the object key is scoped to the authenticated user", async () => {
    const res = await POST(makeReq({ pathname: "user-a/board-a/file.png" }));
    expect(res.status).toBe(200);
  });
});
