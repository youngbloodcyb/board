import { describe, expect, it } from "vitest";
import { embeddableText } from "./utils";

describe("embeddableText", () => {
  it("returns stored PDF markdown", () => {
    expect(
      embeddableText({
        kind: "pdf",
        name: "report.pdf",
        markdown: "  # Quarterly report  ",
      }),
    ).toBe("# Quarterly report");
  });

  it("returns null for PDFs without extracted markdown", () => {
    expect(
      embeddableText({
        kind: "pdf",
        url: "https://example.com/report.pdf",
        name: "report.pdf",
      }),
    ).toBeNull();
  });
});
