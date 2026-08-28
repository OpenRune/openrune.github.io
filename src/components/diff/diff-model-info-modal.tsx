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
import { RSTexture } from "@/components/ui/RSTexture";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { modelsForDefinitionUrl } from "@/lib/cache-api-client";

import { ModalPagination } from "./diff-modal-pagination";
import { useModalPaging } from "./diff-modal-paging";
import { cn } from "@/lib/utils";

/** Config types that reference models; matches the server's `/models/for/{type}/{id}`. */
export const MODEL_OWNER_SECTIONS = new Set(["items", "npcs", "objects"]);

type ModelEntry = {
  id: number;
  vertexCount: number;
  faceCount: number;
  texturedFaceCount: number;
  transparentFaceCount: number;
  version: number;
  renderPriority: number;
  textures: number[];
  colors: number[];
  dat: string | null;
};

type ModelsForDefinition = {
  type: string;
  id: number;
  rev: number;
  name: string | null;
  modelIds: number[];
  models: ModelEntry[];
  totals: {
    models: number;
    missingModels: number;
    vertexCount: number;
    faceCount: number;
    texturedFaceCount: number;
    transparentFaceCount: number;
    textures: TextureRef[];
    colors: number[];
  };
};

/** Texture id plus the sprite it renders, so the table can show an image and a gameval. */
type TextureRef = { id: number; fileId: number | null; name: string | null };

function textureRefs(raw: unknown): TextureRef[] {
  if (!Array.isArray(raw)) return [];
  const out: TextureRef[] = [];
  for (const entry of raw) {
    // Tolerate the older plain-id shape.
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push({ id: entry, fileId: null, name: null });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id)) continue;
    const fileId = Number(o.fileId);
    out.push({
      id,
      fileId: Number.isFinite(fileId) ? fileId : null,
      name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null,
    });
  }
  return out;
}

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function numList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function parsePayload(data: unknown): ModelsForDefinition | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const totals = (o.totals ?? {}) as Record<string, unknown>;
  const models = Array.isArray(o.models) ? o.models : [];
  return {
    type: String(o.type ?? ""),
    id,
    rev: num(o.rev),
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null,
    modelIds: numList(o.modelIds),
    models: models.map((raw) => {
      const m = (raw ?? {}) as Record<string, unknown>;
      return {
        id: num(m.id),
        vertexCount: num(m.vertexCount),
        faceCount: num(m.faceCount),
        texturedFaceCount: num(m.texturedFaceCount),
        transparentFaceCount: num(m.transparentFaceCount),
        version: num(m.version),
        renderPriority: num(m.renderPriority),
        textures: numList(m.textures),
        colors: numList(m.colors),
        dat: typeof m.dat === "string" ? m.dat : null,
      };
    }),
    totals: {
      models: num(totals.models),
      missingModels: num(totals.missingModels),
      vertexCount: num(totals.vertexCount),
      faceCount: num(totals.faceCount),
      texturedFaceCount: num(totals.texturedFaceCount),
      transparentFaceCount: num(totals.transparentFaceCount),
      textures: textureRefs(totals.textures),
      colors: numList(totals.colors),
    },
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

function ModelListTab({ models }: { models: ModelEntry[] }) {
  const paging = useModalPaging(models, "models");
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {paging.items.map((model) => (
          <div
            key={model.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-none border border-border bg-muted/20 px-2.5 py-1.5 font-mono text-xs"
          >
            <span className="tabular-nums font-semibold">{model.id}</span>
            <span className="text-muted-foreground">{model.vertexCount} verts</span>
            <span className="text-muted-foreground">{model.faceCount} tris</span>
            {model.texturedFaceCount > 0 ? (
              <span className="text-muted-foreground">{model.texturedFaceCount} textured</span>
            ) : null}
            {model.transparentFaceCount > 0 ? (
              <span className="text-muted-foreground">{model.transparentFaceCount} transparent</span>
            ) : null}
            {model.dat ? (
              <a
                href={model.dat}
                className="ml-auto underline underline-offset-2 hover:text-foreground"
                target="_blank"
                rel="noreferrer"
              >
                .dat
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={models.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}

function TextureTableTab({ textures, rev }: { textures: TextureRef[]; rev: number }) {
  const paging = useModalPaging(textures, "textures");
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-16 text-xs">Image</TableHead>
            <TableHead className="h-8 w-20 text-xs">ID</TableHead>
            <TableHead className="h-8 text-xs">Gameval</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paging.items.map((texture) => (
            <TableRow key={texture.id}>
              <TableCell className="py-1.5">
                <div className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-none border border-border bg-muted/30">
                  {texture.fileId != null ? (
                    <RSTexture
                      id={texture.fileId}
                      textureDefinitionId={texture.id}
                      gameval={texture.name ?? undefined}
                      gamevalRevision={rev}
                      width={24}
                      height={24}
                      base={1}
                      rev={rev}
                      combinedDiffSprite
                      keepAspectRatio
                      fitMax
                      fillCell
                      className="absolute inset-0 h-full w-full"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-1.5 font-mono text-xs tabular-nums">{texture.id}</TableCell>
              <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                {texture.name ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={textures.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}

function ColorListTab({ colors }: { colors: number[] }) {
  const paging = useModalPaging(colors, "colors");
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {paging.items.map((packed) => (
          <span key={packed} className={cn(CHIP_CLASS, "gap-2")}>
            <RsColorBox width={16} height={16} packedHsl={packed} className="shrink-0 rounded-none" />
            <span className="tabular-nums text-muted-foreground">{packed}</span>
          </span>
        ))}
      </div>
      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={colors.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}

export type DiffModelInfoModalProps = {
  /** Config section the definition belongs to (`items` / `npcs` / `objects`). */
  type: string;
  /** Definition id, or null when closed. */
  definitionId: number | null;
  rev: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DiffModelInfoModal({
  type,
  definitionId,
  rev,
  open,
  onOpenChange,
}: DiffModelInfoModalProps) {
  const { selectedCacheType } = useCacheType();
  const [payload, setPayload] = React.useState<ModelsForDefinition | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || definitionId == null) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setPayload(null);
    fetch(modelsForDefinitionUrl(selectedCacheType, type, definitionId, rev))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = parsePayload(data);
        if (!parsed) throw new Error("Unexpected response");
        setPayload(parsed);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load model info");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [definitionId, open, rev, selectedCacheType, type]);

  const totals = payload?.totals;
  const textures = totals?.textures ?? [];
  const colors = totals?.colors ?? [];

  /** Only kinds with data get a tab. */
  const tabs = React.useMemo(() => {
    const out: { key: string; label: string; count: number }[] = [];
    if (payload && payload.models.length > 0) {
      out.push({ key: "models", label: "Models", count: payload.models.length });
    }
    if (textures.length > 0) out.push({ key: "textures", label: "Textures", count: textures.length });
    if (colors.length > 0) out.push({ key: "colors", label: "Colours", count: colors.length });
    return out;
  }, [colors.length, payload, textures.length]);

  const [activeTab, setActiveTab] = React.useState<string>("");
  React.useEffect(() => {
    setActiveTab((prev) => (tabs.some((t) => t.key === prev) ? prev : (tabs[0]?.key ?? "")));
  }, [tabs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(42rem,85vh)] max-w-2xl flex-col gap-0 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle className="pr-8 font-mono text-base leading-snug font-semibold break-words">
            {definitionId != null ? `${type} ${definitionId}` : "Model info"}
            {payload?.name ? ` — ${payload.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            {status === "ok"
              ? `${totals?.models ?? 0} model${(totals?.models ?? 0) === 1 ? "" : "s"} at revision ${rev}` +
                (totals && totals.missingModels > 0 ? ` (${totals.missingModels} with no metadata)` : "")
              : `Model info at revision ${rev}`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {status === "loading" ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading model info…
            </div>
          ) : status === "error" ? (
            <p className="py-8 text-sm text-destructive">
              Failed to load model info{error ? `: ${error}` : ""}.
            </p>
          ) : !payload || payload.modelIds.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No models referenced.</p>
          ) : payload.models.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No model data for this revision.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Models" value={totals?.models ?? 0} />
                <Stat label="Vertices" value={(totals?.vertexCount ?? 0).toLocaleString()} />
                <Stat label="Triangles" value={(totals?.faceCount ?? 0).toLocaleString()} />
                <Stat label="Textured faces" value={(totals?.texturedFaceCount ?? 0).toLocaleString()} />
                <Stat
                  label="Transparent faces"
                  value={
                    (totals?.transparentFaceCount ?? 0) > 0
                      ? (totals?.transparentFaceCount ?? 0).toLocaleString()
                      : "none"
                  }
                />
                <Stat label="Unique textures" value={totals?.textures.length ?? 0} />
              </div>

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

                <TabsContent value="models" className="min-h-0">
                  <ModelListTab models={payload.models} />
                </TabsContent>

                {textures.length > 0 ? (
                  <TabsContent value="textures" className="min-h-0">
                    <TextureTableTab textures={textures} rev={rev} />
                  </TabsContent>
                ) : null}

                {colors.length > 0 ? (
                  <TabsContent value="colors" className="min-h-0">
                    <ColorListTab colors={colors} />
                  </TabsContent>
                ) : null}
              </Tabs>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
