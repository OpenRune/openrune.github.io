"use client";

import * as React from "react";
import { IconCircleDashed, IconTarget, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SearchTag } from "./diff-types";

function SearchTagChip({
  tag,
  onToggle,
  onRemove,
}: {
  tag: SearchTag;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded px-2 py-1 font-mono text-xs select-none",
        tag.exact ? "border border-blue-500/30 bg-blue-600/20 text-white" : "border border-zinc-700 bg-zinc-800 text-white",
      )}
    >
      <button type="button" className="p-0.5" onClick={onToggle}>
        {tag.exact ? <IconTarget size={12} className="text-blue-400" /> : <IconCircleDashed size={12} className="text-white/70" />}
      </button>
      <span>{tag.exact ? `"${tag.value}"` : tag.value}</span>
      <button type="button" className="text-white/70 hover:text-white" onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

export type DiffSearchTagRowProps = {
  tags: SearchTag[];
  onTagToggle: (index: number) => void;
  onTagRemove: (index: number) => void;
  onClearTags: () => void;
};

export function DiffSearchTagRow({ tags, onTagToggle, onTagRemove, onClearTags }: DiffSearchTagRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag, idx) => (
        <SearchTagChip
          key={`${tag.value}-${idx}`}
          tag={tag}
          onToggle={() => onTagToggle(idx)}
          onRemove={() => onTagRemove(idx)}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-6 border-muted-foreground/20 px-2 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive"
        type="button"
        onClick={onClearTags}
      >
        <IconX size={14} className="mr-1" />
        Clear all
      </Button>
    </div>
  );
}
