/**
 * Match a dump-style query (or plain text) against a single config text line.
 */

function unquote(raw: string): string {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function normalizeBoolToken(raw: string): string {
  const v = unquote(raw).trim().toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return "true";
  if (v === "no" || v === "false" || v === "0") return "false";
  return v;
}

type Condition =
  | { kind: "eq"; field: string; value: string }
  | { kind: "contains"; field: string; value: string }
  | { kind: "gt"; field: string; value: number }
  | { kind: "lt"; field: string; value: number }
  | { kind: "exists"; field: string };

function parseConditions(whereClause: string): Condition[] {
  const parts = whereClause.split(/\s+AND\s+/i).map((p) => p.trim()).filter(Boolean);
  const out: Condition[] = [];
  for (const part of parts) {
    const contains = part.match(/^(\w+)\s+CONTAINS\s+(.+)$/i);
    if (contains) {
      out.push({ kind: "contains", field: contains[1]!.toLowerCase(), value: unquote(contains[2]!) });
      continue;
    }
    const exists = part.match(/^(\w+)\s+EXISTS$/i);
    if (exists) {
      out.push({ kind: "exists", field: exists[1]!.toLowerCase() });
      continue;
    }
    const gt = part.match(/^(\w+)\s*>\s*(-?\d+(?:\.\d+)?)$/i);
    if (gt) {
      out.push({ kind: "gt", field: gt[1]!.toLowerCase(), value: Number(gt[2]) });
      continue;
    }
    const lt = part.match(/^(\w+)\s*<\s*(-?\d+(?:\.\d+)?)$/i);
    if (lt) {
      out.push({ kind: "lt", field: lt[1]!.toLowerCase(), value: Number(lt[2]) });
      continue;
    }
    const eq = part.match(/^(\w+)\s*=\s*(.+)$/i);
    if (eq) {
      out.push({ kind: "eq", field: eq[1]!.toLowerCase(), value: unquote(eq[2]!) });
    }
  }
  return out;
}

function lineFieldValue(line: string, field: string): string | null {
  const re = new RegExp(`(?:^|\\s)${field}\\s*=\\s*(.*)$`, "i");
  const m = line.match(re);
  if (!m) return null;
  return m[1]!.trim();
}

function conditionMatchesLine(line: string, cond: Condition): boolean {
  const lowerLine = line.toLowerCase();
  if (cond.kind === "contains" && cond.field === "text") {
    return lowerLine.includes(cond.value.toLowerCase());
  }
  if (cond.kind === "exists") {
    return new RegExp(`(?:^|\\s)${cond.field}\\s*=`, "i").test(line) || lowerLine.includes(cond.field);
  }
  const raw = lineFieldValue(line, cond.field);
  if (raw == null) {
    // soft fallback: substring on the whole line for name-like contains
    if (cond.kind === "contains") return lowerLine.includes(cond.value.toLowerCase());
    return false;
  }
  if (cond.kind === "eq") {
    const want = normalizeBoolToken(cond.value);
    const got = normalizeBoolToken(raw);
    return got === want || raw.toLowerCase() === cond.value.toLowerCase();
  }
  if (cond.kind === "contains") {
    return raw.toLowerCase().includes(cond.value.toLowerCase());
  }
  const num = Number(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num)) return false;
  if (cond.kind === "gt") return num > cond.value;
  if (cond.kind === "lt") return num < cond.value;
  return false;
}

/** Returns highlight needles useful for marking matched text in a line. */
export function queryHighlightNeedles(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const whereIdx = q.search(/\bWHERE\b/i);
  if (whereIdx === -1) return [q];
  const whereClause = q.slice(whereIdx + "WHERE".length).trim();
  const needles: string[] = [];
  for (const cond of parseConditions(whereClause)) {
    if (cond.kind === "eq" || cond.kind === "contains") needles.push(cond.value);
    if (cond.kind === "exists") needles.push(cond.field);
    if (cond.kind === "eq") needles.push(`${cond.field}=`);
  }
  return needles.filter(Boolean);
}

/**
 * True when `line` satisfies the query.
 * Plain text (no WHERE) → case-insensitive substring.
 */
export function lineMatchesTextQuery(line: string, query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  const whereIdx = q.search(/\bWHERE\b/i);
  if (whereIdx === -1) {
    return line.toLowerCase().includes(q.toLowerCase());
  }
  const whereClause = q.slice(whereIdx + "WHERE".length).trim();
  const conditions = parseConditions(whereClause);
  if (conditions.length === 0) {
    return line.toLowerCase().includes(q.toLowerCase());
  }
  // A line matches if it satisfies any field condition that applies to it,
  // or if it's a block header and we only have text CONTAINS.
  return conditions.some((cond) => conditionMatchesLine(line, cond));
}
