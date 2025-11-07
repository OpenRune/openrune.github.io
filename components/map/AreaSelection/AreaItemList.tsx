"use client";

import { useState } from 'react';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Square, Trash2, Eye, EyeOff, Download, Pencil } from 'lucide-react';
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
    onRename: (itemId: string, name: string) => void;
    itemNames: Map<string, string>;
}

export function AreaItemList({
    items,
    selectedItemId,
    hiddenItems,
    onItemClick,
    onRemove,
    onToggleHide,
    onExport,
    onRename,
    itemNames
}: AreaItemListProps) {
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [renameItem, setRenameItem] = useState<SelectionItem | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const handleRenameClick = (item: SelectionItem, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setRenameItem(item);
        setRenameValue(itemNames.get(item.id) || '');
        setRenameDialogOpen(true);
    };

    const handleRenameSubmit = () => {
        if (renameItem) {
            const trimmedName = renameValue.trim();
            onRename(renameItem.id, trimmedName || '');
            setRenameDialogOpen(false);
            setRenameItem(null);
            setRenameValue('');
        }
    };

    const handleRenameCancel = () => {
        setRenameDialogOpen(false);
        setRenameItem(null);
        setRenameValue('');
    };

    const getDisplayText = (item: SelectionItem): string => {
        const defaultText = item.type === 'area' ? formatArea(item) : formatPoly(item);
        const customName = itemNames.get(item.id);
        if (customName) {
            return `${customName} - ${defaultText}`;
        }
        return defaultText;
    };

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
                                        <div className="text-xs break-words">
                                            {item.type === 'area' ? (
                                                <>
                                                    {itemNames.get(item.id) && (
                                                        <span className="font-sans">{itemNames.get(item.id)} - </span>
                                                    )}
                                                    <span className="font-mono">{formatArea(item)}</span>
                                                </>
                                            ) : (
                                                <>
                                                    {itemNames.get(item.id) && (
                                                        <span>{itemNames.get(item.id)} - </span>
                                                    )}
                                                    <span>{formatPoly(item)}</span>
                                                </>
                                            )}
                                        </div>
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
                            <ContextMenuItem 
                                onClick={(e) => handleRenameClick(item, e)}
                            >
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
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
            
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename {renameItem?.type === 'area' ? 'Area' : 'Polygon'}</DialogTitle>
                        <DialogDescription>
                            Enter a custom name for this {renameItem?.type === 'area' ? 'area' : 'polygon'}. This name is only saved for this session.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            placeholder={
                                renameItem 
                                    ? (renameItem.type === 'area' 
                                        ? formatArea(renameItem) 
                                        : formatPoly(renameItem))
                                    : 'Enter name...'
                            }
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameSubmit();
                                } else if (e.key === 'Escape') {
                                    handleRenameCancel();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleRenameCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleRenameSubmit}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

