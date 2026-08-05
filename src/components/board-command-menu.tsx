"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  FilePdfIcon,
  ImageIcon,
  LinkIcon,
  SpinnerGapIcon,
  TextTIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { NodeType } from "@/db/schema";
import { type NodeSearchResult, searchNodes } from "@/services/search";

const nodeIcons: Record<NodeType, Icon> = {
  link: LinkIcon,
  text: TextTIcon,
  image: ImageIcon,
  pdf: FilePdfIcon,
};

export type BoardCommandAction = {
  id: string;
  label: string;
  keywords?: string[];
  icon?: Icon;
  shortcut?: string;
  onSelect: () => void;
};

type BoardCommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (result: NodeSearchResult) => void;
  actions?: BoardCommandAction[];
};

export function BoardCommandMenu({
  open,
  onOpenChange,
  onSelectNode,
  actions = [],
}: BoardCommandMenuProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setQuery("");
    setResults([]);
    setLoading(false);
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }
      event.preventDefault();
      if (open) close();
      else onOpenChange(true);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, onOpenChange, open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || !normalizedQuery) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = window.setTimeout(() => {
      searchNodes({ query: normalizedQuery, limit: 20 })
        .then((nextResults) => {
          if (!cancelled) setResults(nextResults);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setError("Node search is unavailable. Please try again.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const visibleActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return actions;
    return actions.filter((action) =>
      [action.label, ...(action.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [actions, query]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
    }
  };

  const hasQuery = query.trim().length > 0;
  const showNodes = hasQuery && !loading && !error && results.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else close();
      }}
      title="Board commands"
      description="Search your nodes or choose a board action."
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          value={query}
          onValueChange={onQueryChange}
          placeholder="Search nodes or type a command..."
        />
        <CommandList>
          {visibleActions.length > 0 && (
            <CommandGroup heading="Actions">
              {visibleActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={`action:${action.id}`}
                    onSelect={() => {
                      close();
                      action.onSelect();
                    }}
                  >
                    {ActionIcon && <ActionIcon />}
                    <span>{action.label}</span>
                    {action.shortcut && (
                      <CommandShortcut>{action.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {visibleActions.length > 0 && showNodes && <CommandSeparator />}

          {!hasQuery && visibleActions.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Start typing to search your nodes.
            </div>
          )}

          {hasQuery && loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <SpinnerGapIcon className="size-3.5 animate-spin" />
              Searching nodes…
            </div>
          )}

          {hasQuery && !loading && error && (
            <div className="py-6 text-center text-xs text-destructive">
              {error}
            </div>
          )}

          {hasQuery && !loading && !error && results.length === 0 && (
            <CommandEmpty>No nodes found.</CommandEmpty>
          )}

          {showNodes && (
            <CommandGroup heading="Nodes">
              {results.map((result) => {
                const NodeIcon = nodeIcons[result.type];
                return (
                  <CommandItem
                    key={result.nodeId}
                    value={`node:${result.nodeId}`}
                    onSelect={() => {
                      close();
                      onSelectNode(result);
                    }}
                    className="items-start py-2"
                  >
                    <NodeIcon className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {result.title}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {result.boardName}
                        {result.excerpt ? ` · ${result.excerpt}` : ""}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
