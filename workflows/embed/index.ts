import type { NodeData } from "@/db/schema";
import { stepEmbedText, stepUpsertEmbedding } from "./steps";
import { embeddableText } from "./utils";

export async function workflowEmbedNode(params: {
  nodeId: string;
  boardId: string;
  userId: string;
  data: NodeData;
}) {
  "use workflow";

  const text = embeddableText(params.data);
  if (!text) return;

  const embedding = await stepEmbedText(text);

  await stepUpsertEmbedding({
    nodeId: params.nodeId,
    boardId: params.boardId,
    userId: params.userId,
    embedding,
  });
}
