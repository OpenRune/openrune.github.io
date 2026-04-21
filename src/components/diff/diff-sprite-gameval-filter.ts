import type { GamevalType } from "@/context/gameval-context";

import type { SearchTag } from "./diff-types";

export type GamevalLookupFns = {
  lookupGameval: (type: GamevalType, id: number, rev?: number | "latest") => string | undefined;
  getGamevalExtra: (
    type: GamevalType,
    id: number,
    rev?: number | "latest",
  ) => { searchable: string; text: string; sub: Record<number, string> } | undefined;
};

/** Sprite index gameval: match all search tags against display name + searchable (same as sprite full view). */
export function matchesSpriteGamevalTags(
  spriteType: GamevalType,
  id: number,
  tags: SearchTag[],
  rev: number,
  { lookupGameval, getGamevalExtra }: GamevalLookupFns,
): boolean {
  const name = (lookupGameval(spriteType, id, rev) ?? "").toLowerCase();
  const searchable = (getGamevalExtra(spriteType, id, rev)?.searchable ?? "").toLowerCase();

  return tags.every((tag) => {
    const needle = tag.value.trim().toLowerCase();
    if (!needle) return true;
    if (tag.exact) {
      return searchable === needle || name === needle;
    }
    return searchable.includes(needle) || name.includes(needle);
  });
}

export function spriteMatchesSubstringName(
  spriteType: GamevalType,
  id: number,
  query: string,
  rev: number,
  fns: GamevalLookupFns,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (fns.lookupGameval(spriteType, id, rev) ?? "").toLowerCase();
  const searchable = (fns.getGamevalExtra(spriteType, id, rev)?.searchable ?? "").toLowerCase();
  return name.includes(q) || searchable.includes(q);
}

export function spriteMatchesRegex(
  spriteType: GamevalType,
  id: number,
  pattern: string,
  rev: number,
  fns: GamevalLookupFns,
): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return true;
  let re: RegExp;
  try {
    re = new RegExp(trimmed, "i");
  } catch {
    return false;
  }
  const name = fns.lookupGameval(spriteType, id, rev) ?? "";
  const searchable = fns.getGamevalExtra(spriteType, id, rev)?.searchable ?? "";
  return re.test(String(id)) || re.test(name) || re.test(searchable);
}
