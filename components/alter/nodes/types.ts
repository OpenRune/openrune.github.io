import type { GamevalSuggestion } from '@/components/search/GamevalIdSearch';

export type DialogueSpeaker = 'npc' | 'player' | 'option';

export interface OptionEntry {
  id: string;
  title: string;
}

export interface DialogueNodeData {
  id: string;
  speaker: DialogueSpeaker;
  text: string;
  expression?: string;
  npcId?: string;
  npcLabel?: string;
  options?: OptionEntry[];
  handleOrientation?: 'horizontal' | 'vertical';
  order: number;
  onChange?: (
    key: 'text' | 'speaker' | 'expression' | 'npcId' | 'handleOrientation' | 'options',
    value: any
  ) => void;
}

export interface NpcMetaNodeData {
  npcGamevalMode: string;
  npcGamevalValue: string;
  onGamevalModeChange?: (mode: string) => void;
  onGamevalValueChange?: (value: string, mode: string) => void;
  onSuggestionSelect?: (suggestion: GamevalSuggestion, mode: string) => void;
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

