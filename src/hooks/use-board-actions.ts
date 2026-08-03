import type { XYPosition } from "@xyflow/react";
import { useCallback } from "react";
import { toast } from "sonner";
import type { NodeData, NodeType } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import type { NodeDraft } from "@/lib/board-utils";
import {
  type BoardNode,
  DEFAULT_STYLE,
  nodeSize,
  toClientNodeData,
  toStoredData,
  useBoardStore,
} from "@/lib/store";
import {
  createNode,
  generateUploadUrl,
  patchImageNode,
  removeNode as removeNodeAction,
  updateNode,
} from "@/services/nodes";

function triggerEmbed(params: {
  nodeId: string;
  boardId: string;
  userId: string;
  data: NodeData;
}) {
  fetch("/api/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch((err) => console.error("embed trigger failed", err));
}

function triggerEmbedDelete(nodeId: string) {
  fetch(`/api/embed/${nodeId}`, { method: "DELETE" }).catch((err) =>
    console.error("embed delete failed", err),
  );
}

/** Add a freshly created node to the local store so it shows immediately. */
function addNodeLocal(node: BoardNode) {
  useBoardStore.setState((s) => ({ nodes: [...s.nodes, node] }));
}

/**
 * Standalone data-only update, for nodes that edit their own payload (e.g. a
 * link node backfilling OG metadata) and don't have a board id in scope.
 */
export function useUpdateNodeData() {
  const { data: session } = authClient.useSession();
  const boardId = useBoardStore((s) => s.nodesBoardId);
  return useCallback(
    (nodeId: string, data: NodeData) => {
      updateNode({ nodeId, data }).catch((e) =>
        console.error("node update failed", e),
      );
      if (session?.user?.id && boardId) {
        triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
      }
    },
    [session?.user?.id, boardId],
  );
}

/**
 * Write actions for a board. All node mutations funnel through here so the
 * upload-then-create flow and optimistic cache updates live in one place.
 */
export function useBoardActions(boardId: string) {
  const { data: session } = authClient.useSession();

  const upload = useCallback(async (file: File): Promise<string> => {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { storageId } = (await res.json()) as { storageId: string };
    return storageId;
  }, []);

  // Turn a detected draft into the stored node data, uploading files first.
  const draftToData = useCallback(
    async (draft: NodeDraft): Promise<NodeData> => {
      switch (draft.kind) {
        case "link":
          return { kind: "link", url: draft.url };
        case "text":
          return { kind: "text", text: draft.text };
        case "image":
          return {
            kind: "image",
            storageId: await upload(draft.file),
            alt: draft.alt,
          };
        case "pdf":
          return "file" in draft
            ? {
                kind: "pdf",
                storageId: await upload(draft.file),
                name: draft.name,
              }
            : { kind: "pdf", url: draft.url, name: draft.name };
      }
    },
    [upload],
  );

  const addDraft = useCallback(
    async (draft: NodeDraft, position: XYPosition) => {
      try {
        const data = await draftToData(draft);
        const nodeId = await createNode({
          boardId,
          type: draft.kind as NodeType,
          position,
          data,
          style: DEFAULT_STYLE[draft.kind],
        });
        addNodeLocal({
          id: nodeId,
          type: draft.kind as NodeType,
          position,
          data: toClientNodeData(data),
          style: DEFAULT_STYLE[draft.kind],
        } as BoardNode);
        if (session?.user?.id) {
          triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add node");
      }
    },
    [boardId, draftToData, session?.user?.id],
  );

  const moveNode = useCallback((nodeId: string, position: XYPosition) => {
    updateNode({ nodeId, position }).catch((e) =>
      console.error("node move failed", e),
    );
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    useBoardStore.setState((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      selectedNode: s.selectedNode?.id === nodeId ? null : s.selectedNode,
    }));
    removeNodeAction(nodeId).catch((e) =>
      console.error("node remove failed", e),
    );
    triggerEmbedDelete(nodeId);
  }, []);

  const setNodeData = useCallback(
    (nodeId: string, data: NodeData) => {
      updateNode({ nodeId, data }).catch((e) =>
        console.error("node update failed", e),
      );
      if (session?.user?.id) {
        triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
      }
    },
    [boardId, session?.user?.id],
  );

  const resizeNode = useCallback(
    (
      nodeId: string,
      style: { width: number; height: number },
      position?: XYPosition,
    ) => {
      updateNode({ nodeId, style, position }).catch((e) =>
        console.error("node resize failed", e),
      );
    },
    [],
  );

  const duplicateNode = useCallback(
    async (node: BoardNode) => {
      try {
        const data = toStoredData(node.data);
        const nodeId = await createNode({
          boardId,
          type: node.type,
          position: { x: node.position.x + 24, y: node.position.y + 24 },
          data,
          style: nodeSize(node),
        });
        addNodeLocal({
          ...node,
          id: nodeId,
          position: { x: node.position.x + 24, y: node.position.y + 24 },
          selected: false,
        });
        if (session?.user?.id) {
          triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't duplicate node",
        );
      }
    },
    [boardId, session?.user?.id],
  );

  const bringToFront = useCallback((node: BoardNode) => {
    const maxZ = Math.max(
      0,
      ...useBoardStore.getState().nodes.map((n) => n.zIndex ?? 0),
    );
    const nextZ = maxZ + 1;
    useBoardStore.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === node.id ? { ...n, zIndex: nextZ } : n,
      ),
    }));
    updateNode({ nodeId: node.id, zIndex: nextZ }).catch((e) =>
      console.error("node reorder failed", e),
    );
  }, []);

  const setImageFit = useCallback(
    (nodeId: string, fit: "cover" | "contain") => {
      useBoardStore.setState((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId && n.data.kind === "image"
            ? ({ ...n, data: { ...n.data, fit } } as BoardNode)
            : n,
        ),
      }));
      patchImageNode({ nodeId, fit }).catch((e) =>
        console.error("image fit failed", e),
      );
    },
    [],
  );

  // Upload a cropped data URL as a new file and point the node at it.
  const replaceImage = useCallback(
    async (nodeId: string, croppedDataUrl: string) => {
      const blob = await (await fetch(croppedDataUrl)).blob();
      const file = new File([blob], "crop.png", {
        type: blob.type || "image/png",
      });
      const storageId = await upload(file);
      await patchImageNode({ nodeId, storageId });
    },
    [upload],
  );

  return {
    addDraft,
    moveNode,
    removeNode,
    setNodeData,
    resizeNode,
    duplicateNode,
    bringToFront,
    setImageFit,
    replaceImage,
  };
}
