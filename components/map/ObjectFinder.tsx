"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MapPin, Hash, Gamepad2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Position } from '@/lib/map/model/Position';
import { toast } from 'sonner';

export interface ObjectPosition {
    x: number;
    y: number;
    z: number;
    objectId?: number;
    gameval?: string;
}

interface ObjectFinderProps {
    onJumpToPosition: (position: Position) => void;
    onSearch?: (query: string, mode: 'gameval' | 'id') => Promise<ObjectPosition[]>;
}

export function ObjectFinder({ onJumpToPosition, onSearch }: ObjectFinderProps) {
    const [searchMode, setSearchMode] = useState<'gameval' | 'id'>('gameval');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [suggestions, setSuggestions] = useState<ObjectPosition[]>([]);
    const [positions, setPositions] = useState<ObjectPosition[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const hasSearchedRef = useRef(false);

    // Handle search
    const handleSearch = useCallback(async (query: string, modeOverride?: 'gameval' | 'id') => {
        const effectiveMode = modeOverride || searchMode;
        
        if (!query.trim()) {
            setPositions([]);
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        // Clear positions immediately when starting search
        setPositions([]);
        setCurrentIndex(-1);
        setIsSearching(true);
        try {
            if (onSearch) {
                const results = await onSearch(query, effectiveMode);
                setPositions(results);
                // Reset to first position if results found
                if (results.length > 0) {
                    setCurrentIndex(0);
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
            } else {
                // Mock data for UI development
                setPositions([]);
            }
        } catch (error) {
            console.error('Search error:', error);
            setPositions([]);
            toast.error('Search failed', {
                description: 'An error occurred while searching for objects'
            });
        } finally {
            setIsSearching(false);
            setShowSuggestions(false);
        }
    }, [searchMode, onSearch]);

    // Check for URL object parameter on mount
    useEffect(() => {
        if (typeof window === 'undefined' || hasSearchedRef.current) return;
        
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
    }, [handleSearch]);

    // Mock gameval suggestions data
    const gamevalSuggestions = [
        'BANK_BOOTH', 'CHEST', 'DOOR', 'TREE', 'ROCK', 'STAIRS', 'LADDER',
        'ALTAR', 'ANVIL', 'FURNACE', 'SMELTING_FURNACE', 'ORE', 'DEPOSIT_BOX',
        'COOKING_RANGE', 'WALL', 'GATE', 'FENCE', 'BARREL', 'CRATE', 'SACK',
        'MARKET_STALL', 'COUNTER', 'SHOP_COUNTER', 'LECTERN', 'BOOKCASE'
    ];

    // Get suggestions based on query
    const getSuggestions = useCallback((query: string): string[] => {
        if (!query.trim() || searchMode !== 'gameval') return [];
        
        const queryLower = query.toLowerCase();
        return gamevalSuggestions
            .filter(gameval => gameval.toLowerCase().includes(queryLower))
            .slice(0, 5); // Limit to 5 suggestions
    }, [searchMode]);

    // Handle search input change
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        
        // Update suggestions as user types (gameval mode only)
        if (searchMode === 'gameval' && value.trim()) {
            const newSuggestions = getSuggestions(value);
            // Convert suggestions to ObjectPosition format for display
            const suggestionPositions: ObjectPosition[] = newSuggestions.map(gameval => ({
                x: 0,
                y: 0,
                z: 0,
                gameval: gameval,
                objectId: 0
            }));
            setSuggestions(suggestionPositions);
            setShowSuggestions(suggestionPositions.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [searchMode, getSuggestions]);

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
        setSearchQuery('');
        setPositions([]);
        setSuggestions([]);
        setShowSuggestions(false);
        setIsSearching(false);
        setCurrentIndex(-1);
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
        handlePositionClick(positions[nextIndex]);
    };

    // Handle previous object
    const handlePrev = () => {
        if (positions.length === 0) return;
        const prevIndex = currentIndex <= 0 ? positions.length - 1 : currentIndex - 1;
        setCurrentIndex(prevIndex);
        handlePositionClick(positions[prevIndex]);
    };

    // Handle position click
    const handlePositionClick = (pos: ObjectPosition) => {
        const position = new Position(pos.x, pos.y, pos.z);
        onJumpToPosition(position);
    };

    // Format position for display
    const formatPosition = (pos: ObjectPosition) => {
        const identifier = searchMode === 'gameval' 
            ? (pos.gameval || `ID: ${pos.objectId}`)
            : (pos.objectId?.toString() || pos.gameval || 'Unknown');
        return `${identifier} @ (${pos.x}, ${pos.y}, ${pos.z})`;
    };

    // Click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Search Bar with Mode Toggle */}
            <div className="space-y-2 mb-3">
                {/* Search Input with Mode Dropdown */}
                <form onSubmit={handleSearchSubmit} className="relative">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                            ref={searchInputRef}
                            type="text"
                            placeholder={searchMode === 'gameval' ? 'Search by gameval...' : 'Search by ID...'}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => {
                                if (searchMode === 'gameval' && searchQuery.trim()) {
                                    handleSearchChange(searchQuery);
                                }
                            }}
                            onBlur={() => {
                                // Delay hiding suggestions to allow clicks
                                setTimeout(() => {
                                    setShowSuggestions(false);
                                }, 200);
                            }}
                            className="pl-8 pr-24 h-9 text-sm"
                        />
                        {/* Mode Dropdown - similar to search table */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 h-8 px-3 min-w-[90px] rounded-l-none flex items-center justify-center border-l text-xs"
                                >
                                    {searchMode === 'gameval' ? 'Gameval' : 'ID'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="end" className="mt-1">
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSearchMode('gameval');
                                        setSuggestions([]);
                                        setShowSuggestions(false);
                                    }}
                                >
                                    Gameval
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSearchMode('id');
                                        setSuggestions([]);
                                        setShowSuggestions(false);
                                    }}
                                >
                                    ID
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Suggestions Dropdown - only show for gameval mode */}
                    {showSuggestions && suggestions.length > 0 && searchMode === 'gameval' && (
                        <div
                            ref={suggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto"
                        >
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => {
                                        const gameval = suggestion.gameval || '';
                                        setSearchQuery(gameval);
                                        setShowSuggestions(false);
                                        // Auto-search when clicking a suggestion
                                        handleSearch(gameval, 'gameval');
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none border-b last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium font-mono text-xs">
                                        {suggestion.gameval}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </form>

                {/* Controls: Clear, Prev, Next */}
                <div className="flex items-center gap-2 mt-2">
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
                    >
                        <ChevronLeft className="h-3 w-3" />
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
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Positions List */}
            <ScrollArea className="flex-1">
                {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                            <div className="text-sm text-muted-foreground">Searching...</div>
                        </div>
                    </div>
                ) : positions.length > 0 ? (
                    <div className="space-y-1">
                        {positions.map((pos, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentIndex(index);
                                    handlePositionClick(pos);
                                }}
                                className={cn(
                                    "w-full px-3 py-2 text-left text-sm rounded-md",
                                    "hover:bg-accent focus:bg-accent focus:outline-none",
                                    "border transition-colors",
                                    currentIndex === index
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
                        ))}
                    </div>
                ) : searchQuery.trim() ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No objects found
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        Enter a search query to find objects
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}

