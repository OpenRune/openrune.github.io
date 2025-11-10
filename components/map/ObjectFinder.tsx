"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Position } from '@/lib/map/model/Position';
import { toast } from 'sonner';
import { useGamevals, OBJTYPES } from '@/lib/gamevals';
import { GamevalIdSearch, GamevalSuggestion } from '@/components/search/GamevalIdSearch';

export interface ObjectPosition {
    x: number;
    y: number;
    z: number;
    objectId?: number;
    gameval?: string;
    orientation?: number;
}

interface ObjectFinderProps {
    onJumpToPosition: (position: Position) => void;
    onPositionsChange?: (positions: ObjectPosition[]) => void;
    onCurrentIndexChange?: (index: number) => void;
    onSearchQueryChange?: (query: string) => void;
    initialSearchQuery?: string;
    initialPositions?: ObjectPosition[];
    initialCurrentIndex?: number;
}

function parseInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}

function resolveLocationPosition(location: any): Position | null {
    if (!location) {
        return null;
    }

    const rawPosition = location.position ?? location.pos ?? location.packedPosition ?? location.tile ?? null;

    const tryPacked = (packedValue: unknown): Position | null => {
        const parsed = parseInteger(packedValue);
        if (parsed === null) {
            return null;
        }

        const unpacked = Position.fromPacked(parsed);
        if (unpacked.x >= 0 && unpacked.y >= 0 && unpacked.z >= 0) {
            return unpacked;
        }
        return null;
    };

    if (typeof rawPosition === 'number' || typeof rawPosition === 'string') {
        const packedPosition = tryPacked(rawPosition);
        if (packedPosition) {
            return packedPosition;
        }
    } else if (rawPosition && typeof rawPosition === 'object') {
        if ('packed' in rawPosition) {
            const packedPosition = tryPacked((rawPosition as any).packed);
            if (packedPosition) {
                return packedPosition;
            }
        }

        const x = parseInteger((rawPosition as any).x ?? (rawPosition as any).column ?? location.x);
        const y = parseInteger((rawPosition as any).y ?? (rawPosition as any).row ?? location.y);
        const z = parseInteger((rawPosition as any).z ?? location.z ?? 0) ?? 0;

        if (x !== null && y !== null) {
            return new Position(x, y, z);
        }
    }

    const fallbackX = parseInteger(location.x);
    const fallbackY = parseInteger(location.y);
    if (fallbackX === null || fallbackY === null) {
        return null;
    }
    const fallbackZ = parseInteger(location.z ?? 0) ?? 0;

    return new Position(fallbackX, fallbackY, fallbackZ);
}

export function ObjectFinder({ onJumpToPosition, onPositionsChange, onCurrentIndexChange, onSearchQueryChange, initialSearchQuery = '', initialPositions = [], initialCurrentIndex = -1 }: ObjectFinderProps) {
    const [searchMode, setSearchMode] = useState<'gameval' | 'id'>('gameval');
    const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
    // Initialize with parent's positions - this ensures state persists across remounts
    const [positions, setPositions] = useState<ObjectPosition[]>(() => initialPositions);
    const [isSearching, setIsSearching] = useState(false);
    // Initialize with parent's current index - this ensures state persists across remounts
    const [currentIndex, setCurrentIndex] = useState<number>(() => initialCurrentIndex);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 10;
    const searchInputRef = useRef<HTMLInputElement>(null);
    // Mark as searched if we have initial query or positions - this prevents auto-searching on mount
    const hasSearchedRef = useRef(initialSearchQuery.trim().length > 0 || initialPositions.length > 0);
    const { lookupGameval, lookupGamevalByName } = useGamevals();

    // Notify parent of initial positions on mount (in case parent state was lost)
    useEffect(() => {
        if (initialPositions.length > 0 && positions.length === initialPositions.length) {
            // Ensure parent has the positions
            if (onPositionsChange) {
                onPositionsChange(initialPositions);
            }
            if (initialCurrentIndex >= 0 && onCurrentIndexChange) {
                onCurrentIndexChange(initialCurrentIndex);
            }
        }
    }, []); // Only on mount

    // Restore state from parent when component mounts or when initial values change significantly
    // This handles remounts when tabs change or settings panel closes
    const prevInitialPositionsLengthRef = useRef(initialPositions.length);
    const prevInitialSearchQueryRef = useRef(initialSearchQuery);
    
    useEffect(() => {
        // Restore positions if parent has them and local state is empty or parent changed
        const positionsChanged = initialPositions.length !== prevInitialPositionsLengthRef.current;
        const queryChanged = initialSearchQuery !== prevInitialSearchQueryRef.current;
        
        if (initialPositions.length > 0) {
            // Restore positions if local state is empty or parent has new positions
            if (positions.length === 0 || positionsChanged) {
                setPositions(initialPositions);
            }
            // Restore current index if valid
            if (initialCurrentIndex >= 0 && initialCurrentIndex < initialPositions.length) {
                if (currentIndex !== initialCurrentIndex) {
                    setCurrentIndex(initialCurrentIndex);
                }
            }
            // Mark as searched since we have results
            hasSearchedRef.current = true;
        } else if (initialPositions.length === 0 && positions.length > 0 && 
                   initialSearchQuery.trim().length === 0 && queryChanged) {
            // Only clear if parent explicitly cleared (query is empty AND it changed)
            // This happens when user presses Clear button
            setPositions([]);
            setCurrentIndex(-1);
        }
        
        // Update refs
        prevInitialPositionsLengthRef.current = initialPositions.length;
        prevInitialSearchQueryRef.current = initialSearchQuery;
    }, [initialPositions.length, initialCurrentIndex, initialSearchQuery]); // Use length to avoid deep comparison

    // Restore search query from parent
    useEffect(() => {
        if (initialSearchQuery !== searchQuery) {
            setSearchQuery(initialSearchQuery);
            if (initialSearchQuery.trim().length > 0) {
                hasSearchedRef.current = true;
            }
        }
    }, [initialSearchQuery]);

    // Internal search function
    const performSearch = useCallback(async (query: string, mode: 'gameval' | 'id'): Promise<ObjectPosition[]> => {
        try {
            let objectId: number | undefined;

            if (mode === 'gameval') {
                // Gameval mode: normalize spaces to underscores and lookup by name
                const normalizedQuery = query.trim().replace(/\s+/g, '_');
                objectId = lookupGamevalByName(OBJTYPES, normalizedQuery);
                if (objectId === undefined) {
                    return [];
                }
            } else {
                // ID mode: parse the ID directly
                objectId = parseInt(query.trim());
                if (isNaN(objectId)) {
                    return [];
                }
            }

            // Always use API route (supported on both localhost and production)
            const apiUrl = `/api/map/objects/${objectId}`;
           
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                // Handle error response
                const errorData = await response.json().catch(() => ({}));
                if (errorData.error) {
                    // Object not found - return empty array
                    return [];
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Check if response has error (object not found)
            if (data.error) {
                return [];
            }

            // Convert API response to ObjectPosition[]
            if (data.locations && Array.isArray(data.locations)) {
                const mappedPositions = data.locations.map((location: any) => {
                    const resolvedPosition = resolveLocationPosition(location);
                    if (!resolvedPosition) {
                        return null;
                    }

                    return {
                        x: resolvedPosition.x,
                        y: resolvedPosition.y,
                        z: resolvedPosition.z,
                        objectId: location.id,
                        gameval: undefined, // API doesn't provide gameval
                        orientation: location.orientation
                    } as ObjectPosition;
                }).filter((pos: ObjectPosition | null): pos is ObjectPosition => pos !== null);

                return mappedPositions;
            }

            return [];
        } catch (error) {
            console.error('Object search error:', error);
            return [];
        }
    }, [lookupGamevalByName]);

    // Handle search
    const handleSearch = useCallback(async (query: string, modeOverride?: 'gameval' | 'id') => {
        const effectiveMode = modeOverride || searchMode;
        
        if (!query.trim()) {
            // Only clear if query is empty (user cleared it)
            setPositions([]);
            if (onPositionsChange) {
                onPositionsChange([]);
            }
            if (onCurrentIndexChange) {
                onCurrentIndexChange(-1);
            }
            setIsSearching(false);
            return;
        }

        // Clear positions immediately when starting a NEW search (different from current)
        // But don't clear if we're just restoring from parent state
        if (query.trim() !== searchQuery.trim() || positions.length === 0) {
        setPositions([]);
        setCurrentIndex(-1);
        if (onPositionsChange) {
            onPositionsChange([]);
        }
        if (onCurrentIndexChange) {
            onCurrentIndexChange(-1);
            }
        }
        setIsSearching(true);
        try {
            const results = await performSearch(query, effectiveMode);
            setPositions(results);
            // Notify parent component of position changes
            if (onPositionsChange) {
                onPositionsChange(results);
            }
            // Reset to first position if results found
            if (results.length > 0) {
                setCurrentIndex(0);
                if (onCurrentIndexChange) {
                    onCurrentIndexChange(0);
                }
            } else {
                if (onCurrentIndexChange) {
                    onCurrentIndexChange(-1);
                }
            }
            
            // Show toast notification when results are found
            if (results.length > 0) {
                toast.success(`Found ${results.length} object${results.length > 1 ? 's' : ''}`, {
                    description: `Search: ${query} (${effectiveMode})`
                });
            } else {
                toast.info('No objects found', {
                    description: `Search: ${query} (${effectiveMode})`
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            setPositions([]);
            toast.error('Search failed', {
                description: 'An error occurred while searching for objects'
            });
        } finally {
            setIsSearching(false);
        }
    }, [searchMode, performSearch, onPositionsChange, onCurrentIndexChange]);

    // Check for URL object parameter on mount (only if we don't have existing positions)
    useEffect(() => {
        if (typeof window === 'undefined' || hasSearchedRef.current) return;
        
        // Skip URL search if we already have positions from parent (restored state)
        if (initialPositions.length > 0) {
            hasSearchedRef.current = true;
            return;
        }
        
        const currentUrl = new URL(window.location.href);
        const urlObject = currentUrl.searchParams.get("object");
        
        if (urlObject) {
            setSearchMode('id');
            setSearchQuery(urlObject);
            hasSearchedRef.current = true;
            // Trigger search after a short delay to ensure component is ready
            setTimeout(() => {
                handleSearch(urlObject, 'id');
            }, 100);
        }
    }, [handleSearch, initialPositions.length]);

    const handleSearchInputChange = useCallback((value: string, _modeValue: string) => {
        setSearchQuery(value);
        if (onSearchQueryChange) {
            onSearchQueryChange(value);
        }
    }, [onSearchQueryChange]);

    const handleModeChange = useCallback((modeValue: string) => {
        if (modeValue === 'gameval' || modeValue === 'id') {
            setSearchMode(modeValue);
            setSearchQuery('');
            if (onSearchQueryChange) {
                onSearchQueryChange('');
            }
        }
    }, [onSearchQueryChange]);

    const handleSearchEnter = useCallback((value: string, modeValue: string) => {
        const trimmedValue = value.trim();
        if (trimmedValue.length === 0) {
            return;
        }
        setSearchQuery(trimmedValue);
        if (onSearchQueryChange) {
            onSearchQueryChange(trimmedValue);
        }
        hasSearchedRef.current = true;
        handleSearch(trimmedValue, modeValue as 'gameval' | 'id');
    }, [handleSearch, onSearchQueryChange]);

    const handleSuggestionSelect = useCallback((suggestion: GamevalSuggestion, modeValue: string) => {
        if (modeValue === 'gameval' || modeValue === 'id') {
            const nextQuery = modeValue === 'gameval' ? suggestion.name : suggestion.id.toString();
            setSearchQuery(nextQuery);
            if (onSearchQueryChange) {
                onSearchQueryChange(nextQuery);
            }
            handleSearch(suggestion.id.toString(), 'id');
            return true;
        }
        return false;
    }, [handleSearch, onSearchQueryChange]);

    // Handle search submit
    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        hasSearchedRef.current = true;
        handleSearch(searchQuery);
    };

    // Handle clear search
    const handleClear = (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        const emptyQuery = '';
        setSearchQuery(emptyQuery);
        // Notify parent to clear search query
        if (onSearchQueryChange) {
            onSearchQueryChange(emptyQuery);
        }
        setPositions([]);
        setIsSearching(false);
        setCurrentIndex(-1);
        if (onPositionsChange) {
            onPositionsChange([]);
        }
        if (onCurrentIndexChange) {
            onCurrentIndexChange(-1);
        }
        hasSearchedRef.current = false;
        // Use setTimeout to ensure state update happens first
        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }, 0);
    };

    // Handle next object
    const handleNext = () => {
        if (positions.length === 0) return;
        const nextIndex = (currentIndex + 1) % positions.length;
        setCurrentIndex(nextIndex);
        if (onCurrentIndexChange) {
            onCurrentIndexChange(nextIndex);
        }
        handlePositionClick(positions[nextIndex]);
    };

    // Handle previous object
    const handlePrev = () => {
        if (positions.length === 0) return;
        const prevIndex = currentIndex <= 0 ? positions.length - 1 : currentIndex - 1;
        setCurrentIndex(prevIndex);
        if (onCurrentIndexChange) {
            onCurrentIndexChange(prevIndex);
        }
        handlePositionClick(positions[prevIndex]);
    };

    // Handle position click
    const handlePositionClick = (pos: ObjectPosition) => {
        const position = new Position(pos.x, pos.y, pos.z);
        onJumpToPosition(position);
    };

    // Format position for display (without name)
    const formatPosition = (pos: ObjectPosition) => {
        return `(${pos.x}, ${pos.y}, ${pos.z})`;
    };

    // Get current object name
    const getCurrentObjectName = (): string | undefined => {
        if (currentIndex >= 0 && currentIndex < positions.length) {
            const pos = positions[currentIndex];
            if (pos.objectId) {
                return lookupGameval(OBJTYPES, pos.objectId);
            }
        }
        return undefined;
    };

    // Get current object image URL
    const getCurrentObjectImageUrl = (): string | undefined => {
        if (currentIndex >= 0 && currentIndex < positions.length) {
            const pos = positions[currentIndex];
            if (pos.objectId !== undefined) {
                const orientation = pos.orientation ?? 1;
                return `https://chisel.weirdgloop.org/static/img/osrs-object/${pos.objectId}_orient${orientation}.png`;
            }
        }
        return undefined;
    };

    // Pagination calculations
    const totalPages = Math.ceil(positions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPositions = positions.slice(startIndex, endIndex);

    // Reset to page 1 when positions change
    useEffect(() => {
        setCurrentPage(1);
    }, [positions.length]);

    // Update current page when currentIndex changes (when navigating with prev/next)
    useEffect(() => {
        if (currentIndex >= 0 && positions.length > 0) {
            const pageForIndex = Math.floor(currentIndex / itemsPerPage) + 1;
            setCurrentPage(prevPage => {
                // Only update if the index is on a different page
                if (pageForIndex !== prevPage) {
                    return pageForIndex;
                }
                return prevPage;
            });
        }
    }, [currentIndex, positions.length, itemsPerPage]);
    return (
        <div className="flex flex-col h-full">
            {/* Search Bar with Mode Toggle */}
            <div className="space-y-2 mb-3">
                {/* Search Input with Mode Dropdown */}
                <form onSubmit={handleSearchSubmit} className="relative">
                    <GamevalIdSearch
                        ref={searchInputRef}
                        mode={searchMode}
                        value={searchQuery}
                        onValueChange={handleSearchInputChange}
                        onModeChange={handleModeChange}
                        onEnter={handleSearchEnter}
                        onSuggestionSelect={handleSuggestionSelect}
                        modeOptions={[
                            { value: 'gameval', label: 'Gameval', placeholder: 'Search by gameval...' },
                            { value: 'id', label: 'ID', placeholder: 'Search by ID...' },
                        ]}
                        gamevalType={OBJTYPES}
                        suggestionLimit={8}
                    />
                </form>

                {/* Controls: Clear, Prev, Next */}
                <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleClear(e);
                            }}
                            disabled={!searchQuery.trim() && positions.length === 0}
                            className="h-7 px-2 text-xs flex items-center gap-1"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </Button>
                        <div className="flex-1" />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handlePrev}
                            disabled={positions.length === 0}
                            className="h-7 px-2 text-xs"
                            title="Previous object"
                        >
                            <ArrowLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                            {positions.length > 0 ? `${currentIndex + 1} / ${positions.length}` : '0 / 0'}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleNext}
                            disabled={positions.length === 0}
                            className="h-7 px-2 text-xs"
                            title="Next object"
                        >
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>
                    {/* Object name and image display */}
                    {positions.length > 0 && currentIndex >= 0 && (
                        <div className="space-y-2">
                            <div className="text-xs text-muted-foreground text-center">
                                Object: {getCurrentObjectName() || `ID: ${positions[currentIndex]?.objectId || 'Unknown'}`}
                            </div>
                            {getCurrentObjectImageUrl() && (
                                <div className="flex justify-center">
                                    <img 
                                        src={getCurrentObjectImageUrl()} 
                                        alt={getCurrentObjectName() || `Object ${positions[currentIndex]?.objectId}`}
                                        className="max-w-full max-h-32 object-contain border rounded"
                                        onError={(e) => {
                                            // Hide image on error (object image might not exist)
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Positions List with Pagination */}
            <div className="flex-1 flex flex-col min-h-0">
                {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                            <div className="text-sm text-muted-foreground">Searching...</div>
                        </div>
                    </div>
                ) : positions.length > 0 ? (
                    <>
                        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                            {paginatedPositions.map((pos, pageIndex) => {
                                const actualIndex = startIndex + pageIndex;
                                return (
                                    <button
                                        key={actualIndex}
                                        onClick={() => {
                                            setCurrentIndex(actualIndex);
                                            if (onCurrentIndexChange) {
                                                onCurrentIndexChange(actualIndex);
                                            }
                                            handlePositionClick(pos);
                                        }}
                                        className={cn(
                                            "w-full px-3 py-2 text-left text-sm rounded-md",
                                            "hover:bg-accent focus:bg-accent focus:outline-none",
                                            "border transition-colors",
                                            currentIndex === actualIndex
                                                ? "bg-accent border-border"
                                                : "border-transparent hover:border-border"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-xs truncate">
                                                    {formatPosition(pos)}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between gap-2 pt-2 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="h-7 px-2 text-xs"
                                >
                                    <ChevronsLeft className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="h-7 px-2 text-xs"
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-7 px-2 text-xs"
                                >
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="h-7 px-2 text-xs"
                                >
                                    <ChevronsRight className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : searchQuery.trim() ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No objects found
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        Enter a search query to find objects
                    </div>
                )}
            </div>
        </div>
    );
}

