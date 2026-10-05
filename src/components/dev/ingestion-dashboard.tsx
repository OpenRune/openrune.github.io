"use client";

import * as React from "react";
import { Loader2, Pause, Play, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCacheType } from "@/context/cache-type-context";
import {
  adminFetch,
  readAdminToken,
  writeAdminToken,
  type AdminCache,
  type AdminDb,
  type AdminMemory,
  type AdminMetrics,
  type AdminOverview,
  type AdminRevision,
  type AdminRun,
} from "@/lib/admin-api";
import { formatBinarySize, formatDateTime, formatNumber } from "@/lib/formatting";

const REFRESH_MS = 5_000;

const STATUS_STYLE: Record<string, string> = {
  READY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/15 text-red-600 dark:text-red-400",
  DISCOVERED: "bg-muted text-muted-foreground",
};

function statusClass(status: string): string {
  return STATUS_STYLE[status] ?? "bg-sky-500/15 text-sky-600 dark:text-sky-400";
}

function durationLabel(metrics: Record<string, unknown> | null): string {
  const ms = metrics?.durationMs;
  if (typeof ms !== "number") return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function countsLabel(metrics: Record<string, unknown> | null): string {
  if (!metrics) return "—";
  const added = metrics.added;
  const changed = metrics.changed;
  const removed = metrics.removed;
  if (typeof added !== "number" || typeof changed !== "number" || typeof removed !== "number") return "—";
  return `+${formatNumber(added)} ~${formatNumber(changed)} -${formatNumber(removed)}`;
}

export function IngestionDashboard() {
  const { selectedCacheType } = useCacheType();
  const [token, setToken] = React.useState("");
  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [revisions, setRevisions] = React.useState<AdminRevision[]>([]);
  const [runs, setRuns] = React.useState<AdminRun[]>([]);
  const [metrics, setMetrics] = React.useState<AdminMetrics | null>(null);
  const [db, setDb] = React.useState<AdminDb | null>(null);
  const [memory, setMemory] = React.useState<AdminMemory | null>(null);
  const [cache, setCache] = React.useState<AdminCache | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showAllRevisions, setShowAllRevisions] = React.useState(false);
  const hasToken = token.trim().length > 0;

  React.useEffect(() => {
    setToken(readAdminToken());
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [o, r, runList, m, d, mem, c] = await Promise.all([
        adminFetch<AdminOverview>(selectedCacheType, "/overview", token),
        adminFetch<{ revisions: AdminRevision[] }>(selectedCacheType, "/revisions", token),
        adminFetch<{ runs: AdminRun[] }>(selectedCacheType, "/runs?limit=30", token),
        adminFetch<AdminMetrics>(selectedCacheType, "/metrics", token),
        adminFetch<AdminDb>(selectedCacheType, "/db", token),
        adminFetch<AdminMemory>(selectedCacheType, "/memory", token),
        adminFetch<AdminCache>(selectedCacheType, "/cache", token),
      ]);
      setOverview(o);
      setRevisions(r.revisions);
      setRuns(runList.runs);
      setMetrics(m);
      setDb(d);
      setMemory(mem);
      setCache(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [selectedCacheType, token]);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = async (path: string) => {
    try {
      await adminFetch(selectedCacheType, path, token, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const visibleRevisions = React.useMemo(() => {
    const sorted = [...revisions].sort((a, b) => b.rev - a.rev);
    return showAllRevisions ? sorted : sorted.slice(0, 25);
  }, [revisions, showAllRevisions]);

  const httpTimers = React.useMemo(
    () =>
      Object.entries(metrics?.timers ?? {})
        .filter(([name]) => name.startsWith("http "))
        .sort((a, b) => b[1].totalMs - a[1].totalMs)
        .slice(0, 20),
    [metrics],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Ingestion</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-56"
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                writeAdminToken(e.target.value);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
            {overview ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void act(overview.workerPaused ? "/worker/resume" : "/worker/pause")}
              >
                {overview.workerPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
                {overview.workerPaused ? "Resume worker" : "Pause worker"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {overview ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Game" value={`${overview.game.name} (${overview.game.environment.toLowerCase()})`} />
              <Stat label="Latest published" value={overview.latestPublished ?? "—"} />
              <Stat label="Latest discovered" value={overview.latestDiscovered ?? "—"} />
              <Stat label="Published revisions" value={overview.published} />
            </div>
          ) : null}
          {overview?.ingestion ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  Ingesting rev <strong>{overview.ingestion.rev}</strong> · {overview.ingestion.stage}
                </span>
                <span>{overview.ingestion.percent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${overview.ingestion.percent}%` }} />
              </div>
              <p className="mt-1 text-muted-foreground">{overview.ingestion.message}</p>
            </div>
          ) : overview ? (
            <p className="text-sm text-muted-foreground">No ingestion running. Published revisions stay available while new ones are processed.</p>
          ) : null}

          {overview?.backfill ? (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  Backfill · <strong>{overview.backfill.done.length}</strong> of{" "}
                  <strong>{overview.backfill.total}</strong> done
                  {overview.backfill.failed.length > 0 ? (
                    <span className="text-destructive"> · {overview.backfill.failed.length} failed</span>
                  ) : null}
                </span>
                <span>{overview.backfill.pending.length} queued</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{
                    width: `${overview.backfill.total === 0 ? 0 : Math.round(((overview.backfill.done.length + overview.backfill.failed.length) / overview.backfill.total) * 100)}%`,
                  }}
                />
              </div>
              {overview.backfill.pausedFor != null ? (
                <p className="mt-1 text-amber-600 dark:text-amber-400">
                  Paused for newly released revision {overview.backfill.pausedFor}; the queue resumes after it.
                </p>
              ) : overview.backfill.pending.length === 0 ? (
                // Everything is imported and queryable; the run is uploading assets before it ends.
                <p className="mt-1 text-muted-foreground">
                  All revisions imported. Uploading sprites, textures and models to the CDN — the
                  data is already live.
                </p>
              ) : (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Next: {overview.backfill.pending.slice(0, 12).join(", ") || "—"}
                  {overview.backfill.pending.length > 12 ? ` … +${overview.backfill.pending.length - 12}` : ""}
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Revisions</CardTitle>
          {revisions.length > 25 ? (
            <Button variant="ghost" size="sm" onClick={() => setShowAllRevisions((v) => !v)}>
              {showAllRevisions ? "Show latest 25" : `Show all ${revisions.length}`}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rev</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Changes</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRevisions.map((r) => (
                <TableRow key={r.rev}>
                  <TableCell className="font-mono">{r.rev}</TableCell>
                  <TableCell>
                    <Badge className={statusClass(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.stage ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.publishedAt ? formatDateTime(r.publishedAt) : "—"}</TableCell>
                  <TableCell>{durationLabel(r.metrics)}</TableCell>
                  <TableCell className="font-mono text-xs">{countsLabel(r.metrics)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.sourceCacheId ?? "—"}
                    {r.latestSourceCacheId != null && r.sourceCacheId != null && r.latestSourceCacheId !== r.sourceCacheId ? (
                      <span className="ml-1 text-amber-500" title={`Newer build ${r.latestSourceCacheId} available on OpenRS2`}>
                        ↑{r.latestSourceCacheId}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.attempts}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => void act(`/revisions/${r.rev}/ingest`)}>
                      {r.published ? "Re-ingest" : "Ingest"}
                    </Button>
                    {r.error ? (
                      <p className="max-w-xs truncate text-xs text-red-500" title={r.error}>
                        {r.error}
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rev</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono">{run.rev}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(run.startedAt)}</TableCell>
                    <TableCell>
                      <Badge className={statusClass(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell>{durationLabel(run.metrics)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-red-500" title={run.error ?? undefined}>
                      {run.error ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Heap, pools and table sizes all come from token-only endpoints, so without one this
            card is an empty shell. Hide it rather than show empty headings. */}
        {hasToken ? (
        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {memory ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Heap used" value={`${memory.heapUsedMb} MB`} />
                <Stat label="Heap peak" value={`${memory.heapPeakMb} MB`} />
                <Stat label="Heap max" value={`${memory.heapMaxMb} MB`} />
                <Stat label="Threads" value={memory.threads} />
              </div>
            ) : null}
            {cache ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Cache entries" value={cache.entries} />
                <Stat label="Cache hit rate" value={`${(cache.hitRate * 100).toFixed(1)}%`} />
              </div>
            ) : null}
            {db ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(db.pools).map(([name, pool]) => (
                    <Stat key={name} label={`Pool ${name}`} value={`${pool.active ?? 0} active / ${pool.total ?? 0} total`} />
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead className="text-right">Rows (est.)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {db.tables.slice(0, 8).map((t) => (
                      <TableRow key={t.table}>
                        <TableCell className="font-mono text-xs">{t.table}</TableCell>
                        <TableCell className="text-right">{formatBinarySize(t.bytes)}</TableCell>
                        <TableCell className="text-right">{formatNumber(t.estimatedRows)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </CardContent>
        </Card>
        ) : null}
      </div>

      {/* Both are fed by /admin/metrics, which needs the token; without one they are empty tables. */}
      {hasToken ? (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Slowest endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Avg ms</TableHead>
                  <TableHead className="text-right">Max ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {httpTimers.map(([name, t]) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-xs">{name.replace(/^http /, "")}</TableCell>
                    <TableCell className="text-right">{formatNumber(t.count)}</TableCell>
                    <TableCell className="text-right">{t.avgMs.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{t.maxMs.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slow operations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(metrics?.slow ?? []).slice(0, 15).map((s, i) => (
                  <TableRow key={`${s.at}-${i}`}>
                    <TableCell className="text-muted-foreground">{formatDateTime(new Date(s.at).toISOString())}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.name} <span className="text-muted-foreground">{s.detail}</span>
                    </TableCell>
                    <TableCell className="text-right">{s.ms.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
