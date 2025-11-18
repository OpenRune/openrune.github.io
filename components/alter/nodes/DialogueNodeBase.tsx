"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { IconAdjustmentsHorizontal, IconArrowsSort, IconMessageCircle2, IconUser, IconX } from "@tabler/icons-react";
import { GamevalIdSearch } from "@/components/search/GamevalIdSearch";
import { GamevalType } from "@/lib/gamevals/types";
import { cn } from "@/lib/utils";
import { DialogueNodeData, DIALOGUE_EXPRESSIONS, HANDLE_SIZE_STYLE } from "./types";

type DialogueNodeBaseProps = NodeProps<DialogueNodeData> & {
  variant: "npc" | "player";
};

export const DialogueNodeBase = memo(function DialogueNodeBase({
  data,
  selected,
  variant,
}: DialogueNodeBaseProps) {
  const isNpc = variant === "npc";
  const accent = isNpc ? "#f97316" : "#3b82f6";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const handleOrientation = data.handleOrientation ?? "horizontal";

  const setOrientation = useCallback(
    (orientation: "horizontal" | "vertical") => data.onChange?.("handleOrientation", orientation),
    [data]
  );

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, data.text]);

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
        position={handleOrientation === "horizontal" ? Position.Left : Position.Top}
        className="!bg-foreground !opacity-70"
        style={
          handleOrientation === "horizontal"
            ? HANDLE_SIZE_STYLE
            : { ...HANDLE_SIZE_STYLE, left: "50%", transform: "translate(-50%, -50%)" }
        }
      />
      <div className="flex items-center justify-between gap-2 pb-2 text-sm font-semibold">
        <div className="flex items-center gap-2" style={{ color: accent }}>
          {isNpc ? <IconMessageCircle2 size={16} /> : <IconUser size={16} />}
          <span>{isNpc ? (data.npcId || data.title || data.npcGamevalName || "NPC") : (data.title || "Player")}</span>
        </div>
        <div className="flex items-center gap-1">
          {data.groupId && data.onRemoveFromGroup && (
            <button
              type="button"
              className="h-6 w-6 rounded-md border border-border text-muted-foreground transition hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
              title="Remove from group"
              onClick={(e) => {
                e.stopPropagation();
                data.onRemoveFromGroup?.();
              }}
            >
              <IconX size={12} />
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            title="Node options"
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
      <div className="mb-2 space-y-1 text-xs text-muted-foreground">
        {data.expression && data.expression !== DIALOGUE_EXPRESSIONS.find((e) => e.label === 'HAPPY')?.value && (
          <p>
            Expression:{" "}
            {DIALOGUE_EXPRESSIONS.find((expr) => expr.value === data.expression)?.label ??
              data.expression}
          </p>
        )}
        {isNpc && data.npcId && (
          <p>
            NPC Override: <span className="font-mono text-foreground">{data.npcId}</span>
          </p>
        )}
      </div>
      <textarea
        ref={textareaRef}
        rows={1}
        className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm font-mono leading-snug text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
        value={data.text}
        onChange={(event) => {
          data.onChange?.("text", event.target.value);
          resizeTextarea();
        }}
      />
      <Handle
        type="source"
        position={handleOrientation === "horizontal" ? Position.Right : Position.Bottom}
        className="!bg-foreground !opacity-70"
        style={
          handleOrientation === "horizontal"
            ? HANDLE_SIZE_STYLE
            : { ...HANDLE_SIZE_STYLE, left: "50%", transform: "translate(-50%, 50%)" }
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNpc ? "NPC" : "Player"} Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Response Type</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isNpc ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => data.onChange?.("speaker", "npc")}
                >
                  Npc
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!isNpc ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => data.onChange?.("speaker", "player")}
                >
                  Player
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Dialogue Expression
              </p>
              <ScrollArea className="h-48 pr-2 border rounded-lg">
                <div className="space-y-1 py-2">
                  {DIALOGUE_EXPRESSIONS.map((expr) => {
                    const isSelected = data.expression === expr.value;
                    return (
                      <Button
                        key={expr.value}
                        type="button"
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-between font-normal"
                        onClick={() => data.onChange?.("expression", expr.value)}
                      >
                        <span className="text-left">{expr.label}</span>
                        <span className="text-xs text-muted-foreground">{expr.value}</span>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Title
              </p>
              <input
                type="text"
                value={data.title ?? ""}
                onChange={(e) => data.onChange?.("title", e.target.value)}
                className="w-full rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={isNpc ? "NPC title (optional)" : "Player title (optional)"}
              />
            </div>
            {isNpc && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  NPC ID Override
                </p>
                <GamevalIdSearch
                  mode="gameval"
                  value={data.npcId ?? ""}
                  onModeChange={() => {}}
                  disabledModes={["id"]}
                  onValueChange={(value) => data.onChange?.("npcId", value)}
                  onSuggestionSelect={(suggestion) => {
                    data.onChange?.("npcId", suggestion.name);
                    return true;
                  }}
                  gamevalType={GamevalType.NPCS}
                  className="text-xs"
                  inputClassName="h-9 text-xs"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

