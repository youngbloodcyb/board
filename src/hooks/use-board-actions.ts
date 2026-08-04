import { upload as uploadBlob } from "@vercel/blob/client";
import type { XYPosition } from "@xyflow/react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { NodeData, NodeType } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import { objectKeyFor } from "@/lib/blob";
import type { NodeDraft } from "@/lib/board-utils";
import {
  type BoardNode,
  DEFAULT_STYLE,
  nodeSize,
  type PendingNode,
  type PendingNodePreview,
  toClientNodeData,
  useBoardStore,
} from "@/lib/store";
import {
  createNode,
  duplicateNode as duplicateNodeAction,
  patchImageNode,
  removeNode as removeNodeAction,
  updateNode,
} from "@/services/nodes";

function triggerEmbed(params: {
  nodeId: string;
  boardId: string;
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

function pendingPreview(draft: NodeDraft): PendingNodePreview {
  switch (draft.kind) {
    case "link":
      return { kind: "link", url: draft.url };
    case "text":
      return { kind: "text", text: draft.text };
    case "image":
      return {
        kind: "image",
        src: URL.createObjectURL(draft.file),
        alt: draft.alt,
      };
    case "pdf":
      return "file" in draft
        ? {
            kind: "pdf",
            src: URL.createObjectURL(draft.file),
            name: draft.name,
          }
        : { kind: "pdf", src: draft.url, name: draft.name };
  }
}

const isFileDraft = (
  draft: NodeDraft,
): draft is Extract<NodeDraft, { file: File }> => "file" in draft;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Couldn't add node";
}

function positionsMatch(a: XYPosition, b: XYPosition): boolean {
  return a.x === b.x && a.y === b.y;
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
        triggerEmbed({ nodeId, boardId, data });
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
  const userId = session?.user?.id;
  const processingPendingIds = useRef(new Set<string>());

  const uploadFile = useCallback(
    async (
      file: File,
      onProgress?: (percentage: number) => void,
    ): Promise<string> => {
      if (!userId) throw new Error("Not signed in");
      const pathname = objectKeyFor(userId, boardId);
      const { pathname: stored } = await uploadBlob(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: boardId,
        contentType: file.type,
        onUploadProgress: ({ percentage }) => onProgress?.(percentage),
      });
      return stored;
    },
    [userId, boardId],
  );

  // Turn a detected draft into the stored node data, uploading files first.
  const draftToData = useCallback(
    async (
      draft: NodeDraft,
      onProgress?: (percentage: number) => void,
    ): Promise<NodeData> => {
      switch (draft.kind) {
        case "link":
          return { kind: "link", url: draft.url };
        case "text":
          return { kind: "text", text: draft.text };
        case "image":
          return {
            kind: "image",
            objectKey: await uploadFile(draft.file, onProgress),
            alt: draft.alt,
          };
        case "pdf":
          return "file" in draft
            ? {
                kind: "pdf",
                objectKey: await uploadFile(draft.file, onProgress),
                name: draft.name,
              }
            : { kind: "pdf", url: draft.url, name: draft.name };
      }
    },
    [uploadFile],
  );

  const processPendingDraft = useCallback(
    async (pendingId: string, draft: NodeDraft) => {
      if (processingPendingIds.current.has(pendingId)) return;
      const initialPending = useBoardStore
        .getState()
        .pendingNodes.find((node) => node.id === pendingId);
      if (!initialPending) return;

      processingPendingIds.current.add(pendingId);
      const fileBacked = isFileDraft(draft);
      useBoardStore.getState().updatePendingNode(pendingId, {
        phase: fileBacked ? "uploading" : "saving",
        progress: fileBacked ? 0 : undefined,
        error: undefined,
      });

      try {
        const data = await draftToData(draft, (percentage) => {
          useBoardStore.getState().updatePendingNode(pendingId, {
            progress: percentage,
          });
        });
        useBoardStore.getState().updatePendingNode(pendingId, {
          phase: "saving",
          progress: fileBacked ? 100 : undefined,
        });

        const beforeCreate =
          useBoardStore
            .getState()
            .pendingNodes.find((node) => node.id === pendingId) ??
          initialPending;
        const nodeId = await createNode({
          boardId,
          type: draft.kind as NodeType,
          position: beforeCreate.position,
          data,
          style: DEFAULT_STYLE[draft.kind],
        });

        const latest = useBoardStore
          .getState()
          .pendingNodes.find((node) => node.id === pendingId);
        const finalPosition = latest?.position ?? beforeCreate.position;
        const promoted = useBoardStore
          .getState()
          .promotePendingNode(pendingId, {
            id: nodeId,
            type: draft.kind as NodeType,
            position: finalPosition,
            data: toClientNodeData(data, nodeId),
            style: DEFAULT_STYLE[draft.kind],
          } as BoardNode);

        if (promoted && !positionsMatch(finalPosition, beforeCreate.position)) {
          updateNode({ nodeId, position: finalPosition }).catch((error) =>
            console.error("node move failed", error),
          );
        }
        if (userId) triggerEmbed({ nodeId, boardId, data });
      } catch (error) {
        const pendingStillVisible = useBoardStore
          .getState()
          .pendingNodes.some((node) => node.id === pendingId);
        if (pendingStillVisible) {
          const message = errorMessage(error);
          useBoardStore.getState().updatePendingNode(pendingId, {
            phase: "failed",
            error: message,
          });
          toast.error(message);
        }
      } finally {
        processingPendingIds.current.delete(pendingId);
      }
    },
    [boardId, draftToData, userId],
  );

  const addDraft = useCallback(
    (draft: NodeDraft, position: XYPosition) => {
      const pendingId = `pending:${crypto.randomUUID()}`;
      const node: PendingNode = {
        id: pendingId,
        type: "pending",
        position,
        data: {
          kind: "pending",
          boardId,
          preview: pendingPreview(draft),
          phase: isFileDraft(draft) ? "uploading" : "saving",
          progress: isFileDraft(draft) ? 0 : undefined,
          onRetry: () => {
            void processPendingDraft(pendingId, draft);
          },
          onRemove: () => {
            useBoardStore.getState().removePendingNode(pendingId);
          },
        },
        style: DEFAULT_STYLE[draft.kind],
        selectable: false,
        deletable: false,
      };
      useBoardStore.getState().addPendingNode(node);
      void processPendingDraft(pendingId, draft);
    },
    [boardId, processPendingDraft],
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
      if (userId) {
        triggerEmbed({ nodeId, boardId, data });
      }
    },
    [boardId, userId],
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
        const { id: nodeId, data } = await duplicateNodeAction({
          nodeId: node.id,
          boardId,
          position: { x: node.position.x + 24, y: node.position.y + 24 },
          style: nodeSize(node),
        });
        addNodeLocal({
          ...node,
          id: nodeId,
          position: { x: node.position.x + 24, y: node.position.y + 24 },
          selected: false,
        });
        if (userId) {
          triggerEmbed({ nodeId, boardId, data });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't duplicate node",
        );
      }
    },
    [boardId, userId],
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
      const objectKey = await uploadFile(file);
      await patchImageNode({ nodeId, objectKey });
    },
    [uploadFile],
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
