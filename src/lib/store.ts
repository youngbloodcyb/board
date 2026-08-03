import { applyNodeChanges, type Node, type NodeChange } from "@xyflow/react";
import { create } from "zustand";
import type { ClientNode, NodeData } from "@/db/schema";

// The server (drizzle via src/services) is the source of truth. These types
// match the resolved client view returned by `listNodesByBoard`, where
// image/pdf `storageId | url` has already been collapsed into a `src` URL.
export type BoardNodeData = ClientNode["data"];

// Per-kind narrowing of the data union, handy for components.
export type LinkNodeData = Extract<BoardNodeData, { kind: "link" }>;
export type TextNodeData = Extract<BoardNodeData, { kind: "text" }>;
export type ImageNodeData = Extract<BoardNodeData, { kind: "image" }>;
export type PdfNodeData = Extract<BoardNodeData, { kind: "pdf" }>;
export type OgMeta = NonNullable<LinkNodeData["og"]>;

// Kinds whose client and stored data shapes are identical, so they can be
// edited in place (image/pdf differ — storageId/url vs resolved src).
export type EditableNodeData = LinkNodeData | TextNodeData;

export type LinkNode = Node<LinkNodeData, "link">;
export type TextNode = Node<TextNodeData, "text">;
export type ImageNode = Node<ImageNodeData, "image">;
export type PdfNode = Node<PdfNodeData, "pdf">;

export type BoardNode = LinkNode | TextNode | ImageNode | PdfNode;

// Default footprint per node kind, applied at creation time.
export const DEFAULT_STYLE: Record<
  BoardNodeData["kind"],
  { width: number; height: number }
> = {
  link: { width: 256, height: 280 },
  text: { width: 220, height: 120 },
  image: { width: 240, height: 240 },
  pdf: { width: 320, height: 400 },
};

// The single selected node, or null when nothing — or more than one — is
// selected. The node dock is a single-node inspector, so it stays hidden
// unless exactly one node is selected.
const soleSelected = (nodes: BoardNode[]): BoardNode | null => {
  const selected = nodes.filter((n) => n.selected);
  return selected.length === 1 ? selected[0] : null;
};

/** Server row -> React Flow node (id comes from the row's id). */
export const toBoardNode = (doc: ClientNode): BoardNode =>
  ({
    id: doc.id,
    type: doc.type,
    position: doc.position,
    data: doc.data,
    style: doc.style,
    zIndex: doc.zIndex,
  }) as BoardNode;

/** Client node data -> the STORED shape the create/update actions expect. */
export const toStoredData = (data: BoardNodeData): NodeData => {
  switch (data.kind) {
    // Reference the same file by its resolved URL (storageId isn't on the
    // client view); links/text are identical in both shapes.
    case "image":
      return { kind: "image", url: data.src, alt: data.alt };
    case "pdf":
      return { kind: "pdf", url: data.src, name: data.name };
    default:
      return data;
  }
};

/** STORED node data -> the client shape the canvas renders (image/pdf src). */
export const toClientNodeData = (data: NodeData): BoardNodeData => {
  switch (data.kind) {
    case "image":
      return {
        kind: "image",
        src: data.url ?? "",
        alt: data.alt,
        fit: data.fit,
      };
    case "pdf":
      return { kind: "pdf", src: data.url ?? "", name: data.name };
    default:
      return data;
  }
};

/** Current rendered size of a node, falling back to its kind's default. */
export const nodeSize = (
  node: BoardNode,
): { width: number; height: number } => {
  const style = node.style as { width?: number; height?: number } | undefined;
  const def = DEFAULT_STYLE[node.type];
  return {
    width: node.measured?.width ?? style?.width ?? def.width,
    height: node.measured?.height ?? style?.height ?? def.height,
  };
};

type BoardState = {
  nodes: BoardNode[];
  // Which board `nodes` currently belongs to. Lets the canvas avoid rendering
  // a previous board's nodes while a new board's query is still loading.
  nodesBoardId: string | null;
  selectedNode: BoardNode | null;
  // The text node currently open in the editor drawer (null = drawer closed).
  editingTextNodeId: string | null;
  openTextEditor: (id: string) => void;
  closeTextEditor: () => void;
  // The image node currently open in the crop dialog (null = closed).
  croppingImageNodeId: string | null;
  openImageCrop: (id: string) => void;
  closeImageCrop: () => void;
  // Replace local nodes with the latest server snapshot for `boardId`,
  // preserving transient React Flow UI state (selection, in-flight drag,
  // measurements) only when staying on the same board.
  setNodes: (boardId: string, incoming: BoardNode[]) => void;
  onNodesChange: (changes: NodeChange<BoardNode>[]) => void;
  // Local, optimistic data merge (persisted separately via a mutation).
  updateNodeData: (id: string, patch: Partial<BoardNodeData>) => void;
};

export const useBoardStore = create<BoardState>((set, get) => ({
  nodes: [],
  nodesBoardId: null,
  selectedNode: null,
  editingTextNodeId: null,
  openTextEditor: (id) => set({ editingTextNodeId: id }),
  closeTextEditor: () => set({ editingTextNodeId: null }),
  croppingImageNodeId: null,
  openImageCrop: (id) => set({ croppingImageNodeId: id }),
  closeImageCrop: () => set({ croppingImageNodeId: null }),
  setNodes: (boardId, incoming) => {
    // Only carry over UI state when we're refreshing the same board; switching
    // boards must replace wholesale so nothing stale leaks across.
    const sameBoard = get().nodesBoardId === boardId;
    const prev = sameBoard ? new Map(get().nodes.map((n) => [n.id, n])) : null;
    const nodes = incoming.map((n) => {
      const old = prev?.get(n.id);
      if (!old) return n;
      return {
        ...old,
        ...n,
        // Keep UI-only state that the server doesn't know about.
        selected: old.selected,
        dragging: old.dragging,
        measured: old.measured,
        // Don't let a server snapshot yank a node out from under an active drag.
        position: old.dragging ? old.position : n.position,
      } as BoardNode;
    });
    set({ nodes, selectedNode: soleSelected(nodes), nodesBoardId: boardId });
  },
  onNodesChange: (changes) => {
    const nodes = applyNodeChanges(changes, get().nodes);
    const selectedNode = soleSelected(nodes);
    set(
      selectedNode === get().selectedNode ? { nodes } : { nodes, selectedNode },
    );
  },
  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? ({ ...n, data: { ...n.data, ...patch } } as BoardNode)
          : n,
      ),
    });
  },
}));
