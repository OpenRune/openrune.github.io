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
import { IconAdjustmentsHorizontal, IconArrowsSort, IconListDetails } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DialogueNodeData, HANDLE_SIZE_STYLE, OptionEntry } from "./types";

export const OptionNode = memo(function OptionNode({ data, selected }: NodeProps<DialogueNodeData>) {
  const options = data.options ?? [];
  const handleOrientation = data.handleOrientation ?? "horizontal";
  const [modalOpen, setModalOpen] = useState(false);
  const setOrientation = useCallback(
    (orientation: "horizontal" | "vertical") => data.onChange?.("handleOrientation", orientation),
    [data]
  );

  const targetHandlePosition =
    handleOrientation === "horizontal" ? Position.Left : Position.Top;
  const targetHandleStyle =
    handleOrientation === "horizontal"
      ? HANDLE_SIZE_STYLE
      : { ...HANDLE_SIZE_STYLE, left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-shadow",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
    >
      <Handle
        type="target"
        position={targetHandlePosition}
        className="!bg-foreground !opacity-70"
        style={targetHandleStyle}
      />
      <div className="flex items-center justify-between gap-2 pb-2 text-sm font-semibold">
        <div className="flex items-center gap-2 text-purple-500">
          <IconListDetails size={16} />
          <span>{data.text?.trim() || "Options"}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            title="Option settings"
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
                    aria-label="Option handle orientation menu"
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
                <TooltipContent side="bottom">Handle direction</TooltipContent>
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
      <div className="space-y-3">
        {options.map((option, idx) => (
          <div key={option.id} className="relative pr-6">
            <Input
              value={option.title}
              onChange={(event) =>
                data.onChange?.("options", { id: option.id, title: event.target.value })
              }
              className="h-8 text-sm w-full"
              placeholder={`Option ${idx + 1}`}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={option.id}
              className="!bg-purple-500"
              style={{ ...HANDLE_SIZE_STYLE, right: "-12px", top: "50%", transform: "translateY(-50%)" }}
            />
          </div>
        ))}
        {options.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => data.onChange?.("options", "add")}
          >
            Add option
          </Button>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Option Node Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Node Title (optional)
              </label>
              <Input
                value={data.text ?? ""}
                placeholder="Options title"
                onChange={(event) => data.onChange?.("text", event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Options</div>
              <div className="space-y-2">
                {options.map((option, idx) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.title}
                      onChange={(event) =>
                        data.onChange?.("options", { id: option.id, title: event.target.value })
                      }
                      className="h-8 text-sm"
                      placeholder={`Option ${idx + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      onClick={() => data.onChange?.("options", { id: option.id, action: "remove" })}
                      disabled={options.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              {options.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => data.onChange?.("options", "add")}
                >
                  Add option
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

