"use client";

import {
  Background,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { DockMenu } from "@/components/dock-menu";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { Loading } from "@/components/loading";
import { NodeDock } from "@/components/node-dock";
import { nodeTypes } from "@/components/nodes";
import { TextEditorDrawer } from "@/components/text-editor-drawer";
import { Button } from "@/components/ui/button";
import type { Board as BoardRow } from "@/db/schema";
import { useBoardActions } from "@/hooks/use-board-actions";
import { useBoardSync } from "@/hooks/use-board-sync";
import { useCanvasInputs } from "@/hooks/use-canvas-inputs";
import { type CanvasNode, useBoardStore } from "@/lib/store";

const proOptions = { hideAttribution: true };

function BoardCanvas({ boardId }: { boardId: string }) {
  const ready = useBoardSync(boardId);
  const { moveNode, removeNode, resizeNode } = useBoardActions(boardId);
  const {
    nodes,
    pendingNodes,
    onNodesChange: applyChanges,
  } = useBoardStore(
    useShallow((s) => ({
      nodes: s.nodes,
      pendingNodes: s.pendingNodes,
      onNodesChange: s.onNodesChange,
    })),
  );
  const { onDragOver, onDrop } = useCanvasInputs(boardId);
  const canvasNodes = useMemo(
    () => [...nodes, ...pendingNodes],
    [nodes, pendingNodes],
  );

  // Apply changes locally for smooth interaction, then persist the ones that
  // represent a committed edit: removals and finished resizes.
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const pendingIds = new Set(
        useBoardStore.getState().pendingNodes.map((node) => node.id),
      );
      for (const change of changes) {
        if (change.type === "remove" && pendingIds.has(change.id)) {
          useBoardStore.getState().removePendingNode(change.id);
        }
      }
      applyChanges(changes);
      for (const c of changes) {
        if (c.type === "remove") {
          if (!pendingIds.has(c.id)) removeNode(c.id);
        } else if (c.type === "dimensions" && c.resizing === false) {
          // Resize finished — read the settled node and persist its size
          // (and position, since corner handles can shift it).
          const node = useBoardStore
            .getState()
            .nodes.find((n) => n.id === c.id);
          const width =
            c.dimensions?.width ?? node?.width ?? node?.measured?.width;
          const height =
            c.dimensions?.height ?? node?.height ?? node?.measured?.height;
          if (node && width && height) {
            resizeNode(c.id, { width, height }, node.position);
          }
        }
      }
    },
    [applyChanges, removeNode, resizeNode],
  );

  // Hold the canvas until the store holds this board's nodes, so we never
  // paint the previously-open board while the new one is loading.
  if (!ready) return <Loading />;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow<CanvasNode>
        nodes={canvasNodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStop={(_, __, dragged) => {
          dragged.forEach((n) => {
            if (n.type !== "pending") moveNode(n.id, n.position);
          });
        }}
        fitView
        proOptions={proOptions}
      >
        <Background gap={20} size={1} />
      </ReactFlow>
      <NodeDock boardId={boardId} />
      <TextEditorDrawer />
      <ImageCropDialog boardId={boardId} />
      <DockMenu />
    </div>
  );
}

export function BoardNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">This board doesn&rsquo;t exist.</p>
      <Button asChild variant="outline">
        <Link href="/">Back to boards</Link>
      </Button>
    </div>
  );
}

export function Board({ board }: { board: BoardRow }) {
  return (
    <ReactFlowProvider>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50"
      >
        <Link href="/">← Boards</Link>
      </Button>
      <BoardCanvas boardId={board.id} />
    </ReactFlowProvider>
  );
}
