"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Square, X, Download, Route, Minimize2, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Position } from '@/lib/map/model/Position';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Local imports
import { AreaSelectionProps, SelectionItem, ExportFormat } from './AreaSelection/types';
import { STORAGE_KEY_SELECTED_TOOL } from './AreaSelection/constants';
import { useCollectionControl } from './AreaSelection/hooks';
import { AreaItemList } from './AreaSelection/AreaItemList';
import { ImportView } from './AreaSelection/ImportView';
import { exportAllItems } from './AreaSelection/ExportUtils';

export function AreaSelection({
    onItemClick,
    onJumpToPosition,
    onItemSelected,
    collectionControl,
    importMode = false,
    importFormat: propImportFormat,
    onImportModeChange
}: AreaSelectionProps) {
    const [showImportView, setShowImportView] = useState(false);
    const [localImportFormat, setLocalImportFormat] = useState<'normal' | '117hd'>('normal');
    const importFormat = propImportFormat ?? localImportFormat;
    const [itemNames, setItemNames] = useState<Map<string, string>>(new Map());
    const [isLocalhost, setIsLocalhost] = useState(false);

    const {
        items,
        selectedItemId,
        hiddenItems,
        selectedTool,
        setSelectedItemId,
        setHiddenItems,
        setSelectedTool
    } = useCollectionControl(collectionControl);

    // Merge custom names with items
    const itemsWithNames = items.map(item => ({
        ...item,
        name: itemNames.get(item.id)
    }));

    const handleRename = (itemId: string, name: string) => {
        setItemNames(prev => {
            const newMap = new Map(prev);
            if (name) {
                newMap.set(itemId, name);
            } else {
                newMap.delete(itemId);
            }
            return newMap;
        });
    };

    // Clean up names for items that no longer exist
    useEffect(() => {
        const itemIds = new Set(items.map(item => item.id));
        setItemNames(prev => {
            const newMap = new Map();
            prev.forEach((name, id) => {
                if (itemIds.has(id)) {
                    newMap.set(id, name);
                }
            });
            return newMap;
        });
    }, [items]);

    useEffect(() => {
        setShowImportView(importMode);
    }, [importMode]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsLocalhost(
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'
            );
        }
    }, []);

    const handleClear = () => {
        if (collectionControl) {
            collectionControl.clearAll();
            collectionControl.clearHighlights();
        }
        setSelectedTool(null);
        setSelectedItemId(null);
        if (onItemSelected) {
            onItemSelected(null);
        }
    };

    const handleRemove = (item: SelectionItem, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!collectionControl) return;
        
        if (item.type === 'area') {
            const match = item.id.match(/^area-(\d+)$/);
            if (match) {
                const areaIndex = parseInt(match[1], 10);
                collectionControl.removeArea(areaIndex);
                setHiddenItems(prev => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            }
        } else if (item.type === 'poly') {
            collectionControl.clearPolyArea();
            setHiddenItems(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        } else if (item.type === 'path') {
            collectionControl.clearPath();
            setHiddenItems(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
        
        if (selectedItemId === item.id) {
            setSelectedItemId(null);
            if (onItemSelected) {
                onItemSelected(null);
            }
        }
    };

    const handleToggleHide = (item: SelectionItem, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!collectionControl) return;
        
        const isHidden = hiddenItems.has(item.id);
        const newHidden = !isHidden;
        
        if (item.type === 'area') {
            const match = item.id.match(/^area-(\d+)$/);
            if (match) {
                const areaIndex = parseInt(match[1], 10);
                collectionControl.setAreaVisible(areaIndex, !newHidden);
            }
        } else if (item.type === 'poly') {
            collectionControl.setPolyAreaVisible(!newHidden);
        }
        
        setHiddenItems(prev => {
            const next = new Set(prev);
            if (newHidden) {
                next.add(item.id);
            } else {
                next.delete(item.id);
            }
            return next;
        });
    };

    const handleExport = (item: SelectionItem, format: ExportFormat, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!collectionControl) return;
        
        let exportText = '';
        
        if (item.type === 'area') {
            const match = item.id.match(/^area-(\d+)$/);
            if (match) {
                const areaIndex = parseInt(match[1], 10);
                exportText = collectionControl.exportArea(areaIndex, format);
            }
        } else if (item.type === 'poly') {
            exportText = collectionControl.exportPolyArea(format);
        } else if (item.type === 'path') {
            exportText = collectionControl.exportPath(format);
        }
        
        if (exportText) {
            navigator.clipboard.writeText(exportText).then(() => {
                toast.success(`Exported as ${format.toUpperCase()} to clipboard`);
            }).catch(() => {
                toast.error('Failed to copy to clipboard');
            });
        }
    };

    const handleExportAll = (format: ExportFormat) => {
        if (!collectionControl) return;
        
        const areas = collectionControl.getAreas();
        const polyPositions = collectionControl.getPolyArea();
        
        if (areas.length === 0 && polyPositions.length === 0) {
            toast.error('No items to export');
            return;
        }
        
        const exportText = exportAllItems(collectionControl, format);
        
        if (exportText) {
            navigator.clipboard.writeText(exportText).then(() => {
                toast.success(`Exported all items as ${format.toUpperCase()} to clipboard`);
            }).catch(() => {
                toast.error('Failed to copy to clipboard');
            });
        }
    };

    const handleItemClick = (item: SelectionItem) => {
        if (collectionControl) {
            collectionControl.clearHighlights();
        }
        
        const wasSelected = selectedItemId === item.id;
        const newSelectedId = wasSelected ? null : item.id;
        setSelectedItemId(newSelectedId);
        
        if (onItemClick) {
            onItemClick(item);
        }
        
        if (onItemSelected) {
            onItemSelected(newSelectedId ? item : null);
        }
        
        if (collectionControl && newSelectedId) {
            if (item.type === 'area') {
                const match = item.id.match(/^area-(\d+)$/);
                if (match) {
                    const areaIndex = parseInt(match[1], 10);
                    collectionControl.highlightArea(areaIndex, true);
                }
            } else if (item.type === 'poly') {
                collectionControl.highlightPolyArea(true);
            } else if (item.type === 'path') {
                // Paths don't have highlighting yet
            }
        }
        
        if (onJumpToPosition && newSelectedId) {
            let position: Position | null = null;
            
            if (item.type === 'area') {
                const centerX = Math.floor((item.bounds.minX + item.bounds.maxX) / 2);
                const centerY = Math.floor((item.bounds.minY + item.bounds.maxY) / 2);
                const plane = 'plane' in item && typeof item.plane === 'number' ? item.plane : 0;
                position = new Position(centerX, centerY, plane);
            } else if ((item.type === 'poly' || item.type === 'path') && item.points.length > 0) {
                let sumX = 0;
                let sumY = 0;
                item.points.forEach(point => {
                    sumX += point.x;
                    sumY += point.y;
                });
                const centerX = Math.floor(sumX / item.points.length);
                const centerY = Math.floor(sumY / item.points.length);
                const plane = 'plane' in item && typeof item.plane === 'number' ? item.plane : 0;
                position = new Position(centerX, centerY, plane);
            }
            
            if (position) {
                onJumpToPosition(position);
            }
        }
    };

    const handleImport = () => {
        setShowImportView(true);
        if (onImportModeChange) {
            onImportModeChange(true);
        }
    };

    const handleBack = () => {
        setShowImportView(false);
        if (onImportModeChange) {
            onImportModeChange(false);
        }
    };

    const handleToolToggle = (tool: 'area' | 'path') => {
        const newTool = selectedTool === tool ? null : tool;
        setSelectedTool(newTool);
        
        if (typeof window !== 'undefined') {
            if (newTool) {
                localStorage.setItem(STORAGE_KEY_SELECTED_TOOL, newTool);
            } else {
                localStorage.removeItem(STORAGE_KEY_SELECTED_TOOL);
            }
        }
        
        if (collectionControl) {
            collectionControl.setToolMode(newTool);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {!showImportView ? (
                <>
                    <div className="mb-3">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToolToggle('area')}
                                className={cn(
                                    "h-7 px-3 text-xs flex items-center gap-1 relative",
                                    selectedTool === 'area' && "bg-gray-700 border-gray-600 shadow-inner"
                                )}
                            >
                                {selectedTool === 'area' && (
                                    <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                                )}
                                <Square className={cn(
                                    "h-3 w-3 relative z-10",
                                    selectedTool === 'area' ? "opacity-100" : "opacity-70"
                                )} />
                                Area
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleToolToggle('path')}
                                className={cn(
                                    "h-7 px-3 text-xs flex items-center gap-1 relative",
                                    selectedTool === 'path' && "bg-gray-700 border-gray-600 shadow-inner"
                                )}
                            >
                                {selectedTool === 'path' && (
                                    <div className="absolute inset-0 bg-green-500/30 rounded-md pointer-events-none" />
                                )}
                                <Route className={cn(
                                    "h-3 w-3 relative z-10",
                                    selectedTool === 'path' ? "opacity-100" : "opacity-70"
                                )} />
                                Path
                            </Button>
                            {selectedTool === 'path' && isLocalhost && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                        >
                                            <Code className="h-3 w-3 mr-1" />
                                            Dev
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (collectionControl) {
                                                    // Test polygon points
                                                    const testPoints = [
                                                        { x: 3064, y: 3520, z: 0 },
                                                        { x: 3094, y: 3520, z: 0 },
                                                        { x: 3105, y: 3511, z: 0 },
                                                        { x: 3106, y: 3507, z: 0 },
                                                        { x: 3099, y: 3502, z: 0 },
                                                        { x: 3090, y: 3500, z: 0 },
                                                        { x: 3084, y: 3500, z: 0 },
                                                        { x: 3080, y: 3502, z: 0 },
                                                        { x: 3075, y: 3504, z: 0 },
                                                        { x: 3073, y: 3505, z: 0 },
                                                        { x: 3071, y: 3510, z: 0 },
                                                        { x: 3073, y: 3513, z: 0 },
                                                        { x: 3068, y: 3511, z: 0 },
                                                        { x: 3064, y: 3512, z: 0 },
                                                        { x: 3063, y: 3514, z: 0 },
                                                        { x: 3061, y: 3516, z: 0 },
                                                        { x: 3058, y: 3519, z: 0 },
                                                        { x: 3062, y: 3520, z: 0 },
                                                        { x: 3064, y: 3520, z: 0 }
                                                    ];
                                                    collectionControl.importPathFromPoints(testPoints);
                                                    toast.success('Test path loaded');
                                                }
                                            }}
                                        >
                                            Test
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => {
                                                if (collectionControl) {
                                                    // Expected tiles from Java getAllContainedCoords()
                                                    const expectedTiles = [
                                                        { x: 3085, y: 3500 }, { x: 3086, y: 3500 }, { x: 3087, y: 3500 }, { x: 3088, y: 3500 }, { x: 3089, y: 3500 },
                                                        { x: 3083, y: 3501 }, { x: 3084, y: 3501 }, { x: 3085, y: 3501 }, { x: 3086, y: 3501 }, { x: 3087, y: 3501 }, { x: 3088, y: 3501 }, { x: 3089, y: 3501 }, { x: 3090, y: 3501 }, { x: 3091, y: 3501 }, { x: 3092, y: 3501 }, { x: 3093, y: 3501 }, { x: 3094, y: 3501 },
                                                        { x: 3081, y: 3502 }, { x: 3082, y: 3502 }, { x: 3083, y: 3502 }, { x: 3084, y: 3502 }, { x: 3085, y: 3502 }, { x: 3086, y: 3502 }, { x: 3087, y: 3502 }, { x: 3088, y: 3502 }, { x: 3089, y: 3502 }, { x: 3090, y: 3502 }, { x: 3091, y: 3502 }, { x: 3092, y: 3502 }, { x: 3093, y: 3502 }, { x: 3094, y: 3502 }, { x: 3095, y: 3502 }, { x: 3096, y: 3502 }, { x: 3097, y: 3502 }, { x: 3098, y: 3502 },
                                                        { x: 3078, y: 3503 }, { x: 3079, y: 3503 }, { x: 3080, y: 3503 }, { x: 3081, y: 3503 }, { x: 3082, y: 3503 }, { x: 3083, y: 3503 }, { x: 3084, y: 3503 }, { x: 3085, y: 3503 }, { x: 3086, y: 3503 }, { x: 3087, y: 3503 }, { x: 3088, y: 3503 }, { x: 3089, y: 3503 }, { x: 3090, y: 3503 }, { x: 3091, y: 3503 }, { x: 3092, y: 3503 }, { x: 3093, y: 3503 }, { x: 3094, y: 3503 }, { x: 3095, y: 3503 }, { x: 3096, y: 3503 }, { x: 3097, y: 3503 }, { x: 3098, y: 3503 }, { x: 3099, y: 3503 }, { x: 3100, y: 3503 },
                                                        { x: 3076, y: 3504 }, { x: 3077, y: 3504 }, { x: 3078, y: 3504 }, { x: 3079, y: 3504 }, { x: 3080, y: 3504 }, { x: 3081, y: 3504 }, { x: 3082, y: 3504 }, { x: 3083, y: 3504 }, { x: 3084, y: 3504 }, { x: 3085, y: 3504 }, { x: 3086, y: 3504 }, { x: 3087, y: 3504 }, { x: 3088, y: 3504 }, { x: 3089, y: 3504 }, { x: 3090, y: 3504 }, { x: 3091, y: 3504 }, { x: 3092, y: 3504 }, { x: 3093, y: 3504 }, { x: 3094, y: 3504 }, { x: 3095, y: 3504 }, { x: 3096, y: 3504 }, { x: 3097, y: 3504 }, { x: 3098, y: 3504 }, { x: 3099, y: 3504 }, { x: 3100, y: 3504 }, { x: 3101, y: 3504 },
                                                        { x: 3074, y: 3505 }, { x: 3075, y: 3505 }, { x: 3076, y: 3505 }, { x: 3077, y: 3505 }, { x: 3078, y: 3505 }, { x: 3079, y: 3505 }, { x: 3080, y: 3505 }, { x: 3081, y: 3505 }, { x: 3082, y: 3505 }, { x: 3083, y: 3505 }, { x: 3084, y: 3505 }, { x: 3085, y: 3505 }, { x: 3086, y: 3505 }, { x: 3087, y: 3505 }, { x: 3088, y: 3505 }, { x: 3089, y: 3505 }, { x: 3090, y: 3505 }, { x: 3091, y: 3505 }, { x: 3092, y: 3505 }, { x: 3093, y: 3505 }, { x: 3094, y: 3505 }, { x: 3095, y: 3505 }, { x: 3096, y: 3505 }, { x: 3097, y: 3505 }, { x: 3098, y: 3505 }, { x: 3099, y: 3505 }, { x: 3100, y: 3505 }, { x: 3101, y: 3505 }, { x: 3102, y: 3505 }, { x: 3103, y: 3505 },
                                                        { x: 3073, y: 3506 }, { x: 3074, y: 3506 }, { x: 3075, y: 3506 }, { x: 3076, y: 3506 }, { x: 3077, y: 3506 }, { x: 3078, y: 3506 }, { x: 3079, y: 3506 }, { x: 3080, y: 3506 }, { x: 3081, y: 3506 }, { x: 3082, y: 3506 }, { x: 3083, y: 3506 }, { x: 3084, y: 3506 }, { x: 3085, y: 3506 }, { x: 3086, y: 3506 }, { x: 3087, y: 3506 }, { x: 3088, y: 3506 }, { x: 3089, y: 3506 }, { x: 3090, y: 3506 }, { x: 3091, y: 3506 }, { x: 3092, y: 3506 }, { x: 3093, y: 3506 }, { x: 3094, y: 3506 }, { x: 3095, y: 3506 }, { x: 3096, y: 3506 }, { x: 3097, y: 3506 }, { x: 3098, y: 3506 }, { x: 3099, y: 3506 }, { x: 3100, y: 3506 }, { x: 3101, y: 3506 }, { x: 3102, y: 3506 }, { x: 3103, y: 3506 }, { x: 3104, y: 3506 },
                                                        { x: 3073, y: 3507 }, { x: 3074, y: 3507 }, { x: 3075, y: 3507 }, { x: 3076, y: 3507 }, { x: 3077, y: 3507 }, { x: 3078, y: 3507 }, { x: 3079, y: 3507 }, { x: 3080, y: 3507 }, { x: 3081, y: 3507 }, { x: 3082, y: 3507 }, { x: 3083, y: 3507 }, { x: 3084, y: 3507 }, { x: 3085, y: 3507 }, { x: 3086, y: 3507 }, { x: 3087, y: 3507 }, { x: 3088, y: 3507 }, { x: 3089, y: 3507 }, { x: 3090, y: 3507 }, { x: 3091, y: 3507 }, { x: 3092, y: 3507 }, { x: 3093, y: 3507 }, { x: 3094, y: 3507 }, { x: 3095, y: 3507 }, { x: 3096, y: 3507 }, { x: 3097, y: 3507 }, { x: 3098, y: 3507 }, { x: 3099, y: 3507 }, { x: 3100, y: 3507 }, { x: 3101, y: 3507 }, { x: 3102, y: 3507 }, { x: 3103, y: 3507 }, { x: 3104, y: 3507 }, { x: 3105, y: 3507 },
                                                        { x: 3072, y: 3508 }, { x: 3073, y: 3508 }, { x: 3074, y: 3508 }, { x: 3075, y: 3508 }, { x: 3076, y: 3508 }, { x: 3077, y: 3508 }, { x: 3078, y: 3508 }, { x: 3079, y: 3508 }, { x: 3080, y: 3508 }, { x: 3081, y: 3508 }, { x: 3082, y: 3508 }, { x: 3083, y: 3508 }, { x: 3084, y: 3508 }, { x: 3085, y: 3508 }, { x: 3086, y: 3508 }, { x: 3087, y: 3508 }, { x: 3088, y: 3508 }, { x: 3089, y: 3508 }, { x: 3090, y: 3508 }, { x: 3091, y: 3508 }, { x: 3092, y: 3508 }, { x: 3093, y: 3508 }, { x: 3094, y: 3508 }, { x: 3095, y: 3508 }, { x: 3096, y: 3508 }, { x: 3097, y: 3508 }, { x: 3098, y: 3508 }, { x: 3099, y: 3508 }, { x: 3100, y: 3508 }, { x: 3101, y: 3508 }, { x: 3102, y: 3508 }, { x: 3103, y: 3508 }, { x: 3104, y: 3508 }, { x: 3105, y: 3508 },
                                                        { x: 3072, y: 3509 }, { x: 3073, y: 3509 }, { x: 3074, y: 3509 }, { x: 3075, y: 3509 }, { x: 3076, y: 3509 }, { x: 3077, y: 3509 }, { x: 3078, y: 3509 }, { x: 3079, y: 3509 }, { x: 3080, y: 3509 }, { x: 3081, y: 3509 }, { x: 3082, y: 3509 }, { x: 3083, y: 3509 }, { x: 3084, y: 3509 }, { x: 3085, y: 3509 }, { x: 3086, y: 3509 }, { x: 3087, y: 3509 }, { x: 3088, y: 3509 }, { x: 3089, y: 3509 }, { x: 3090, y: 3509 }, { x: 3091, y: 3509 }, { x: 3092, y: 3509 }, { x: 3093, y: 3509 }, { x: 3094, y: 3509 }, { x: 3095, y: 3509 }, { x: 3096, y: 3509 }, { x: 3097, y: 3509 }, { x: 3098, y: 3509 }, { x: 3099, y: 3509 }, { x: 3100, y: 3509 }, { x: 3101, y: 3509 }, { x: 3102, y: 3509 }, { x: 3103, y: 3509 }, { x: 3104, y: 3509 }, { x: 3105, y: 3509 },
                                                        { x: 3072, y: 3510 }, { x: 3073, y: 3510 }, { x: 3074, y: 3510 }, { x: 3075, y: 3510 }, { x: 3076, y: 3510 }, { x: 3077, y: 3510 }, { x: 3078, y: 3510 }, { x: 3079, y: 3510 }, { x: 3080, y: 3510 }, { x: 3081, y: 3510 }, { x: 3082, y: 3510 }, { x: 3083, y: 3510 }, { x: 3084, y: 3510 }, { x: 3085, y: 3510 }, { x: 3086, y: 3510 }, { x: 3087, y: 3510 }, { x: 3088, y: 3510 }, { x: 3089, y: 3510 }, { x: 3090, y: 3510 }, { x: 3091, y: 3510 }, { x: 3092, y: 3510 }, { x: 3093, y: 3510 }, { x: 3094, y: 3510 }, { x: 3095, y: 3510 }, { x: 3096, y: 3510 }, { x: 3097, y: 3510 }, { x: 3098, y: 3510 }, { x: 3099, y: 3510 }, { x: 3100, y: 3510 }, { x: 3101, y: 3510 }, { x: 3102, y: 3510 }, { x: 3103, y: 3510 }, { x: 3104, y: 3510 }, { x: 3105, y: 3510 },
                                                        { x: 3068, y: 3511 }, { x: 3072, y: 3511 }, { x: 3073, y: 3511 }, { x: 3074, y: 3511 }, { x: 3075, y: 3511 }, { x: 3076, y: 3511 }, { x: 3077, y: 3511 }, { x: 3078, y: 3511 }, { x: 3079, y: 3511 }, { x: 3080, y: 3511 }, { x: 3081, y: 3511 }, { x: 3082, y: 3511 }, { x: 3083, y: 3511 }, { x: 3084, y: 3511 }, { x: 3085, y: 3511 }, { x: 3086, y: 3511 }, { x: 3087, y: 3511 }, { x: 3088, y: 3511 }, { x: 3089, y: 3511 }, { x: 3090, y: 3511 }, { x: 3091, y: 3511 }, { x: 3092, y: 3511 }, { x: 3093, y: 3511 }, { x: 3094, y: 3511 }, { x: 3095, y: 3511 }, { x: 3096, y: 3511 }, { x: 3097, y: 3511 }, { x: 3098, y: 3511 }, { x: 3099, y: 3511 }, { x: 3100, y: 3511 }, { x: 3101, y: 3511 }, { x: 3102, y: 3511 }, { x: 3103, y: 3511 }, { x: 3104, y: 3511 },
                                                        { x: 3065, y: 3512 }, { x: 3066, y: 3512 }, { x: 3067, y: 3512 }, { x: 3068, y: 3512 }, { x: 3069, y: 3512 }, { x: 3070, y: 3512 }, { x: 3073, y: 3512 }, { x: 3074, y: 3512 }, { x: 3075, y: 3512 }, { x: 3076, y: 3512 }, { x: 3077, y: 3512 }, { x: 3078, y: 3512 }, { x: 3079, y: 3512 }, { x: 3080, y: 3512 }, { x: 3081, y: 3512 }, { x: 3082, y: 3512 }, { x: 3083, y: 3512 }, { x: 3084, y: 3512 }, { x: 3085, y: 3512 }, { x: 3086, y: 3512 }, { x: 3087, y: 3512 }, { x: 3088, y: 3512 }, { x: 3089, y: 3512 }, { x: 3090, y: 3512 }, { x: 3091, y: 3512 }, { x: 3092, y: 3512 }, { x: 3093, y: 3512 }, { x: 3094, y: 3512 }, { x: 3095, y: 3512 }, { x: 3096, y: 3512 }, { x: 3097, y: 3512 }, { x: 3098, y: 3512 }, { x: 3099, y: 3512 }, { x: 3100, y: 3512 }, { x: 3101, y: 3512 }, { x: 3102, y: 3512 }, { x: 3103, y: 3512 },
                                                        { x: 3064, y: 3513 }, { x: 3065, y: 3513 }, { x: 3066, y: 3513 }, { x: 3067, y: 3513 }, { x: 3068, y: 3513 }, { x: 3069, y: 3513 }, { x: 3070, y: 3513 }, { x: 3071, y: 3513 }, { x: 3072, y: 3513 }, { x: 3073, y: 3513 }, { x: 3074, y: 3513 }, { x: 3075, y: 3513 }, { x: 3076, y: 3513 }, { x: 3077, y: 3513 }, { x: 3078, y: 3513 }, { x: 3079, y: 3513 }, { x: 3080, y: 3513 }, { x: 3081, y: 3513 }, { x: 3082, y: 3513 }, { x: 3083, y: 3513 }, { x: 3084, y: 3513 }, { x: 3085, y: 3513 }, { x: 3086, y: 3513 }, { x: 3087, y: 3513 }, { x: 3088, y: 3513 }, { x: 3089, y: 3513 }, { x: 3090, y: 3513 }, { x: 3091, y: 3513 }, { x: 3092, y: 3513 }, { x: 3093, y: 3513 }, { x: 3094, y: 3513 }, { x: 3095, y: 3513 }, { x: 3096, y: 3513 }, { x: 3097, y: 3513 }, { x: 3098, y: 3513 }, { x: 3099, y: 3513 }, { x: 3100, y: 3513 }, { x: 3101, y: 3513 }, { x: 3102, y: 3513 },
                                                        { x: 3064, y: 3514 }, { x: 3065, y: 3514 }, { x: 3066, y: 3514 }, { x: 3067, y: 3514 }, { x: 3068, y: 3514 }, { x: 3069, y: 3514 }, { x: 3070, y: 3514 }, { x: 3071, y: 3514 }, { x: 3072, y: 3514 }, { x: 3073, y: 3514 }, { x: 3074, y: 3514 }, { x: 3075, y: 3514 }, { x: 3076, y: 3514 }, { x: 3077, y: 3514 }, { x: 3078, y: 3514 }, { x: 3079, y: 3514 }, { x: 3080, y: 3514 }, { x: 3081, y: 3514 }, { x: 3082, y: 3514 }, { x: 3083, y: 3514 }, { x: 3084, y: 3514 }, { x: 3085, y: 3514 }, { x: 3086, y: 3514 }, { x: 3087, y: 3514 }, { x: 3088, y: 3514 }, { x: 3089, y: 3514 }, { x: 3090, y: 3514 }, { x: 3091, y: 3514 }, { x: 3092, y: 3514 }, { x: 3093, y: 3514 }, { x: 3094, y: 3514 }, { x: 3095, y: 3514 }, { x: 3096, y: 3514 }, { x: 3097, y: 3514 }, { x: 3098, y: 3514 }, { x: 3099, y: 3514 }, { x: 3100, y: 3514 }, { x: 3101, y: 3514 },
                                                        { x: 3063, y: 3515 }, { x: 3064, y: 3515 }, { x: 3065, y: 3515 }, { x: 3066, y: 3515 }, { x: 3067, y: 3515 }, { x: 3068, y: 3515 }, { x: 3069, y: 3515 }, { x: 3070, y: 3515 }, { x: 3071, y: 3515 }, { x: 3072, y: 3515 }, { x: 3073, y: 3515 }, { x: 3074, y: 3515 }, { x: 3075, y: 3515 }, { x: 3076, y: 3515 }, { x: 3077, y: 3515 }, { x: 3078, y: 3515 }, { x: 3079, y: 3515 }, { x: 3080, y: 3515 }, { x: 3081, y: 3515 }, { x: 3082, y: 3515 }, { x: 3083, y: 3515 }, { x: 3084, y: 3515 }, { x: 3085, y: 3515 }, { x: 3086, y: 3515 }, { x: 3087, y: 3515 }, { x: 3088, y: 3515 }, { x: 3089, y: 3515 }, { x: 3090, y: 3515 }, { x: 3091, y: 3515 }, { x: 3092, y: 3515 }, { x: 3093, y: 3515 }, { x: 3094, y: 3515 }, { x: 3095, y: 3515 }, { x: 3096, y: 3515 }, { x: 3097, y: 3515 }, { x: 3098, y: 3515 }, { x: 3099, y: 3515 }, { x: 3100, y: 3515 },
                                                        { x: 3062, y: 3516 }, { x: 3063, y: 3516 }, { x: 3064, y: 3516 }, { x: 3065, y: 3516 }, { x: 3066, y: 3516 }, { x: 3067, y: 3516 }, { x: 3068, y: 3516 }, { x: 3069, y: 3516 }, { x: 3070, y: 3516 }, { x: 3071, y: 3516 }, { x: 3072, y: 3516 }, { x: 3073, y: 3516 }, { x: 3074, y: 3516 }, { x: 3075, y: 3516 }, { x: 3076, y: 3516 }, { x: 3077, y: 3516 }, { x: 3078, y: 3516 }, { x: 3079, y: 3516 }, { x: 3080, y: 3516 }, { x: 3081, y: 3516 }, { x: 3082, y: 3516 }, { x: 3083, y: 3516 }, { x: 3084, y: 3516 }, { x: 3085, y: 3516 }, { x: 3086, y: 3516 }, { x: 3087, y: 3516 }, { x: 3088, y: 3516 }, { x: 3089, y: 3516 }, { x: 3090, y: 3516 }, { x: 3091, y: 3516 }, { x: 3092, y: 3516 }, { x: 3093, y: 3516 }, { x: 3094, y: 3516 }, { x: 3095, y: 3516 }, { x: 3096, y: 3516 }, { x: 3097, y: 3516 }, { x: 3098, y: 3516 },
                                                        { x: 3061, y: 3517 }, { x: 3062, y: 3517 }, { x: 3063, y: 3517 }, { x: 3064, y: 3517 }, { x: 3065, y: 3517 }, { x: 3066, y: 3517 }, { x: 3067, y: 3517 }, { x: 3068, y: 3517 }, { x: 3069, y: 3517 }, { x: 3070, y: 3517 }, { x: 3071, y: 3517 }, { x: 3072, y: 3517 }, { x: 3073, y: 3517 }, { x: 3074, y: 3517 }, { x: 3075, y: 3517 }, { x: 3076, y: 3517 }, { x: 3077, y: 3517 }, { x: 3078, y: 3517 }, { x: 3079, y: 3517 }, { x: 3080, y: 3517 }, { x: 3081, y: 3517 }, { x: 3082, y: 3517 }, { x: 3083, y: 3517 }, { x: 3084, y: 3517 }, { x: 3085, y: 3517 }, { x: 3086, y: 3517 }, { x: 3087, y: 3517 }, { x: 3088, y: 3517 }, { x: 3089, y: 3517 }, { x: 3090, y: 3517 }, { x: 3091, y: 3517 }, { x: 3092, y: 3517 }, { x: 3093, y: 3517 }, { x: 3094, y: 3517 }, { x: 3095, y: 3517 }, { x: 3096, y: 3517 }, { x: 3097, y: 3517 },
                                                        { x: 3060, y: 3518 }, { x: 3061, y: 3518 }, { x: 3062, y: 3518 }, { x: 3063, y: 3518 }, { x: 3064, y: 3518 }, { x: 3065, y: 3518 }, { x: 3066, y: 3518 }, { x: 3067, y: 3518 }, { x: 3068, y: 3518 }, { x: 3069, y: 3518 }, { x: 3070, y: 3518 }, { x: 3071, y: 3518 }, { x: 3072, y: 3518 }, { x: 3073, y: 3518 }, { x: 3074, y: 3518 }, { x: 3075, y: 3518 }, { x: 3076, y: 3518 }, { x: 3077, y: 3518 }, { x: 3078, y: 3518 }, { x: 3079, y: 3518 }, { x: 3080, y: 3518 }, { x: 3081, y: 3518 }, { x: 3082, y: 3518 }, { x: 3083, y: 3518 }, { x: 3084, y: 3518 }, { x: 3085, y: 3518 }, { x: 3086, y: 3518 }, { x: 3087, y: 3518 }, { x: 3088, y: 3518 }, { x: 3089, y: 3518 }, { x: 3090, y: 3518 }, { x: 3091, y: 3518 }, { x: 3092, y: 3518 }, { x: 3093, y: 3518 }, { x: 3094, y: 3518 }, { x: 3095, y: 3518 }, { x: 3096, y: 3518 },
                                                        { x: 3059, y: 3519 }, { x: 3060, y: 3519 }, { x: 3061, y: 3519 }, { x: 3062, y: 3519 }, { x: 3063, y: 3519 }, { x: 3064, y: 3519 }, { x: 3065, y: 3519 }, { x: 3066, y: 3519 }, { x: 3067, y: 3519 }, { x: 3068, y: 3519 }, { x: 3069, y: 3519 }, { x: 3070, y: 3519 }, { x: 3071, y: 3519 }, { x: 3072, y: 3519 }, { x: 3073, y: 3519 }, { x: 3074, y: 3519 }, { x: 3075, y: 3519 }, { x: 3076, y: 3519 }, { x: 3077, y: 3519 }, { x: 3078, y: 3519 }, { x: 3079, y: 3519 }, { x: 3080, y: 3519 }, { x: 3081, y: 3519 }, { x: 3082, y: 3519 }, { x: 3083, y: 3519 }, { x: 3084, y: 3519 }, { x: 3085, y: 3519 }, { x: 3086, y: 3519 }, { x: 3087, y: 3519 }, { x: 3088, y: 3519 }, { x: 3089, y: 3519 }, { x: 3090, y: 3519 }, { x: 3091, y: 3519 }, { x: 3092, y: 3519 }, { x: 3093, y: 3519 }, { x: 3094, y: 3519 }, { x: 3095, y: 3519 }
                                                    ];
                                                    collectionControl.highlightPathVerificationTiles(expectedTiles);
                                                    toast.success('Verification tiles highlighted in red');
                                                }
                                            }}
                                        >
                                            Verify
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                        <AreaItemList
                            items={itemsWithNames}
                            selectedItemId={selectedItemId}
                            hiddenItems={hiddenItems}
                            onItemClick={handleItemClick}
                            onRemove={handleRemove}
                            onToggleHide={handleToggleHide}
                            onExport={handleExport}
                            onRename={handleRename}
                            onSimplify={(item) => {
                                if (collectionControl && item.type === 'path') {
                                    const beforeCount = collectionControl.getPath().length;
                                    collectionControl.simplifyPath();
                                    const afterCount = collectionControl.getPath().length;
                                    if (beforeCount > afterCount) {
                                        toast.success(`Simplified path: ${beforeCount} → ${afterCount} points`);
                                    } else {
                                        toast.info('No simplification possible');
                                    }
                                }
                            }}
                            itemNames={itemNames}
                        />
                    </ScrollArea>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleImport}
                            className="h-7 px-3 text-xs flex items-center gap-1 flex-1"
                        >
                            <Upload className="h-3 w-3" />
                            Import
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={items.length === 0}
                                    className="h-7 px-3 text-xs flex items-center gap-1 flex-1"
                                >
                                    <Download className="h-3 w-3" />
                                    Export All
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExportAll('json')}>
                                    JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportAll('java')}>
                                    Java
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportAll('array')}>
                                    Array
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportAll('raw')}>
                                    Raw
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={items.length === 0}
                            className="h-7 px-3 text-xs flex items-center gap-1 flex-1"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </Button>
                    </div>
                </>
            ) : (
                <ImportView
                    importFormat={importFormat}
                    collectionControl={collectionControl}
                    onBack={handleBack}
                    onImportModeChange={onImportModeChange}
                />
            )}
        </div>
    );
}

// Re-export types for backward compatibility
export type { ToolType, Area, Poly, SelectionItem } from './AreaSelection/types';
export type { AreaSelectionProps } from './AreaSelection/types';
