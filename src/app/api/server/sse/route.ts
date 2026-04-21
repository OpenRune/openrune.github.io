import { NextRequest } from "next/server";

type CacheTarget = {
  ip: string;
  port: number;
};

const DEFAULT_TARGET: CacheTarget = { ip: "localhost", port: 8090 };
const SSE_CONNECT_TIMEOUT_MS = 10_000;

function parseTargetFromEnv(): CacheTarget {
  const raw = process.env.API_PROXY_DESTINATION;
  if (!raw) return DEFAULT_TARGET;

  try {
    const parsed = new URL(raw);
    const port = Number(parsed.port || "8090");
    if (!Number.isFinite(port) || port < 1 || port > 65535) return DEFAULT_TARGET;
    return { ip: parsed.hostname, port };
  } catch {
    return DEFAULT_TARGET;
  }
}

function parseTarget(request: NextRequest): CacheTarget {
  const queryIp = request.nextUrl.searchParams.get("ip");
  const queryPort = request.nextUrl.searchParams.get("port");
  if (queryIp && queryPort) {
    const port = Number(queryPort);
    if (Number.isFinite(port) && port >= 1 && port <= 65535) {
      return { ip: queryIp, port };
    }
  }

  const fallback = parseTargetFromEnv();
  const rawHeader = request.headers.get("x-cache-type");
  const rawCookie = request.cookies.get("cache-type")?.value;
  const raw = rawHeader ?? rawCookie;
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<CacheTarget>;
    const ip = typeof parsed.ip === "string" ? parsed.ip.trim() : "";
    const port = Number(parsed.port);
    if (!ip || !Number.isFinite(port) || port < 1 || port > 65535) return fallback;
    return { ip, port };
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const target = parseTarget(request);

  const qs = new URLSearchParams();
  if (type) qs.set("type", type);
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!["type", "ip", "port"].includes(key)) {
      qs.set(key, value);
    }
  });

  const destination = `http://${target.ip}:${target.port}/sse${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const writeSseError = (error: string, message: string, status?: number) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error, message, status })}\n\n`,
          ),
        );
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(
        () => abortController.abort(),
        SSE_CONNECT_TIMEOUT_MS,
      );

      try {
        const upstream = await fetch(destination, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!upstream.ok || !upstream.body) {
          writeSseError(
            "Failed to connect to SSE endpoint",
            "Upstream endpoint unavailable",
            upstream.status,
          );
          controller.close();
          return;
        }

        clearTimeout(timeoutId);
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          if (value) controller.enqueue(value);
        }
      } catch (error) {
        writeSseError(
          "SSE proxy error",
          error instanceof Error ? error.message : "Unknown error",
        );
        controller.close();
      } finally {
        clearTimeout(timeoutId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
