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
    queryPlaceholder: string;
    filters: { key: string; label: string }[];
    columns: {
        key: string;
        label: string;
        render?: (row: any) => React.ReactNode;
    }[];
    name?: string;
}

export default function SearchTable({
                                        name,
                                        baseUrl,
                                        queryPlaceholder,
                                        filters,
                                        columns,
                                    }: SearchTableProps) {
    const [query, setQuery] = useState("");
    const [searchMode, setSearchMode] = useState("gameval");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSkeletons, setShowSkeletons] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [total, setTotal] = useState(0);

    function getNestedValue(obj: any, path: string, fallback = "-") {
        if (!path.includes(".")) {
            return obj?.[path] ?? fallback;
        }

        const secondKey = path.split(".")[1];
        return String(obj.extraData?.[secondKey] ?? fallback);
    }

    const [filterState, setFilterState] = useState<Record<string, boolean>>(
        Object.fromEntries(filters.map((f) => [f.key, false]))
    );

    const limit = 13;
    const totalPages = Math.ceil(total / limit);

    const fetchData = async () => {
        if (!query) {
            setResults([]);
            setTotal(0);
            return;
        }

        setLoading(true);

        const url = buildUrl(baseUrl, {
            q: query,
            mode: searchMode,
            amt: limit,
            offset: (page - 1) * limit,
            ...filterState,
        });

        try {
            const res = await fetch(url);
            console.log(url);
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

    useEffect(() => {
        fetchData();
    }, [query, page, searchMode, filterState]);

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
            : queryPlaceholder;

    return (
        <Card className="max-w-7xl mx-auto p-4">
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
                                    {SEARCH_MODES.find((m) => m.value === searchMode)?.label ??
                                        searchMode}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="start" className="mt-1">
                                {SEARCH_MODES.map((mode) => (
                                    <DropdownMenuItem
                                        key={mode.value}
                                        onClick={() => {
                                            setSearchMode(mode.value);
                                            setPage(1);
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

            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
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
