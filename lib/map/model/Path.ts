'use strict';

import { Position } from './Position';
import * as L from 'leaflet';

export class Path {
    map: L.Map;
    positions: Position[];
    featureGroup: L.FeatureGroup;
    rectangles: L.Rectangle[];
    markers: L.Marker[]; // Draggable markers for each point
    lines: L.Polyline[];
    containedTiles: L.Rectangle[];
    verificationTiles: L.Rectangle[];

    constructor(map: L.Map) {
        this.map = map;
        this.positions = [];
        this.featureGroup = new L.FeatureGroup();
        this.rectangles = [];
        this.markers = [];
        this.lines = [];
        this.containedTiles = [];
        this.verificationTiles = [];
    }

    add(position: Position): void {
        const pointIndex = this.positions.length;
        this.positions.push(position);
        
        // Add rectangle covering the entire tile (white border, blue fill, no transparency)
        const rectangle = position.toLeaflet(this.map);
        rectangle.setStyle({
            color: "#ffffff", // White border
            fillColor: "#33b5e5", // Blue fill
            fillOpacity: 1.0, // No transparency
            weight: 2,
            opacity: 1.0,
            interactive: false
        });
        this.featureGroup.addLayer(rectangle);
        this.rectangles.push(rectangle);

        // Create draggable marker for the point handle
        const rectBounds = rectangle.getBounds();
        const centerLatLng = rectBounds.getCenter();
        const marker = L.marker(centerLatLng, {
            icon: L.divIcon({
                className: 'path-point-handle',
                html: `<div style="width: 32px; height: 32px; cursor: move; background: transparent; pointer-events: all;"></div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            }),
            draggable: true,
            zIndexOffset: 500
        });

        // Prevent map dragging when interacting with handle
        marker.on('mousedown', (e: L.LeafletMouseEvent) => {
            if (e.originalEvent) {
                L.DomEvent.stopPropagation(e.originalEvent);
            }
        });

        // Store reference to rectangle and point index
        (marker as any).handleRect = rectangle;
        (marker as any).pointIndex = pointIndex;

        // Handle drag events
        marker.on('drag', (e: L.LeafletEvent) => {
            const draggedMarker = e.target as L.Marker;
            const newLatLng = draggedMarker.getLatLng();
            const newPos = Position.fromLatLng(this.map, newLatLng, (this.map as any).plane);
            
            // Update the position
            const index = (draggedMarker as any).pointIndex;
            if (index >= 0 && index < this.positions.length) {
                this.positions[index] = newPos;
                
                // Update rectangle position
                const newRect = newPos.toLeaflet(this.map);
                newRect.setStyle({
                    color: "#ffffff",
                    fillColor: "#33b5e5",
                    fillOpacity: 1.0,
                    weight: 2,
                    opacity: 1.0,
                    interactive: false
                });
                this.map.removeLayer((draggedMarker as any).handleRect);
                (draggedMarker as any).handleRect = newRect;
                this.rectangles[index] = newRect;
                this.featureGroup.addLayer(newRect);
                
                // Update marker position to center of new rectangle
                const newRectBounds = newRect.getBounds();
                draggedMarker.setLatLng(newRectBounds.getCenter());
                
                // Update connected lines
                this.updateLinesForPoint(index);
                
                // Check for overlapping points during drag
                this.updateOverlappingPoints();
            }
        });

        marker.on('dragend', () => {
            // Update contained tiles after drag ends
            if (this.positions.length >= 3) {
                this.updateContainedTiles();
            }
            // Check for overlapping points after drag
            this.updateOverlappingPoints();
        });

        // Prevent click from propagating (but don't add new points on handle click)
        marker.on('click', (e: L.LeafletMouseEvent) => {
            if (e.originalEvent) {
                L.DomEvent.stopPropagation(e.originalEvent);
            }
            // Don't add new points when clicking handles - handles are only for dragging
        });

        this.featureGroup.addLayer(marker);
        this.markers.push(marker);

        // Add line connecting to previous point
        if (this.positions.length > 1) {
            const line = this.createPolyline(
                this.positions[this.positions.length - 2],
                this.positions[this.positions.length - 1]
            );
            this.featureGroup.addLayer(line);
            this.lines.push(line);
        }

        // Update contained tiles if we have enough points for a polygon (3+)
        if (this.positions.length >= 3) {
            this.updateContainedTiles();
        }
        
        // Check for overlapping points
        this.updateOverlappingPoints();
    }

    removeLast(): void {
        if (this.positions.length > 0) {
            this.positions.pop();
        }
        if (this.rectangles.length > 0) {
            const rect = this.rectangles.pop();
            if (rect) {
                this.featureGroup.removeLayer(rect);
            }
        }
        if (this.markers.length > 0) {
            const marker = this.markers.pop();
            if (marker) {
                this.featureGroup.removeLayer(marker);
            }
        }
        if (this.lines.length > 0) {
            const line = this.lines.pop();
            if (line) {
                this.featureGroup.removeLayer(line);
            }
        }
        
        // Update contained tiles
        if (this.positions.length >= 3) {
            this.updateContainedTiles();
        } else {
            this.clearContainedTiles();
        }
        
        // Check for overlapping points
        this.updateOverlappingPoints();
    }

    removeAll(): void {
        this.positions = [];
        this.rectangles.forEach(rect => {
            this.featureGroup.removeLayer(rect);
        });
        this.markers.forEach(marker => {
            this.featureGroup.removeLayer(marker);
        });
        this.lines.forEach(line => {
            this.featureGroup.removeLayer(line);
        });
        this.clearContainedTiles();
        this.rectangles = [];
        this.markers = [];
        this.lines = [];
    }

    // Update lines connected to a specific point
    private updateLinesForPoint(pointIndex: number): void {
        // Update line before this point (connects point[pointIndex-1] to point[pointIndex])
        // This line is at index pointIndex - 1 in the lines array
        if (pointIndex > 0 && pointIndex - 1 < this.lines.length) {
            const oldLine = this.lines[pointIndex - 1];
            this.featureGroup.removeLayer(oldLine);
            
            const newLine = this.createPolyline(
                this.positions[pointIndex - 1],
                this.positions[pointIndex]
            );
            this.featureGroup.addLayer(newLine);
            this.lines[pointIndex - 1] = newLine;
        }
        
        // Update line after this point (connects point[pointIndex] to point[pointIndex+1])
        // This line is at index pointIndex in the lines array
        if (pointIndex < this.positions.length - 1 && pointIndex < this.lines.length) {
            const oldLine = this.lines[pointIndex];
            this.featureGroup.removeLayer(oldLine);
            
            const newLine = this.createPolyline(
                this.positions[pointIndex],
                this.positions[pointIndex + 1]
            );
            this.featureGroup.addLayer(newLine);
            this.lines[pointIndex] = newLine;
        }
    }

    isEmpty(): boolean {
        return this.positions.length === 0;
    }

    createPolyline(startPosition: Position, endPosition: Position): L.Polyline {
        // Check if line is diagonal (not horizontal or vertical)
        const isDiagonal = startPosition.x !== endPosition.x && startPosition.y !== endPosition.y;
        
        // For horizontal/vertical lines, use bottom-left corner to align with tile boundaries and circles
        // For diagonal lines, use center coordinates to avoid snapping
        const startLatLng = isDiagonal 
            ? startPosition.toCentreLatLng(this.map)
            : startPosition.toLatLng(this.map);
        const endLatLng = isDiagonal
            ? endPosition.toCentreLatLng(this.map)
            : endPosition.toLatLng(this.map);
        
        return L.polyline(
            [startLatLng, endLatLng],
            {
                color: "#33b5e5",
                weight: 2,
                opacity: 0.6,
                interactive: false
            }
        );
    }

    getName(): string {
        return "Path";
    }

    // Ray casting algorithm - same as Java ImmutablePolygon.containsFast()
    private containsFast(x: number, y: number): boolean {
        if (this.positions.length < 3) return false;

        // Calculate bounding box
        let minX = this.positions[0].x;
        let maxX = this.positions[0].x;
        let minY = this.positions[0].y;
        let maxY = this.positions[0].y;

        for (let i = 1; i < this.positions.length; i++) {
            const pos = this.positions[i];
            if (pos.x < minX) minX = pos.x;
            else if (pos.x > maxX) maxX = pos.x;
            if (pos.y < minY) minY = pos.y;
            else if (pos.y > maxY) maxY = pos.y;
        }

        // Quick rejection
        if (x < minX || x > maxX || y < minY || y > maxY) {
            return false;
        }

        // Ray casting algorithm
        let inside = false;
        let j = this.positions.length - 1;

        for (let i = 0; i < this.positions.length; i++) {
            const xi = this.positions[i].x;
            const yi = this.positions[i].y;
            const xj = this.positions[j].x;
            const yj = this.positions[j].y;

            if ((yi > y) !== (yj > y)) {
                const dx = xj - xi;
                const dy = yj - yi;
                const cross = dx * (y - yi) - (x - xi) * dy;

                if (dy !== 0 && (cross > 0) === (dy < 0)) {
                    inside = !inside;
                }
            }
            j = i;
        }

        return inside;
    }

    // Get all contained coordinates - same as Java getAllContainedCoords()
    private getAllContainedCoords(): Array<{ x: number; y: number }> {
        if (this.positions.length < 3) return [];

        // Calculate bounding box
        let minX = this.positions[0].x;
        let maxX = this.positions[0].x;
        let minY = this.positions[0].y;
        let maxY = this.positions[0].y;

        for (let i = 1; i < this.positions.length; i++) {
            const pos = this.positions[i];
            if (pos.x < minX) minX = pos.x;
            else if (pos.x > maxX) maxX = pos.x;
            if (pos.y < minY) minY = pos.y;
            else if (pos.y > maxY) maxY = pos.y;
        }

        const coords: Array<{ x: number; y: number }> = [];

        // Check all tiles in bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (this.containsFast(x, y)) {
                    coords.push({ x, y });
                }
            }
        }

        return coords;
    }

    // Update the yellow grid showing all contained tiles
    private updateContainedTiles(): void {
        this.clearContainedTiles();

        const containedCoords = this.getAllContainedCoords();
        const plane = this.positions.length > 0 ? this.positions[0].z : 0;

        containedCoords.forEach(coord => {
            const pos = new Position(coord.x, coord.y, plane);
            const rect = pos.toLeaflet(this.map);
            rect.setStyle({
                color: "#ffd700", // Yellow
                fillColor: "#ffd700",
                fillOpacity: 0.3,
                weight: 0.5,
                interactive: false
            });
            this.featureGroup.addLayer(rect);
            this.containedTiles.push(rect);
        });
    }

    private clearContainedTiles(): void {
        this.containedTiles.forEach(rect => {
            this.featureGroup.removeLayer(rect);
        });
        this.containedTiles = [];
    }

    // Highlight specific tiles in red for verification
    highlightVerificationTiles(coords: Array<{ x: number; y: number; z?: number }>): void {
        this.clearVerificationTiles();

        const plane = this.positions.length > 0 ? this.positions[0].z : (coords.length > 0 && coords[0].z !== undefined ? coords[0].z : 0);

        coords.forEach(coord => {
            const z = coord.z !== undefined ? coord.z : plane;
            const pos = new Position(coord.x, coord.y, z);
            const rect = pos.toLeaflet(this.map);
            rect.setStyle({
                color: "#ff0000", // Red
                fillColor: "#ff0000",
                fillOpacity: 0.5,
                weight: 1,
                interactive: false
            });
            this.featureGroup.addLayer(rect);
            this.verificationTiles.push(rect);
        });
    }

    clearVerificationTiles(): void {
        this.verificationTiles.forEach(rect => {
            this.featureGroup.removeLayer(rect);
        });
        this.verificationTiles = [];
    }

    // Simplify path by removing redundant points on straight lines
    simplify(): void {
        if (this.positions.length <= 2) return; // Need at least 3 points to simplify

        const simplified: Position[] = [];
        simplified.push(this.positions[0]); // Always keep first point

        let i = 0;
        while (i < this.positions.length - 1) {
            const start = this.positions[i];
            let endIndex = i + 1;
            let end = this.positions[endIndex];

            // Check if we can extend this line segment
            while (endIndex < this.positions.length - 1) {
                const next = this.positions[endIndex + 1];
                
                // Check if next point is on the same line (horizontal, vertical, or diagonal)
                if (this.isOnSameLine(start, end, next)) {
                    end = next;
                    endIndex++;
                } else {
                    break;
                }
            }

            // Add the end point of this line segment
            simplified.push(end);
            i = endIndex;
        }

        // Only update if we actually simplified (removed points)
        if (simplified.length < this.positions.length) {
            // Remove all existing layers
            this.removeAll();
            
            // Re-add simplified points
            simplified.forEach(pos => {
                this.add(pos);
            });
        }
    }

    // Check if a point is on the same line as two other points
    private isOnSameLine(p1: Position, p2: Position, p3: Position): boolean {
        // Horizontal line (same Y)
        if (p1.y === p2.y && p2.y === p3.y) {
            // Check if they're in order (either all increasing or all decreasing)
            return (p1.x < p2.x && p2.x < p3.x) || (p1.x > p2.x && p2.x > p3.x) || 
                   (p1.x === p2.x && p2.x === p3.x); // All same point
        }
        
        // Vertical line (same X)
        if (p1.x === p2.x && p2.x === p3.x) {
            // Check if they're in order (either all increasing or all decreasing)
            return (p1.y < p2.y && p2.y < p3.y) || (p1.y > p2.y && p2.y > p3.y) ||
                   (p1.y === p2.y && p2.y === p3.y); // All same point
        }
        
        // Diagonal line (constant slope)
        const dx1 = p2.x - p1.x;
        const dy1 = p2.y - p1.y;
        const dx2 = p3.x - p2.x;
        const dy2 = p3.y - p2.y;
        
        // Check if slopes are equal (avoiding division by zero)
        if (dx1 === 0 || dx2 === 0) {
            // If either dx is 0, we already checked vertical case above
            return false;
        }
        
        // Check if slopes are equal: dy1/dx1 == dy2/dx2
        // Cross multiply to avoid floating point: dy1 * dx2 == dy2 * dx1
        const slopeEqual = dy1 * dx2 === dy2 * dx1;
        
        if (slopeEqual) {
            // Check if they're in order along the diagonal
            const sameDirectionX = (dx1 > 0 && dx2 > 0) || (dx1 < 0 && dx2 < 0);
            const sameDirectionY = (dy1 > 0 && dy2 > 0) || (dy1 < 0 && dy2 < 0);
            return sameDirectionX && sameDirectionY;
        }
        
        return false;
    }

    // Detect and highlight overlapping points
    private updateOverlappingPoints(): void {
        // Reset all rectangles to normal color
        this.rectangles.forEach(rect => {
            rect.setStyle({
                color: "#ffffff",
                fillColor: "#33b5e5",
                fillOpacity: 1.0,
                weight: 2,
                opacity: 1.0,
                interactive: false
            });
        });

        // Find overlapping points (same x, y coordinates)
        const pointGroups = new Map<string, number[]>();
        this.positions.forEach((pos, index) => {
            const key = `${pos.x},${pos.y}`;
            if (!pointGroups.has(key)) {
                pointGroups.set(key, []);
            }
            pointGroups.get(key)!.push(index);
        });

        // Highlight overlapping points with orange color and show count
        pointGroups.forEach((indices, key) => {
            if (indices.length > 1) {
                // Multiple points at this location - highlight them
                indices.forEach(index => {
                    if (index < this.rectangles.length) {
                        const rect = this.rectangles[index];
                        rect.setStyle({
                            color: "#ffffff",
                            fillColor: "#ff9500", // Orange to indicate overlap
                            fillOpacity: 1.0,
                            weight: 3, // Thicker border
                            opacity: 1.0,
                            interactive: false
                        });
                    }
                });
            }
        });
    }
}
