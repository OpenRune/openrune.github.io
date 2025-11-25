'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { PaginatedTable } from '@/components/ui/paginated-table';
import {
  createIdColumn,
  createGameValColumn,
  createNameColumn,
  createBooleanColumn,
  createObjectImageColumn,
} from '@/components/ui/table-columns/common-columns';
import { useInfoContent } from '@/hooks/useInfoContent';
import { calculateFilteredCount } from '@/lib/utils/filterCounts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IconMap, IconInfoCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { TableColumn } from '@/components/ui/paginated-table';
import OSRSMap from '@/components/map/OSRSMap';
import { IMAGE_URLS } from '@/lib/constants/imageUrls';
import { ScrollArea } from '@/components/ui/scroll-area';
import RSColorBox from '@/components/ui/RSColorBox';
import RSTexture from '@/components/ui/RSTexture';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ObjectData {
  id: string;
  name?: string;
  gameVal?: string;
}

interface ObjectInfo {
  name?: string;
  decorDisplacement?: number;
  isHollow?: boolean;
  objectModels?: number[];
  objectTypes?: number[];
  mapAreaId?: number;
  sizeX?: number;
  sizeY?: number;
  soundDistance?: number;
  soundRetain?: number;
  ambientSoundIds?: number[];
  offsetX?: number;
  nonFlatShading?: boolean;
  interactive?: number;
  animationId?: number;
  varbitId?: number;
  ambient?: number;
  contrast?: number;
  actions?: (string | null)[];
  solid?: number;
  mapSceneID?: number;
  clipMask?: number;
  clipped?: boolean;
  modelSizeX?: number;
  modelSizeZ?: number;
  modelSizeY?: number;
  offsetZ?: number;
  offsetY?: number;
  obstructive?: boolean;
  randomizeAnimStart?: boolean;
  clipType?: number;
  category?: number;
  supportsItems?: number;
  isRotated?: boolean;
  ambientSoundId?: number;
  modelClipped?: boolean;
  soundMin?: number;
  soundMax?: number;
  soundDistanceFadeCurve?: number;
  soundFadeInDuration?: number;
  soundFadeOutDuration?: number;
  soundFadeInCurve?: number;
  soundFadeOutCurve?: number;
  delayAnimationUpdate?: boolean;
  impenetrable?: boolean;
  soundVisibility?: number;
  originalColours?: number[];
  modifiedColours?: number[];
  originalTextureColours?: number[];
  modifiedTextureColours?: number[];
  varbit?: number;
  varp?: number;
  transforms?: number[];
  params?: Record<string, any>;
}

interface ModelData {
  id?: number;
  [key: string]: any;
}

// Helper function to format value for display
function formatModelValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Empty array</span>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item, idx) => (
          <span key={idx} className="px-2 py-1 bg-muted rounded text-sm font-mono">
            {formatSimpleValue(item)}
          </span>
        ))}
      </div>
    );
  }
  
  if (typeof value === 'boolean') {
    return <span>{value ? 'Yes' : 'No'}</span>;
  }
  
  if (typeof value === 'object') {
    // Try to format common object structures
    if ('x' in value && 'y' in value && 'z' in value) {
      return <span className="font-mono">X: {value.x}, Y: {value.y}, Z: {value.z}</span>;
    }
    if ('width' in value && 'height' in value) {
      return <span className="font-mono">W: {value.width}, H: {value.height}</span>;
    }
    if ('r' in value && 'g' in value && 'b' in value) {
      return <span className="font-mono">RGB({value.r}, {value.g}, {value.b})</span>;
    }
    // For other objects, show key-value pairs in a compact format
    const entries = Object.entries(value);
    if (entries.length <= 3) {
      return (
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="font-mono text-muted-foreground">{k}:</span> {formatSimpleValue(v)}
            </div>
          ))}
        </div>
      );
    }
    // Too many keys, show count
    return <span className="text-muted-foreground">Object with {entries.length} properties</span>;
  }
  
  return <span className="font-mono">{String(value)}</span>;
}

function formatSimpleValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return `{${Object.keys(value).length} keys}`;
  }
  return String(value);
}

// Helper function to check if a value matches its default
function isDefaultValue(key: string, value: any): boolean {
  const defaults: Record<string, any> = {
    id: -1,
    name: 'null',
    decorDisplacement: 16,
    isHollow: false,
    objectModels: null,
    objectTypes: null,
    mapAreaId: -1,
    sizeX: 1,
    sizeY: 1,
    soundDistance: 0,
    soundRetain: 0,
    ambientSoundIds: null,
    offsetX: 0,
    nonFlatShading: false,
    interactive: -1,
    animationId: -1,
    varbitId: -1,
    ambient: 0,
    contrast: 0,
    actions: null, // Will check if all null
    solid: 2,
    mapSceneID: -1,
    clipMask: 0,
    clipped: true,
    modelSizeX: 128,
    modelSizeZ: 128,
    modelSizeY: 128,
    offsetZ: 0,
    offsetY: 0,
    obstructive: false,
    randomizeAnimStart: true,
    clipType: -1,
    category: -1,
    supportsItems: -1,
    isRotated: false,
    ambientSoundId: -1,
    modelClipped: false,
    soundMin: 0,
    soundMax: 0,
    soundDistanceFadeCurve: 0,
    soundFadeInDuration: 300,
    soundFadeOutDuration: 300,
    soundFadeInCurve: 0,
    soundFadeOutCurve: 0,
    delayAnimationUpdate: false,
    impenetrable: true,
    soundVisibility: 2,
    originalColours: null,
    modifiedColours: null,
    originalTextureColours: null,
    modifiedTextureColours: null,
    varbit: -1,
    varp: -1,
    transforms: null,
    params: null,
  };

  const defaultValue = defaults[key];
  
  // Handle null/undefined
  if (value === null || value === undefined) {
    return defaultValue === null || defaultValue === undefined;
  }
  
  // Handle name field - check if it's the string "null"
  if (key === 'name' && value === 'null') {
    return true;
  }
  
  // Handle arrays - check if null or empty
  if (key === 'objectModels' || key === 'objectTypes' || key === 'ambientSoundIds' || 
      key === 'transforms' || key === 'originalColours' || key === 'modifiedColours' ||
      key === 'originalTextureColours' || key === 'modifiedTextureColours') {
    if (defaultValue === null) {
      return value === null || (Array.isArray(value) && value.length === 0);
    }
  }
  
  // Handle actions array - check if all null
  if (key === 'actions') {
    if (Array.isArray(value)) {
      return value.every(action => action === null);
    }
    return defaultValue === null;
  }
  
  // Handle params - check if null or empty object
  if (key === 'params') {
    if (defaultValue === null) {
      return value === null || (typeof value === 'object' && Object.keys(value).length === 0);
    }
  }
  
  // Direct comparison for primitives
  return value === defaultValue;
}

// Component to display model information
function ModelInfoContent({ modelData }: { modelData: ModelData }) {
  // Extract entry data from nested response structure (similar to object data)
  const actualModelData = modelData.entry || modelData;
  
  // Separate attachments from other properties
  const attachments = actualModelData.attachments || actualModelData.attachment || null;
  
  // Extract specific model statistics
  const totalEntries = actualModelData.totalEntries;
  const totalFaces = actualModelData.totalFaces;
  const totalVerts = actualModelData.totalVerts;
  const textures = Array.isArray(actualModelData.textures) 
    ? actualModelData.textures 
    : (actualModelData.textures ? Array.from(actualModelData.textures) : []);
  const colors = Array.isArray(actualModelData.colors) 
    ? actualModelData.colors 
    : (actualModelData.colors ? Array.from(actualModelData.colors) : []);
  const totalItems = actualModelData.totalItems;
  const totalObjects = actualModelData.totalObjects;
  const totalNpcs = actualModelData.totalNpcs;
  
  // Filter out special fields and attachments
  const modelEntries = Object.entries(actualModelData).filter(([key, value]) => 
    value !== null && 
    value !== undefined && 
    key !== 'attachments' && 
    key !== 'attachment' &&
    key !== 'id' &&
    key !== 'totalEntries' &&
    key !== 'totalFaces' &&
    key !== 'totalVerts' &&
    key !== 'textures' &&
    key !== 'colors' &&
    key !== 'totalItems' &&
    key !== 'totalObjects' &&
    key !== 'totalNpcs'
  );

  // Get model ID (try entry first, then root)
  const modelId = actualModelData.id || modelData.id;

  return (
    <div className="space-y-6">
      {/* Model ID */}
      {modelId !== undefined && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Model ID: {modelId}</h3>
        </div>
      )}

      {/* Model Statistics */}
      {(totalEntries !== undefined || totalFaces !== undefined || totalVerts !== undefined || 
        totalItems !== undefined || totalObjects !== undefined || totalNpcs !== undefined) && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Model Statistics</h3>
          <Table>
            <TableBody>
              {totalEntries !== undefined && (
                <TableRow>
                  <TableHead className="w-[220px]">Total Entries</TableHead>
                  <TableCell className="font-mono">{totalEntries}</TableCell>
                </TableRow>
              )}
              {totalFaces !== undefined && (
                <TableRow>
                  <TableHead>Total Faces</TableHead>
                  <TableCell className="font-mono">{totalFaces}</TableCell>
                </TableRow>
              )}
              {totalVerts !== undefined && (
                <TableRow>
                  <TableHead>Total Vertices</TableHead>
                  <TableCell className="font-mono">{totalVerts}</TableCell>
                </TableRow>
              )}
              {totalItems !== undefined && (
                <TableRow>
                  <TableHead>Total Items</TableHead>
                  <TableCell className="font-mono">{totalItems}</TableCell>
                </TableRow>
              )}
              {totalObjects !== undefined && (
                <TableRow>
                  <TableHead>Total Objects</TableHead>
                  <TableCell className="font-mono">{totalObjects}</TableCell>
                </TableRow>
              )}
              {totalNpcs !== undefined && (
                <TableRow>
                  <TableHead>Total NPCs</TableHead>
                  <TableCell className="font-mono">{totalNpcs}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Colors ({colors.length})</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((color: number, idx: number) => (
              <RSColorBox
                key={idx}
                width={32}
                height={32}
                packedHsl={color}
                tooltip={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Textures */}
      {textures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Textures ({textures.length})</h3>
          <div className="flex flex-wrap gap-3">
            {textures.map((textureId: number, idx: number) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <RSTexture
                  id={textureId}
                  width={32}
                  height={32}
                  rounded
                  thumbnail
                  enableClickModel={false}
                />
                <span className="text-xs font-mono">{textureId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Properties Table */}
      {modelEntries.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Model Properties</h3>
          <Table>
            <TableBody>
              {modelEntries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableHead className="w-[220px]">{key}</TableHead>
                  <TableCell>
                    {formatModelValue(value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {/* Attachments */}
      {attachments && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Attachments {typeof attachments === 'object' && 'total' in attachments ? `(${attachments.total || 0})` : ''}
          </h3>
          {typeof attachments === 'object' && attachments !== null ? (
            <div className="space-y-3">
              {attachments.items && Array.isArray(attachments.items) && attachments.items.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-md transition-colors">
                    <span>Items ({attachments.items.length})</span>
                    <IconChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-md">
                      <Table>
                        <TableBody>
                          {attachments.items.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="py-1.5">
                                {typeof item === 'string' ? (
                                  <span className="text-sm">{item}</span>
                                ) : item.name ? (
                                  <span className="text-sm">{item.name}</span>
                                ) : (
                                  <span className="text-sm font-mono">Item {item.id || idx}</span>
                                )}
                                {typeof item === 'object' && item.id && <span className="ml-2 text-xs text-muted-foreground font-mono">(ID: {item.id})</span>}
                                {typeof item === 'object' && item.gameval && <span className="ml-2 text-xs text-muted-foreground font-mono">({item.gameval})</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {attachments.objects && Array.isArray(attachments.objects) && attachments.objects.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-md transition-colors">
                    <span>Objects ({attachments.objects.length})</span>
                    <IconChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-md">
                      <Table>
                        <TableBody>
                          {attachments.objects.map((obj: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="py-1.5">
                                {typeof obj === 'string' ? (
                                  <span className="text-sm">{obj}</span>
                                ) : obj.name ? (
                                  <span className="text-sm">{obj.name}</span>
                                ) : (
                                  <span className="text-sm font-mono">Object {obj.id || idx}</span>
                                )}
                                {typeof obj === 'object' && obj.id && <span className="ml-2 text-xs text-muted-foreground font-mono">(ID: {obj.id})</span>}
                                {typeof obj === 'object' && obj.gameval && <span className="ml-2 text-xs text-muted-foreground font-mono">({obj.gameval})</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {attachments.npcs && Array.isArray(attachments.npcs) && attachments.npcs.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-md transition-colors">
                    <span>NPCs ({attachments.npcs.length})</span>
                    <IconChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-md">
                      <Table>
                        <TableBody>
                          {attachments.npcs.map((npc: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="py-1.5">
                                {typeof npc === 'string' ? (
                                  <span className="text-sm">{npc}</span>
                                ) : npc.name ? (
                                  <span className="text-sm">{npc.name}</span>
                                ) : (
                                  <span className="text-sm font-mono">NPC {npc.id || idx}</span>
                                )}
                                {typeof npc === 'object' && npc.id && <span className="ml-2 text-xs text-muted-foreground font-mono">(ID: {npc.id})</span>}
                                {typeof npc === 'object' && npc.gameval && <span className="ml-2 text-xs text-muted-foreground font-mono">({npc.gameval})</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {attachments.overlays && Array.isArray(attachments.overlays) && attachments.overlays.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium bg-muted/50 hover:bg-muted rounded-md transition-colors">
                    <span>Overlays ({attachments.overlays.length})</span>
                    <IconChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-md">
                      <Table>
                        <TableBody>
                          {attachments.overlays.map((overlay: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="py-1.5">
                                {typeof overlay === 'string' ? (
                                  <span className="text-sm">{overlay}</span>
                                ) : overlay.name ? (
                                  <span className="text-sm">{overlay.name}</span>
                                ) : (
                                  <span className="text-sm font-mono">Overlay {overlay.id || idx}</span>
                                )}
                                {typeof overlay === 'object' && overlay.id && <span className="ml-2 text-xs text-muted-foreground font-mono">(ID: {overlay.id})</span>}
                                {typeof overlay === 'object' && overlay.gameval && <span className="ml-2 text-xs text-muted-foreground font-mono">({overlay.gameval})</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              {!attachments.items && !attachments.objects && !attachments.npcs && !attachments.overlays && (
                <div className="text-center py-4 text-muted-foreground text-sm">No attachments available</div>
              )}
            </div>
          ) : Array.isArray(attachments) ? (
            <div className="border rounded-md">
              <Table>
                <TableBody>
                  {attachments.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="w-[80px] font-mono text-xs">{idx}</TableCell>
                      <TableCell className="py-1.5">
                        {typeof item === 'object' ? (
                          <pre className="text-xs overflow-auto max-w-md whitespace-pre-wrap break-words">{JSON.stringify(item, null, 2)}</pre>
                        ) : (
                          <span className="font-mono text-sm">{String(item)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">No attachments available</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ObjectsPage() {
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [objectData, setObjectData] = useState<ObjectData | null>(null);
  const [objectDataLoading, setObjectDataLoading] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [objectInfo, setObjectInfo] = useState<ObjectInfo | null>(null);
  const [objectInfoLoading, setObjectInfoLoading] = useState(false);
  const [infoObjectId, setInfoObjectId] = useState<number | null>(null);
  const [modelData, setModelData] = useState<Map<number, ModelData>>(new Map());
  const [modelDataLoading, setModelDataLoading] = useState<Set<number>>(new Set());

  const { info, infoContent } = useInfoContent({
    endpoint: 'objects',
    title: 'Objects Information',
    description: 'Use the search modes to find objects by ID, name, or gameval.',
    extraStats: (info) => [
      { label: 'Interactive Entries', value: info?.interactiveEntries },
      { label: 'Entries with Null Names', value: info?.entriesWithNullNames },
      { label: 'Entries with Non-Null Names', value: info?.entriesWithNoneNullNames },
    ],
  });

  const handleMapClick = (objectId: number) => {
    setSelectedObjectId(objectId);
    setMapModalOpen(true);
  };

  const handleViewInfo = (objectId: number) => {
    setInfoObjectId(objectId);
    setInfoModalOpen(true);
  };

  // Fetch object info when infoObjectId is selected
  useEffect(() => {
    if (infoObjectId !== null) {
      setObjectInfoLoading(true);
      const fetchObjectInfo = async () => {
        try {
          const response = await fetchFromBuildUrl('/objects/data', {
            dataType: 'cache',
            id: infoObjectId,
            searchMode: 'ID',
          });
          if (response.ok) {
            const data = await response.json();
            // Extract entry data from nested response structure
            const entryData = data.entry || data;
            console.log('Object data:', JSON.stringify(data, null, 2));
            setObjectInfo(entryData);
          } else {
            setObjectInfo(null);
          }
        } catch (error) {
          console.error('Error fetching object info:', error);
          setObjectInfo(null);
        } finally {
          setObjectInfoLoading(false);
        }
      };
      fetchObjectInfo();
    } else {
      setObjectInfo(null);
      setObjectInfoLoading(false);
      setModelData(new Map());
      setModelDataLoading(new Set());
    }
  }, [infoObjectId]);

  // Fetch model data when objectInfo changes and has objectModels
  useEffect(() => {
    if (objectInfo?.objectModels && objectInfo.objectModels.length > 0) {
      const fetchModelData = async () => {
        const newModelData = new Map<number, ModelData>();
        const loadingSet = new Set<number>();
        
        for (const modelId of objectInfo.objectModels!) {
          loadingSet.add(modelId);
          setModelDataLoading(new Set(loadingSet));
          
          try {
            const response = await fetchFromBuildUrl('/models/data', {
              dataType: 'web',
              id: modelId,
            });
            if (response.ok) {
              const data = await response.json();
              console.log(`Model ${modelId} data:`, JSON.stringify(data, null, 2));
              // Extract entry if present, otherwise use data directly
              const modelDataToStore = data.entry || data;
              newModelData.set(modelId, modelDataToStore);
            }
          } catch (error) {
            console.error(`Error fetching model ${modelId}:`, error);
          } finally {
            loadingSet.delete(modelId);
            setModelDataLoading(new Set(loadingSet));
          }
        }
        
        console.log('All model data:', JSON.stringify(Object.fromEntries(newModelData), null, 2));
        setModelData(newModelData);
      };
      
      fetchModelData();
    } else {
      setModelData(new Map());
      setModelDataLoading(new Set());
    }
  }, [objectInfo?.objectModels]);

  // Fetch object data when objectId is selected
  useEffect(() => {
    if (selectedObjectId) {
      setObjectDataLoading(true);
      const fetchObjectData = async () => {
        try {
          const params = new URLSearchParams({
            mode: 'id',
            q: selectedObjectId.toString(),
            amt: '1',
            offset: '0',
          });
          const response = await fetch(`/api/objects?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              setObjectData(data.results[0]);
            } else {
              // If not found, set minimal data
              setObjectData({ id: selectedObjectId.toString() });
            }
          } else {
            setObjectData({ id: selectedObjectId.toString() });
          }
        } catch (error) {
          console.error('Error fetching object data:', error);
          setObjectData({ id: selectedObjectId.toString() });
        } finally {
          setObjectDataLoading(false);
        }
      };
      fetchObjectData();
    } else {
      setObjectData(null);
      setObjectDataLoading(false);
    }
  }, [selectedObjectId]);

  const locateColumn: TableColumn = {
    key: 'locate',
    label: 'Locate Object',
    render: ({ id }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleMapClick(Number(id))}
      >
        <IconMap size={16} className="mr-2" />
        Locate
      </Button>
    ),
  };

  const viewInfoColumn: TableColumn = {
    key: 'viewInfo',
    label: 'View Info',
    render: ({ id }) => (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleViewInfo(Number(id))}
      >
        <IconInfoCircle size={16} className="mr-2" />
        View Info
      </Button>
    ),
  };

  const columns = [
    createObjectImageColumn(),
    createIdColumn(),
    createNameColumn(),
    createGameValColumn(),
    createBooleanColumn('interactive', 'Interactive'),
    locateColumn,
    viewInfoColumn,
  ];

  const getTotalCount = (info: any, filterState: Record<string, boolean>) =>
    calculateFilteredCount(info, filterState, {
      filterKey: 'interactiveOnly',
      countField: 'interactiveEntries',
      requireNameField: 'entriesWithNoneNullNames',
    });

  return (
    <>
      <PaginatedTable
        endpoint="objects"
        columns={columns}
        title="Objects"
        itemsPerPage={50}
        disabledModes={[]}
        defaultSearchMode="gameval"
        infoContent={infoContent}
        getTotalCount={getTotalCount}
        externalInfo={info}
        filters={[
          { key: 'interactiveOnly', label: 'Interactive Only' },
          { key: 'requireName', label: 'Require Name' },
        ]}
      />
      <Dialog open={mapModalOpen} onOpenChange={(open) => {
        setMapModalOpen(open);
        if (!open) {
          // Reset selected object when dialog closes
          setSelectedObjectId(null);
        }
      }}>
        <DialogContent className="!max-w-[50vw] !w-[50vw] !max-h-[80vh] !h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-3">
              {objectDataLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading...</span>
                </div>
              ) : objectData && selectedObjectId ? (
                <>
                  <img
                    src={IMAGE_URLS.object(selectedObjectId)}
                    alt={objectData.name || `Object ${selectedObjectId}`}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = IMAGE_URLS.fallback;
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {objectData.name || `Object ${selectedObjectId}`}
                      </span>
                      {objectData.gameVal && (
                        <span className="text-sm text-muted-foreground">
                          ({objectData.gameVal})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {selectedObjectId}
                    </span>
                  </div>
                </>
              ) : (
                <span>Map - Object ID: {selectedObjectId}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full min-h-0 relative">
            {selectedObjectId && (
              <OSRSMap initialObjectId={selectedObjectId} compact={true} />
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={infoModalOpen} onOpenChange={(open) => {
        setInfoModalOpen(open);
        if (!open) {
          setInfoObjectId(null);
        }
      }}>
        <DialogContent className="!max-w-[35vw] !w-[35vw] !h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              {objectInfoLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Loading object info...</span>
                </div>
              ) : infoObjectId ? (
                <>
                  <img
                    src={IMAGE_URLS.object(infoObjectId)}
                    alt={`Object ${infoObjectId}`}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = IMAGE_URLS.fallback;
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">
                      {objectInfo?.name || `Object ${infoObjectId}`}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {infoObjectId}
                    </span>
                  </div>
                </>
              ) : (
                <span>Object Info</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {objectInfoLoading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : objectInfo ? (
            <Tabs defaultValue="object-info" className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <TabsList className="mx-6 mt-4 flex-shrink-0">
                <TabsTrigger value="object-info">Object Info</TabsTrigger>
                <TabsTrigger value="model-info">Model Info</TabsTrigger>
              </TabsList>
              <TabsContent value="object-info" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <div className="h-full overflow-y-scroll px-6 py-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                  <Table>
                    <TableBody>
                      {(() => {
                        const allRows = [
                          { key: 'name', label: 'Name', value: objectInfo.name || 'null', isDefault: isDefaultValue('name', objectInfo.name) },
                          { key: 'decorDisplacement', label: 'Decor Displacement', value: objectInfo.decorDisplacement ?? 16, isDefault: isDefaultValue('decorDisplacement', objectInfo.decorDisplacement), isMono: true },
                          { key: 'isHollow', label: 'Is Hollow', value: objectInfo.isHollow ? 'Yes' : 'No', isDefault: isDefaultValue('isHollow', objectInfo.isHollow) },
                          { key: 'mapAreaId', label: 'Map Area ID', value: objectInfo.mapAreaId ?? -1, isDefault: isDefaultValue('mapAreaId', objectInfo.mapAreaId), isMono: true },
                          { key: 'sizeX', label: 'Size X', value: objectInfo.sizeX ?? 1, isDefault: isDefaultValue('sizeX', objectInfo.sizeX), isMono: true },
                          { key: 'sizeY', label: 'Size Y', value: objectInfo.sizeY ?? 1, isDefault: isDefaultValue('sizeY', objectInfo.sizeY), isMono: true },
                          { key: 'offsetX', label: 'Offset X', value: objectInfo.offsetX ?? 0, isDefault: isDefaultValue('offsetX', objectInfo.offsetX), isMono: true },
                          { key: 'offsetY', label: 'Offset Y', value: objectInfo.offsetY ?? 0, isDefault: isDefaultValue('offsetY', objectInfo.offsetY), isMono: true },
                          { key: 'offsetZ', label: 'Offset Z', value: objectInfo.offsetZ ?? 0, isDefault: isDefaultValue('offsetZ', objectInfo.offsetZ), isMono: true },
                          { key: 'nonFlatShading', label: 'Non Flat Shading', value: objectInfo.nonFlatShading ? 'Yes' : 'No', isDefault: isDefaultValue('nonFlatShading', objectInfo.nonFlatShading) },
                          { key: 'interactive', label: 'Interactive', value: objectInfo.interactive ?? -1, isDefault: isDefaultValue('interactive', objectInfo.interactive), isMono: true },
                          { key: 'animationId', label: 'Animation ID', value: objectInfo.animationId ?? -1, isDefault: isDefaultValue('animationId', objectInfo.animationId), isMono: true },
                          { key: 'delayAnimationUpdate', label: 'Delay Animation Update', value: objectInfo.delayAnimationUpdate ? 'Yes' : 'No', isDefault: isDefaultValue('delayAnimationUpdate', objectInfo.delayAnimationUpdate) },
                          { key: 'randomizeAnimStart', label: 'Randomize Anim Start', value: objectInfo.randomizeAnimStart !== undefined ? (objectInfo.randomizeAnimStart ? 'Yes' : 'No') : 'Yes', isDefault: isDefaultValue('randomizeAnimStart', objectInfo.randomizeAnimStart) },
                          { key: 'ambient', label: 'Ambient', value: objectInfo.ambient ?? 0, isDefault: isDefaultValue('ambient', objectInfo.ambient), isMono: true },
                          { key: 'contrast', label: 'Contrast', value: objectInfo.contrast ?? 0, isDefault: isDefaultValue('contrast', objectInfo.contrast), isMono: true },
                          { key: 'solid', label: 'Solid', value: objectInfo.solid ?? 2, isDefault: isDefaultValue('solid', objectInfo.solid), isMono: true },
                          { key: 'clipMask', label: 'Clip Mask', value: objectInfo.clipMask ?? 0, isDefault: isDefaultValue('clipMask', objectInfo.clipMask), isMono: true },
                          { key: 'clipped', label: 'Clipped', value: objectInfo.clipped !== undefined ? (objectInfo.clipped ? 'Yes' : 'No') : 'Yes', isDefault: isDefaultValue('clipped', objectInfo.clipped) },
                          { key: 'clipType', label: 'Clip Type', value: objectInfo.clipType ?? -1, isDefault: isDefaultValue('clipType', objectInfo.clipType), isMono: true },
                          { key: 'obstructive', label: 'Obstructive', value: objectInfo.obstructive ? 'Yes' : 'No', isDefault: isDefaultValue('obstructive', objectInfo.obstructive) },
                          { key: 'impenetrable', label: 'Impenetrable', value: objectInfo.impenetrable !== undefined ? (objectInfo.impenetrable ? 'Yes' : 'No') : 'Yes', isDefault: isDefaultValue('impenetrable', objectInfo.impenetrable) },
                          { key: 'mapSceneID', label: 'Map Scene ID', value: objectInfo.mapSceneID ?? -1, isDefault: isDefaultValue('mapSceneID', objectInfo.mapSceneID), isMono: true },
                          { key: 'category', label: 'Category', value: objectInfo.category ?? -1, isDefault: isDefaultValue('category', objectInfo.category), isMono: true },
                          { key: 'supportsItems', label: 'Supports Items', value: objectInfo.supportsItems ?? -1, isDefault: isDefaultValue('supportsItems', objectInfo.supportsItems), isMono: true },
                          { key: 'isRotated', label: 'Is Rotated', value: objectInfo.isRotated ? 'Yes' : 'No', isDefault: isDefaultValue('isRotated', objectInfo.isRotated) },
                          { key: 'ambientSoundId', label: 'Ambient Sound ID', value: objectInfo.ambientSoundId ?? -1, isDefault: isDefaultValue('ambientSoundId', objectInfo.ambientSoundId), isMono: true },
                          { key: 'soundMin', label: 'Sound Min', value: objectInfo.soundMin ?? 0, isDefault: isDefaultValue('soundMin', objectInfo.soundMin), isMono: true },
                          { key: 'soundMax', label: 'Sound Max', value: objectInfo.soundMax ?? 0, isDefault: isDefaultValue('soundMax', objectInfo.soundMax), isMono: true },
                          { key: 'soundDistance', label: 'Sound Distance', value: objectInfo.soundDistance ?? 0, isDefault: isDefaultValue('soundDistance', objectInfo.soundDistance), isMono: true },
                          { key: 'soundRetain', label: 'Sound Retain', value: objectInfo.soundRetain ?? 0, isDefault: isDefaultValue('soundRetain', objectInfo.soundRetain), isMono: true },
                          { key: 'soundDistanceFadeCurve', label: 'Sound Distance Fade Curve', value: objectInfo.soundDistanceFadeCurve ?? 0, isDefault: isDefaultValue('soundDistanceFadeCurve', objectInfo.soundDistanceFadeCurve), isMono: true },
                          { key: 'soundFadeInDuration', label: 'Sound Fade In Duration', value: objectInfo.soundFadeInDuration ?? 300, isDefault: isDefaultValue('soundFadeInDuration', objectInfo.soundFadeInDuration), isMono: true },
                          { key: 'soundFadeOutDuration', label: 'Sound Fade Out Duration', value: objectInfo.soundFadeOutDuration ?? 300, isDefault: isDefaultValue('soundFadeOutDuration', objectInfo.soundFadeOutDuration), isMono: true },
                          { key: 'soundFadeInCurve', label: 'Sound Fade In Curve', value: objectInfo.soundFadeInCurve ?? 0, isDefault: isDefaultValue('soundFadeInCurve', objectInfo.soundFadeInCurve), isMono: true },
                          { key: 'soundFadeOutCurve', label: 'Sound Fade Out Curve', value: objectInfo.soundFadeOutCurve ?? 0, isDefault: isDefaultValue('soundFadeOutCurve', objectInfo.soundFadeOutCurve), isMono: true },
                          { key: 'soundVisibility', label: 'Sound Visibility', value: objectInfo.soundVisibility ?? 2, isDefault: isDefaultValue('soundVisibility', objectInfo.soundVisibility), isMono: true },
                          { key: 'varbitId', label: 'Varbit ID', value: objectInfo.varbitId ?? -1, isDefault: isDefaultValue('varbitId', objectInfo.varbitId), isMono: true },
                          { key: 'varbit', label: 'Varbit', value: objectInfo.varbit ?? -1, isDefault: isDefaultValue('varbit', objectInfo.varbit), isMono: true },
                          { key: 'varp', label: 'Varp', value: objectInfo.varp ?? -1, isDefault: isDefaultValue('varp', objectInfo.varp), isMono: true },
                          { key: 'modelSizeX', label: 'Model Size X', value: objectInfo.modelSizeX ?? 128, isDefault: isDefaultValue('modelSizeX', objectInfo.modelSizeX), isMono: true },
                          { key: 'modelSizeY', label: 'Model Size Y', value: objectInfo.modelSizeY ?? 128, isDefault: isDefaultValue('modelSizeY', objectInfo.modelSizeY), isMono: true },
                          { key: 'modelSizeZ', label: 'Model Size Z', value: objectInfo.modelSizeZ ?? 128, isDefault: isDefaultValue('modelSizeZ', objectInfo.modelSizeZ), isMono: true },
                          { key: 'modelClipped', label: 'Model Clipped', value: objectInfo.modelClipped ? 'Yes' : 'No', isDefault: isDefaultValue('modelClipped', objectInfo.modelClipped) },
                          // Arrays formatted as comma-separated values
                          { 
                            key: 'objectModels', 
                            label: 'Object Models', 
                            value: objectInfo.objectModels && objectInfo.objectModels.length > 0 && !isDefaultValue('objectModels', objectInfo.objectModels) 
                              ? objectInfo.objectModels.join(', ') 
                              : null,
                            isDefault: isDefaultValue('objectModels', objectInfo.objectModels),
                            isMono: true
                          },
                          { 
                            key: 'objectTypes', 
                            label: 'Object Types', 
                            value: objectInfo.objectTypes && objectInfo.objectTypes.length > 0 && !isDefaultValue('objectTypes', objectInfo.objectTypes) 
                              ? objectInfo.objectTypes.join(', ') 
                              : null,
                            isDefault: isDefaultValue('objectTypes', objectInfo.objectTypes),
                            isMono: true
                          },
                          { 
                            key: 'ambientSoundIds', 
                            label: 'Ambient Sound IDs', 
                            value: objectInfo.ambientSoundIds && objectInfo.ambientSoundIds.length > 0 && !isDefaultValue('ambientSoundIds', objectInfo.ambientSoundIds)
                              ? objectInfo.ambientSoundIds.join(', ')
                              : null,
                            isDefault: isDefaultValue('ambientSoundIds', objectInfo.ambientSoundIds),
                            isMono: true
                          },
                          { 
                            key: 'actions', 
                            label: 'Actions', 
                            value: objectInfo.actions && objectInfo.actions.length > 0 && !isDefaultValue('actions', objectInfo.actions)
                              ? objectInfo.actions.map((action, idx) => action || `null`).join(', ')
                              : null,
                            isDefault: isDefaultValue('actions', objectInfo.actions)
                          },
                          { 
                            key: 'transforms', 
                            label: 'Transforms', 
                            value: objectInfo.transforms && objectInfo.transforms.length > 0 && !isDefaultValue('transforms', objectInfo.transforms)
                              ? objectInfo.transforms.join(', ')
                              : null,
                            isDefault: isDefaultValue('transforms', objectInfo.transforms),
                            isMono: true
                          },
                          // Colors - show as RSColorBox components
                          { 
                            key: 'originalColours', 
                            label: 'Original Colours', 
                            value: objectInfo.originalColours && objectInfo.originalColours.length > 0 && !isDefaultValue('originalColours', objectInfo.originalColours)
                              ? objectInfo.originalColours
                              : null,
                            isDefault: isDefaultValue('originalColours', objectInfo.originalColours),
                            isColorArray: true
                          },
                          { 
                            key: 'modifiedColours', 
                            label: 'Modified Colours', 
                            value: objectInfo.modifiedColours && objectInfo.modifiedColours.length > 0 && !isDefaultValue('modifiedColours', objectInfo.modifiedColours)
                              ? objectInfo.modifiedColours
                              : null,
                            isDefault: isDefaultValue('modifiedColours', objectInfo.modifiedColours),
                            isColorArray: true
                          },
                          { 
                            key: 'originalTextureColours', 
                            label: 'Original Texture Colours', 
                            value: objectInfo.originalTextureColours && objectInfo.originalTextureColours.length > 0 && !isDefaultValue('originalTextureColours', objectInfo.originalTextureColours)
                              ? objectInfo.originalTextureColours
                              : null,
                            isDefault: isDefaultValue('originalTextureColours', objectInfo.originalTextureColours),
                            isColorArray: true
                          },
                          { 
                            key: 'modifiedTextureColours', 
                            label: 'Modified Texture Colours', 
                            value: objectInfo.modifiedTextureColours && objectInfo.modifiedTextureColours.length > 0 && !isDefaultValue('modifiedTextureColours', objectInfo.modifiedTextureColours)
                              ? objectInfo.modifiedTextureColours
                              : null,
                            isDefault: isDefaultValue('modifiedTextureColours', objectInfo.modifiedTextureColours),
                            isColorArray: true
                          },
                          // Params - format as key:value pairs
                          ...(objectInfo.params && Object.keys(objectInfo.params).length > 0 && !isDefaultValue('params', objectInfo.params)
                            ? Object.entries(objectInfo.params).map(([key, value]) => ({
                                key: `params.${key}`,
                                label: `Params.${key}`,
                                value: String(value),
                                isDefault: false,
                                isMono: false
                              }))
                            : []
                          ),
                        ].filter(row => !row.isDefault && row.value !== null);
                        
                        return allRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableHead className="w-[220px]">{row.label}</TableHead>
                            <TableCell className={row.isMono ? 'font-mono' : ''}>
                              {row.isColorArray && Array.isArray(row.value) ? (
                                <div className="flex flex-wrap gap-2">
                                  {row.value.map((color: number, idx: number) => (
                                    <RSColorBox
                                      key={idx}
                                      width={32}
                                      height={32}
                                      packedHsl={color}
                                      tooltip={true}
                                    />
                                  ))}
                                </div>
                              ) : (
                                row.value
                              )}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="model-info" className="mt-0 flex-1 min-h-0 overflow-hidden">
                {objectInfo?.objectModels && objectInfo.objectModels.length > 0 ? (
                  objectInfo.objectModels.length === 1 ? (
                    // Single model - show directly
                    <div className="h-full overflow-y-scroll px-6 py-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                      <div className="space-y-6">
                        {modelDataLoading.has(objectInfo.objectModels[0]) ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : modelData.has(objectInfo.objectModels[0]) ? (
                          <ModelInfoContent modelData={modelData.get(objectInfo.objectModels[0])!} />
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">No model data available</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Multiple models - show collapsibles
                    <div className="h-full overflow-y-scroll px-6 py-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                      <div className="space-y-3">
                        {objectInfo.objectModels.map((modelId) => (
                          <Collapsible key={modelId} defaultOpen={modelId === objectInfo.objectModels![0]}>
                            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold bg-muted/50 hover:bg-muted rounded-md transition-colors border">
                              <span>Model {modelId}</span>
                              <IconChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 px-4 py-4 border rounded-md bg-background">
                                {modelDataLoading.has(modelId) ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                  </div>
                                ) : modelData.has(modelId) ? (
                                  <ModelInfoContent modelData={modelData.get(modelId)!} />
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">No model data available</div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-full overflow-y-scroll px-6 py-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                    <div className="text-center py-8 text-muted-foreground">No models available</div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No object info available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

