import 'leaflet';
import type { TileLayer } from 'leaflet';

declare module 'leaflet' {
  interface Map {
    plane: number;
    tile_layer?: TileLayer;
    updateMapPath?: () => void;
  }
}


