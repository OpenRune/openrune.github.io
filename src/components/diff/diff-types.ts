import type { GamevalType } from "@/context/gameval-context";

export type DiffMode = "combined" | "diff";

/** Per-type gameval URLs (`gamevals_items`, …) kept for backward-compatible links. */
export type GamevalsFullSection = `gamevals_${GamevalType}`;

export type Section =
  | "sprites"
  | "textures"
  /** Combined gameval dump explorer (`?section=gamevals`). */
  | "gamevals"
  | GamevalsFullSection
  | (string & {});

export type ConfigFilterMode = "all" | "added" | "changed" | "removed";

export type SearchTag = {
  value: string;
  exact: boolean;
};

/** Unified diff search field modes (dropdown shows a subset via `modeOptions` on the field). */
export type DiffSearchFieldMode = "gameval" | "id" | "name" | "regex";

export const DIFF_SEARCH_FIELD_MODE_LABELS: Record<DiffSearchFieldMode, string> = {
  gameval: "Gameval",
  id: "ID",
  name: "Name",
  regex: "Regex",
};

export const DIFF_SEARCH_FIELD_MODES_ALL: readonly DiffSearchFieldMode[] = ["gameval", "id", "name", "regex"];

export type ConfigRow = {
  id: number;
  entries: Record<string, string>;
  type: "add" | "change" | "removed" | "context";
};

export type ConfigLine = {
  line: string;
  type: "add" | "change" | "removed" | "context";
  addedInRev?: number;
  changedInRev?: number;
  before?: string;
  /** Optional hover text for the rendered line (e.g. ref metadata for params). */
  hoverText?: string;
  removedInRev?: number;
};

export type SpriteDiffEntry = {
  id: number;
  kind: "added" | "changed" | "removed";
};
