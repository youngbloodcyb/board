import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  embedSearchText: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    execute: mocks.execute,
  },
}));

vi.mock("@/lib/embedding", () => ({
  embedSearchText: mocks.embedSearchText,
}));

import { PgDialect } from "drizzle-orm/pg-core";
import { stepEmbedText, stepUpsertEmbedding } from "./steps";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue({ rows: [] });
  mocks.embedSearchText.mockResolvedValue([0.1, 0.2]);
});

describe("embedding workflow steps", () => {
  it("uses the shared Gemini embedding function", async () => {
    await expect(stepEmbedText("Quarterly roadmap")).resolves.toEqual([
      0.1, 0.2,
    ]);
    expect(mocks.embedSearchText).toHaveBeenCalledWith("Quarterly roadmap");
  });

  it("only stores an embedding while its source content is still current", async () => {
    await stepUpsertEmbedding({
      nodeId: "node-1",
      content: "Quarterly roadmap",
      embedding: [0.1, 0.2],
    });

    const statement = mocks.execute.mock.calls[0][0];
    const compiled = new PgDialect().sqlToQuery(statement);
    expect(compiled.sql).toContain('INSERT INTO "embeddings" (');
    expect(compiled.sql).toContain('"nodes"."search_text" =');
    expect(compiled.sql).toContain('ON CONFLICT ("node_id")');
    expect(compiled.params).toContain("node-1");
    expect(compiled.params).toContain("Quarterly roadmap");
    expect(compiled.params).toContain("[0.1,0.2]");
  });
});
