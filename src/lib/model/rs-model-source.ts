/**
 * Fetches model meshes and their textures for a revision.
 *
 * Meshes come from the CDN as raw `.dat` bytes and are decoded in the browser. Textures are
 * cache texture definitions whose pixels live in the sprite index, so a texture id has to be
 * resolved through the revision's texture snapshot to a sprite id first.
 */

import {
  cacheTexturesSnapshotUrl,
  modelDatUrl,
  spritesCdnBase,
  spritesCdnGameSlug,
  spritesCdnObjectUrl,
  type CacheTarget,
} from "@/lib/cache-api-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";

import { decodeRSModel } from "./rs-model-format";
import { lightRSModel } from "./rs-model-light";
import { buildRSModelMesh, type RSModelMesh } from "./rs-model-mesh";

/** The client renders textures at 128×128; anything else is scaled to fit the array texture. */
export const RS_TEXTURE_SIZE = 128;

/** Thrown when the CDN has no `.dat` for this model / revision yet. */
export class RSModelNotFoundError extends Error {}

export type LoadRSModelOptions = {
  ambient?: number;
  contrast?: number;
  signal?: AbortSignal;
};

export async function loadRSModelMesh(
  cacheType: CacheTarget,
  id: number,
  rev: number,
  options: LoadRSModelOptions = {},
): Promise<RSModelMesh> {
  return loadRSModelMeshFromUrl(modelDatUrl(cacheType, id, rev), id, options);
}

export async function loadRSModelMeshFromUrl(
  url: string,
  id: number,
  options: LoadRSModelOptions = {},
): Promise<RSModelMesh> {
  const res = await fetch(url, { signal: options.signal });
  if (res.status === 404) throw new RSModelNotFoundError(`Model ${id} is not published`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = await res.arrayBuffer();
  // CDN misses return an HTML error page with a 200 in some edge cases; a model is never text.
  if (buffer.byteLength < 20) throw new RSModelNotFoundError(`Model ${id} is empty`);

  const def = decodeRSModel(id, buffer);
  const lit = lightRSModel(def, { ambient: options.ambient, contrast: options.contrast });
  return buildRSModelMesh(def, lit);
}

type TextureSnapshotResponse = {
  snapshots?: Record<string, { fileId?: number } | undefined>;
  snapshot?: { fileId?: number };
  id?: number | string;
};

/** Texture definition id -> sprite id, for one revision. */
async function textureFileIds(
  cacheType: CacheTarget,
  rev: number,
): Promise<Map<number, number>> {
  const url = cacheTexturesSnapshotUrl(cacheType, rev);
  const cacheKey = `cache:textures:snapshot:${cacheType.ip}:${cacheType.port}:${rev}`;
  const { data } = await conditionalJsonFetch<TextureSnapshotResponse>(cacheKey, url);

  const out = new Map<number, number>();
  const snapshots = data.snapshots;
  if (snapshots) {
    for (const [key, snapshot] of Object.entries(snapshots)) {
      const textureId = Number(key);
      const fileId = Number(snapshot?.fileId);
      if (Number.isFinite(textureId) && Number.isFinite(fileId) && fileId >= 0) {
        out.set(textureId, fileId);
      }
    }
  } else if (data.snapshot) {
    const textureId = Number(data.id);
    const fileId = Number(data.snapshot.fileId);
    if (Number.isFinite(textureId) && Number.isFinite(fileId)) out.set(textureId, fileId);
  }
  return out;
}

/** Square RGBA pixels for one texture layer, or `null` when the sprite could not be loaded. */
export type RSTextureLayer = ImageData | null;

async function loadTextureLayer(url: string, signal?: AbortSignal): Promise<RSTextureLayer> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    try {
      const canvas = document.createElement("canvas");
      canvas.width = RS_TEXTURE_SIZE;
      canvas.height = RS_TEXTURE_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      // Textures are pixel art — never let the browser smooth them while rescaling.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bitmap, 0, 0, RS_TEXTURE_SIZE, RS_TEXTURE_SIZE);
      return ctx.getImageData(0, 0, RS_TEXTURE_SIZE, RS_TEXTURE_SIZE);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/**
 * Loads one 128×128 RGBA layer per entry of `textureIds`, in the same order. Failed layers
 * come back as `null` so the renderer can fall back to flat shading for those faces.
 */
export async function loadRSModelTextures(
  cacheType: CacheTarget,
  textureIds: readonly number[],
  rev: number,
  signal?: AbortSignal,
): Promise<RSTextureLayer[]> {
  if (textureIds.length === 0) return [];

  let fileIds: Map<number, number>;
  try {
    fileIds = await textureFileIds(cacheType, rev);
  } catch {
    return textureIds.map(() => null);
  }

  const cdnBase = spritesCdnBase(cacheType);
  const game = spritesCdnGameSlug(cacheType);

  return Promise.all(
    textureIds.map((textureId) => {
      const fileId = fileIds.get(textureId);
      if (fileId === undefined) return Promise.resolve<RSTextureLayer>(null);
      return loadTextureLayer(
        spritesCdnObjectUrl({ cdnBase, game, rev, id: fileId }),
        signal,
      );
    }),
  );
}
