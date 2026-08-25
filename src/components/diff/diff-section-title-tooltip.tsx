"use client";

import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { cn } from "@/lib/utils";

import type { ConfigLine } from "./diff-types";
import { sectionTitleMatchesFocus } from "./diff-focus-match";

export type SectionTitleHoverField = {
  label: string;
  value: string;
  /** Packed Jagex HSL when known. */
  packedHsl?: number;
  /** 24-bit RGB when known. */
  rgb24?: number;
};

export type SectionTitleHoverInfo = {
  id: number;
  title: string;
  typeLabel: string;
  fields: SectionTitleHoverField[];
  isCurrent: boolean;
};

const PREFERRED_FIELD_KEYS = [
  "colour",
  "color",
  "rgb",
  "mapcolour",
  "mapcolor",
  "name",
  "gameval",
  "texture",
  "textureid",
  "opacity",
  "size",
  "model",
  "models",
] as const;

function titleCaseWords(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Human label for a config section type (`overlay` → `Overlay`, `items` → `Item`). */
export function humanizeConfigTypeLabel(configType: string): string {
  const t = configType.trim().toLowerCase();
  if (!t) return "Config";
  const singular =
    t.endsWith("ies") && t.length > 3
      ? `${t.slice(0, -3)}y`
      : t.endsWith("s") && t.length > 1
        ? t.slice(0, -1)
        : t;
  const special: Record<string, string> = {
    npc: "NPC",
    varp: "Varp",
    varbit: "Varbit",
    varclient: "Var Client",
    spotanim: "Spot Anim",
    mapelement: "Map Element",
    worldentity: "World Entity",
    worldmaparea: "World Map Area",
  };
  return special[singular] ?? titleCaseWords(singular);
}

function fieldLabelFromKey(key: string): string {
  const k = key.trim().toLowerCase();
  if (k === "colour" || k === "color") return "Colour";
  if (k === "mapcolour" || k === "mapcolor") return "Map colour";
  if (k === "rgb") return "RGB";
  if (k === "textureid") return "Texture";
  return titleCaseWords(key);
}

function parsePackedColor(key: string, value: string): { packedHsl?: number; rgb24?: number } | null {
  const k = key.trim().toLowerCase();
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  if (k === "rgb" || k === "colour" || k === "color" || k === "mapcolour" || k === "mapcolor" || k.endsWith("rgb")) {
    return { rgb24: n };
  }
  if (k.includes("hsl")) {
    return { packedHsl: n };
  }
  return null;
}

function formatFieldDisplay(key: string, value: string): string {
  const color = parsePackedColor(key, value);
  if (color?.rgb24 != null) {
    return `0x${(color.rgb24 >>> 0).toString(16).padStart(6, "0")}`;
  }
  return value;
}

/** Pull a few interesting `key=value` rows from a dump section for the hover card. */
export function extractSectionTitleHoverFields(
  lines: readonly ConfigLine[],
  start: number,
  end: number,
  limit = 5,
): SectionTitleHoverField[] {
  const byKey = new Map<string, { key: string; value: string }>();
  for (let i = start; i < end && i < lines.length; i++) {
    const raw = lines[i]?.line ?? "";
    if (!raw || raw.startsWith("//") || (raw.startsWith("[") && raw.endsWith("]"))) continue;
    const eq = raw.indexOf("=");
    if (eq <= 0) continue;
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (!key || !value) continue;
    const lk = key.toLowerCase();
    if (lk === "gameval" || lk === "id" || lk === "_header" || lk === "text") continue;
    if (!byKey.has(lk)) byKey.set(lk, { key, value });
  }

  const picked: SectionTitleHoverField[] = [];
  const used = new Set<string>();
  for (const pref of PREFERRED_FIELD_KEYS) {
    const hit = byKey.get(pref);
    if (!hit) continue;
    used.add(pref);
    const color = parsePackedColor(hit.key, hit.value);
    picked.push({
      label: fieldLabelFromKey(hit.key),
      value: formatFieldDisplay(hit.key, hit.value),
      packedHsl: color?.packedHsl,
      rgb24: color?.rgb24,
    });
    if (picked.length >= limit) return picked;
  }

  for (const [lk, hit] of byKey) {
    if (used.has(lk)) continue;
    const color = parsePackedColor(hit.key, hit.value);
    picked.push({
      label: fieldLabelFromKey(hit.key),
      value: formatFieldDisplay(hit.key, hit.value),
      packedHsl: color?.packedHsl,
      rgb24: color?.rgb24,
    });
    if (picked.length >= limit) break;
  }
  return picked;
}

export function buildSectionTitleHoverByLineIndex(
  lines: readonly ConfigLine[],
  sections: readonly { start: number; end: number; title: string }[],
  configType: string,
  focusBracketTitle?: string | null,
): Map<number, SectionTitleHoverInfo> {
  const typeLabel = humanizeConfigTypeLabel(configType);
  const out = new Map<number, SectionTitleHoverInfo>();
  for (const section of sections) {
    const idLine = lines[section.start]?.line ?? "";
    const id = Number.parseInt(idLine.replace(/^\/\/\s*/, "").trim(), 10);
    if (!Number.isFinite(id)) continue;
    let titleLineIndex = -1;
    if (
      section.start + 1 < section.end &&
      (lines[section.start + 1]?.line ?? "").startsWith("[") &&
      (lines[section.start + 1]?.line ?? "").endsWith("]")
    ) {
      titleLineIndex = section.start + 1;
    }
    if (titleLineIndex < 0) continue;
    out.set(titleLineIndex, {
      id,
      title: section.title,
      typeLabel,
      fields: extractSectionTitleHoverFields(lines, section.start, section.end),
      isCurrent: sectionTitleMatchesFocus(section.title, focusBracketTitle, id),
    });
  }
  return out;
}

export function DumpSectionTitleTooltipBody({
  info,
  definitionLabel,
}: {
  info: SectionTitleHoverInfo;
  /** Optional secondary row (e.g. config type file). */
  definitionLabel?: string;
}) {
  return (
    <div className="min-w-[14rem] max-w-xs space-y-2 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-zinc-100">{info.typeLabel}</div>
          <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-sky-400">{info.title}</div>
        </div>
        {info.isCurrent ? (
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-100">
            Current
          </span>
        ) : null}
      </div>

      {(info.fields.length > 0 || definitionLabel) && (
        <>
          <div className="border-t border-zinc-800" />
          <div className="space-y-1">
            {info.fields.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 text-[11px]">
                <span className="text-zinc-400">{f.label}</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-zinc-100">
                  {f.rgb24 != null ? (
                    <RsColorBox rgb24={f.rgb24} width={12} height={12} className="rounded-[2px]" />
                  ) : f.packedHsl != null ? (
                    <RsColorBox packedHsl={f.packedHsl} width={12} height={12} className="rounded-[2px]" />
                  ) : null}
                  {f.value}
                </span>
              </div>
            ))}
            {definitionLabel ? (
              <div className="flex items-center justify-between gap-4 text-[11px]">
                <span className="text-zinc-400">Definition</span>
                <span className="font-mono text-zinc-400">{definitionLabel}</span>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="border-t border-zinc-800 pt-1.5 text-[10px] text-zinc-500">
        Click for navigation options
      </div>
    </div>
  );
}

/** Hoverable dump section title (`overlay_641` / gameval) with a rich definition card. */
export function DumpSectionTitleHover({
  info,
  definitionLabel,
  className,
  children,
}: {
  info: SectionTitleHoverInfo;
  definitionLabel?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <button
            type="button"
            {...props}
            className={cn(
              "cursor-pointer border-0 bg-transparent p-0 font-mono text-[13px] font-medium text-sky-500 underline decoration-sky-500/70 underline-offset-2 outline-none hover:text-sky-400 hover:decoration-sky-400 dark:text-sky-400 dark:decoration-sky-400/70 dark:hover:text-sky-300",
              className,
              props.className,
            )}
          >
            {children ?? info.title}
          </button>
        )}
      />
      <TooltipContent
        opaque
        side="bottom"
        align="start"
        sideOffset={8}
        className="max-w-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-white shadow-2xl"
      >
        <DumpSectionTitleTooltipBody info={info} definitionLabel={definitionLabel} />
      </TooltipContent>
    </Tooltip>
  );
}
