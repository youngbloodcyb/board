import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardNode, PendingNode } from "@/lib/store";
import { useBoardStore } from "@/lib/store";

const persistedNode = (id = "node-1"): BoardNode => ({
  id,
  type: "text",
  position: { x: 10, y: 20 },
  data: { kind: "text", text: "hello" },
});

const pendingNode = (
  boardId = "board-a",
  preview: PendingNode["data"]["preview"] = {
    kind: "text",
    text: "pending",
  },
): PendingNode => ({
  id: "pending:1",
  type: "pending",
  position: { x: 1, y: 2 },
  data: {
    kind: "pending",
    boardId,
    preview,
    phase: "uploading",
    progress: 0,
    onRetry: vi.fn(),
    onRemove: vi.fn(),
  },
});

beforeEach(() => {
  useBoardStore.setState({
    nodes: [],
    pendingNodes: [],
    nodesBoardId: null,
    selectedNode: null,
    editingTextNodeId: null,
    croppingImageNodeId: null,
  });
});

describe("pending board nodes", () => {
  it("survives the initial server snapshot for the same board", () => {
    const pending = pendingNode();
    useBoardStore.getState().addPendingNode(pending);

    useBoardStore.getState().setNodes("board-a", [persistedNode()]);

    expect(useBoardStore.getState().pendingNodes).toEqual([pending]);
    expect(useBoardStore.getState().nodes).toHaveLength(1);
  });

  it("tracks React Flow position changes while pending", () => {
    useBoardStore.getState().addPendingNode(pendingNode());

    useBoardStore.getState().onNodesChange([
      {
        id: "pending:1",
        type: "position",
        position: { x: 30, y: 40 },
        dragging: true,
      },
    ]);

    expect(useBoardStore.getState().pendingNodes[0]?.position).toEqual({
      x: 30,
      y: 40,
    });
  });

  it("atomically promotes a pending node and releases its blob preview", () => {
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    useBoardStore.getState().addPendingNode(
      pendingNode("board-a", {
        kind: "image",
        src: "blob:preview",
        alt: "preview",
      }),
    );

    const promoted = useBoardStore
      .getState()
      .promotePendingNode("pending:1", persistedNode("node-real"));

    expect(promoted).toBe(true);
    expect(useBoardStore.getState().pendingNodes).toEqual([]);
    expect(useBoardStore.getState().nodes.map((node) => node.id)).toEqual([
      "node-real",
    ]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    revokeObjectURL.mockRestore();
  });

  it("does not duplicate a node already present in a racing server snapshot", () => {
    useBoardStore.getState().addPendingNode(pendingNode());
    useBoardStore.getState().setNodes("board-a", [persistedNode("node-real")]);

    useBoardStore
      .getState()
      .promotePendingNode("pending:1", {
        ...persistedNode("node-real"),
        position: { x: 50, y: 60 },
      });

    expect(useBoardStore.getState().nodes).toHaveLength(1);
    expect(useBoardStore.getState().nodes[0]?.position).toEqual({
      x: 50,
      y: 60,
    });
  });

  it("clears pending previews when switching boards", () => {
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    useBoardStore.setState({ nodesBoardId: "board-a" });
    useBoardStore.getState().addPendingNode(
      pendingNode("board-a", {
        kind: "pdf",
        src: "blob:pdf-preview",
        name: "notes.pdf",
      }),
    );

    useBoardStore.getState().setNodes("board-b", []);

    expect(useBoardStore.getState().pendingNodes).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pdf-preview");
    revokeObjectURL.mockRestore();
  });
});
