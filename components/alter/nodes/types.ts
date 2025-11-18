import type { GamevalSuggestion } from '@/components/search/GamevalIdSearch';

export type DialogueSpeaker = 'npc' | 'player' | 'option';

export interface OptionEntry {
  id: string;
  title: string;
}

export type ActionType = 'remove_item' | 'add_item' | 'remove_equipment' | 'add_equipment';

export interface DialogueAction {
  id: string;
  type: ActionType;
  itemName: string; // Gameval name
  amount: number;
  containerType?: 'inventory' | 'equipment';
}

export interface ActionNodeData {
  id: string;
  actionType: ActionType;
  itemName: string;
  amount: number;
  containerType: 'inventory' | 'equipment';
  handleOrientation?: 'horizontal' | 'vertical';
  onChange?: (key: 'actionType' | 'itemName' | 'amount' | 'containerType' | 'handleOrientation', value: any) => void;
}

export interface DialogueNodeData {
  id: string;
  speaker: DialogueSpeaker;
  text: string;
  expression?: string;
  npcId?: string;
  title?: string; // Title for NPC nodes
  npcGamevalName?: string; // NPC name from gameval (for display only, not saved to XML)
  options?: OptionEntry[];
  actions?: DialogueAction[];
  handleOrientation?: 'horizontal' | 'vertical';
  order: number;
  groupId?: string; // ID of the group this node belongs to
  onChange?: (
    key: 'text' | 'speaker' | 'expression' | 'npcId' | 'title' | 'handleOrientation' | 'options' | 'actions' | 'groupId',
    value: any
  ) => void;
  onRemoveFromGroup?: () => void; // Callback to remove node from its group
}

export interface NpcMetaNodeData {
  npcGamevalMode: string;
  npcGamevalValue: string;
  onGamevalModeChange?: (mode: string) => void;
  onGamevalValueChange?: (value: string, mode: string) => void;
  onSuggestionSelect?: (suggestion: GamevalSuggestion, mode: string) => void;
}

export interface GroupNodeData {
  id: string;
  groupName: string;
  childNodeIds: string[];
  actions?: DialogueAction[];
  handleOrientation?: 'horizontal' | 'vertical';
  onChange?: (key: 'groupName' | 'childNodeIds' | 'handleOrientation' | 'actions', value: any) => void;
  onAddChild?: (nodeId: string) => void;
  onRemoveChild?: (nodeId: string) => void;
  getAllNodes?: () => Array<{ id: string; type: string; label?: string }>;
}

export interface ContainerItem {
  id: string;
  itemName: string; // Gameval name
  amount: number;
}

export interface ContainerNodeData {
  id: string;
  containerType: 'inventory' | 'equipment';
  items: ContainerItem[]; // Items to check for
  actions?: DialogueAction[];
  handleOrientation?: 'horizontal' | 'vertical';
  onChange?: (key: 'containerType' | 'items' | 'handleOrientation' | 'actions', value: any) => void;
}

export const DIALOGUE_EXPRESSIONS = [
  { label: 'NEUTRAL_DIALOGEXPR', value: '554' },
  { label: 'HAPPY', value: '588' },
  { label: 'CALM', value: '589' },
  { label: 'CALM_CONTINUED', value: '590' },
  { label: 'DEFAULT', value: '591' },
  { label: 'EVIL', value: '592' },
  { label: 'EVIL_CONTINUED', value: '593' },
  { label: 'DELIGHTED_EVIL', value: '594' },
  { label: 'ANNOYED', value: '595' },
  { label: 'DISTRESSED', value: '596' },
  { label: 'DISTRESSED_CONTINUED', value: '597' },
  { label: 'DISORIENTED_LEFT', value: '600' },
  { label: 'DISORIENTED_RIGHT', value: '601' },
  { label: 'UNINTERESTED', value: '602' },
  { label: 'SLEEPY', value: '603' },
  { label: 'PLAIN_EVIL', value: '604' },
  { label: 'LAUGHING', value: '605' },
  { label: 'LAUGHING_2', value: '608' },
  { label: 'LONGER_LAUGHING', value: '606' },
  { label: 'LONGER_LAUGHING_2', value: '607' },
  { label: 'EVIL_LAUGH_SHORT', value: '609' },
  { label: 'SLIGHTLY_SAD', value: '610' },
  { label: 'SAD', value: '599' },
  { label: 'VERY_SAD', value: '611' },
  { label: 'OTHER', value: '612' },
  { label: 'NEAR_TEARS', value: '598' },
  { label: 'NEAR_TEARS_2', value: '613' },
  { label: 'ANGRY_1', value: '614' },
  { label: 'ANGRY_2', value: '615' },
  { label: 'ANGRY_3', value: '616' },
  { label: 'ANGRY_4', value: '617' },
] as const;

export const HANDLE_SIZE_STYLE = { width: 16, height: 16 } as const;

