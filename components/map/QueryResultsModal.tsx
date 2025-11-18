"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {Button, buttonVariants} from "@/components/ui/button"
import { ChevronLeft, ChevronRight, MapPin, MapPinOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { VariantProps } from "class-variance-authority"

const OBJECT_TYPES: Record<number, string> = {
    0: "WallStraight",
    1: "WallDiagonalCorner",
    2: "WallCorner",
    3: "WallSquareCorner",
    4: "WallDecorStraightNoOffset",
    5: "WallDecorStraightOffset",
    6: "WallDecorDiagonalOffset",
    7: "WallDecorDiagonalNoOffset",
    8: "WallDecorDiagonalBoth",
    9: "WallDiagonal",
    10: "CentrepieceStraight",
    11: "CentrepieceDiagonal",
    12: "RoofStraight",
    13: "RoofDiagonalWithRoofEdge",
    14: "RoofDiagonal",
    15: "RoofCornerConcave",
    16: "RoofCornerConvex",
    17: "RoofFlat",
    18: "RoofEdgeStraight",
    19: "RoofEdgeDiagonalCorner",
    20: "RoofEdgeCorner",
    21: "WallEdgeSquarecorner",
    22: "GroundDecor",
}

export type QueryResultsFormat = "table" | "json" | "list"
export type QueryResultsVariant = "display" | "highlight"

export interface QueryResultsPanelProps {
    results: any[]
    format: QueryResultsFormat
    onFormatChange?: (format: QueryResultsFormat) => void
    onResultClick?: (result: any) => void
    variant?: QueryResultsVariant
    onHighlightIndexChange?: (index: number, result: any) => void
    onMarkAll?: () => void
    onUnmarkAll?: () => void
    onClosePanel?: () => void
    markAllActive?: boolean
    getResultExtras?: (result: any) => { name?: string; imageUrl?: string } | null
    hideTitle?: boolean
}

export function QueryResultsPanel({
    results = [],
    format,
    onFormatChange,
    onResultClick,
    variant = "display",
    onHighlightIndexChange,
    onMarkAll,
    onUnmarkAll,
    onClosePanel,
    markAllActive = false,
    getResultExtras,
    hideTitle = false,
}: QueryResultsPanelProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    useEffect(() => {
        setCurrentIndex(0)
    }, [results])

    // Scroll to active item when currentIndex changes
    useEffect(() => {
        if (variant === 'highlight' && itemRefs.current[currentIndex]) {
            const itemElement = itemRefs.current[currentIndex]
            if (itemElement && scrollAreaRef.current) {
                const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
                if (scrollContainer) {
                    const containerRect = scrollContainer.getBoundingClientRect()
                    const itemRect = itemElement.getBoundingClientRect()
                    const scrollTop = scrollContainer.scrollTop
                    const itemTop = itemRect.top - containerRect.top + scrollTop
                    const itemBottom = itemTop + itemRect.height
                    const containerHeight = scrollContainer.clientHeight
                    
                    // Scroll if item is not fully visible
                    if (itemTop < scrollTop) {
                        scrollContainer.scrollTo({ top: itemTop - 8, behavior: 'smooth' })
                    } else if (itemBottom > scrollTop + containerHeight) {
                        scrollContainer.scrollTo({ top: itemBottom - containerHeight + 8, behavior: 'smooth' })
                    }
                }
            }
        }
    }, [currentIndex, variant])

    const handleFormatChange = (value: string) => {
        if (!onFormatChange) return
        if (value === "table" || value === "json" || value === "list") {
            onFormatChange(value)
        }
    }

    const handleResultSelect = (result: any) => {
        onResultClick?.(result)
    }

    const selectHighlightIndex = (index: number) => {
        if (index < 0 || index >= results.length) return
        setCurrentIndex(index)
        const selected = results[index]
        handleResultSelect(selected)
        onHighlightIndexChange?.(index, selected)
    }

    useEffect(() => {
        if (variant === "highlight" && results.length > 0) {
            selectHighlightIndex(0)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant, results])

    const resolveName = useCallback((result: any) => {
        const extras = getResultExtras?.(result)
        return extras?.name ?? result.gamevalName ?? result.gameval ?? null
    }, [getResultExtras])

    const renderList = () => (
        <div className="space-y-2">
            {results.map((result, index) => {
                const typeName =
                    result.type !== undefined
                        ? OBJECT_TYPES[result.type] || `Type ${result.type}`
                        : "N/A"
                return (
                    <Card
                        key={index}
                        className="transition-colors hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleResultSelect(result)}
                    >
                        <CardContent className="p-3 text-sm flex flex-wrap gap-2">
                            <span className="font-mono">#{index + 1}</span>
                            <span className="font-mono">X: {result.x}</span>
                            <span className="font-mono">Y: {result.y}</span>
                            <span className="font-mono">Z: {result.z}</span>
                            <span className="font-mono">
                                ID: {result.objectId}
                                {resolveName(result) && ` (${resolveName(result)})`}
                            </span>
                            <span>Type: {typeName}</span>
                            {result.orientation !== undefined && (
                                <span className="font-mono">Orientation: {result.orientation}</span>
                            )}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )

    const renderTable = () => (
        <div className="w-full overflow-auto">
            <div className="min-w-max">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>X</TableHead>
                            <TableHead>Y</TableHead>
                            <TableHead>Z</TableHead>
                            <TableHead>Object ID</TableHead>
                            <TableHead>Gameval</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Orientation</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((result, index) => {
                            const typeName =
                                result.type !== undefined
                                    ? OBJECT_TYPES[result.type] || `Type ${result.type}`
                                    : "N/A"
                            return (
                                <TableRow
                                    key={index}
                                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => handleResultSelect(result)}
                                >
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-mono">{result.x}</TableCell>
                                    <TableCell className="font-mono">{result.y}</TableCell>
                                    <TableCell className="font-mono">{result.z}</TableCell>
                                <TableCell className="font-mono">
                                    {result.objectId}
                                </TableCell>
                                    <TableCell className="font-mono">
                                        {resolveName(result) ?? "—"}
                                    </TableCell>
                                    <TableCell>{typeName}</TableCell>
                                    <TableCell className="font-mono">
                                        {result.orientation ?? "N/A"}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    )

    const renderJson = () => (
        <Card>
            <CardContent className="p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(
                        results.map((entry) => ({
                            ...entry,
                            gameval: resolveName(entry),
                        })),
                        null,
                        2
                    )}
                </pre>
            </CardContent>
        </Card>
    )

    const renderHighlight = () => {
        if (results.length === 0) {
            return (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No highlighted objects.
                </div>
            )
        }

        return (
            <div className="space-y-2">
                {results.map((result, index) => {
                    const extras = getResultExtras?.(result)
                    const active = index === currentIndex
                    return (
                        <button
                            key={index}
                            ref={(el) => {
                                itemRefs.current[index] = el
                            }}
                            onClick={() => selectHighlightIndex(index)}
                            className={cn(
                                "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                active
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-transparent hover:border-border hover:bg-accent/50"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <MapPin
                                    className={cn(
                                        "h-4 w-4 mt-0.5",
                                        active ? "text-primary" : "text-muted-foreground"
                                    )}
                                />
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs max-w-full overflow-hidden">
                                    <span className="font-mono">#{index + 1}</span>
                                    <span className="font-mono">
                                        ID: {result.objectId}
                                        {resolveName(result) && ` (${resolveName(result)})`}
                                    </span>
                                    <span className="font-mono">({result.x}, {result.y}, {result.z})</span>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        )
    }

    const renderHighlightControls = () => (
        <div className="flex items-center justify-between gap-3 pt-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => selectHighlightIndex((currentIndex - 1 + results.length) % results.length)}
                disabled={results.length === 0}
                className="flex-1 flex items-center justify-center gap-1"
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
            <span className="text-xs text-muted-foreground">
                {results.length === 0 ? "0 / 0" : `${currentIndex + 1} / ${results.length}`}
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => selectHighlightIndex((currentIndex + 1) % results.length)}
                disabled={results.length === 0}
                className="flex-1 flex items-center justify-center gap-1"
            >
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )

    const renderHighlightActions = () => (
        <div className="flex items-center justify-between gap-2 pt-2">

            <Button
                variant={
                    (markAllActive ? "destructive" : "outline") as VariantProps<typeof buttonVariants>["variant"]
                }
                onClick={() => (markAllActive ? onUnmarkAll?.() : onMarkAll?.())}
                className="flex items-center gap-2"
            >
                {markAllActive ? (
                    <>
                        <MapPinOff className="h-4 w-4"/>
                        <span>Unmark All</span>
                    </>
                ) : (
                    <>
                        <MapPin className="h-4 w-4"/>
                        <span>Mark All</span>
                    </>
                )}
            </Button>


        </div>
    )

    const renderContent = () => {
        if (results.length === 0) {
            return (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No results to display.
                </div>
            )
        }

        if (variant === "highlight") {
            return renderHighlight()
        }

        switch (format) {
            case "list":
                return renderList()
            case "json":
                return renderJson()
            case "table":
            default:
                return renderTable()
        }
    }

    return (
        <div className="flex flex-col h-full gap-3" data-query-results-panel>
            {!hideTitle && (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-base font-semibold">Query Results ({results.length})</h3>
                        <p className="text-xs text-muted-foreground">
                            Click any row to focus the object on the map.
                        </p>
                    </div>
                {variant === "display" && (
                    <>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Display format</span>
                            <Select value={format} onValueChange={handleFormatChange} disabled={!onFormatChange}>
                                <SelectTrigger className="h-8 w-[140px] text-sm text-foreground">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="table" className="text-foreground">Table</SelectItem>
                                    <SelectItem value="list" className="text-foreground">List</SelectItem>
                                    <SelectItem value="json" className="text-foreground">JSON</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Separator />
                    </>
                )}
                {variant === 'highlight' && results.length > 0 && currentIndex >= 0 && results[currentIndex] && (() => {
                    const result = results[currentIndex];
                    const extras = getResultExtras?.(result);
                    const objectName = extras?.name ?? resolveName(result) ?? `Object ${result.objectId}`;
                    const imageUrl = extras?.imageUrl ?? (result.objectId !== undefined 
                        ? `https://chisel.weirdgloop.org/static/img/osrs-object/${result.objectId}_orient${result.orientation ?? 1}.png`
                        : undefined);
                    return (
                        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-sm font-semibold text-foreground">
                                {objectName}
                            </span>
                            {imageUrl && (
                                <div className="mt-1 flex justify-center">
                                    <img
                                        src={imageUrl}
                                        alt={objectName}
                                        className="max-h-32 max-w-full object-contain border rounded"
                                        onError={(event) => {
                                            (event.target as HTMLImageElement).style.display = 'none'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })()}
                </div>
            )}
            <div className="flex-1 min-h-0">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                    <div className="pr-2 pb-2">
                        {renderContent()}
                    </div>
                </ScrollArea>
            </div>
            {variant === "highlight" && (
                <div className="space-y-2 pt-1">
                    {renderHighlightControls()}
                    {renderHighlightActions()}
                </div>
            )}
        </div>
    )
}


