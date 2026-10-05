/**
 * Turn a natural-language description into a simple dump-style query.
 * Describe is only a front-end for Query — Create search / AI fills the query box.
 */

const FILLER_PREFIX =
  /^(all|any|every|find|show|list|get|search\s+for|look\s+for|looking\s+for)\s+/i;

/** Known API / dump aliases → cache config type ids. */
function resolveFromType(raw: string | undefined, fallback = "items"): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s || s === "config" || s === "configs" || s === "all" || s === "files") return fallback;
  if (s === "obj" || s === "object" || s === "objects" || s === "item" || s === "items") return "items";
  if (s === "npc" || s === "npcs") return "npcs";
  if (s === "loc" || s === "locs" || s === "location" || s === "locations") return "objects";
  if (s === "if" || s === "interface" || s === "interfaces") return "interfaces";
  if (s === "inv" || s === "inventory" || s === "inventories") return "inv";
  if (s === "sprites" || s === "textures" || s === "gamevals") return "items";
  // Keep known singular section ids (spotanim, mapelement, healthbar, …) as-is — do not invent plurals.
  return s;
}

function quoteIfNeeded(value: string): string {
  const v = value.trim();
  if (!v) return '""';
  if (/^[\w.-]+$/.test(v)) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

function detectFromFromPhrase(lower: string, scopeHint?: string): string {
  if (/\bnpcs?\b/.test(lower)) return "npcs";
  if (/\b(interfaces?|if)\b/.test(lower)) return "interfaces";
  if (/\b(locations?|locs?)\b/.test(lower) && !/\bobjects?\b/.test(lower)) return "objects";
  if (/\b(items?|objects?|obj)\b/.test(lower)) return "items";
  if (/\b(inventor(?:y|ies)|inv)\b/.test(lower)) return "inv";
  // Free-form item-ish names ("dragon longsword") default to items, not the current nav section.
  return resolveFromType(scopeHint, "items");
}

function stripTypeWords(needle: string): string {
  return needle
    .replace(/\b(npcs?|items?|objects?|obj|locs?|locations?|interfaces?|inventor(?:y|ies))\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort NL → `FROM … WHERE …`.
 * Phrases like "all dragon longsword" → `FROM items WHERE name CONTAINS "dragon longsword"`.
 */
export function describeToQuery(description: string, scopeHint?: string): string {
  const raw = description.trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const lower = raw.toLowerCase();

  const nameContaining =
    lower.match(/\bnames?\s+containing\s+(.+)$/i) ??
    lower.match(/\bwith\s+name\s+(.+)$/i);
  if (nameContaining?.[1]) {
    const needle = nameContaining[1].replace(/^["']|["']$/g, "").trim();
    if (needle) {
      const from = detectFromFromPhrase(lower, scopeHint);
      return `FROM ${from} WHERE name CONTAINS ${quoteIfNeeded(needle)}`;
    }
  }

  // "gameval contains rune" / "name containing dragon" / "cost contains 100"
  const fieldContains =
    lower.match(/\b([a-z_][\w]*)\s+contains?\s+(.+)$/i) ??
    lower.match(/\b([a-z_][\w]*)\s+containing\s+(.+)$/i);
  if (fieldContains?.[1] && fieldContains[2]) {
    let field = fieldContains[1].toLowerCase();
    if (field === "names") field = "name";
    if (field === "gamevals") field = "gameval";
    if (field === "headers" || field === "header") field = "_header";
    const needle = fieldContains[2].replace(/^["']|["']$/g, "").trim();
    if (needle && /^[\w]+$/.test(field.replace(/^_/, ""))) {
      const from = detectFromFromPhrase(lower, scopeHint);
      return `FROM ${from} WHERE ${field} CONTAINS ${quoteIfNeeded(needle)}`;
    }
  }

  if (/\btradeable\b/.test(lower)) {
    const from = detectFromFromPhrase(lower, scopeHint);
    if (/\b(not|non[- ]?|un)tradeable\b/.test(lower) || /\bnon.?tradeable\b/.test(lower)) {
      return `FROM ${from} WHERE tradeable = no`;
    }
    if (/\bexpensive\b/.test(lower)) {
      return `FROM ${from} WHERE tradeable = yes AND cost > 10000`;
    }
    return `FROM ${from} WHERE tradeable = yes`;
  }

  if (/\b(colour|color)\b/.test(lower)) {
    const from = /\binterface|if\b/.test(lower) ? "interfaces" : resolveFromType(scopeHint, "interfaces");
    return `FROM ${from} WHERE colour EXISTS`;
  }

  if (/\bmembers\b/.test(lower)) {
    const from = detectFromFromPhrase(lower, scopeHint);
    return `FROM ${from} WHERE members = yes`;
  }

  // Bracket title / id-style find from inspector jump
  if (/^\[[\w]+_\d+]$/.test(raw) || /^[\w]+_\d+$/.test(raw)) {
    const from = resolveFromType(scopeHint, "items");
    return `FROM ${from} WHERE text CONTAINS ${quoteIfNeeded(raw)}`;
  }

  // "all dragon longsword" / "find rune scimitar" → name search on items (or detected type)
  const withoutFiller = raw.replace(FILLER_PREFIX, "").trim();
  const withoutFillerLower = withoutFiller.toLowerCase();
  const from = detectFromFromPhrase(withoutFillerLower, scopeHint);
  const needle = stripTypeWords(withoutFiller) || withoutFiller;
  if (needle) {
    return `FROM ${from} WHERE name CONTAINS ${quoteIfNeeded(needle)}`;
  }

  return `FROM ${resolveFromType(scopeHint, "items")} WHERE text CONTAINS ${quoteIfNeeded(raw)}`;
}

export const DESCRIBE_SEARCH_EXAMPLES = [
  "gameval contains rune",
  "NPC names containing dragon",
  "Expensive tradeable objects",
] as const;
