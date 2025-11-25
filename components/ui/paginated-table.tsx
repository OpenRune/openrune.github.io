'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo, useTransition } from 'react';
import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchFromBuildUrl, buildUrl } from '@/lib/api/apiClient';
import { IconChevronLeft, IconChevronRight, IconTarget, IconCircleDashed, IconX, IconFileDownload } from '@tabler/icons-react';
import { Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Cookies from 'js-cookie';
import { SEARCH_MODES } from '@/components/search-table/searchModes';
import { useSettings } from '@/components/layout/settings-provider';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { cn } from '@/lib/utils';
import { useDownloadManager } from '@/components/download-manager';
import { GamevalType, ITEMTYPES, NPCTYPES, OBJTYPES, SPRITETYPES, SEQTYPES, SPOTTYPES } from '@/lib/gamevals';
import { GamevalIdSearch, GamevalSuggestion } from '@/components/search/GamevalIdSearch';

interface InfoResponse {
  totalEntries: number;
  entriesWithNames?: number;
  totalSprites?: number;
  [key: string]: number | undefined;
}

interface SpriteData {
  name?: string;
  sprites?: Array<{
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    averageColor: number;
    subHeight: number;
    subWidth: number;
  }>;
  count?: number;
  [key: string]: any; // Allow any additional properties for different data types
}

interface ManifestResponse {
  [id: string]: SpriteData | any;
  total?: number; // Total count of filtered results (when searching)
}

export interface TableColumn {
  key: string;
  label: string;
  render?: (row: { id: string; data: any }) => React.ReactNode;
  className?: string;
}

const GAMEVAL_TYPE_BY_ENDPOINT: Record<string, GamevalType> = {
  objects: OBJTYPES,
  items: ITEMTYPES,
  npcs: NPCTYPES,
  sprites: SPRITETYPES,
  sequences: SEQTYPES,
  spotanims: SPOTTYPES,
};

// Helper to strip surrounding quotes
function stripQuotes(str: string) {
  return str.replace(/^"(.+)"$/, '$1');
}

// useTags custom hook
type Tag = { value: string; exact: boolean };

function useTags(initial: Tag[] = []) {
  const [tags, setTags] = useState<Tag[]>(initial);

  // Add tags from input (splitting, deduplication)
  const addTags = (input: string) => {
    // Regex: match quoted values or unquoted words
    const regex = /"([^"]+)"|([^\s,\n]+)/g;
    let vals: string[] = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
      if (match[1]) {
        vals.push('"' + match[1] + '"'); // preserve quotes for exact
      } else if (match[2]) {
        vals.push(match[2]);
      }
    }
    vals = vals.map((v: string) => v.trim()).filter(Boolean);
    setTags((prev: Tag[]) => {
      const existing = new Set(prev.map((v) => v.value));
      const newTags = vals.filter((v: string) => !existing.has(stripQuotes(v))).map((v: string) => {
        if (v.startsWith('"') && v.endsWith('"')) {
          return { value: stripQuotes(v), exact: true };
        } else {
          return { value: v, exact: false };
        }
      });
      return [...prev, ...newTags];
    });
  };

  // Remove tag by index
  const removeTag = (idx: number) => setTags((prev: Tag[]) => prev.filter((_, i) => i !== idx));

  // Remove all tags
  const clearTags = () => setTags([]);

  // Toggle exact for a tag
  const toggleExact = (idx: number) => setTags((prev: Tag[]) => prev.map((v, i) => i === idx ? { ...v, exact: !v.exact } : v));

  return { tags, setTags, addTags, removeTag, clearTags, toggleExact };
}

// SearchTag component - memoized to prevent unnecessary re-renders
const SearchTag = memo(function SearchTag({ value, exact, onToggle, onRemove }: { value: string; exact: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono select-none ${
        exact 
          ? 'bg-blue-600/20 border border-blue-500/30 text-white' 
          : 'bg-zinc-800 border border-zinc-700 text-white'
      }`}
      style={{ minWidth: 0, height: 22 }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="p-0.5 focus:outline-none flex items-center flex-shrink-0"
              onClick={onToggle}
              aria-label={`Toggle exact for ${value}`}
              type="button"
              tabIndex={0}
            >
              {exact ? (
                <IconTarget size={12} className="text-blue-400" />
              ) : (
                <IconCircleDashed size={12} className="text-white/70" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {exact ? 'Exact match' : 'Fuzzy match'}
            <br />
            Click to toggle mode
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span 
        style={{ 
          whiteSpace: 'nowrap', 
          fontSize: 12 
        }} 
        className="select-none"
      >
        <span style={{ visibility: exact ? 'visible' : 'hidden' }}>"</span>
        {value}
        <span style={{ visibility: exact ? 'visible' : 'hidden' }}>"</span>
      </span>
      <button
        className="ml-0.5 text-white/70 hover:text-white text-xs flex-shrink-0"
        onClick={onRemove}
        aria-label={`Remove ${value}`}
        type="button"
      >
        ×
      </button>
    </span>
  );
});

interface Filter {
  key: string;
  label: string;
}

interface PaginatedTableProps {
  /** Base endpoint path (e.g., 'sprites' or 'objects') */
  endpoint: string;
  /** Initial items per page (will be persisted in cookie) */
  itemsPerPage?: number;
  /** Default page to start on (will be persisted in cookie) */
  defaultPage?: number;
  /** Custom image URL generator function */
  getImageUrl?: (id: string, index: number) => string;
  /** Custom columns configuration */
  columns?: TableColumn[];
  /** Table title */
  title?: string;
  /** Search modes to disable (e.g., ['name']) */
  disabledModes?: string[];
  /** Default search mode */
  defaultSearchMode?: string;
  /** Field name in info response for total count (default: 'totalEntries') */
  totalCountField?: string;
  /** Optional function to calculate total count based on filters and info */
  getTotalCount?: (info: InfoResponse | null, filterState: Record<string, boolean>) => number;
  /** Optional info content to display in info panel */
  infoContent?: ReactNode;
  /** Optional filters configuration */
  filters?: Filter[];
  /** Optional info data from external source (prevents duplicate fetching) */
  externalInfo?: InfoResponse | null;
  /** Optional header action element (e.g., download button) */
  headerAction?: ReactNode;
  /** Optional download button config */
  downloadButton?: {
    type: 'SPRITES' | 'MODELS' | 'TEXTURES';
    disabled?: boolean;
    onDownload: () => void;
    tooltip?: string;
    label?: string;
  };
}

export function PaginatedTable({
  endpoint,
  itemsPerPage: initialItemsPerPage = 50,
  defaultPage: initialDefaultPage = 1,
  getImageUrl,
  columns,
  title,
  disabledModes = [],
  defaultSearchMode,
  totalCountField = 'totalEntries',
  getTotalCount,
  infoContent,
  filters = [],
  externalInfo,
  headerAction,
  downloadButton,
}: PaginatedTableProps) {
  const { settings } = useSettings();
  const { hasActiveDownloads } = useDownloadManager();
  const { selectedCacheType } = useCacheType();
  const prevCacheTypeRef = useRef<string>(selectedCacheType.id);
  const [isFetching, startTransition] = useTransition();

  // Map endpoint to suggestion display setting
  const disableSuggestions = useMemo(() => {
    if (!settings.suggestionDisplay) {
      return false; // Default to showing suggestions if not initialized
    }
    const endpointToSettingKey: Record<string, keyof typeof settings.suggestionDisplay> = {
      'objects': 'objects',
      'items': 'items',
      'npcs': 'npcs',
      'sprites': 'sprites',
      'sequences': 'sequences',
      'spotanims': 'spotanims',
      'textures': 'textures',
      'overlays': 'underlaysOverlays',
      'underlays': 'underlaysOverlays',
    };
    const settingKey = endpointToSettingKey[endpoint];
    if (settingKey) {
      return !settings.suggestionDisplay[settingKey];
    }
    return false; // Default to showing suggestions if endpoint not found
  }, [endpoint, settings.suggestionDisplay]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [gamevalInput, setGamevalInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<string>(() => {
    const available = SEARCH_MODES.filter(mode => !disabledModes.includes(mode.value));
    const defaultMode = defaultSearchMode && !disabledModes.includes(defaultSearchMode) 
      ? defaultSearchMode 
      : (available.length > 0 ? available[0].value : 'id');
    return defaultMode;
  });
  const [infoTabOpen, setInfoTabOpen] = useState(false);

  const { tags: gamevalTags, addTags, removeTag, clearTags, toggleExact } = useTags([]);
  const prevSearchModeRef = useRef<string>(searchMode);

  const activeGamevalType = useMemo(() => GAMEVAL_TYPE_BY_ENDPOINT[endpoint], [endpoint]);
  
  const handleSearchInputChange = useCallback((nextValue: string, modeValue: string) => {
    if (modeValue === 'gameval') {
      setGamevalInput(nextValue);
    } else {
      setSearchQuery(nextValue);
    }
  }, []);

  const handleSearchModeChange = useCallback((nextMode: string) => {
    if (disabledModes.includes(nextMode) || nextMode === searchMode) {
      return;
    }
    const previousMode = searchMode;
    setSearchMode(nextMode);
    setSearchQuery('');
    setGamevalInput('');
    if (previousMode === 'gameval') {
      clearTags();
    }
  }, [disabledModes, searchMode, clearTags]);

  const handleSearchEnter = useCallback((currentValue: string, modeValue: string) => {
    if (modeValue === 'gameval') {
      const trimmed = currentValue.trim();
      if (trimmed) {
        addTags(trimmed);
        setGamevalInput('');
      }
    }
  }, [addTags]);

  const handleSuggestionSelect = useCallback((suggestion: GamevalSuggestion, modeValue: string) => {
    if (modeValue === 'gameval') {
      addTags(suggestion.name);
      setGamevalInput('');
      return true;
    }
    return false;
  }, [addTags]);

  // Build search query from tags when in gameval mode
  useEffect(() => {
    if (searchMode === 'gameval') {
      if (gamevalTags.length > 0) {
        const query = gamevalTags.map(tag => tag.exact ? `"${tag.value}"` : tag.value).join(',');
        setSearchQuery(query);
      } else if (gamevalInput.trim()) {
        // If no tags, use the input as live search
        setSearchQuery(gamevalInput.trim());
      } else {
        setSearchQuery('');
      }
    }
    // Don't update searchQuery when not in gameval mode - let it be controlled by the input directly
  }, [gamevalTags, gamevalInput, searchMode]);
  
  // Reset gameval state when mode changes (only when actually switching away from gameval)
  useEffect(() => {
    const prevMode = prevSearchModeRef.current;
    prevSearchModeRef.current = searchMode;
    
    if (prevMode === 'gameval' && searchMode !== 'gameval') {
      // Only clear when actually switching away from gameval mode
      clearTags();
      setGamevalInput('');
    }
    // Don't clear searchQuery here - let it persist when switching modes
  }, [searchMode, clearTags]);

  // Debounce search query to prevent spamming API calls (reduced to 200ms for snappier feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200); // 200ms delay for better responsiveness
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Ensure current mode is not disabled, if it is, switch to first available
  useEffect(() => {
    if (disabledModes.includes(searchMode)) {
      const available = SEARCH_MODES.filter(mode => !disabledModes.includes(mode.value));
      if (available.length > 0) {
        setSearchMode(available[0].value);
      }
    }
  }, [searchMode, disabledModes]);
  
  const currentMode = useMemo(() => SEARCH_MODES.find(m => m.value === searchMode) || SEARCH_MODES[0], [searchMode]);
  const placeholder = currentMode?.placeholder || 'Search...';
  const perPageCookieKey = `per_page_${endpoint}`;
  const defaultAmt = initialItemsPerPage;
  const amtOptions = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90];

  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [data, setData] = useState<ManifestResponse | null>(null);
  const [allSearchResults, setAllSearchResults] = useState<ManifestResponse | null>(null); // Store all search results for client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTotalCount, setSearchTotalCount] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const cookieVal = Cookies.get(perPageCookieKey);
    const parsed = cookieVal ? parseInt(cookieVal, 10) : defaultAmt;
    return isNaN(parsed) ? defaultAmt : Math.max(1, Math.min(90, parsed));
  });
  const [filterState, setFilterState] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    filters.forEach((f) => {
      state[f.key] = false; // Default to false
    });
    return state;
  });
  const infoFetchedRef = useRef(false); // Track if info fetch has been initiated
  const fetchManifestRef = useRef<string>(''); // Track last fetch to prevent duplicate calls

  // Get total count from info response (supports different field names or custom calculation)
  const totalCount = useMemo(() => {
    if (getTotalCount) {
      return getTotalCount(info, filterState);
    }
    return info ? (info[totalCountField] ?? 0) : 0;
  }, [info, totalCountField, getTotalCount, filterState]);

  // Calculate total pages (for unfiltered data)
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / itemsPerPage) : 0;

  // Calculate ID range for current page
  const getPageIdRange = useCallback((page: number): [number, number] => {
    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage - 1, totalCount - 1);
    return [start, end];
  }, [itemsPerPage, totalCount]);

  // Fetch manifest data for current page
  const filterStateKey = useMemo(() => JSON.stringify(filterState), [filterState]);

  const fetchManifest = useCallback(async (page: number) => {
    if (!info) return;

    // Check if searching
    const isSearching = debouncedSearchQuery.trim() !== '';
    
    // When searching, we fetch all results once and paginate client-side
    // Create a unique key for search fetch (without page, since we fetch all at once)
    const searchFetchKey = `${selectedCacheType.id}-${endpoint}-search-${debouncedSearchQuery}-${filterStateKey}`;
    
    // For non-search, include page in the fetch key
    const fetchKey = isSearching 
      ? searchFetchKey
      : `${selectedCacheType.id}-${endpoint}-${page}-${itemsPerPage}-${debouncedSearchQuery}-${filterStateKey}`;
    
    if (fetchManifestRef.current === fetchKey) {
      return; // Already fetching or fetched this exact combination
    }

    try {
      fetchManifestRef.current = fetchKey;
      setLoading(true);
      setError(null);
      const path = `${endpoint}/data`;
      const queryParams: Record<string, string | number | boolean> = {};
      
      // Check if any filters are active
      const hasActiveFilters = filters.some(filter => filterState[filter.key]);
      
      if (isSearching) {
        // When searching, fetch ALL results (no limit, no offset)
        queryParams.searchMode = searchMode;
        queryParams.q = debouncedSearchQuery.trim();
        // Don't add limit or offset - fetch all results
      } else {
        // When not searching, use normal pagination
        queryParams.limit = itemsPerPage;
        
        if (hasActiveFilters) {
          // When filters are active, use offset for pagination (IDs won't be sequential)
          queryParams.offset = (page - 1) * itemsPerPage;
        } else {
          // Only use idRange when not searching and no filters are active
          const [start, end] = getPageIdRange(page);
          queryParams.idRange = `${start}..${end}`;
        }
      }
      
      // Add filter parameters
      filters.forEach((filter) => {
        if (filterState[filter.key]) {
          if (filter.key === 'requireName') {
            queryParams.filterNulls = true;
          } else if (filter.key === 'notedOnly') {
            queryParams.notedOnly = true;
          } else if (filter.key === 'interactiveOnly') {
            queryParams.interactiveOnly = true;
          } else {
            queryParams[filter.key] = true;
          }
        }
      });
      
      // Log the URL being fetched
      const fullUrl = buildUrl(path, queryParams);
      console.log('🔍 Fetching URL:', fullUrl);
      
      const response = await fetchFromBuildUrl(path, queryParams);
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to fetch manifest (${response.status}): ${errorText || response.statusText}`);
      }
      const manifestData: ManifestResponse = await response.json();
      
      startTransition(() => {
        if (isSearching) {
          // Store all search results for client-side pagination
          setAllSearchResults(manifestData);
          // Extract total count from response
          if (manifestData.total !== undefined) {
            setSearchTotalCount(manifestData.total);
          } else {
            // If no total, count entries (excluding 'total' key)
            const entryKeys = Object.keys(manifestData).filter(k => k !== 'total');
            setSearchTotalCount(entryKeys.length);
          }
        } else {
          // Clear search results when not searching
          setAllSearchResults(null);
          setSearchTotalCount(null);
        }
        setData(manifestData);
        setLoading(false);
      });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch manifest';
        startTransition(() => {
          setError(errorMessage);
          setLoading(false);
        });
        fetchManifestRef.current = ''; // Reset on error to allow retry
      }
  }, [endpoint, info, getPageIdRange, itemsPerPage, debouncedSearchQuery, searchMode, filterState, filters, selectedCacheType.id, filterStateKey, startTransition]);

  // Save itemsPerPage to cookie when it changes
  useEffect(() => {
    Cookies.set(perPageCookieKey, String(itemsPerPage), { expires: 365 });
  }, [itemsPerPage, perPageCookieKey]);


  // Handle copy event to convert gamevals to uppercase when setting is enabled
  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      if (!settings.copyGamevalsToUppercase) return;
      
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') return;
      
      // Check if the selection is within a gameval column
      const range = selection.getRangeAt(0);
      const startContainer = range.startContainer;
      
      // Walk up the DOM tree to find the table cell
      let element = startContainer.nodeType === Node.TEXT_NODE 
        ? startContainer.parentElement 
        : startContainer as Element;
      
      while (element && element.tagName !== 'TD' && element.tagName !== 'TH') {
        element = element.parentElement;
      }
      
      // If we found a table cell, check if it's in a gameval column
      if (element && element.tagName === 'TD' && columns) {
        const tableRow = element.parentElement;
        if (tableRow) {
          const cellIndex = Array.from(tableRow.children).indexOf(element);
          const isGamevalColumn = columns[cellIndex]?.key === 'gameVal' || columns[cellIndex]?.key === 'gameval';
          
          if (isGamevalColumn) {
            const selectedText = selection.toString();
            event.preventDefault();
            const uppercaseText = selectedText.toUpperCase();
            event.clipboardData?.setData('text/plain', uppercaseText);
          }
        }
      }
    };
    
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [columns, settings.copyGamevalsToUppercase]);

  // Track the current endpoint to detect changes
  const currentEndpointRef = useRef<string>(endpoint);
  
  // Reset page to 1 when endpoint changes (navigating to a new page)
  useEffect(() => {
    if (currentEndpointRef.current !== endpoint) {
      currentEndpointRef.current = endpoint;
      setCurrentPage(1);
    }
  }, [endpoint]);
  
  // Use external info if provided, otherwise fetch it ourselves
  useEffect(() => {
    if (externalInfo !== undefined) {
      // External info is provided, use it instead of fetching
      if (info !== externalInfo) {
        setInfo(externalInfo);
      }
      infoFetchedRef.current = true;
      return;
    }
    
    // If endpoint changed, reset info and refs
    if (currentEndpointRef.current !== endpoint) {
      currentEndpointRef.current = endpoint;
      setInfo(null);
      infoFetchedRef.current = false;
      fetchManifestRef.current = ''; // Reset fetch tracking when endpoint changes
    }
    
    // If cache type changed, reset info and refs to force refresh
    if (prevCacheTypeRef.current !== selectedCacheType.id) {
      prevCacheTypeRef.current = selectedCacheType.id;
      setInfo(null);
      setData(null);
      infoFetchedRef.current = false;
      fetchManifestRef.current = ''; // Reset fetch tracking when cache type changes
      setCurrentPage(1); // Reset to first page
    }
    
    // Don't fetch if we already have info or if fetch is already in progress
    if (info || infoFetchedRef.current) return;
    
    infoFetchedRef.current = true;
    
    const fetchInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        const path = `${endpoint}/info`;
        const response = await fetchFromBuildUrl(path);
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          infoFetchedRef.current = false; // Reset on error so we can retry
          throw new Error(`Failed to fetch info (${response.status}): ${errorText || response.statusText}`);
        }
        const infoData: InfoResponse = await response.json();
        startTransition(() => {
          setInfo(infoData);
          setLoading(false);
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch info';
        startTransition(() => {
          setError(errorMessage);
          setLoading(false);
        });
        infoFetchedRef.current = false; // Reset on error so we can retry
      }
    };
    
    fetchInfo();
  }, [endpoint, info, externalInfo, selectedCacheType.id, startTransition]); // Include externalInfo and selectedCacheType.id in dependencies

  // Validate and adjust currentPage when totalPages changes (including when filters change)
  useEffect(() => {
    if (info && totalPages > 0 && currentPage > totalPages) {
      const validPage = Math.max(1, totalPages);
      setCurrentPage(validPage);
    }
  }, [info, totalPages, currentPage]);

  // Recalculate page bounds and adjust current page when filters change (before fetch)
  useEffect(() => {
    if (filters.length > 0 && info) {
      // Calculate new total count and pages based on filtered count
      const newTotalCount = getTotalCount ? getTotalCount(info, filterState) : (info[totalCountField] ?? 0);
      const newTotalPages = newTotalCount > 0 ? Math.ceil(newTotalCount / itemsPerPage) : 0;
      
      // Adjust current page if it's out of bounds
      if (newTotalPages > 0 && currentPage > newTotalPages) {
        setCurrentPage(newTotalPages);
      } else if (newTotalPages === 0 && currentPage > 1) {
        setCurrentPage(1);
      }
    }
  }, [filterState, filters.length, info, getTotalCount, totalCountField, itemsPerPage]);

  // Track previous itemsPerPage to detect changes
  const prevItemsPerPageRef = useRef<number>(itemsPerPage);

  // Fetch manifest when info is loaded, page changes, itemsPerPage changes, or filters change
  useEffect(() => {
    if (!info) return; // Wait for info to load first
    
    const isSearching = debouncedSearchQuery.trim() !== '';
    const itemsPerPageChanged = prevItemsPerPageRef.current !== itemsPerPage;
    
    // Update ref for next comparison
    prevItemsPerPageRef.current = itemsPerPage;
    
    // When searching, refetch if itemsPerPage changes, otherwise use client-side pagination
    if (isSearching) {
      // Adjust current page if it goes out of bounds when itemsPerPage changes
      if (searchTotalCount !== null) {
        const newTotalPages = Math.ceil(searchTotalCount / itemsPerPage);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages);
        }
      }
      
      // If itemsPerPage changed, refetch the data
      if (itemsPerPageChanged) {
        fetchManifest(1);
        return;
      }
      
      // Don't fetch on page changes - use client-side pagination
      // Only fetch when search query or filters change (handled by other effects)
      return;
    }
    
    // If we have totalPages > 0, ensure we're within bounds
    if (totalPages > 0) {
      if (currentPage <= totalPages) {
        fetchManifest(currentPage);
      }
    } else {
      // If totalPages is 0, still try to fetch (might be empty data or calculation issue)
      // Only fetch page 1 in this case
      if (currentPage === 1) {
        fetchManifest(1);
      }
    }
  }, [info, currentPage, fetchManifest, itemsPerPage, totalPages, filterState, debouncedSearchQuery, searchTotalCount]);

  // Reset to page 1 when search query changes and fetch new results
  useEffect(() => {
    if (!info) return; // Wait for info to load first
    
    if (debouncedSearchQuery.trim()) {
      setCurrentPage(1);
      setSearchTotalCount(null); // Reset search total count when search changes
      // Fetch all search results
      fetchManifest(1);
    } else {
      setSearchTotalCount(null); // Clear when search is cleared
      setAllSearchResults(null); // Clear all search results when search is cleared
    }
  }, [debouncedSearchQuery, info, fetchManifest]);

  // Default image URL generator - not used if custom columns are provided
  const defaultGetImageUrl = useCallback(
    (id: string, _index: number) => {
      const params = new URLSearchParams({
        id: String(id),
        width: '128',
        height: '128',
        keepAspectRatio: 'false',
      });
      return `/api/${endpoint}?${params.toString()}`;
    },
    [endpoint]
  );

  const imageUrlGenerator = getImageUrl || defaultGetImageUrl;

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  // When searching, backend returns filtered results, so we use entry count
  // When not searching, use total count from info

  // Default columns if none provided
  const defaultColumns: TableColumn[] = [
    {
      key: 'image',
      label: 'Image',
      render: ({ id }) => (
        <img
          src={imageUrlGenerator(id, 0)}
          alt={`Item ${id}`}
          className="h-16 w-16 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ),
    },
    {
      key: 'id',
      label: 'ID',
      render: ({ id }) => <span className="font-mono text-sm">{id}</span>,
    },
    {
      key: 'gameval',
      label: 'Gameval',
      render: ({ data }: { id: string; data: any }) => <span>{data.name || '-'}</span>,
    },
    {
      key: 'subcount',
      label: 'Subcount',
      render: ({ data }: { id: string; data: any }) => <span>{data.count}</span>,
      className: 'w-32',
    },
  ];

  const tableColumns = useMemo(() => columns || defaultColumns, [columns]);
  
  // Memoize entries to prevent unnecessary re-renders
  const entries = useMemo(() => {
    const isSearching = debouncedSearchQuery.trim() !== '';
    
    // When searching, use allSearchResults and paginate client-side
    const sourceData = isSearching ? allSearchResults : data;
    
    if (!sourceData) return [];
    
    // Exclude 'total' from entries if it exists
    let allEntries = Object.entries(sourceData)
      .filter(([key]) => key !== 'total')
      .sort(([a], [b]) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    
    // When searching, slice entries based on current page for client-side pagination
    if (isSearching && allSearchResults) {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      allEntries = allEntries.slice(start, end);
    }
    
    return allEntries;
  }, [data, allSearchResults, debouncedSearchQuery, currentPage, itemsPerPage]);
  
  // Memoize displayTotalEntries and filteredTotalPages
  const displayTotalEntries = useMemo(() => {
    if (debouncedSearchQuery.trim()) {
      // Use searchTotalCount if available, otherwise fall back to entries.length
      return searchTotalCount !== null ? searchTotalCount : entries.length;
    }
    return totalCount;
  }, [debouncedSearchQuery, entries.length, totalCount, searchTotalCount]);
  
  const filteredTotalPages = useMemo(() => {
    return debouncedSearchQuery.trim()
      ? Math.ceil(displayTotalEntries / itemsPerPage)
      : totalPages;
  }, [debouncedSearchQuery, displayTotalEntries, itemsPerPage, totalPages]);

  // Memoize skeleton class calculation for image columns
  // Skeleton sizes match actual rendered image sizes:
  // - Objects: 48px (w-12 h-12) -> h-12 w-12
  // - NPCs: 32px (32x32) -> h-8 w-8  
  // - Items: original size (varies) -> h-8 w-8 (approximate)
  // - Textures: 64px -> h-16 w-16
  const getSkeletonClass = useCallback((col: TableColumn): string => {
    if (col.key !== 'image') return 'h-6 w-20';
    // Check column className to determine actual image size
    // Tailwind sizes: w-16 = 4rem = 64px, w-12 = 3rem = 48px, w-8 = 2rem = 32px
    if (col.className?.includes('w-16')) return 'h-16 w-16'; // Textures: 64px
    if (col.className?.includes('w-12')) return 'h-12 w-12'; // Objects: 48px (w-12 = 3rem = 48px)
    if (col.className?.includes('w-8')) return 'h-8 w-8'; // NPCs: 32px (w-8 = 2rem = 32px)
    if (col.className?.includes('w-auto')) return 'h-8 w-8'; // Items: original size, use 32px skeleton
    return 'h-8 w-8'; // Default fallback
  }, []);

  return (
    <Card className={cn("mx-auto p-4 flex flex-col h-[calc(100vh-20px)]", settings.fullWidthContent ? "max-w-[98%]" : "max-w-7xl")}>
      <CardHeader className="flex flex-col gap-2">
        {title && (
          <CardTitle className="pl-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>{title}</span>
              {infoContent && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setInfoTabOpen(!infoTabOpen)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent 
                      className="max-w-sm p-3 bg-zinc-900 text-white border border-zinc-800 shadow-lg [&>svg]:bg-zinc-900 [&>svg]:fill-zinc-900"
                      sideOffset={5}
                    >
                      {currentMode.help}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {headerAction}
          </CardTitle>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-xl">
            <GamevalIdSearch
              mode={searchMode}
              value={searchMode === 'gameval' ? gamevalInput : searchQuery}
              onValueChange={handleSearchInputChange}
              onModeChange={handleSearchModeChange}
              onEnter={handleSearchEnter}
              onSuggestionSelect={handleSuggestionSelect}
              modeOptions={SEARCH_MODES}
              disabledModes={disabledModes}
              placeholder={placeholder}
              gamevalType={activeGamevalType}
              suggestionLimit={10}
              disableSuggestions={disableSuggestions}
            />
          </div>
          {/* Filters */}
          {filters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
                >
                  Filters
                  {Object.values(filterState).some(v => v) && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                      {Object.values(filterState).filter(v => v).length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filters.map((filter) => (
                  <DropdownMenuItem
                    key={filter.key}
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      setFilterState((prev) => ({ ...prev, [filter.key]: !prev[filter.key] }));
                    }}
                  >
                    <Checkbox
                      id={`filter-${filter.key}`}
                      checked={filterState[filter.key] || false}
                      onCheckedChange={(checked) => {
                        setFilterState((prev) => ({ ...prev, [filter.key]: checked as boolean }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label
                      htmlFor={`filter-${filter.key}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {filter.label}
                    </label>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Download button - far right */}
          {downloadButton && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={downloadButton.onDownload}
                    variant="outline"
                    size="sm"
                    disabled={downloadButton.disabled || hasActiveDownloads(downloadButton.type)}
                    className={cn(
                      "h-10 px-5 font-medium transition-all ml-auto border-2",
                      hasActiveDownloads(downloadButton.type) && "font-semibold"
                    )}
                  >
                    <IconFileDownload size={18} className="mr-2" />
                    {hasActiveDownloads(downloadButton.type) ? 'Downloading...' : (downloadButton.label || 'Download')}
                  </Button>
                </TooltipTrigger>
                {downloadButton.tooltip && (
                  <TooltipContent 
                    className="max-w-sm p-3 bg-zinc-900 text-white border border-zinc-800 shadow-lg [&>svg]:bg-zinc-900 [&>svg]:fill-zinc-900"
                    sideOffset={5}
                  >
                    {downloadButton.tooltip}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {/* Gameval tags */}
        {searchMode === 'gameval' && gamevalTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {gamevalTags.map((tag, idx) => (
              <SearchTag
                key={idx}
                value={tag.value}
                exact={tag.exact}
                onToggle={() => toggleExact(idx)}
                onRemove={() => removeTag(idx)}
              />
            ))}
            <Button
              onClick={clearTags}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive border-muted-foreground/20 hover:border-destructive/50"
              type="button"
            >
              <IconX size={14} className="mr-1" />
              Clear all
            </Button>
          </div>
        )}
        {infoTabOpen && infoContent && (
          <div className="mt-2 p-4 bg-muted rounded-md text-sm">
            {infoContent}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col flex-grow min-h-0">
        {/* Single table with sticky header */}
        <div className="overflow-x-auto overflow-y-auto flex-grow min-h-0 w-full">
          <Table className="w-full">
            <colgroup>
              {tableColumns.map((col) => {
                // Determine column width based on className or default
                let width = 'auto';
                if (col.className?.includes('w-16')) width = '64px';
                else if (col.className?.includes('w-12')) width = '48px';
                else if (col.className?.includes('w-8')) width = '32px';
                else if (col.key === 'image') width = 'auto';
                else if (col.className?.includes('w-32')) width = '128px';
                return <col key={col.key} style={{ width }} />;
              })}
            </colgroup>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                {tableColumns.map((col) => (
                  <TableHead key={col.key}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
            {loading && !data ? (
              // Initial loading skeleton
              Array.from({ length: itemsPerPage }).map((_, i) => (
                <TableRow key={i}>
                  {tableColumns.map((col) => (
                    <TableCell key={col.key} className={`align-middle text-left ${col.className || ''}`}>
                      <Skeleton className={getSkeletonClass(col)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="text-center text-muted-foreground py-8">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              entries.map(([id, spriteData]) => {
                const row = { id, data: spriteData };
                return (
                  <TableRow key={id}>
                    {tableColumns.map((col) => {
                      const cellValue = col.render ? col.render(row) : row.data[col.key as keyof SpriteData];
                      return (
                        <TableCell key={col.key} className={`align-middle text-left ${col.className || ''}`}>
                          {loading && col.key === 'image' ? (
                            <Skeleton className={getSkeletonClass(col)} />
                          ) : (
                            cellValue
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
            </TableBody>
          </Table>
        </div>

      {/* Pagination Controls */}
      {info && totalPages > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-4 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" className="min-w-[2.5rem] px-2 py-1">
                          {itemsPerPage}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>per page</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {amtOptions.map(opt => (
                  <DropdownMenuItem
                    key={opt}
                    onClick={() => {
                      setItemsPerPage(opt);
                      setCurrentPage(1);
                    }}
                    className={itemsPerPage === opt ? 'font-bold' : ''}
                  >
                    {opt}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Custom</DropdownMenuLabel>
                <div className="px-2 py-1">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={itemsPerPage}
                    onChange={e => {
                      let val = parseInt(e.target.value, 10);
                      if (isNaN(val)) val = defaultAmt;
                      setItemsPerPage(Math.max(1, Math.min(90, val)));
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs"
                    style={{ minWidth: 0 }}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              Page {currentPage} of {filteredTotalPages} ({displayTotalEntries} {debouncedSearchQuery.trim() ? 'filtered' : 'total'} entries)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-nowrap justify-end select-none">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage === 1 || loading}
              className="flex items-center justify-center px-2 py-1 select-none"
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>

            {/* Responsive page buttons: more on lg, fewer on md, only first/last on sm, none on xs */}
            <div className="hidden md:flex items-center gap-1 select-none">
              {(() => {
                const pageButtons = [];
                let maxInBetween = 5;

                // Always show first page
                pageButtons.push(
                  <Button key={1} size="sm" variant={currentPage === 1 ? "default" : "outline"} onClick={() => handlePageChange(1)} disabled={loading} className="select-none">
                    1
                  </Button>
                );

                // Always show ellipsis after first page
                pageButtons.push(<span key="start-ellipsis" className="px-1">...</span>);

                // Calculate in-between range
                let inBetweenStart = Math.max(2, Math.min(currentPage - Math.floor(maxInBetween / 2), filteredTotalPages - maxInBetween));
                let inBetweenEnd = Math.min(filteredTotalPages - 1, inBetweenStart + maxInBetween - 1);

                // Adjust if near the start
                if (inBetweenStart <= 2) {
                  inBetweenStart = 2;
                  inBetweenEnd = Math.min(filteredTotalPages - 1, inBetweenStart + maxInBetween - 1);
                }

                // Adjust if near the end
                if (inBetweenEnd >= filteredTotalPages - 1) {
                  inBetweenEnd = filteredTotalPages - 1;
                  inBetweenStart = Math.max(2, inBetweenEnd - maxInBetween + 1);
                }

                // In-between page buttons (never show 1 or filteredTotalPages here)
                for (let i = inBetweenStart; i <= inBetweenEnd; i++) {
                  pageButtons.push(
                    <Button
                      key={i}
                      size="sm"
                      variant={currentPage === i ? "default" : "outline"}
                      onClick={() => handlePageChange(i)}
                      disabled={loading}
                      className="select-none"
                    >
                      {i}
                    </Button>
                  );
                }

                // Always show ellipsis before last page
                pageButtons.push(<span key="end-ellipsis" className="px-1">...</span>);

                // Always show last page if more than 1
                if (filteredTotalPages > 1) {
                  pageButtons.push(
                    <Button key={filteredTotalPages} size="sm" variant={currentPage === filteredTotalPages ? "default" : "outline"} onClick={() => handlePageChange(filteredTotalPages)} disabled={loading} className="select-none">
                      {filteredTotalPages}
                    </Button>
                  );
                }

                return pageButtons;
              })()}
            </div>

            <div className="hidden sm:flex md:hidden items-center gap-1 select-none">
              {/* Only show first/last page buttons, no ellipsis or in-between on sm screens */}
              <Button key={1} size="sm" variant={currentPage === 1 ? "default" : "outline"} onClick={() => handlePageChange(1)} disabled={loading} className="select-none">
                1
              </Button>
              {filteredTotalPages > 1 && (
                <Button key={filteredTotalPages} size="sm" variant={currentPage === filteredTotalPages ? "default" : "outline"} onClick={() => handlePageChange(filteredTotalPages)} disabled={loading} className="select-none">
                  {filteredTotalPages}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage >= filteredTotalPages || loading}
              className="flex items-center justify-center px-2 py-1 select-none"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filteredTotalPages)}
              disabled={currentPage >= filteredTotalPages || loading}
              className="flex items-center justify-center px-2 py-1 select-none"
            >
              <IconChevronRight className="h-4 w-4" />
              <IconChevronRight className="h-4 w-4 -ml-2" />
            </Button>

            <Input
              type="number"
              min={1}
              max={filteredTotalPages}
              value={currentPage}
              onChange={(e) => {
                let val = Number(e.target.value);
                if (val < 1) val = 1;
                if (val > filteredTotalPages) val = filteredTotalPages;
                handlePageChange(val);
              }}
              className="w-16 text-center px-2 py-1"
            />
          </div>
        </div>
      )}
      </CardContent>
    </Card>
  );
}


