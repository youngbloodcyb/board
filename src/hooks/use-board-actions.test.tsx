import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({ upload: mocks.upload }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-a" } } }),
  },
}));
vi.mock("@/lib/blob", () => ({
  objectKeyFor: () => "user-a/board-a/upload",
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/services/nodes", () => ({
  createNode: mocks.createNode,
  duplicateNode: vi.fn(),
  patchImageNode: vi.fn(),
  removeNode: vi.fn(),
  updateNode: mocks.updateNode,
}));

import { useBoardActions } from "@/hooks/use-board-actions";
import { useBoardStore } from "@/lib/store";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  useBoardStore.setState({
    nodes: [],
    pendingNodes: [],
    nodesBoardId: "board-a",
    selectedNode: null,
    editingTextNodeId: null,
    croppingImageNodeId: null,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 202 })),
  );
});

describe("addDraft optimistic nodes", () => {
  it("shows text immediately and promotes it after creation", async () => {
    const creation = deferred<string>();
    mocks.createNode.mockReturnValue(creation.promise);
    const { result } = renderHook(() => useBoardActions("board-a"));

    act(() => {
      result.current.addDraft(
        { kind: "text", text: "hello" },
        { x: 12, y: 34 },
      );
    });

    const pending = useBoardStore.getState().pendingNodes[0];
    expect(pending?.data.preview).toEqual({ kind: "text", text: "hello" });
    expect(pending?.data.phase).toBe("saving");
    expect(useBoardStore.getState().nodes).toEqual([]);

    await waitFor(() => expect(mocks.createNode).toHaveBeenCalledOnce());
    act(() => creation.resolve("node-real"));

    await waitFor(() => {
      expect(useBoardStore.getState().pendingNodes).toEqual([]);
      expect(useBoardStore.getState().nodes[0]?.id).toBe("node-real");
    });
  });

  it("uses a blob preview and reports file upload progress", async () => {
    const upload = deferred<{ pathname: string }>();
    mocks.upload.mockReturnValue(upload.promise);
    mocks.createNode.mockResolvedValue("image-real");
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:image-preview");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const { result } = renderHook(() => useBoardActions("board-a"));
    const file = new File(["image"], "photo.png", { type: "image/png" });

    act(() => {
      result.current.addDraft(
        { kind: "image", file, alt: file.name },
        { x: 0, y: 0 },
      );
    });

    expect(useBoardStore.getState().pendingNodes[0]?.data.preview).toEqual({
      kind: "image",
      src: "blob:image-preview",
      alt: "photo.png",
    });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());

    const options = mocks.upload.mock.calls[0]?.[2] as {
      onUploadProgress: (event: { percentage: number }) => void;
    };
    act(() => options.onUploadProgress({ percentage: 37 }));
    expect(useBoardStore.getState().pendingNodes[0]?.data.progress).toBe(37);

    act(() => upload.resolve({ pathname: "user-a/board-a/photo.png" }));
    await waitFor(() => {
      expect(useBoardStore.getState().nodes[0]?.id).toBe("image-real");
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:image-preview");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it("keeps failures visible and retries them in place", async () => {
    mocks.createNode.mockRejectedValueOnce(new Error("Database unavailable"));
    const { result } = renderHook(() => useBoardActions("board-a"));

    act(() => {
      result.current.addDraft(
        { kind: "link", url: "https://example.com" },
        { x: 5, y: 6 },
      );
    });

    await waitFor(() => {
      const pending = useBoardStore.getState().pendingNodes[0];
      expect(pending?.data.phase).toBe("failed");
      expect(pending?.data.error).toBe("Database unavailable");
    });

    mocks.createNode.mockResolvedValueOnce("link-real");
    act(() => {
      useBoardStore.getState().pendingNodes[0]?.data.onRetry();
    });

    await waitFor(() => {
      expect(useBoardStore.getState().pendingNodes).toEqual([]);
      expect(useBoardStore.getState().nodes[0]?.id).toBe("link-real");
    });
  });
});
