import React, { useState, useCallback } from 'react';
import axios from 'axios';
import {Tile} from "src/components/map/Tile";
import {Region} from "src/components/map/Region";

const RegionLoader = ({ view, flipRegionY }) => {
  const [regions, setRegions] = useState(new Map());
  const [loadQueue, setLoadQueue] = useState(new Set());
  const scaleOp = useCallback((image) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width / 2;
    canvas.height = image.height / 2;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  const getRegion = (regionX, regionY, level) => {
    const regionId = Tile.id(regionX, regionY, level);
    const region = regions.get(regionId);
    if (!region) {
      setLoadQueue((prevQueue) => new Set(prevQueue.add(regionId)));
      load();
    }
    return view.scale <= 2 ? region?.half : region?.full;
  };

  const load = useCallback(() => {
    if (!loadQueue.size) return;

    const loadRegion = async (regionId) => {
      const [regionX, regionY, level] = [Tile.x(regionId), Tile.y(regionId), Tile.level(regionId)];
      const img = await loadRegionImage(regionX, regionY, level);
      if (!img) {
        setRegions((prevRegions) => new Map(prevRegions.set(regionId, null)));
        return;
      }
      const halfImg = scaleOp(img);
      setRegions((prevRegions) => new Map(prevRegions.set(regionId, { full: img, half: halfImg })));
      view.repaintRegion(regionX, regionY); // Update the view
    };

    Array.from(loadQueue).forEach((regionId) => {
      if (!regions.has(regionId)) {
        loadRegion(regionId);
      }
      setLoadQueue((prevQueue) => {
        prevQueue.delete(regionId);
        return new Set(prevQueue);
      });
    });
  }, [loadQueue, regions, view, scaleOp]);

  const loadRegionImage = async (regionX, regionY, level) => {
    try {
      const id = Region.id(regionX, regionY);
      const response = await axios.get(`/images/${level}/${id}.png`, { responseType: 'blob' });
      const img = await createImageBitmap(response.data);
      return img;
    } catch (error) {
      console.error('Error loading region image:', error);
      return null;
    }
  };

  const removeRegions = (rangeX, rangeY) => {
    rangeX.forEach((regionX) => {
      rangeY.forEach((regionY) => {
        const id = Region.id(regionX, flipRegionY(regionY));
        setLoadQueue((prevQueue) => {
          prevQueue.delete(id);
          return new Set(prevQueue);
        });
        if (regions.has(id)) {
          setRegions((prevRegions) => {
            prevRegions.delete(id);
            return new Map(prevRegions);
          });
        }
      });
    });
  };

  return { getRegion, removeRegions };
};

export default RegionLoader;

export default RegionLoader;
