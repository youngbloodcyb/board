import {
  stepDeleteEmbedding,
  stepEmbedText,
  stepGetNodeSearchText,
  stepUpsertEmbedding,
} from "./steps";

export async function workflowEmbedNode(nodeId: string) {
  "use workflow";

  const text = await stepGetNodeSearchText(nodeId);
  if (!text) {
    await stepDeleteEmbedding(nodeId);
    return;
  }

  const embedding = await stepEmbedText(text);

  await stepUpsertEmbedding({
    nodeId,
    content: text,
    embedding,
  });
}
