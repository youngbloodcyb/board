"use client";

import {
  ArrowClockwiseIcon,
  SpinnerIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import type { PendingNode as PendingNodeType } from "@/lib/store";

function Preview({ data }: { data: PendingNodeType["data"] }) {
  const preview = data.preview;

  switch (preview.kind) {
    case "image":
      return (
        // biome-ignore lint/performance/noImgElement: blob URLs cannot use the Next image optimizer
        <img
          src={preview.src}
          alt={preview.alt}
          className="h-full w-full object-cover"
          draggable={false}
        />
      );
    case "pdf":
      return (
        <div className="flex h-full flex-col">
          <div className="truncate border-b bg-muted px-3 py-2 text-xs font-medium">
            {preview.name}
          </div>
          <embed
            src={preview.src}
            type="application/pdf"
            className="nodrag flex-1 bg-white"
          />
        </div>
      );
    case "link": {
      let host = preview.url;
      try {
        host = new URL(preview.url).hostname.replace(/^www\./, "");
      } catch {}
      return (
        <div className="flex h-full flex-col justify-end gap-1 p-3">
          <div className="truncate text-sm font-medium">{host}</div>
          <div className="line-clamp-2 break-all text-xs text-muted-foreground">
            {preview.url}
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div className="h-full overflow-hidden whitespace-pre-wrap p-3 text-sm">
          {preview.text}
        </div>
      );
  }
}

export function PendingNode({ data }: NodeProps<PendingNodeType>) {
  const failed = data.phase === "failed";
  const percentage = Math.round(data.progress ?? 0);
  const status =
    data.phase === "uploading"
      ? `Uploading${data.progress === undefined ? "" : ` ${percentage}%`}`
      : "Saving…";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-dashed bg-card text-card-foreground opacity-90 shadow-sm">
      <Preview data={data} />

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center backdrop-blur-sm">
          <WarningCircleIcon className="size-6 text-destructive" />
          <div className="min-w-0">
            <div className="text-sm font-medium">
              Couldn&rsquo;t add this node
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {data.error}
            </div>
          </div>
          <div className="nodrag flex gap-2">
            {data.onRetry && (
              <Button type="button" size="sm" onClick={data.onRetry}>
                <ArrowClockwiseIcon />
                Retry
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={data.onRemove}
            >
              <TrashIcon />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="absolute inset-x-0 bottom-0 bg-card/90 px-3 py-2 backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <SpinnerIcon className="size-3.5 animate-spin" />
            {status}
          </div>
          {data.phase === "uploading" && data.progress !== undefined && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-150"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
