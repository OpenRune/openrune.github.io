"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { GamevalType, GamevalData } from './types';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';

interface GamevalContextType {
    lookupGameval: (type: GamevalType, id: number) => string | undefined;
    lookupGamevalByName: (type: GamevalType, name: string) => number | undefined;
    getGamevalData: (type: GamevalType) => GamevalData | undefined;
    getGamevalEntries: (type: GamevalType) => GamevalEntry[] | undefined;
    loadGamevalType: (type: GamevalType) => Promise<void>;
    isLoading: (type: GamevalType) => boolean;
    hasLoaded: (type: GamevalType) => boolean;
}

export interface GamevalEntry {
    name: string;
    id: number;
    lowerName: string;
}

const GamevalContext = createContext<GamevalContextType | undefined>(undefined);

// Track loading promises to prevent duplicate requests
const loadingPromises = new Map<GamevalType, Promise<GamevalData>>();

export function GamevalProvider({ children }: { children: React.ReactNode }) {
    // Store gameval data: type -> { name: id }
    const [gamevalData, setGamevalData] = useState<Map<GamevalType, GamevalData>>(new Map());
    // Store reverse lookup: type -> { id: name } for faster ID -> name lookups
    const [gamevalReverseData, setGamevalReverseData] = useState<Map<GamevalType, Record<number, string>>>(new Map());
    // Store precomputed entry arrays for suggestion filtering
    const [gamevalEntries, setGamevalEntries] = useState<Map<GamevalType, GamevalEntry[]>>(new Map());
    // Track which types are currently loading
    const [loadingTypes, setLoadingTypes] = useState<Set<GamevalType>>(new Set());
    // Track which types have been loaded (even if empty)
    const [loadedTypes, setLoadedTypes] = useState<Set<GamevalType>>(new Set());

    // Load a specific gameval type from the API
    const loadGamevalType = useCallback(async (type: GamevalType): Promise<void> => {
        // If already loaded, return immediately
        if (loadedTypes.has(type)) {
            return;
        }

        // If already loading, wait for the existing promise
        const existingPromise = loadingPromises.get(type);
        if (existingPromise) {
            await existingPromise;
            return;
        }

        // Mark as loading
        setLoadingTypes(prev => new Set(prev).add(type));

        // Create fetch promise
        const fetchPromise = (async () => {
            try {
                const response = await fetchFromBuildUrl('gamevals', { type: type.toUpperCase() });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch gamevals for type ${type}: ${response.statusText}`);
                }

                const data: GamevalData = await response.json();
                
                // Create reverse lookup map (id -> name) for faster lookups
                const reverseData: Record<number, string> = {};
                for (const [name, id] of Object.entries(data)) {
                    reverseData[id] = name;
                }
                
                // Store the data
                setGamevalData(prev => {
                    const next = new Map(prev);
                    next.set(type, data);
                    return next;
                });
                
                // Store reverse lookup
                setGamevalReverseData(prev => {
                    const next = new Map(prev);
                    next.set(type, reverseData);
                    return next;
                });

                // Store entries array for faster searches
                setGamevalEntries(prev => {
                    const next = new Map(prev);
                    const entries: GamevalEntry[] = Object.entries(data).map(([name, id]) => ({
                        name,
                        id,
                        lowerName: name.toLowerCase(),
                    }));
                    next.set(type, entries);
                    return next;
                });
                
                // Mark as loaded
                setLoadedTypes(prev => new Set(prev).add(type));
                
                return data;
            } catch (error) {
                console.error(`Error loading gameval type ${type}:`, error);
                // Still mark as loaded (even if empty) to prevent infinite retries
                setLoadedTypes(prev => new Set(prev).add(type));
                // Store empty data
                setGamevalData(prev => {
                    const next = new Map(prev);
                    next.set(type, {});
                    return next;
                });
                setGamevalReverseData(prev => {
                    const next = new Map(prev);
                    next.set(type, {});
                    return next;
                });
                setGamevalEntries(prev => {
                    const next = new Map(prev);
                    next.set(type, []);
                    return next;
                });
                return {};
            } finally {
                // Remove from loading set
                setLoadingTypes(prev => {
                    const next = new Set(prev);
                    next.delete(type);
                    return next;
                });
                // Remove from loading promises
                loadingPromises.delete(type);
            }
        })();

        // Store the promise
        loadingPromises.set(type, fetchPromise);
        
        // Wait for it to complete
        await fetchPromise;
    }, [loadedTypes]);

    // Lookup gameval name by ID
    const lookupGameval = useCallback((type: GamevalType, id: number): string | undefined => {
        const reverseData = gamevalReverseData.get(type);
        if (!reverseData) {
            // Auto-load if not loaded yet
            loadGamevalType(type).catch(console.error);
            return undefined;
        }

        return reverseData[id];
    }, [gamevalReverseData, loadGamevalType]);

    // Lookup gameval ID by name
    const lookupGamevalByName = useCallback((type: GamevalType, name: string): number | undefined => {
        const data = gamevalData.get(type);
        if (!data) {
            // Auto-load if not loaded yet
            loadGamevalType(type).catch(console.error);
            return undefined;
        }

        return data[name];
    }, [gamevalData, loadGamevalType]);

    // Get all gameval data for a type
    const getGamevalData = useCallback((type: GamevalType): GamevalData | undefined => {
        const data = gamevalData.get(type);
        if (!data && !loadedTypes.has(type)) {
            // Auto-load if not loaded yet
            loadGamevalType(type).catch(console.error);
        }
        return data;
    }, [gamevalData, loadedTypes, loadGamevalType]);

    // Get precomputed entries for a type
    const getGamevalEntries = useCallback((type: GamevalType): GamevalEntry[] | undefined => {
        const entries = gamevalEntries.get(type);
        if (!entries && !loadedTypes.has(type)) {
            loadGamevalType(type).catch(console.error);
        }
        return entries;
    }, [gamevalEntries, loadedTypes, loadGamevalType]);

    // Check if a type is currently loading
    const isLoading = useCallback((type: GamevalType): boolean => {
        return loadingTypes.has(type);
    }, [loadingTypes]);

    // Check if a type has been loaded
    const hasLoaded = useCallback((type: GamevalType): boolean => {
        return loadedTypes.has(type);
    }, [loadedTypes]);

    const value: GamevalContextType = {
        lookupGameval,
        lookupGamevalByName,
        getGamevalData,
        getGamevalEntries,
        loadGamevalType,
        isLoading,
        hasLoaded,
    };

    return (
        <GamevalContext.Provider value={value}>
            {children}
        </GamevalContext.Provider>
    );
}

export function useGamevals(): GamevalContextType {
    const context = useContext(GamevalContext);
    if (context === undefined) {
        throw new Error('useGamevals must be used within a GamevalProvider');
    }
    return context;
}

