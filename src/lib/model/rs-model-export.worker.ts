/**
 * Runs OBJ / GLB export off the main thread so a big model does not freeze the viewer,
 * and so the UI can show real progress instead of a spinner.
 */

import { modelToGlb, modelToObj } from "./rs-model-export";
import type { RSModelMesh } from "./rs-model-mesh";
import type { RSTextureLayer } from "./rs-model-source";

export type RSModelExportFormat = "obj" | "glb";

export type RSModelExportRequest = {
  modelId: number;
  format: RSModelExportFormat;
  mesh: RSModelMesh;
  textures: RSTextureLayer[];
  brightness?: number;
};

export type RSModelExportResponse =
  | { type: "progress"; fraction: number }
  | { type: "done"; format: "obj"; text: string }
  | { type: "done"; format: "glb"; buffer: ArrayBuffer }
  | { type: "error"; message: string };

/**
 * Typed by hand rather than via `DedicatedWorkerGlobalScope`: the project's `lib` is DOM-only,
 * and pulling in the webworker lib here would clash with it.
 */
const ctx = self as unknown as {
  postMessage: (message: RSModelExportResponse, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<RSModelExportRequest>) => void) | null;
};

ctx.onmessage = (event: MessageEvent<RSModelExportRequest>) => {
  const { modelId, format, mesh, textures, brightness } = event.data;

  // Only post when the whole-percent changes; the loops report far more often than that.
  let lastPercent = -1;
  const onProgress = (fraction: number) => {
    const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    if (percent === lastPercent) return;
    lastPercent = percent;
    ctx.postMessage({ type: "progress", fraction: percent / 100 });
  };

  try {
    if (format === "obj") {
      const text = modelToObj(mesh, modelId, { textures, brightness, onProgress });
      ctx.postMessage({ type: "done", format: "obj", text });
      return;
    }
    const buffer = modelToGlb(mesh, modelId, { textures, brightness, onProgress });
    ctx.postMessage({ type: "done", format: "glb", buffer }, [buffer]);
  } catch (error) {
    ctx.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Export failed",
    });
  }
};
