import { useEffect, useState } from "react";
import { toBoardNode, useBoardStore } from "@/lib/store";
import { listNodesByBoard } from "@/services/nodes";

/**
 * Loads the board's nodes from the server and mirrors them into the local
 * store. The server (drizzle) is the source of truth; the store is just the
 * interaction cache React Flow renders from.
 */
export function useBoardSync(boardId: string) {
  const setNodes = useBoardStore((s) => s.setNodes);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNodesByBoard(boardId)
      .then((remote) => {
        if (cancelled) return;
        setNodes(boardId, remote.map(toBoardNode));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, setNodes]);

  // Ready only once the store actually holds THIS board's nodes. On a board
  // switch the store still tags the previous board, so this stays false until
  // the load above completes — preventing a flash of the old board.
  return useBoardStore((s) => !loading && s.nodesBoardId === boardId);
}
