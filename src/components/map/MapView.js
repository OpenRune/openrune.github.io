import React, { useRef, useState, useEffect } from 'react';
import WorldMap from "src/components/map/WorldMap";
import {MouseDrag} from "src/components/map/MouseDrag";
import {MouseZoom} from "src/components/map/MouseZoom";
import {ResizeListener} from "src/components/map/ResizeListener";
import {MouseHover} from "src/components/map/MouseHover";

const MapView = ({ collisions, areaFile }) => {
  const canvasRef = useRef(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [level, setLevel] = useState(0);
  const [viewWidth, setViewWidth] = useState(1280);
  const [viewHeight, setViewHeight] = useState(768);

  const map = useRef(new WorldMap()); // WorldMap instance that handles the map logic and exposes flipRegionY and updateView
  const scale = 1; // Example scale, could be updated based on zoom level

  useEffect(() => {
    const canvas = canvasRef.current;

    // Drag functionality
    const drag = new MouseDrag(map.current, (deltaX, deltaY) => {
      setOffsetX((prevX) => prevX + deltaX);
      setOffsetY((prevY) => prevY + deltaY);
      map.current.updateView(); // Update the view after dragging
    });

    // Zoom functionality
    const zoom = new MouseZoom(map.current, (zoomFactor) => {
      // Here you could adjust the scale and update the view accordingly
      map.current.updateView();
    });

    // Hover functionality
    const hover = new MouseHover((mouseX, mouseY) => {
      // Handle hover logic, e.g., highlighting regions or showing info
    });

    // Resize functionality
    const resize = new ResizeListener((newWidth, newHeight) => {
      setViewWidth(newWidth);
      setViewHeight(newHeight);
      map.current.updateView(); // Update the view on resize
    });

    // Add event listeners
    drag.addListeners(canvas);
    zoom.addListeners(canvas);
    hover.addListeners(canvas);
    resize.addListeners();

    // Clean up on unmount
    return () => {
      drag.removeListeners(canvas);
      zoom.removeListeners(canvas);
      hover.removeListeners(canvas);
      resize.removeListeners();
    };
  }, []);

  const flipMapY = (mapY) => {
    return map.current.flipRegionY(mapY); // Use flipRegionY from WorldMap
  };

  const centreOn = (mapX, mapY, newLevel = level) => {
    align(viewWidth / 2, viewHeight / 2, mapX, flipMapY(mapY), newLevel);
  };

  const align = (viewX, viewY, mapX, mapY, newLevel = level) => {
    setOffsetX(viewX - mapToImageX(mapX));
    setOffsetY(viewY - mapToImageY(mapY));
    setLevel(newLevel);
    map.current.updateView(); // Ensure the map is redrawn
  };

  // Example transformation functions (these need to match your use case)
  const mapToImageX = (mapX) => mapX * scale;
  const mapToImageY = (mapY) => mapY * scale;

  const imageToMapX = (imageX) => imageX / scale;
  const imageToMapY = (imageY) => imageY / scale;

  const viewToImageX = (viewX) => viewX - offsetX;
  const viewToImageY = (viewY) => viewY - offsetY;

  const imageToViewX = (imageX) => imageX + offsetX;
  const imageToViewY = (imageY) => imageY + offsetY;

  const mapToRegionX = (mapX) => Math.floor(mapX / 64);
  const mapToRegionY = (mapY) => Math.floor(mapY / 64);

  const regionToMapX = (regionX) => regionX * 64;
  const regionToMapY = (regionY) => regionY * 64;

  const regionToImageX = (regionX) => mapToImageX(regionToMapX(regionX));
  const regionToImageY = (regionY) => mapToImageY(regionToMapY(regionY));

  const regionToViewX = (regionX) => imageToViewX(regionToImageX(regionX));
  const regionToViewY = (regionY) => imageToViewY(regionToImageY(regionY));


  const paintComponent = (g) => {
    g.fillStyle = 'black';
    g.fillRect(0, 0, viewWidth, viewHeight);

    // Draw map regions
    map.current.draw(g); // WorldMap's draw function

    // Additional drawing like highlighted areas or zones can go here
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Call paintComponent to draw everything on the canvas
    paintComponent(context);
  });

  return (
    <canvas
      ref={canvasRef}
      width={viewWidth}
      height={viewHeight}
      style={{ border: '1px solid black' }}
    />
  );
};

export default MapView;
