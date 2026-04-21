import type { ConfigArchiveTableRow } from "./diff-config-archive-types";
import { sectionPrefixForConfigType } from "./diff-constants";
import type { ConfigLine } from "./diff-types";

/** Normalize API line `type` strings to `ConfigLine` union (shared by text view + spotanim prefetch). */
export function normalizeConfigContentLineType(t: string | undefined): ConfigLine["type"] {
  const s = String(t ?? "")
    .trim()
    .toLowerCase();
  if (s === "add" || s === "added" || s === "insert" || s === "new" || s === "+") return "add";
  if (s === "change" || s === "changed" || s === "modify" || s === "modified" || s === "update" || s === "updated")
    return "change";
  if (s === "removed" || s === "remove" || s === "delete" || s === "deleted" || s === "-") return "removed";
  return "context";
}

function stringifyActionRefish(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  const rendered = renderValueWithRef(v);
  return rendered?.display ?? asText(v);
}

function isEntityOpsObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(o, "ops") ||
    Object.prototype.hasOwnProperty.call(o, "subOps") ||
    Object.prototype.hasOwnProperty.call(o, "conditionalOps") ||
    Object.prototype.hasOwnProperty.call(o, "conditionalSubOps")
  );
}

function coerceEntityOpsObject(v: unknown): Record<string, unknown> | null {
  if (isEntityOpsObject(v)) return v as Record<string, unknown>;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(s) as unknown;
    return isEntityOpsObject(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function expandEntityOpsLines(value: unknown): ExpandedFieldLine[] {
  if (!isEntityOpsObject(value)) return [];
  const o = value as Record<string, unknown>;
  const out: ExpandedFieldLine[] = [];

  const ops = o.ops;
  if (ops && typeof ops === "object" && !Array.isArray(ops)) {
    Object.keys(ops)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const text = asText((ops as Record<string, unknown>)[String(idx)]).trim();
        if (!text) return;
        out.push({ line: `op${idx + 1}=${text}` });
      });
  }

  const subOps = o.subOps;
  if (subOps && typeof subOps === "object" && !Array.isArray(subOps)) {
    Object.keys(subOps)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const list = (subOps as Record<string, unknown>)[String(idx)];
        if (!Array.isArray(list)) return;
        list.forEach((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
          const e = entry as Record<string, unknown>;
          const subID = asText(e.subID).trim();
          const text = asText(e.text).trim();
          if (!text) return;
          const suffix = subID ? `,subID=${subID}` : "";
          out.push({ line: `subop${idx + 1}=${text}${suffix}` });
        });
      });
  }

  const conditionalOps = o.conditionalOps;
  if (conditionalOps && typeof conditionalOps === "object" && !Array.isArray(conditionalOps)) {
    Object.keys(conditionalOps)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const list = (conditionalOps as Record<string, unknown>)[String(idx)];
        if (!Array.isArray(list)) return;
        list.forEach((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
          const e = entry as Record<string, unknown>;
          const text = asText(e.text).trim();
          const varpID = stringifyActionRefish(e.varpID ?? e.varp).trim();
          const varbitID = stringifyActionRefish(e.varbitID ?? e.varbit).trim();
          const minValue = asText(e.minValue ?? e.min).trim();
          const maxValue = asText(e.maxValue ?? e.max).trim();
          const parts = [
            text ? `text=${text}` : null,
            varpID ? `varpID=${varpID}` : null,
            varbitID ? `varbitID=${varbitID}` : null,
            minValue ? `minValue=${minValue}` : null,
            maxValue ? `maxValue=${maxValue}` : null,
          ].filter(Boolean);
          if (parts.length === 0) return;
          out.push({ line: `multiop${idx + 1}=${parts.join(",")}` });
        });
      });
  }

  const conditionalSubOps = o.conditionalSubOps;
  if (conditionalSubOps && typeof conditionalSubOps === "object" && !Array.isArray(conditionalSubOps)) {
    Object.keys(conditionalSubOps)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const bySubId = (conditionalSubOps as Record<string, unknown>)[String(idx)];
        if (!bySubId || typeof bySubId !== "object" || Array.isArray(bySubId)) return;
        Object.keys(bySubId)
          .map((k) => Number.parseInt(k, 10))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b)
          .forEach((subID) => {
            const list = (bySubId as Record<string, unknown>)[String(subID)];
            if (!Array.isArray(list)) return;
            list.forEach((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
              const e = entry as Record<string, unknown>;
              const text = asText(e.text).trim();
              const varpID = stringifyActionRefish(e.varpID ?? e.varp).trim();
              const varbitID = stringifyActionRefish(e.varbitID ?? e.varbit).trim();
              const minValue = asText(e.minValue ?? e.min).trim();
              const maxValue = asText(e.maxValue ?? e.max).trim();
              const parts = [
                text ? `text=${text}` : null,
                `subID=${subID}`,
                varpID ? `varpID=${varpID}` : null,
                varbitID ? `varbitID=${varbitID}` : null,
                minValue ? `minValue=${minValue}` : null,
                maxValue ? `maxValue=${maxValue}` : null,
              ].filter(Boolean);
              out.push({ line: `multisubop${idx + 1}=${parts.join(",")}` });
            });
          });
      });
  }

  return out;
}
function pickFromRecord(o: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

function readOptionalFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Some cache servers send numeric line kinds (ordinal); map only small integers when string type is absent. */
function normalizeLineTypeFromNumber(n: number): ConfigLine["type"] | null {
  if (!Number.isInteger(n) || n < 0 || n > 7) return null;
  switch (n) {
    case 0:
      return "context";
    case 1:
      return "add";
    case 2:
      return "removed";
    case 3:
      return "change";
    default:
      return null;
  }
}

function normalizeLineTypeRaw(raw: unknown): ConfigLine["type"] {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const mapped = normalizeLineTypeFromNumber(Math.trunc(raw));
    if (mapped) return mapped;
  }
  return normalizeConfigContentLineType(typeof raw === "string" ? raw : String(raw ?? ""));
}

function buildRefHoverText(group: string, name: string, id?: string, _value?: string): string {
  return [
    group ? `group: ${group}` : null,
    name ? `name: ${name}` : null,
    id ? `id: ${id}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeGamevalDisplay(group: string, name: string, fallback = ""): string {
  const normalizedGroup = group.trim().toLowerCase();
  const normalizedName = name.trim();
  if (!normalizedGroup && !normalizedName) return fallback;
  if (!normalizedName) return normalizedGroup || fallback;
  const prefixed = `${normalizedGroup}.`;
  if (normalizedName.toLowerCase().startsWith(prefixed)) return normalizedName;
  return `${normalizedGroup}.${normalizedName}`;
}

type RefRender = {
  display: string;
  hoverText?: string;
};

function renderValueWithRef(raw: unknown): RefRender | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const refRaw = obj.ref;
  if (!refRaw || typeof refRaw !== "object") return null;

  const ref = refRaw as Record<string, unknown>;
  const group = typeof ref.group === "string" ? ref.group : "";
  const name = typeof ref.name === "string" ? ref.name : "";
  const id = typeof ref.id === "number" || typeof ref.id === "string" ? String(ref.id) : "";
  const value = asText(obj.value).trim();
  const display = normalizeGamevalDisplay(group, name, value);
  if (!display) return null;
  const hover = buildRefHoverText(group, name, id || value, value || id);
  return { display, hoverText: hover || undefined };
}

function inferRawLineHoverText(line: string, before: string | undefined, raw: Record<string, unknown>): string | undefined {
  const direct = pickFromRecord(raw, ["hoverText", "HoverText", "tooltip", "Tooltip"]);
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const refRaw = pickFromRecord(raw, ["ref", "Ref"]);
  if (refRaw && typeof refRaw === "object") {
    const r = refRaw as Record<string, unknown>;
    const group = typeof r.group === "string" ? r.group : "";
    const name = typeof r.name === "string" ? r.name : "";
    const id = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : "";
    const valueRaw = pickFromRecord(raw, ["value", "Value", "rawValue", "RawValue", "originalValue", "OriginalValue"]);
    const value = valueRaw == null ? "" : String(valueRaw);
    const hover = buildRefHoverText(group, name, id || value, value || id);
    return hover || undefined;
  }

  // Fallback for raw lines already rendered as: param=parm_<id>=group.name with numeric previous value.
  const m = /^param=parm_(\d+)=([a-z0-9_]+)\.([^\s]+)$/i.exec(line.trim());
  if (m) {
    const group = m[2] ?? "";
    const name = m[3] ?? "";
    const numericBefore = before?.trim();
    const value = numericBefore && /^-?\d+$/.test(numericBefore) ? numericBefore : "";
    const hover = buildRefHoverText(group, name, value, value);
    return hover || undefined;
  }

  const eq = line.indexOf("=");
  if (eq <= 0) return undefined;
  const rhs = line.slice(eq + 1).trim();
  const g = /^([a-z0-9_]+)\.([^\s]+)$/i.exec(rhs);
  if (!g) return undefined;
  const group = g[1] ?? "";
  const name = g[2] ?? "";
  const rawBefore = before?.trim();
  const beforeValue = rawBefore?.includes("=") ? rawBefore.split("=").pop()?.trim() : rawBefore;
  const value = beforeValue && /^-?\d+$/.test(beforeValue) ? beforeValue : "";
  const hover = buildRefHoverText(group, name, value, value);
  return hover || undefined;
}

function withExpandedFieldPrefixIfMissing(before: string | undefined, after: string): string | undefined {
  if (before == null) return before;
  if (!after.includes("=") || before.includes("=")) return before;

  const paramMatch = /^param=parm_\d+=/.exec(after);
  if (paramMatch) {
    return `${paramMatch[0]}${before}`;
  }

  const eq = after.indexOf("=");
  if (eq <= 0) return before;
  return `${after.slice(0, eq + 1)}${before}`;
}

function normalizeExpandedChangeLine(line: ConfigLine): ConfigLine {
  if (line.type !== "change") return line;
  const beforeFull = withExpandedFieldPrefixIfMissing(line.before, line.line);
  if (beforeFull?.trim() !== line.line.trim()) return line;
  return {
    ...line,
    type: "context",
    before: undefined,
    changedInRev: undefined,
  };
}

function pushNormalizedChangeLine(lines: ConfigLine[], line: ConfigLine) {
  lines.push(normalizeExpandedChangeLine(line));
}

/**
 * Parse one `lines[]` element from `diff/config/.../content` (camelCase, PascalCase, unified +/- prefixes).
 */
export function configLineFromUnknownRecord(raw: unknown): ConfigLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const lineRaw = pickFromRecord(o, ["line", "Line", "text", "Text", "value", "Value", "content", "Content"]);
  let line = typeof lineRaw === "string" ? lineRaw : lineRaw != null ? String(lineRaw) : "";

  const typeRaw = pickFromRecord(o, [
    "type",
    "Type",
    "lineType",
    "LineType",
    "kind",
    "Kind",
    "op",
    "Op",
    "action",
    "Action",
    "changeType",
    "ChangeType",
  ]);
  let type = normalizeLineTypeRaw(typeRaw);

  const addedInRev = readOptionalFiniteNumber(pickFromRecord(o, ["addedInRev", "AddedInRev"]));
  const changedInRev = readOptionalFiniteNumber(pickFromRecord(o, ["changedInRev", "ChangedInRev"]));
  const removedInRev = readOptionalFiniteNumber(pickFromRecord(o, ["removedInRev", "RemovedInRev"]));
  const beforeRaw = pickFromRecord(o, ["before", "Before", "oldValue", "OldValue", "previous", "Previous"]);
  const before = typeof beforeRaw === "string" ? beforeRaw : undefined;
  const hoverText = inferRawLineHoverText(line, before, o);

  if (!line.startsWith("//")) {
    const ch = line.charAt(0);
    if (type === "context") {
      if (ch === "+") {
        type = "add";
        line = line.slice(1);
      } else if (ch === "-") {
        type = "removed";
        line = line.slice(1);
      } else if (ch === " " || ch === "\t") {
        line = line.replace(/^[ \t]+/, "");
      }
    }
  }

  return { line, type, addedInRev, changedInRev, before, hoverText, removedInRev };
}

/** Extract `lines` from a diff config JSON body (camel or Pascal `lines`). */
export function configLinesArrayFromPayload(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const o = data as { lines?: unknown; Lines?: unknown };
  if (Array.isArray(o.lines)) return o.lines;
  if (Array.isArray(o.Lines)) return o.Lines;
  return [];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => asText(x)).join(", ")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ref = o.ref;
    if (ref && typeof ref === "object") {
      const r = ref as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : null;
      const group = typeof r.group === "string" ? r.group : null;
      if (name && group) return `${group}.${name}`;
      if (name) return name;
    }
    if (Object.prototype.hasOwnProperty.call(o, "value")) {
      return asText(o.value);
    }
    try {
      return JSON.stringify(o);
    } catch {
      return "";
    }
  }
  return String(v);
}

function optionPrefixForKey(key: string): string | null {
  const k = key.trim().toLowerCase();
  if (k === "interfaceoptions" || k === "ioptions" || k === "iops") return "iop";
  if (k === "options" || k === "ops") return "op";
  if (k === "groundoptions" || k === "goptions" || k === "gops" || k === "groundops") return "gop";
  return null;
}

function compactOptionValues(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((entry) => asText(entry).trim())
    .filter((entry) => entry.length > 0);
}

function compactTransformsValues(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((entry) => asText(entry).trim())
    .filter((entry) => entry.length > 0 && entry !== "-1");
}

function flattenSubOps(value: unknown): FlattenedSubOp[] {
  if (!Array.isArray(value)) return [];
  const out: FlattenedSubOp[] = [];
  for (let i = 0; i < value.length; i++) {
    const outer = value[i];
    const slot = i + 1;
    if (Array.isArray(outer)) {
      let ord = 0;
      for (const inner of outer) {
        const text = asText(inner).trim();
        if (!text) continue;
        ord++;
        out.push({ slot, ordinal: ord, text });
      }
      continue;
    }
    const text = asText(outer).trim();
    if (!text) continue;
    out.push({ slot, ordinal: 1, text });
  }
  return out;
}

function hoverFromGroupedToken(token: string): string | undefined {
  const stripped = token.replace(/,count=\d+$/i, "").trim();
  const m = /^([a-z0-9_]+)\.([^\s]+)$/i.exec(stripped);
  if (!m) return undefined;
  const group = m[1] ?? "";
  const name = m[2] ?? "";
  const hover = buildRefHoverText(group, name);
  return hover || undefined;
}

function fieldLinesFromKeyValue(key: string, value: unknown): ExpandedFieldLine[] {
  const lowerKey = key.trim().toLowerCase();
  if (lowerKey === "params") {
    const expanded = expandParamsLines(value);
    if (expanded.length > 0) return expanded;
  }
  if (lowerKey === "values") {
    const expanded = expandEnumValuesLines(value);
    if (expanded.length > 0) return expanded;
  }
  {
    const entityOps = coerceEntityOpsObject(value);
    const expandedActions = entityOps ? expandEntityOpsLines(entityOps) : [];
    if (expandedActions.length > 0) return expandedActions;
  }
  if (lowerKey === "subops") {
    const flat = flattenSubOps(value);
    if (flat.length > 0) return flat.map((e) => ({ line: `subop${e.slot}=${e.text}` }));
  }
  if (lowerKey === "actions" && value && typeof value === "object" && !Array.isArray(value)) {
    if (Object.keys(value as Record<string, unknown>).length === 0) return [];
  }
  if ((lowerKey === "transforms" || lowerKey === "multiloc") && Array.isArray(value)) {
    const compact = compactTransformsValues(value);
    return compact.map((entry, idx) => ({
      line: `multiloc${idx + 1}=${entry}`,
      hoverText: hoverFromGroupedToken(entry),
    }));
  }
  const refRendered = renderValueWithRef(value);
  if (refRendered) {
    return [{ line: `${key}=${refRendered.display}`, hoverText: refRendered.hoverText }];
  }
  const optPrefix = optionPrefixForKey(key);
  if (optPrefix != null && Array.isArray(value)) {
    const compact = compactOptionValues(value);
    return compact.map((entry, idx) => ({ line: `${optPrefix}${idx + 1}=${entry}` }));
  }
  if ((lowerKey === "countobj" || lowerKey === "countco") && Array.isArray(value)) {
    const entries = value
      .map((entry) => asText(entry).trim())
      .filter((text) => text.length > 0 && !countObjEntryHasZeroAmount(text));
    return entries.map((text, idx) => ({
      line: `${key}${idx + 1}=${text}`,
      hoverText: hoverFromGroupedToken(text),
    }));
  }
  return [{ line: `${key}=${asText(value)}` }];
}

type ParsedOptionArrayLine = {
  key: string;
  optPrefix: string;
  values: string[];
};

type ParsedNamedArrayLine = {
  key: string;
  values: string[];
};

type ParsedTransformsLine = {
  values: string[];
};

type FlattenedSubOp = {
  slot: number;
  ordinal: number;
  text: string;
};

type ExpandedFieldLine = {
  line: string;
  hoverText?: string;
};

type ParamRender = {
  display: string;
  hoverText?: string;
};

function parseParamsObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function renderParamValue(raw: unknown): ParamRender | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    const display = asText(raw).trim();
    return display ? { display } : null;
  }
  const obj = raw as Record<string, unknown>;
  const ref = obj.ref;
  const value = obj.value;
  if (!ref || typeof ref !== "object") {
    const display = asText(value ?? raw).trim();
    return display ? { display } : null;
  }
  const r = ref as Record<string, unknown>;
  const group = typeof r.group === "string" ? r.group : "";
  const name = typeof r.name === "string" ? r.name : "";
  const id = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : "";
  const rawValue = asText(value).trim();
  const display = normalizeGamevalDisplay(group, name, rawValue);
  if (!display) return null;
  const hoverText = buildRefHoverText(group, name, id);
  return { display, hoverText: hoverText || undefined };
}

function renderEnumValue(raw: unknown): ParamRender | null {
  return renderParamValue(raw);
}

function expandEnumValuesLines(value: unknown): ExpandedFieldLine[] {
  const values = parseParamsObject(value);
  if (!values) return [];
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, raw], index) => {
      const rendered = renderEnumValue(raw);
      if (!rendered) return [];
      return [{ line: `value${index + 1}=${key},${rendered.display}`, hoverText: rendered.hoverText } satisfies ExpandedFieldLine];
    });
}

function expandParamsLines(value: unknown): ExpandedFieldLine[] {
  const params = parseParamsObject(value);
  if (!params) return [];
  return Object.keys(params)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const rendered = renderParamValue(params[String(id)]);
      if (!rendered) return [];
      return [{ line: `param=parm_${id}=${rendered.display}`, hoverText: rendered.hoverText } satisfies ExpandedFieldLine];
    });
}

function expandEnumValuesConfigLine(line: ConfigLine): ConfigLine[] {
  const eq = line.line.indexOf("=");
  if (eq <= 0) return [line];
  const key = line.line.slice(0, eq).trim().toLowerCase();
  if (key !== "values") return [line];

  const rhs = line.line.slice(eq + 1).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rhs);
  } catch {
    return [line];
  }
  const expanded = expandEnumValuesLines(parsed);
  if (expanded.length === 0) return [line];

  const beforeByIndex = new Map<number, ExpandedFieldLine>();
  if (line.before) {
    const beq = line.before.indexOf("=");
    if (beq > 0 && line.before.slice(0, beq).trim().toLowerCase() === "values") {
      const brhs = line.before.slice(beq + 1).trim();
      try {
        const bParsed = JSON.parse(brhs);
        const bExpanded = expandEnumValuesLines(bParsed);
        bExpanded.forEach((entry) => {
          const m = /^value(\d+)=/.exec(entry.line);
          const idx = m ? Number.parseInt(m[1]!, 10) : Number.NaN;
          if (Number.isFinite(idx)) beforeByIndex.set(idx, entry);
        });
      } catch {
        // Keep fallback before text when parse fails.
      }
    }
  }

  return expanded.map((entry) => {
    const m = /^value(\d+)=/.exec(entry.line);
    const idx = m ? Number.parseInt(m[1]!, 10) : Number.NaN;
    const beforeRendered = Number.isFinite(idx) ? beforeByIndex.get(idx)?.line : undefined;
    return {
      ...line,
      line: entry.line,
      hoverText: entry.hoverText,
      before: beforeRendered ? beforeRendered.split("=").slice(1).join("=") : line.before,
    };
  });
}

function parseOptionArrayLine(rawLine: string): ParsedOptionArrayLine | null {
  const eq = rawLine.indexOf("=");
  if (eq <= 0) return null;
  const key = rawLine.slice(0, eq).trim();
  const optPrefix = optionPrefixForKey(key);
  if (optPrefix == null) return null;
  const rhs = rawLine.slice(eq + 1).trim();
  if (!rhs.startsWith("[") || !rhs.endsWith("]")) return null;
  const body = rhs.slice(1, -1);
  const values = body
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return { key, optPrefix, values };
}

function parseNamedArrayLine(rawLine: string, keys: readonly string[]): ParsedNamedArrayLine | null {
  const eq = rawLine.indexOf("=");
  if (eq <= 0) return null;
  const key = rawLine.slice(0, eq).trim();
  if (!keys.includes(key.trim().toLowerCase())) return null;
  const rhs = rawLine.slice(eq + 1).trim();
  if (!rhs.startsWith("[") || !rhs.endsWith("]")) return null;
  const body = rhs.slice(1, -1);
  const values = body
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return { key, values };
}

function countObjEntryHasZeroAmount(value: string): boolean {
  const amtMatch = /(?:^|,)\s*amt\s*=\s*(-?\d+)\b/i.exec(value);
  if (!amtMatch) return false;
  const n = Number.parseInt(amtMatch[1] ?? "", 10);
  return Number.isFinite(n) && n === 0;
}

/**
 * For the parallel countco/countobj arrays stored as separate keys in the same field map:
 * 1. Remove index slots where countco[i] === 0.
 * 2. Merge the count into each countobj value as ",count=N".
 * 3. Remove the countco key from the map entirely.
 */
function mergeCountObjArrays(map: Record<string, unknown>): Record<string, unknown> {
  const coKey = Object.keys(map).find((k) => k.trim().toLowerCase() === "countco");
  const objKey = Object.keys(map).find((k) => k.trim().toLowerCase() === "countobj");
  if (!coKey || !objKey) return map;
  const coArr = Array.isArray(map[coKey]) ? (map[coKey] as unknown[]) : null;
  const objArr = Array.isArray(map[objKey]) ? (map[objKey] as unknown[]) : null;
  if (!coArr || !objArr) return map;
  const keep = coArr.map((v) => {
    const n = typeof v === "number" ? v : Number(asText(v).trim());
    return !Number.isFinite(n) || n !== 0;
  });
  const filteredCo = coArr.filter((_, i) => keep[i]);
  const filteredObj = objArr.filter((_, i) => keep[i]);
  const mergedObj = filteredObj.map((objVal, i) => {
    const count = asText(filteredCo[i]).trim();
    const objText = asText(objVal).trim();
    return count ? `${objText},count=${count}` : objText;
  });
  const { [coKey]: _dropped, ...rest } = { ...map, [objKey]: mergedObj };
  return rest;
}

/** @deprecated use mergeCountObjArrays */
const pruneCountObjZeros = mergeCountObjArrays;

function expandOptionArrayConfigLine(line: ConfigLine): ConfigLine[] {
  const parsed = parseOptionArrayLine(line.line);
  if (parsed == null) return [line];

  const beforeParsed = line.before ? parseOptionArrayLine(line.before) : null;
  return parsed.values.map((value, idx) => ({
    ...line,
    line: `${parsed.optPrefix}${idx + 1}=${value}`,
    before:
      beforeParsed && beforeParsed.optPrefix === parsed.optPrefix
        ? beforeParsed.values[idx]
        : line.before,
  }));
}

function expandCountObjConfigLine(line: ConfigLine): ConfigLine[] {
  const parsed = parseNamedArrayLine(line.line, ["countobj", "countco"]);
  if (parsed == null) return [line];

  const beforeParsed = line.before ? parseNamedArrayLine(line.before, ["countobj", "countco"]) : null;
  const beforeValues = (beforeParsed?.values ?? []).filter((value) => !countObjEntryHasZeroAmount(value));
  const nextValues = parsed.values.filter((value) => !countObjEntryHasZeroAmount(value));
  return nextValues.map((value, idx) => ({
    ...line,
    line: `${parsed.key}${idx + 1}=${value}`,
    hoverText: hoverFromGroupedToken(value),
    before: beforeValues[idx] ?? line.before,
  }));
}

function parseTransformsArrayLine(rawLine: string): ParsedTransformsLine | null {
  const eq = rawLine.indexOf("=");
  if (eq <= 0) return null;
  const key = rawLine.slice(0, eq).trim().toLowerCase();
  if (key !== "transforms" && key !== "multiloc") return null;
  const rhs = rawLine.slice(eq + 1).trim();
  if (!rhs.startsWith("[") || !rhs.endsWith("]")) return null;
  const body = rhs.slice(1, -1);
  const values = body
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v !== "-1");
  return { values };
}

function expandTransformsConfigLine(line: ConfigLine): ConfigLine[] {
  const parsed = parseTransformsArrayLine(line.line);
  if (parsed == null) return [line];
  const beforeParsed = line.before ? parseTransformsArrayLine(line.before) : null;
  return parsed.values.map((value, idx) => ({
    ...line,
    line: `multiloc${idx + 1}=${value}`,
    hoverText: hoverFromGroupedToken(value),
    before: beforeParsed ? beforeParsed.values[idx] : line.before,
  }));
}

function expandSubOpsConfigLine(line: ConfigLine): ConfigLine[] {
  const eq = line.line.indexOf("=");
  if (eq <= 0) return [line];
  const key = line.line.slice(0, eq).trim().toLowerCase();
  if (key !== "subops") return [line];

  const rhs = line.line.slice(eq + 1).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rhs);
  } catch {
    return [line];
  }

  const toFlat = flattenSubOps(parsed);
  if (toFlat.length === 0) return [line];

  const fromByKey = new Map<string, string>();
  if (line.before) {
    const beq = line.before.indexOf("=");
    if (beq > 0 && line.before.slice(0, beq).trim().toLowerCase() === "subops") {
      const brhs = line.before.slice(beq + 1).trim();
      try {
        const bParsed = JSON.parse(brhs);
        flattenSubOps(bParsed).forEach((f) => fromByKey.set(`${f.slot}:${f.ordinal}`, f.text));
      } catch {
        // Keep original before fallback when parsing fails.
      }
    }
  }

  return toFlat.map((f) => ({
    ...line,
    line: `subop${f.slot}=${f.text}`,
    before: fromByKey.get(`${f.slot}:${f.ordinal}`) ?? line.before,
  }));
}

function shouldDropConfigLine(line: ConfigLine): boolean {
  return line.line.trim().toLowerCase() === "actions={}";
}

function expandParamsConfigLine(line: ConfigLine): ConfigLine[] {
  const eq = line.line.indexOf("=");
  if (eq <= 0) return [line];
  const key = line.line.slice(0, eq).trim().toLowerCase();
  if (key !== "params") return [line];

  const rhs = line.line.slice(eq + 1).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rhs);
  } catch {
    return [line];
  }
  const expanded = expandParamsLines(parsed);
  if (expanded.length === 0) return [line];

  const beforeById = new Map<number, ParamRender>();
  if (line.before) {
    const beq = line.before.indexOf("=");
    if (beq > 0 && line.before.slice(0, beq).trim().toLowerCase() === "params") {
      const brhs = line.before.slice(beq + 1).trim();
      try {
        const bParsed = JSON.parse(brhs);
        const params = parseParamsObject(bParsed) ?? {};
        Object.keys(params)
          .map((k) => Number.parseInt(k, 10))
          .filter((n) => Number.isFinite(n))
          .forEach((id) => {
            const rendered = renderParamValue(params[String(id)]);
            if (rendered) beforeById.set(id, rendered);
          });
      } catch {
        // Keep the original before value when parsing fails.
      }
    }
  }

  return expanded.map((entry) => {
    const idMatch = /parm_(\d+)=/.exec(entry.line);
    const pid = idMatch ? Number.parseInt(idMatch[1]!, 10) : Number.NaN;
    const beforeDisplay = Number.isFinite(pid) ? beforeById.get(pid)?.display : undefined;
    return {
      ...line,
      line: entry.line,
      hoverText: entry.hoverText,
      before: beforeDisplay ?? line.before,
    };
  });
}

function synthesizeLinesFromDiffPayload(data: unknown): ConfigLine[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const added = (o.added && typeof o.added === "object" ? (o.added as Record<string, unknown>) : {}) ?? {};
  const changed = (o.changed && typeof o.changed === "object" ? (o.changed as Record<string, unknown>) : {}) ?? {};
  const removed = Array.isArray(o.removed) ? o.removed : [];
  const typeRaw = typeof o.type === "string" ? o.type : "config";
  const sectionPrefix = sectionPrefixForConfigType(typeRaw);
  const rev = readOptionalFiniteNumber(o.rev);
  const base = readOptionalFiniteNumber(o.base);

  const lines: ConfigLine[] = [];

  const numericIds = (obj: Record<string, unknown>): number[] =>
    Object.keys(obj)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

  for (const id of numericIds(added)) {
    lines.push({ line: `// ${id}`, type: "add", addedInRev: rev });
    lines.push({ line: `[${sectionPrefix}_${id}]`, type: "add", addedInRev: rev });
    const fields = added[String(id)];
    if (fields && typeof fields === "object") {
      const map = pruneCountObjZeros(fields as Record<string, unknown>);
      Object.keys(map)
        .sort((a, b) => a.localeCompare(b))
        .forEach((k) => {
          const rendered = fieldLinesFromKeyValue(k, map[k]);
          rendered.forEach((entry) =>
            lines.push({ line: entry.line, hoverText: entry.hoverText, type: "add", addedInRev: rev }),
          );
        });
    }
    lines.push({ line: "", type: "context" });
  }

  for (const id of numericIds(changed)) {
    lines.push({ line: `// ${id}`, type: "context" });
    lines.push({ line: `[${sectionPrefix}_${id}]`, type: "context" });
    const fields = changed[String(id)];
    if (fields && typeof fields === "object") {
      const map = pruneCountObjZeros(fields as Record<string, unknown>);
      Object.keys(map)
        .sort((a, b) => a.localeCompare(b))
        .forEach((k) => {
          const entry = map[k];
          if (k.trim().toLowerCase() === "actions" && entry && typeof entry === "object" && !Array.isArray(entry)) {
            if (Object.keys(entry as Record<string, unknown>).length === 0) return;
          }
          if (!entry || typeof entry !== "object") {
            const rendered = fieldLinesFromKeyValue(k, entry);
            rendered.forEach((entryLine) =>
              lines.push({ line: entryLine.line, hoverText: entryLine.hoverText, type: "change", changedInRev: rev }),
            );
            return;
          }
          const e = entry as Record<string, unknown>;
          if (k.trim().toLowerCase() === "subops" && Array.isArray(e.to)) {
            const toFlat = flattenSubOps(e.to);
            const fromByKey = new Map<string, string>();
            flattenSubOps(e.from).forEach((f) => fromByKey.set(`${f.slot}:${f.ordinal}`, f.text));
            toFlat.forEach((f) => {
              pushNormalizedChangeLine(lines, {
                line: `subop${f.slot}=${f.text}`,
                type: "change",
                changedInRev: rev,
                before: fromByKey.get(`${f.slot}:${f.ordinal}`),
              });
            });
            return;
          }
          if ((k.trim().toLowerCase() === "transforms" || k.trim().toLowerCase() === "multiloc") && Array.isArray(e.to)) {
            const toVals = compactTransformsValues(e.to);
            const fromVals = compactTransformsValues(e.from);
            toVals.forEach((toValue, idx) => {
              pushNormalizedChangeLine(lines, {
                line: `multiloc${idx + 1}=${toValue}`,
                hoverText: hoverFromGroupedToken(toValue),
                type: "change",
                changedInRev: rev,
                before: fromVals[idx],
              });
            });
            return;
          }
          if (k.trim().toLowerCase() === "params") {
            const toExpanded = expandParamsLines(e.to);
            const fromExpanded = expandParamsLines(e.from);
            const fromById = new Map<number, ExpandedFieldLine>();
            fromExpanded.forEach((f) => {
              const match = /parm_(\d+)=/.exec(f.line);
              const id = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
              if (Number.isFinite(id)) fromById.set(id, f);
            });
            toExpanded.forEach((t) => {
              const match = /parm_(\d+)=/.exec(t.line);
              const id = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
              const beforeRendered = Number.isFinite(id) ? fromById.get(id)?.line : undefined;
              pushNormalizedChangeLine(lines, {
                line: t.line,
                hoverText: t.hoverText,
                type: "change",
                changedInRev: rev,
                before: beforeRendered ? beforeRendered.split("=").slice(2).join("=") : undefined,
              });
            });
            return;
          }
          if (k.trim().toLowerCase() === "values") {
            const toExpanded = expandEnumValuesLines(e.to);
            const fromExpanded = expandEnumValuesLines(e.from);
            const fromByIndex = new Map<number, ExpandedFieldLine>();
            fromExpanded.forEach((f) => {
              const match = /^value(\d+)=/.exec(f.line);
              const idx = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
              if (Number.isFinite(idx)) fromByIndex.set(idx, f);
            });
            toExpanded.forEach((t) => {
              const match = /^value(\d+)=/.exec(t.line);
              const idx = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
              const beforeRendered = Number.isFinite(idx) ? fromByIndex.get(idx)?.line : undefined;
              pushNormalizedChangeLine(lines, {
                line: t.line,
                hoverText: t.hoverText,
                type: "change",
                changedInRev: rev,
                before: beforeRendered ? beforeRendered.split("=").slice(1).join("=") : undefined,
              });
            });
            return;
          }
          if ((k.trim().toLowerCase() === "countobj" || k.trim().toLowerCase() === "countco") && Array.isArray(e.to)) {
            const lk = k.trim().toLowerCase();
            // countco is merged into countobj lines — skip it on its own
            if (lk === "countco" && Object.keys(map).some((mk) => mk.trim().toLowerCase() === "countobj")) {
              return;
            }
            let toVals = e.to.map((entry) => asText(entry).trim());
            let fromVals = Array.isArray(e.from) ? e.from.map((entry) => asText(entry).trim()) : [];
            if (lk === "countobj") {
              // Merge counts from parallel countco diff entry
              const coKey = Object.keys(map).find((mk) => mk.trim().toLowerCase() === "countco");
              const coEntry = coKey ? (map[coKey] as Record<string, unknown> | undefined) : undefined;
              if (coEntry && typeof coEntry === "object" && !Array.isArray(coEntry)) {
                const coTo = Array.isArray(coEntry.to) ? coEntry.to.map((v) => asText(v).trim()) : [];
                const coFrom = Array.isArray(coEntry.from) ? coEntry.from.map((v) => asText(v).trim()) : [];
                const keepTo = coTo.map((v) => { const n = Number(v); return !Number.isFinite(n) || n !== 0; });
                const keepFrom = coFrom.map((v) => { const n = Number(v); return !Number.isFinite(n) || n !== 0; });
                const filteredCoTo = coTo.filter((_, i) => keepTo[i]);
                const filteredCoFrom = coFrom.filter((_, i) => keepFrom[i]);
                toVals = toVals
                  .filter((_, i) => keepTo[i] ?? true)
                  .map((objVal, i) => filteredCoTo[i] ? `${objVal},count=${filteredCoTo[i]}` : objVal);
                fromVals = fromVals
                  .filter((_, i) => keepFrom[i] ?? true)
                  .map((objVal, i) => filteredCoFrom[i] ? `${objVal},count=${filteredCoFrom[i]}` : objVal);
              }
            }
            toVals.forEach((toValue, idx) => {
              pushNormalizedChangeLine(lines, {
                line: `${k}${idx + 1}=${toValue}`,
                hoverText: hoverFromGroupedToken(toValue.split(",")[0] ?? toValue),
                type: "change",
                changedInRev: rev,
                before: fromVals[idx],
              });
            });
            return;
          }
          const optPrefix = optionPrefixForKey(k);
          if (optPrefix != null && Array.isArray(e.to)) {
            const toVals = compactOptionValues(e.to);
            const fromVals = compactOptionValues(e.from);
            toVals.forEach((toValue, idx) => {
              pushNormalizedChangeLine(lines, {
                line: `${optPrefix}${idx + 1}=${toValue}`,
                type: "change",
                changedInRev: rev,
                before: fromVals[idx],
              });
            });
            return;
          }
          const rendered = fieldLinesFromKeyValue(k, e.to);
          rendered.forEach((entryLine) =>
            pushNormalizedChangeLine(lines, {
              line: entryLine.line,
              hoverText: entryLine.hoverText,
              type: "change",
              changedInRev: rev,
              before: asText(e.from),
            }),
          );
        });
    }
    lines.push({ line: "", type: "context" });
  }

  const removedIds = removed
    .map((v) => (typeof v === "number" ? v : Number.parseInt(String(v), 10)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  for (const id of removedIds) {
    lines.push({ line: `// ${id}`, type: "removed", removedInRev: base });
    lines.push({ line: `[${sectionPrefix}_${id}]`, type: "removed", removedInRev: base });
    lines.push({ line: "", type: "context" });
  }

  return lines;
}

/** Map `diff/config/.../content` body to `ConfigLine[]` (empty array when shape is wrong). */
export function configLinesFromDiffBody(data: unknown): ConfigLine[] {
  const raw = configLinesArrayFromPayload(data);
  if (raw.length > 0) {
    const out: ConfigLine[] = [];
    for (const row of raw) {
      const line = configLineFromUnknownRecord(row);
      if (!line) continue;
      const normalizedLine = normalizeExpandedChangeLine(line);
      if (shouldDropConfigLine(normalizedLine)) continue;
      const expandedParams = expandParamsConfigLine(normalizedLine).map(normalizeExpandedChangeLine);
      for (const paramEntry of expandedParams) {
        const expandedEnumValues = expandEnumValuesConfigLine(paramEntry).map(normalizeExpandedChangeLine);
        for (const enumValuesEntry of expandedEnumValues) {
          const expandedTransforms = expandTransformsConfigLine(enumValuesEntry).map(normalizeExpandedChangeLine);
          for (const transformEntry of expandedTransforms) {
          const expandedSubOps = expandSubOpsConfigLine(transformEntry).map(normalizeExpandedChangeLine);
          for (const subOpEntry of expandedSubOps) {
            const expandedCountObj = expandCountObjConfigLine(subOpEntry).map(normalizeExpandedChangeLine);
            for (const countObjEntry of expandedCountObj) {
              out.push(...expandOptionArrayConfigLine(countObjEntry).map(normalizeExpandedChangeLine));
            }
          }
        }
        }
      }
    }
    return out;
  }
  return synthesizeLinesFromDiffPayload(data);
}

/**
 * Map `diff/config/.../content` JSON body to `ConfigLine[]`.
 * Returns `null` when the server reports decoding/missing (caller usually treats as empty).
 */
export function configLinesFromContentPayload(data: unknown): ConfigLine[] | null {
  if (!data || typeof data !== "object") return [];
  const o = data as { status?: string };
  if (o.status === "decoding" || o.status === "missing") return null;
  return configLinesFromDiffBody(data);
}

/** Map `/cache?type=...&rev=...` payload to full `ConfigLine[]` for combined text mode. */
type CacheHeaderRenderOptions = {
  headerLabelForId?: (id: number) => string | undefined;
  includeCommentWithoutHeaderLabel?: boolean;
};

export function configLinesFromCachePayload(
  data: unknown,
  configType: string,
  headerOptions?: CacheHeaderRenderOptions,
): ConfigLine[] | null {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const status = typeof o.status === "string" ? o.status : undefined;
  if (status === "decoding" || status === "missing") return null;

  const snapshots = (() => {
    const many = o.snapshots;
    if (many && typeof many === "object" && !Array.isArray(many)) return many as Record<string, unknown>;
    const one = o.snapshot;
    const id = o.id;
    if (one && typeof one === "object" && !Array.isArray(one) && (typeof id === "number" || typeof id === "string")) {
      return { [String(id)]: one } as Record<string, unknown>;
    }
    return null;
  })();

  if (!snapshots) return [];

  const sectionPrefix = sectionPrefixForConfigType(configType);
  const ids = Object.keys(snapshots)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const lines: ConfigLine[] = [];
  for (const id of ids) {
    const snap = snapshots[String(id)];
    if (!snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    const map = pruneCountObjZeros(snap as Record<string, unknown>);

    const headerLabel = headerOptions?.headerLabelForId?.(id)?.trim();
    const includeComment =
      Boolean(headerLabel) || (headerOptions?.includeCommentWithoutHeaderLabel ?? true);

    if (includeComment) lines.push({ line: `// ${id}`, type: "context" });
    lines.push({ line: `[${headerLabel || `${sectionPrefix}_${id}`}]`, type: "context" });

    Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .forEach((k) => {
        const rendered = fieldLinesFromKeyValue(k, map[k]);
        rendered.forEach((entry) => {
          const line: ConfigLine = { line: entry.line, hoverText: entry.hoverText, type: "context" };
          if (!shouldDropConfigLine(line)) lines.push(line);
        });
      });

    lines.push({ line: "", type: "context" });
  }

  return lines;
}

/**
 * Parse `diff/config/{type}/content` lines into table rows (same rules as openrune `parseConfigContentToRows`).
 */
export function parseConfigContentToRows(
  lines: { line: string; type: string; addedInRev?: number; changedInRev?: number; removedInRev?: number }[],
): ConfigArchiveTableRow[] {
  const rows: ConfigArchiveTableRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.line.startsWith("// ")) {
      const idStr = line.line.slice(3).trim();
      const headerId = Number.parseInt(idStr, 10);
      if (Number.isNaN(headerId)) {
        i++;
        continue;
      }
      i++;
      let sectionId: string | undefined;
      if (i < lines.length && lines[i].line.startsWith("[") && lines[i].line.endsWith("]")) {
        sectionId = lines[i].line.slice(1, -1);
        i++;
      }
      const entries: Record<string, string> = {};
      while (i < lines.length) {
        const raw = lines[i].line;
        if (raw.length === 0 || raw.startsWith("// ")) break;
        const eq = raw.indexOf("=");
        if (eq !== -1) {
          const k = raw.slice(0, eq).trim();
          const v = raw.slice(eq + 1).trim();
          entries[k] = v;
        }
        i++;
      }
      let rowId = headerId;
      if (sectionId) {
        const separator = sectionId.lastIndexOf("_");
        const suffix = separator >= 0 ? sectionId.slice(separator + 1) : sectionId;
        const fromSectionId = Number.parseInt(suffix, 10);
        if (!Number.isNaN(fromSectionId)) rowId = fromSectionId;
      }
      rows.push({ id: rowId, sectionId, entries });
    } else {
      i++;
    }
  }
  return rows;
}

/** Sequence id → `lengthInCycles` for spotanim tick duration lookup. */
export function sequenceLengthInCyclesByIdFromRows(rows: ConfigArchiveTableRow[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of rows) {
    const raw = r.entries.lengthInCycles;
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[r.id] = n;
  }
  return out;
}
