"use client";

import * as React from "react";

import { RspLoadingSlot } from "@/components/ui/rsp-loading-slot";
import { useCacheType } from "@/context/cache-type-context";
import { modelDatUrl } from "@/lib/cache-api-client";
import {
  RSModelRenderer,
  type RSModelCamera,
  type RSModelRenderMode,
} from "@/lib/model/rs-model-renderer";
import type { RSModelMesh } from "@/lib/model/rs-model-mesh";
import {
  RSModelNotFoundError,
  loadRSModelMeshFromUrl,
  loadRSModelTextures,
  type RSTextureLayer,
} from "@/lib/model/rs-model-source";
import { cn } from "@/lib/utils";

/** Keeps the camera off the poles, where the up vector degenerates. */
const MAX_PITCH = Math.PI / 2 - 0.05;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8;

export type RSModelProps = {
  /** Model archive id. */
  id: number;
  /** Cache revision the model belongs to; also selects the texture set. */
  rev: number;
  /** Overrides the CDN URL (e.g. the `dat` field returned by `/models/{id}`). */
  modelUrl?: string;
  /** CSS width; defaults to filling the parent so the canvas can be sized by `className`. */
  width?: number | string;
  height?: number | string;
  className?: string;
  /** Extra light added to every vertex, on top of the client's base ambient. */
  ambient?: number;
  /** Extra contrast, on top of the client's base contrast. */
  contrast?: number;
  /** Gamma applied to colours and textures; the client ships 0.8 ("high"). */
  brightness?: number;
  /**
   * Spin slowly while idle. Turning this off snaps the camera back to `initialYaw` /
   * `initialPitch` so the model does not freeze at whatever angle the spin reached;
   * dragging keeps working either way.
   */
  autoRotate?: boolean;
  /** Drag to orbit / wheel to zoom. */
  interactive?: boolean;
  initialYaw?: number;
  initialPitch?: number;
  initialZoom?: number;
  /** Shaded fill, wireframe, or both. */
  renderMode?: RSModelRenderMode;
  /** When false the model is drawn greyscale, keeping only the shading. */
  showColors?: boolean;
  /** Draws a one-tile ground grid under the model. */
  showGrid?: boolean;
  /** Fires once the mesh and its texture layers are decoded (e.g. to drive an export). */
  onLoad?: (mesh: RSModelMesh, textures: RSTextureLayer[]) => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; mesh: RSModelMesh; textures: RSTextureLayer[] }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Renders a cache model by id: fetches the raw `.dat` from the CDN, decodes and lights it in
 * the browser, then draws it with WebGL2.
 */
export function RSModel({
  id,
  rev,
  modelUrl,
  width = "100%",
  height = 256,
  className,
  ambient,
  contrast,
  brightness = 0.8,
  autoRotate = false,
  interactive = true,
  initialYaw = Math.PI * 0.25,
  initialPitch = -0.35,
  initialZoom = 2.4,
  renderMode = "solid",
  showColors = true,
  showGrid = false,
  onLoad,
}: RSModelProps) {
  const { selectedCacheType } = useCacheType();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rendererRef = React.useRef<RSModelRenderer | null>(null);
  const cameraRef = React.useRef<RSModelCamera>({
    yaw: initialYaw,
    pitch: initialPitch,
    zoom: initialZoom,
  });
  const dirtyRef = React.useRef(true);

  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [glError, setGlError] = React.useState<string | null>(null);

  const datUrl = modelUrl ?? modelDatUrl(selectedCacheType, id, rev);

  // Read inside the render loop so changing them never tears down the GL context.
  const autoRotateRef = React.useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const brightnessRef = React.useRef(brightness);
  brightnessRef.current = brightness;
  const interactiveRef = React.useRef(interactive);
  interactiveRef.current = interactive;
  const optionsRef = React.useRef({ renderMode, useColors: showColors, showGrid });
  optionsRef.current = { renderMode, useColors: showColors, showGrid };

  // Reset the camera whenever a different model is shown.
  React.useEffect(() => {
    cameraRef.current = { yaw: initialYaw, pitch: initialPitch, zoom: initialZoom };
    dirtyRef.current = true;
  }, [id, rev, initialYaw, initialPitch, initialZoom]);

  // Stopping the spin returns to the starting pose, keeping whatever zoom the user set.
  const wasAutoRotating = React.useRef(autoRotate);
  React.useEffect(() => {
    if (wasAutoRotating.current && !autoRotate) {
      cameraRef.current = { ...cameraRef.current, yaw: initialYaw, pitch: initialPitch };
      dirtyRef.current = true;
    }
    wasAutoRotating.current = autoRotate;
  }, [autoRotate, initialYaw, initialPitch]);

  React.useEffect(() => {
    if (!Number.isFinite(id) || id < 0) {
      setState({ status: "empty" });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState({ status: "loading" });

    const run = async () => {
      try {
        const mesh = await loadRSModelMeshFromUrl(datUrl, id, {
          ambient,
          contrast,
          signal: controller.signal,
        });
        const textures = await loadRSModelTextures(
          selectedCacheType,
          mesh.textureIds,
          rev,
          controller.signal,
        );
        if (cancelled) return;
        setState({ status: "ready", mesh, textures });
        onLoad?.(mesh, textures);
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        if (error instanceof RSModelNotFoundError) {
          setState({ status: "empty" });
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load model",
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // `onLoad` is intentionally excluded: callers commonly pass an inline function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, contrast, datUrl, id, rev, selectedCacheType]);

  // Create the GL context once the canvas is mounted (i.e. once loading finished).
  React.useEffect(() => {
    if (state.status !== "ready") return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: RSModelRenderer;
    try {
      renderer = new RSModelRenderer(canvas);
    } catch (error) {
      setGlError(error instanceof Error ? error.message : "WebGL2 is not available");
      return;
    }
    rendererRef.current = renderer;
    setGlError(null);
    renderer.setBrightness(brightnessRef.current);
    renderer.setOptions(optionsRef.current);
    renderer.setMesh(state.mesh, state.textures);
    dirtyRef.current = true;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      dirtyRef.current = true;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    let previous = performance.now();
    const loop = (now: number) => {
      const elapsed = now - previous;
      previous = now;
      if (autoRotateRef.current) {
        cameraRef.current = {
          ...cameraRef.current,
          yaw: cameraRef.current.yaw + elapsed * 0.0004,
        };
        dirtyRef.current = true;
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        renderer.setCamera(cameraRef.current);
        renderer.setOptions(optionsRef.current);
        renderer.setBrightness(brightnessRef.current);
        renderer.render();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      setGlError("WebGL context lost");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    // React registers `onWheel` passively at the root, so zoom needs its own listener to
    // stop the page scrolling underneath the canvas.
    const onWheel = (event: WheelEvent) => {
      if (!interactiveRef.current) return;
      event.preventDefault();
      const camera = cameraRef.current;
      const zoom = camera.zoom * (event.deltaY > 0 ? 1.12 : 1 / 1.12);
      cameraRef.current = { ...camera, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) };
      dirtyRef.current = true;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("wheel", onWheel);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [state]);

  React.useEffect(() => {
    dirtyRef.current = true;
  }, [brightness, renderMode, showColors, showGrid]);

  const dragRef = React.useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const camera = cameraRef.current;
    cameraRef.current = {
      ...camera,
      yaw: camera.yaw - dx * 0.01,
      pitch: Math.min(MAX_PITCH, Math.max(-MAX_PITCH, camera.pitch - dy * 0.01)),
    };
    dirtyRef.current = true;
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const boxStyle: React.CSSProperties = { width, height };
  const wrapperClass = cn("relative overflow-hidden bg-muted/20", className);

  if (state.status === "loading") {
    return (
      <RspLoadingSlot
        className={className}
        style={boxStyle}
        rounded={false}
        ariaLabel={`Loading model ${id}`}
      />
    );
  }

  if (state.status === "empty") {
    return (
      <ModelFallback className={wrapperClass} style={boxStyle} label={`Model ${id} is unavailable`} />
    );
  }

  if (state.status === "error") {
    return (
      <ModelFallback
        className={wrapperClass}
        style={boxStyle}
        label={`Model ${id} failed to load: ${state.message}`}
      />
    );
  }

  return (
    <div ref={containerRef} className={wrapperClass} style={boxStyle}>
      <canvas
        ref={canvasRef}
        className={cn("size-full", interactive && "cursor-grab active:cursor-grabbing")}
        aria-label={`Model ${id}`}
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      {glError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 p-2 text-center text-xs text-muted-foreground">
          {glError}
        </div>
      ) : null}
    </div>
  );
}

function ModelFallback({
  className,
  style,
  label,
}: {
  className: string;
  style: React.CSSProperties;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center p-2 text-center text-xs text-muted-foreground",
        className,
      )}
      style={style}
      role="img"
      aria-label={label}
    >
      {label}
    </div>
  );
}
