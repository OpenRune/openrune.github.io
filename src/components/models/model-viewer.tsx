"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { RSModel } from "@/components/ui/RSModel";
import { RSTexture } from "@/components/ui/RSTexture";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  diffRevisionsUrl,
  modelDetailUrl,
  modelsTableUrl,
  parseDiffRevisionsResponse,
} from "@/lib/cache-api-client";
import {
  exportRSModel,
  type RSModelExportFormat,
} from "@/lib/model/rs-model-export-client";
import type { RSModelMesh } from "@/lib/model/rs-model-mesh";
import type { RSModelRenderMode } from "@/lib/model/rs-model-renderer";
import type { RSTextureLayer } from "@/lib/model/rs-model-source";
import { readCookie, writeCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;
const GRID_COOKIE = "openrune-model-grid";

const RENDER_MODE_OPTIONS: { value: RSModelRenderMode; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "both", label: "Solid + wireframe" },
  { value: "wireframe", label: "Wireframe" },
];

type ModelRow = {
  id: number;
  vertexCount: number;
  faceCount: number;
};

type ModelDetail = {
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

/** `404` from the models routes means "this revision has no model index", not a failure. */
class NoModelDataError extends Error {}

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function numList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

async function readJsonOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  if (res.status === 404) throw new NoModelDataError("no model data");
  throw new Error(`HTTP ${res.status}`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ModelViewer() {
  const { selectedCacheType } = useCacheType();

  const [revisions, setRevisions] = React.useState<number[]>([]);
  const [rev, setRev] = React.useState<number | null>(null);

  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [page, setPage] = React.useState(1);

  const [rows, setRows] = React.useState<ModelRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [listStatus, setListStatus] = React.useState<
    "idle" | "loading" | "ok" | "empty" | "error"
  >("idle");
  const [listError, setListError] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [detail, setDetail] = React.useState<ModelDetail | null>(null);

  const [stopRotation, setStopRotation] = React.useState(false);
  const [renderMode, setRenderMode] = React.useState<RSModelRenderMode>("solid");
  const [showColors, setShowColors] = React.useState(true);
  // Read after mount, not during render: the page is prerendered and cookies are client-only.
  const [showGrid, setShowGrid] = React.useState(false);
  const [gridPreferenceLoaded, setGridPreferenceLoaded] = React.useState(false);
  const [infoTab, setInfoTab] = React.useState("info");

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

  React.useEffect(() => {
    let cancelled = false;
    fetch(diffRevisionsUrl(selectedCacheType), { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const parsed = parseDiffRevisionsResponse(data);
        setRevisions(parsed);
        // Newest revision is the one most likely to have models published.
        setRev((prev) => (prev != null && parsed.includes(prev) ? prev : (parsed.at(-1) ?? null)));
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCacheType]);

  React.useEffect(() => {
    setShowGrid(readCookie(GRID_COOKIE) === "1");
    setGridPreferenceLoaded(true);
  }, []);

  React.useEffect(() => {
    // Skip the first pass so the default does not overwrite the stored preference.
    if (!gridPreferenceLoaded) return;
    writeCookie(GRID_COOKIE, showGrid ? "1" : "0");
  }, [gridPreferenceLoaded, showGrid]);

  React.useEffect(() => {
    setPage(1);
  }, [rev, debouncedQuery]);

  React.useEffect(() => {
    if (rev == null) return;
    let cancelled = false;
    setListStatus("loading");
    setListError(null);

    const url = modelsTableUrl(selectedCacheType, {
      rev,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      q: debouncedQuery,
    });
    fetch(url)
      .then(readJsonOrThrow)
      .then((data: unknown) => {
        if (cancelled) return;
        const o = (data ?? {}) as Record<string, unknown>;
        const raw = Array.isArray(o.rows) ? o.rows : [];
        const parsed = raw.map((entry) => {
          const r = (entry ?? {}) as Record<string, unknown>;
          return {
            id: num(r.id),
            vertexCount: num(r.vertexCount),
            faceCount: num(r.faceCount),
          };
        });
        setRows(parsed);
        setTotal(num(o.total));
        setListStatus("ok");
        setSelectedId((prev) => (prev != null ? prev : (parsed[0]?.id ?? null)));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        if (e instanceof NoModelDataError) {
          setListStatus("empty");
          return;
        }
        setListError(e instanceof Error ? e.message : "Failed to load models");
        setListStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page, rev, selectedCacheType]);

  React.useEffect(() => {
    if (rev == null || selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    fetch(modelDetailUrl(selectedCacheType, selectedId, rev))
      .then(readJsonOrThrow)
      .then((data: unknown) => {
        if (cancelled) return;
        const o = (data ?? {}) as Record<string, unknown>;
        setDetail({
          id: num(o.id),
          vertexCount: num(o.vertexCount),
          faceCount: num(o.faceCount),
          texturedFaceCount: num(o.texturedFaceCount),
          transparentFaceCount: num(o.transparentFaceCount),
          version: num(o.version),
          renderPriority: num(o.renderPriority),
          textures: numList(o.textures),
          colors: numList(o.colors),
          dat: typeof o.dat === "string" ? o.dat : null,
        });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [rev, selectedCacheType, selectedId]);

  const handleModelLoad = React.useCallback(
    (mesh: RSModelMesh, textures: RSTextureLayer[]) => {
      const id = selectedId;
      if (id == null) return;
      loadedRef.current = { id, mesh, textures };
      setExportReadyId(id);
    },
    [selectedId],
  );

  const exportModel = React.useCallback(
    async (format: RSModelExportFormat) => {
      const loaded = loadedRef.current;
      if (!loaded || loaded.id !== selectedId || exportJob) return;

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
    [exportJob, selectedId],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const revisionOptions = React.useMemo(
    () => revisions.map((r) => ({ value: String(r), label: `Revision ${r}` })).reverse(),
    [revisions],
  );

  const detailReady = detail != null && detail.id === selectedId;
  const canExport = exportReadyId != null && exportReadyId === selectedId;

  return (
    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-3">
        <CardHeader className="gap-3">
          <CardTitle>Models</CardTitle>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Revision</Label>
            <OptionDropdown
              value={rev != null ? String(rev) : ""}
              options={revisionOptions}
              onChange={(value) => {
                setRev(Number(value));
                setSelectedId(null);
              }}
              ariaLabel="Revision"
              disabled={revisionOptions.length === 0}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model-search" className="text-xs text-muted-foreground">
              Model id
            </Label>
            <Input
              id="model-search"
              inputMode="numeric"
              placeholder="Search by model id…"
              value={query}
              // Models carry no gameval or name, so id is the only usable search.
              onChange={(event) => setQuery(event.currentTarget.value.replace(/[^0-9]/g, ""))}
            />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {listStatus === "loading" && rows.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading models…
            </div>
          ) : listStatus === "empty" ? (
            <p className="py-6 text-sm text-muted-foreground">
              No model data for revision {rev}.
            </p>
          ) : listStatus === "error" ? (
            <p className="py-6 text-sm text-destructive">
              Failed to load models{listError ? `: ${listError}` : ""}.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No models match that id.</p>
          ) : (
            <ul className="max-h-[30rem] min-h-0 overflow-y-auto rounded-md border border-border">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full items-baseline justify-between gap-2 border-b border-border/60 px-2.5 py-1.5 text-left text-sm last:border-b-0 hover:bg-muted",
                      row.id === selectedId && "bg-muted font-medium",
                    )}
                  >
                    <span className="font-mono tabular-nums">{row.id}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {row.vertexCount.toLocaleString()}v · {row.faceCount.toLocaleString()}f
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {listStatus === "ok" && total > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {page} / {totalPages} · {total.toLocaleString()} models
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="xl:col-span-6">
        <CardHeader>
          <CardTitle className="font-mono">
            {selectedId != null ? `Model ${selectedId}` : "No model selected"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2">
          {selectedId != null && rev != null ? (
            <RSModel
              key={`${selectedCacheType.id}:${rev}:${selectedId}`}
              id={selectedId}
              rev={rev}
              modelUrl={detailReady ? (detail.dat ?? undefined) : undefined}
              height={520}
              className="w-full rounded-md border border-border"
              autoRotate={!stopRotation}
              // Cache models face -Z, so the camera has to sit behind them to see the front.
              initialYaw={Math.PI}
              initialPitch={0}
              renderMode={renderMode}
              showColors={showColors}
              showGrid={showGrid}
              onLoad={handleModelLoad}
            />
          ) : (
            <div className="flex h-[520px] items-center justify-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
              Pick a model from the list.
            </div>
          )}
          <p className="text-xs text-muted-foreground">Drag to orbit, scroll to zoom.</p>
        </CardContent>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <section className="space-y-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              View
            </p>

            <label
              htmlFor="stop-rotation"
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                id="stop-rotation"
                type="checkbox"
                className="size-4 accent-primary"
                checked={stopRotation}
                onChange={(event) => setStopRotation(event.currentTarget.checked)}
              />
              Stop rotation
            </label>

            <label htmlFor="show-colors" className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                id="show-colors"
                type="checkbox"
                className="size-4 accent-primary"
                checked={!showColors}
                onChange={(event) => setShowColors(!event.currentTarget.checked)}
              />
              Remove colours
            </label>

            <label htmlFor="show-grid" className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                id="show-grid"
                type="checkbox"
                className="size-4 accent-primary"
                checked={showGrid}
                onChange={(event) => setShowGrid(event.currentTarget.checked)}
              />
              Show grid
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mesh</Label>
              <OptionDropdown
                value={renderMode}
                options={RENDER_MODE_OPTIONS}
                onChange={(value) => setRenderMode(value as RSModelRenderMode)}
                ariaLabel="Mesh display"
              />
            </div>
          </section>

          <section className="space-y-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Export
            </p>
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
          </section>

          <Tabs value={infoTab} onValueChange={setInfoTab} className="flex flex-col gap-3">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="colors" className="gap-1.5">
                Colours
                <Badge variant="secondary" className="tabular-nums">
                  {detailReady ? detail.colors.length : 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="textures" className="gap-1.5">
                Textures
                <Badge variant="secondary" className="tabular-nums">
                  {detailReady ? detail.textures.length : 0}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="min-h-0">
              {detailReady ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Vertices" value={detail.vertexCount.toLocaleString()} />
                    <Stat label="Triangles" value={detail.faceCount.toLocaleString()} />
                    <Stat
                      label="Texture triangles"
                      value={detail.texturedFaceCount.toLocaleString()}
                    />
                    <Stat
                      label="Transparent faces"
                      value={
                        detail.transparentFaceCount > 0
                          ? detail.transparentFaceCount.toLocaleString()
                          : "none"
                      }
                    />
                    <Stat label="Version" value={detail.version} />
                    <Stat label="Render priority" value={detail.renderPriority} />
                  </div>
                  {detail.dat ? (
                    <a
                      href={detail.dat}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Download {detail.id}.dat
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No model selected.</p>
              )}
            </TabsContent>

            <TabsContent value="colors" className="min-h-0">
              {detailReady && detail.colors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.colors.map((packed) => (
                    <span
                      key={packed}
                      className="inline-flex items-center gap-2 rounded-none border border-border bg-muted/30 px-2 py-1 font-mono text-xs"
                    >
                      <RsColorBox
                        width={16}
                        height={16}
                        packedHsl={packed}
                        className="shrink-0 rounded-none"
                      />
                      <span className="tabular-nums text-muted-foreground">{packed}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No colours on this model.</p>
              )}
            </TabsContent>

            <TabsContent value="textures" className="min-h-0">
              {detailReady && detail.textures.length > 0 && rev != null ? (
                <div className="flex flex-wrap gap-2">
                  {detail.textures.map((textureId) => (
                    <div
                      key={textureId}
                      className="flex flex-col items-center gap-1 border border-border bg-muted/20 p-1.5"
                    >
                      <RSTexture
                        combinedDiffSprite
                        textureDefinitionId={textureId}
                        rev={rev}
                        base={1}
                        width={56}
                        height={56}
                        keepAspectRatio
                        enableClickModel
                      />
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {textureId}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No textures on this model.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-none border border-border bg-muted/20 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}
