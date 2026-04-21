import { trimBlockEndExclusive, type ConfigSectionBlock } from "@/lib/diff-config-blocks";

import type { ConfigFilterMode, ConfigLine } from "./diff-types";

/** Whether line `i` is inside any add/remove section block (excluding trimmed trailing blanks). */
export function inConfigSectionBlock(blocks: ConfigSectionBlock[], i: number): boolean {
  return blocks.some((b) => i >= b.start && i < b.end);
}

/** `[item_45]`-style title on the line after `// id` (same shape as {@link parseConfigContentToRows}). */
function isBracketSectionTitleLine(lines: ConfigLine[], i: number): boolean {
  if (i <= 0) return false;
  const { line } = lines[i]!;
  if (!line.startsWith("[") || !line.endsWith("]")) return false;
  return lines[i - 1]!.line.startsWith("// ");
}

function sectionHasVisibleBodyFrom(
  lines: ConfigLine[],
  scanFrom: number,
  filterMode: ConfigFilterMode,
  blocks: ConfigSectionBlock[],
): boolean {
  let j = scanFrom;
  while (j < lines.length && !lines[j]!.line.startsWith("// ")) {
    if (passesConfigDiffLineBodyFilter(j, lines, filterMode, blocks)) return true;
    j++;
  }
  return false;
}

/**
 * Whether line `i` matches the filter **ignoring** section-header visibility rules.
 * `// …` lines and the optional `[…]` title line right below never pass here (visibility follows the section body).
 */
function passesConfigDiffLineBodyFilter(
  i: number,
  lines: ConfigLine[],
  filterMode: ConfigFilterMode,
  blocks: ConfigSectionBlock[],
): boolean {
  if (filterMode === "all") return true;
  const row = lines[i]!;
  if (row.line.startsWith("// ")) return false;
  if (isBracketSectionTitleLine(lines, i)) return false;
  if (filterMode === "changed") return row.type === "change";
  const want: ConfigLine["type"] = filterMode === "added" ? "add" : "removed";
  if (want === "add") {
    const block = blocks.find((b) => b.type === "add" && i >= b.start && i < b.end);
    if (block) return i < trimBlockEndExclusive(lines, block);
    return row.type === "add";
  }
  const block = blocks.find((b) => b.type === "removed" && i >= b.start && i < b.end);
  if (block) return i < trimBlockEndExclusive(lines, block);
  return row.type === "removed";
}

/**
 * Line visibility for config diff text (matches {@link DiffConfigDiffText} / sprites “All / Added / …” filter).
 * For added / changed / removed, the entry header (`// …` plus optional `[item_45]` on the next line) stays visible
 * when at least one later line in that section (until the next `// …`) matches the filter.
 */
export function passesConfigDiffLineFilter(
  i: number,
  lines: ConfigLine[],
  filterMode: ConfigFilterMode,
  blocks: ConfigSectionBlock[],
): boolean {
  if (filterMode === "all") return true;
  const row = lines[i]!;
  if (row.line.startsWith("// ")) return sectionHasVisibleBodyFrom(lines, i + 1, filterMode, blocks);
  if (isBracketSectionTitleLine(lines, i)) return sectionHasVisibleBodyFrom(lines, i + 1, filterMode, blocks);
  return passesConfigDiffLineBodyFilter(i, lines, filterMode, blocks);
}
