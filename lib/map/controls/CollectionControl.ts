'use strict';

import * as L from 'leaflet';

import { Position } from '../model/Position';
import { Area } from '../model/Area';
import { Areas } from '../model/Areas';
import { PolyArea } from '../model/PolyArea';
import { Path } from '../model/Path';

import { HD117AreasConverter } from '../converters/117hd/HD117AreasConverter';
import { RuneLitePathConverter } from '../converters/runelite/RuneLitePathConverter';
import { isAreaInViewport, isPolygonInViewport } from '../utils/viewportCulling';

type ConverterSet = {
    areas_converter: HD117AreasConverter;
    polyarea_converter: RuneLitePathConverter;
};

// Throttle function for performance optimization
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
    let inThrottle: boolean;
    return ((...args: any[]) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    }) as T;
}

const converters: Record<string, ConverterSet> = {
    '117HD': {
        areas_converter: new HD117AreasConverter(),
        polyarea_converter: new RuneLitePathConverter(),
    },
};

export class CollectionControl extends L.Control {
    private _map!: L.Map;
    private _areas!: Areas;
    private _polyArea!: PolyArea;
    private _path!: Path;
    private _currentDrawable?: Areas | PolyArea | Path;
    private _currentConverter?: 'areas_converter' | 'polyarea_converter';
    private _drawnMouseArea?: L.Layer;
    private _firstSelectedAreaPosition?: Position;
    private _editing = false;
    private _resizeHandles: L.Marker[] = [];
    private _centerDragHandle: L.Marker | null = null;
    private _selectedAreaIndex: number | null = null;
    private _selectedPolyArea: boolean = false;
    private _pendingUpdate: number | null = null;
    private _viewportUpdateTimer: number | null = null;
    private _isViewportCullingEnabled: boolean = true;

    constructor(options?: L.ControlOptions) {
        super(options);
    }

    onAdd(leafletMap: L.Map): HTMLElement {
        this._map = leafletMap;

        this._areas = new Areas(leafletMap);
        this._polyArea = new PolyArea(leafletMap);
        this._path = new Path(leafletMap);
        
        // Initialize mouse area drawing handler with requestAnimationFrame for smooth updates
        this._drawMouseAreaThrottled = (e: L.LeafletMouseEvent) => {
            if (!this._editing || !this._currentDrawable) return;
            
            // Cancel any pending update - we only want the latest
            if (this._pendingUpdate !== null) {
                cancelAnimationFrame(this._pendingUpdate);
            }
            
            // Store event data for the update
            const mouseEvent = e;
            
            // Schedule update on next frame
            this._pendingUpdate = requestAnimationFrame(() => {
                this._pendingUpdate = null;
                
                // Re-check conditions (they might have changed)
                if (!this._editing || !this._currentDrawable) return;
                
                const mousePos = Position.fromLatLng(this._map, mouseEvent.latlng, (this._map as any).plane);

                if (this._currentDrawable instanceof Areas && this._firstSelectedAreaPosition) {
                    // Remove old preview if it exists
                    if (this._drawnMouseArea) {
                        this._map.removeLayer(this._drawnMouseArea);
                    }
                    
                    // Create new preview rectangle with visible styling
                    this._drawnMouseArea = new Area(this._firstSelectedAreaPosition, mousePos).toLeaflet(this._map);
                    // Ensure rectangle is visible and on top
                    if (this._drawnMouseArea instanceof L.Rectangle) {
                        this._drawnMouseArea.setStyle({
                            color: "#33b5e5",
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.1,
                            interactive: false
                        });
                        this._drawnMouseArea.bringToFront();
                    }
                    this._drawnMouseArea.addTo(this._map);
                } else if (this._currentDrawable instanceof PolyArea) {
                    // For polygons, recreate as they have variable vertices
                    if (this._drawnMouseArea) {
                        this._map.removeLayer(this._drawnMouseArea);
                    }
                    const poly = new PolyArea(this._map);
                    poly.addAll(this._currentDrawable.positions);
                    poly.add(mousePos);
                    this._drawnMouseArea = poly.toLeaflet();
                    this._drawnMouseArea.addTo(this._map);
                }
            });
        };

        // Create minimal container (required by Leaflet Control interface)
        // Container is hidden since we use React UI instead of Leaflet controls
        const container = L.DomUtil.create('div') as HTMLDivElement;
        container.style.display = 'none';

        // Attach map event handlers for drawing functionality
        this._map.on('click', this._addPosition, this);
        this._map.on('contextmenu', this._addPositionRightClick, this);
        this._map.on('mousemove', this._drawMouseAreaThrottled, this);
        
        // Attach viewport change handlers for culling
        this._map.on('moveend', this._updateViewportVisibility, this);
        this._map.on('zoomend', this._updateViewportVisibility, this);
        this._map.on('move', this._updateViewportVisibilityThrottled, this);
        this._map.on('planeChanged', this._updateViewportVisibility, this);
        
        // Initial viewport visibility update after a short delay to ensure map is fully initialized
        setTimeout(() => {
            this._updateViewportVisibility();
        }, 100);

        return container;
    }

    onRemove(): void {
        // Clean up event handlers and cancel pending updates
        this._map.off('click', this._addPosition, this);
        this._map.off('contextmenu', this._addPositionRightClick, this);
        this._map.off('mousemove', this._drawMouseAreaThrottled, this);
        this._map.off('moveend', this._updateViewportVisibility, this);
        this._map.off('zoomend', this._updateViewportVisibility, this);
        this._map.off('move', this._updateViewportVisibilityThrottled, this);
        this._map.off('planeChanged', this._updateViewportVisibility, this);
        if (this._pendingUpdate !== null) {
            cancelAnimationFrame(this._pendingUpdate);
            this._pendingUpdate = null;
        }
        if (this._viewportUpdateTimer !== null) {
            clearTimeout(this._viewportUpdateTimer);
            this._viewportUpdateTimer = null;
        }
    }

    private _addPosition(e: L.LeafletMouseEvent) {
        if (!this._editing || !this._currentDrawable) return;
        const pos = Position.fromLatLng(this._map, e.latlng, (this._map as any).plane);

        if (this._currentDrawable instanceof Areas) {
            if (!this._firstSelectedAreaPosition) {
                // Check if clicking within or near a selected area
                if (this._isPositionNearSelectedArea(pos)) {
                    // Don't start drawing if clicking on/near selected area
                    return;
                }
                this._firstSelectedAreaPosition = pos;
            } else {
                this._drawnMouseArea && this._map.removeLayer(this._drawnMouseArea);
                this._areas.add(new Area(this._firstSelectedAreaPosition, pos));
                this._firstSelectedAreaPosition = undefined;
            }
        } else if (this._currentDrawable instanceof Path) {
            // For paths, just add the point directly
            this._currentDrawable.add(pos);
        } else {
            this._currentDrawable.add(pos);
        }
    }

    private _addPositionRightClick(e: L.LeafletMouseEvent) {
        // Prevent default context menu
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
        }
        
        // Only add points for Path tool on right-click
        if (!this._editing || !this._currentDrawable) return;
        if (!(this._currentDrawable instanceof Path)) return;
        
        const pos = Position.fromLatLng(this._map, e.latlng, (this._map as any).plane);
        this._currentDrawable.add(pos);
    }

    // Check if a position is within or near a selected area
    private _isPositionNearSelectedArea(pos: Position): boolean {
        // Check if there's a selected area
        if (this._selectedAreaIndex === null) return false;
        if (this._selectedAreaIndex < 0 || this._selectedAreaIndex >= this._areas.areas.length) return false;
        
        const selectedArea = this._areas.areas[this._selectedAreaIndex];
        
        // Get the bounds of the selected area
        const minX = Math.min(selectedArea.startPosition.x, selectedArea.endPosition.x);
        const maxX = Math.max(selectedArea.startPosition.x, selectedArea.endPosition.x);
        const minY = Math.min(selectedArea.startPosition.y, selectedArea.endPosition.y);
        const maxY = Math.max(selectedArea.startPosition.y, selectedArea.endPosition.y);
        
        // Add a buffer of 2 tiles around the area to prevent accidental starts
        const buffer = 2;
        
        // Check if position is within the buffered bounds and on the same plane
        if (pos.z !== selectedArea.startPosition.z) return false;
        
        return pos.x >= (minX - buffer) && 
               pos.x <= (maxX + buffer) && 
               pos.y >= (minY - buffer) && 
               pos.y <= (maxY + buffer);
    }

    // Throttled mouse area drawing for better performance (~60fps)
    private _drawMouseAreaThrottled!: ((e: L.LeafletMouseEvent) => void);
    
    // Update visibility of areas and polygons based on viewport
    private _updateViewportVisibility = () => {
        if (!this._isViewportCullingEnabled) return;
        
        const plane = (this._map as any).plane || 0;
        // Large padding in game coordinates to prevent pop-in when panning
        // This is roughly 4-5 regions worth of buffer
        const viewportPadding = 400;
        
        // Update area visibility
        this._areas.areas.forEach((area, index) => {
            // Always show selected area
            if (index === this._selectedAreaIndex) {
                if (!this._areas.featureGroup.hasLayer(this._areas.rectangles[index])) {
                    this._areas.featureGroup.addLayer(this._areas.rectangles[index]);
                }
                return;
            }
            
            // Check if area is on current plane
            if (area.startPosition.z !== plane) {
                // Hide areas on different planes
                if (this._areas.featureGroup.hasLayer(this._areas.rectangles[index])) {
                    this._areas.featureGroup.removeLayer(this._areas.rectangles[index]);
                }
                return;
            }
            
            // Check if area is in viewport
            const isVisible = isAreaInViewport(this._map, area, viewportPadding);
            
            if (isVisible) {
                if (!this._areas.featureGroup.hasLayer(this._areas.rectangles[index])) {
                    this._areas.featureGroup.addLayer(this._areas.rectangles[index]);
                }
            } else {
                if (this._areas.featureGroup.hasLayer(this._areas.rectangles[index])) {
                    this._areas.featureGroup.removeLayer(this._areas.rectangles[index]);
                }
            }
        });
        
        // Update polygon visibility
        if (this._polyArea.polygon && this._polyArea.positions.length > 0) {
            // Always show selected polygon
            if (this._selectedPolyArea) {
                if (!this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                    this._polyArea.featureGroup.addLayer(this._polyArea.polygon);
                }
                return;
            }
            
            // Check if polygon is on current plane (all positions should be on same plane)
            const firstPos = this._polyArea.positions[0];
            if (firstPos && firstPos.z !== plane) {
                // Hide polygon on different plane
                if (this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                    this._polyArea.featureGroup.removeLayer(this._polyArea.polygon);
                }
                return;
            }
            
            // Check if polygon is in viewport
            const isVisible = isPolygonInViewport(this._map, this._polyArea.positions, viewportPadding);
            
            if (isVisible) {
                if (!this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                    this._polyArea.featureGroup.addLayer(this._polyArea.polygon);
                }
            } else {
                if (this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                    this._polyArea.featureGroup.removeLayer(this._polyArea.polygon);
                }
            }
        }
    };
    
    // Throttled viewport visibility update
    private _updateViewportVisibilityThrottled = () => {
        if (this._viewportUpdateTimer !== null) {
            clearTimeout(this._viewportUpdateTimer);
        }
        this._viewportUpdateTimer = window.setTimeout(() => {
            this._updateViewportVisibility();
            this._viewportUpdateTimer = null;
        }, 150); // Update every 150ms during movement
    };

    private _toggleCollectionMode(drawable?: Areas | PolyArea | Path, converter?: keyof ConverterSet) {
        if (!drawable || this._currentDrawable === drawable) {
            this._editing = false;
            if (this._drawnMouseArea) {
                this._map.removeLayer(this._drawnMouseArea);
                this._drawnMouseArea = undefined;
            }
            this._currentDrawable && this._map.removeLayer(this._currentDrawable.featureGroup);
            this._currentDrawable = undefined;
            this._currentConverter = undefined;
            this._firstSelectedAreaPosition = undefined;
            return;
        }

        this._editing = true;
        this._currentConverter = converter;
        if (this._drawnMouseArea) {
            this._map.removeLayer(this._drawnMouseArea);
            this._drawnMouseArea = undefined;
        }
        this._currentDrawable && this._map.removeLayer(this._currentDrawable.featureGroup);
        this._firstSelectedAreaPosition = undefined;

        this._currentDrawable = drawable;
        this._map.addLayer(this._currentDrawable.featureGroup);
        
        // Update viewport visibility after adding drawable (only for Areas and PolyArea)
        if (drawable instanceof Areas || drawable instanceof PolyArea) {
            this._updateViewportVisibility();
        }
    }



    // Public methods for React integration
    getAreas(): Area[] {
        return this._areas.areas;
    }

    getPolyArea(): Position[] {
        return this._polyArea.positions;
    }

    getPath(): Position[] {
        return this._path.positions;
    }

    simplifyPath(): void {
        this._path.simplify();
    }

    setToolMode(mode: 'area' | 'poly' | 'path' | null) {
        if (mode === 'area') {
            this._toggleCollectionMode(this._areas, 'areas_converter');
        } else if (mode === 'poly') {
            this._toggleCollectionMode(this._polyArea, 'polyarea_converter');
        } else if (mode === 'path') {
            this._toggleCollectionMode(this._path, undefined);
        } else {
            this._toggleCollectionMode(undefined, undefined);
        }
    }

    clearAreas() {
        this._areas.removeAll();
    }

    clearPolyArea() {
        this._polyArea.removeAll();
    }

    clearPath() {
        this._path.removeAll();
    }

    clearAll() {
        this._areas.removeAll();
        this._polyArea.removeAll();
        this._path.removeAll();
    }

    importFromText(text: string, type: 'area' | 'poly') {
        try {
            if (type === 'area') {
                this._currentDrawable = this._areas;
                this._currentConverter = 'areas_converter';
                // Ensure areas featureGroup is added to map
                if (!this._map.hasLayer(this._areas.featureGroup)) {
                    this._map.addLayer(this._areas.featureGroup);
                }
            // Update viewport visibility after import
            this._updateViewportVisibility();
            } else {
                this._currentDrawable = this._polyArea;
                this._currentConverter = 'polyarea_converter';
                // Ensure polyArea featureGroup is added to map
                if (!this._map.hasLayer(this._polyArea.featureGroup)) {
                    this._map.addLayer(this._polyArea.featureGroup);
                }
            }
            
            // The converter expects text without outer braces - it wraps it with {${text}}
            let processedText = text.trim();
            
            // Remove outer braces if present (from full JSON objects)
            if (processedText.startsWith('{') && processedText.endsWith('}')) {
                processedText = processedText.slice(1, -1).trim();
            }
            
            // Call converter directly without needing DOM element
        const converter = converters['117HD'][this._currentConverter];
            const plainText = processedText.replace(/\n|\t/g, ' ').trim();
            
            if (plainText) {
                // Type assertion needed because converter.fromJava accepts union types
                (converter.fromJava as any)(plainText, this._currentDrawable);
            }
            // Update viewport visibility after import
            this._updateViewportVisibility();
        } catch (error) {
            throw error;
        }
    }

    // Import polygon from raw coordinates (x,y,z format, one per line)
    importPolygonFromRaw(text: string) {
        const lines = text.trim().split('\n').filter(line => line.trim());
        this._polyArea.removeAll();
        
        for (const line of lines) {
            const parts = line.trim().split(',').map(p => p.trim());
            if (parts.length >= 2) {
                const x = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
                const z = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    this._polyArea.add(new Position(x, y, z));
                }
            }
        }
        
        // Ensure polygon featureGroup is added to map
            if (!this._map.hasLayer(this._polyArea.featureGroup)) {
                this._map.addLayer(this._polyArea.featureGroup);
            }
        // Update viewport visibility after import
        this._updateViewportVisibility();
    }

    // Import path from raw coordinates (x,y,z format, one per line)
    importPathFromRaw(text: string) {
        const lines = text.trim().split('\n').filter(line => line.trim());
        this._path.removeAll();
        
        for (const line of lines) {
            const parts = line.trim().split(',').map(p => p.trim());
            if (parts.length >= 2) {
                const x = parseInt(parts[0], 10);
                const y = parseInt(parts[1], 10);
                const z = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    this._path.add(new Position(x, y, z));
                }
            }
        }
        
        // Ensure path featureGroup is added to map
        if (!this._map.hasLayer(this._path.featureGroup)) {
            this._map.addLayer(this._path.featureGroup);
        }
    }

    // Import path from array of coordinates
    importPathFromPoints(points: Array<{ x: number; y: number; z?: number }>) {
        this._path.removeAll();
        
        for (const point of points) {
            const z = point.z !== undefined ? point.z : 0;
            this._path.add(new Position(point.x, point.y, z));
        }
        
        // Ensure path featureGroup is added to map
        if (!this._map.hasLayer(this._path.featureGroup)) {
            this._map.addLayer(this._path.featureGroup);
        }
    }

    // Highlight verification tiles in red
    highlightPathVerificationTiles(coords: Array<{ x: number; y: number; z?: number }>) {
        this._path.highlightVerificationTiles(coords);
    }

    // Clear verification tiles
    clearPathVerificationTiles() {
        this._path.clearVerificationTiles();
    }

    isEditing(): boolean {
        return this._editing;
    }

    getCurrentTool(): 'area' | 'poly' | 'path' | null {
        if (this._currentDrawable === this._areas) return 'area';
        if (this._currentDrawable === this._polyArea) return 'poly';
        if (this._currentDrawable === this._path) return 'path';
        return null;
    }

    // Remove area by index
    removeArea(index: number) {
        if (index < 0 || index >= this._areas.areas.length) return;
        
        // Clear highlights if this area was selected
        if (this._selectedAreaIndex === index) {
            this._clearResizeHandles();
            this._selectedAreaIndex = null;
        } else if (this._selectedAreaIndex !== null && this._selectedAreaIndex > index) {
            // Adjust selected index if an earlier area was removed
            this._selectedAreaIndex--;
        }
        
        // Remove from arrays
        this._areas.areas.splice(index, 1);
        const rectangle = this._areas.rectangles.splice(index, 1)[0];
        if (rectangle) {
            this._areas.featureGroup.removeLayer(rectangle);
        }
    }

    // Hide/show area by index
    setAreaVisible(index: number, visible: boolean) {
        if (index < 0 || index >= this._areas.rectangles.length) return;
        const rectangle = this._areas.rectangles[index];
        
        if (visible) {
            // Only add if it should be visible (viewport culling will handle it, but this overrides)
            if (!this._areas.featureGroup.hasLayer(rectangle)) {
                this._areas.featureGroup.addLayer(rectangle);
            }
        } else {
            if (this._areas.featureGroup.hasLayer(rectangle)) {
                this._areas.featureGroup.removeLayer(rectangle);
            }
            // Clear highlights if hiding the selected area
            if (this._selectedAreaIndex === index) {
                this._clearResizeHandles();
                this._selectedAreaIndex = null;
            }
        }
    }
    
    // Enable/disable viewport culling
    setViewportCullingEnabled(enabled: boolean) {
        this._isViewportCullingEnabled = enabled;
        if (enabled) {
            // Update visibility when enabling
            this._updateViewportVisibility();
        } else {
            // Show all areas when disabling
            this._areas.rectangles.forEach(rectangle => {
                if (!this._areas.featureGroup.hasLayer(rectangle)) {
                    this._areas.featureGroup.addLayer(rectangle);
                }
            });
            if (this._polyArea.polygon && !this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                this._polyArea.featureGroup.addLayer(this._polyArea.polygon);
            }
        }
    }

    // Check if area is visible
    isAreaVisible(index: number): boolean {
        if (index < 0 || index >= this._areas.rectangles.length) return false;
        const rectangle = this._areas.rectangles[index];
        return this._areas.featureGroup.hasLayer(rectangle);
    }

    // Export area in different formats
    exportArea(index: number, format: 'json' | 'java' | 'array' | 'raw'): string {
        if (index < 0 || index >= this._areas.areas.length) return '';
        
        const area = this._areas.areas[index];
        const minX = Math.min(area.startPosition.x, area.endPosition.x);
        const maxX = Math.max(area.startPosition.x, area.endPosition.x);
        const minY = Math.min(area.startPosition.y, area.endPosition.y);
        const maxY = Math.max(area.startPosition.y, area.endPosition.y);
        const plane = area.startPosition.z;
        
        switch (format) {
            case 'json':
                return JSON.stringify({
                    minX,
                    minY,
                    maxX,
                    maxY,
                    plane
                }, null, 2);
            case 'java':
                const converter = converters['117HD'].areas_converter;
                const singleArea = converter.toJavaSingle(area);
                // Remove brackets and create Java AABB constructor call
                const values = singleArea.replace(/[\[\]]/g, '');
                return `new AABB(${values})`;
            case 'array':
                return plane > 0
                    ? `[ ${minX}, ${minY}, ${plane}, ${maxX}, ${maxY}, ${plane} ]`
                    : `[ ${minX}, ${minY}, ${maxX}, ${maxY} ]`;
            case 'raw':
                return plane > 0
                    ? `${minX},${minY},${plane},${maxX},${maxY},${plane}`
                    : `${minX},${minY},${maxX},${maxY}`;
            default:
                return '';
        }
    }

    // Export poly area in different formats
    exportPolyArea(format: 'json' | 'java' | 'array' | 'raw'): string {
        if (this._polyArea.positions.length === 0) return '';
        
        const positions = this._polyArea.positions;
        
        switch (format) {
            case 'json':
                return JSON.stringify({
                    positions: positions.map(pos => ({
                        x: pos.x,
                        y: pos.y,
                        z: pos.z
                    }))
                }, null, 2);
            case 'java':
                const converter = converters['117HD'].polyarea_converter;
                // Create a temporary Areas-like object for conversion
                const polyAsString = positions.map(pos => 
                    `new WorldPoint(${pos.x}, ${pos.y}, ${pos.z})`
                ).join(',\n    ');
                return `new WorldPoint[] {\n    ${polyAsString}\n}`;
            case 'array':
                return positions.map(pos => 
                    pos.z > 0 ? `[ ${pos.x}, ${pos.y}, ${pos.z} ]` : `[ ${pos.x}, ${pos.y} ]`
                ).join(',\n');
            case 'raw':
                return positions.map(pos => 
                    pos.z > 0 ? `${pos.x},${pos.y},${pos.z}` : `${pos.x},${pos.y}`
                ).join('\n');
            default:
                return '';
        }
    }

    // Hide/show poly area
    setPolyAreaVisible(visible: boolean) {
        if (!this._polyArea.polygon) return;
        
        if (visible) {
            if (!this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                this._polyArea.featureGroup.addLayer(this._polyArea.polygon);
            }
        } else {
            if (this._polyArea.featureGroup.hasLayer(this._polyArea.polygon)) {
                this._polyArea.featureGroup.removeLayer(this._polyArea.polygon);
            }
            // Clear highlights if hiding the selected poly
            if (this._selectedPolyArea) {
                this._clearResizeHandles();
                this._selectedPolyArea = false;
            }
        }
    }

    // Check if poly area is visible
    isPolyAreaVisible(): boolean {
        if (!this._polyArea.polygon) return false;
        return this._polyArea.featureGroup.hasLayer(this._polyArea.polygon);
    }

    // Export path in different formats (matches Java Polygon format)
    exportPath(format: 'json' | 'java' | 'array' | 'raw'): string {
        if (this._path.positions.length === 0) return '';
        
        const positions = this._path.positions;
        
        switch (format) {
            case 'json':
                // JSON format matching Java Polygon adapter
                const points = positions.map(pos => 
                    pos.z > 0 ? [pos.x, pos.y, pos.z] : [pos.x, pos.y]
                );
                return JSON.stringify(points, null, 2);
            case 'java':
                // Java format: new Polygon(new int[][] { {x1, y1, z1}, {x2, y2, z2}, ... })
                const javaPoints = positions.map(pos => 
                    pos.z > 0 ? `{${pos.x}, ${pos.y}, ${pos.z}}` : `{${pos.x}, ${pos.y}}`
                ).join(',\n    ');
                return `new Polygon(new int[][] {\n    ${javaPoints}\n})`;
            case 'array':
                return positions.map(pos => 
                    pos.z > 0 ? `[ ${pos.x}, ${pos.y}, ${pos.z} ]` : `[ ${pos.x}, ${pos.y} ]`
                ).join(',\n');
            case 'raw':
                return positions.map(pos => 
                    pos.z > 0 ? `${pos.x},${pos.y},${pos.z}` : `${pos.x},${pos.y}`
                ).join('\n');
            default:
                return '';
        }
    }

    // Remove last point from path
    removeLastPathPoint() {
        this._path.removeLast();
    }

    // Highlight a specific area by index
    highlightArea(index: number, highlight: boolean = true) {
        if (index < 0 || index >= this._areas.rectangles.length) return;
        const rectangle = this._areas.rectangles[index];
        
        // Clear previous resize handles
        this._clearResizeHandles();
        
        if (highlight) {
            rectangle.setStyle({
                color: "#ff9500", // Orange color for selected
                weight: 2,
                opacity: 1
            });
            
            // Make rectangle draggable
            rectangle.setStyle({ interactive: true });
            this._makeRectangleDraggable(rectangle, index);
            
            this._selectedAreaIndex = index;
            this._selectedPolyArea = false;
            this._addResizeHandlesForArea(index);
            this._addCenterDragHandleForArea(index);
        } else {
            rectangle.setStyle({
                color: "#33b5e5", // Default blue
                weight: 1,
                opacity: 1,
                interactive: false
            });
            // Remove drag handlers
            rectangle.off('mousedown');
            this._map.off('mousemove');
            this._map.off('mouseup');
            this._map.off('mouseleave');
            this._selectedAreaIndex = null;
        }
    }

    // Highlight the polygon
    highlightPolyArea(highlight: boolean = true) {
        if (!this._polyArea.polygon) return;
        
        // Clear previous resize handles
        this._clearResizeHandles();
        
        if (highlight) {
            this._polyArea.polygon.setStyle({
                color: "#ff9500", // Orange color for selected
                weight: 2,
                opacity: 1,
                interactive: true
            });
            
            // Make polygon draggable
            this._makePolygonDraggable(this._polyArea.polygon);
            
            this._selectedAreaIndex = null;
            this._selectedPolyArea = true;
            this._addResizeHandlesForPolyArea();
            this._addCenterDragHandleForPolyArea();
        } else {
            this._polyArea.polygon.setStyle({
                color: "#33b5e5", // Default blue
                weight: 1,
                opacity: 1,
                interactive: false
            });
            // Remove drag handlers
            this._polyArea.polygon.off('mousedown');
            this._map.off('mousemove');
            this._map.off('mouseup');
            this._map.off('mouseleave');
            this._selectedPolyArea = false;
        }
    }

    // Clear all highlights
    clearHighlights() {
        this._clearResizeHandles();
        
        this._areas.rectangles.forEach((rectangle) => {
            rectangle.setStyle({
                color: "#33b5e5",
                weight: 1,
                opacity: 1
            });
        });
        if (this._polyArea.polygon) {
            this._polyArea.polygon.setStyle({
                color: "#33b5e5",
                weight: 1,
                opacity: 1
            });
        }
        
        this._selectedAreaIndex = null;
        this._selectedPolyArea = false;
    }

    // Move selected area by offset (dx, dy in game coordinates)
    moveSelectedArea(dx: number, dy: number): boolean {
        if (this._selectedAreaIndex === null) return false;
        if (this._selectedAreaIndex < 0 || this._selectedAreaIndex >= this._areas.areas.length) return false;
        
        const area = this._areas.areas[this._selectedAreaIndex];
        const rectangle = this._areas.rectangles[this._selectedAreaIndex];
        
        // Update area positions
        area.startPosition = new Position(
            area.startPosition.x + dx,
            area.startPosition.y + dy,
            area.startPosition.z
        );
        area.endPosition = new Position(
            area.endPosition.x + dx,
            area.endPosition.y + dy,
            area.endPosition.z
        );
        
        // Update rectangle bounds
        const newStartLatLng = area.startPosition.toLatLng(this._map);
        const newEndLatLng = area.endPosition.toLatLng(this._map);
        
        // Apply same logic as Area.toLeaflet() for bounds calculation
        let startX = area.startPosition.x;
        let startY = area.startPosition.y;
        let endX = area.endPosition.x;
        let endY = area.endPosition.y;
        
        if (endX >= startX) {
            endX += 1;
        } else {
            startX += 1;
        }
        if (endY >= startY) {
            endY += 1;
        } else {
            startY += 1;
        }
        
        const adjustedStartPos = new Position(startX, startY, area.startPosition.z);
        const adjustedEndPos = new Position(endX, endY, area.endPosition.z);
        
        rectangle.setBounds(
            L.latLngBounds(
                adjustedStartPos.toLatLng(this._map),
                adjustedEndPos.toLatLng(this._map)
            )
        );
        
        // Update resize handles
        this._updateResizeHandlePositions();
        
        return true;
    }

    // Move selected polygon by offset (dx, dy in game coordinates)
    moveSelectedPolyArea(dx: number, dy: number): boolean {
        if (!this._selectedPolyArea) return false;
        if (this._polyArea.positions.length === 0) return false;
        if (!this._polyArea.polygon) return false;
        
        // Update all positions
        this._polyArea.positions = this._polyArea.positions.map(pos => 
            new Position(pos.x + dx, pos.y + dy, pos.z)
        );
        
        // Update polygon on map
        const maxZoom = this._map.getMaxZoom();
        const latLngs = this._polyArea.positions.map(pos => pos.toCentreLatLng(this._map));
        
        // Apply coordinate transformation (same as toLeaflet())
        for (let i = 0; i < latLngs.length; i++) {
            const point = this._map.project(latLngs[i], maxZoom);
            point.x -= 16;
            point.y += 16;
            latLngs[i] = this._map.unproject(point, maxZoom);
        }
        
        this._polyArea.polygon.setLatLngs([latLngs]);
        
        // Update resize handles
        this._updateResizeHandlePositions();
        
        return true;
    }

    // Get selected item info
    getSelectedItem(): { type: 'area' | 'poly' | null; index: number | null } {
        if (this._selectedAreaIndex !== null) {
            return { type: 'area', index: this._selectedAreaIndex };
        }
        if (this._selectedPolyArea) {
            return { type: 'poly', index: 0 };
        }
        return { type: null, index: null };
    }

    // Make rectangle draggable
    private _makeRectangleDraggable(rectangle: L.Rectangle, index: number) {
        let isDragging = false;
        let startLatLng: L.LatLng | null = null;
        let startAreaPositions: { start: Position; end: Position } | null = null;
        let pendingDragUpdate: number | null = null;
        let lastMouseEvent: L.LeafletMouseEvent | null = null;

        rectangle.on('mousedown', (e: L.LeafletMouseEvent) => {
            // Don't start drag if clicking on resize handles
            if ((e.originalEvent?.target as HTMLElement)?.closest('.resize-handle')) {
                return;
            }
            
            isDragging = true;
            startLatLng = e.latlng;
            const area = this._areas.areas[index];
            startAreaPositions = {
                start: new Position(area.startPosition.x, area.startPosition.y, area.startPosition.z),
                end: new Position(area.endPosition.x, area.endPosition.y, area.endPosition.z)
            };
            L.DomUtil.addClass(this._map.getContainer(), 'leaflet-dragging');
        });

        const performDragUpdate = () => {
            if (!isDragging || !startLatLng || !startAreaPositions || !lastMouseEvent) return;
            
            const currentLatLng = lastMouseEvent.latlng;
            const startPos = Position.fromLatLng(this._map, startLatLng, (this._map as any).plane);
            const currentPos = Position.fromLatLng(this._map, currentLatLng, (this._map as any).plane);
            
            const dx = currentPos.x - startPos.x;
            const dy = currentPos.y - startPos.y;
            
            // Move the area
            const area = this._areas.areas[index];
            area.startPosition = new Position(
                startAreaPositions.start.x + dx,
                startAreaPositions.start.y + dy,
                startAreaPositions.start.z
            );
            area.endPosition = new Position(
                startAreaPositions.end.x + dx,
                startAreaPositions.end.y + dy,
                startAreaPositions.end.z
            );
            
            // Update rectangle bounds
            let startX = area.startPosition.x;
            let startY = area.startPosition.y;
            let endX = area.endPosition.x;
            let endY = area.endPosition.y;
            
            if (endX >= startX) {
                endX += 1;
            } else {
                startX += 1;
            }
            if (endY >= startY) {
                endY += 1;
            } else {
                startY += 1;
            }
            
            const adjustedStartPos = new Position(startX, startY, area.startPosition.z);
            const adjustedEndPos = new Position(endX, endY, area.endPosition.z);
            
            rectangle.setBounds(
                L.latLngBounds(
                    adjustedStartPos.toLatLng(this._map),
                    adjustedEndPos.toLatLng(this._map)
                )
            );
            
            pendingDragUpdate = null;
        };

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging || !startLatLng || !startAreaPositions) return;
            
            // Store latest mouse event
            lastMouseEvent = e;
            
            // Cancel any pending update
            if (pendingDragUpdate !== null) {
                cancelAnimationFrame(pendingDragUpdate);
            }
            
            // Schedule update on next animation frame
            pendingDragUpdate = requestAnimationFrame(performDragUpdate);
        };

        const handleMouseUp = () => {
            if (isDragging) {
                // Cancel any pending animation frame
                if (pendingDragUpdate !== null) {
                    cancelAnimationFrame(pendingDragUpdate);
                    pendingDragUpdate = null;
                }
                
                // Perform final update synchronously
                if (lastMouseEvent) {
                    performDragUpdate();
                }
                
                // Update resize handles once after drag completes
                this._updateResizeHandlePositions();
                
                isDragging = false;
                startLatLng = null;
                startAreaPositions = null;
                lastMouseEvent = null;
                L.DomUtil.removeClass(this._map.getContainer(), 'leaflet-dragging');
            }
        };

        this._map.on('mousemove', handleMouseMove);
        this._map.on('mouseup', handleMouseUp);
        this._map.on('mouseleave', handleMouseUp);
    }

    // Make polygon draggable
    private _makePolygonDraggable(polygon: L.Polygon) {
        let isDragging = false;
        let startLatLng: L.LatLng | null = null;
        let startPositions: Position[] | null = null;
        let pendingDragUpdate: number | null = null;
        let lastMouseEvent: L.LeafletMouseEvent | null = null;
        // Cache maxZoom and transform offset
        const maxZoom = this._map.getMaxZoom();
        const transformOffset = { x: -16, y: 16 };

        polygon.on('mousedown', (e: L.LeafletMouseEvent) => {
            // Don't start drag if clicking on resize handles
            if ((e.originalEvent?.target as HTMLElement)?.closest('.resize-handle')) {
            return;
        }
            
            isDragging = true;
            startLatLng = e.latlng;
            startPositions = this._polyArea.positions.map(pos => 
                new Position(pos.x, pos.y, pos.z)
            );
            L.DomUtil.addClass(this._map.getContainer(), 'leaflet-dragging');
        });

        const performDragUpdate = () => {
            if (!isDragging || !startLatLng || !startPositions || !lastMouseEvent) return;
            
            const currentLatLng = lastMouseEvent.latlng;
            const startPos = Position.fromLatLng(this._map, startLatLng, (this._map as any).plane);
            const currentPos = Position.fromLatLng(this._map, currentLatLng, (this._map as any).plane);
            
            const dx = currentPos.x - startPos.x;
            const dy = currentPos.y - startPos.y;
            
            // Update all positions
            this._polyArea.positions = startPositions.map(pos => 
                new Position(pos.x + dx, pos.y + dy, pos.z)
            );
            
            // Update polygon on map - optimized transformation
            const latLngs = this._polyArea.positions.map(pos => pos.toCentreLatLng(this._map));
            
            // Apply transform offset in batch
            for (let i = 0; i < latLngs.length; i++) {
                const point = this._map.project(latLngs[i], maxZoom);
                point.x += transformOffset.x;
                point.y += transformOffset.y;
                latLngs[i] = this._map.unproject(point, maxZoom);
            }
            
            polygon.setLatLngs([latLngs]);
            
            pendingDragUpdate = null;
        };

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging || !startLatLng || !startPositions) return;
            
            // Store latest mouse event
            lastMouseEvent = e;
            
            // Cancel any pending update
            if (pendingDragUpdate !== null) {
                cancelAnimationFrame(pendingDragUpdate);
            }
            
            // Schedule update on next animation frame
            pendingDragUpdate = requestAnimationFrame(performDragUpdate);
        };

        const handleMouseUp = () => {
            if (isDragging) {
                // Cancel any pending animation frame
                if (pendingDragUpdate !== null) {
                    cancelAnimationFrame(pendingDragUpdate);
                    pendingDragUpdate = null;
                }
                
                // Perform final update synchronously
                if (lastMouseEvent) {
                    performDragUpdate();
                }
                
                // Update resize handles once after drag completes
                this._updateResizeHandlePositions();
                
                isDragging = false;
                startLatLng = null;
                startPositions = null;
                lastMouseEvent = null;
                L.DomUtil.removeClass(this._map.getContainer(), 'leaflet-dragging');
            }
        };

        this._map.on('mousemove', handleMouseMove);
        this._map.on('mouseup', handleMouseUp);
        this._map.on('mouseleave', handleMouseUp);
    }

    // Add resize handles for an area
    private _addResizeHandlesForArea(index: number) {
        if (index < 0 || index >= this._areas.rectangles.length) return;
        
        const rectangle = this._areas.rectangles[index];
        const bounds = rectangle.getBounds();
        const area = this._areas.areas[index];
        
        // Calculate area bounds to ensure handles are inside
        const minX = Math.min(area.startPosition.x, area.endPosition.x);
        const maxX = Math.max(area.startPosition.x, area.endPosition.x);
        const minY = Math.min(area.startPosition.y, area.endPosition.y);
        const maxY = Math.max(area.startPosition.y, area.endPosition.y);
        
        // Create 4 corner handles for diagonal resizing
        const cornerPositions = [
            { x: minX, y: maxY, latLng: bounds.getNorthWest(), cursor: 'nw-resize', type: 'corner', index: 0 }, // NW
            { x: maxX, y: maxY, latLng: bounds.getNorthEast(), cursor: 'ne-resize', type: 'corner', index: 1 }, // NE
            { x: maxX, y: minY, latLng: bounds.getSouthEast(), cursor: 'se-resize', type: 'corner', index: 2 }, // SE
            { x: minX, y: minY, latLng: bounds.getSouthWest(), cursor: 'sw-resize', type: 'corner', index: 3 }  // SW
        ];
        
        // Create 4 side handles for horizontal/vertical resizing
        const centerX = Math.floor((minX + maxX) / 2);
        const centerY = Math.floor((minY + maxY) / 2);
        // Calculate side positions as LatLng from bounds
        const northLatLng = L.latLng(bounds.getNorth(), bounds.getCenter().lng);
        const eastLatLng = L.latLng(bounds.getCenter().lat, bounds.getEast());
        const southLatLng = L.latLng(bounds.getSouth(), bounds.getCenter().lng);
        const westLatLng = L.latLng(bounds.getCenter().lat, bounds.getWest());
        const sidePositions = [
            { x: centerX, y: maxY, latLng: northLatLng, cursor: 'n-resize', type: 'side', index: 4 }, // Top (N)
            { x: maxX, y: centerY, latLng: eastLatLng, cursor: 'e-resize', type: 'side', index: 5 }, // Right (E)
            { x: centerX, y: minY, latLng: southLatLng, cursor: 's-resize', type: 'side', index: 6 }, // Bottom (S)
            { x: minX, y: centerY, latLng: westLatLng, cursor: 'w-resize', type: 'side', index: 7 }  // Left (W)
        ];
        
        // Combine all handles
        const allHandles = [...cornerPositions, ...sidePositions];
        
        allHandles.forEach((handleData) => {
            const handleIndex = handleData.index;
            const isCorner = handleData.type === 'corner';
            // Create tile-sized rectangle handle at position inside the area
            const handlePos = new Position(handleData.x, handleData.y, area.startPosition.z);
            const handleRect = handlePos.toLeaflet(this._map);
            handleRect.setStyle({
                color: "#ffffff", // White border
                fillColor: "#ff9500", // Orange fill
                fillOpacity: 1.0, // No transparency
                weight: 2,
                opacity: 1.0,
                interactive: false // Rectangle is visual only, marker handles dragging
            });
            
            // Get the center of the rectangle handle for the marker position
            const handleRectBounds = handleRect.getBounds();
            const handleCenterLatLng = handleRectBounds.getCenter();
            
            // Create marker wrapper for drag functionality - use fixed size icon
            // Make the icon visible and cover a good area for interaction
            const handle = L.marker(handleCenterLatLng, {
                icon: L.divIcon({
                    className: 'resize-handle',
                    html: `<div style="width: 40px; height: 40px; cursor: ${handleData.cursor}; background: rgba(255, 149, 0, 0.5); pointer-events: all; border: 2px solid white; border-radius: 2px;"></div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                }),
                draggable: true,
                zIndexOffset: 1000,
                opacity: 1.0,
                interactive: true
            });
            
            // Prevent map dragging when interacting with handle
            handle.on('mousedown', (e: L.LeafletMouseEvent) => {
                if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                }
            });
            
            handle.on('click', (e: L.LeafletMouseEvent) => {
                if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                }
            });
            
            // Store reference to rectangle
            (handle as any).handleRect = handleRect;
            (handle as any).handleIndex = handleIndex;
            (handle as any).isCorner = isCorner;
            
            // Store reference to the fixed corner LatLng - will be set on dragstart
            let fixedCornerLatLng: L.LatLng | null = null;
            let dragStartPos: Position | null = null;
            
            handle.on('dragstart', () => {
                // Store the starting position
                const marker = handle;
                const startLatLng = marker.getLatLng();
                dragStartPos = Position.fromLatLng(this._map, startLatLng, (this._map as any).plane);
                
                // Get the fixed corner position from the area model
                const area = this._areas.areas[index];
                const minX = Math.min(area.startPosition.x, area.endPosition.x);
                const maxX = Math.max(area.startPosition.x, area.endPosition.x);
                const minY = Math.min(area.startPosition.y, area.endPosition.y);
                const maxY = Math.max(area.startPosition.y, area.endPosition.y);
                const centerX = Math.floor((minX + maxX) / 2);
                const centerY = Math.floor((minY + maxY) / 2);
                
                // Calculate opposite corner/edge based on handle type and position
                let oppositeX: number, oppositeY: number;
                
                if (isCorner) {
                    // Corner handles: opposite corner stays fixed
                    if (handleIndex === 0) { // NW -> SE
                        oppositeX = maxX;
                        oppositeY = minY;
                    } else if (handleIndex === 1) { // NE -> SW
                        oppositeX = minX;
                        oppositeY = minY;
                    } else if (handleIndex === 2) { // SE -> NW
                        oppositeX = minX;
                        oppositeY = maxY;
                    } else { // SW -> NE
                        oppositeX = maxX;
                        oppositeY = maxY;
                    }
                } else {
                    // Side handles: opposite side stays fixed
                    if (handleIndex === 4) { // Top (N) -> Bottom (S) fixed
                        oppositeX = centerX;
                        oppositeY = minY;
                    } else if (handleIndex === 5) { // Right (E) -> Left (W) fixed
                        oppositeX = minX;
                        oppositeY = centerY;
                    } else if (handleIndex === 6) { // Bottom (S) -> Top (N) fixed
                        oppositeX = centerX;
                        oppositeY = maxY;
                    } else { // Left (W) -> Right (E) fixed
                        oppositeX = maxX;
                        oppositeY = centerY;
                    }
                }
                
                // Store original bounds for anchoring
                (handle as any).originalMinX = minX;
                (handle as any).originalMaxX = maxX;
                (handle as any).originalMinY = minY;
                (handle as any).originalMaxY = maxY;
                (handle as any).originalOppositeX = oppositeX;
                (handle as any).originalOppositeY = oppositeY;
                
                // Convert opposite corner to LatLng for fixed reference
                const oppositePos = new Position(oppositeX, oppositeY, area.startPosition.z);
                fixedCornerLatLng = oppositePos.toLatLng(this._map);
                
                // Store the original handle position
                const originalHandlePos = new Position(handleData.x, handleData.y, area.startPosition.z);
                (handle as any).originalHandlePos = originalHandlePos;
                (handle as any).handleData = handleData; // Store handleData for reference
            });
            
            // Throttled drag handler for better performance
            const dragHandler = throttle((e: L.LeafletEvent) => {
                if (!fixedCornerLatLng || !dragStartPos) return;
                
                const marker = e.target as L.Marker;
                const newLatLng = marker.getLatLng();
                let newPos = Position.fromLatLng(this._map, newLatLng, (this._map as any).plane);
                
                // Constrain movement based on handle type
                if (isCorner) {
                    // Corner handles: allow both axes (diagonal only)
                    // No constraint needed - both X and Y can change
                } else {
                    // Side handles: lock to single axis
                    if (handleIndex === 4 || handleIndex === 6) {
                        // Top/Bottom handles: only Y changes (vertical resize)
                        newPos = new Position(dragStartPos.x, newPos.y, dragStartPos.z);
                    } else {
                        // Left/Right handles: only X changes (horizontal resize)
                        newPos = new Position(newPos.x, dragStartPos.y, dragStartPos.z);
                    }
                }
                
                // Convert constrained position back to LatLng for handle rectangle
                const constrainedLatLng = newPos.toLatLng(this._map);
                
                // Update handle rectangle position to the tile at newPos
                const newHandleRect = newPos.toLeaflet(this._map);
                newHandleRect.setStyle({
                    color: "#ffffff",
                    fillColor: "#ff9500",
                    fillOpacity: 1.0,
                    weight: 2,
                    opacity: 1.0,
                    interactive: false
                });
                this._map.removeLayer((marker as any).handleRect);
                (marker as any).handleRect = newHandleRect;
                this._map.addLayer(newHandleRect);
                
                // Update marker position to center of new rectangle
                const newHandleBounds = newHandleRect.getBounds();
                marker.setLatLng(newHandleBounds.getCenter());
                
                // Calculate the actual corner/edge LatLng based on handle type and position
                let cornerLatLng: L.LatLng;
                const handleIdx = (marker as any).handleIndex;
                const isCornerHandle = (marker as any).isCorner;
                
                if (isCornerHandle) {
                    // Corner handles: use the corner of the tile
                    if (handleIdx === 0) { // NW
                        cornerLatLng = newHandleBounds.getNorthWest();
                    } else if (handleIdx === 1) { // NE
                        cornerLatLng = newHandleBounds.getNorthEast();
                    } else if (handleIdx === 2) { // SE
                        cornerLatLng = newHandleBounds.getSouthEast();
                    } else { // SW
                        cornerLatLng = newHandleBounds.getSouthWest();
                    }
                } else {
                    // Side handles: use the edge position (create LatLng from bounds values)
                    const center = newHandleBounds.getCenter();
                    if (handleIdx === 4) { // Top (N)
                        cornerLatLng = L.latLng(newHandleBounds.getNorth(), center.lng);
                    } else if (handleIdx === 5) { // Right (E)
                        cornerLatLng = L.latLng(center.lat, newHandleBounds.getEast());
                    } else if (handleIdx === 6) { // Bottom (S)
                        cornerLatLng = L.latLng(newHandleBounds.getSouth(), center.lng);
                    } else { // Left (W)
                        cornerLatLng = L.latLng(center.lat, newHandleBounds.getWest());
                    }
                }
                
                // Get original bounds from dragstart
                const originalBounds = {
                    minX: (marker as any).originalMinX,
                    maxX: (marker as any).originalMaxX,
                    minY: (marker as any).originalMinY,
                    maxY: (marker as any).originalMaxY,
                    oppositeX: (marker as any).originalOppositeX,
                    oppositeY: (marker as any).originalOppositeY
                };
                
                // Update area - fixedCornerLatLng never changes, only the dragged corner/edge moves
                this._updateAreaFromCorner(index, handleIdx, cornerLatLng, fixedCornerLatLng, false, originalBounds);
            }, 16); // ~60fps
            
            handle.on('drag', dragHandler);
            
            handle.on('dragend', () => {
                this._updateResizeHandlePositions();
            });
            
            // Add rectangle to map
            handleRect.addTo(this._map);
            handle.addTo(this._map);
            this._resizeHandles.push(handle);
        });
    }
    
    // Update resize handle positions to match current rectangle/polygon bounds
    private _updateResizeHandlePositions() {
        if (this._selectedAreaIndex !== null) {
            // First, ensure the rectangle visual matches the area model
            const area = this._areas.areas[this._selectedAreaIndex];
            const rectangle = this._areas.rectangles[this._selectedAreaIndex];
            
            // Update rectangle bounds to match area
            const newStartPos = new Position(area.startPosition.x, area.startPosition.y, area.startPosition.z);
            const newEndPos = new Position(area.endPosition.x, area.endPosition.y, area.endPosition.z);
            
            let adjustedStartPos = new Position(newStartPos.x, newStartPos.y, newStartPos.z);
            let adjustedEndPos = new Position(newEndPos.x, newEndPos.y, newEndPos.z);
            
            if (adjustedEndPos.x >= adjustedStartPos.x) {
                adjustedEndPos.x += 1;
            } else {
                adjustedStartPos.x += 1;
            }
            if (adjustedEndPos.y >= adjustedStartPos.y) {
                adjustedEndPos.y += 1;
            } else {
                adjustedStartPos.y += 1;
            }
            
            rectangle.setBounds(
                L.latLngBounds(
                    adjustedStartPos.toLatLng(this._map),
                    adjustedEndPos.toLatLng(this._map)
                )
            );
            
            // Now clear and recreate handles for area
            const shouldHaveCenterHandle = this._centerDragHandle !== null;
            this._clearResizeHandles();
            this._addResizeHandlesForArea(this._selectedAreaIndex);
            if (shouldHaveCenterHandle) {
                this._addCenterDragHandleForArea(this._selectedAreaIndex);
            }
        } else if (this._selectedPolyArea) {
            // Clear and recreate handles for polygon
            const shouldHaveCenterHandle = this._centerDragHandle !== null;
            this._clearResizeHandles();
            this._addResizeHandlesForPolyArea();
            if (shouldHaveCenterHandle) {
                this._addCenterDragHandleForPolyArea();
            }
        }
    }

    // Add resize handles for polygon (one per vertex)
    private _addResizeHandlesForPolyArea() {
        if (!this._polyArea.polygon) return;
        
        const latLngs = this._polyArea.polygon.getLatLngs()[0] as L.LatLng[];
        
        latLngs.forEach((latLng, vertexIndex) => {
            const handle = L.marker(latLng, {
                icon: L.divIcon({
                    className: 'resize-handle',
                    html: '<div style="width: 16px; height: 16px; background: #ff9500; border: 3px solid white; border-radius: 50%; cursor: move; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                }),
                draggable: true,
                zIndexOffset: 1000
            });
            
            let isDragging = false;
            
            handle.on('dragstart', () => {
                isDragging = true;
            });
            
            // Throttled drag handler for better performance
            const dragHandler = throttle((e: L.LeafletEvent) => {
                const marker = e.target as L.Marker;
                const newLatLng = marker.getLatLng();
                this._updatePolyAreaFromVertex(vertexIndex, newLatLng, true);
            }, 16); // ~60fps
            
            handle.on('drag', dragHandler);
            
            handle.on('dragend', () => {
                isDragging = false;
                this._updateResizeHandlePositions();
            });
            
            handle.addTo(this._map);
            this._resizeHandles.push(handle);
        });
    }

    // Update area when a corner is dragged - opposite corner stays fixed
    // Optimized with direct bounds calculation and minimal conversions
    private _updateAreaFromCorner(areaIndex: number, cornerIndex: number, newLatLng: L.LatLng, fixedCornerLatLng: L.LatLng, skipHandleUpdate: boolean = false, originalBounds?: { minX: number; maxX: number; minY: number; maxY: number; oppositeX: number; oppositeY: number }) {
        if (areaIndex < 0 || areaIndex >= this._areas.areas.length) return;
        
        const area = this._areas.areas[areaIndex];
        const rectangle = this._areas.rectangles[areaIndex];
        
        // Convert to Position
        const newPos = Position.fromLatLng(this._map, newLatLng, (this._map as any).plane);
        const fixedCornerPos = Position.fromLatLng(this._map, fixedCornerLatLng, (this._map as any).plane);
        
        // Calculate game coordinates for area model
        // Handle both corner handles (0-3) and side handles (4-7)
        let finalMinX: number, finalMaxX: number, finalMinY: number, finalMaxY: number;
        
        if (originalBounds) {
            if (cornerIndex < 4) {
                // Corner handles: use opposite corner
                finalMinX = Math.min(newPos.x, originalBounds.oppositeX);
                finalMaxX = Math.max(newPos.x, originalBounds.oppositeX);
                finalMinY = Math.min(newPos.y, originalBounds.oppositeY);
                finalMaxY = Math.max(newPos.y, originalBounds.oppositeY);
            } else {
                // Side handles: only change one axis, keep others from original bounds
                if (cornerIndex === 4) { // Top (N) - only change maxY
                    finalMinX = originalBounds.minX;
                    finalMaxX = originalBounds.maxX;
                    finalMinY = originalBounds.minY;
                    finalMaxY = newPos.y;
                } else if (cornerIndex === 5) { // Right (E) - only change maxX
                    finalMinX = originalBounds.minX;
                    finalMaxX = newPos.x;
                    finalMinY = originalBounds.minY;
                    finalMaxY = originalBounds.maxY;
                } else if (cornerIndex === 6) { // Bottom (S) - only change minY
                    finalMinX = originalBounds.minX;
                    finalMaxX = originalBounds.maxX;
                    finalMinY = newPos.y;
                    finalMaxY = originalBounds.maxY;
                } else { // Left (W) - only change minX
                    finalMinX = newPos.x;
                    finalMaxX = originalBounds.maxX;
                    finalMinY = originalBounds.minY;
                    finalMaxY = originalBounds.maxY;
                }
            }
        } else {
            // Fallback: use fixedCornerPos directly (shouldn't happen, but safety)
            finalMinX = Math.min(newPos.x, fixedCornerPos.x);
            finalMaxX = Math.max(newPos.x, fixedCornerPos.x);
            finalMinY = Math.min(newPos.y, fixedCornerPos.y);
            finalMaxY = Math.max(newPos.y, fixedCornerPos.y);
        }
        
        // Ensure minimum size (at least 1x1)
        if (finalMaxX - finalMinX < 1) {
            if (cornerIndex === 0 || cornerIndex === 3 || cornerIndex === 7) {
                finalMinX = originalBounds ? originalBounds.minX - 1 : fixedCornerPos.x - 1;
            } else {
                finalMaxX = originalBounds ? originalBounds.maxX + 1 : fixedCornerPos.x + 1;
            }
        }
        if (finalMaxY - finalMinY < 1) {
            if (cornerIndex === 0 || cornerIndex === 1 || cornerIndex === 4) {
                finalMinY = originalBounds ? originalBounds.minY - 1 : fixedCornerPos.y - 1;
            } else {
                finalMaxY = originalBounds ? originalBounds.maxY + 1 : fixedCornerPos.y + 1;
            }
        }
        
        // Update area model (only if changed to avoid unnecessary updates)
        const newStart = new Position(finalMinX, finalMinY, newPos.z);
        const newEnd = new Position(finalMaxX, finalMaxY, newPos.z);
        if (!area.startPosition.equals(newStart) || !area.endPosition.equals(newEnd)) {
            area.startPosition = newStart;
            area.endPosition = newEnd;
        }
        
        // Update other handles in real-time (optimized: only update positions, don't recreate)
        if (!skipHandleUpdate && this._resizeHandles.length >= 8) {
            // Get updated area bounds to calculate correct handle positions
            const area = this._areas.areas[areaIndex];
            const minX = Math.min(area.startPosition.x, area.endPosition.x);
            const maxX = Math.max(area.startPosition.x, area.endPosition.x);
            const minY = Math.min(area.startPosition.y, area.endPosition.y);
            const maxY = Math.max(area.startPosition.y, area.endPosition.y);
            const centerX = Math.floor((minX + maxX) / 2);
            const centerY = Math.floor((minY + maxY) / 2);
            
            // Calculate all handle positions (corners + sides)
            const handlePositions = [
                { x: minX, y: maxY }, // 0: Top-left (NW)
                { x: maxX, y: maxY }, // 1: Top-right (NE)
                { x: maxX, y: minY }, // 2: Bottom-right (SE)
                { x: minX, y: minY }, // 3: Bottom-left (SW)
                { x: centerX, y: maxY }, // 4: Top (N)
                { x: maxX, y: centerY }, // 5: Right (E)
                { x: centerX, y: minY }, // 6: Bottom (S)
                { x: minX, y: centerY }  // 7: Left (W)
            ];
            
            // Batch handle updates
            this._resizeHandles.forEach((handle, idx) => {
                if (idx !== cornerIndex && idx < handlePositions.length) {
                    const handlePosData = handlePositions[idx];
                    const handlePos = new Position(handlePosData.x, handlePosData.y, area.startPosition.z);
                    
                    // Update handle rectangle position
                    if ((handle as any).handleRect) {
                        const newHandleRect = handlePos.toLeaflet(this._map);
                        newHandleRect.setStyle({
                            color: "#ffffff",
                            fillColor: "#ff9500",
                            fillOpacity: 1.0,
                            weight: 2,
                            opacity: 1.0,
                            interactive: false
                        });
                        this._map.removeLayer((handle as any).handleRect);
                        (handle as any).handleRect = newHandleRect;
                        this._map.addLayer(newHandleRect);
                    }
                    
                    // Update marker position to center of new rectangle
                    const newHandleBounds = (handle as any).handleRect.getBounds();
                    handle.setLatLng(newHandleBounds.getCenter());
                }
            });
        }
    }

    // Update polygon when a vertex is dragged - optimized
    private _updatePolyAreaFromVertex(vertexIndex: number, newLatLng: L.LatLng, skipHandleUpdate: boolean = false) {
        if (vertexIndex < 0 || vertexIndex >= this._polyArea.positions.length) return;
        if (!this._polyArea.polygon) return;
        
        const newPos = Position.fromLatLng(this._map, newLatLng, (this._map as any).plane);
        this._polyArea.positions[vertexIndex] = newPos;
        
        // Cache maxZoom calculation
        const maxZoom = this._map.getMaxZoom();
        
        // Update polygon vertices directly - optimize by updating only changed vertex in polygon
        const latLngs = this._polyArea.positions.map(pos => pos.toCentreLatLng(this._map));
        
        // Apply coordinate transformation (same as toLeaflet())
        for (let i = 0; i < latLngs.length; i++) {
            const point = this._map.project(latLngs[i], maxZoom);
            point.x -= 16;
            point.y += 16;
            latLngs[i] = this._map.unproject(point, maxZoom);
        }
        
        // Update polygon with new vertices
        this._polyArea.polygon.setLatLngs([latLngs]);
        
        // Update other handles (but not the one being dragged)
        if (!skipHandleUpdate) {
            this._resizeHandles.forEach((handle, idx) => {
                if (idx !== vertexIndex && idx < latLngs.length) {
                    handle.setLatLng(latLngs[idx]);
                }
            });
        }
    }

    // Clear all resize handles
    private _clearResizeHandles() {
        this._resizeHandles.forEach(handle => {
            // Remove rectangle if it exists
            if ((handle as any).handleRect) {
                this._map.removeLayer((handle as any).handleRect);
            }
            this._map.removeLayer(handle);
        });
        this._resizeHandles = [];
        
        // Clear center drag handle
        if (this._centerDragHandle) {
            this._map.removeLayer(this._centerDragHandle);
            this._centerDragHandle = null;
        }
    }

    // Add center drag handle for area
    private _addCenterDragHandleForArea(index: number) {
        if (index < 0 || index >= this._areas.rectangles.length) return;
        
        const rectangle = this._areas.rectangles[index];
        const bounds = rectangle.getBounds();
        const centerLatLng = bounds.getCenter();
        
        const centerHandle = L.marker(centerLatLng, {
            icon: L.divIcon({
                className: 'center-drag-handle',
                html: '<div style="width: 24px; height: 24px; background: #33b5e5; border: 3px solid white; border-radius: 50%; cursor: move; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            draggable: true,
            zIndexOffset: 1001
        });
        
        let startAreaPositions: { start: Position; end: Position } | null = null;
        let startDragLatLng: L.LatLng | null = null;
        
        centerHandle.on('dragstart', () => {
            const area = this._areas.areas[index];
            startAreaPositions = {
                start: new Position(area.startPosition.x, area.startPosition.y, area.startPosition.z),
                end: new Position(area.endPosition.x, area.endPosition.y, area.endPosition.z)
            };
            startDragLatLng = centerHandle.getLatLng();
        });
        
        const dragHandler = throttle((e: L.LeafletEvent) => {
            if (!startAreaPositions || !startDragLatLng) return;
            
            const marker = e.target as L.Marker;
            const currentLatLng = marker.getLatLng();
            
            const startPos = Position.fromLatLng(this._map, startDragLatLng, (this._map as any).plane);
            const currentPos = Position.fromLatLng(this._map, currentLatLng, (this._map as any).plane);
            
            const dx = currentPos.x - startPos.x;
            const dy = currentPos.y - startPos.y;
            
            // Move the area
            const area = this._areas.areas[index];
            area.startPosition = new Position(
                startAreaPositions.start.x + dx,
                startAreaPositions.start.y + dy,
                startAreaPositions.start.z
            );
            area.endPosition = new Position(
                startAreaPositions.end.x + dx,
                startAreaPositions.end.y + dy,
                startAreaPositions.end.z
            );
            
            // Update rectangle bounds
            let startX = area.startPosition.x;
            let startY = area.startPosition.y;
            let endX = area.endPosition.x;
            let endY = area.endPosition.y;
            
            if (endX >= startX) {
                endX += 1;
            } else {
                startX += 1;
            }
            if (endY >= startY) {
                endY += 1;
            } else {
                startY += 1;
            }
            
            const adjustedStartPos = new Position(startX, startY, area.startPosition.z);
            const adjustedEndPos = new Position(endX, endY, area.endPosition.z);
            
            rectangle.setBounds(
                L.latLngBounds(
                    adjustedStartPos.toLatLng(this._map),
                    adjustedEndPos.toLatLng(this._map)
                )
            );
            
            // Update resize handles (corner dots) in real-time
            const newBounds = rectangle.getBounds();
            const corners = [
                newBounds.getNorthWest(), // Top-left (NW)
                newBounds.getNorthEast(), // Top-right (NE)
                newBounds.getSouthEast(), // Bottom-right (SE)
                newBounds.getSouthWest()  // Bottom-left (SW)
            ];
            
            // Update each corner handle position
            this._resizeHandles.forEach((handle, cornerIndex) => {
                if (cornerIndex < corners.length) {
                    handle.setLatLng(corners[cornerIndex]);
                }
            });
            
            // Update center handle position
            centerHandle.setLatLng(newBounds.getCenter());
        }, 16);
        
        centerHandle.on('drag', dragHandler);
        
        centerHandle.on('dragend', () => {
            // Final update to ensure everything is in sync
            this._updateResizeHandlePositions();
            // Update center handle position
            const newBounds = rectangle.getBounds();
            centerHandle.setLatLng(newBounds.getCenter());
        });
        
        centerHandle.addTo(this._map);
        this._centerDragHandle = centerHandle;
    }

    // Add center drag handle for polygon
    private _addCenterDragHandleForPolyArea() {
        if (!this._polyArea.polygon || this._polyArea.positions.length === 0) return;
        
        // Calculate center of polygon
        const latLngs = this._polyArea.polygon.getLatLngs()[0] as L.LatLng[];
        let sumLat = 0;
        let sumLng = 0;
        latLngs.forEach(latLng => {
            sumLat += latLng.lat;
            sumLng += latLng.lng;
        });
        const centerLatLng = L.latLng(sumLat / latLngs.length, sumLng / latLngs.length);
        
        const centerHandle = L.marker(centerLatLng, {
            icon: L.divIcon({
                className: 'center-drag-handle',
                html: '<div style="width: 24px; height: 24px; background: #33b5e5; border: 3px solid white; border-radius: 50%; cursor: move; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            draggable: true,
            zIndexOffset: 1001
        });
        
        let startPositions: Position[] | null = null;
        let startDragLatLng: L.LatLng | null = null;
        
        centerHandle.on('dragstart', () => {
            startPositions = this._polyArea.positions.map(pos => 
                new Position(pos.x, pos.y, pos.z)
            );
            startDragLatLng = centerHandle.getLatLng();
        });
        
        const dragHandler = throttle((e: L.LeafletEvent) => {
            if (!startPositions || !startDragLatLng || !this._polyArea.polygon) return;
            
            const marker = e.target as L.Marker;
            const currentLatLng = marker.getLatLng();
            
            const startPos = Position.fromLatLng(this._map, startDragLatLng, (this._map as any).plane);
            const currentPos = Position.fromLatLng(this._map, currentLatLng, (this._map as any).plane);
            
            const dx = currentPos.x - startPos.x;
            const dy = currentPos.y - startPos.y;
            
            // Update all positions
            this._polyArea.positions = startPositions.map(pos => 
                new Position(pos.x + dx, pos.y + dy, pos.z)
            );
            
            // Update polygon on map
            const maxZoom = this._map.getMaxZoom();
            const newLatLngs = this._polyArea.positions.map(pos => pos.toCentreLatLng(this._map));
            
            for (let i = 0; i < newLatLngs.length; i++) {
                const point = this._map.project(newLatLngs[i], maxZoom);
                point.x -= 16;
                point.y += 16;
                newLatLngs[i] = this._map.unproject(point, maxZoom);
            }
            
            this._polyArea.polygon.setLatLngs([newLatLngs]);
            
            // Update resize handles (vertex dots) in real-time
            // Update each vertex handle position to match the new polygon vertices
            this._resizeHandles.forEach((handle, vertexIndex) => {
                if (vertexIndex < newLatLngs.length) {
                    handle.setLatLng(newLatLngs[vertexIndex]);
                }
            });
            
            // Update center handle position
            let sumLat = 0;
            let sumLng = 0;
            newLatLngs.forEach(latLng => {
                sumLat += latLng.lat;
                sumLng += latLng.lng;
            });
            centerHandle.setLatLng(L.latLng(sumLat / newLatLngs.length, sumLng / newLatLngs.length));
        }, 16);
        
        centerHandle.on('drag', dragHandler);
        
        centerHandle.on('dragend', () => {
            // Final update to ensure everything is in sync
            this._updateResizeHandlePositions();
            // Update center handle position
            if (this._polyArea.polygon) {
                const latLngs = this._polyArea.polygon.getLatLngs()[0] as L.LatLng[];
                let sumLat = 0;
                let sumLng = 0;
                latLngs.forEach(latLng => {
                    sumLat += latLng.lat;
                    sumLng += latLng.lng;
                });
                centerHandle.setLatLng(L.latLng(sumLat / latLngs.length, sumLng / latLngs.length));
            }
        });
        
        centerHandle.addTo(this._map);
        this._centerDragHandle = centerHandle;
    }

}