"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Square, X, Download } from 'lucide-react';
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

    const {
        items,
        selectedItemId,
        hiddenItems,
        selectedTool,
        setSelectedItemId,
        setHiddenItems,
        setSelectedTool
    } = useCollectionControl(collectionControl);

    useEffect(() => {
        setShowImportView(importMode);
    }, [importMode]);

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
            }
        }
        
        if (onJumpToPosition && newSelectedId) {
            let position: Position | null = null;
            
            if (item.type === 'area') {
                const centerX = Math.floor((item.bounds.minX + item.bounds.maxX) / 2);
                const centerY = Math.floor((item.bounds.minY + item.bounds.maxY) / 2);
                const plane = 'plane' in item && typeof item.plane === 'number' ? item.plane : 0;
                position = new Position(centerX, centerY, plane);
            } else if (item.type === 'poly' && item.points.length > 0) {
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

    const handleToolToggle = () => {
        const newTool = selectedTool === 'area' ? null : 'area';
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
                                onClick={handleToolToggle}
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
                        </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                        <AreaItemList
                            items={items}
                            selectedItemId={selectedItemId}
                            hiddenItems={hiddenItems}
                            onItemClick={handleItemClick}
                            onRemove={handleRemove}
                            onToggleHide={handleToggleHide}
                            onExport={handleExport}
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
