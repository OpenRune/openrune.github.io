import React, { useRef, useState, useEffect } from 'react';

// Helper to fetch the region image asynchronously and cache it
const cachedImages = {};
const fetchRegionImage = async (regionID) => {
  if (cachedImages[regionID]) {
    return cachedImages[regionID]; // Return cached image if available
  }
  try {
    const response = await fetch(`http://127.0.0.1:8080/public/map/${regionID}`);
    if (!response.ok) throw new Error('Region not found');
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    cachedImages[regionID] = imageUrl; // Cache the image URL
    return imageUrl;
  } catch {
    return null; // Return null if the image is not found
  }
};

// Define the Region class
class Region {
  constructor(regionID, mapX, mapY, regionX, regionY) {
    this.regionID = regionID;
    this.mapX = mapX;
    this.mapY = mapY;
    this.regionX = regionX;
    this.regionY = regionY;
  }
}

const MapViewer = () => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const requestAnimationFrameRef = useRef(null);

  const regionSize = 64; // RuneScape region size in tiles (64x64)
  const tileSize = 4; // Each tile is 4x4 pixels
  const mapSize = regionSize * tileSize; // 256x256 pixels per region
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [loadedRegions, setLoadedRegions] = useState({}); // Track loaded regions
  const [regionData, setRegionData] = useState([]); // Store Region objects

  const startingRegionX = (12342 & 0xFF); // Starting region X
  const startingRegionY = (12342 >> 8);   // Starting region Y

  const offscreenCanvasRef = useRef(null);

  const [showGrid, setShowGrid] = useState(false);
  const [showRegionIDs, setShowRegionIDs] = useState(false);
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 }); // Track real mouse coords
  const [regionCoords, setRegionCoords] = useState({ regionX: 0, regionY: 0 });
  const [mapCoords, setMapCoords] = useState({ mapX: 0, mapY: 0 });
  const [tileCoords, setTileCoords] = useState({ tileX: 0, tileY: 0 }); // Track the tile X and Y
  const [relativePixelCoords, setRelativePixelCoords] = useState({ pixelX: 0, pixelY: 0 }); // Track pixel relative to region
  const [rsTileCoords, setRsTileCoords] = useState({ rsTileX: 0, rsTileY: 0 }); // Track RS tile X and Y within the region

  useEffect(() => {
    setDragPosition({
      x: -startingRegionX * mapSize,
      y: -startingRegionY * mapSize,
    });

    offscreenCanvasRef.current = document.createElement('canvas');
    offscreenCanvasRef.current.width = viewportSize.width;
    offscreenCanvasRef.current.height = viewportSize.height;

    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [startingRegionX, startingRegionY]);

  useEffect(() => {
    if (offscreenCanvasRef.current) {
      offscreenCanvasRef.current.width = viewportSize.width;
      offscreenCanvasRef.current.height = viewportSize.height;
      requestCanvasRedraw(); // Redraw canvas when the viewport size changes
    }
  }, [viewportSize]);

  const calculateVisibleRegions = () => {
    const minX = Math.floor(-dragPosition.x / mapSize);
    const maxX = Math.floor((-dragPosition.x + viewportSize.width) / mapSize);
    const minY = Math.floor(-dragPosition.y / mapSize);
    const maxY = Math.floor((-dragPosition.y + viewportSize.height) / mapSize);

    return { minX, maxX, minY, maxY };
  };

  // Function to load and draw visible regions on the canvas
  const drawRegions = async (ctx) => {
    const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
    offscreenCtx.clearRect(0, 0, viewportSize.width, viewportSize.height); // Clear offscreen buffer

    const { minX, maxX, minY, maxY } = calculateVisibleRegions();
    const newLoadedRegions = {}; // Track the new set of visible regions
    const newRegionData = []; // Store new Region objects

    for (let regionY = maxY; regionY >= minY; regionY--) {
      for (let regionX = minX; regionX <= maxX; regionX++) {
        const regionID = (regionX << 8) + regionY;
        const mapX = regionID >> 8;
        const mapY = regionID & 0xFF;
        const xPos = regionX * mapSize + dragPosition.x;
        const yPos = viewportSize.height - (regionY * mapSize + dragPosition.y) - mapSize;

        // Load and cache the region image
        const imageUrl = await fetchRegionImage(regionID);
        if (imageUrl) {
          const img = new Image();
          img.src = imageUrl;
          await new Promise((resolve) => {
            img.onload = () => {
              offscreenCtx.drawImage(img, Math.floor(xPos), Math.floor(yPos), mapSize, mapSize); // Draw on the offscreen canvas
              resolve();
            };
          });
        } else {
          // Draw a black square if the image is not found
          offscreenCtx.fillStyle = 'black';
          offscreenCtx.fillRect(Math.floor(xPos), Math.floor(yPos), mapSize, mapSize);
        }

        if (showGrid) {
          offscreenCtx.strokeStyle = 'white';
          offscreenCtx.strokeRect(Math.floor(xPos), Math.floor(yPos), mapSize, mapSize); // Draw grid lines
        }

        if (showRegionIDs) {
          offscreenCtx.fillStyle = 'white';
          offscreenCtx.font = '14px Arial';
          offscreenCtx.fillText(regionID, Math.floor(xPos + 5), Math.floor(yPos + 20)); // Draw region ID
        }

        // Store new region data based on regionX and regionY
        newRegionData.push(new Region(regionID, mapX, mapY, regionX, regionY));

        newLoadedRegions[regionID] = true; // Mark this region as loaded
      }
    }

    // Update the loaded regions state
    setLoadedRegions(newLoadedRegions);
    setRegionData(newRegionData); // Update region data state

    // Double buffering: Draw the offscreen buffer onto the main canvas
    ctx.clearRect(0, 0, viewportSize.width, viewportSize.height); // Clear the main canvas
    ctx.drawImage(offscreenCanvasRef.current, 0, 0); // Draw the offscreen canvas

    // Draw the real-time mouse position-based aqua square
    ctx.fillStyle = 'aqua';
    ctx.fillRect(mouseCoords.x, mouseCoords.y, tileSize, tileSize); // Draw the aqua square based on the mouse coords
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawRegions(ctx);
    }
    requestAnimationFrameRef.current = null; // Clear requestAnimationFrame reference
  };

  const requestCanvasRedraw = () => {
    if (!requestAnimationFrameRef.current) {
      requestAnimationFrameRef.current = requestAnimationFrame(redrawCanvas);
    }
  };

  // Define handleMouseDown to initiate dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  // Define handleMouseUp to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Modify the handleMouseMove function to detect and use the region data
  const handleMouseMove = (e) => {
    const mouseX = e.clientX - dragPosition.x;  // Calculate mouse position relative to the drag
    const mouseY = e.clientY - dragPosition.y;

    // Convert mouse position to tile coordinates
    const tileX = Math.floor(mouseX / tileSize); // Tile X is based on the tile size (4x4)
    const tileY = Math.floor(mouseY / tileSize); // Tile Y is based on the tile size (4x4)

    // Update the tile coordinates state
    setTileCoords({ tileX, tileY });

    // Convert mouse position to region coordinates
    const regionX = Math.floor(mouseX / mapSize);  // Map size is 256 in this case
    const regionY = Math.floor(mouseY / mapSize);

    // Calculate pixel relative to the current region
    const pixelX = mouseX % mapSize;
    const pixelY = mouseY % mapSize;

    // Update the relative pixel coordinates within the region
    setRelativePixelCoords({ pixelX, pixelY });

    // Calculate RS tile coordinates within the region
    const rsTileX = Math.floor(pixelX / tileSize);
    const rsTileY = Math.floor(pixelY / tileSize);
    setRsTileCoords({ rsTileX, rsTileY });

    // Find the corresponding region in the regionData array based on regionX and regionY
    const matchingRegion = regionData.find(
      (region) => region.regionX === regionX && region.regionY === regionY
    );

    if (matchingRegion) {
      // Set the map and region coordinates using the matching region
      setMapCoords({ mapX: matchingRegion.mapX, mapY: matchingRegion.mapY });
      setRegionCoords({ regionX: matchingRegion.regionX, regionY: matchingRegion.regionY });
    }

    setMouseCoords({ x: e.clientX, y: e.clientY });  // Track real mouse coordinates

    if (isDragging) {
      const deltaX = e.clientX - lastMousePosition.current.x;
      const deltaY = e.clientY - lastMousePosition.current.y;

      // Update the drag position
      setDragPosition((prevPosition) => ({
        x: prevPosition.x + deltaX,
        y: prevPosition.y - deltaY,  // Invert Y direction for dragging
      }));

      lastMousePosition.current = { x: e.clientX, y: e.clientY };

      // Request canvas redraw during dragging
      if (!requestAnimationFrameRef.current) {
        requestAnimationFrameRef.current = requestAnimationFrame(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            drawRegions(ctx);
          }
          requestAnimationFrameRef.current = null;
        });
      }
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh', // Full viewport height
        position: 'relative',
        backgroundColor: 'black',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        width={viewportSize.width}
        height={viewportSize.height}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      />
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', zIndex: 10 }}>
        <button onClick={() => setShowGrid(!showGrid)}>
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>
        <button onClick={() => setShowRegionIDs(!showRegionIDs)} style={{ marginLeft: '10px' }}>
          {showRegionIDs ? 'Hide Region IDs' : 'Show Region IDs'}
        </button>
        <div style={{ marginTop: '10px' }}>
          Mouse Coordinates: X: {mouseCoords.x.toFixed(2)}, Y: {mouseCoords.y.toFixed(2)}<br />
          Tile Coordinates: X: {tileCoords.tileX}, Y: {tileCoords.tileY}<br />
          Map Coordinates: X: {mapCoords.mapX}, Y: {mapCoords.mapY}<br />
          Region Coordinates: X: {regionCoords.regionX}, Y: {regionCoords.regionY}<br />
          RS Tile in Region: X: {rsTileCoords.rsTileX}, Y: {rsTileCoords.rsTileY}
        </div>
      </div>
    </div>
  );
};

export default MapViewer;