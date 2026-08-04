import { Board, BoardNotFound } from "@/components/board";
import { getBoard } from "@/services/boards";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const board = await getBoard(id);

  if (!board) return <BoardNotFound />;
  return <Board board={board} />;
}
