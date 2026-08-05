import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchNodes: vi.fn(),
}));

vi.mock("@/services/search", () => ({
  searchNodes: mocks.searchNodes,
}));

import { BoardCommandMenu } from "@/components/board-command-menu";
import type { NodeSearchResult } from "@/services/search";

const result: NodeSearchResult = {
  nodeId: "node-1",
  boardId: "board-a",
  boardName: "Product",
  type: "text",
  title: "Q4 roadmap",
  excerpt: "Launch milestones and owner notes",
  position: { x: 10, y: 20 },
  score: 0.02,
  matchedBy: { keyword: false, semantic: true },
};

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchNodes.mockResolvedValue([result]);
});

describe("BoardCommandMenu", () => {
  it("keeps semantic results visible and selects them from the keyboard", async () => {
    const onOpenChange = vi.fn();
    const onSelectNode = vi.fn();
    render(
      <BoardCommandMenu
        open
        onOpenChange={onOpenChange}
        onSelectNode={onSelectNode}
      />,
    );

    const input = screen.getByPlaceholderText(
      "Search nodes or type a command...",
    );
    fireEvent.change(input, { target: { value: "strategy" } });

    await waitFor(() => {
      expect(mocks.searchNodes).toHaveBeenCalledWith({
        query: "strategy",
        limit: 20,
      });
      expect(screen.getByText("Q4 roadmap")).toBeTruthy();
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelectNode).toHaveBeenCalledWith(result);
  });

  it("opens from the standard command-menu shortcut", () => {
    const onOpenChange = vi.fn();
    render(
      <BoardCommandMenu
        open={false}
        onOpenChange={onOpenChange}
        onSelectNode={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
