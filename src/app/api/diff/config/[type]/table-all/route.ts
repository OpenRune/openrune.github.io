import { NextRequest, NextResponse } from "next/server";

import { cacheServerOrigin } from "@/lib/cache-api-target";

export const dynamic = "force-dynamic";

type CacheTarget = {
  ip: string;
  port: number;
};

const DEFAULT_TARGET: CacheTarget = {
  ip: "localhost",
  port: 8090,
};

function parseTargetFromQuery(request: NextRequest): CacheTarget | null {
  const ip = request.nextUrl.searchParams.get("ip")?.trim();
  const portRaw = request.nextUrl.searchParams.get("port");
  if (!ip || !portRaw) return null;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port < 1 || port > 65535) return null;
  return { ip, port };
}

const PAGE_SIZE = 500;
const MAX_ROWS = 100_000;
const PAGE_TIMEOUT_MS = 30_000;

type TablePageRow = Record<string, unknown>;

type TablePagePayload = {
  total?: unknown;
  rows?: unknown;
  decoding?: unknown;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const { type } = await params;

  const sp = request.nextUrl.searchParams;
  const base = sp.get("base");
  const rev = sp.get("rev");

  if (!base || !rev || !/^\d+$/.test(base) || !/^\d+$/.test(rev)) {
    return NextResponse.json({ error: "Missing or invalid base/rev params" }, { status: 400 });
  }

  const target = parseTargetFromQuery(request) ?? DEFAULT_TARGET;

  const allRows: TablePageRow[] = [];
  let serverTotal = Number.POSITIVE_INFINITY;
  let offset = 0;

  while (offset < serverTotal && allRows.length < MAX_ROWS) {
    const search = new URLSearchParams({ base, rev, offset: String(offset), limit: String(PAGE_SIZE) });
    const upstreamUrl = `${cacheServerOrigin(target)}/diff/config/${encodeURIComponent(type)}/table?${search.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

    let data: TablePagePayload;
    try {
      const resp = await fetch(upstreamUrl, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        return NextResponse.json({ error: `Upstream error: ${resp.status}` }, { status: 502 });
      }
      data = (await resp.json()) as TablePagePayload;
    } catch (e) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Upstream fetch failed" },
        { status: 502 },
      );
    }

    if (data.decoding) {
      return NextResponse.json({ decoding: true, rows: [], total: 0 });
    }

    if (!Array.isArray(data.rows)) {
      return NextResponse.json({ error: "Unexpected upstream response" }, { status: 502 });
    }

    if (typeof data.total === "number") serverTotal = data.total;

    for (const row of data.rows) allRows.push(row as TablePageRow);

    if (data.rows.length === 0 || data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return NextResponse.json(
    { rows: allRows, total: allRows.length },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
