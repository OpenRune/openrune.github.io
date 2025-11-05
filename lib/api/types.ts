// Game data types - kept for potential future use
export interface GameValElement {
  id: number;
  name: string;
  gameval: number;
}

export interface ModelAttachments {
  items: GameValElement[];
  objects: GameValElement[];
  npcs: GameValElement[];
}

export interface TextureAttachments {
  models: ModelAttachments;
  overlays: number[];
  total: number;
}
