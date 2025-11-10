export enum GamevalType {
    ITEMS = "items",
    NPCS = "npcs",
    INVTYPES = "inv",
    VARPTYPES = "varp",
    VARBITTYPES = "varbits",
    OBJECTS = "objects",
    SEQTYPES = "sequences",
    SPOTTYPES = "spotanims",
    ROWTYPES = "dbrows",
    TABLETYPES = "dbtables",
    SOUNDTYPES = "jingles",
    SPRITETYPES = "sprites",
    IFTYPES = "components",
}

// Type name to enum mapping (for backward compatibility and easier access)
export const GAMEVAL_TYPE_MAP: Record<string, GamevalType> = {
    "items": GamevalType.ITEMS,
    "npcs": GamevalType.NPCS,
    "inv": GamevalType.INVTYPES,
    "varp": GamevalType.VARPTYPES,
    "varbits": GamevalType.VARBITTYPES,
    "objects": GamevalType.OBJECTS,
    "sequences": GamevalType.SEQTYPES,
    "spotanims": GamevalType.SPOTTYPES,
    "dbrows": GamevalType.ROWTYPES,
    "dbtables": GamevalType.TABLETYPES,
    "jingles": GamevalType.SOUNDTYPES,
    "sprites": GamevalType.SPRITETYPES,
    "components": GamevalType.IFTYPES,
};

// Export constants for easier access
export const ITEMTYPES = GamevalType.ITEMS;
export const NPCTYPES = GamevalType.NPCS;
export const INVTYPES = GamevalType.INVTYPES;
export const VARPTYPES = GamevalType.VARPTYPES;
export const VARBITTYPES = GamevalType.VARBITTYPES;
export const OBJTYPES = GamevalType.OBJECTS;
export const SEQTYPES = GamevalType.SEQTYPES;
export const SPOTTYPES = GamevalType.SPOTTYPES;
export const ROWTYPES = GamevalType.ROWTYPES;
export const TABLETYPES = GamevalType.TABLETYPES;
export const SOUNDTYPES = GamevalType.SOUNDTYPES;
export const SPRITETYPES = GamevalType.SPRITETYPES;
export const IFTYPES = GamevalType.IFTYPES;

export type GamevalData = Record<string, number>; // gameval name -> ID


