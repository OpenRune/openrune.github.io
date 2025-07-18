"use client";

import React, { useEffect, useState } from "react";
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
        <Card className="max-w-7xl mx-auto p-4 h-screen flex flex-col">
            <CardHeader className="flex flex-col gap-2">
                <CardTitle className="pl-1">{name} Search</CardTitle>

                <div className="flex items-center w-full gap-2">
                    <div className="relative flex items-center w-[505px]">
                        <Input
                            placeholder={placeholder}
                            value={query}
                            onChange={(e) => {
                                setPage(1);
                                setQuery(e.target.value);
                            }}
                            className="pr-14"
                        />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 min-w-[90px] rounded-l-none flex items-center justify-center"
                                >
                                    {SEARCH_MODES.find((m) => m.value === searchMode)?.label ?? searchMode}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="start" className="mt-1">
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

                    <div className="flex-grow" />

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

            <CardContent className="flex flex-col flex-grow">
                {/* Separate header table */}
                <div className="overflow-x-auto">
                    <Table className="table-fixed">
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                    </Table>
                </div>

                {/* Scrollable body table */}
                <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
                    <Table className="table-fixed">
                        <TableBody>
                            {loading && showSkeletons ? (
                                <>
                                    {[...Array(limit)].map((_, i) => (
                                        <TableRow key={`skeleton-${i}`}>
                                            {columns.map((col) => (
                                                <TableCell key={col.key}>
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
                                            <TableCell key={col.key}>
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
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                                disabled={page === totalPages}
                                className="flex items-center justify-center"
                            >
                                Next
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
