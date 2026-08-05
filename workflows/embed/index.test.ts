import { beforeEach, describe, expect, it, vi } from "vitest";

const steps = vi.hoisted(() => ({
  getNodeSearchText: vi.fn(),
  embedText: vi.fn(),
  upsertEmbedding: vi.fn(),
  deleteEmbedding: vi.fn(),
}));

vi.mock("./steps", () => ({
  stepGetNodeSearchText: steps.getNodeSearchText,
  stepEmbedText: steps.embedText,
  stepUpsertEmbedding: steps.upsertEmbedding,
  stepDeleteEmbedding: steps.deleteEmbedding,
}));

import { workflowEmbedNode } from "./index";

beforeEach(() => {
  vi.clearAllMocks();
  steps.embedText.mockResolvedValue([0.1, 0.2]);
  steps.upsertEmbedding.mockResolvedValue(undefined);
  steps.deleteEmbedding.mockResolvedValue(undefined);
});

describe("workflowEmbedNode", () => {
  it("reads authoritative search text and stores its embedding", async () => {
    steps.getNodeSearchText.mockResolvedValue("Quarterly roadmap");

    await workflowEmbedNode("node-1");

    expect(steps.embedText).toHaveBeenCalledWith("Quarterly roadmap");
    expect(steps.upsertEmbedding).toHaveBeenCalledWith({
      nodeId: "node-1",
      content: "Quarterly roadmap",
      embedding: [0.1, 0.2],
    });
    expect(steps.deleteEmbedding).not.toHaveBeenCalled();
  });

  it("deletes a stale embedding when the node has no searchable text", async () => {
    steps.getNodeSearchText.mockResolvedValue(null);

    await workflowEmbedNode("node-1");

    expect(steps.deleteEmbedding).toHaveBeenCalledWith("node-1");
    expect(steps.embedText).not.toHaveBeenCalled();
    expect(steps.upsertEmbedding).not.toHaveBeenCalled();
  });
});
