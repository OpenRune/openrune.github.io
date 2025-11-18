"use client";

import { memo, useCallback, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconBox, IconArrowsSort, IconAdjustmentsHorizontal, IconX, IconPlus } from "@tabler/icons-react";
import { GamevalIdSearch } from "@/components/search/GamevalIdSearch";
import { GamevalType } from "@/lib/gamevals/types";
import { cn } from "@/lib/utils";
import { ContainerNodeData, HANDLE_SIZE_STYLE, ContainerItem } from "./types";

export const ContainerNode = memo(function ContainerNode({ data, selected }: NodeProps<ContainerNodeData>) {
  const handleOrientation = data.handleOrientation ?? "horizontal";
  const [modalOpen, setModalOpen] = useState(false);
  const items = data.items ?? [];
  const containerType = data.containerType ?? 'inventory';

  const setOrientation = useCallback(
    (orientation: "horizontal" | "vertical") => data.onChange?.("handleOrientation", orientation),
    [data]
  );

  const targetHandlePosition =
    handleOrientation === "horizontal" ? Position.Left : Position.Top;
  const sourceHandlePosition =
    handleOrientation === "horizontal" ? Position.Right : Position.Bottom;

  const targetHandleStyle =
    handleOrientation === "horizontal"
      ? HANDLE_SIZE_STYLE
      : { ...HANDLE_SIZE_STYLE, left: "50%", transform: "translate(-50%, -50%)" };

  const sourceHandleStyle =
    handleOrientation === "horizontal"
      ? HANDLE_SIZE_STYLE
      : { ...HANDLE_SIZE_STYLE, left: "50%", transform: "translate(-50%, 50%)" };

  const handleAddItem = useCallback(() => {
    const newItem: ContainerItem = {
      id: `item_${Date.now()}`,
      itemName: '',
      amount: 1,
    };
    data.onChange?.('items', [...items, newItem]);
  }, [data, items]);

  const handleRemoveItem = useCallback((itemId: string) => {
    data.onChange?.('items', items.filter((item) => item.id !== itemId));
  }, [data, items]);

  const handleItemChange = useCallback((itemId: string, key: 'itemName' | 'amount', value: string | number) => {
    const updated = items.map((item) =>
      item.id === itemId ? { ...item, [key]: value } : item
    );
    data.onChange?.('items', updated);
  }, [data, items]);

  const accent = containerType === 'inventory' ? "#8b5cf6" : "#ec4899";

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-shadow",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
      style={{ borderColor: accent }}
    >
      <Handle
        type="target"
        position={targetHandlePosition}
        className="!bg-foreground !opacity-70"
        style={targetHandleStyle}
      />
      <div className="flex items-center justify-between gap-2 pb-2 text-sm font-semibold">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          <IconBox size={16} />
          <span className="capitalize">{containerType}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            title="Container settings"
            onClick={() => setModalOpen(true)}
          >
            <IconAdjustmentsHorizontal size={14} />
            Options
          </button>
          <ContextMenu>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-md border border-border text-muted-foreground transition hover:bg-muted flex items-center justify-center"
                    aria-label="Handle orientation menu"
                    onClick={(event) => {
                      event.preventDefault();
                      data.onChange?.(
                        "handleOrientation",
                        handleOrientation === "horizontal" ? "vertical" : "horizontal"
                      );
                    }}
                  >
                    <IconArrowsSort size={16} />
                  </button>
                </ContextMenuTrigger>
                <TooltipContent side="bottom">Handle orientation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ContextMenuContent align="end" className="w-36">
              <ContextMenuItem onClick={() => setOrientation("horizontal")}>
                Left / Right
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setOrientation("vertical")}>
                Top / Bottom
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Check for:</div>
            {items.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs px-2 py-1 rounded-md bg-muted/50"
              >
                <span className="truncate flex-1">{item.itemName || 'Unnamed item'}</span>
                <span className="text-muted-foreground ml-2">x{item.amount}</span>
              </div>
            ))}
            {items.length > 2 && (
              <div className="text-xs text-muted-foreground text-center">
                +{items.length - 2} more
              </div>
            )}
          </div>
        )}
        {items.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleAddItem}
          >
            <IconPlus size={12} className="mr-1" />
            Add Check Item
          </Button>
        )}
      </div>
      {/* Two output handles: true (has items) and false (doesn't have items) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!bg-green-500"
        style={{
          ...HANDLE_SIZE_STYLE,
          right: "-12px",
          top: "25%",
          transform: "translateY(-50%)",
        }}
      />
      <div
        className="absolute text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap pointer-events-none z-10"
        style={{
          right: "-48px",
          top: "25%",
          transform: "translateY(-50%)",
        }}
      >
        True
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!bg-red-500"
        style={{
          ...HANDLE_SIZE_STYLE,
          right: "-12px",
          top: "75%",
          transform: "translateY(-50%)",
        }}
      />
      <div
        className="absolute text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap pointer-events-none z-10"
        style={{
          right: "-52px",
          top: "75%",
          transform: "translateY(-50%)",
        }}
      >
        False
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Container Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Container Type
              </label>
              <Select
                value={containerType}
                onValueChange={(value) => data.onChange?.("containerType", value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Items to Check
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7"
                >
                  <IconPlus size={14} />
                  Add Item
                </Button>
              </div>
              <ScrollArea className="h-64 pr-2 border rounded-lg">
                <div className="space-y-2 py-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items to check
                    </p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 p-2 rounded-md bg-muted/30"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Item Name
                            </label>
                            <GamevalIdSearch
                              mode="gameval"
                              value={item.itemName}
                              onModeChange={() => {}}
                              disabledModes={["id"]}
                              onValueChange={(value) => handleItemChange(item.id, 'itemName', value)}
                              onSuggestionSelect={(suggestion) => {
                                handleItemChange(item.id, 'itemName', suggestion.name);
                                return true;
                              }}
                              gamevalType={GamevalType.ITEMS}
                              className="text-xs"
                              inputClassName="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Amount
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={item.amount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) {
                                  handleItemChange(item.id, 'amount', val);
                                }
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 mt-6"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <IconX size={14} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

