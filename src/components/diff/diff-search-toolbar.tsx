"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

import {
  GamevalSearchSuggestionList,
  useGamevalSearchSuggestions,
  type GamevalSearchAutocompleteConfig,
} from "./gameval-search-suggestion-list";
import { isGamevalSuggestPanelOpen, sanitizeSpriteIdSearchInput } from "./diff-id-search";
import type { SearchTag } from "./diff-types";
import { DiffSearchTagRow } from "./diff-search-tag-row";

export type { GamevalSearchAutocompleteConfig };

type DiffSearchToolbarProps = {
  /** e.g. `OptionDropdown` for ID / Gameval, or diff filter — omit for search-only rows */
  leading?: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Focus target for global shortcuts (e.g. Ctrl+F in diff config text). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Multi-value gameval-style tags (same chips as sprites) */
  tags?: SearchTag[];
  onTagToggle?: (index: number) => void;
  onTagRemove?: (index: number) => void;
  onClearTags?: () => void;
  /** When true, show the tag chip row (typically `mode === "gameval" && tags.length > 0`) */
  showTagRow?: boolean;
  /** Config table gameval tag search: suggest enum names from this gameval type/revision. */
  gamevalAutocomplete?: GamevalSearchAutocompleteConfig | null;
  /** When true, strip any character that is not a digit, `+`, or `-` (sprite/config ID search). */
  restrictToSpriteIdChars?: boolean;
};

export function DiffSearchToolbar({
  leading,
  placeholder,
  value,
  onChange,
  onKeyDown,
  inputRef,
  tags = [],
  onTagToggle,
  onTagRemove,
  onClearTags,
  showTagRow = false,
  gamevalAutocomplete = null,
  restrictToSpriteIdChars = false,
}: DiffSearchToolbarProps) {
  const showTags = showTagRow && tags.length > 0 && onTagToggle && onTagRemove && onClearTags;

  const suggestEnabled = Boolean(gamevalAutocomplete?.enabled);
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const suggestRootRef = React.useRef<HTMLDivElement>(null);

  const { suggestions, loaded, loading } = useGamevalSearchSuggestions(
    suggestEnabled ? gamevalAutocomplete : null,
    value,
    suggestEnabled,
  );

  const showSuggestPanel = isGamevalSuggestPanelOpen({
    enabled: suggestEnabled,
    open: suggestOpen,
    value,
    loading,
    suggestionCount: suggestions.length,
    loaded,
  });

  React.useEffect(() => {
    setActiveIndex(0);
  }, [value, suggestions.length]);

  React.useEffect(() => {
    if (!suggestEnabled) setSuggestOpen(false);
  }, [suggestEnabled]);

  React.useEffect(() => {
    if (!suggestEnabled) return;
    const onDoc = (e: MouseEvent) => {
      if (!suggestRootRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [suggestEnabled]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!suggestEnabled) {
        onKeyDown?.(e);
        return;
      }
      if (showSuggestPanel && suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const pick = suggestions[activeIndex];
          if (pick) onChange({ target: { value: pick.name } } as React.ChangeEvent<HTMLInputElement>);
          setSuggestOpen(false);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSuggestOpen(false);
          return;
        }
      }

      onKeyDown?.(e);
    },
    [activeIndex, loaded, onChange, onKeyDown, showSuggestPanel, suggestEnabled, suggestions],
  );

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div ref={suggestRootRef}  className="relative z-[60] w-full max-w-xs flex-none">
          <Input
            ref={inputRef}
            className="w-full"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              if (suggestEnabled) setSuggestOpen(true);
              if (restrictToSpriteIdChars) {
                const next = sanitizeSpriteIdSearchInput(e.target.value);
                if (next === e.target.value) onChange(e);
                else onChange({ ...e, target: { ...e.target, value: next } } as React.ChangeEvent<HTMLInputElement>);
              } else {
                onChange(e);
              }
            }}
            onFocus={() => {
              if (suggestEnabled) setSuggestOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {showSuggestPanel ? (
            <GamevalSearchSuggestionList
              suggestions={suggestions}
              activeIndex={activeIndex}
              onHoverIndex={setActiveIndex}
              onPick={(name) => {
                onChange({ target: { value: name } } as React.ChangeEvent<HTMLInputElement>);
                setSuggestOpen(false);
              }}
              loading={loading && !loaded}
              showEmpty={loaded && !loading && suggestions.length === 0}
            />
          ) : null}
        </div>
      </div>
      {showTags ? (
        <DiffSearchTagRow tags={tags} onTagToggle={onTagToggle!} onTagRemove={onTagRemove!} onClearTags={onClearTags!} />
      ) : null}
    </div>
  );
}
