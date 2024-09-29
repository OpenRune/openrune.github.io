import React, { useState, useEffect, useRef, useCallback } from 'react';
import RegionLoader from "src/components/map/RegionLoader";

const WorldMap = ({ view }) => {
  const [minRegionX, setMinRegionX] = useState(0);
  const [minRegionY, setMinRegionY] = useState(0);
  const [maxRegionX, setMaxRegionX] = useState(0);
  const [maxRegionY, setMaxRegionY] = useState(0);
  const canvasRef = useRef(null);

  const regions = RegionLoader(view); // Instantiate RegionLoader

  const MAP_REGION_MIN_X = 0;
  const MAP_REGION_MIN_Y = 0;
  const MAP_REGION_MAX_X = 256;
  const MAP_REGION_MAX_Y = 256;
  const DISPLAY_ZONES = true;

  export const flipRegionY = (regionY) => MAP_REGION_MAX_Y - regionY;



  const updateView = useCallback(() => {
    const minX = minRegionX;
    const minY = minRegionY;
    const maxX = maxRegionX;
    const maxY = maxRegionY;

    const newMinRegionX = Math.max(view.viewToRegionX(view.minX), MAP_REGION_MIN_X);
    const newMinRegionY = Math.max(view.viewToRegionY(view.minY), MAP_REGION_MIN_Y);
    const newMaxRegionX = Math.min(view.viewToRegionX(view.maxX), MAP_REGION_MAX_X);
    const newMaxRegionY = Math.min(view.viewToRegionY(view.maxY), MAP_REGION_MAX_Y);

    setMinRegionX(newMinRegionX);
    setMinRegionY(newMinRegionY);
    setMaxRegionX(newMaxRegionX);
    setMaxRegionY(newMaxRegionY);

    // Remove regions no longer in view
    if (newMinRegionX > minX) {
      regions.remove(minX, Math.min(newMinRegionX, maxX), minY, maxY);
    }
    if (newMinRegionY > minY) {
      regions.remove(minX, maxX, minY, Math.min(newMinRegionY, maxY));
    }
    if (newMaxRegionX < maxX) {
      regions.remove(Math.max(newMaxRegionX + 1, minX), maxX, minY, maxY);
    }
    if (newMaxRegionY < maxY) {
      regions.remove(minX, maxX, Math.max(newMaxRegionY + 1, minY), maxY);
    }
  }, [minRegionX, minRegionY, maxRegionX, maxRegionY, regions, view]);

  useEffect(() => {
    updateView(); // Update the view on initial load
  }, [updateView]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    for (let regionX = minRegionX; regionX <= maxRegionX; regionX++) {
      for (let regionY = minRegionY; regionY <= maxRegionY; regionY++) {
        const mapY = view.regionToMapY(regionY) + 1;
        const viewX = view.regionToViewX(regionX);
        const viewY = view.imageToViewY(view.mapToImageY(mapY));
        const region = regions.getRegion(regionX, flipRegionY(regionY), view.level);

        if (region) {
          context.drawImage(region, viewX, viewY, view.regionToImageX(1), view.regionToImageY(1));
        }

        // Draw zones if enabled
        if (DISPLAY_ZONES) {
          context.strokeStyle = 'orange';
          for (let i = 0; i <= 64; i += 8) {
            context.beginPath();
            context.moveTo(viewX + view.mapToImageX(i), viewY);
            context.lineTo(viewX + view.mapToImageX(i), view.mapToViewY(mapY + 64));
            context.stroke();
            context.moveTo(viewX, viewY + view.mapToImageY(i));
            context.lineTo(viewX + view.mapToImageX(64), viewY + view.mapToImageY(i));
            context.stroke();
          }
        }

        // Draw region borders
        context.strokeStyle = 'magenta';
        context.beginPath();
        context.moveTo(viewX, viewY);
        context.lineTo(viewX, view.mapToViewY(mapY + 64));
        context.stroke();
        context.moveTo(viewX, viewY);
        context.lineTo(viewX + view.mapToImageX(64), viewY);
        context.stroke();
      }
    }
  }, [minRegionX, minRegionY, maxRegionX, maxRegionY, regions, view]);

  useEffect(() => {
    draw(); // Redraw whenever regions or view updates
  }, [draw]);

  return <canvas ref={canvasRef} width={800} height={600} />;
};

export default WorldMap;
