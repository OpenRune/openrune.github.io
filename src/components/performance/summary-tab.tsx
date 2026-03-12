"use client";

import * as React from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMebibytes, formatNanosecondsToMs, formatNumber } from "@/lib/formatting";
import type { PerformanceSnapshot, ProcessedFrame } from "@/lib/types/performance";

type SummaryTabProps = {
  frames: ProcessedFrame[];
  snapshot: PerformanceSnapshot | null;
  title?: string;
};

type TimingEntry = {
  name: string;
  averageNs: number;
  share: number;
};

function generateColorPalette(baseColor: string, count: number): string[] {
  const hexToHsl = (hex: string) => {
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };
  const hslToHex = (h: number, s: number, l: number) => {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;
    let r: number;
    let g: number;
    let b: number;
    if (sNorm === 0) {
      r = lNorm; g = lNorm; b = lNorm;
    } else {
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }
    const toHex = (value: number) => {
      const hex = Math.round(value * 255).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };
  if (count <= 1) return [baseColor];
  const base = hexToHsl(baseColor);
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const hueShift = (ratio - 0.5) * 60;
    const hue = (base.h + hueShift + 360) % 360;
    const saturation = Math.min(100, base.s + (ratio < 0.5 ? ratio * 20 : (1 - ratio) * 20));
    const lightness = Math.max(20, Math.min(80, base.l + (ratio < 0.5 ? -ratio * 15 : -(1 - ratio) * 15)));
    return hslToHex(hue, saturation, lightness);
  });
}

function summarizeTimings(frames: ProcessedFrame[], type: "cpu" | "gpu"): TimingEntry[] {
  const totals = new Map<string, number>();
  let totalNs = 0;

  for (const frame of frames) {
    const timingGroup = type === "cpu" ? frame.cpu : frame.gpu;
    for (const [key, value] of Object.entries(timingGroup ?? {})) {
      const safeValue = Number.isFinite(value) ? value : 0;
      totals.set(key, (totals.get(key) ?? 0) + safeValue);
      totalNs += safeValue;
    }
  }

  return Array.from(totals.entries())
    .map(([name, sumNs]) => ({
      name,
      averageNs: sumNs / frames.length,
      share: totalNs > 0 ? (sumNs / totalNs) * 100 : 0,
    }))
    .sort((a, b) => b.averageNs - a.averageNs);
}

function renderTooltipValue(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : String(value ?? "");
}

function formatTooltipSeriesValue(value: unknown): string {
  return typeof value === "number" ? value.toFixed(2) : String(value ?? "");
}

type ParsedGpuInfo = {
  renderer: string;
  vendor: string;
  openGlVersion: string;
  driverVersion: string;
};

function extractOpenGlVersion(input: string): string {
  const match = input.match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1] : "Unknown";
}

function extractDriverVersion(input: string, vendor: string): string {
  const vendorLower = vendor.toLowerCase();
  const amdMatch = input.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  const nvidiaMatch = input.match(/(\d+\.\d+\.\d+\.\d+|\d+\.\d+\.\d+)/);
  const intelMatch = input.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);

  if (vendorLower.includes("amd") || vendorLower.includes("ati")) {
    return amdMatch ? amdMatch[1] : "Unknown";
  }
  if (vendorLower.includes("nvidia")) {
    return nvidiaMatch ? nvidiaMatch[1] : "Unknown";
  }
  if (vendorLower.includes("intel")) {
    return intelMatch ? intelMatch[1] : "Unknown";
  }
  return "Unknown";
}

function parseGpuInfo(gpuName: string | null | undefined): ParsedGpuInfo {
  const fallback: ParsedGpuInfo = {
    renderer: "Unknown",
    vendor: "Unknown",
    openGlVersion: "Unknown",
    driverVersion: "Unknown",
  };
  if (!gpuName) return fallback;

  const match = gpuName.match(/^(.+?)\s*\((.+?),\s*OpenGL\s*(.+?)\)$/i);
  if (!match) {
    return { ...fallback, renderer: gpuName };
  }

  const renderer = match[1].trim();
  const vendor = match[2].trim();
  const versionPart = match[3].trim();

  return {
    renderer,
    vendor,
    openGlVersion: extractOpenGlVersion(versionPart),
    driverVersion: extractDriverVersion(versionPart, vendor),
  };
}

export function SummaryTab({ frames, snapshot, title }: SummaryTabProps) {
  const isCompareCard = Boolean(title);
  const stats = React.useMemo(() => {
    if (frames.length === 0) return null;
    const total = frames.length;
    const average = <T extends number>(values: T[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    const bottlenecks = frames.reduce(
      (acc, frame) => {
        acc[frame.bottleneck] += 1;
        return acc;
      },
      { CPU: 0, GPU: 0 },
    );

    return {
      totalFrames: total,
      avgFps: average(frames.map((frame) => frame.estimatedFps)),
      avgCpuTimeNs: average(frames.map((frame) => frame.cpuTimeNs)),
      avgGpuTimeNs: average(frames.map((frame) => frame.gpuTimeNs)),
      avgMemoryMiB: average(frames.map((frame) => frame.memoryUsed)),
      avgDrawnTiles: average(frames.map((frame) => frame.drawnTiles)),
      avgDrawnStatic: average(frames.map((frame) => frame.drawnStatic)),
      avgDrawnDynamic: average(frames.map((frame) => frame.drawnDynamic)),
      avgNpcCache: average(frames.map((frame) => frame.npcDisplacementCacheSize)),
      bottlenecks,
    };
  }, [frames]);

  const cpuEntries = React.useMemo(() => summarizeTimings(frames, "cpu").slice(0, 8), [frames]);
  const gpuEntries = React.useMemo(() => summarizeTimings(frames, "gpu").slice(0, 6), [frames]);
  const gpuColors = React.useMemo(() => generateColorPalette("#2563eb", Math.max(gpuEntries.length, 1)), [gpuEntries.length]);
  const cpuColors = React.useMemo(() => generateColorPalette("#e66312", Math.max(cpuEntries.length, 1)), [cpuEntries.length]);
  const primaryBottleneck = React.useMemo(() => {
    if (!stats) return "Unknown";
    return stats.bottlenecks.CPU > stats.bottlenecks.GPU ? "CPU" : "GPU";
  }, [stats]);

  const fpsChart = React.useMemo(
    () =>
      frames.map((frame, index) => ({
        frame: index + 1,
        fps: frame.estimatedFps,
      })),
    [frames],
  );

  const memoryChart = React.useMemo(
    () =>
      frames.map((frame, index) => ({
        frame: index + 1,
        used: frame.memoryUsed,
        free: frame.memoryFree,
      })),
    [frames],
  );
  const parsedGpu = React.useMemo(() => parseGpuInfo(snapshot?.gpuName), [snapshot?.gpuName]);

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No frame data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
      <div
        className={`grid gap-4 ${
          isCompareCard
            ? "lg:grid-cols-2"
            : "lg:grid-cols-[minmax(12.5rem,0.72fr)_minmax(23rem,1.4fr)_minmax(14rem,0.88fr)]"
        }`}
      >
        <Card className="min-h-[23rem]">
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frames</span>
              <span className="font-medium">{stats.totalFrames}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average FPS</span>
              <span className="font-medium">{stats.avgFps.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg CPU</span>
              <span className="font-medium">{formatNanosecondsToMs(stats.avgCpuTimeNs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg GPU</span>
              <span className="font-medium">{formatNanosecondsToMs(stats.avgGpuTimeNs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Memory</span>
              <span className="font-medium">{formatMebibytes(stats.avgMemoryMiB)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Tiles</span>
              <span className="font-medium">{formatNumber(Math.round(stats.avgDrawnTiles))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Static</span>
              <span className="font-medium">{formatNumber(Math.round(stats.avgDrawnStatic))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Dynamic</span>
              <span className="font-medium">{formatNumber(Math.round(stats.avgDrawnDynamic))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg NPC Cache</span>
              <span className="font-medium">{formatNumber(Math.round(stats.avgNpcCache))}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[23rem] flex-col">
          <CardHeader>
            <CardTitle className="text-base">
              Bottleneck Analysis{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (Bottleneck = {primaryBottleneck})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`grid flex-1 overflow-hidden md:items-stretch ${
              isCompareCard ? "gap-0 md:grid-cols-[9.5rem_minmax(0,1fr)]" : "gap-4 md:grid-cols-[16rem_1fr]"
            }`}
          >
            <div className={`${isCompareCard ? "-ml-4 h-40 w-[10.5rem]" : "-ml-3 h-48"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {gpuEntries.length > 0 ? (
                    <Pie
                      data={gpuEntries}
                      dataKey="averageNs"
                      nameKey="name"
                      innerRadius={0}
                      outerRadius={isCompareCard ? 42 : 52}
                    >
                      {gpuEntries.map((entry, index) => (
                        <Cell key={`gpu-${entry.name}`} fill={gpuColors[index % gpuColors.length]} />
                      ))}
                    </Pie>
                  ) : null}
                  {cpuEntries.length > 0 ? (
                    <Pie
                      data={cpuEntries}
                      dataKey="averageNs"
                      nameKey="name"
                      innerRadius={gpuEntries.length > 0 ? (isCompareCard ? 50 : 62) : 0}
                      outerRadius={isCompareCard ? 76 : 94}
                    >
                      {cpuEntries.map((entry, index) => (
                        <Cell key={`cpu-${entry.name}`} fill={cpuColors[index % cpuColors.length]} />
                      ))}
                    </Pie>
                  ) : null}
                  <Tooltip
                    formatter={(value) => renderTooltipValue(value)}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const first = payload[0];
                      const source = first?.payload as TimingEntry | undefined;
                      if (!source) return null;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-medium">{source.name}</div>
                          <div className="text-muted-foreground">
                            Avg: {formatNanosecondsToMs(source.averageNs)}
                          </div>
                          <div className="text-muted-foreground">
                            Share: {source.share.toFixed(2)}%
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Tabs defaultValue="gpu" className="flex h-full min-h-0 flex-col">
              <TabsList className={`grid w-full grid-cols-2 ${isCompareCard ? "h-7" : ""}`}>
                <TabsTrigger value="gpu" className={isCompareCard ? "text-xs" : ""}>GPU</TabsTrigger>
                <TabsTrigger value="cpu" className={isCompareCard ? "text-xs" : ""}>CPU</TabsTrigger>
              </TabsList>
              <TabsContent value="gpu" className="mt-2 flex-1 min-h-0">
                <div
                  className={`${isCompareCard ? "space-y-1 text-[11px]" : "space-y-1 text-xs"} ${
                    gpuEntries.length > 6 ? "h-full overflow-y-auto pr-1" : "h-full overflow-y-scroll pr-1"
                  }`}
                >
                  {gpuEntries.length > 0 ? (
                    gpuEntries.map((entry, index) => (
                      <div
                        key={`gpu-row-${entry.name}`}
                        className={`flex items-center rounded-md border px-2 ${isCompareCard ? "gap-1.5 py-1" : "gap-2 py-1.5"}`}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: gpuColors[index % gpuColors.length] }}
                        />
                        <span className="flex-1 truncate" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatNanosecondsToMs(entry.averageNs)}
                        </span>
                        {!isCompareCard ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {entry.share.toFixed(1)}%
                          </Badge>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="py-3 text-center text-muted-foreground">No GPU timings found.</div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="cpu" className="mt-2 flex-1 min-h-0">
                <div
                  className={`${isCompareCard ? "space-y-1 text-[11px]" : "space-y-1 text-xs"} ${
                    cpuEntries.length > 6 ? "h-full overflow-y-auto pr-1" : "h-full overflow-y-scroll pr-1"
                  }`}
                >
                  {cpuEntries.length > 0 ? (
                    cpuEntries.map((entry, index) => (
                      <div
                        key={`cpu-row-${entry.name}`}
                        className={`flex items-center rounded-md border px-2 ${isCompareCard ? "gap-1.5 py-1" : "gap-2 py-1.5"}`}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cpuColors[index % cpuColors.length] }}
                        />
                        <span className="flex-1 truncate" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatNanosecondsToMs(entry.averageNs)}
                        </span>
                        {!isCompareCard ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {entry.share.toFixed(1)}%
                          </Badge>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="py-3 text-center text-muted-foreground">No CPU timings found.</div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {!isCompareCard ? (
          snapshot ? (
            <Card className="min-h-[23rem]">
              <CardHeader>
                <CardTitle className="text-base">OS Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OS</span>
                  <span className="font-medium">{snapshot.osName || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture</span>
                  <span className="font-medium">{snapshot.osArch || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">{snapshot.osVersion || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Java</span>
                  <span className="font-medium">{snapshot.javaVersion || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Cores</span>
                  <span className="font-medium">{formatNumber(snapshot.cpuCores)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory</span>
                  <span className="font-medium">
                    {snapshot.memoryMaxMiB ? `${formatNumber(snapshot.memoryMaxMiB)} MiB` : "Unknown"}
                  </span>
                </div>
                <div className="mt-2 space-y-1 border-t pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">GPU</span>
                    <span
                      className="min-w-0 max-w-[13.5rem] truncate text-right font-medium text-foreground"
                      title={parsedGpu.renderer}
                    >
                      {parsedGpu.renderer}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendor</span>
                    <span className="font-medium">{parsedGpu.vendor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OpenGL</span>
                    <span className="font-medium">{parsedGpu.openGlVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-medium">{parsedGpu.driverVersion}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="min-h-[23rem]">
              <CardHeader>
                <CardTitle className="text-base">OS Info</CardTitle>
              </CardHeader>
              <CardContent className="py-10 text-center text-xs text-muted-foreground">
                No system snapshot data found.
              </CardContent>
            </Card>
          )
        ) : null}

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FPS Over Frames</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fpsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="frame" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const first = payload[0];
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-medium">Frame {String(label ?? "")}</div>
                          <div className="text-muted-foreground">
                            FPS: {formatTooltipSeriesValue(first?.value)}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="fps" stroke="#3b82f6" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Memory (MiB) Over Frames</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memoryChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="frame" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                          <div className="font-medium">Frame {String(label ?? "")}</div>
                          {payload.map((entry, idx) => (
                            <div key={`${String(entry.dataKey ?? entry.name ?? idx)}-${idx}`} className="text-muted-foreground">
                              {entry.name}: {formatTooltipSeriesValue(entry.value)}
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="used" name="Used" stroke="#dc2626" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="free" name="Free" stroke="#16a34a" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {isCompareCard ? (
        snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OS Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-xs sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OS</span>
                <span className="font-medium">{snapshot.osName || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Architecture</span>
                <span className="font-medium">{snapshot.osArch || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">{snapshot.osVersion || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Java</span>
                <span className="font-medium">{snapshot.javaVersion || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU Cores</span>
                <span className="font-medium">{formatNumber(snapshot.cpuCores)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory</span>
                <span className="font-medium">
                  {snapshot.memoryMaxMiB ? `${formatNumber(snapshot.memoryMaxMiB)} MiB` : "Unknown"}
                </span>
              </div>
            </div>
            <div className="space-y-1 border-t pt-2 sm:border-t-0 sm:border-l sm:pl-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">GPU</span>
                <span
                  className="min-w-0 max-w-[13.5rem] truncate text-right font-medium text-foreground"
                  title={parsedGpu.renderer}
                >
                  {parsedGpu.renderer}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{parsedGpu.vendor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OpenGL</span>
                <span className="font-medium">{parsedGpu.openGlVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Driver</span>
                <span className="font-medium">{parsedGpu.driverVersion}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OS Info</CardTitle>
          </CardHeader>
          <CardContent className="py-10 text-center text-xs text-muted-foreground">
            No system snapshot data found.
          </CardContent>
        </Card>
        )
      ) : null}

    </div>
  );
}
