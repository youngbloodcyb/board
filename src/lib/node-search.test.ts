import { describe, expect, it } from "vitest";
import { nodeSearchText } from "./node-search";

describe("nodeSearchText", () => {
  it("normalizes stored PDF markdown", () => {
    expect(
      nodeSearchText({
        kind: "pdf",
        name: "report.pdf",
        markdown: "  # Quarterly report  ",
      }),
    ).toBe("report.pdf # Quarterly report");
  });

  it("falls back to the PDF name without extracted markdown", () => {
    expect(
      nodeSearchText({
        kind: "pdf",
        url: "https://example.com/report.pdf",
        name: "report.pdf",
      }),
    ).toBe("report.pdf");
  });

  it("indexes image alt text", () => {
    expect(nodeSearchText({ kind: "image", alt: "Whiteboard sketch" })).toBe(
      "Whiteboard sketch",
    );
  });

  it("strips editor HTML and normalizes whitespace", () => {
    expect(
      nodeSearchText({
        kind: "text",
        text: "<p>Project <strong>Oat</strong></p>\n<p>Roadmap</p>",
      }),
    ).toBe("Project Oat Roadmap");
  });
});
