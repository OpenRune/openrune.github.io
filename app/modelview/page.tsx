"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import RSModel from '@/lib/RSModel';
import ModelInfoSidebar from '@/components/ModelInfoSidebar';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';

type ColorRGB = { r: number; g: number; b: number };
type Stats = {
  vertices: number;
  triangles: number;
  materials: any[];
  colors: string[];
  colorMap: Record<string, ColorRGB[]>; // Required, never undefined
};

const HD_PASSWORD = process.env.NEXT_PUBLIC_HD_PASSWORD;

export default function ModelViewerPage() {
  const [modelId, setModelId] = useState("");
  const [modelIdInput, setModelIdInput] = useState("");
  const [stats, setStats] = useState<Stats>({
    vertices: 0,
    triangles: 0,
    materials: [],
    colors: [],
    colorMap: {}
  });
  const [textureResults, setTextureResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [grid, setGrid] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'color' | 'image'>('color');
  const [backgroundColor, setBackgroundColor] = useState('#222222');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [animateTextures, setAnimateTextures] = useState(true);
  const [highlightColor, setHighlightColor] = useState<ColorRGB[] | null>(null);

  const [hdMode, setHdMode] = useState(false);
  const [hdModalOpen, setHdModalOpen] = useState(false);
  const [hdPasswordInput, setHdPasswordInput] = useState("");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleTextureResults = useCallback((results: any[]) => {
    setTextureResults(results);
  }, []);

  useEffect(() => {
    setStats({ vertices: 0, triangles: 0, materials: [], colors: [], colorMap: {} });
  }, [modelId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('hdModeUnlocked') === 'true') {
      setHdMode(true);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'h' || e.key === 'H') && e.shiftKey) {
        if (!hdMode) {
          setHdModalOpen(true);
          setTimeout(() => passwordInputRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hdMode]);

  const handleHdPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hdPasswordInput === HD_PASSWORD) {
      setHdMode(true);
      setHdModalOpen(false);
      localStorage.setItem('hdModeUnlocked', 'true');
      setHdPasswordInput("");
    } else {
      alert('Incorrect password');
    }
  };

  // Fixed function: use fallback {} to ensure colorMap is never undefined
  const handleSetHighlightColor = (hex: string, event?: React.MouseEvent) => {
    const arr = (stats.colorMap || {})[hex];
    if (!arr || !Array.isArray(arr)) return setHighlightColor(null);
    const color = arr[0];
    setHighlightColor(prev => {
      if (event && (event.ctrlKey || event.metaKey)) {
        if (!prev) return [color];
        const found = prev.some(sel => sel.r === color.r && sel.g === color.g && sel.b === color.b);
        if (found) {
          const next = prev.filter(sel => !(sel.r === color.r && sel.g === color.g && sel.b === color.b));
          return next.length > 0 ? next : null;
        } else {
          return [...prev, color];
        }
      } else {
        return [color];
      }
    });
  };

  return (
      <div className="flex flex-row gap-6 items-start w-full max-w-full h-[calc(100vh-1.25rem)] min-h-0 mb-5">
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Model Viewer</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 h-full min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <RSModel
                    id={modelId}
                    width="100%"
                    height="100%"
                    onStats={setStats}
                    onTextureResults={handleTextureResults}
                    wireframe={wireframe}
                    autoRotate={autoRotate}
                    grid={grid}
                    backgroundType={backgroundType}
                    backgroundColor={backgroundColor}
                    backgroundImage={backgroundImage}
                    onImages={setModelImages}
                    animateTextures={animateTextures}
                    highlightColor={highlightColor as any}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-2">
          <ModelInfoSidebar
              stats={stats}
              textureResults={textureResults}
              modelIdInput={modelIdInput}
              setModelIdInput={setModelIdInput}
              onLoadModel={() => setModelId(modelIdInput)}
              wireframe={wireframe}
              setWireframe={setWireframe}
              autoRotate={autoRotate}
              setAutoRotate={setAutoRotate}
              grid={grid}
              setGrid={setGrid}
              backgroundType={backgroundType}
              setBackgroundType={setBackgroundType}
              backgroundColor={backgroundColor}
              setBackgroundColor={setBackgroundColor}
              backgroundImage={backgroundImage}
              setBackgroundImage={setBackgroundImage}
              modelImages={modelImages}
              animateTextures={animateTextures}
              setAnimateTextures={setAnimateTextures}
              highlightColor={highlightColor as any}
              setHighlightColor={handleSetHighlightColor}
              hdMode={false}
          />
          {false && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-950 border border-yellow-700">
                <h3 className="font-bold text-yellow-300 mb-2">HD Mode Panel</h3>
                <div>Show HD textures, settings, or debug info here.</div>
              </div>
          )}
        </div>

        {/* HD Password Modal */}
        {hdModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-zinc-900 p-6 rounded-lg shadow-lg flex flex-col min-w-[320px]">
                <h2 className="text-lg font-bold mb-2 text-yellow-300">Enter HD Mode Password</h2>
                <form onSubmit={handleHdPasswordSubmit} className="flex flex-col gap-2">
                  <input
                      ref={passwordInputRef}
                      type="password"
                      value={hdPasswordInput}
                      onChange={e => setHdPasswordInput(e.target.value)}
                      className="p-2 rounded border border-zinc-700 bg-zinc-800 text-yellow-200"
                      placeholder="Password"
                      autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button type="submit" className="bg-yellow-700 hover:bg-yellow-800 text-white px-4 py-1 rounded">Unlock</button>
                    <button type="button" className="bg-zinc-700 hover:bg-zinc-800 text-white px-4 py-1 rounded" onClick={() => setHdModalOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}
