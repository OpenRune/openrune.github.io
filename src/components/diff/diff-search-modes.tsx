"use client";

import * as React from "react";
import { IconCircleDashed, IconTarget } from "@tabler/icons-react";

import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { DiffSearchFieldMode } from "./diff-types";

export interface SearchModeConfig {
  value: string;
  label: string;
  placeholder: string;
  help: React.ReactNode;
}

const gameval: SearchModeConfig = {
  value: "gameval",
  label: "Gameval",
  placeholder: "Paste or type values (comma, space, or newline separated)",
  help: (
    <div className="space-y-2 text-sm text-white">
      <div className="text-base font-semibold text-white">Gameval Search Mode</div>
      <div className="space-y-1.5">
        <p className="text-white/90">Search by gameval values with tag-based filtering.</p>
        <div>
          <p className="mb-1 font-medium text-white">How to use:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/90">
            <li>
              Type any gameval string (not limited to suggestions) and press{" "}
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-white">
                Enter
              </kbd>{" "}
              to add it as a tag; click a suggestion to insert its name
            </li>
            <li>Each tag is a separate search value</li>
            <li>Click the tag icon to toggle between exact and fuzzy match</li>
            <li>If no tags exist, your input is used for live search</li>
            <li>
              Use <b className="text-white">Clear All</b> to remove all tags
            </li>
          </ul>
        </div>
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1.5 text-xs font-medium text-white">Tag States:</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-600/20 px-2 py-1 text-white">
                <IconTarget size={12} className="text-blue-400" />
                <span className="font-mono">{'"TREE"'}</span>
              </span>
              <span className="text-white/90">Exact match</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-white">
                <IconCircleDashed size={12} className="text-white/70" />
                <span className="font-mono">TREE</span>
              </span>
              <span className="text-white/90">Fuzzy match</span>
            </div>
          </div>
        </div>
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1 text-xs font-medium text-white">Examples:</p>
          <div className="space-y-1 text-xs">
            <div className="rounded bg-zinc-800 px-2 py-1 font-mono text-white">TREE</div>
            <div className="rounded bg-zinc-800 px-2 py-1 font-mono text-white">TREE, ROCK, STONE</div>
            <div className="rounded bg-zinc-800 px-2 py-1 font-mono text-white">{`"EXACT VALUE"`}</div>
          </div>
        </div>
      </div>
    </div>
  ),
};

const id: SearchModeConfig = {
  value: "id",
  label: "ID",
  placeholder: 'ID search (e.g. "10 + 100" supported)',
  help: (
    <div className="space-y-2 text-sm text-white">
      <div className="text-base font-semibold text-white">ID Search Mode</div>
      <div className="space-y-1.5">
        <p className="text-white/90">Search by numeric ID values.</p>
        <div>
          <p className="mb-1 font-medium text-white">Features:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/90">
            <li>
              Enter single IDs:{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-white">10</code>
            </li>
            <li>
              Multiple IDs with addition:{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-white">10 + 100</code>
            </li>
            <li>
              Ranges using plus:{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-white">50 + 60 + 70</code>
            </li>
          </ul>
        </div>
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1 text-xs font-medium text-white">Examples:</p>
          <div className="space-y-1 font-mono text-xs">
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">10</div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">10 + 100</div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">5 + 10 + 15</div>
          </div>
        </div>
      </div>
    </div>
  ),
};

const name: SearchModeConfig = {
  value: "name",
  label: "Name",
  placeholder: "Search by name (partial matches)",
  help: (
    <div className="space-y-2 text-sm text-white">
      <div className="text-base font-semibold text-white">Name Search Mode</div>
      <div className="space-y-1.5">
        <p className="text-white/90">Search by name with partial matching support.</p>
        <div>
          <p className="mb-1 font-medium text-white">Features:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/90">
            <li>Partial matching (substring search)</li>
            <li>Case-insensitive by default</li>
            <li>Finds names containing your search term</li>
          </ul>
        </div>
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1 text-xs font-medium text-white">Examples:</p>
          <div className="space-y-1 text-xs">
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">tree</div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">oak tree</div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">sword</div>
          </div>
          <p className="mt-1 text-xs italic text-white/70">Matches any name containing the search term</p>
        </div>
      </div>
    </div>
  ),
};

const regex: SearchModeConfig = {
  value: "regex",
  label: "Regex",
  placeholder: 'Enter regex pattern (e.g. "^tree.*")',
  help: (
    <div className="space-y-2 text-sm text-white">
      <div className="text-base font-semibold text-white">Regex Search Mode</div>
      <div className="space-y-1.5">
        <p className="text-white/90">Search using regular expressions for advanced pattern matching.</p>
        <div>
          <p className="mb-1 font-medium text-white">Features:</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/90">
            <li>Full regex pattern support</li>
            <li>Case-sensitive matching</li>
            <li>Use anchors, quantifiers, and groups</li>
          </ul>
        </div>
        <div className="mt-2 border-t border-zinc-700 pt-2">
          <p className="mb-1 text-xs font-medium text-white">Examples:</p>
          <div className="space-y-1 font-mono text-xs">
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">
              <span className="text-blue-300">^tree</span> - Starts with "tree"
            </div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">
              <span className="text-blue-300">.*rock$</span> - Ends with "rock"
            </div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">
              <span className="text-blue-300">(tree|rock)</span> - Matches "tree" or "rock"
            </div>
            <div className="rounded bg-zinc-800 px-2 py-1 text-white">
              <span className="text-blue-300">{"^[A-Z]{4}"}</span> - Exactly 4 uppercase letters
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

/** Same shape as openrune.github.io `searchModes` record. */
export const diffSearchModesRecord = {
  gameval,
  id,
  name,
  regex,
} as const;

/** Solid dark panel for diff search-mode tooltips (use with `<TooltipContent opaque />`). */
export const DIFF_TABLE_SEARCH_TOOLTIP_CONTENT_CLASS =
  "!bg-zinc-950 !text-white border border-zinc-800 p-3 whitespace-pre-line";

export function diffSearchModeTooltipHelp(mode: DiffSearchFieldMode): React.ReactNode {
  return diffSearchModesRecord[mode].help;
}

export function diffSearchModePlaceholder(mode: DiffSearchFieldMode): string {
  return diffSearchModesRecord[mode].placeholder;
}

export const DIFF_SEARCH_MODE_PLACEHOLDERS: Record<DiffSearchFieldMode, string> = {
  gameval: gameval.placeholder,
  id: id.placeholder,
  name: name.placeholder,
  regex: regex.placeholder,
};

/** Same as openrune.github.io `SEARCH_MODES` array order (gameval, id, name, regex). */
export const DIFF_SEARCH_MODES_ORDERED = [gameval, id, name, regex] as const;

/**
 * First enabled search mode in archive table order, preferring **gameval** when the table
 * has a gameval column (mode not disabled) and revision supports gamevals.
 */
export function pickDefaultArchiveTableSearchMode(
  combinedRev: number,
  disabledModes: readonly DiffSearchFieldMode[] | undefined,
): DiffSearchFieldMode {
  const disabled = disabledModes ?? [];
  const order: DiffSearchFieldMode[] = ["gameval", "id", "name", "regex"];
  for (const m of order) {
    if (disabled.includes(m)) continue;
    if (m === "gameval" && combinedRev < GAMEVAL_MIN_REVISION) continue;
    return m;
  }
  return "id";
}
