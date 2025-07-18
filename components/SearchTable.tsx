"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { buildUrl } from "@/lib/api/apiClient";

const SEARCH_MODES = [
    { value: "name", label: "Name" },
    { value: "id", label: "ID" },
    { value: "gameval", label: "Gameval" },
    { value: "regex", label: "Regex" },
];

interface SearchTableProps {
    baseUrl: string;
    filters?: { key: string; label: string }[];
    columns: {
        key: string;
        label: string;
        render?: (row: any) => React.ReactNode;
    }[];
    name?: string;
    disabledModes?: string[];
    defaultSearchMode?: string;
}

export default function SearchTable({
                                        name,
                                        baseUrl,
                                        filters = [],
                                        disabledModes = [],
                                        defaultSearchMode = "gameval",
                                        columns,
                                    }: SearchTableProps) {
    const [query, setQuery] = useState("");
    const [searchMode, setSearchMode] = useState(defaultSearchMode);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSkeletons, setShowSkeletons] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [firstRender, setFirstRender] = useState(true);

    function getNestedValue(obj: any, path: string, fallback = "-") {
        if (!path.includes(".")) {
            return obj?.[path] ?? fallback;
        }

        const secondKey = path.split(".")[1];
        return String(obj.extraData?.[secondKey] ?? fallback);
    }

    const [filterState, setFilterState] = useState<Record<string, boolean>>(
        filters.length > 0
            ? Object.fromEntries(filters.map((f) => [f.key, false]))
            : {}
    );

    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    const fetchData = async (isInitial = false) => {
        setLoading(true);

        const activeFilters = Object.entries(filterState)
            .filter(([_, isOn]) => isOn)
            .map(([key]) => key);

        const params: Record<string, any> = {
            amt: limit,
            offset: (page - 1) * limit,
            filters: activeFilters.join(","),
        };

        if (!(searchMode === "id" && query === "")) {
            params.q = query;
            params.mode = searchMode;
        }

        const url = buildUrl(baseUrl, params);

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setResults(data.results);
            setTotal(data.total);
        } catch {
            toast.error("Failed to fetch objects.");
        } finally {
            setLoading(false);
        }
    };

    // On first render, fetch initial data from baseUrl without params
    useEffect(() => {
        fetchData(true);
        setFirstRender(false);
    }, []);

    // On subsequent query/filter/page/searchMode changes, fetch filtered data
    useEffect(() => {
        if (firstRender) return; // skip fetch on first render here

        fetchData();
    }, [query, page, searchMode, filterState]);

    // Show skeletons only after 500ms loading delay
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (loading) {
            timeout = setTimeout(() => {
                setShowSkeletons(true);
            }, 500);
        } else {
            setShowSkeletons(false);
        }
        return () => clearTimeout(timeout);
    }, [loading]);

    const placeholder =
        searchMode === "id"
            ? 'ID search (e.g. "10 + 100" supported)'
            : '';

    return (
        <Card className="max-w-7xl mx-auto p-4 flex flex-col h-[calc(100vh-20px)]">
            <CardHeader className="flex flex-col gap-2">
                <CardTitle className="pl-1">{name} Search</CardTitle>

                <div className="flex items-center w-full">
                    <div className="relative flex items-center w-[505px]">
                        <Input
                            placeholder={placeholder}
                            value={query}
                            onChange={(e) => {
                                setPage(1);
                                setQuery(e.target.value);
                            }}
                            className="pr-20"
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="absolute right-0 top-1/2 -translate-y-1/2 h-8 px-3 min-w-[90px] rounded-l-none flex items-center justify-center border-l"
                                >
                                    {SEARCH_MODES.find((m) => m.value === searchMode)?.label ?? searchMode}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="end" className="mt-1">
                                {SEARCH_MODES.map((mode) => (
                                    <DropdownMenuItem
                                        key={mode.value}
                                        disabled={disabledModes.includes(mode.value)}
                                        onClick={() => {
                                            if (!disabledModes.includes(mode.value)) {
                                                setSearchMode(mode.value);
                                                setPage(1);
                                            }
                                        }}
                                    >
                                        {mode.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {filters.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="min-w-[130px] flex items-center justify-center"
                                >
                                    Filters
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {filters.map((filter) => (
                                    <DropdownMenuItem
                                        key={filter.key}
                                        onClick={() =>
                                            setFilterState((prev) => ({
                                                ...prev,
                                                [filter.key]: !prev[filter.key],
                                            }))
                                        }
                                    >
                                        <input
                                            type="checkbox"
                                            checked={filterState[filter.key]}
                                            readOnly
                                            className="mr-2"
                                        />
                                        {filter.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-grow min-h-0">
                {/* Table header only */}
                <div>
                    <Table className="table-fixed">
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col.key} className={`align-middle ${col.key === 'view' ? 'text-right pr-8' : 'text-left'}`}>{col.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                    </Table>
                </div>

                {/* Scrollable table body only */}
                <div className="overflow-x-auto overflow-y-scroll flex-grow min-h-0 mt-0">
                    <Table className="table-fixed">
                        <TableBody>
                            {loading && showSkeletons ? (
                                <>
                                    {[...Array(limit)].map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            {columns.map((col) => (
                                                <TableCell key={col.key} className="align-middle text-left">
                                                    <Skeleton className="h-6 w-20" />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </>
                            ) : !loading && results.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="text-center py-6">
                                        No results found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                results.map((row, i) => (
                                    <TableRow key={row.id ?? i}>
                                        {columns.map((col) => (
                                            <TableCell key={col.key} className={`align-middle ${col.key === 'view' ? 'text-right' : 'text-left'}`}>
                                                {col.render ? col.render(row) : getNestedValue(row, col.key)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 0 && (
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            Page {page} of {totalPages} ({total} results)
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                                disabled={page === 1}
                                className="flex items-center justify-center"
                                variant="outline"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            {/* Page number buttons: always show min (1) and max (totalPages), always show ellipsis after 1 and before max, in-between buttons fixed */}
                            {(() => {
                                const pageButtons = [];
                                const maxInBetween = 4;
                                // Always show first page
                                pageButtons.push(
                                    <Button key={1} size="sm" variant={page === 1 ? "default" : "outline"} onClick={() => setPage(1)}>{1}</Button>
                                );
                                // Always show ellipsis after first page
                                pageButtons.push(<span key="start-ellipsis" className="px-1">...</span>);
                                // Calculate in-between range
                                let inBetweenStart = Math.max(2, Math.min(page - Math.floor(maxInBetween / 2), totalPages - maxInBetween));
                                let inBetweenEnd = Math.min(totalPages - 1, inBetweenStart + maxInBetween - 1);
                                // Adjust if near the start
                                if (inBetweenStart <= 2) {
                                    inBetweenStart = 2;
                                    inBetweenEnd = Math.min(totalPages - 1, inBetweenStart + maxInBetween - 1);
                                }
                                // Adjust if near the end
                                if (inBetweenEnd >= totalPages - 1) {
                                    inBetweenEnd = totalPages - 1;
                                    inBetweenStart = Math.max(2, inBetweenEnd - maxInBetween + 1);
                                }
                                // In-between page buttons (never show 1 or totalPages here)
                                for (let i = inBetweenStart; i <= inBetweenEnd; i++) {
                                    pageButtons.push(
                                        <Button
                                            key={i}
                                            size="sm"
                                            variant={page === i ? "default" : "outline"}
                                            onClick={() => setPage(i)}
                                        >
                                            {i}
                                        </Button>
                                    );
                                }
                                // Always show ellipsis before last page
                                pageButtons.push(<span key="end-ellipsis" className="px-1">...</span>);
                                // Always show last page if more than 1
                                if (totalPages > 1) {
                                    pageButtons.push(
                                        <Button key={totalPages} size="sm" variant={page === totalPages ? "default" : "outline"} onClick={() => setPage(totalPages)}>{totalPages}</Button>
                                    );
                                }
                                return pageButtons;
                            })()}
                            <Button
                                size="sm"
                                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                disabled={page === totalPages}
                                className="flex items-center justify-center"
                                variant="outline"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={page}
                                onChange={(e) => {
                                    let val = Number(e.target.value);
                                    if (val < 1) val = 1;
                                    if (val > totalPages) val = totalPages;
                                    setPage(val);
                                }}
                                className="w-16 text-center"
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
