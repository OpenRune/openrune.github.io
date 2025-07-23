import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { IconChevronDown } from '@tabler/icons-react';
import RSSprite from '@/lib/RSSprite';
import { getSpriteIdFromTextureId } from '../lib/RSModel';
import RSColorBox from '@/components/ui/RSColorBox';
import { convertHexToJagexHSL } from '@/components/ui/ColorUtils';

interface MaterialInfo {
  name: string;
  color?: string;
  textureImageIndex?: number;
}

type ColorRGB = { r: number; g: number; b: number };
interface ModelInfoSidebarProps {
  stats: {
    vertices: number;
    triangles: number;
    materials: MaterialInfo[];
    colors: string[];
    colorMap?: Record<string, ColorRGB[]>;
  };
  textureResults: any[];
  modelIdInput: string;
  setModelIdInput: (id: string) => void;
  onLoadModel: () => void;
  wireframe: boolean;
  setWireframe: (v: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  grid: boolean;
  setGrid: (v: boolean) => void;
  backgroundType: 'color' | 'image';
  setBackgroundType: (v: 'color' | 'image') => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  backgroundImage: string;
  setBackgroundImage: (v: string) => void;
  modelImages?: string[];
  animateTextures?: boolean;
  setAnimateTextures?: (v: boolean) => void;
  highlightColor?: ColorRGB[] | null;
  setHighlightColor?: (hex: string, event?: React.MouseEvent) => void;
  hdMode?: boolean;
}

const ModelInfoSidebar: React.FC<ModelInfoSidebarProps> = ({
                                                             stats,
                                                             textureResults,
                                                             modelIdInput,
                                                             setModelIdInput,
                                                             onLoadModel,
                                                             wireframe,
                                                             setWireframe,
                                                             autoRotate,
                                                             setAutoRotate,
                                                             grid,
                                                             setGrid,
                                                             backgroundType,
                                                             setBackgroundType,
                                                             backgroundColor,
                                                             setBackgroundColor,
                                                             backgroundImage,
                                                             setBackgroundImage,
                                                             modelImages,
                                                             animateTextures = true,
                                                             setAnimateTextures,
                                                             highlightColor = null,
                                                             setHighlightColor,
                                                             hdMode,
                                                           }) => {
  return (
      <Card className="w-[clamp(280px,28vw,360px)] max-w-[360px] min-w-[280px] h-full flex flex-col" style={{ background: 'rgba(30,30,30,0.97)' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Model Info</CardTitle>
        </CardHeader>
        <CardContent className="text-sm flex flex-col gap-2">
          <div className="flex flex-col gap-2 px-4 pt-2 pb-1">
            <Input
                id="model-id"
                type="text"
                placeholder="Model ID (e.g. 56208)"
                value={modelIdInput}
                onChange={e => setModelIdInput(e.target.value)}
            />
            <Button onClick={onLoadModel} className="mt-1 w-full" type="button" variant="default">
              Load by ID
            </Button>
          </div>
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-1 py-1 text-left font-semibold">
                <span>Render</span>
                <span data-state-open={undefined} className="ml-2">
                <IconChevronDown size={18} />
              </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-2 flex flex-col gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="wireframe-toggle">Wireframe:</Label>
                  <Input
                      id="wireframe-toggle"
                      type="checkbox"
                      checked={wireframe}
                      onChange={e => setWireframe(e.target.checked)}
                      className="w-4 h-4"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="grid-toggle">Grid:</Label>
                  <Input
                      id="grid-toggle"
                      type="checkbox"
                      checked={grid}
                      onChange={e => setGrid(e.target.checked)}
                      className="w-4 h-4"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="autorotate-toggle">Auto-Rotate:</Label>
                  <Input
                      id="autorotate-toggle"
                      type="checkbox"
                      checked={autoRotate}
                      onChange={e => setAutoRotate(e.target.checked)}
                      className="w-4 h-4"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Background:</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        {backgroundType === 'color' ? 'Color' : 'Image'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setBackgroundType('color')}>Color</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBackgroundType('image')}>Image</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {backgroundType === 'color' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bg-color-picker">BG Color:</Label>
                      <Input
                          id="bg-color-picker"
                          type="color"
                          value={backgroundColor}
                          onChange={e => setBackgroundColor(e.target.value)}
                          className="w-8 h-8 p-0 border-none bg-transparent"
                          style={{ minWidth: 32 }}
                      />
                    </div>
                )}
                {backgroundType === 'image' && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="bg-image-url">BG Image URL:</Label>
                      <Input
                          id="bg-image-url"
                          type="text"
                          value={backgroundImage}
                          onChange={e => setBackgroundImage(e.target.value)}
                          placeholder="/path/to/image.png"
                          className="text-xs"
                      />
                    </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="texture-anim-toggle">Texture Animation:</Label>
                  <input
                      id="texture-anim-toggle"
                      type="checkbox"
                      checked={animateTextures}
                      onChange={e => setAnimateTextures && setAnimateTextures(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                  />
                  <span>{animateTextures ? 'On' : 'Off'}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-1 py-1 text-left font-semibold">
                <span>Info</span>
                <span data-state-open={undefined} className="ml-2">
                <IconChevronDown size={18} />
              </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-2 flex flex-col gap-1 mt-2">
                <div><b>Vertices:</b> {stats.vertices || 0}</div>
                <div><b>Triangles:</b> {stats.triangles || 0}</div>
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <b>Materials:</b>
                  {hdMode ? (
                      modelImages && modelImages.length > 0 ? (
                          modelImages.map((img, i) => (
                              <div key={i} className="flex flex-col items-center">
                                <img src={img} width={40} height={40} style={{ borderRadius: 8, objectFit: 'cover', background: '#222' }}  alt={""}/>
                              </div>
                          ))
                      ) : '—'
                  ) : null}
                </div>
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <b>Colors:</b>
                  {stats.colors && stats.colors.length > 0 ? (
                      stats.colors.map((c, i) => (
                          <div
                              key={c}
                              className="flex flex-col items-center cursor-pointer"
                              onClick={e => setHighlightColor && setHighlightColor(c, e)}
                              style={{
                                outline: (
                                    highlightColor &&
                                    stats.colorMap &&
                                    stats.colorMap[c] &&
                                    highlightColor.some(sel =>
                                        stats.colorMap![c].some(a => a.r === sel.r && a.g === sel.g && a.b === sel.b)
                                    )
                                ) ? '2px solid #fbbf24' : undefined,
                                borderRadius: 4,
                              }}
                          >
                            <RSColorBox width={32} height={32} packedHsl={convertHexToJagexHSL(c)} tooltip={true} />
                          </div>
                      ))
                  ) : '—'}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
  );
};

export default ModelInfoSidebar;
