"use client";

import { GripVerticalIcon } from "lucide-react";
import {
  Group as ResizablePrimitiveGroup,
  Panel as ResizablePrimitivePanel,
  Separator as ResizablePrimitiveSeparator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <ResizablePrimitiveGroup
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({ className, ...props }: PanelProps) {
  return <ResizablePrimitivePanel data-slot="resizable-panel" className={cn(className)} {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <ResizablePrimitiveSeparator
      data-slot="resizable-handle"
      className={cn(
        "group/handle bg-border relative flex shrink-0 items-center justify-center",
        // Horizontal group → vertical bar between side-by-side panels
        "aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-px",
        "aria-[orientation=vertical]:after:absolute aria-[orientation=vertical]:after:inset-y-0 aria-[orientation=vertical]:after:left-1/2 aria-[orientation=vertical]:after:w-3 aria-[orientation=vertical]:after:-translate-x-1/2",
        // Vertical group → horizontal bar between stacked panels
        "aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full",
        "aria-[orientation=horizontal]:after:absolute aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-3 aria-[orientation=horizontal]:after:-translate-y-1/2",
        "hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="bg-border z-10 flex h-6 w-3 items-center justify-center rounded-sm border shadow-sm group-aria-[orientation=horizontal]/handle:h-3 group-aria-[orientation=horizontal]/handle:w-6">
          <GripVerticalIcon className="size-2.5 text-muted-foreground group-aria-[orientation=horizontal]/handle:rotate-90" />
        </div>
      ) : null}
    </ResizablePrimitiveSeparator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
