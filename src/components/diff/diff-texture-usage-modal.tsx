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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { textureUsageUrl } from "@/lib/cache-api-client";

import { EntityRefTable } from "./diff-entity-ref-table";
import { ModalPagination } from "./diff-modal-pagination";
import { useModalPaging } from "./diff-modal-paging";
import { DiffModelDetailModal } from "./diff-model-detail-modal";
import { DiffModelInfoModal, MODEL_OWNER_SECTIONS } from "./diff-model-info-modal";

type NamedRef = { id: number; name: string | null };

type TextureUsagePayload = {
  id: number;
  rev: number;
  fileId: number | null;
  name: string | null;
  usage: {
    models: number[];
    overlays: number[];
    items: NamedRef[];
    npcs: NamedRef[];
    objects: NamedRef[];
    total: number;
  };
};

function readNamedRefs(raw: unknown): NamedRef[] {
  if (!Array.isArray(raw)) return [];
  const out: NamedRef[] = [];
  for (const entry of raw) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push({ id: entry, name: null });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id)) continue;
    out.push({ id, name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null });
  }
  return out;
}

function readIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function parseUsagePayload(data: unknown): TextureUsagePayload | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const usage = (o.usage ?? {}) as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    rev: Number(o.rev) || 0,
    fileId: Number.isFinite(Number(o.fileId)) ? Number(o.fileId) : null,
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null,
    usage: {
      models: readIds(usage.models),
      overlays: readIds(usage.overlays),
      items: readNamedRefs(usage.items),
      npcs: readNamedRefs(usage.npcs),
      objects: readNamedRefs(usage.objects),
      total: Number(usage.total) || 0,
    },
  };
}

/** Tab group: `section` null means the entries have no config section (models). */
type UsageGroup = {
  key: string;
  label: string;
  section: string | null;
  entries: NamedRef[];
};

function buildGroups(payload: TextureUsagePayload): UsageGroup[] {
  const u = payload.usage;
  return [
    { key: "models", label: "Models", section: null, entries: u.models.map((id) => ({ id, name: null })) },
    { key: "items", label: "Items", section: "items", entries: u.items },
    { key: "npcs", label: "NPCs", section: "npcs", entries: u.npcs },
    { key: "objects", label: "Objects", section: "objects", entries: u.objects },
    { key: "overlay", label: "Overlays", section: "overlay", entries: u.overlays.map((id) => ({ id, name: null })) },
  ];
}

/** Plain id chips, for kinds with nothing to show beyond the id. */
function IdButtonList({
  ids,
  resetKey,
  onSelect,
}: {
  ids: number[];
  resetKey: string;
  onSelect: (id: number) => void;
}) {
  const paging = useModalPaging(ids, resetKey);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {paging.items.map((id) => (
          <button
            key={id}
            type="button"
            title={`Open ${id}`}
            onClick={() => onSelect(id)}
            className="inline-flex items-center rounded-none border border-border bg-muted/30 px-2 py-1 font-mono text-xs tabular-nums hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {id}
          </button>
        ))}
      </div>
      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={ids.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}

export type DiffTextureUsageModalProps = {
  /** Texture definition id (not the sprite `fileId`). */
  textureId: number | null;
  rev: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Switch the explorer to another config section; without it entries are not clickable. */
  onNavigateSection?: (section: string) => void;
};

export function DiffTextureUsageModal({
  textureId,
  rev,
  open,
  onOpenChange,
  onNavigateSection,
}: DiffTextureUsageModalProps) {
  const { selectedCacheType } = useCacheType();
  const [payload, setPayload] = React.useState<TextureUsagePayload | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || textureId == null) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setPayload(null);
    fetch(textureUsageUrl(selectedCacheType, textureId, rev))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = parseUsagePayload(data);
        if (!parsed) throw new Error("Unexpected response");
        setPayload(parsed);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load texture usage");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, rev, selectedCacheType, textureId]);

  const groups = React.useMemo(() => (payload ? buildGroups(payload) : []), [payload]);
  const populated = React.useMemo(() => groups.filter((g) => g.entries.length > 0), [groups]);
  const [activeTab, setActiveTab] = React.useState<string>("");
  React.useEffect(() => {
    // Keep the selected tab valid as the payload (and its populated groups) change.
    setActiveTab((prev) => (populated.some((g) => g.key === prev) ? prev : (populated[0]?.key ?? "")));
  }, [populated]);

  const [modelDetailId, setModelDetailId] = React.useState<number | null>(null);
  const [definitionRef, setDefinitionRef] = React.useState<{ type: string; id: number } | null>(null);

  React.useEffect(() => {
    if (open) return;
    setModelDetailId(null);
    setDefinitionRef(null);
  }, [open]);

  /** Row click opens the modal for that entry rather than navigating away. */
  const openEntry = React.useCallback((group: UsageGroup, entry: NamedRef) => {
    if (group.key === "models") {
      setModelDetailId(entry.id);
      return;
    }
    if (group.section != null && MODEL_OWNER_SECTIONS.has(group.section)) {
      setDefinitionRef({ type: group.section, id: entry.id });
    }
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(40rem,85vh)] max-w-2xl flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle className="pr-8 font-mono text-base leading-snug font-semibold break-words">
            {textureId != null ? `Texture ${textureId}` : "Texture"}
            {payload?.name ? ` — ${payload.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {status === "ok"
              ? `${payload?.usage.total ?? 0} reference${(payload?.usage.total ?? 0) === 1 ? "" : "s"} at revision ${rev}`
              : `Usage at revision ${rev}`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {status === "loading" ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading usage…
            </div>
          ) : status === "error" ? (
            <p className="py-8 text-sm text-destructive">
              Failed to load texture usage{error ? `: ${error}` : ""}.
            </p>
          ) : populated.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              Nothing references this texture at revision {rev}.
            </p>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                {populated.map((group) => (
                  <TabsTrigger key={group.key} value={group.key} className="gap-1.5">
                    {group.label}
                    <Badge variant="secondary" className="tabular-nums">
                      {group.entries.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {populated.map((group) => (
                <TabsContent key={group.key} value={group.key} className="min-h-0">
                  {/* Models have no image or gameval, so a table would be two empty columns. */}
                  {group.key === "models" ? (
                    <IdButtonList
                      ids={group.entries.map((entry) => entry.id)}
                      resetKey={group.key}
                      onSelect={(id) => openEntry(group, { id, name: null })}
                    />
                  ) : (
                    <EntityRefTable
                      kind={group.key}
                      entries={group.entries}
                      onSelect={(entry) => openEntry(group, entry)}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
        </DialogContent>
      </Dialog>

      <DiffModelDetailModal
        modelId={modelDetailId}
        rev={rev}
        open={modelDetailId != null}
        onOpenChange={(next) => {
          if (!next) setModelDetailId(null);
        }}
        onNavigateSection={onNavigateSection}
      />

      <DiffModelInfoModal
        type={definitionRef?.type ?? "items"}
        definitionId={definitionRef?.id ?? null}
        rev={rev}
        open={definitionRef != null}
        onOpenChange={(next) => {
          if (!next) setDefinitionRef(null);
        }}
      />
    </>
  );
}
