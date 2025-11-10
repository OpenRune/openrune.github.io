"use client";

import { useState, useRef, useEffect } from 'react';
import { Position } from '@/lib/map/model/Position';
import { Region } from '@/lib/map/model/Region';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, ArrowUp, ArrowDown, Grid3x3, Tag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MapInfoPanelProps {
  position: Position | null;
  plane: number;
  onPlaneChange: (plane: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showRegionGrid: boolean;
  onShowRegionGridChange: (show: boolean) => void;
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
  onGoToCoordinates?: (x: number, y: number, z: number) => void;
  onGoToRegionCoordinates?: (rx: number, ry: number) => void;
  onGoToRegion?: (regionId: number) => void;
  className?: string;
}

export function MapInfoPanel({ 
  position, 
  plane, 
  onPlaneChange, 
  zoom, 
  onZoomChange, 
  showRegionGrid, 
  onShowRegionGridChange, 
  showLabels, 
  onShowLabelsChange,
  onGoToCoordinates,
  onGoToRegionCoordinates,
  onGoToRegion,
  className 
}: MapInfoPanelProps) {
  const region = position ? Region.fromPosition(position) : null;
  const regionPos = region ? region.toPosition() : null;
  
  // Calculate region-local coordinates (offset within the region)
  const regionX = position && regionPos ? position.x - regionPos.x : null;
  const regionY = position && regionPos ? position.y - regionPos.y : null;

  // Editable coordinate inputs
  const [xInput, setXInput] = useState<string>(position?.x.toString() ?? '');
  const [yInput, setYInput] = useState<string>(position?.y.toString() ?? '');
  const [zInput, setZInput] = useState<string>((position?.z ?? plane).toString());
  const [rxInput, setRxInput] = useState<string>(regionX?.toString() ?? '');
  const [ryInput, setRyInput] = useState<string>(regionY?.toString() ?? '');
  const [regionIdInput, setRegionIdInput] = useState<string>(region?.id.toString() ?? '');
  const [focusedInput, setFocusedInput] = useState<'x' | 'y' | 'z' | 'rx' | 'ry' | 'regionId' | null>(null);

  // Update inputs when position changes (but not when user is editing)
  useEffect(() => {
    if (!focusedInput && position) {
      setXInput(position.x.toString());
      setYInput(position.y.toString());
      setZInput((position.z ?? plane).toString());
    }
    // Update RX and RY when position or region changes
    if (focusedInput !== 'rx' && focusedInput !== 'ry' && regionX !== null && regionY !== null) {
      setRxInput(regionX.toString());
      setRyInput(regionY.toString());
    }
    // Update Region ID when region changes
    if (focusedInput !== 'regionId' && region) {
      setRegionIdInput(region.id.toString());
    }
  }, [position, regionX, regionY, region, focusedInput]);

  // Always update Z input when plane changes (unless user is editing Z)
  useEffect(() => {
    if (focusedInput !== 'z') {
      setZInput(plane.toString());
    }
  }, [plane, focusedInput]);

  const handleCoordinateChange = (type: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'regionId', value: string) => {
    // Only allow integers
    const numValue = value.replace(/[^-0-9]/g, '');
    
    if (type === 'x') {
      setXInput(numValue);
    } else if (type === 'y') {
      setYInput(numValue);
    } else if (type === 'z') {
      // Z must be 0-3
      const num = parseInt(numValue);
      if (numValue === '' || (!isNaN(num) && num >= 0 && num <= 3)) {
        setZInput(numValue);
      }
    } else if (type === 'rx') {
      // RX must be 0-63 (offset within region)
      const num = parseInt(numValue);
      if (numValue === '' || (!isNaN(num) && num >= 0 && num <= 63)) {
        setRxInput(numValue);
      }
    } else if (type === 'ry') {
      // RY must be 0-63 (offset within region)
      const num = parseInt(numValue);
      if (numValue === '' || (!isNaN(num) && num >= 0 && num <= 63)) {
        setRyInput(numValue);
      }
    } else if (type === 'regionId') {
      // Region ID can be any positive integer
      setRegionIdInput(numValue);
    }
  };

  const handleCoordinateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'regionId') => {
    if (e.key === 'Enter') {
      if (type === 'rx' || type === 'ry') {
        handleGoToRegionCoordinates();
      } else if (type === 'regionId') {
        handleGoToRegion();
      } else {
        handleGoToCoordinates();
      }
      e.currentTarget.blur();
    }
  };

  const handleGoToCoordinates = () => {
    const x = parseInt(xInput);
    const y = parseInt(yInput);
    const z = parseInt(zInput);

    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && z >= 0 && z <= 3) {
      if (onGoToCoordinates) {
        onGoToCoordinates(x, y, z);
      }
    }
  };

  const handleGoToRegionCoordinates = () => {
    const rx = parseInt(rxInput);
    const ry = parseInt(ryInput);

    if (!isNaN(rx) && !isNaN(ry) && rx >= 0 && rx <= 63 && ry >= 0 && ry <= 63) {
      if (onGoToRegionCoordinates) {
        onGoToRegionCoordinates(rx, ry);
      }
    }
  };

  const handleGoToRegion = () => {
    const regionId = parseInt(regionIdInput);

    if (!isNaN(regionId) && regionId >= 0) {
      if (onGoToRegion) {
        onGoToRegion(regionId);
      }
    }
  };

  const handlePlaneUp = () => {
    if (plane < 3) {
      onPlaneChange(plane + 1);
    }
  };

  const handlePlaneDown = () => {
    if (plane > 0) {
      onPlaneChange(plane - 1);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 1, 11);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 1, 4);
    onZoomChange(newZoom);
  };

  return (
    <div className={cn("absolute z-[1000] flex flex-col gap-2", className)}>
      {/* Coordinates Box */}
      <Card className="shadow-lg py-2 px-3 w-fit">
        <CardContent className="p-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">X:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={xInput}
              onChange={(e) => handleCoordinateChange('x', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'x')}
              onFocus={() => setFocusedInput('x')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToCoordinates();
              }}
              className="h-5 w-16 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
            <span className="text-muted-foreground">Y:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={yInput}
              onChange={(e) => handleCoordinateChange('y', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'y')}
              onFocus={() => setFocusedInput('y')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToCoordinates();
              }}
              className="h-5 w-16 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
            <span className="text-muted-foreground">Z:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={zInput}
              onChange={(e) => handleCoordinateChange('z', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'z')}
              onFocus={() => setFocusedInput('z')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToCoordinates();
              }}
              className="h-5 w-12 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* Region Box */}
      <Card className="shadow-lg py-2 px-3 w-fit">
        <CardContent className="p-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Region:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={regionIdInput}
              onChange={(e) => handleCoordinateChange('regionId', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'regionId')}
              onFocus={() => setFocusedInput('regionId')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToRegion();
              }}
              className="h-5 w-16 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
            <span className="text-muted-foreground">RX:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={rxInput}
              onChange={(e) => handleCoordinateChange('rx', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'rx')}
              onFocus={() => setFocusedInput('rx')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToRegionCoordinates();
              }}
              className="h-5 w-12 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
            <span className="text-muted-foreground">RY:</span>
            <Input
              type="text"
              inputMode="numeric"
              value={ryInput}
              onChange={(e) => handleCoordinateChange('ry', e.target.value)}
              onKeyDown={(e) => handleCoordinateKeyDown(e, 'ry')}
              onFocus={() => setFocusedInput('ry')}
              onBlur={() => {
                setFocusedInput(null);
                handleGoToRegionCoordinates();
              }}
              className="h-5 w-12 px-1 py-0 text-xs font-mono bg-transparent border-border focus:bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plane Controls */}
      <Card className="shadow-lg py-2 px-3 w-fit">
        <CardContent className="p-0">
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Plane:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlaneDown}
                    disabled={plane === 0}
                    className={cn(
                      "h-7 w-7 border-border transition-all",
                      plane === 0 
                        ? "bg-black/50 border-border/50 opacity-50 cursor-not-allowed" 
                        : "bg-black/100 hover:bg-gray-800"
                    )}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plane Down</p>
                </TooltipContent>
              </Tooltip>
              <div className="text-xs font-medium w-6 text-center">
                {plane}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlaneUp}
                    disabled={plane === 3}
                    className={cn(
                      "h-7 w-7 border-border transition-all",
                      plane === 3 
                        ? "bg-black/50 border-border/50 opacity-50 cursor-not-allowed" 
                        : "bg-black/100 hover:bg-gray-800"
                    )}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Plane Up</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Zoom Controls */}
      <Card className="shadow-lg py-2 px-3 w-fit">
        <CardContent className="p-0">
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 4}
                    className="h-7 w-7 bg-black/100 border-border hover:bg-gray-800"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom Out</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 11}
                    className="h-7 w-7 bg-black/100 border-border hover:bg-gray-800"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom In</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Toggle Buttons */}
      <Card className="shadow-lg py-2 px-3 w-fit">
        <CardContent className="p-0">
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onShowRegionGridChange(!showRegionGrid)}
                    disabled={false}
                    className={cn(
                      "h-7 w-7 border-border transition-all relative",
                      showRegionGrid 
                        ? "bg-gray-700 border-gray-600 shadow-inner hover:bg-gray-700" 
                        : "bg-black/100 hover:bg-gray-900 border-border"
                    )}
                    aria-pressed={showRegionGrid}
                  >
                    {showRegionGrid && (
                      <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                    )}
                    <Grid3x3 className={cn(
                      "h-3.5 w-3.5 transition-opacity relative z-10",
                      showRegionGrid ? "opacity-100" : "opacity-70"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showRegionGrid ? 'Hide' : 'Show'} Region Grid</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onShowLabelsChange(!showLabels)}
                    disabled={false}
                    className={cn(
                      "h-7 w-7 border-border transition-all relative",
                      showLabels 
                        ? "bg-gray-700 border-gray-600 shadow-inner hover:bg-gray-700" 
                        : "bg-black/100 hover:bg-gray-900 border-border"
                    )}
                    aria-pressed={showLabels}
                  >
                    {showLabels && (
                      <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                    )}
                    <Tag className={cn(
                      "h-3.5 w-3.5 transition-opacity relative z-10",
                      showLabels ? "opacity-100" : "opacity-70"
                    )} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showLabels ? 'Hide' : 'Show'} Labels</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

