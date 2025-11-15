"use client";

import { memo } from "react";
import { NodeProps } from "reactflow";
import { DialogueNodeBase } from "./DialogueNodeBase";
import { DialogueNodeData } from "./types";

export const PlayerDialogueNode = memo(function PlayerDialogueNode(
  props: NodeProps<DialogueNodeData>
) {
  return <DialogueNodeBase {...props} variant="player" />;
});

