import type { XYPosition } from "@xyflow/react";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { NodeDraft } from "@/lib/board-utils";
import {
  type BoardNode,
  DEFAULT_STYLE,
  nodeSize,
  toStoredData,
  useBoardStore,
} from "@/lib/store";
import { api } from "~/_generated/api";
import type { Id } from "~/_generated/dataModel";
import type { NodeData, NodeType } from "~/nodes";

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

/**
 * Standalone data-only update, for nodes that edit their own payload (e.g. a
 * link node backfilling OG metadata) and don't have a board id in scope.
 */
export function useUpdateNodeData() {
  const { data: session } = authClient.useSession();
  const boardId = useBoardStore((s) => s.nodesBoardId);
  const update = useMutation(api.nodes.update);
  return useCallback(
    (nodeId: string, data: NodeData) => {
      update({ nodeId: nodeId as Id<"nodes">, data });
      if (session?.user?.id && boardId) {
        triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
      }
    },
    [update, session?.user?.id, boardId],
  );
}

/**
 * Write actions for a board. All node mutations funnel through here so the
 * upload-then-create flow and optimistic cache updates live in one place.
 */
export function useBoardActions(boardId: Id<"boards">) {
  const { data: session } = authClient.useSession();
  const create = useMutation(api.nodes.create);
  const generateUploadUrl = useMutation(api.nodes.generateUploadUrl);

  const move = useMutation(api.nodes.update).withOptimisticUpdate(
    (localStore, { nodeId, position }) => {
      if (!position) return;
      const cur = localStore.getQuery(api.nodes.listByBoard, { boardId });
      if (!cur) return;
      localStore.setQuery(
        api.nodes.listByBoard,
        { boardId },
        cur.map((n) => (n._id === nodeId ? { ...n, position } : n)),
      );
    },
  );

  const update = useMutation(api.nodes.update);

  const resize = useMutation(api.nodes.update).withOptimisticUpdate(
    (localStore, { nodeId, style, position }) => {
      const cur = localStore.getQuery(api.nodes.listByBoard, { boardId });
      if (!cur) return;
      localStore.setQuery(
        api.nodes.listByBoard,
        { boardId },
        cur.map((n) =>
          n._id === nodeId
            ? {
                ...n,
                style: style ?? n.style,
                position: position ?? n.position,
              }
            : n,
        ),
      );
    },
  );

  const reorder = useMutation(api.nodes.update).withOptimisticUpdate(
    (localStore, { nodeId, zIndex }) => {
      const cur = localStore.getQuery(api.nodes.listByBoard, { boardId });
      if (!cur) return;
      localStore.setQuery(
        api.nodes.listByBoard,
        { boardId },
        cur.map((n) => (n._id === nodeId ? { ...n, zIndex } : n)),
      );
    },
  );

  const destroy = useMutation(api.nodes.remove).withOptimisticUpdate(
    (localStore, { nodeId }) => {
      const cur = localStore.getQuery(api.nodes.listByBoard, { boardId });
      if (!cur) return;
      localStore.setQuery(
        api.nodes.listByBoard,
        { boardId },
        cur.filter((n) => n._id !== nodeId),
      );
    },
  );

  const patchImg = useMutation(api.nodes.patchImage).withOptimisticUpdate(
    (localStore, { nodeId, fit }) => {
      if (fit === undefined) return; // storageId change shows after refetch
      const cur = localStore.getQuery(api.nodes.listByBoard, { boardId });
      if (!cur) return;
      localStore.setQuery(
        api.nodes.listByBoard,
        { boardId },
        cur.map((n) =>
          n._id === nodeId && n.data.kind === "image"
            ? { ...n, data: { ...n.data, fit } }
            : n,
        ),
      );
    },
  );

  const upload = useCallback(
    async (file: File): Promise<Id<"_storage">> => {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    [generateUploadUrl],
  );

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
        const nodeId = await create({
          boardId,
          type: draft.kind as NodeType,
          position,
          data,
          style: DEFAULT_STYLE[draft.kind],
        });
        if (session?.user?.id) {
          triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add node");
      }
    },
    [boardId, create, draftToData, session?.user?.id],
  );

  const moveNode = useCallback(
    (nodeId: string, position: XYPosition) =>
      move({ nodeId: nodeId as Id<"nodes">, position }),
    [move],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      destroy({ nodeId: nodeId as Id<"nodes"> });
      triggerEmbedDelete(nodeId);
    },
    [destroy],
  );

  const setNodeData = useCallback(
    (nodeId: string, data: NodeData) => {
      update({ nodeId: nodeId as Id<"nodes">, data });
      if (session?.user?.id) {
        triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
      }
    },
    [update, boardId, session?.user?.id],
  );

  const resizeNode = useCallback(
    (
      nodeId: string,
      style: { width: number; height: number },
      position?: XYPosition,
    ) => resize({ nodeId: nodeId as Id<"nodes">, style, position }),
    [resize],
  );

  const duplicateNode = useCallback(
    async (node: BoardNode) => {
      const data = toStoredData(node.data);
      const nodeId = await create({
        boardId,
        type: node.type,
        position: { x: node.position.x + 24, y: node.position.y + 24 },
        data,
        style: nodeSize(node),
      });
      if (session?.user?.id) {
        triggerEmbed({ nodeId, boardId, userId: session.user.id, data });
      }
    },
    [boardId, create, session?.user?.id],
  );

  const bringToFront = useCallback(
    (node: BoardNode) => {
      const maxZ = Math.max(
        0,
        ...useBoardStore.getState().nodes.map((n) => n.zIndex ?? 0),
      );
      return reorder({ nodeId: node.id as Id<"nodes">, zIndex: maxZ + 1 });
    },
    [reorder],
  );

  const setImageFit = useCallback(
    (nodeId: string, fit: "cover" | "contain") =>
      patchImg({ nodeId: nodeId as Id<"nodes">, fit }),
    [patchImg],
  );

  // Upload a cropped data URL as a new file and point the node at it.
  const replaceImage = useCallback(
    async (nodeId: string, croppedDataUrl: string) => {
      const blob = await (await fetch(croppedDataUrl)).blob();
      const file = new File([blob], "crop.png", {
        type: blob.type || "image/png",
      });
      const storageId = await upload(file);
      await patchImg({ nodeId: nodeId as Id<"nodes">, storageId });
    },
    [patchImg, upload],
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
