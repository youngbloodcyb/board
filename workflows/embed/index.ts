import {
  stepDeleteEmbedding,
  stepEmbedImage,
  stepEmbedText,
  stepGetNodeEmbeddingSource,
  stepUpsertEmbedding,
} from "./steps";

export async function workflowEmbedNode(nodeId: string) {
  "use workflow";

  const source = await stepGetNodeEmbeddingSource(nodeId);
  if (!source) {
    await stepDeleteEmbedding(nodeId);
    return;
  }

  const embedding =
    source.kind === "image"
      ? await stepEmbedImage(source.objectKey)
      : await stepEmbedText({ title: source.title, text: source.text });

  await stepUpsertEmbedding({
    nodeId,
    sourceKey: source.sourceKey,
    embedding,
  });
}
