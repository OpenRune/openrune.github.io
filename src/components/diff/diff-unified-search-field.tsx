"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  GamevalSearchSuggestionList,
  useGamevalSearchSuggestions,
  type GamevalSearchAutocompleteConfig,
} from "./gameval-search-suggestion-list";
import { isGamevalSuggestPanelOpen, looksLikeSpriteIdQueryText, sanitizeSpriteIdSearchInput } from "./diff-id-search";
import { DIFF_SEARCH_MODE_PLACEHOLDERS } from "./diff-search-modes";
import type { DiffSearchFieldMode, SearchTag } from "./diff-types";
import { DiffSearchTagRow } from "./diff-search-tag-row";
import { DIFF_SEARCH_FIELD_MODES_ALL, DIFF_SEARCH_FIELD_MODE_LABELS } from "./diff-types";

export type { GamevalSearchAutocompleteConfig };

export type DiffUnifiedSearchFieldProps = {
  mode: DiffSearchFieldMode;
  onModeChange: (mode: DiffSearchFieldMode) => void;
  /** Modes not usable for this search (still listed in the dropdown, grayed out). */
  disabledModes?: readonly DiffSearchFieldMode[];
  /** Native `title` on rows (e.g. why a mode is unavailable). */
  modeOptionTitles?: Partial<Record<DiffSearchFieldMode, string>>;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Modes that use Enter-to-add tag chips (typically `["gameval"]`). */
  tagModes?: readonly DiffSearchFieldMode[];
  tags?: SearchTag[];
  onTagToggle?: (index: number) => void;
  onTagRemove?: (index: number) => void;
  onClearTags?: () => void;
  placeholders?: Partial<Record<DiffSearchFieldMode, string>>;
  className?: string;
  searchAriaLabel?: string;
  /** Sprite-style gameval tag search: show matching enum names while typing in Gameval mode. */
  gamevalAutocomplete?: GamevalSearchAutocompleteConfig | null;
};

export function DiffUnifiedSearchField({
  mode,
  onModeChange,
  disabledModes,
  modeOptionTitles,
  value,
  onChange,
  onKeyDown,
  tagModes = ["gameval"],
  tags = [],
  onTagToggle,
  onTagRemove,
  onClearTags,
  placeholders,
  className,
  searchAriaLabel = "Search",
  gamevalAutocomplete = null,
}: DiffUnifiedSearchFieldProps) {
  const [modeOpen, setModeOpen] = React.useState(false);
  const [openUpward, setOpenUpward] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [gamevalSuggestOpen, setGamevalSuggestOpen] = React.useState(false);
  const [gamevalActiveIndex, setGamevalActiveIndex] = React.useState(0);

  const isModeDisabled = React.useCallback(
    (m: DiffSearchFieldMode) => Boolean(disabledModes?.includes(m)),
    [disabledModes],
  );

  const gamevalSuggestEligible =
    Boolean(gamevalAutocomplete?.enabled) && mode === "gameval" && !isModeDisabled("gameval");

  const { suggestions: gamevalSuggestions, loaded: gamevalLoaded, loading: gamevalLoading } =
    useGamevalSearchSuggestions(gamevalSuggestEligible ? gamevalAutocomplete : null, value, gamevalSuggestEligible);

  const showGamevalSuggestPanel = isGamevalSuggestPanelOpen({
    enabled: gamevalSuggestEligible,
    open: gamevalSuggestOpen,
    value,
    loading: gamevalLoading,
    suggestionCount: gamevalSuggestions.length,
    loaded: gamevalLoaded,
  });

  React.useEffect(() => {
    setGamevalActiveIndex(0);
  }, [value, gamevalSuggestions.length]);

  React.useEffect(() => {
    if (!gamevalSuggestEligible) setGamevalSuggestOpen(false);
  }, [gamevalSuggestEligible, mode]);

  const labels = React.useMemo(
    () => ({ ...DIFF_SEARCH_MODE_PLACEHOLDERS, ...placeholders }),
    [placeholders],
  );

  const selectedLabel = DIFF_SEARCH_FIELD_MODE_LABELS[mode] ?? mode;
  const placeholder = labels[mode] ?? "";

  const showTagRow = tagModes.includes(mode);
  const showTags = showTagRow && tags.length > 0 && onTagToggle && onTagRemove && onClearTags;

  const selectedIsDisabled = Boolean(disabledModes?.includes(mode));

  React.useEffect(() => {
    if (!DIFF_SEARCH_FIELD_MODES_ALL.includes(mode)) {
      const first = DIFF_SEARCH_FIELD_MODES_ALL.find((m) => !isModeDisabled(m));
      if (first) onModeChange(first);
      return;
    }
    if (isModeDisabled(mode)) {
      const first = DIFF_SEARCH_FIELD_MODES_ALL.find((m) => !isModeDisabled(m));
      if (first) onModeChange(first);
    }
  }, [mode, onModeChange, isModeDisabled]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!rootRef.current || !target || rootRef.current.contains(target)) return;
      setModeOpen(false);
      setGamevalSuggestOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const emitValue = React.useCallback(
    (next: string) => {
      onChange({ target: { value: next } } as React.ChangeEvent<HTMLInputElement>);
    },
    [onChange],
  );

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showGamevalSuggestPanel && gamevalSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setGamevalActiveIndex((i) => (i + 1) % gamevalSuggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setGamevalActiveIndex((i) => (i - 1 + gamevalSuggestions.length) % gamevalSuggestions.length);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setGamevalSuggestOpen(false);
          return;
        }
      }

      onKeyDown?.(e);
    },
    [
      gamevalActiveIndex,
      gamevalSuggestions,
      onKeyDown,
      showGamevalSuggestPanel,
    ],
  );

  React.useLayoutEffect(() => {
    if (!modeOpen || !rootRef.current || !menuRef.current) return;
    const triggerRect = rootRef.current.querySelector("[data-mode-trigger]")?.getBoundingClientRect();
    if (!triggerRect) return;
    const menuHeight = menuRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    setOpenUpward(spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow);
  }, [modeOpen]);

  return (
    <div ref={rootRef} className={cn("relative z-[70] flex w-full flex-col gap-2", className)}>
      <div className="relative">
        <div
          className={cn(
            "relative z-50 flex h-10 w-full min-w-0 flex-nowrap items-stretch rounded-md border border-border bg-muted/25 shadow-sm",
            "dark:bg-muted/20",
          )}
        >
          <label className="flex min-w-0 flex-1 cursor-text items-center gap-2.5 pl-3 pr-1">
            <span className="sr-only">{searchAriaLabel}</span>
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={value}
              onChange={(e) => {
                if (gamevalSuggestEligible) setGamevalSuggestOpen(true);
                let next = e.target.value;
                const idSanitizable =
                  (mode === "id" && !isModeDisabled("id")) ||
                  (mode === "gameval" && looksLikeSpriteIdQueryText(next));
                if (idSanitizable) {
                  next = sanitizeSpriteIdSearchInput(next);
                }
                if (next === e.target.value) {
                  onChange(e);
                } else {
                  onChange({ ...e, target: { ...e.target, value: next } } as React.ChangeEvent<HTMLInputElement>);
                }
              }}
              onFocus={() => {
                if (gamevalSuggestEligible) setGamevalSuggestOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              title={
                showTagRow
                  ? "Enter adds the current text as a tag (any string). Click a suggestion to insert its name."
                  : undefined
              }
              className={cn(
                "min-h-0 min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none",
                "placeholder:text-muted-foreground",
              )}
            />
          </label>

        <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

        <div className="relative shrink-0">
          <button
            type="button"
            data-mode-trigger
            className={cn(
              "flex h-full items-center gap-1.5 border-0 bg-muted/50 px-3.5 text-sm font-medium text-foreground",
              "hover:bg-muted/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              "dark:bg-muted/35 dark:hover:bg-muted/55",
              selectedIsDisabled && "text-muted-foreground opacity-70",
            )}
            aria-haspopup="listbox"
            aria-expanded={modeOpen}
            aria-label={`Search mode, ${selectedLabel}`}
            onClick={() => setModeOpen((o) => !o)}
          >
            <span className="select-none">{selectedLabel}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-70" />
          </button>

          {modeOpen ? (
            <div
              ref={menuRef}
              className={cn(
                "absolute right-0 z-[100] min-w-[10.5rem] rounded-md border border-border bg-popover py-1 shadow-md",
                openUpward ? "bottom-full mb-1" : "top-full mt-1",
              )}
              role="listbox"
            >
              {DIFF_SEARCH_FIELD_MODES_ALL.map((opt) => {
                const disabled = isModeDisabled(opt);
                const title = modeOptionTitles?.[opt];
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={opt === mode}
                    aria-disabled={disabled}
                    disabled={disabled}
                    title={title}
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm",
                      disabled
                        ? "cursor-not-allowed bg-transparent text-muted-foreground opacity-55 hover:bg-transparent"
                        : cn("hover:bg-muted", opt === mode && "bg-muted font-medium text-foreground"),
                    )}
                    onClick={() => {
                      if (disabled) return;
                      onModeChange(opt);
                      setModeOpen(false);
                    }}
                  >
                    {DIFF_SEARCH_FIELD_MODE_LABELS[opt]}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        </div>

        {showGamevalSuggestPanel ? (
          <GamevalSearchSuggestionList
            suggestions={gamevalSuggestions}
            activeIndex={gamevalActiveIndex}
            onHoverIndex={setGamevalActiveIndex}
            onPick={(name) => {
              emitValue(name);
              setGamevalSuggestOpen(false);
            }}
            loading={gamevalLoading && !gamevalLoaded}
            showEmpty={gamevalLoaded && !gamevalLoading && gamevalSuggestions.length === 0}
          />
        ) : null}
      </div>

      {showTags ? (
        <DiffSearchTagRow tags={tags} onTagToggle={onTagToggle!} onTagRemove={onTagRemove!} onClearTags={onClearTags!} />
      ) : null}
    </div>
  );
}
