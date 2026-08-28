"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { modelDetailUrl } from "@/lib/cache-api-client";

import { EntityRefTable } from "./diff-entity-ref-table";
import { ModalPagination } from "./diff-modal-pagination";
import { useModalPaging } from "./diff-modal-paging";
import { cn } from "@/lib/utils";

import { focusBracketTitleForEntity } from "./diff-focus-match";
import { useDiffExplorerFocus } from "./diff-explorer-focus";

type NamedRef = { id: number; name: string | null };

type ModelDetail = {
  id: number;
  rev: number;
  vertexCount: number;
  faceCount: number;
  texturedFaceCount: number;
  transparentFaceCount: number;
  version: number;
  renderPriority: number;
  textures: number[];
  colors: number[];
  attachments: { items: NamedRef[]; npcs: NamedRef[]; objects: NamedRef[]; total: number };
  dat: string | null;
};

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function numList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function namedRefs(raw: unknown): NamedRef[] {
  if (!Array.isArray(raw)) return [];
  const out: NamedRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id)) continue;
    out.push({ id, name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null });
  }
  return out;
}

function parseDetail(data: unknown): ModelDetail | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const attachments = (o.attachments ?? {}) as Record<string, unknown>;
  return {
    id,
    rev: num(o.rev),
    vertexCount: num(o.vertexCount),
    faceCount: num(o.faceCount),
    texturedFaceCount: num(o.texturedFaceCount),
    transparentFaceCount: num(o.transparentFaceCount),
    version: num(o.version),
    renderPriority: num(o.renderPriority),
    textures: numList(o.textures),
    colors: numList(o.colors),
    attachments: {
      items: namedRefs(attachments.items),
      npcs: namedRefs(attachments.npcs),
      objects: namedRefs(attachments.objects),
      total: num(attachments.total),
    },
    dat: typeof o.dat === "string" ? o.dat : null,
  };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-none border border-border bg-muted/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-none border border-border bg-muted/30 px-2 py-1 font-mono text-xs";

/** Chip grid with paging once the list outgrows a page. */
function ChipListTab<T>({
  items,
  renderChip,
  resetKey,
}: {
  items: T[];
  renderChip: (item: T) => React.ReactNode;
  resetKey: string;
}) {
  const paging = useModalPaging(items, resetKey);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">{paging.items.map((item) => renderChip(item))}</div>
      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={items.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}

export type DiffModelDetailModalProps = {
  modelId: number | null;
  rev: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Switch the explorer to another section; without it attachments are not clickable. */
  onNavigateSection?: (section: string) => void;
};

export function DiffModelDetailModal({
  modelId,
  rev,
  open,
  onOpenChange,
  onNavigateSection,
}: DiffModelDetailModalProps) {
  const { selectedCacheType } = useCacheType();
  const { requestFocus } = useDiffExplorerFocus();
  const [detail, setDetail] = React.useState<ModelDetail | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || modelId == null) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setDetail(null);
    fetch(modelDetailUrl(selectedCacheType, modelId, rev))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = parseDetail(data);
        if (!parsed) throw new Error("Unexpected response");
        setDetail(parsed);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load model");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, open, rev, selectedCacheType]);

  const goTo = React.useCallback(
    (section: string, entry: NamedRef) => {
      if (!onNavigateSection) return;
      onNavigateSection(section);
      requestFocus(focusBracketTitleForEntity({ id: entry.id, section, gameval: entry.name }));
      onOpenChange(false);
    },
    [onNavigateSection, onOpenChange, requestFocus],
  );

  const usedBy = React.useMemo(() => {
    if (!detail) return [];
    return [
      { key: "items", label: "Items", entries: detail.attachments.items },
      { key: "npcs", label: "NPCs", entries: detail.attachments.npcs },
      { key: "objects", label: "Objects", entries: detail.attachments.objects },
    ].filter((g) => g.entries.length > 0);
  }, [detail]);

  /** Only kinds with data get a tab. */
  const tabs = React.useMemo(() => {
    if (!detail) return [] as { key: string; label: string; count: number }[];
    const out: { key: string; label: string; count: number }[] = [];
    if (detail.textures.length > 0) {
      out.push({ key: "textures", label: "Textures", count: detail.textures.length });
    }
    if (detail.colors.length > 0) {
      out.push({ key: "colors", label: "Colours", count: detail.colors.length });
    }
    usedBy.forEach((g) => out.push({ key: g.key, label: g.label, count: g.entries.length }));
    return out;
  }, [detail, usedBy]);

  const [activeTab, setActiveTab] = React.useState<string>("");
  React.useEffect(() => {
    setActiveTab((prev) => (tabs.some((t) => t.key === prev) ? prev : (tabs[0]?.key ?? "")));
  }, [tabs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(42rem,85vh)] max-w-2xl flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle className="pr-8 font-mono text-base leading-snug font-semibold break-words">
            {modelId != null ? `Model ${modelId}` : "Model"}
          </DialogTitle>
          <DialogDescription>
            {status === "ok"
              ? `Used by ${detail?.attachments.total ?? 0} definition${(detail?.attachments.total ?? 0) === 1 ? "" : "s"} at revision ${rev}`
              : `Model detail at revision ${rev}`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {status === "loading" ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading model…
            </div>
          ) : status === "error" ? (
            <p className="py-8 text-sm text-destructive">
              Failed to load model{error ? `: ${error}` : ""}.
            </p>
          ) : detail ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Vertices" value={detail.vertexCount.toLocaleString()} />
                <Stat label="Triangles" value={detail.faceCount.toLocaleString()} />
                <Stat label="Textured faces" value={detail.texturedFaceCount.toLocaleString()} />
                <Stat
                  label="Transparent faces"
                  value={detail.transparentFaceCount > 0 ? detail.transparentFaceCount.toLocaleString() : "none"}
                />
                <Stat label="Version" value={detail.version} />
                <Stat label="Render priority" value={detail.renderPriority} />
              </div>

              {detail.dat ? (
                <a
                  href={detail.dat}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-block font-mono text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
                >
                  Download {detail.id}.dat
                </a>
              ) : null}

              {tabs.length > 0 ? (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex min-h-0 flex-1 flex-col gap-3"
                >
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                    {tabs.map((tab) => (
                      <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                        {tab.label}
                        <Badge variant="secondary" className="tabular-nums">
                          {tab.count}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {detail.textures.length > 0 ? (
                    <TabsContent value="textures" className="min-h-0">
                      <ChipListTab
                        items={detail.textures}
                        renderChip={(textureId) => (
                          <span key={textureId} className={cn(CHIP_CLASS, "tabular-nums")}>
                            {textureId}
                          </span>
                        )}
                        resetKey="textures"
                      />
                    </TabsContent>
                  ) : null}

                  {detail.colors.length > 0 ? (
                    <TabsContent value="colors" className="min-h-0">
                      <ChipListTab
                        items={detail.colors}
                        renderChip={(packed) => (
                          <span key={packed} className={cn(CHIP_CLASS, "gap-2")}>
                            <RsColorBox width={16} height={16} packedHsl={packed} className="shrink-0 rounded-none" />
                            <span className="tabular-nums text-muted-foreground">{packed}</span>
                          </span>
                        )}
                        resetKey="colors"
                      />
                    </TabsContent>
                  ) : null}

                  {usedBy.map((group) => (
                    <TabsContent key={group.key} value={group.key} className="min-h-0">
                      <EntityRefTable
                        kind={group.key}
                        entries={group.entries}
                        onSelect={onNavigateSection ? (entry) => goTo(group.key, entry) : undefined}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : null}

              {detail.textures.length === 0 && detail.colors.length === 0 && usedBy.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No textures, colours or attachments recorded for this model.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
