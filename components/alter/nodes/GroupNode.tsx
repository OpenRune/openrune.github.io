"use client";

import { memo, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconFolder, IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { GroupNodeData, HANDLE_SIZE_STYLE } from "./types";

export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps<GroupNodeData>) {
  const handleOrientation = data.handleOrientation ?? "horizontal";
  const [modalOpen, setModalOpen] = useState(false);
  
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

  // Calculate container size based on child nodes
  // Note: width and height are managed by ReactFlow for group nodes
  const containerWidth = 400;
  const containerHeight = 300;

  return (
    <>
      <div
        className={cn(
          "rounded-xl border-2 bg-background/95 shadow-lg backdrop-blur-sm transition-shadow",
          selected && "ring-2 ring-primary ring-offset-1"
        )}
        style={{ 
          borderColor: "#10b981",
          width: containerWidth,
          height: containerHeight,
          minWidth: 400,
          minHeight: 300,
          padding: "12px",
          position: "relative",
        }}
      >
        <Handle
          type="target"
          position={targetHandlePosition}
          className="!bg-foreground !opacity-70"
          style={targetHandleStyle}
        />
        <div className="flex items-center justify-between gap-2 text-sm font-semibold mb-2">
          <div className="flex items-center gap-2 text-emerald-500">
            <IconFolder size={16} />
            <span>Group</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={data.groupName || ""}
              onChange={(event) => data.onChange?.("groupName", event.target.value)}
              placeholder="Enter group name..."
              className="h-7 text-sm flex-1 max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
              title="Group options"
              onClick={() => setModalOpen(true)}
            >
              <IconAdjustmentsHorizontal size={14} />
              Options
            </button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.childNodeIds?.length || 0} node{data.childNodeIds?.length !== 1 ? "s" : ""} in group
        </div>
        <Handle
          type="source"
          position={sourceHandlePosition}
          className="!bg-foreground !opacity-70"
          style={sourceHandleStyle}
        />
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Group Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Group Name
              </label>
              <Input
                value={data.groupName || ""}
                onChange={(event) => data.onChange?.("groupName", event.target.value)}
                placeholder="Enter group name..."
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

