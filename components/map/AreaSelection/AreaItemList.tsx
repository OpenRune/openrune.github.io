"use client";

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger
} from '@/components/ui/context-menu';
import { Square, Trash2, Eye, EyeOff, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectionItem, ExportFormat } from './types';
import { formatArea, formatPoly } from './utils';

interface AreaItemListProps {
    items: SelectionItem[];
    selectedItemId: string | null;
    hiddenItems: Set<string>;
    onItemClick: (item: SelectionItem) => void;
    onRemove: (item: SelectionItem, e?: React.MouseEvent) => void;
    onToggleHide: (item: SelectionItem, e?: React.MouseEvent) => void;
    onExport: (item: SelectionItem, format: ExportFormat, e?: React.MouseEvent) => void;
}

export function AreaItemList({
    items,
    selectedItemId,
    hiddenItems,
    onItemClick,
    onRemove,
    onToggleHide,
    onExport
}: AreaItemListProps) {
    if (items.length === 0) {
        return (
            <div className="text-center text-sm text-muted-foreground py-8">
                No areas or polygons selected
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {items.map((item) => {
                const isHidden = hiddenItems.has(item.id);
                return (
                    <ContextMenu key={item.id}>
                        <ContextMenuTrigger asChild>
                            <button
                                onClick={() => onItemClick(item)}
                                className={cn(
                                    "w-full px-3 py-2 text-left text-sm rounded-md",
                                    "focus:outline-none transition-colors",
                                    "border",
                                    selectedItemId === item.id
                                        ? "bg-primary/20 border-primary text-primary-foreground"
                                        : "hover:bg-accent focus:bg-accent border-transparent hover:border-border",
                                    isHidden && "opacity-50"
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    <Square className={cn(
                                        "h-3 w-3 flex-shrink-0 mt-0.5",
                                        selectedItemId === item.id ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        {item.type === 'area' ? (
                                            <div className="font-mono text-xs break-words">
                                                {formatArea(item)}
                                            </div>
                                        ) : (
                                            <div className="text-xs break-words">
                                                {formatPoly(item)}
                                            </div>
                                        )}
                                    </div>
                                    {isHidden && (
                                        <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    )}
                                </div>
                            </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem 
                                onClick={(e) => onRemove(item, e)}
                                variant="destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                            </ContextMenuItem>
                            <ContextMenuItem 
                                onClick={(e) => onToggleHide(item, e)}
                            >
                                {isHidden ? (
                                    <>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Show
                                    </>
                                ) : (
                                    <>
                                        <EyeOff className="h-4 w-4 mr-2" />
                                        Hide
                                    </>
                                )}
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                    <Download className="h-4 w-4 mr-2" />
                                    Export
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent>
                                    <ContextMenuItem onClick={(e) => onExport(item, 'json', e)}>
                                        JSON
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={(e) => onExport(item, 'java', e)}>
                                        Java
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={(e) => onExport(item, 'array', e)}>
                                        Array
                                    </ContextMenuItem>
                                    <ContextMenuItem onClick={(e) => onExport(item, 'raw', e)}>
                                        Raw
                                    </ContextMenuItem>
                                </ContextMenuSubContent>
                            </ContextMenuSub>
                        </ContextMenuContent>
                    </ContextMenu>
                );
            })}
        </div>
    );
}

