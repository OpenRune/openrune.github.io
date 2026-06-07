import { NextRequest, NextResponse } from "next/server";

import {
  cacheServerOrigin,
  parseCacheTarget,
  stripCacheRoutingParams,
  type CacheTarget,
} from "@/lib/cache-api-target";

const DEFAULT_TARGET: CacheTarget = { ip: "localhost", port: 8090 };

function resolveTarget(request: NextRequest): CacheTarget {
  return (
    parseCacheTarget(
      request.nextUrl.searchParams,
      request.headers.get("x-cache-type"),
      request.cookies.get("cache-type")?.value,
    ) ?? DEFAULT_TARGET
  );
}

function buildDestination(
  request: NextRequest,
  pathParts: string[],
  target: CacheTarget,
): string {
  const path = pathParts.join("/");
  const query = stripCacheRoutingParams(request.nextUrl.searchParams).toString();
  return `${cacheServerOrigin(target)}/${path}${query ? `?${query}` : ""}`;
}

function isZipDownloadPath(pathParts: string[]): boolean {
  return pathParts.length >= 2 && pathParts[0] === "zip" && pathParts[1] === "download";
}

function proxyTimeoutMsForPath(pathParts: string[]): number {
  if (pathParts[0] === "zip") {
    return isZipDownloadPath(pathParts) ? 0 : 120_000;
  }
  return 10_000;
}

async function proxyToCache(
  request: NextRequest,
  pathParts: string[],
): Promise<NextResponse> {
  const target = resolveTarget(request);
  const destination = buildDestination(request, pathParts, target);
  const isStatusRequest = pathParts.join("/") === "status";
  const zipDownload = isZipDownloadPath(pathParts);
  const proxyTimeoutMs = proxyTimeoutMsForPath(pathParts);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("x-cache-type");

  const controller = proxyTimeoutMs > 0 ? new AbortController() : null;
  const timeoutId =
    controller != null ? setTimeout(() => controller.abort(), proxyTimeoutMs) : null;

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    const upstream = await fetch(destination, {
      method: request.method,
      headers,
      body,
      signal: controller?.signal,
      redirect: "manual",
      cache: "no-store",
    });

    if (isStatusRequest && !upstream.ok) {
      return NextResponse.json(
        {
          status: "ERROR",
          game: "unknown",
          revision: 0,
          environment: "offline",
          port: target.port,
          statusMessage: "Cache server returned an error status",
        },
        { status: 200 },
      );
    }

    const status = upstream.status;
    const nullBodyStatus = status === 204 || status === 205 || status === 304;
    if (nullBodyStatus) {
      await upstream.arrayBuffer();
    }

    if (zipDownload && upstream.body && !nullBodyStatus) {
      const response = new NextResponse(upstream.body, {
        status,
        statusText: upstream.statusText,
      });
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (!["content-encoding", "transfer-encoding"].includes(lower)) {
          response.headers.set(key, value);
        }
      });
      return response;
    }

    const responseBody = nullBodyStatus ? null : await upstream.arrayBuffer();
    const response = new NextResponse(responseBody, {
      status,
      statusText: upstream.statusText,
    });

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!["content-encoding", "transfer-encoding", "content-length"].includes(lower)) {
        response.headers.set(key, value);
      }
    });

    return response;
  } catch (error) {
    if (isStatusRequest) {
      return NextResponse.json(
        {
          status: "ERROR",
          game: "unknown",
          revision: 0,
          environment: "offline",
          port: target.port,
          statusMessage: "Cache server is not responding",
        },
        { status: 200 },
      );
    }

    if (
      (error as { name?: string }).name === "AbortError" ||
      (error as { code?: string }).code === "ECONNREFUSED"
    ) {
      return NextResponse.json(
        {
          error: "Service unavailable",
          message: "Cache server is not responding",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: "Gateway error",
        message: error instanceof Error ? error.message : "Unknown proxy error",
      },
      { status: 502 },
    );
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId);
  }
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolved = await params;
  return proxyToCache(request, resolved.path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const HEAD = handler;
