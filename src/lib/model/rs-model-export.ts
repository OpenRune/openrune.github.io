/**
 * Exports a decoded model to OBJ or GLB.
 *
 * Both formats bake the viewer's shading into per-vertex colours: cache models carry no
 * material system, and textured faces only store a light level, so the closest faithful
 * export is "what you see". Textured faces sample their texture on the CPU rather than
 * shipping image files alongside the mesh.
 */

import { DEFAULT_BRIGHTNESS, packedHslToRgb } from "./rs-model-color";
import type { RSModelMesh } from "./rs-model-mesh";
import type { RSTextureLayer } from "./rs-model-source";

/** Fraction complete, 0..1. Called often enough to animate a bar, not per vertex. */
export type RSModelExportProgress = (fraction: number) => void;

export type RSModelExportOptions = {
  brightness?: number;
  /** Loaded texture layers, indexed like `mesh.textureIds`. Missing layers fall back to grey. */
  textures?: readonly RSTextureLayer[];
  onProgress?: RSModelExportProgress;
};

/** How often the loops below report; small enough to feel live, large enough to be free. */
const PROGRESS_STRIDE = 4096;

/** Maps a loop's own 0..1 onto a slice of the overall export. */
function span(onProgress: RSModelExportProgress | undefined, from: number, to: number) {
  if (!onProgress) return undefined;
  return (fraction: number) => onProgress(from + (to - from) * fraction);
}

/** Nearest-neighbour sample with wrapping, matching the renderer's `REPEAT` wrap mode. */
function sampleLayer(layer: ImageData, u: number, v: number): [number, number, number] {
  const wrap = (value: number, size: number) => {
    const scaled = Math.floor(value * size) % size;
    return scaled < 0 ? scaled + size : scaled;
  };
  const offset = (wrap(v, layer.height) * layer.width + wrap(u, layer.width)) * 4;
  return [
    layer.data[offset] / 255,
    layer.data[offset + 1] / 255,
    layer.data[offset + 2] / 255,
  ];
}

/** Per-vertex RGB in 0..1, computed the same way the fragment shader does. */
export function meshVertexColors(
  mesh: RSModelMesh,
  options: RSModelExportOptions = {},
  onProgress?: RSModelExportProgress,
): Float32Array {
  const brightness = options.brightness ?? DEFAULT_BRIGHTNESS;
  const textures = options.textures ?? [];
  const out = new Float32Array(mesh.vertexCount * 3);

  for (let i = 0; i < mesh.vertexCount; i++) {
    if (onProgress && i % PROGRESS_STRIDE === 0) onProgress(i / mesh.vertexCount);
    const layerIndex = mesh.textureLayer[i];
    let rgb: [number, number, number];

    if (layerIndex >= 0) {
      const light = mesh.hsl[i] / 127;
      const layer = textures[layerIndex];
      if (layer) {
        const texel = sampleLayer(layer, mesh.uv[i * 2], mesh.uv[i * 2 + 1]);
        rgb = [
          Math.pow(texel[0], brightness) * light,
          Math.pow(texel[1], brightness) * light,
          Math.pow(texel[2], brightness) * light,
        ];
      } else {
        rgb = [light, light, light];
      }
    } else {
      rgb = packedHslToRgb(mesh.hsl[i], brightness);
    }

    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }

  onProgress?.(1);
  return out;
}

/**
 * Wavefront OBJ with colours written as extra components on each `v` line — the de facto
 * vertex-colour convention, read by Blender and MeshLab. No MTL is emitted because every
 * triangle would otherwise need its own material.
 */
export function modelToObj(
  mesh: RSModelMesh,
  modelId: number,
  options: RSModelExportOptions = {},
): string {
  const { onProgress } = options;
  const colors = meshVertexColors(mesh, options, span(onProgress, 0, 0.4));

  const lines: string[] = [
    `# OpenRune model ${modelId}`,
    `# ${mesh.vertexCount / 3} triangles, colours baked per vertex`,
    `o model_${modelId}`,
  ];

  for (let i = 0; i < mesh.vertexCount; i++) {
    if (onProgress && i % PROGRESS_STRIDE === 0) {
      onProgress(0.4 + 0.35 * (i / mesh.vertexCount));
    }
    lines.push(
      `v ${fmt(mesh.positions[i * 3])} ${fmt(mesh.positions[i * 3 + 1])} ${fmt(
        mesh.positions[i * 3 + 2],
      )} ${fmt(colors[i * 3])} ${fmt(colors[i * 3 + 1])} ${fmt(colors[i * 3 + 2])}`,
    );
  }

  for (let i = 0; i < mesh.vertexCount; i++) {
    if (onProgress && i % PROGRESS_STRIDE === 0) {
      onProgress(0.75 + 0.1 * (i / mesh.vertexCount));
    }
    lines.push(`vt ${fmt(mesh.uv[i * 2])} ${fmt(mesh.uv[i * 2 + 1])}`);
  }

  for (let i = 0; i < mesh.vertexCount; i += 3) {
    const a = i + 1;
    lines.push(`f ${a}/${a} ${a + 1}/${a + 1} ${a + 2}/${a + 2}`);
  }

  onProgress?.(0.9);
  const obj = `${lines.join("\n")}\n`;
  onProgress?.(1);
  return obj;
}

function fmt(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(5)).toString() : "0";
}

/** Flat normal per triangle, replicated to its three vertices. */
function faceNormals(mesh: RSModelMesh): Float32Array {
  const out = new Float32Array(mesh.vertexCount * 3);
  for (let i = 0; i < mesh.vertexCount; i += 3) {
    const ax = mesh.positions[i * 3];
    const ay = mesh.positions[i * 3 + 1];
    const az = mesh.positions[i * 3 + 2];
    const bx = mesh.positions[(i + 1) * 3] - ax;
    const by = mesh.positions[(i + 1) * 3 + 1] - ay;
    const bz = mesh.positions[(i + 1) * 3 + 2] - az;
    const cx = mesh.positions[(i + 2) * 3] - ax;
    const cy = mesh.positions[(i + 2) * 3 + 1] - ay;
    const cz = mesh.positions[(i + 2) * 3 + 2] - az;

    let nx = by * cz - bz * cy;
    let ny = bz * cx - bx * cz;
    let nz = bx * cy - by * cx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;

    for (let k = 0; k < 3; k++) {
      out[(i + k) * 3] = nx;
      out[(i + k) * 3 + 1] = ny;
      out[(i + k) * 3 + 2] = nz;
    }
  }
  return out;
}

/**
 * Binary glTF (`.glb`). One unlit, double-sided primitive with baked vertex colours —
 * cache models have no lighting model of their own, so a lit material would double-shade them.
 */
export function modelToGlb(
  mesh: RSModelMesh,
  modelId: number,
  options: RSModelExportOptions = {},
): ArrayBuffer {
  const { onProgress } = options;
  const rgb = meshVertexColors(mesh, options, span(onProgress, 0, 0.5));
  onProgress?.(0.6);
  const normals = faceNormals(mesh);
  onProgress?.(0.75);

  const colors = new Float32Array(mesh.vertexCount * 4);
  let hasTransparency = false;
  for (let i = 0; i < mesh.vertexCount; i++) {
    colors[i * 4] = rgb[i * 3];
    colors[i * 4 + 1] = rgb[i * 3 + 1];
    colors[i * 4 + 2] = rgb[i * 3 + 2];
    colors[i * 4 + 3] = mesh.alpha[i];
    if (mesh.alpha[i] < 1) hasTransparency = true;
  }

  const positionBytes = alignTo4(mesh.positions.byteLength);
  const normalBytes = alignTo4(normals.byteLength);
  const colorBytes = alignTo4(colors.byteLength);
  const binaryLength = positionBytes + normalBytes + colorBytes;

  const binary = new Uint8Array(binaryLength);
  binary.set(new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength), 0);
  binary.set(new Uint8Array(normals.buffer, 0, normals.byteLength), positionBytes);
  binary.set(new Uint8Array(colors.buffer, 0, colors.byteLength), positionBytes + normalBytes);

  const json = {
    asset: { version: "2.0", generator: "OpenRune model viewer" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: `model_${modelId}` }],
    meshes: [
      {
        name: `model_${modelId}`,
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: [
      {
        name: "baked",
        doubleSided: true,
        alphaMode: hasTransparency ? "BLEND" : "OPAQUE",
        extensions: { KHR_materials_unlit: {} },
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: mesh.vertexCount,
        type: "VEC3",
        min: mesh.bounds.min,
        max: mesh.bounds.max,
      },
      { bufferView: 1, componentType: 5126, count: mesh.vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: mesh.vertexCount, type: "VEC4" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: mesh.positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positionBytes, byteLength: normals.byteLength, target: 34962 },
      {
        buffer: 0,
        byteOffset: positionBytes + normalBytes,
        byteLength: colors.byteLength,
        target: 34962,
      },
    ],
    buffers: [{ byteLength: binaryLength }],
  };

  // GLB chunks are 4-byte aligned: JSON padded with spaces, BIN with zeros.
  const jsonBytes = padTo4(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const total = 12 + 8 + jsonBytes.byteLength + 8 + binaryLength;
  const glb = new ArrayBuffer(total);
  const view = new DataView(glb);
  const bytes = new Uint8Array(glb);

  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  bytes.set(jsonBytes, 20);
  const binaryChunkOffset = 20 + jsonBytes.byteLength;
  view.setUint32(binaryChunkOffset, binaryLength, true);
  view.setUint32(binaryChunkOffset + 4, 0x004e4942, true); // "BIN"
  bytes.set(binary, binaryChunkOffset + 8);

  onProgress?.(1);
  return glb;
}

function alignTo4(length: number): number {
  return length + ((4 - (length % 4)) % 4);
}

function padTo4(data: Uint8Array, fill: number): Uint8Array {
  const padded = new Uint8Array(alignTo4(data.byteLength)).fill(fill);
  padded.set(data);
  return padded;
}
