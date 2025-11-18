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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconAdjustmentsHorizontal, IconArrowsSort, IconBox, IconX } from "@tabler/icons-react";
import { GamevalIdSearch } from "@/components/search/GamevalIdSearch";
import { GamevalType } from "@/lib/gamevals/types";
import { cn } from "@/lib/utils";
import { ActionNodeData, HANDLE_SIZE_STYLE, ActionType } from "./types";

export const ActionNode = memo(function ActionNode({ data, selected }: NodeProps<ActionNodeData>) {
  const handleOrientation = data.handleOrientation ?? "horizontal";
  const [modalOpen, setModalOpen] = useState(false);
  const actionType = data.actionType ?? 'remove_item';
  const itemName = data.itemName ?? '';
  const amount = data.amount ?? 1;
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

  const getActionLabel = (type: ActionType) => {
    switch (type) {
      case 'remove_item':
        return 'Remove Item';
      case 'add_item':
        return 'Add Item';
      case 'remove_equipment':
        return 'Remove Equipment';
      case 'add_equipment':
        return 'Add Equipment';
      default:
        return 'Action';
    }
  };

  const getActionColor = (type: ActionType) => {
    if (type.includes('equipment')) {
      return '#ec4899';
    }
    return '#8b5cf6';
  };

  const accent = getActionColor(actionType);

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
          <span>{getActionLabel(actionType)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            title="Action settings"
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
        {itemName && (
          <div className="text-xs px-2 py-1 rounded-md bg-muted/50">
            <span className="truncate">{itemName}</span>
            {amount > 1 && (
              <span className="text-muted-foreground ml-2">x{amount}</span>
            )}
          </div>
        )}
        {!itemName && (
          <div className="text-xs text-muted-foreground italic">
            No item configured
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={sourceHandlePosition}
        className="!bg-foreground !opacity-70"
        style={sourceHandleStyle}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Action Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Action Type
              </label>
              <Select
                value={actionType}
                onValueChange={(value: ActionType) => {
                  const newContainerType = value.includes('equipment') ? 'equipment' : 'inventory';
                  data.onChange?.("actionType", value);
                  data.onChange?.("containerType", newContainerType);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove_item">Remove Item (Inventory)</SelectItem>
                  <SelectItem value="add_item">Add Item (Inventory)</SelectItem>
                  <SelectItem value="remove_equipment">Remove Equipment</SelectItem>
                  <SelectItem value="add_equipment">Add Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Item Name
              </label>
              <GamevalIdSearch
                mode="gameval"
                value={itemName}
                onModeChange={() => {}}
                disabledModes={["id"]}
                onValueChange={(value) => data.onChange?.("itemName", value)}
                onSuggestionSelect={(suggestion) => {
                  data.onChange?.("itemName", suggestion.name);
                  return true;
                }}
                gamevalType={GamevalType.ITEMS}
                className="text-xs"
                inputClassName="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Amount
              </label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) {
                    data.onChange?.("amount", val);
                  }
                }}
                className="h-9"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});


