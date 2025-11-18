"use client";

import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";
import { GamevalIdSearch } from "@/components/search/GamevalIdSearch";
import { GamevalType } from "@/lib/gamevals/types";
import { HANDLE_SIZE_STYLE, NpcMetaNodeData } from "./types";

export const NpcMetaNode = memo(function NpcMetaNode({ data }: NodeProps<NpcMetaNodeData>) {
  return (
    <div className="rounded-xl border-2 border-primary/50 bg-background px-4 py-3 shadow-md min-w-[260px]">
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary"
        style={HANDLE_SIZE_STYLE}
      />
      <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-2">
        NPC Metadata
      </p>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">NPC gameval</label>
        <GamevalIdSearch
          mode="gameval"
          value={data.npcGamevalValue}
          onModeChange={() => {}}
          disabledModes={["id"]}
          onValueChange={(value, mode) => data.onGamevalValueChange?.(value, mode)}
          onSuggestionSelect={(suggestion, mode) =>
            data.onSuggestionSelect?.(suggestion, mode)
          }
          gamevalType={GamevalType.NPCS}
          className="text-sm"
        />
      </div>
    </div>
  );
});


