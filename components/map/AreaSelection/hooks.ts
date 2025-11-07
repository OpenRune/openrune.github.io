import { useState, useEffect } from 'react';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';
import { SelectionItem, ToolType } from './types';
import { areaModelToSelectionItem, positionsToSelectionItem } from './utils';
import { STORAGE_KEY_SELECTED_TOOL } from './constants';

export function useCollectionControl(collectionControl: CollectionControl | null | undefined) {
    const [items, setItems] = useState<SelectionItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
    const [selectedTool, setSelectedTool] = useState<ToolType>(() => {
        if (typeof window === 'undefined') return 'area';
        const saved = localStorage.getItem(STORAGE_KEY_SELECTED_TOOL);
        if (saved === 'area' || saved === 'poly') return saved;
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
        const toolToUse = (savedTool === 'area' || savedTool === 'poly') 
            ? savedTool 
            : (currentCollectionTool || selectedTool || 'area');
        setSelectedTool(toolToUse);
        if (toolToUse !== currentCollectionTool) {
            collectionControl.setToolMode(toolToUse);
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

