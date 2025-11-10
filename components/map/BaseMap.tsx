"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { LeafletMouseEvent, Map as LeafletMap, TileLayer } from 'leaflet';
import L from 'leaflet';
import { Region } from '@/lib/map/model/Region';
import { Position } from '@/lib/map/model/Position';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';

interface BaseMapProps {
  className?: string;
  children?: React.ReactNode;
  onMapReady?: (map: LeafletMap & { plane: number; tile_layer?: TileLayer; updateMapPath?: () => void }) => void;
  onPositionChange?: (position: Position) => void;
  onPlaneChange?: (plane: number) => void;
  initialPlane?: number;
  initialCenter?: { x: number; y: number; z: number };
  initialZoom?: number;
  showCoordinates?: boolean;
  showFullscreen?: boolean;
}

export function BaseMap({
  className,
  children,
  onMapReady,
  onPositionChange,
  onPlaneChange,
  initialPlane = 0,
  initialCenter,
  initialZoom,
  showCoordinates = true,
  showFullscreen = true,
}: BaseMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap & { plane: number; tile_layer?: TileLayer; updateMapPath?: () => void } | null>(null);
  const prevMouseRectRef = useRef<L.Rectangle | null>(null);
  const prevMousePosRef = useRef<Position | null>(null);

  const [plane, setPlane] = useState<number>(initialPlane);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update map tiles when plane changes
  const updateMapTiles = useCallback((newPlane: number) => {
    const map = mapInstanceRef.current;
    if (!map || !map.updateMapPath) return;

    map.plane = newPlane;
    map.updateMapPath();

    if (onPlaneChange) {
      onPlaneChange(newPlane);
    }
  }, [onPlaneChange]);

  // Initialize map (only once)
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined' || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, renderer: L.canvas() }) as L.Map & { plane: number; tile_layer?: TileLayer; updateMapPath?: () => void };
    map.plane = initialPlane;

    // Update map tiles function
    map.updateMapPath = function () {
      if (map.tile_layer) map.removeLayer(map.tile_layer);

      const tileUrl = `https://raw.githubusercontent.com/Mark7625/map_tiles/master/${map.plane}/{z}/{x}/{y}.png`;
      
      map.tile_layer = L.tileLayer(
        tileUrl,
        {
          minZoom: 4,
          maxZoom: 11,
          attribution: 'Map data',
          noWrap: true,
          tms: true,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 4,
          maxNativeZoom: 11, // Prevent tile upscaling
          tileSize: 256, // Explicit tile size
          zoomOffset: 0
        }
      );
      map.tile_layer.addTo(map);
      map.invalidateSize();
    };
    
    map.updateMapPath();
    map.getContainer().focus();

    // Mouse hover highlight
    map.on('mousemove', (e: LeafletMouseEvent) => {
      const mousePos = Position.fromLatLng(map, e.latlng, map.plane);
      if (!prevMousePosRef.current || !prevMousePosRef.current.equals(mousePos)) {
        prevMousePosRef.current = mousePos;
        setCurrentPosition(mousePos);
        if (onPositionChange) {
          onPositionChange(mousePos);
        }

        if (prevMouseRectRef.current) map.removeLayer(prevMouseRectRef.current);
        const mouseRect = mousePos.toLeaflet(map);
        prevMouseRectRef.current = mouseRect;
        mouseRect.addTo(map);
      }
    });

    map.getContainer().addEventListener('mouseleave', () => {
      const centre = map.getBounds().getCenter();
      const centrePos = Position.fromLatLng(map, centre, map.plane);
      setCurrentPosition(centrePos);
      if (onPositionChange) {
        onPositionChange(centrePos);
      }

      prevMousePosRef.current = null;
      if (prevMouseRectRef.current) {
        map.removeLayer(prevMouseRectRef.current);
        prevMouseRectRef.current = null;
      }
    });

    // Initialize position from URL or props
    const currentUrl = new URL(window.location.href);
    const urlCentreX = currentUrl.searchParams.get("centreX");
    const urlCentreY = currentUrl.searchParams.get("centreY");
    const urlCentreZ = currentUrl.searchParams.get("centreZ");
    const urlZoom = currentUrl.searchParams.get("zoom");
    const urlRegionID = currentUrl.searchParams.get("regionID");

    let zoom = urlZoom ? Number(urlZoom) : (initialZoom ?? 7);
    let centreLatLng: [number, number] = [-79, -137];

    if (initialCenter) {
      const centrePos = new Position(initialCenter.x, initialCenter.y, initialCenter.z);
      centreLatLng = centrePos.toLatLng(map);
      map.plane = initialCenter.z;
      setPlane(initialCenter.z);
    } else if (urlCentreX && urlCentreY && urlCentreZ) {
      const centrePos = new Position(Number(urlCentreX), Number(urlCentreY), Number(urlCentreZ));
      centreLatLng = centrePos.toLatLng(map);
      map.plane = Number(urlCentreZ);
      setPlane(Number(urlCentreZ));
    } else if (urlRegionID) {
      const region = new Region(Number(urlRegionID));
      const centrePos = region.toCentrePosition();
      centreLatLng = centrePos.toLatLng(map);
      zoom = urlZoom ? Number(urlZoom) : 9;
      map.plane = centrePos.z;
      setPlane(centrePos.z);
    }

    map.setView(centreLatLng, zoom);
    setCurrentPosition(Position.fromLatLng(map, map.getBounds().getCenter(), map.plane));

    // Update URL params on move/zoom
    const updateUrl = () => {
      const centre = map.getBounds().getCenter();
      const centrePos = Position.fromLatLng(map, centre, map.plane);
      const currentZoom = map.getZoom();
      window.history.replaceState(null, '', `?centreX=${centrePos.x}&centreY=${centrePos.y}&centreZ=${centrePos.z}&zoom=${currentZoom}`);
    };

    map.on('moveend', updateUrl);
    map.on('zoomend', updateUrl);

    mapInstanceRef.current = map;

    // Notify parent that map is ready
    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      map.off('moveend', updateUrl);
      map.off('zoomend', updateUrl);
      if (prevMouseRectRef.current) {
        map.removeLayer(prevMouseRectRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Only run once on mount

  // Update plane and tiles when plane state changes (only if map is initialized)
  useEffect(() => {
    if (mapInstanceRef.current && mapInstanceRef.current.plane !== plane) {
      updateMapTiles(plane);
    }
  }, [plane, updateMapTiles]);

  // Fullscreen handling
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Expose plane setter for external use (used by OSRSMap)
  const setPlaneExternal = useCallback((newPlane: number) => {
    if (newPlane >= 0 && newPlane <= 3 && newPlane !== plane) {
      setPlane(newPlane);
    }
  }, [plane]);

  // Expose map instance getter
  const getMapInstance = useCallback(() => {
    return mapInstanceRef.current;
  }, []);

  // Store setter on map instance when ready
  useEffect(() => {
    if (mapInstanceRef.current) {
      (mapInstanceRef.current as any).setPlane = setPlaneExternal;
    }
  }, [setPlaneExternal]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }} className={className}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Fullscreen Button */}
      {showFullscreen && (
        <div className="absolute top-4 right-4 z-[1000]">
          <Card className="p-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleFullscreen}
              className="h-9 w-9 bg-black border-border hover:bg-gray-800 text-white"
              aria-label="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </Card>
        </div>
      )}

      {/* Coordinates Display */}
      {showCoordinates && currentPosition && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Card className="shadow-lg py-2 px-3">
            <CardContent className="p-0 text-xs">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-muted-foreground">X:</span>
                <span className="text-foreground">{currentPosition.x}</span>
                <span className="text-muted-foreground">Y:</span>
                <span className="text-foreground">{currentPosition.y}</span>
                <span className="text-muted-foreground">Z:</span>
                <span className="text-foreground">{currentPosition.z}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Children (extra controls) */}
      {children}
    </div>
  );
}

// Export a way to get the map instance (for advanced usage)
export type BaseMapInstance = LeafletMap & { 
  plane: number; 
  tile_layer?: TileLayer; 
  updateMapPath?: () => void;
  setPlane?: (plane: number) => void;
};

