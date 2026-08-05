import { Board, BoardNotFound } from "@/components/board";
import { getBoard } from "@/services/boards";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ node?: string | string[] }>;
}) {
  const { id } = await params;
  const { node } = await searchParams;
  const board = await getBoard(id);

  if (!board) return <BoardNotFound />;
  return (
    <Board
      board={board}
      focusNodeId={typeof node === "string" ? node : undefined}
    />
  );
}
