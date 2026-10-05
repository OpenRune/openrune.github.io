"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSModel } from "@/components/ui/RSModel";
import { RSTexture } from "@/components/ui/RSTexture";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { modelsForDefinitionUrl } from "@/lib/cache-api-client";
import { downloadBlob } from "@/lib/download-blob";
import { exportRSModel, type RSModelExportFormat } from "@/lib/model/rs-model-export-client";
import type { RSModelMesh } from "@/lib/model/rs-model-mesh";
import type { RSTextureLayer } from "@/lib/model/rs-model-source";

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
  /** Snapshot fields that point at this model, e.g. `inventoryModel` or `models[2]`. */
  fields: string[];
};

/** One `find -> replace` entry; `to` is null when the replacement list is shorter than the find list. */
type ColourSwap = { from: number; to: number | null };
type TextureSwap = { from: TextureRef | null; to: TextureRef | null };

type ModelsForDefinition = {
  type: string;
  id: number;
  rev: number;
  name: string | null;
  modelIds: number[];
  models: ModelEntry[];
  recolours: ColourSwap[];
  retextures: TextureSwap[];
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

function optionalNum(raw: unknown): number | null {
  const n = Number(raw);
  return raw != null && Number.isFinite(n) ? n : null;
}

function colourSwaps(raw: unknown): ColourSwap[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const from = optionalNum(o.from);
    return from == null ? [] : [{ from, to: optionalNum(o.to) }];
  });
}

function textureSwaps(raw: unknown): TextureSwap[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    return {
      from: textureRefs([o.from])[0] ?? null,
      to: textureRefs([o.to])[0] ?? null,
    };
  });
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
        fields: Array.isArray(m.fields) ? m.fields.filter((f): f is string => typeof f === "string") : [],
      };
    }),
    recolours: colourSwaps(o.recolours),
    retextures: textureSwaps(o.retextures),
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

/**
 * Draws one of the definition's models. A definition usually references more than one (an item has
 * a ground model and a worn model, an npc has a model per body part), so the ids are selectable
 * rather than rendering all of them at once.
 */
function ModelRenderTab({ models, rev }: { models: ModelEntry[]; rev: number }) {
  const [pickedId, setPickedId] = React.useState<number | null>(null);
  const [stopRotation, setStopRotation] = React.useState(false);
  const active = models.find((m) => m.id === pickedId) ?? models[0];
  const activeId = active?.id ?? null;

  /** Kept so exports use exactly the geometry and textures currently on screen. */
  const loadedRef = React.useRef<{
    id: number;
    mesh: RSModelMesh;
    textures: RSTextureLayer[];
  } | null>(null);
  const [exportReadyId, setExportReadyId] = React.useState<number | null>(null);
  const [exportJob, setExportJob] = React.useState<{
    format: RSModelExportFormat;
    progress: number;
  } | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const handleModelLoad = React.useCallback(
    (mesh: RSModelMesh, textures: RSTextureLayer[]) => {
      if (activeId == null) return;
      loadedRef.current = { id: activeId, mesh, textures };
      setExportReadyId(activeId);
    },
    [activeId],
  );

  const exportModel = React.useCallback(
    async (format: RSModelExportFormat) => {
      const loaded = loadedRef.current;
      if (!loaded || loaded.id !== activeId || exportJob) return;
      setExportError(null);
      setExportJob({ format, progress: 0 });
      try {
        const { blob, filename } = await exportRSModel({
          mesh: loaded.mesh,
          textures: loaded.textures,
          modelId: loaded.id,
          format,
          onProgress: (progress) => setExportJob({ format, progress }),
        });
        downloadBlob(blob, filename);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Export failed");
      } finally {
        setExportJob(null);
      }
    },
    [activeId, exportJob],
  );

  // Only the model actually on screen can be exported, so switching models disarms the buttons
  // until the new one has decoded.
  const canExport = exportReadyId != null && exportReadyId === activeId;

  if (!active) return null;

  return (
    <div className="flex flex-col gap-2">
      {models.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setPickedId(model.id)}
              className={cn(
                CHIP_CLASS,
                "transition-colors hover:bg-muted/60",
                model.id === active.id && "border-primary bg-primary/10 text-foreground",
              )}
              aria-pressed={model.id === active.id}
              title={`Model ${model.id}`}
            >
              {model.fields.length > 0 ? modelFieldLabel(model.fields[0]!) : String(model.id)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <RSModel
          // Remount per model so the camera and decoded mesh reset together.
          key={`${rev}:${active.id}`}
          id={active.id}
          rev={rev}
          modelUrl={active.dat ?? undefined}
          height={320}
          className="w-full rounded-none border border-border"
          autoRotate={!stopRotation}
          // Cache models face -Z, so the camera has to sit behind them to see the front.
          initialYaw={Math.PI}
          initialPitch={0}
          onLoad={handleModelLoad}
        />
        <label
          htmlFor="model-info-stop-rotation"
          className="absolute top-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm"
        >
          <input
            id="model-info-stop-rotation"
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={stopRotation}
            onChange={(event) => setStopRotation(event.currentTarget.checked)}
          />
          Stop rotation
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
        <span>
          Model {active.id} · {active.vertexCount.toLocaleString()} verts ·{" "}
          {active.faceCount.toLocaleString()} tris
        </span>
        <span className="font-sans">Drag to orbit, scroll to zoom.</span>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={!canExport || exportJob != null}
          onClick={() => void exportModel("obj")}
        >
          <Download className="size-3.5" aria-hidden />
          OBJ
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={!canExport || exportJob != null}
          onClick={() => void exportModel("glb")}
        >
          <Download className="size-3.5" aria-hidden />
          glTF
        </Button>
      </div>

      {exportJob ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Exporting {exportJob.format.toUpperCase()}…</span>
            <span className="tabular-nums">{Math.round(exportJob.progress * 100)}%</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(exportJob.progress * 100)}
            aria-label={`Exporting ${exportJob.format.toUpperCase()}`}
          >
            <div
              className="h-full bg-primary transition-[width] duration-150"
              style={{ width: `${Math.round(exportJob.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {exportError ? <p className="text-[11px] text-destructive">{exportError}</p> : null}
    </div>
  );
}

/** Prose, not a cache field name, so no mono — and small enough to sit several to a table cell. */
const FIELD_CHIP_CLASS =
  "inline-flex items-center rounded-none border border-border bg-muted/30 px-1.5 py-0.5 text-[11px]";

/** Cache field names are not presentable; `maleModel1` reads better as "Male 2". */
const MODEL_FIELD_LABELS: Record<string, string> = {
  inventoryModel: "Inventory",
  maleModel: "Male",
  femaleModel: "Female",
  maleHeadModel: "Male head",
  femaleHeadModel: "Female head",
  models: "Model",
  chatheadModels: "Chathead",
  objectModels: "Object",
};

/**
 * `maleModel1` → "Male 2", `models[2]` → "Model 3", so the slot number matches how the field reads
 * in game terms (1-based) rather than its array index. Unknown fields pass through unchanged.
 */
function modelFieldLabel(field: string): string {
  const arrayMatch = /^([A-Za-z]+)\[(\d+)]$/.exec(field);
  if (arrayMatch) {
    const base = MODEL_FIELD_LABELS[arrayMatch[1]!] ?? arrayMatch[1]!;
    return `${base} ${Number.parseInt(arrayMatch[2]!, 10) + 1}`;
  }
  const suffixMatch = /^([A-Za-z]+?)(\d+)$/.exec(field);
  if (suffixMatch) {
    const base = MODEL_FIELD_LABELS[suffixMatch[1]!];
    if (base) return `${base} ${Number.parseInt(suffixMatch[2]!, 10) + 1}`;
  }
  return MODEL_FIELD_LABELS[field] ?? field;
}

function ModelListTab({ models }: { models: ModelEntry[] }) {
  const paging = useModalPaging(models, "models");
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-20 text-xs">Model</TableHead>
            <TableHead className="h-8 text-xs">Used as</TableHead>
            <TableHead className="h-8 w-20 text-right text-xs">Verts</TableHead>
            <TableHead className="h-8 w-20 text-right text-xs">Tris</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paging.items.map((model) => (
            <TableRow key={model.id}>
              <TableCell className="py-1.5 font-mono text-xs tabular-nums">
                {model.dat ? (
                  <a
                    href={model.dat}
                    className="underline underline-offset-2 hover:text-foreground"
                    target="_blank"
                    rel="noreferrer"
                    title={`Download ${model.id}.dat`}
                  >
                    {model.id}
                  </a>
                ) : (
                  model.id
                )}
              </TableCell>
              <TableCell className="py-1.5">
                {model.fields.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {model.fields.map((field) => (
                      <span key={field} className={FIELD_CHIP_CLASS} title={field}>
                        {modelFieldLabel(field)}
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {model.vertexCount.toLocaleString()}
              </TableCell>
              <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {model.faceCount.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

/**
 * Textures and colours are both "what this model is painted with" and are usually a handful each,
 * so they share one tab rather than splitting a short list across two.
 */
function MaterialsTab({
  textures,
  colors,
  recolours,
  retextures,
  rev,
}: {
  textures: TextureRef[];
  colors: number[];
  recolours: ColourSwap[];
  retextures: TextureSwap[];
  rev: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {recolours.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Recolours — the definition swaps these on its models</SectionLabel>
          <SwapTable
            rows={recolours.map((swap) => ({
              key: `${swap.from}:${swap.to}`,
              from: <ColorCell packed={swap.from} />,
              to: swap.to == null ? null : <ColorCell packed={swap.to} />,
            }))}
          />
        </section>
      ) : null}

      {retextures.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Retextures</SectionLabel>
          <SwapTable
            rows={retextures.map((swap, index) => ({
              key: `${swap.from?.id ?? "?"}:${swap.to?.id ?? "?"}:${index}`,
              from: <TextureCell texture={swap.from} rev={rev} />,
              to: swap.to == null ? null : <TextureCell texture={swap.to} rev={rev} />,
            }))}
          />
        </section>
      ) : null}

      {textures.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Textures on the models</SectionLabel>
          <TextureTable textures={textures} rev={rev} />
        </section>
      ) : null}

      {colors.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Original model colours</SectionLabel>
          <ColorList colors={colors} />
        </section>
      ) : null}
    </div>
  );
}

/** `original -> replacement` rows, shared by the recolour and retexture sections. */
function SwapTable({ rows }: { rows: { key: string; from: React.ReactNode; to: React.ReactNode }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 text-xs">Original</TableHead>
          <TableHead className="h-8 w-8 text-xs" aria-label="becomes" />
          <TableHead className="h-8 text-xs">Replacement</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="py-1.5">{row.from}</TableCell>
            <TableCell className="py-1.5 text-center text-xs text-muted-foreground" aria-hidden>
              →
            </TableCell>
            <TableCell className="py-1.5">
              {row.to ?? <span className="text-xs text-muted-foreground">unchanged</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ColorCell({ packed }: { packed: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs">
      <RsColorBox width={16} height={16} packedHsl={packed} className="shrink-0 rounded-none" />
      <span className="tabular-nums text-muted-foreground">{packed}</span>
    </span>
  );
}

function TextureCell({ texture, rev }: { texture: TextureRef | null; rev: number }) {
  if (!texture) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs">
      <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-none border border-border bg-muted/30">
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
      </span>
      <span className="tabular-nums">{texture.id}</span>
      {texture.name ? <span className="truncate text-muted-foreground">{texture.name}</span> : null}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function TextureTable({ textures, rev }: { textures: TextureRef[]; rev: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 w-16 text-xs">Image</TableHead>
          <TableHead className="h-8 w-20 text-xs">ID</TableHead>
          <TableHead className="h-8 text-xs">Gameval</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {textures.map((texture) => (
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
  );
}

function ColorList({ colors }: { colors: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((packed) => (
        <span key={packed} className={cn(CHIP_CLASS, "gap-2")}>
          <RsColorBox width={16} height={16} packedHsl={packed} className="shrink-0 rounded-none" />
          <span className="tabular-nums text-muted-foreground">{packed}</span>
        </span>
      ))}
    </div>
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

export function DiffModelInfoModal({ type, definitionId, rev, open, onOpenChange }: DiffModelInfoModalProps) {
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
  const recolours = payload?.recolours ?? [];
  const retextures = payload?.retextures ?? [];
  const materialsCount = textures.length + colors.length + recolours.length + retextures.length;

  /** Only kinds with data get a tab. The list stays first, so opening the modal costs no WebGL. */
  const tabs = React.useMemo(() => {
    const out: { key: string; label: string; count: number }[] = [];
    if (payload && payload.models.length > 0) {
      out.push({
        key: "models",
        label: "Models",
        count: payload.models.length,
      });
      out.push({
        key: "render",
        label: "Render",
        count: payload.models.length,
      });
    }
    if (materialsCount > 0) {
      out.push({
        key: "materials",
        label: textures.length === 0 && recolours.length === 0 ? "Colours" : "Materials",
        count: materialsCount,
      });
    }
    return out;
  }, [colors.length, materialsCount, payload, recolours.length, textures.length]);

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

                <TabsContent value="render" className="min-h-0">
                  <ModelRenderTab models={payload.models} rev={rev} />
                </TabsContent>

                {materialsCount > 0 ? (
                  <TabsContent value="materials" className="min-h-0">
                    <MaterialsTab
                      textures={textures}
                      colors={colors}
                      recolours={payload.recolours}
                      retextures={payload.retextures}
                      rev={rev}
                    />
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
