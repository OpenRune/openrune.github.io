import React, { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildUrl, fetchFromBuildUrl } from '@/lib/api/apiClient';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { VANILLA_TO_HD_TEXTURE } from '@/lib/hdTextureMap';
import { useRef } from 'react';
import { useCacheType } from "@/components/layout/cache-type-provider";

// Store available HD textures in a Set
const availableHdTextures = new Set<string>();
let hdTexturesChecked = false;
async function checkHdTexturesExist() {
  const entries = Object.entries(VANILLA_TO_HD_TEXTURE);
  await Promise.all(entries.map(async ([index, filename]) => {
    const url = `/hd_textures/${filename.toLowerCase()}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        availableHdTextures.add(filename.toLowerCase());
      }
    } catch {}
  }));
  hdTexturesChecked = true;
}

interface RSModelProps {
  id: string | number;
  width?: number | string;
  height?: number | string;
  color?: string;
  wireframe?: boolean;
  autoRotate?: boolean;
  grid?: boolean;
  backgroundType?: 'color' | 'image';
  backgroundColor?: string;
  backgroundImage?: string;
  onStats?: (stats: any) => void;
  onTextureResults?: (results: any[]) => void;
  onImages?: (images: string[]) => void; // NEW PROP
  animateTextures?: boolean;
  highlightColor?: string | null;
}

function extractModelStats(scene: THREE.Object3D | null, gltfJson?: any) {
  let vertices = 0;
  let triangles = 0;
  let materialInfo: { name: string; color?: string; textureImageIndex?: number; textureIndex?: number }[] = [];
  let colors = new Set<string>();
  let colorMap: Record<string, Array<{ r: number; g: number; b: number }>> = {};
  if (!scene) return { vertices, triangles, materials: [], colors: [], colorMap: {} };
  scene.traverse((child: any) => {
    if (child.isMesh) {
      const geom = child.geometry;
      if (geom) {
        if (geom.attributes.position) {
          vertices += geom.attributes.position.count;
        }
        if (geom.index) {
          triangles += geom.index.count / 3;
        } else if (geom.attributes.position) {
          triangles += geom.attributes.position.count / 3;
        }
        // Extract vertex colors if present
        if (geom.attributes.color) {
          const colorAttr = geom.attributes.color;
          for (let i = 0; i < colorAttr.count; i++) {
            const r = colorAttr.getX(i);
            const g = colorAttr.getY(i);
            const b = colorAttr.getZ(i);
            // Convert to hex
            const hex = '#' + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1).padStart(6, '0');
            colors.add(hex);
            if (hex) { // fix: skip null/undefined hex
              if (!colorMap[hex]) colorMap[hex] = [];
              colorMap[hex].push({ r, g, b });
            }
          }
        }
      }
    }
  });
  // If gltfJson is provided, extract material texture indices
  if (gltfJson && gltfJson.materials && gltfJson.textures) {
    for (let i = 0; i < gltfJson.materials.length; i++) {
      const mat = gltfJson.materials[i];
      let textureIndex: number | undefined = undefined;
      let textureImageIndex: number | undefined = undefined;
      if (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture) {
        textureIndex = mat.pbrMetallicRoughness.baseColorTexture.index;
        if (typeof textureIndex === 'number' && gltfJson.textures[textureIndex]) {
          textureImageIndex = gltfJson.textures[textureIndex].source;
        }
      }
      materialInfo.push({
        name: mat.name || `Material ${i}`,
        color: undefined, // color is not available from JSON directly
        textureIndex,
        textureImageIndex,
      });
    }
  }
  return {
    vertices,
    triangles: Math.round(triangles),
    materials: materialInfo,
    colors: Array.from(colors),
    colorMap,
  };
}

export function getSpriteIdFromTextureId(textureId: number, textureResults: any[]): number | undefined {
  const texObj = textureResults[textureId];
  return texObj?.fileId;
}

// Helper to fetch texture results with CRC-based caching
async function fetchTextureResultsWithCache(fetchFromBuildUrl: (path: string, params?: any, init?: RequestInit) => Promise<Response>) {
  const cached = localStorage.getItem('textureResultsCache');
  let cachedCrc = null;
  let cachedResults = null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      cachedCrc = parsed.crc;
      cachedResults = parsed.results;
    } catch {}
  }
  const res = await fetchFromBuildUrl(`public/web/textures`, cachedCrc ? { crc: cachedCrc } : {});
  const data = await res.json();
  if (data.updated === false && cachedResults) {
    return cachedResults;
  } else if (data.results && data.crc) {
    localStorage.setItem('textureResultsCache', JSON.stringify({ crc: data.crc, results: data.results }));
    return data.results;
  } else {
    return cachedResults || [];
  }
}

// Helper to cache a sprite in localStorage with cache type support
async function ensureSpriteCached(spriteId: number, cacheTypeId: string, fetchFromBuildUrl: (path: string, params?: any, init?: RequestInit) => Promise<Response>) {
  const cacheKey = `sprite_${cacheTypeId}_${spriteId}_128_128_true`;
  const cached = localStorage.getItem(cacheKey);
  // Validate cached image is a valid data URL for an image
  if (cached && cached.startsWith('data:image/')) return;
  // If cached but invalid, remove it
  if (cached) localStorage.removeItem(cacheKey);
  const res = await fetchFromBuildUrl(`/public/sprite/${spriteId}`, { width: 128, height: 128, keepAspectRatio: true });
  const blob = await res.blob();
  const reader = new FileReader();
  await new Promise(resolve => {
    reader.onloadend = () => {
      localStorage.setItem(cacheKey, reader.result as string);
      resolve(true);
    };
    reader.readAsDataURL(blob);
  });
}

interface ModelViewerProps {
  gltfUrl: string;
  color: string;
  wireframe: boolean;
  setScene: (scene: any) => void;
  setGltfJson: (json: any) => void;
  textureResults: any[];
  animateTextures?: boolean;
  highlightColor?: string | null;
}

// Helper to add barycentric coordinates to geometry
function addBarycentricCoordinates(geometry: THREE.BufferGeometry) {
  const count = geometry.attributes.position.count;
  const bary = [];
  for (let i = 0; i < count; i += 3) {
    bary.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }
  geometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(bary, 3));
}

// Helper to add highlight mask to geometry
function addHighlightMask(geometry: THREE.BufferGeometry, highlightMask: Float32Array) {
  geometry.setAttribute('highlightMask', new THREE.BufferAttribute(highlightMask, 1));
}

// Inline shader code
const vertexShader = `
  attribute vec3 barycentric;
  attribute float highlightMask;
  varying vec3 vBarycentric;
  varying float vHighlightMask;
  varying vec3 vColor;
  void main() {
    vBarycentric = barycentric;
    vHighlightMask = highlightMask;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vBarycentric;
  varying float vHighlightMask;
  varying vec3 vColor;
  void main() {
    if (vHighlightMask > 0.5) {
      gl_FragColor = vec4(1.0, 0.75, 0.14, 1.0); // solid yellow
    } else {
      gl_FragColor = vec4(vColor, 1.0);
    }
  }
`;

function ModelViewer({
  gltfUrl,
  color,
  wireframe,
  setScene,
  setGltfJson,
  textureResults,
  animateTextures = true,
  highlightColor = null,
}: ModelViewerProps) {
  const { scene, ...gltf } = useGLTF(gltfUrl);
  // Store animated materials
  const animatedMaterials = React.useRef<any[]>([]);
  // Store animation params for each material
  const animationParams = React.useRef<any[]>([]);

  // NEW: State for highlight outline geometry
  const [outlineGeometry, setOutlineGeometry] = React.useState<THREE.BufferGeometry | null>(null);
  // NEW: State for highlight fill geometry
  const [highlightFillGeometry, setHighlightFillGeometry] = React.useState<THREE.BufferGeometry | null>(null);

  useMemo(() => {
    scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (child.material.color) {
          child.material.color.set(color);
        }
        child.material.wireframe = wireframe;
        child.material.needsUpdate = true;
      }
    });
  }, [scene, color, wireframe]);

  // Find animated materials after scene/gltf load
  useEffect(() => {
    animatedMaterials.current = [];
    animationParams.current = [];
    if (!gltf.parser?.json) return;
    const gltfJson = gltf.parser.json;
    if (gltfJson.materials && gltfJson.textures && gltfJson.images) {
      scene.traverse((child: any) => {
        if (child.isMesh && child.material && child.material.map) {
          let matIndex = null;
          if (typeof child.material.index === 'number') {
            matIndex = child.material.index;
          } else if (child.material.name) {
            matIndex = gltfJson.materials.findIndex((m: any) => m.name === child.material.name);
          }

          if (matIndex === null || matIndex === -1) return;
          const matJson = gltfJson.materials[matIndex];
          const texIndex = matJson?.pbrMetallicRoughness?.baseColorTexture?.index;
          const trailingNum = getTrailingNumber(matJson.name);
          const animData = trailingNum !== -1 ? textureResults[trailingNum] : undefined;
          if (typeof texIndex === 'number') {
            const imageIndex = gltfJson.textures[texIndex]?.source;
            if (typeof imageIndex === 'number') {
              if (animData?.animationSpeed && animData?.animationDirection) {
                animatedMaterials.current.push(child.material);
                animationParams.current.push({ speed: animData.animationSpeed, direction: animData.animationDirection });
                child.material.map.wrapS = child.material.map.wrapT = THREE.RepeatWrapping;
              }
            }
          }
        }
      });
    }
  }, [scene, gltf.parser, textureResults]);

  function getTrailingNumber(str: string) {
    const match = str.match(/_(\d+)$/);
    return match ? parseInt(match[1], 10) : -1;
  }

  // Animate textures every frame
  useFrame((state, delta) => {
    if (!animateTextures) return;
    animatedMaterials.current.forEach((mat, i) => {
      const { speed, direction } = animationParams.current[i];
      if (!mat.map) return;
      let u = 0, v = 0;
      switch (direction) {
        case 1: v = -1; break; // up
        case 3: v = 1; break;  // down
        case 2: u = -1; break; // left
        case 4: u = 1; break;  // right
      }
      u *= speed;
      v *= speed;
      mat.map.offset.x = ((mat.map.offset.x + u * delta * 0.5) % 1 + 1) % 1;
      mat.map.offset.y = ((mat.map.offset.y + v * delta * 0.5) % 1 + 1) % 1;
      mat.map.needsUpdate = true;
    });
  });

  // Vertex color replacement: set only matching vertices to yellow
  React.useEffect(() => {
    if (!scene) return;

    // For collecting outline edges
    let outlinePositions: number[] = [];
    let outlineSet = new Set<string>(); // To avoid duplicate edges
    // For collecting fill triangles
    let fillPositions: number[] = [];

    scene.traverse((child: any) => {
      if (child.isMesh && child.geometry && child.geometry.attributes.color) {
        const colorAttr = child.geometry.attributes.color;
        const posAttr = child.geometry.attributes.position;
        const indexAttr = child.geometry.index;
        const count = colorAttr.count;

        // Restore all colors to original (no recoloring)
        if (child.geometry.userData.originalColors) {
          const orig = child.geometry.userData.originalColors;
          for (let i = 0; i < count * 3; i++) {
            colorAttr.array[i] = orig[i];
          }
          colorAttr.needsUpdate = true;
        } else {
          child.geometry.userData.originalColors = colorAttr.array.slice();
        }

        // Find highlighted vertices
        let highlighted = new Array(count).fill(false);
        if (highlightColor && Array.isArray(highlightColor) && highlightColor.length > 0) {
          for (let i = 0; i < count; i++) {
            const r = colorAttr.array[i * 3];
            const g = colorAttr.array[i * 3 + 1];
            const b = colorAttr.array[i * 3 + 2];
            if (highlightColor.some(c =>
              Math.abs(r - c.r) < 0.01 &&
              Math.abs(g - c.g) < 0.01 &&
              Math.abs(b - c.b) < 0.01
            )) {
              highlighted[i] = true;
            }
          }
        }

        // Build outline and fill geometry for highlighted triangles
        if (posAttr && (indexAttr || posAttr)) {
          // Get indices for triangles
          let indices: number[] = [];
          if (indexAttr) {
            indices = Array.from(indexAttr.array);
          } else {
            indices = Array.from({ length: posAttr.count }, (_, i) => i);
          }
          for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i], b = indices[i + 1], c = indices[i + 2];
            // If any vertex in the triangle is highlighted, outline and fill it
            if (highlighted[a] || highlighted[b] || highlighted[c]) {
              // Outline edges
              const edges = [
                [a, b],
                [b, c],
                [c, a],
              ];
              for (const [v1, v2] of edges) {
                const key = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
                if (!outlineSet.has(key)) {
                  outlineSet.add(key);
                  for (const vi of [v1, v2]) {
                    outlinePositions.push(
                      posAttr.getX(vi),
                      posAttr.getY(vi),
                      posAttr.getZ(vi)
                    );
                  }
                }
              }
              // Fill triangle
              fillPositions.push(
                posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a),
                posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b),
                posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c)
              );
            }
          }
        }
      }
    });
    // Create BufferGeometry for outline
    if (outlinePositions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(outlinePositions, 3));
      setOutlineGeometry(geometry);
    } else {
      setOutlineGeometry(null);
    }
    // Create BufferGeometry for fill
    if (fillPositions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(fillPositions, 3));
      setHighlightFillGeometry(geometry);
    } else {
      setHighlightFillGeometry(null);
    }
  }, [scene, highlightColor]);

  useEffect(() => {
    setScene(scene);
    setGltfJson(gltf.parser?.json);
  }, [scene, gltf.parser, setScene, setGltfJson]);
  return (
    <>
      <primitive object={scene} />
      {highlightFillGeometry && (
        <mesh geometry={highlightFillGeometry}>
          <meshBasicMaterial color={'#fbbf24'} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      {outlineGeometry && (
        <lineSegments geometry={outlineGeometry}>
          <lineBasicMaterial color={'#fbbf24'} linewidth={2} />
        </lineSegments>
      )}
    </>
  );
}

const RSModel: React.FC<RSModelProps> = ({
  id,
  width = '100%',
  height = 500,
  color = '#cccccc',
  wireframe = false,
  autoRotate = false,
  grid = true,
  backgroundType = 'color',
  backgroundColor = '#222222',
  backgroundImage = '',
  onStats,
  onTextureResults,
  onImages,
  animateTextures = true,
  highlightColor
}) => {
  const { selectedCacheType } = useCacheType();
  const [gltfUrl, setGltfUrl] = useState<string | null>(null);
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [gltfJson, setGltfJson] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [textureResults, setTextureResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedImages, setUsedImages] = useState<string[]>([]);

  // Sprite caching logic for model viewer with cache type support
  useEffect(() => {
    const cacheTypeId = selectedCacheType?.id || 'default';
    THREE.DefaultLoadingManager.setURLModifier((url) => {
      // Try to extract the vanilla texture index from the URL (e.g., .../62.png)
      const spriteMatch = url.match(/(\d+)\.png$/);
      if (spriteMatch) {
        const texId = parseInt(spriteMatch[1], 10);
        const spriteId = getSpriteIdFromTextureId(texId, textureResults);
        if (spriteId !== undefined) {
          const cacheKey = `sprite_${cacheTypeId}_${spriteId}_128_128_true`;
          const cached = localStorage.getItem(cacheKey);
          // Validate cached image is valid (starts with data:image/)
          const isValidCached = cached && cached.startsWith('data:image/');
          
          // If cached, return data URL directly (Three.js can load this without headers)
          if (isValidCached) {
            setTimeout(() => {
              setUsedImages((prev) => {
                if (!prev.includes(cached)) {
                  const next = [...prev, cached];
                  if (onImages) onImages(next);
                  return next;
                }
                return prev;
              });
            }, 0);
            return cached;
          }
          
          // If not cached, ensure cookie is set for Three.js to use, then return URL
          // The cookie will allow the proxy to route correctly even without header
          if (selectedCacheType && typeof window !== 'undefined') {
            const cacheTypeStr = JSON.stringify({
              ip: selectedCacheType.ip,
              port: selectedCacheType.port
            });
            document.cookie = `cache-type=${cacheTypeStr}; path=/; max-age=31536000`;
          }
          
          const imageUrl = buildUrl(`/public/sprite/${spriteId}`, { width: 128, height: 128, keepAspectRatio: true });
          setTimeout(() => {
            setUsedImages((prev) => {
              if (!prev.includes(imageUrl)) {
                const next = [...prev, imageUrl];
                if (onImages) onImages(next);
                return next;
              }
              return prev;
            });
          }, 0);
          // Cache in background for next time
          ensureSpriteCached(spriteId, cacheTypeId, fetchFromBuildUrl);
          return imageUrl;
        }
      }
      // Default: return the original URL
      return url;
    });
    setUsedImages([]);
    if (onImages) onImages([]);
  }, [textureResults, selectedCacheType?.id]);

  useEffect(() => {
    if (!id) {
      setGltfUrl(null);
      setScene(null);
      setGltfJson(null);
      setError("");
      setLoading(false);
      return;
    }
    setGltfUrl(`/models/${id}/scene.gltf`);
    setError(null);
    setLoading(true);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAndSet() {
      if (!id) {
        setTextureResults([]);
        if (onTextureResults) onTextureResults([]);
        setLoading(false);
        return;
      }
      const results = await fetchTextureResultsWithCache(fetchFromBuildUrl);
      if (!cancelled) {
        setTextureResults(results);
        if (onTextureResults) onTextureResults(results);
        setLoading(false);
      }
    }
    fetchAndSet();
    return () => { cancelled = true; };
  }, [id, onTextureResults]);

  useEffect(() => {
    if (scene && gltfJson && onStats) {
      const stats = extractModelStats(scene, gltfJson);
      onStats(stats); // stats now includes colorMap
    }
  }, [scene, gltfJson, onStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div style={{ width, height }} className="bg-zinc-900 rounded-lg overflow-hidden">
      {error && <div className="text-red-500">{error}</div>}
      {gltfUrl ? (
        <Canvas
          camera={{ position: [0, 1, 3], fov: 60 }}
          shadows
          style={{ background: backgroundType === 'color' ? backgroundColor : undefined, width: '100%', height: '100%' }}
          gl={{ preserveDrawingBuffer: true }}
        >
          {backgroundType === 'image' && backgroundImage && (
            <mesh position={[0, 0, -5]}>
              <planeGeometry args={[100, 100]} />
              <meshBasicMaterial>
                <primitive
                  attach="map"
                  object={new THREE.TextureLoader().load(backgroundImage)}
                />
              </meshBasicMaterial>
            </mesh>
          )}
          {grid && <gridHelper args={[10, 20, '#888', '#444']} />}
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 10, 7]} intensity={1.2} castShadow />
          <React.Suspense fallback={null}>
            <ModelViewer gltfUrl={gltfUrl} color={color} wireframe={wireframe} setScene={setScene} setGltfJson={setGltfJson} textureResults={textureResults} animateTextures={animateTextures} highlightColor={highlightColor}/>
          </React.Suspense>
          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-400">Enter a model ID and load the model.</div>
      )}
    </div>
  );
};

export default RSModel; 