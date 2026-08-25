"use client";

import * as React from "react";

import type { DiffDecodeProgress } from "@/lib/diff-decode";

type DiffDecodeProgressBannerProps = {
  progress: DiffDecodeProgress | null;
  /** Fallback copy when progress payload is thin. */
  fallbackMessage?: string;
  className?: string;
};

export function DiffDecodeProgressBanner({
  progress,
  fallbackMessage = "Decoding diff binaries on the cache server…",
  className,
}: DiffDecodeProgressBannerProps) {
  if (!progress || progress.status === "ready") return null;

  const pct = Math.min(100, Math.max(0, progress.progress));
  const pending = progress.revisions.filter((r) => r.status !== "ready" && r.status !== "missing");
  const pendingLabel =
    pending.length === 0
      ? null
      : pending.length <= 4
        ? pending.map((r) => `rev ${r.revision}`).join(", ")
        : `${pending
            .slice(0, 3)
            .map((r) => `rev ${r.revision}`)
            .join(", ")} +${pending.length - 3} more`;

  return (
    <div
      className={
        className ??
        "mx-auto w-full max-w-xl rounded-md border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-medium text-foreground">{progress.message || fallbackMessage}</p>
        <span className="shrink-0 tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pendingLabel ? <p className="mt-2 text-xs">Waiting on {pendingLabel}</p> : null}
      {progress.details ? <p className="mt-1 text-xs opacity-80">{progress.details}</p> : null}
    </div>
  );
}
