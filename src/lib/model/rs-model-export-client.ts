/**
 * Main-thread wrapper around the export worker: hands the mesh over, forwards progress, and
 * falls back to a synchronous export where module workers are unavailable.
 */

import { modelToGlb, modelToObj } from "./rs-model-export";
import type { RSModelMesh } from "./rs-model-mesh";
import type { RSTextureLayer } from "./rs-model-source";
import type {
  RSModelExportFormat,
  RSModelExportRequest,
  RSModelExportResponse,
} from "./rs-model-export.worker";

export type { RSModelExportFormat };

export type ExportRSModelParams = {
  mesh: RSModelMesh;
  textures: RSTextureLayer[];
  modelId: number;
  format: RSModelExportFormat;
  brightness?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

export type RSModelExportResult = {
  blob: Blob;
  filename: string;
};

function resultFor(
  format: RSModelExportFormat,
  modelId: number,
  payload: string | ArrayBuffer,
): RSModelExportResult {
  return format === "obj"
    ? {
        blob: new Blob([payload as string], { type: "text/plain" }),
        filename: `model-${modelId}.obj`,
      }
    : {
        blob: new Blob([payload as ArrayBuffer], { type: "model/gltf-binary" }),
        filename: `model-${modelId}.glb`,
      };
}

function exportOnMainThread(params: ExportRSModelParams): RSModelExportResult {
  const { mesh, textures, modelId, format, brightness, onProgress } = params;
  const options = { textures, brightness, onProgress };
  const payload =
    format === "obj"
      ? modelToObj(mesh, modelId, options)
      : modelToGlb(mesh, modelId, options);
  return resultFor(format, modelId, payload);
}

export function exportRSModel(params: ExportRSModelParams): Promise<RSModelExportResult> {
  const { mesh, textures, modelId, format, brightness, onProgress, signal } = params;

  let worker: Worker;
  try {
    worker = new Worker(new URL("./rs-model-export.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    // No module workers (or blocked): do it inline rather than failing the export.
    return Promise.resolve(exportOnMainThread(params));
  }

  return new Promise<RSModelExportResult>((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Export cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = (event: MessageEvent<RSModelExportResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.(message.fraction);
        return;
      }
      finish();
      if (message.type === "error") {
        reject(new Error(message.message));
        return;
      }
      onProgress?.(1);
      resolve(
        resultFor(
          message.format,
          modelId,
          message.format === "obj" ? message.text : message.buffer,
        ),
      );
    };

    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Export worker failed"));
    };

    const request: RSModelExportRequest = { modelId, format, mesh, textures, brightness };
    // Deliberately not transferring: the viewer keeps rendering from this same mesh.
    worker.postMessage(request);
  });
}
