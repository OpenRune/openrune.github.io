import type { ConfigLine } from "@/components/diff/diff-types";

export type ConfigSectionBlock = {
  kind: "section";
  type: "add" | "removed";
  start: number;
  end: number;
  /** Revision hint for tooltips; null when the API did not send one. */
  rev: number | null;
};

/** Group config lines into add/remove section blocks (each `// id` header may carry rev metadata). */
export function getConfigBlocks(lines: ConfigLine[]): ConfigSectionBlock[] {
  const blocks: ConfigSectionBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    if (row.line.startsWith("// ")) {
      const start = i;
      const sectionType = row.type;
      i++;
      while (i < lines.length && !lines[i].line.startsWith("// ")) i++;
      const end = i;
      const body = lines.slice(start + 1, end);
      const nonempty = body.filter((l) => l.line.trim().length > 0);
      const allAdd = nonempty.length > 0 && nonempty.every((l) => l.type === "add");
      const allRemoved = nonempty.length > 0 && nonempty.every((l) => l.type === "removed");

      let blockType: "add" | "removed" | null = null;
      if (sectionType === "add") blockType = "add";
      else if (sectionType === "removed") blockType = "removed";
      else if (sectionType === "context") {
        if (allAdd) blockType = "add";
        else if (allRemoved) blockType = "removed";
      }

      if (blockType === "add") {
        const rev =
          row.addedInRev ??
          nonempty.find((l) => typeof l.addedInRev === "number" && Number.isFinite(l.addedInRev))?.addedInRev ??
          null;
        blocks.push({ kind: "section", type: "add", start, end, rev });
      } else if (blockType === "removed") {
        const rev =
          row.removedInRev ??
          nonempty.find((l) => typeof l.removedInRev === "number" && Number.isFinite(l.removedInRev))?.removedInRev ??
          null;
        blocks.push({ kind: "section", type: "removed", start, end, rev });
      }
    } else {
      i++;
    }
  }
  return blocks;
}

export function trimBlockEndExclusive(lines: ConfigLine[], block: ConfigSectionBlock): number {
  let end = block.end;
  while (end > block.start && lines[end - 1]?.line === "") end--;
  return end;
}
