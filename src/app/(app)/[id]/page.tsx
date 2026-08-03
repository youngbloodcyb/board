import { Board } from "@/components/board";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Board boardId={id} />;
}
