import { useState, useEffect } from 'react';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';
import { SelectionItem, ToolType } from './types';
import { areaModelToSelectionItem, positionsToSelectionItem, positionsToPathItem } from './utils';
import { STORAGE_KEY_SELECTED_TOOL } from './constants';

export function useCollectionControl(collectionControl: CollectionControl | null | undefined) {
    const [items, setItems] = useState<SelectionItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
    const [selectedTool, setSelectedTool] = useState<ToolType>(() => {
        if (typeof window === 'undefined') return 'area';
        const saved = localStorage.getItem(STORAGE_KEY_SELECTED_TOOL);
        if (saved === 'area' || saved === 'poly' || saved === 'path') return saved;
        return 'area';
    });

    useEffect(() => {
        if (!collectionControl) {
            setItems([]);
            return;
        }

        const updateItemsFromCollectionControl = () => {
            const newItems: SelectionItem[] = [];
            const newHiddenItems = new Set<string>();
            
            const areas = collectionControl.getAreas();
            areas.forEach((area, index) => {
                const item = areaModelToSelectionItem(area, index);
                newItems.push(item);
                if (!collectionControl.isAreaVisible(index)) {
                    newHiddenItems.add(item.id);
                }
            });

            const polyPositions = collectionControl.getPolyArea();
            if (polyPositions.length > 0) {
                const polyItem = positionsToSelectionItem(polyPositions, 0);
                newItems.push(polyItem);
                if (!collectionControl.isPolyAreaVisible()) {
                    newHiddenItems.add(polyItem.id);
                }
            }

            const pathPositions = collectionControl.getPath();
            if (pathPositions.length > 0) {
                const pathItem = positionsToPathItem(pathPositions, 0);
                newItems.push(pathItem);
            }

            setItems(newItems);
            setHiddenItems(newHiddenItems);
            
            setSelectedItemId(prev => {
                if (prev && !newItems.find(item => item.id === prev)) {
                    if (collectionControl) {
                        collectionControl.clearHighlights();
                    }
                    return null;
                }
                return prev;
            });
        };

        updateItemsFromCollectionControl();

        const savedTool = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SELECTED_TOOL) : null;
        const currentCollectionTool = collectionControl.getCurrentTool();
        // Default to 'area' if no tool is set
        let toolToUse: ToolType = 'area';
        if (savedTool === 'area' || savedTool === 'poly' || savedTool === 'path') {
            toolToUse = savedTool;
        } else if (currentCollectionTool) {
            toolToUse = currentCollectionTool;
        }
        // If no saved tool and no current tool, default to 'area' (already set above)
        
        setSelectedTool(toolToUse);
        if (toolToUse !== currentCollectionTool) {
            collectionControl.setToolMode(toolToUse);
        }
        
        // Save default 'area' to localStorage if nothing was saved
        if (typeof window !== 'undefined' && !savedTool && toolToUse === 'area') {
            localStorage.setItem(STORAGE_KEY_SELECTED_TOOL, 'area');
        }

        const pollInterval = setInterval(() => {
            updateItemsFromCollectionControl();
            const savedTool = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SELECTED_TOOL) : null;
            if (!savedTool) {
                setSelectedTool(prev => {
                    const currentTool = collectionControl.getCurrentTool();
                    return currentTool !== prev ? currentTool : prev;
                });
            }
        }, 300);

        return () => clearInterval(pollInterval);
    }, [collectionControl]);

    return {
        items,
        selectedItemId,
        hiddenItems,
        selectedTool,
        setSelectedItemId,
        setHiddenItems,
        setSelectedTool
    };
}

