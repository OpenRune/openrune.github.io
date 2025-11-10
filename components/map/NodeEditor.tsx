"use client";

import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import ReactFlow, {
  Node as ReactFlowNode,
  Edge,
  Connection,
  addEdge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Filter, MapPin, Eye, X, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { IconTarget, IconCircleDashed } from '@tabler/icons-react';
import { OBJTYPES, useGamevals } from '@/lib/gamevals';
import { cn } from '@/lib/utils';
import { GamevalIdSearch, GamevalSuggestion } from '@/components/search/GamevalIdSearch';

// Export the Block interface for compatibility
export type BlockType = 'filter' | 'input' | 'output';

export interface Block {
  id: string;
  type: BlockType;
  category: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface FilterBlock extends Block {
  type: 'filter';
  category: 'object_type' | 'object_type_enum' | 'plane' | 'overlay' | 'underlay' | 'orientation' | 'dynamic';
  data: {
    objectId?: number;
    objectLabel?: string;
    objectTypeEnum?: number;
    plane?: number | 'all';
    overlayId?: number;
    underlayId?: number;
    orientation?: number;
    mode?: 'include' | 'exclude';
    dynamicState?: 'dynamic' | 'static';
  };
}

export interface InputBlock extends Block {
  type: 'input';
  category: 'region';
  data: {
    regionId?: number;
  };
}

export interface OutputBlock extends Block {
  type: 'output';
  category: 'display' | 'highlight' | 'count';
  data: {
    format?: string;
    style?: Record<string, any>;
  };
}

interface NodeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecute?: (blocks: Block[]) => void;
  mapInstance?: any;
}

const OBJECT_TYPE_ENUMS = [
  { value: 0, label: 'WallStraight' },
  { value: 1, label: 'WallDiagonalCorner' },
  { value: 2, label: 'WallCorner' },
  { value: 3, label: 'WallSquareCorner' },
  { value: 4, label: 'WallDecorStraightNoOffset' },
  { value: 5, label: 'WallDecorStraightOffset' },
  { value: 6, label: 'WallDecorDiagonalOffset' },
  { value: 7, label: 'WallDecorDiagonalNoOffset' },
  { value: 8, label: 'WallDecorDiagonalBoth' },
  { value: 9, label: 'WallDiagonal' },
  { value: 10, label: 'CentrepieceStraight' },
  { value: 11, label: 'CentrepieceDiagonal' },
  { value: 12, label: 'RoofStraight' },
  { value: 13, label: 'RoofDiagonalWithRoofEdge' },
  { value: 14, label: 'RoofDiagonal' },
  { value: 15, label: 'RoofCornerConcave' },
  { value: 16, label: 'RoofCornerConvex' },
  { value: 17, label: 'RoofFlat' },
  { value: 18, label: 'RoofEdgeStraight' },
  { value: 19, label: 'RoofEdgeDiagonalCorner' },
  { value: 20, label: 'RoofEdgeCorner' },
  { value: 21, label: 'RoofEdgeSquarecorner' },
  { value: 22, label: 'GroundDecor' },
];

const NODE_CATEGORIES: Record<string, Array<{ id: string; label: string; icon: any; color: string }>> = {
  filter: [
    { id: 'object_type', label: 'Filter by Object ID', icon: Filter, color: '#3b82f6' },
    { id: 'object_type_enum', label: 'Filter by Object Type', icon: Filter, color: '#3b82f6' },
    { id: 'plane', label: 'Filter by Plane', icon: Filter, color: '#3b82f6' },
    { id: 'orientation', label: 'Filter by Orientation', icon: Filter, color: '#3b82f6' },
    { id: 'overlay', label: 'Filter by Overlay ID', icon: Filter, color: '#f59e0b' },
    { id: 'underlay', label: 'Filter by Underlay ID', icon: Filter, color: '#f59e0b' },
    { id: 'dynamic', label: 'Filter by Dynamic State', icon: Filter, color: '#3b82f6' },
  ],
  input: [
    { id: 'region', label: 'Select Region', icon: MapPin, color: '#10b981' },
  ],
  output: [
    { id: 'display', label: 'Display Results', icon: Eye, color: '#8b5cf6' },
    { id: 'highlight', label: 'Highlight on Map', icon: Eye, color: '#8b5cf6' },
    { id: 'count', label: 'Count Results', icon: Eye, color: '#8b5cf6' },
  ],
};

// Custom Node Components
// Object Gameval Input with autocomplete (like ObjectFinder)
const ObjectGamevalInput = memo(function ObjectGamevalInput({
  value,
  label,
  onChange,
  onLabelChange,
}: {
  value: string;
  label?: string;
  onChange: (value: string) => void;
  onLabelChange?: (label?: string) => void;
}) {
  const { lookupGamevalByName } = useGamevals();
  const [searchMode, setSearchMode] = useState<'gameval' | 'id'>(() => {
    if (label && label.trim() !== '') {
      return 'gameval';
    }
    if (value && value.trim() !== '' && /^\d+$/.test(value.trim())) {
      return 'id';
    }
    return 'gameval';
  });
  const [inputValue, setInputValue] = useState<string>(label || value || '');

  useEffect(() => {
    const next = label || value || '';
    setInputValue(next);
    if (label && label.trim() !== '') {
      setSearchMode('gameval');
    } else if (value && value.trim() !== '' && /^\d+$/.test(value.trim())) {
      setSearchMode('id');
    }
  }, [value, label]);

  const handleValueChange = useCallback(
    (nextValue: string, modeValue: string) => {
      if (modeValue === 'id') {
        const trimmed = nextValue.trim();
        setInputValue(trimmed);
        onLabelChange?.(undefined);
        onChange(trimmed);
        setSearchMode('id');
      } else {
        setInputValue(nextValue);
        onLabelChange?.(nextValue.trim() || undefined);
        onChange('');
        setSearchMode('gameval');
      }
    },
    [onChange, onLabelChange]
  );

  const handleModeChange = useCallback(
    (modeValue: string) => {
      if (modeValue === 'gameval' || modeValue === 'id') {
        setSearchMode(modeValue);
        setInputValue('');
        onLabelChange?.(undefined);
        onChange('');
      }
    },
    [onChange, onLabelChange]
  );

  const handleEnter = useCallback(
    (currentValue: string, modeValue: string) => {
      const trimmed = currentValue.trim();
      if (modeValue === 'id') {
        onLabelChange?.(undefined);
        onChange(trimmed);
        setInputValue(trimmed);
        setSearchMode('id');
        return;
      }

      if (!trimmed) {
        onChange('');
        onLabelChange?.(undefined);
        return;
      }

      const normalized = trimmed.replace(/\s+/g, '_');
      const resolvedId = lookupGamevalByName(OBJTYPES, normalized);
      if (resolvedId !== undefined) {
        onChange(String(resolvedId));
        onLabelChange?.(normalized);
        setInputValue(normalized);
        setSearchMode('gameval');
      }
    },
    [lookupGamevalByName, onChange, onLabelChange]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: GamevalSuggestion, modeValue: string) => {
      if (modeValue === 'gameval') {
        setInputValue(suggestion.name);
        onLabelChange?.(suggestion.name);
        onChange(String(suggestion.id));
        setSearchMode('gameval');
        return true;
      }

      const idString = suggestion.id.toString();
      setInputValue(idString);
      onLabelChange?.(undefined);
      onChange(idString);
      setSearchMode('id');
      return true;
    },
    [onChange, onLabelChange]
  );

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">
        Object {searchMode === 'gameval' ? 'Gameval' : 'ID'}
      </label>
      <GamevalIdSearch
        mode={searchMode}
        value={inputValue}
        onValueChange={handleValueChange}
        onModeChange={handleModeChange}
        onEnter={handleEnter}
        onSuggestionSelect={handleSuggestionSelect}
        modeOptions={[
          { value: 'gameval', label: 'Gameval', placeholder: 'Search by gameval...' },
          { value: 'id', label: 'ID', placeholder: 'Search by ID...' },
        ]}
        gamevalType={OBJTYPES}
        suggestionLimit={8}
        inputClassName="h-8 pl-7 pr-20 text-sm"
      />
    </div>
  );
});

const FilterNode = memo(function FilterNode({ data, selected }: { data: any; selected: boolean }) {
  const category = NODE_CATEGORIES.filter.find(c => c.id === data.category);
  const Icon = category?.icon || Filter;
  const color = category?.color || '#3b82f6';

  return (
    <div
      className={cn(
        "px-3.5 py-2.5 shadow-md rounded-lg border-2 min-w-[180px] bg-background border-solid",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ borderColor: color, backgroundColor: 'var(--background)' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3.5 !h-3.5" />
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="font-medium text-sm" style={{ color }}>
          {category?.label || data.category}
        </span>
      </div>
      <div className="space-y-2">
        {/* Include/Exclude dropdown for all filters except plane */}
        {data.category !== 'plane' && (
          <div>
            <label className="text-xs text-muted-foreground">Filter Mode</label>
            <Select
              value={data.mode || 'include'}
              onValueChange={(value) => data.onChange?.('mode', value)}
            >
              <SelectTrigger className="h-8 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="include">Include</SelectItem>
                <SelectItem value="exclude">Exclude</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {data.category === 'object_type' && (
          <ObjectGamevalInput
            value={data.objectId !== undefined ? String(data.objectId) : ''}
            label={data.objectLabel}
            onChange={(value) => {
              const trimmed = value.trim();
              if (!trimmed) {
                data.onChange?.('objectId', undefined);
                return;
              }

              const numValue = parseInt(trimmed, 10);
              if (!isNaN(numValue)) {
                data.onChange?.('objectId', numValue);
              } else {
                data.onChange?.('objectId', undefined);
              }
            }}
            onLabelChange={(label) => data.onChange?.('objectLabel', label)}
          />
        )}
        {data.category === 'object_type_enum' && (
          <div>
            <label className="text-xs text-muted-foreground">Object Type</label>
            <Select
              value={data.objectTypeEnum !== undefined ? String(data.objectTypeEnum) : ''}
              onValueChange={(value) => data.onChange?.('objectTypeEnum', value !== '' ? parseInt(value) : undefined)}
            >
              <SelectTrigger className="h-8 mt-1 text-sm">
                <SelectValue placeholder="Select object type" />
              </SelectTrigger>
              <SelectContent>
                {OBJECT_TYPE_ENUMS.map((type) => (
                  <SelectItem key={type.value} value={String(type.value)}>
                    {type.value}: {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {data.category === 'plane' && (
          <div>
            <label className="text-xs text-muted-foreground">Plane</label>
            <Select
              value={data.plane === undefined || data.plane === 'all' ? 'all' : String(data.plane)}
              onValueChange={(value) => data.onChange?.('plane', value === 'all' ? 'all' : parseInt(value))}
            >
              <SelectTrigger className="h-8 mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="0">Plane 0</SelectItem>
                <SelectItem value="1">Plane 1</SelectItem>
                <SelectItem value="2">Plane 2</SelectItem>
                <SelectItem value="3">Plane 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {data.category === 'overlay' && (
          <div>
            <label className="text-xs text-muted-foreground">Overlay ID</label>
            <Input
              type="number"
              placeholder="Enter overlay ID"
              value={data.overlayId || ''}
              onChange={(e) => data.onChange?.('overlayId', parseInt(e.target.value) || undefined)}
              className="h-8 mt-1 text-sm"
            />
          </div>
        )}
        {data.category === 'underlay' && (
          <div>
            <label className="text-xs text-muted-foreground">Underlay ID</label>
            <Input
              type="number"
              placeholder="Enter underlay ID"
              value={data.underlayId || ''}
              onChange={(e) => data.onChange?.('underlayId', parseInt(e.target.value) || undefined)}
              className="h-8 mt-1 text-sm"
            />
          </div>
        )}
        {data.category === 'orientation' && (
          <div>
            <label className="text-xs text-muted-foreground">Orientation</label>
            <Select
              value={data.orientation !== undefined ? String(data.orientation) : ''}
              onValueChange={(value) => data.onChange?.('orientation', value !== '' ? parseInt(value) : undefined)}
            >
              <SelectTrigger className="h-8 mt-1 text-sm">
                <SelectValue placeholder="Select orientation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {data.category === 'dynamic' && (
          <div>
            <label className="text-xs text-muted-foreground">Dynamic State</label>
            <Select
              value={data.dynamicState ?? 'dynamic'}
              onValueChange={(value) => data.onChange?.('dynamicState', value as 'dynamic' | 'static')}
            >
              <SelectTrigger className="h-8 mt-1 text-sm">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dynamic">Dynamic</SelectItem>
                <SelectItem value="static">Not Dynamic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3.5 !h-3.5" />
    </div>
  );
});

const InputNode = memo(function InputNode({ data, selected }: { data: any; selected: boolean }) {
  const category = NODE_CATEGORIES.input.find(c => c.id === data.category);
  const Icon = category?.icon || MapPin;
  const color = category?.color || '#10b981';

  return (
    <div
      className={cn(
        "px-3.5 py-2.5 shadow-md rounded-lg border-2 min-w-[180px] bg-background border-solid",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ borderColor: color, backgroundColor: 'var(--background)' }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="font-medium text-sm" style={{ color }}>
          {category?.label || data.category}
        </span>
      </div>
      <div className="space-y-2">
        {data.category === 'region' && (
          <div>
            <label className="text-xs text-muted-foreground">Region ID</label>
            <Input
              type="number"
              placeholder="Enter region ID"
              value={data.regionId || ''}
              onChange={(e) => data.onChange?.('regionId', parseInt(e.target.value) || undefined)}
              className="h-8 mt-1 text-sm"
              style={{ color: 'white' }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3.5 !h-3.5" />
    </div>
  );
});

const OutputNode = memo(function OutputNode({ data, selected }: { data: any; selected: boolean }) {
  const category = NODE_CATEGORIES.output.find(c => c.id === data.category);
  const Icon = category?.icon || Eye;
  const color = category?.color || '#8b5cf6';

  return (
    <div
      className={cn(
        "px-3.5 py-2.5 shadow-md rounded-lg border-2 min-w-[180px] bg-background border-solid",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ borderColor: color, backgroundColor: 'var(--background)' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3.5 !h-3.5" />
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="font-medium text-sm" style={{ color }}>
          {category?.label || data.category}
        </span>
      </div>
      <div className="space-y-2">
        {data.category === 'display' && (
          <div>
            <label className="text-xs text-muted-foreground">Format</label>
            <Select
              value={data.format || 'list'}
              onValueChange={(value) => data.onChange?.('format', value)}
            >
              <SelectTrigger className="h-8 mt-1 text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list" className="text-foreground">List</SelectItem>
                <SelectItem value="table" className="text-foreground">Table</SelectItem>
                <SelectItem value="json" className="text-foreground">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {(data.category === 'highlight' || data.category === 'count') && (
          <div className="text-xs text-muted-foreground">
            {data.category === 'highlight' && 'Highlights matching results on the map'}
            {data.category === 'count' && 'Returns the count of matching results'}
          </div>
        )}
      </div>
    </div>
  );
});

const nodeTypes: NodeTypes = {
  filter: FilterNode,
  input: InputNode,
  output: OutputNode,
};

function NodeEditorInner({ open, onOpenChange, onExecute, mapInstance }: NodeEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const regionInputNode = useMemo(
    () => nodes.find((n) => n.type === 'input' && n.data.category === 'region'),
    [nodes]
  );
  const outputNodes = useMemo(() => nodes.filter((n) => n.type === 'output'), [nodes]);

  const reachableFromRegion = useMemo(() => {
    if (!regionInputNode) {
      return new Set<string>();
    }

    const adjacency = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    });

    const visited = new Set<string>();
    const queue: string[] = [regionInputNode.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    return visited;
  }, [regionInputNode, edges]);

  const hasOutputNode = outputNodes.length > 0;
  const hasValidConnection = useMemo(() => {
    if (!regionInputNode || outputNodes.length === 0) {
      return false;
    }
    return outputNodes.some((node) => reachableFromRegion.has(node.id));
  }, [regionInputNode, outputNodes, reachableFromRegion]);

  // Initialize with a region input node when editor opens
  useEffect(() => {
    if (open) {
      const nodeId = `input_region_${Date.now()}`;
      const initialNode: ReactFlowNode = {
        id: nodeId,
        type: 'input',
        position: { x: 250, y: 200 },
        deletable: false, // Region input node cannot be deleted
        data: {
          category: 'region',
          regionId: undefined,
          onChange: (key: string, value: any) => {
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    data: { ...node.data, [key]: value },
                  };
                }
                return node;
              })
            );
          },
        },
      };
      setNodes([initialNode]);
      setEdges([]);
      setSelectedNode(null);
    } else {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  }, [open, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Add node from palette
  const addNode = useCallback(
    (type: BlockType, category: string) => {
      setNodes((nds) => {
        if (type === 'input' && category === 'region') {
          const hasRegionNode = nds.some((n) => n.type === 'input' && n.data.category === 'region');
          if (hasRegionNode) {
            return nds;
          }
        }

        const nodeDef = NODE_CATEGORIES[type]?.find((c) => c.id === category);
        if (!nodeDef) return nds;

        const nodeId = `${type}_${category}_${Date.now()}`;
        const newNode: ReactFlowNode = {
          id: nodeId,
          type,
          position: { x: Math.random() * 600 + 300, y: Math.random() * 600 + 200 },
          data: {
            category,
            mode: 'include',
            ...(category === 'object_type' && { objectId: undefined }),
            ...(category === 'object_type' && { objectLabel: undefined }),
            ...(category === 'object_type_enum' && { objectTypeEnum: undefined }),
            ...(category === 'plane' && { plane: 'all' }),
            ...(category === 'orientation' && { orientation: undefined }),
            ...(category === 'dynamic' && { dynamicState: 'dynamic' }),
            ...(category === 'overlay' && { overlayId: undefined }),
            ...(category === 'underlay' && { underlayId: undefined }),
            ...(category === 'region' && { regionId: undefined }),
            ...(category === 'display' && { format: 'list' }),
            onChange: (key: string, value: any) => {
              setNodes((inner) =>
                inner.map((node) =>
                  node.id === nodeId
                    ? {
                        ...node,
                        data: { ...node.data, [key]: value },
                      }
                    : node
                )
              );
            },
          },
        };

        return [...nds, newNode];
      });
    },
    [setNodes]
  );

  // Convert nodes to blocks for execution
  const convertNodesToBlocks = useCallback((): Block[] => {
    return nodes.map((node) => {
      const { onChange: _onChange, ...restData } = node.data;
      return {
        id: node.id,
        type: node.type as BlockType,
        category: node.data.category,
        data: { ...restData },
        position: node.position,
      };
    });
  }, [nodes]);

  // Execute query
  const hasRegionId =
    !!regionInputNode &&
    typeof regionInputNode.data.regionId === 'number' &&
    !Number.isNaN(regionInputNode.data.regionId);

  const handleExecute = useCallback(() => {
    if (!hasOutputNode) {
      return;
    }
    if (!hasValidConnection) {
      return;
    }
    if (
      !regionInputNode ||
      typeof regionInputNode.data.regionId !== 'number' ||
      Number.isNaN(regionInputNode.data.regionId)
    ) {
      return;
    }
    const blocks = convertNodesToBlocks();
    if (onExecute) {
      onExecute(blocks);
    }
  }, [hasOutputNode, hasValidConnection, regionInputNode, convertNodesToBlocks, onExecute]);

  // Clear all nodes and reinitialize with region input
  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const handleClearConfirm = useCallback(() => {
    setEdges([]);
    setSelectedNode(null);
    
    // Reinitialize with a region input node (same as when editor opens)
    const nodeId = `input_region_${Date.now()}`;
    const initialNode: ReactFlowNode = {
      id: nodeId,
      type: 'input',
      position: { x: 250, y: 200 },
      deletable: false, // Region input node cannot be deleted
      data: {
        category: 'region',
        regionId: undefined,
        onChange: (key: string, value: any) => {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: { ...node.data, [key]: value },
                };
              }
              return node;
            })
          );
        },
      },
    };
    setNodes([initialNode]);
    setShowClearConfirm(false);
  }, [setNodes, setEdges]);

  // Delete selected nodes (but never allow deleting region input node)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (isEditableTarget) {
        return;
      }

      if (e.key === 'Delete' && selectedNode) {
        // Prevent deleting region input nodes
        const nodeToDelete = nodes.find((n) => n.id === selectedNode);
        if (nodeToDelete && nodeToDelete.type === 'input' && nodeToDelete.data.category === 'region') {
          return; // Don't allow deleting region input node
        }
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
        setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode));
        setSelectedNode(null);
      }
    };

    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedNode, open, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    setSelectedNode(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);
  
  return (
    <>
      {/* Clear Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Clear All Nodes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove all nodes except the required region input. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearConfirm}>
              Clear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="!max-w-[60vw] !w-[60vw] h-[90vh] flex flex-col p-0"
        style={{ maxWidth: '60vw', width: '60vw', height: '90vh' }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Region Query Builder</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Node Palette */}
          <div className="w-64 border-r bg-muted/50 flex flex-col">
            <div className="p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
              <h3 className="font-semibold text-sm mb-3 flex-shrink-0">Node Palette</h3>
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-4">
                  {/* Input Nodes */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Inputs</h4>
                    <div className="space-y-1">
                      {NODE_CATEGORIES.input.map((cat) => {
                        const Icon = cat.icon;
                        const isDisabled = cat.id === 'region' && nodes.some((n) => n.type === 'input' && n.data.category === 'region');
                        return (
                          <button
                            key={cat.id}
                            onClick={() => !isDisabled && addNode('input', cat.id)}
                            disabled={isDisabled}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors",
                              isDisabled
                                ? "opacity-50 cursor-not-allowed bg-muted"
                                : "hover:bg-accent border-border cursor-pointer"
                            )}
                          >
                            <Icon className="h-4 w-4" style={{ color: cat.color }} />
                            <span>{cat.label}</span>
                            {isDisabled && (
                              <span className="text-xs text-muted-foreground ml-auto">(1 max)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter Nodes */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Filters</h4>
                    <div className="space-y-1">
                      {NODE_CATEGORIES.filter.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => addNode('filter', cat.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent border border-border transition-colors cursor-pointer"
                          >
                            <Icon className="h-4 w-4" style={{ color: cat.color }} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Output Nodes */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase">Outputs</h4>
                    <div className="space-y-1">
                      {NODE_CATEGORIES.output.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => addNode('output', cat.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent border border-border transition-colors cursor-pointer"
                          >
                            <Icon className="h-4 w-4" style={{ color: cat.color }} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t space-y-2 flex-shrink-0">
                <Button 
                  onClick={handleExecute} 
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" 
                  disabled={!hasOutputNode || !hasValidConnection || !hasRegionId}
                  size="sm"
                  title={
                    !hasOutputNode
                      ? "Add an output node"
                      : !hasValidConnection
                        ? "Connect output to region node"
                        : !hasRegionId
                          ? "Enter a region ID"
                          : ""
                  }
                >
                  <Play className="h-4 w-4" />
                  Execute
                </Button>
                <Button 
                  onClick={handleClear} 
                  variant="outline" 
                  className="w-full gap-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" 
                  disabled={nodes.length <= 1 && nodes.some(n => n.type === 'input' && n.data.category === 'region')}
                  size="sm"
                  title={nodes.length <= 1 ? "Add nodes to clear" : "Clear all nodes and reset"}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* React Flow Canvas */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes.map(node => {
                // Prevent deletion of region input nodes
                if (node.type === 'input' && node.data.category === 'region') {
                  return { ...node, deletable: false };
                }
                return node;
              })}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
              minZoom={0.5}
              maxZoom={1.5}
              className="bg-background"
              panOnScroll={false}
              panOnDrag={true}
              zoomOnScroll={true}
              zoomOnPinch={true}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  if (node.type === 'input') return '#10b981';
                  if (node.type === 'filter') return '#3b82f6';
                  if (node.type === 'output') return '#8b5cf6';
                  return '#gray';
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
                style={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function NodeEditor(props: NodeEditorProps) {
  return (
    <ReactFlowProvider>
      <NodeEditorInner {...props} />
    </ReactFlowProvider>
  );
}

// Export as BlockEditor for compatibility
export { NodeEditor as BlockEditor };

