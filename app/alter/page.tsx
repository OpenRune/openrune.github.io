// @ts-nocheck
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  IconFileCode,
  IconMessage2,
  IconMessageCircle2,
  IconListDetails,
  IconTrash,
  IconUser,
  IconFolder,
  IconBox,
} from '@tabler/icons-react';
import type { GamevalSuggestion } from '@/components/search/GamevalIdSearch';
import {
  DialogueNodeData,
  DialogueSpeaker,
  OptionEntry,
  NpcMetaNodeData,
  GroupNodeData,
  ContainerNodeData,
  ActionNodeData,
  DIALOGUE_EXPRESSIONS,
  NpcDialogueNode,
  PlayerDialogueNode,
  OptionNode,
  NpcMetaNode,
  GroupNode,
  ContainerNode,
  ActionNode,
} from '@/components/alter/nodes';
import { create } from 'xmlbuilder2';
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node as ReactFlowNode,
  NodeTypes,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DialogueBlock = {
  id: string;
  speaker: DialogueSpeaker;
  text: string;
  expression?: string;
  npcId?: string;
  options?: OptionEntry[];
};

type DialogueBlockEditorProps = {
  onBlocksChange?: (blocks: DialogueBlock[]) => void;
  className?: string;
};

type PaletteSection = {
  title: string;
  items: Array<{
    id: string;
    label: string;
    type: DialogueSpeaker | 'group' | 'container' | 'action';
    color: string;
    icon: any;
  }>;
};

const DIALOGUE_PALETTE: PaletteSection[] = [
  {
    title: 'Dialogue',
    items: [
  {
    id: 'npc',
    label: 'NPC Response',
    type: 'npc' as DialogueSpeaker,
    color: '#f97316',
    icon: IconMessageCircle2,
  },
  {
    id: 'player',
    label: 'Player Response',
    type: 'player' as DialogueSpeaker,
    color: '#3b82f6',
    icon: IconUser,
  },
  {
    id: 'option',
    label: 'Option Response',
    type: 'option' as DialogueSpeaker,
    color: '#a855f7',
    icon: IconListDetails,
      },
      {
        id: 'group',
        label: 'Group Block',
        type: 'group' as const,
        color: '#10b981',
        icon: IconFolder,
      },
    ],
  },
  {
    title: 'Conditional',
    items: [
      {
        id: 'container',
        label: 'Container Block',
        type: 'container' as const,
        color: '#8b5cf6',
        icon: IconBox,
      },
    ],
  },
  {
    title: 'Actions',
    items: [
      {
        id: 'action',
        label: 'Action',
        type: 'action' as const,
        color: '#8b5cf6',
        icon: IconBox,
      },
    ],
  },
];

const DEFAULT_SCRIPT: Omit<DialogueBlock, 'id'>[] = [
  {
    speaker: 'npc',
    text: 'Welcome to the Sheared Ram. What can I do for you?',
  },
];

const nodeTypes: NodeTypes = {
  npc: NpcDialogueNode,
  player: PlayerDialogueNode,
  option: OptionNode,
  npcMeta: NpcMetaNode,
  group: GroupNode,
  container: ContainerNode,
  action: ActionNode,
};

type EditorNodeData = DialogueNodeData | NpcMetaNodeData | GroupNodeData | ContainerNodeData | ActionNodeData;
type EditorNode = ReactFlowNode<EditorNodeData>;

function DialogueBlockEditorInner({ onBlocksChange, className }: DialogueBlockEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [npcGamevalMode, setNpcGamevalMode] = useState<'gameval' | 'id'>('gameval');
  const [npcGamevalValue, setNpcGamevalValue] = useState('');
  const orderRef = useRef(0);
  const initializedRef = useRef(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [xmlPreview, setXmlPreview] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pastedXml, setPastedXml] = useState('');
  const [autosaves, setAutosaves] = useState<Array<{ timestamp: number; xml: string; sessionId: string }>>([]);
  const [autosaveCountdown, setAutosaveCountdown] = useState(60);
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);
  const lastAutosaveXmlRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodesRef = useRef<EditorNode[]>([]);
  const groupPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const createNode = useCallback(
  (
    speaker: DialogueSpeaker,
    options?: { text?: string; position?: { x: number; y: number } }
  ) => {
    const nodeId = `dialogue_${Date.now()}_${orderRef.current}`;
    const order = orderRef.current++;
    const defaultText =
      speaker === 'npc'
        ? 'NPC delivers important context or instruction.'
        : speaker === 'player'
          ? 'Player responds or chooses an option.'
          : 'Select an Option';

      if (speaker === 'option') {
        const optionEntries: OptionEntry[] = Array.from({ length: 2 }).map((_, idx) => ({
            id: `${nodeId}_option_${idx}`,
            title: `Option ${idx + 1}`,
          }));

        const node: ReactFlowNode<DialogueNodeData> = {
          id: nodeId,
          type: 'option',
          position:
            options?.position ??
            {
              x: 320,
              y: order * 140 + 80,
            },
          data: {
            id: nodeId,
            speaker: 'option',
            text: options?.text ?? defaultText,
            options: optionEntries,
            handleOrientation: 'horizontal',
            order,
            onChange: (key: keyof DialogueNodeData, value: any) => {
              setNodes((current) =>
                current.map((nodeItem) => {
                  if (nodeItem.id !== nodeId) return nodeItem;

                  if (key === 'options') {
                    const existing = nodeItem.data.options ?? [];
                    if (value === 'add') {
                      if (existing.length >= 5) return nodeItem;
                      return {
                        ...nodeItem,
                        data: {
                          ...nodeItem.data,
                          options: [
                            ...existing,
                            {
                              id: `${nodeId}_option_${Date.now()}`,
                              title: `Option ${existing.length + 1}`,
                            },
                          ],
                        },
                      };
                    }

                    if (value?.action === 'remove') {
                      if (existing.length <= 1) return nodeItem;
                      return {
                        ...nodeItem,
                        data: {
                          ...nodeItem.data,
                          options: existing.filter((opt) => opt.id !== value.id),
                        },
                      };
                    }

                    const updated = (nodeItem.data.options ?? []).map((opt: OptionEntry) =>
                      opt.id === value.id ? { ...opt, title: value.title } : opt
                    );
                    return {
                      ...nodeItem,
                      data: {
                        ...nodeItem.data,
                        options: updated,
                      },
                    };
                  }

                  return {
                    ...nodeItem,
                    data: {
                      ...nodeItem.data,
                      [key]: value,
                    },
                  };
                })
              );
            },
          },
        };

        return node;
      }

      const nodeType = speaker === 'npc' ? 'npc' : 'player';
      const node: ReactFlowNode<DialogueNodeData> = {
        id: nodeId,
        type: nodeType,
        position:
          options?.position ??
          {
            x: speaker === 'npc' ? 160 : 420,
            y: order * 140 + 80,
          },
        data: {
          id: nodeId,
          speaker,
          text: options?.text ?? defaultText,
          npcId: options?.npcId ?? '',
          title: options?.title ?? '',
          expression: options?.expression ?? DIALOGUE_EXPRESSIONS.find((e) => e.label === 'HAPPY')?.value ?? DIALOGUE_EXPRESSIONS[0].value,
          npcGamevalName: speaker === 'npc' ? npcGamevalValue : undefined,
          handleOrientation: 'horizontal',
          order,
          onChange: (key: keyof DialogueNodeData, value: any) => {
            setNodes((current) =>
              current.map((nodeItem) => {
                if (nodeItem.id !== nodeId) {
                  return nodeItem;
                }
                const nextNode: ReactFlowNode<DialogueNodeData> = {
                  ...nodeItem,
                  data: {
                    ...nodeItem.data,
                    [key]: value,
                  },
                };
                return nextNode;
              })
            );
          },
        },
      };
      return node;
    },
    [npcGamevalValue, setNodes]
  );

  const handleGamevalModeChange = useCallback(
    (mode: string) => {
      setNpcGamevalMode(mode as 'gameval' | 'id');
      setNodes((current) =>
        current.map((node) =>
          node.type === 'npcMeta'
            ? {
                ...node,
                data: {
                  ...node.data,
                  npcGamevalMode: mode,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleGamevalValueChange = useCallback(
    (value: string, mode: string) => {
      const label = value.trim() || 'NPC';
      setNpcGamevalValue(value);
      setNpcGamevalMode(mode as 'gameval' | 'id');
      setNodes((current) =>
        current.map((node) => {
          if (node.type === 'npcMeta') {
            return {
              ...node,
              data: {
                ...node.data,
                npcGamevalValue: value,
                npcGamevalMode: mode,
              },
            };
          }
          if (node.type === 'npc') {
            return {
              ...node,
              data: {
                ...node.data,
                npcGamevalName: value,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const handleNpcSuggestionSelect = useCallback(
    (suggestion: GamevalSuggestion, mode: string) => {
      const value = mode === 'gameval' ? suggestion.name : suggestion.id.toString();
      setNpcGamevalMode(mode as 'gameval' | 'id');
      setNpcGamevalValue(value);
      setNodes((current) =>
        current.map((node) => {
          if (node.type === 'npcMeta') {
            return {
              ...node,
              data: {
                ...node.data,
                npcGamevalValue: value,
                npcGamevalMode: mode,
              },
            };
          }
          if (node.type === 'npc') {
            return {
              ...node,
              data: {
                ...node.data,
                npcGamevalName: value,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const createNpcMetaNode = useCallback((): ReactFlowNode<NpcMetaNodeData> => {
    return {
      id: 'npc_meta_node',
      type: 'npcMeta',
      position: { x: -220, y: 60 },
      data: {
        npcGamevalMode,
        npcGamevalValue,
        onGamevalModeChange: handleGamevalModeChange,
        onGamevalValueChange: handleGamevalValueChange,
        onSuggestionSelect: handleNpcSuggestionSelect,
      },
      draggable: true,
      selectable: false,
      deletable: false,
    };
  }, [npcGamevalMode, npcGamevalValue, handleGamevalModeChange, handleGamevalValueChange, handleNpcSuggestionSelect]);

  const createContainerNode = useCallback((): ReactFlowNode<ContainerNodeData> => {
    const nodeId = `container_${Date.now()}`;
    return {
      id: nodeId,
      type: 'container',
      position: { x: 300, y: 300 },
      data: {
        id: nodeId,
        containerType: 'inventory',
        items: [],
        handleOrientation: 'horizontal',
        onChange: (key: 'containerType' | 'items' | 'handleOrientation', value: any) => {
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== nodeId || node.type !== 'container') return node;
              return {
                ...node,
                data: {
                  ...(node.data as ContainerNodeData),
                  [key]: value,
                },
              };
            })
          );
        },
      },
    };
  }, [setNodes]);

  const createActionNode = useCallback((): ReactFlowNode<ActionNodeData> => {
    const nodeId = `action_${Date.now()}`;
    return {
      id: nodeId,
      type: 'action',
      position: { x: 300, y: 300 },
      data: {
        id: nodeId,
        actionType: 'remove_item',
        itemName: '',
        amount: 1,
        containerType: 'inventory',
        handleOrientation: 'horizontal',
        onChange: (key: 'actionType' | 'itemName' | 'amount' | 'containerType' | 'handleOrientation', value: any) => {
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== nodeId || node.type !== 'action') return node;
              return {
                ...node,
                data: {
                  ...(node.data as ActionNodeData),
                  [key]: value,
                },
              };
            })
          );
        },
      },
    };
  }, [setNodes]);

  const initializeNodes = useCallback(() => {
    orderRef.current = 0;
    const metaNode = createNpcMetaNode();
    metaNode.position = { x: 50, y: 200 };

    setNodes([metaNode]);
    setEdges([]);
  }, [createNpcMetaNode, setNodes, setEdges]);

  const buildDialogueXml = useCallback(() => {
    const setAttribute = (
      element: any,
      name: string,
      value: string | number | undefined | null
    ) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value.trim() === '') return;
      element.att(name, value);
    };

    const doc = create({ version: '1.0', encoding: 'UTF-8' });
    const root = doc.ele('dialogue');

    const metaEl = root.ele('npcMeta');
    setAttribute(metaEl, 'value', npcGamevalValue);
    const metaNode = nodes.find((n) => n.type === 'npcMeta');
    if (metaNode) {
      const posEl = metaEl.ele('position');
      setAttribute(posEl, 'x', metaNode.position.x.toString());
      setAttribute(posEl, 'y', metaNode.position.y.toString());
    }

    const nodesEl = root.ele('nodes');
    nodes
      .filter((node) => node.type !== 'npcMeta')
      .forEach((node) => {
        const nodeData = node.data as DialogueNodeData;
        if (node.type === 'npc' || node.type === 'player') {
          const tagName = nodeData.speaker === 'npc' ? 'npc' : 'player';
          const dialogueEl = nodesEl.ele(tagName);
          setAttribute(dialogueEl, 'id', node.id);
          setAttribute(dialogueEl, 'order', nodeData.order);
          setAttribute(dialogueEl, 'orientation', nodeData.handleOrientation);
          if (nodeData.speaker === 'npc') {
            setAttribute(dialogueEl, 'npc', nodeData.npcId);
          }
          if (nodeData.title) {
            setAttribute(dialogueEl, 'title', nodeData.title);
          }
          // Export expression as label (name) instead of value (int)
          if (nodeData.expression) {
            const exprLabel = DIALOGUE_EXPRESSIONS.find((expr) => expr.value === nodeData.expression)?.label;
            if (exprLabel) {
              setAttribute(dialogueEl, 'expression', exprLabel);
            }
          }
          const textValue = typeof nodeData.text === 'string' ? nodeData.text : '';
          dialogueEl.ele('text').txt(textValue || '');
          if (node.position) {
            dialogueEl
              .ele('position')
              .att('x', Math.round(node.position.x))
              .att('y', Math.round(node.position.y));
          }
        } else if (node.type === 'option') {
          const optionNodeEl = nodesEl.ele('optionsNode');
          setAttribute(optionNodeEl, 'id', node.id);
          setAttribute(optionNodeEl, 'order', nodeData.order);
          setAttribute(optionNodeEl, 'title', nodeData.text);
          setAttribute(optionNodeEl, 'orientation', nodeData.handleOrientation);
          if (node.position) {
            optionNodeEl
              .ele('position')
              .att('x', Math.round(node.position.x))
              .att('y', Math.round(node.position.y));
          }
          const optionsEl = optionNodeEl.ele('options');
          (node.data.options ?? []).forEach((option: OptionEntry) => {
            const optionEl = optionsEl.ele('option');
            setAttribute(optionEl, 'id', option.id);
            setAttribute(optionEl, 'title', option.title);
          });
        } else if (node.type === 'container') {
          const containerData = node.data as ContainerNodeData;
          const containerEl = nodesEl.ele('container');
          setAttribute(containerEl, 'id', node.id);
          setAttribute(containerEl, 'containerType', containerData.containerType);
          setAttribute(containerEl, 'orientation', containerData.handleOrientation);
          if (node.position) {
            containerEl
              .ele('position')
              .att('x', Math.round(node.position.x))
              .att('y', Math.round(node.position.y));
          }
          const itemsEl = containerEl.ele('items');
          (containerData.items ?? []).forEach((item) => {
            const itemEl = itemsEl.ele('item');
            setAttribute(itemEl, 'id', item.id);
            setAttribute(itemEl, 'itemName', item.itemName);
            setAttribute(itemEl, 'amount', item.amount);
          });
        } else if (node.type === 'action') {
          const actionData = node.data as ActionNodeData;
          const actionEl = nodesEl.ele('action');
          setAttribute(actionEl, 'id', node.id);
          setAttribute(actionEl, 'actionType', actionData.actionType);
          setAttribute(actionEl, 'itemName', actionData.itemName);
          setAttribute(actionEl, 'amount', actionData.amount);
          setAttribute(actionEl, 'containerType', actionData.containerType);
          setAttribute(actionEl, 'orientation', actionData.handleOrientation);
          if (node.position) {
            actionEl
              .ele('position')
              .att('x', Math.round(node.position.x))
              .att('y', Math.round(node.position.y));
          }
        }
      });

    const edgesEl = root.ele('edges');
    edges.forEach((edge) => {
      const edgeEl = edgesEl.ele('edge');
      setAttribute(edgeEl, 'id', edge.id);
      setAttribute(edgeEl, 'source', edge.source);
      setAttribute(edgeEl, 'sourceHandle', edge.sourceHandle);
      setAttribute(edgeEl, 'target', edge.target);
      setAttribute(edgeEl, 'targetHandle', edge.targetHandle);
    });

    return root.end({ prettyPrint: true });
  }, [edges, nodes, npcGamevalMode, npcGamevalValue]);

  const loadXmlDocument = useCallback(
    (xmlString: string) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');
        const parserErrors = doc.getElementsByTagName('parsererror');
        if (parserErrors.length > 0) {
          throw new Error('Invalid XML');
        }

        const newNodes: ReactFlowNode[] = [];
        const newEdges: Edge[] = [];

        const npcMeta = doc.getElementsByTagName('npcMeta')[0];
        const metaMode = 'gameval';
        const metaValue = npcMeta?.getAttribute('value') ?? '';
        setNpcGamevalMode(metaMode as 'gameval' | 'id');
        setNpcGamevalValue(metaValue);

        // Read position from XML if available, otherwise use default
        const metaPosEl = npcMeta?.getElementsByTagName('position')[0];
        const metaPosition = metaPosEl
          ? {
              x: parseInt(metaPosEl.getAttribute('x') ?? '-220', 10),
              y: parseInt(metaPosEl.getAttribute('y') ?? '60', 10),
            }
          : { x: -220, y: 60 };

        const metaNode = {
          id: 'npc_meta_node',
          type: 'npcMeta',
          position: metaPosition,
          data: {
            npcGamevalMode: metaMode,
            npcGamevalValue: metaValue,
            onGamevalModeChange: handleGamevalModeChange,
            onGamevalValueChange: handleGamevalValueChange,
            onSuggestionSelect: handleNpcSuggestionSelect,
          },
          draggable: true,
          selectable: false,
          deletable: false,
        } satisfies ReactFlowNode<NpcMetaNodeData>;
        newNodes.push(metaNode);

        const nodesElement = doc.getElementsByTagName('nodes')[0];
        if (!nodesElement) {
          console.error('No <nodes> element found in XML');
          return;
        }
        const nodeElements = Array.from(nodesElement.children);
        const usedIds = new Set<string>();
        const idMapping = new Map<string, string>(); // Map original ID to new unique ID
        nodeElements.forEach((el, idx) => {
          const tagName = el.tagName.toLowerCase();
          const originalId = el.getAttribute('id') ?? `imported_${Date.now()}_${idx}`;
          let id = originalId;
          // Ensure unique IDs - if ID already used, append index
          if (usedIds.has(id)) {
            id = `${id}_${idx}`;
          }
          // Only add to mapping if not already mapped (first occurrence keeps original ID)
          if (!idMapping.has(originalId)) {
            idMapping.set(originalId, id);
          } else if (id !== originalId) {
            // For duplicates, map the duplicate to the new unique ID
            idMapping.set(`${originalId}_${idx}`, id);
          }
          usedIds.add(id);
          const order = parseInt(el.getAttribute('order') ?? '0', 10);
          const posEl = el.getElementsByTagName('position')[0];
          const position = posEl
            ? {
                x: parseInt(posEl.getAttribute('x') ?? '0', 10),
                y: parseInt(posEl.getAttribute('y') ?? '0', 10),
              }
            : { x: 0, y: 0 };

          if (tagName === 'npc' || tagName === 'player') {
            const textContent = el.getElementsByTagName('text')[0]?.textContent ?? '';
            // Convert expression label back to value
            const expressionLabel = el.getAttribute('expression');
            const expressionValue = expressionLabel
              ? DIALOGUE_EXPRESSIONS.find((expr) => expr.label === expressionLabel)?.value ?? expressionLabel
              : undefined;
            const nodeData: DialogueNodeData = {
              id,
              speaker: tagName === 'npc' ? 'npc' : 'player',
              text: textContent,
              expression: expressionValue,
              npcId: tagName === 'npc' ? (el.getAttribute('npc') ?? undefined) : undefined,
              title: el.getAttribute('title') ?? undefined,
              handleOrientation: el.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal',
              order,
              onChange: () => {},
            };
            newNodes.push({
              id,
              type: nodeData.speaker === 'npc' ? 'npc' : 'player',
              position,
              data: {
                ...nodeData,
                npcGamevalName: tagName === 'npc' ? metaValue : undefined,
                onChange: (key: keyof DialogueNodeData, value: any) => {
                  setNodes((current) =>
                    current.map((node) =>
                      node.id === id ? { ...node, data: { ...node.data, [key]: value } } : node
                    )
                  );
                },
              },
            });
          } else if (tagName === 'optionsnode') {
            const title = el.getAttribute('title') ?? 'Select an Option';
            const optionsList = Array.from(el.getElementsByTagName('option')).map((optionEl) => ({
              id: optionEl.getAttribute('id') ?? `option_${Date.now()}`,
              title: optionEl.getAttribute('title') ?? '',
            }));
            newNodes.push({
              id,
              type: 'option',
              position,
              data: {
                id,
                speaker: 'option',
                text: title,
                options: optionsList,
                handleOrientation: el.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal',
                order,
                onChange: (key: keyof DialogueNodeData, value: any) => {
                  setNodes((current) =>
                    current.map((node) => {
                      if (node.id !== id) return node;
                      if (key === 'options') {
                        const existing = node.data.options ?? [];
                        if (value === 'add') {
                          if (existing.length >= 5) return node;
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              options: [
                                ...existing,
                                {
                                  id: `${id}_option_${Date.now()}`,
                                  title: `Option ${existing.length + 1}`,
                                },
                              ],
                            },
                          };
                        }
                        if (value?.action === 'remove') {
                          if (existing.length <= 1) return node;
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              options: existing.filter((opt: OptionEntry) => opt.id !== value.id),
                            },
                          };
                        }
                        const updated = (node.data.options ?? []).map((opt: OptionEntry) =>
                          opt.id === value.id ? { ...opt, title: value.title } : opt
                        );
                        return {
                          ...node,
                          data: {
                            ...node.data,
                            options: updated,
                          },
                        };
                      }
                      return {
                        ...node,
                        data: {
                          ...node.data,
                          [key]: value,
                        },
                      };
                    })
                  );
                },
              },
            });
          } else if (tagName === 'container') {
            const containerType = (el.getAttribute('containerType') ?? 'inventory') as 'inventory' | 'equipment';
            const itemsList = Array.from(el.getElementsByTagName('item')).map((itemEl) => ({
              id: itemEl.getAttribute('id') ?? `item_${Date.now()}`,
              itemName: itemEl.getAttribute('itemName') ?? '',
              amount: parseInt(itemEl.getAttribute('amount') ?? '1', 10),
            }));
            const containerNode = {
              id,
              type: 'container' as const,
              position,
              data: {
                id,
                containerType,
                items: itemsList,
                handleOrientation: el.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal',
                onChange: (key: 'containerType' | 'items' | 'handleOrientation', value: any) => {
                  setNodes((current) =>
                    current.map((node) => {
                      if (node.id !== id || node.type !== 'container') return node;
                      return {
                        ...node,
                        data: {
                          ...(node.data as ContainerNodeData),
                          [key]: value,
                        },
                      };
                    })
                  );
                },
              },
            };
            newNodes.push(containerNode);
          } else if (tagName === 'action') {
            const actionType = (el.getAttribute('actionType') ?? 'remove_item') as ActionType;
            const itemName = el.getAttribute('itemName') ?? '';
            const amount = parseInt(el.getAttribute('amount') ?? '1', 10);
            const containerType = (el.getAttribute('containerType') ?? 'inventory') as 'inventory' | 'equipment';
            const actionNode = {
              id,
              type: 'action' as const,
              position,
              data: {
                id,
                actionType,
                itemName,
                amount,
                containerType,
                handleOrientation: el.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal',
                onChange: (key: 'actionType' | 'itemName' | 'amount' | 'containerType' | 'handleOrientation', value: any) => {
                  setNodes((current) =>
                    current.map((node) => {
                      if (node.id !== id || node.type !== 'action') return node;
                      return {
                        ...node,
                        data: {
                          ...(node.data as ActionNodeData),
                          [key]: value,
                        },
                      };
                    })
                  );
                },
              },
            };
            newNodes.push(actionNode);
          }
        });

        const edgeElements = Array.from(doc.getElementsByTagName('edge'));
        edgeElements.forEach((edgeEl, idx) => {
          let source = edgeEl.getAttribute('source');
          let target = edgeEl.getAttribute('target');
          // Map source and target IDs if they were changed due to duplicates
          if (source && idMapping.has(source)) {
            source = idMapping.get(source)!;
          }
          if (target && idMapping.has(target)) {
            target = idMapping.get(target)!;
          }
          if (source && target) {
            newEdges.push({
              id: edgeEl.getAttribute('id') ?? `edge_${idx}`,
              source,
              sourceHandle: edgeEl.getAttribute('sourceHandle') ?? undefined,
              target,
              targetHandle: edgeEl.getAttribute('targetHandle') ?? undefined,
              type: 'smoothstep',
              animated: false,
              style: { stroke: 'var(--primary)' },
            });
          }
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (error) {
        console.error('Failed to load XML document', error);
      }
    },
    [
      setNodes,
      setEdges,
      setNpcGamevalMode,
      setNpcGamevalValue,
      handleGamevalModeChange,
      handleGamevalValueChange,
      handleNpcSuggestionSelect,
    ]
  );

  // Load auto-saves from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('dialogue_editor_autosaves');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out auto-saves from the current session (to avoid duplicates)
        const filtered = parsed.filter((a: { sessionId?: string }) => a.sessionId !== sessionIdRef.current);
        setAutosaves(filtered);
      }
    } catch (error) {
      console.error('Failed to load auto-saves:', error);
    }
  }, []);

  // Countdown timer for auto-save (syncs with auto-save interval)
  useEffect(() => {
    if (!initializedRef.current) return;
    
    // Reset countdown when nodes/edges change significantly
    const resetCountdown = () => {
      setAutosaveCountdown(60);
    };
    
    const countdownInterval = setInterval(() => {
      setAutosaveCountdown((prev) => {
        if (prev <= 1) {
          return 60; // Reset to 60 seconds when it reaches 0
        }
        return prev - 1;
      });
    }, 1000); // Update every second

    return () => clearInterval(countdownInterval);
  }, [nodes.length, edges.length]);

  // Auto-save to localStorage every minute (replace current session's auto-save)
  useEffect(() => {
    if (!initializedRef.current) return;
    
    const autoSaveInterval = setInterval(() => {
      try {
        // Never save if there's only the NPC meta node (or no nodes at all)
        const nonMetaNodes = nodes.filter((node) => node.type !== 'npcMeta');
        if (nonMetaNodes.length === 0) {
          // Reset countdown but don't save
          setAutosaveCountdown(60);
          return;
        }
        
        const xmlString = buildDialogueXml();
        
        // Check if XML has changed from last auto-save
        const hasChanged = xmlString !== lastAutosaveXmlRef.current;
        
        // Only auto-save if something has changed
        if (!hasChanged) {
          // Reset countdown but don't save
          setAutosaveCountdown(60);
          return;
        }
        
        setAutosaveStatus('saving');
        if (typeof window !== 'undefined' && xmlString) {
          const timestamp = Date.now();
          const newAutosave = { timestamp, xml: xmlString, sessionId: sessionIdRef.current };
          
          // Get existing auto-saves from localStorage
          const saved = localStorage.getItem('dialogue_editor_autosaves');
          const existing = saved ? JSON.parse(saved) : [];
          
          // Remove any existing auto-save from this session and add the new one
          const filtered = existing.filter((a: { sessionId?: string }) => a.sessionId !== sessionIdRef.current);
          const updated = [newAutosave, ...filtered].slice(0, 10); // Keep last 10
          
          localStorage.setItem('dialogue_editor_autosaves', JSON.stringify(updated));
          setAutosaves(updated);
          lastAutosaveXmlRef.current = xmlString;
          setAutosaveStatus('saved');
          setAutosaveCountdown(60); // Reset countdown
          // Reset to idle after 2 seconds
          setTimeout(() => setAutosaveStatus('idle'), 2000);
        } else {
          setAutosaveStatus('idle');
        }
      } catch (error) {
        // Silently fail if export isn't ready yet
        setAutosaveStatus('idle');
      }
    }, 60000); // Every 60 seconds (1 minute)

    return () => clearInterval(autoSaveInterval);
  }, [buildDialogueXml, nodes, edges]);

  // Initialize nodes on mount (no auto-save loading)
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeNodes();
    }
  }, [initializeNodes]);

  // Keep nodesRef in sync with nodes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Helper function to update group sizes (pure function version)
  const updateGroupSizesInNodes = useCallback((current: EditorNode[]): EditorNode[] => {
    return current.map((node) => {
      if (node.type !== 'group') return node;
      const groupData = node.data as GroupNodeData;
      
      // Calculate group size based on child nodes
      const childNodes = current.filter((n) => {
        const nodeData = n.data as DialogueNodeData;
        return nodeData.groupId === node.id;
      });
      
      if (childNodes.length === 0) {
        return {
          ...node,
          width: 400,
          height: 300,
          data: {
            ...groupData,
            getAllNodes: () => {
              return nodesRef.current
                .filter((n) => n.type !== 'npcMeta' && n.type !== 'group')
                .map((n) => {
                  const nodeData = n.data as DialogueNodeData;
                  return {
                    id: n.id,
                    type: n.type || 'unknown',
                    label: nodeData.text || nodeData.speaker || '',
                  };
                });
            },
          },
        };
      }
      
      // Calculate bounding box of child nodes
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
      childNodes.forEach((child) => {
        const childWidth = child.width || 150;
        const childHeight = child.height || 100;
        minX = Math.min(minX, child.position.x);
        minY = Math.min(minY, child.position.y);
        maxX = Math.max(maxX, child.position.x + childWidth);
        maxY = Math.max(maxY, child.position.y + childHeight);
      });
      
      // Add padding
      const padding = 40;
      const headerHeight = 60; // Height of header with input
      const bottomPadding = 20;
      
      // Adjust group position to contain all children
      // Ensure group starts at or before the leftmost child
      const newGroupX = Math.min(node.position.x, minX - padding);
      // For Y: ensure header area is included, so group top should be at or above (minY - headerHeight)
      const newGroupY = Math.min(node.position.y, minY - headerHeight - padding);
      
      // Calculate width: ensure it fits all children + padding on both sides
      const groupWidth = Math.max(400, maxX - minX + padding * 2);
      
      // Calculate height: header + all children height + bottom padding
      // Height should be: headerHeight + (bottom of last child - top of first child) + bottomPadding + padding
      // But we need to account for the group's position
      const childrenTopRelativeToGroup = minY - newGroupY;
      const childrenBottomRelativeToGroup = maxY - newGroupY;
      
      // Total height = header + (space from header to first child) + (children height) + bottom padding
      // If children start below header, use that; otherwise ensure header is included
      const spaceFromHeaderToFirstChild = Math.max(0, childrenTopRelativeToGroup - headerHeight);
      const childrenHeight = childrenBottomRelativeToGroup - childrenTopRelativeToGroup;
      const groupHeight = headerHeight + spaceFromHeaderToFirstChild + childrenHeight + bottomPadding + padding;
      
      return {
        ...node,
        position: { x: newGroupX, y: newGroupY },
        width: groupWidth,
        height: groupHeight,
        data: {
          ...groupData,
          getAllNodes: () => {
            return nodesRef.current
              .filter((n) => n.type !== 'npcMeta' && n.type !== 'group')
              .map((n) => {
                const nodeData = n.data as DialogueNodeData;
                return {
                  id: n.id,
                  type: n.type || 'unknown',
                  label: nodeData.text || nodeData.speaker || '',
                };
              });
          },
        },
      };
    });
  }, []);

  // Helper function to update group sizes (wrapper that uses setNodes)
  const updateGroupSizes = useCallback(() => {
    setNodes((current) => updateGroupSizesInNodes(current));
  }, [setNodes, updateGroupSizesInNodes]);

  // Update group sizes when node count changes
  useEffect(() => {
    updateGroupSizes();
  }, [nodes.length, updateGroupSizes]);

  useEffect(() => {
    const orderedBlocks = nodes
      .filter((node) => node.type === 'npc' || node.type === 'player' || node.type === 'option')
      .slice()
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
      .map<DialogueBlock>((node) => ({
        id: node.id,
        speaker: node.data.speaker,
        text: node.data.text,
        expression: node.data.expression,
        npcId: node.data.npcId,
        options: node.data.options,
      }));

    onBlocksChange?.(orderedBlocks);
  }, [nodes, onBlocksChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      if (event.key === 'Delete' && selectedNode) {
        const nodeToDelete = nodes.find((node) => node.id === selectedNode);
        if (nodeToDelete && nodeToDelete.type === 'npcMeta') {
          return;
        }
        
        // If deleting a group node, remove all child references
        if (nodeToDelete && nodeToDelete.type === 'group') {
          const groupData = nodeToDelete.data as GroupNodeData;
          setNodes((current) =>
            current.map((node) => {
              const nodeData = node.data as DialogueNodeData;
              if (nodeData.groupId === selectedNode) {
                return {
                  ...node,
                  data: {
                    ...nodeData,
                    groupId: undefined,
                  },
                };
              }
              return node;
            })
          );
        }
        
        // If deleting a node that belongs to a group, remove it from the group
        if (nodeToDelete) {
          const nodeData = nodeToDelete.data as DialogueNodeData;
          if (nodeData.groupId) {
            setNodes((current) =>
              current.map((node) => {
                if (node.id === nodeData.groupId && node.type === 'group') {
                  const groupData = node.data as GroupNodeData;
                  return {
                    ...node,
                    data: {
                      ...groupData,
                      childNodeIds: groupData.childNodeIds.filter((id) => id !== selectedNode),
                    },
                  };
                }
                return node;
              })
            );
          }
        }
        
        setNodes((current) => current.filter((node) => node.id !== selectedNode));
        setEdges((current) =>
          current.filter(
            (edge) => edge.source !== selectedNode && edge.target !== selectedNode
          )
        );
        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, setEdges, setNodes]);

  const createGroupNode = useCallback((): ReactFlowNode<GroupNodeData> => {
    const nodeId = `group_${Date.now()}`;
    return {
      id: nodeId,
      type: 'group',
      position: { x: 300, y: 300 },
      data: {
        id: nodeId,
        groupName: '',
        childNodeIds: [],
        handleOrientation: 'horizontal',
        onChange: (key: 'groupName' | 'childNodeIds' | 'handleOrientation', value: any) => {
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== nodeId || node.type !== 'group') return node;
              return {
                ...node,
                data: {
                  ...(node.data as GroupNodeData),
                  [key]: value,
                },
              };
            })
          );
        },
        onAddChild: (childNodeId: string) => {
          setNodes((current) => {
            // First, remove the node from any other group it might be in
            const previousGroupId = (current.find((n) => n.id === childNodeId)?.data as DialogueNodeData)?.groupId;
            
            // Check if this is the first child being added to the group
            const groupNode = current.find((n) => n.id === nodeId && n.type === 'group');
            const groupData = groupNode?.data as GroupNodeData;
            const isFirstChild = !groupData || groupData.childNodeIds.length === 0;
            
            // Find the last node in the group to position new node below it
            let lastNodePosition: { x: number; y: number; height: number } | null = null;
            if (!isFirstChild && groupData) {
              const childNodes = current.filter((n) => {
                const nodeData = n.data as DialogueNodeData;
                return nodeData.groupId === nodeId;
              });
              
              // Find the bottommost node
              let maxY = -Infinity;
              childNodes.forEach((child) => {
                const childY = child.position.y + (child.height || 100);
                if (childY > maxY) {
                  maxY = childY;
                  lastNodePosition = {
                    x: child.position.x,
                    y: child.position.y,
                    height: child.height || 100,
                  };
                }
              });
            }
            
            const updated = current.map((node) => {
              // Remove from previous group if it exists
              if (previousGroupId && node.id === previousGroupId && node.type === 'group') {
                const prevGroupData = node.data as GroupNodeData;
                return {
                  ...node,
                  data: {
                    ...prevGroupData,
                    childNodeIds: prevGroupData.childNodeIds.filter((id) => id !== childNodeId),
                  },
                };
              }
              
              // Add to new group
              if (node.id === nodeId && node.type === 'group') {
                const groupData = node.data as GroupNodeData;
                if (groupData.childNodeIds.includes(childNodeId)) return node;
                return {
                  ...node,
                  data: {
                    ...groupData,
                    childNodeIds: [...groupData.childNodeIds, childNodeId],
                  },
                };
              }
              
              // Update the child node to reference this group and add remove callback
              if (node.id === childNodeId) {
                const nodeData = node.data as DialogueNodeData;
                if (nodeData.groupId === nodeId) return node;
                
                // Position the node
                let newPosition = node.position;
                if (groupNode) {
                  const groupPos = groupNode.position;
                  const groupWidth = groupNode.width || 400;
                  const headerHeight = 60; // Approximate height of header with input
                  const nodeWidth = node.width || 150;
                  
                  if (isFirstChild) {
                    // First child: center below header
                    newPosition = {
                      x: groupPos.x + (groupWidth / 2) - (nodeWidth / 2),
                      y: groupPos.y + headerHeight + 20, // 20px padding below header
                    };
                  } else if (lastNodePosition) {
                    // Subsequent nodes: stack below the last node
                    newPosition = {
                      x: lastNodePosition.x, // Align with previous node
                      y: lastNodePosition.y + lastNodePosition.height + 20, // 20px spacing
                    };
                  }
                }
                
                return {
                  ...node,
                  position: newPosition,
                  data: {
                    ...nodeData,
                    groupId: nodeId,
                    onRemoveFromGroup: () => {
                      setNodes((currentNodes) => {
                        const groupNode = currentNodes.find((n) => n.id === nodeId);
                        if (groupNode && groupNode.type === 'group') {
                          const groupData = groupNode.data as GroupNodeData;
                          groupData.onRemoveChild?.(childNodeId);
                        }
                        return currentNodes;
                      });
                    },
                  },
                };
              }
              
              return node;
            });
            
            // Update group sizes immediately after adding child
            // Use the updated nodes array to calculate sizes
            const nodesWithSizes = updateGroupSizesInNodes(updated);
            return nodesWithSizes;
          });
        },
        onRemoveChild: (childNodeId: string) => {
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== nodeId || node.type !== 'group') {
                // Remove group reference from child node and remove callback
                if (node.id === childNodeId) {
                  const nodeData = node.data as DialogueNodeData;
                  if (nodeData.groupId !== nodeId) return node;
                  const { onRemoveFromGroup, ...restData } = nodeData;
                  return {
                    ...node,
                    data: {
                      ...restData,
                      groupId: undefined,
                    },
                  };
                }
                return node;
              }
              const groupData = node.data as GroupNodeData;
              return {
                ...node,
                data: {
                  ...groupData,
                  childNodeIds: groupData.childNodeIds.filter((id) => id !== childNodeId),
                },
              };
            })
          );
        },
        getAllNodes: () => {
          // This will be updated when the node is rendered
          return [];
        },
      },
    };
  }, [setNodes]);

  const addDialogueNode = useCallback(
    (speaker: DialogueSpeaker | 'group' | 'container' | 'action') => {
      if (speaker === 'group') {
        setNodes((current) => [...current, createGroupNode()]);
      } else if (speaker === 'container') {
        setNodes((current) => [...current, createContainerNode()]);
      } else if (speaker === 'action') {
        setNodes((current) => [...current, createActionNode()]);
      } else {
        setNodes((current) => [...current, createNode(speaker)]);
      }
    },
    [createNode, createGroupNode, createContainerNode, createActionNode, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) return;

      // Helper function to get the group ID a node belongs to
      const getNodeGroupId = (node: EditorNode): string | undefined => {
        if (node.type === 'group') return node.id;
        const nodeData = node.data as DialogueNodeData;
        return nodeData.groupId;
      };

      const sourceGroupId = getNodeGroupId(sourceNode);
      const targetGroupId = getNodeGroupId(targetNode);

      // Rule 1: If source is inside a group and target is outside that group (and not a group node), block connection
      if (
        sourceGroupId &&
        sourceNode.type !== 'group' &&
        targetGroupId !== sourceGroupId &&
        targetNode.type !== 'group'
      ) {
        return; // Block: node inside group trying to connect to node outside
      }

      // Rule 2: If target is inside a group and source is outside that group (and not a group node), block connection
      if (
        targetGroupId &&
        targetNode.type !== 'group' &&
        sourceGroupId !== targetGroupId &&
        sourceNode.type !== 'group'
      ) {
        return; // Block: node outside group trying to connect to node inside group
      }

      // Rule 3: Group nodes can connect to anything (already handled above)
      // Rule 4: Nodes can connect to group nodes (already handled above)

      setEdges((current) => {
        if (sourceNode) {
        if (sourceNode.type === 'npc' || sourceNode.type === 'player') {
            if (
              connection.source &&
              current.some((edge) => edge.source === connection.source)
            ) {
              return current;
            }
          } else if (sourceNode.type === 'option') {
            if (
              connection.sourceHandle &&
              current.some(
                (edge) =>
                  edge.source === connection.source &&
                  edge.sourceHandle === connection.sourceHandle
              )
            ) {
              return current;
            }
          }
        }

        if (
          targetNode &&
          connection.target &&
          current.some((edge) => edge.target === connection.target)
        ) {
          return current;
        }

        return addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'var(--primary)' },
          },
          current
        );
      });
    },
    [nodes, setEdges]
  );

  const npcMetaConfigured =
    typeof npcGamevalValue === 'string' && npcGamevalValue.trim().length > 0;
  const npcMetaConnected = edges.some(
    (edge) =>
      edge.source === 'npc_meta_node' &&
      nodes.some((node) => node.id === edge.target && (node.type === 'npc' || node.type === 'player'))
  );
  const canExport = npcMetaConfigured && npcMetaConnected;

  const handleExportXml = useCallback(() => {
    if (!canExport) {
      if (typeof window !== 'undefined') {
        window.alert(
          !npcMetaConfigured
            ? 'Please set the NPC metadata (gameval) before exporting.'
            : 'Connect the NPC metadata node to at least one dialogue node before exporting.'
        );
      }
      return;
    }

    try {
      const xmlString = buildDialogueXml();
      setXmlPreview(xmlString);
      setXmlModalOpen(true);
    } catch (error) {
      console.error('Failed to export dialogue XML', error);
    }
  }, [buildDialogueXml, canExport, npcMetaConfigured]);

  const handleDownloadXml = useCallback(() => {
    if (!xmlPreview) return;
    const blob = new Blob([xmlPreview], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dialogue-${Date.now()}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [xmlPreview]);

  const handleCopyXml = useCallback(async () => {
    if (!xmlPreview || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(xmlPreview);
    } catch (error) {
      console.error('Failed to copy XML to clipboard', error);
    }
  }, [xmlPreview]);

  const handleImportXml = useCallback(() => {
    setImportModalOpen(true);
  }, []);

  const handlePasteXml = useCallback(() => {
    if (!pastedXml.trim()) {
      if (typeof window !== 'undefined') {
        window.alert('Please paste XML content first.');
      }
      return;
    }
    try {
      loadXmlDocument(pastedXml);
      setImportModalOpen(false);
      setPastedXml('');
      if (typeof window !== 'undefined') {
        window.alert('XML imported successfully!');
      }
    } catch (error) {
      console.error('Failed to import XML:', error);
      if (typeof window !== 'undefined') {
        window.alert('Failed to import XML. Please check the format.');
      }
    }
  }, [pastedXml, loadXmlDocument]);

  const handleLoadAutosaveFromList = useCallback((xml: string) => {
    try {
      loadXmlDocument(xml);
      setImportModalOpen(false);
      if (typeof window !== 'undefined') {
        window.alert('Auto-save loaded successfully!');
      }
    } catch (error) {
      console.error('Failed to load auto-save:', error);
      if (typeof window !== 'undefined') {
        window.alert('Failed to load auto-save.');
      }
    }
  }, [loadXmlDocument]);

  const handleClearAutosaves = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.confirm('Are you sure you want to clear all auto-saves? This cannot be undone.')) {
      localStorage.removeItem('dialogue_editor_autosaves');
      setAutosaves([]);
      lastAutosaveXmlRef.current = '';
      if (typeof window !== 'undefined') {
        window.alert('Auto-saves cleared successfully!');
      }
    }
  }, []);


  const handleFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') {
          loadXmlDocument(text);
          setImportModalOpen(false);
          if (typeof window !== 'undefined') {
            window.alert('XML imported successfully!');
          }
        }
      };
      reader.readAsText(file);
    },
    [loadXmlDocument]
  );

  return (
    <div
      className={cn(
        'flex h-full min-h-[560px] rounded-2xl border bg-background shadow-lg overflow-hidden',
        className
      )}
    >
      <div className="w-60 border-r bg-muted/30 p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Block palette
          </p>
          {DIALOGUE_PALETTE.map((section) => (
            <div key={section.title} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {section.title}
              </p>
              {section.items.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
                  onClick={() => {
                    if (item.type === 'group') {
                      addDialogueNode('group');
                    } else if (item.type === 'container') {
                      addDialogueNode('container');
                    } else if (item.type === 'action') {
                      addDialogueNode('action');
                    } else {
                      addDialogueNode(item.type as DialogueSpeaker);
                    }
                  }}
            >
              <item.icon size={16} style={{ color: item.color }} />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleImportXml}
            >
              <IconFileCode size={16} />
              Import XML
            </Button>
          <div className="text-xs text-muted-foreground text-center pt-1 space-y-1">
            {autosaveStatus === 'saving' && (
              <span className="flex items-center justify-center gap-1">
                <span className="animate-pulse">●</span> Saving...
              </span>
            )}
            {autosaveStatus === 'saved' && (
              <span className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                <span>✓</span> Saved
              </span>
            )}
            {autosaveStatus === 'idle' && (
              <div className="flex flex-col items-center gap-1">
                <span>Next auto-save in {autosaveCountdown}s</span>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${((60 - autosaveCountdown) / 60) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleExportXml}
              disabled={!canExport}
            >
              <IconFileCode size={16} />
              Export XML
            </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => setShowResetConfirm(true)}
          >
            <IconTrash size={16} />
            Reset canvas
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={(() => {
            // Separate nodes into groups: group nodes, inner nodes, and other nodes
            const groupNodes: EditorNode[] = [];
            const innerNodes: EditorNode[] = [];
            const otherNodes: EditorNode[] = [];
            
            nodes.forEach((node) => {
              if (node.type === 'group') {
                if (!groupPositionsRef.current.has(node.id)) {
                  groupPositionsRef.current.set(node.id, { x: node.position.x, y: node.position.y });
                }
                groupNodes.push({ ...node, zIndex: 1 });
              } else if (node.type === 'npcMeta' || node.type === 'container') {
                // Don't add these to groups
                otherNodes.push(node);
              } else {
                const nodeData = node.data as DialogueNodeData;
                if (nodeData.groupId) {
                  innerNodes.push({ ...node, draggable: false, zIndex: 10 });
                } else {
                  otherNodes.push(node);
                }
              }
            });
            
            // Return nodes in order: other nodes, group nodes, then inner nodes (so inner nodes render on top)
            return [...otherNodes, ...groupNodes, ...innerNodes];
          })()}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
          onNodeDrag={(_, node) => {
            // If a group node is being dragged, move all child nodes with it
            if (node.type === 'group') {
              const previousPos = groupPositionsRef.current.get(node.id);
              if (previousPos) {
                const deltaX = node.position.x - previousPos.x;
                const deltaY = node.position.y - previousPos.y;
                
                // Move all child nodes by the same delta
                setNodes((current) => {
                  const updated = current.map((n) => {
                    const nodeData = n.data as DialogueNodeData;
                    if (nodeData.groupId === node.id) {
                      return {
                        ...n,
                        position: {
                          x: n.position.x + deltaX,
                          y: n.position.y + deltaY,
                        },
                        zIndex: 10,
                      };
                    }
                    return n;
                  });
                  
                  // Reorder nodes: other nodes, group nodes, then inner nodes
                  const groupNodes: EditorNode[] = [];
                  const innerNodes: EditorNode[] = [];
                  const otherNodes: EditorNode[] = [];
                  
                  updated.forEach((n) => {
                    const nData = n.data as DialogueNodeData;
                    if (n.type === 'group') {
                      groupNodes.push({ ...n, zIndex: 1 });
                    } else if (nData.groupId && n.type !== 'npcMeta') {
                      innerNodes.push({ ...n, draggable: false, zIndex: 10 });
                    } else {
                      otherNodes.push(n);
                    }
                  });
                  
                  return [...otherNodes, ...groupNodes, ...innerNodes];
                });
              }
              groupPositionsRef.current.set(node.id, { x: node.position.x, y: node.position.y });
            }
          }}
          onNodeDragStop={(_, node) => {
            // Check if node is dropped inside a group
            if (node.type === 'group' || node.type === 'npcMeta' || node.type === 'container' || node.type === 'action') {
              // If a group node was moved, update sizes
              if (node.type === 'group') {
                groupPositionsRef.current.set(node.id, { x: node.position.x, y: node.position.y });
                setTimeout(() => updateGroupSizes(), 0);
              }
              return;
            }
            
            const nodeData = node.data as DialogueNodeData;
            const previousGroupId = nodeData.groupId;
            
            // Prevent dragging nodes out of groups - if node is in a group, don't allow drag
            if (previousGroupId) {
              // Reset position to prevent drag out
              const groupNode = nodes.find((n) => n.id === previousGroupId);
              if (groupNode) {
                // Keep node within group bounds
                const groupPos = groupNode.position;
                const groupWidth = groupNode.width || 400;
                const groupHeight = groupNode.height || 300;
                const padding = 20;
                
                let newX = node.position.x;
                let newY = node.position.y;
                
                // Constrain to group bounds
                if (newX < groupPos.x + padding) newX = groupPos.x + padding;
                if (newX + (node.width || 150) > groupPos.x + groupWidth - padding) {
                  newX = groupPos.x + groupWidth - (node.width || 150) - padding;
                }
                if (newY < groupPos.y + padding) newY = groupPos.y + padding;
                if (newY + (node.height || 100) > groupPos.y + groupHeight - padding) {
                  newY = groupPos.y + groupHeight - (node.height || 100) - padding;
                }
                
                // Update node position if it was constrained
                if (newX !== node.position.x || newY !== node.position.y) {
                  setNodes((current) =>
                    current.map((n) =>
                      n.id === node.id ? { ...n, position: { x: newX, y: newY } } : n
                    )
                  );
                }
              }
              // Update group sizes when node is moved within group
              setTimeout(() => updateGroupSizes(), 0);
              return; // Don't process drag-out for nodes in groups
            }
            
            // Find all group nodes
            const groupNodes = nodes.filter((n) => n.type === 'group');
            
            let foundGroup = false;
            for (const groupNode of groupNodes) {
              const groupData = groupNode.data as GroupNodeData;
              const groupPos = groupNode.position;
              const groupWidth = groupNode.width || 400;
              const groupHeight = groupNode.height || 300;
              
              // Check if node center is within group bounds
              const nodeCenterX = node.position.x + (node.width || 150) / 2;
              const nodeCenterY = node.position.y + (node.height || 100) / 2;
              
              const isInside =
                nodeCenterX >= groupPos.x &&
                nodeCenterX <= groupPos.x + groupWidth &&
                nodeCenterY >= groupPos.y &&
                nodeCenterY <= groupPos.y + groupHeight;
              
              if (isInside) {
                // Check if this is the first child before adding
                const isFirstChild = groupData.childNodeIds.length === 0;
                
                // Find the last node in the group to position new node below it
                let lastNodePosition: { x: number; y: number; height: number } | null = null;
                if (!isFirstChild) {
                  const childNodes = nodes.filter((n) => {
                    const nodeData = n.data as DialogueNodeData;
                    return nodeData.groupId === groupNode.id;
                  });
                  
                  // Find the bottommost node
                  let maxY = -Infinity;
                  childNodes.forEach((child) => {
                    const childY = child.position.y + (child.height || 100);
                    if (childY > maxY) {
                      maxY = childY;
                      lastNodePosition = {
                        x: child.position.x,
                        y: child.position.y,
                        height: child.height || 100,
                      };
                    }
                  });
                }
                
                // Add node to group
                groupData.onAddChild?.(node.id);
                
                // Reposition the node based on whether it's first or subsequent
                const headerHeight = 60; // Approximate height of header with input
                const nodeWidth = node.width || 150;
                let newPosition = node.position;
                
                if (isFirstChild) {
                  // First child: center below header
                  newPosition = {
                    x: groupPos.x + (groupWidth / 2) - (nodeWidth / 2),
                    y: groupPos.y + headerHeight + 20, // 20px padding below header
                  };
                } else if (lastNodePosition) {
                  // Subsequent nodes: stack below the last node
                  newPosition = {
                    x: lastNodePosition.x, // Align with previous node
                    y: lastNodePosition.y + lastNodePosition.height + 20, // 20px spacing
                  };
                }
                
                // Update node position and recalculate group sizes in one go
                setNodes((current) => {
                  const withNewPosition = current.map((n) => {
                    if (n.id === node.id) {
                      return {
                        ...n,
                        position: newPosition,
                      };
                    }
                    return n;
                  });
                  // Immediately recalculate group sizes with the new node position
                  return updateGroupSizesInNodes(withNewPosition);
                });
                
                foundGroup = true;
                break;
              }
            }
            
            // Update group sizes after drag (for any other changes)
            setTimeout(() => updateGroupSizes(), 0);
          }}
          panOnScroll
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          className="bg-background"
        >
          <Background gap={18} size={1} color="var(--border)" />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) => {
              if (node.type === 'npcMeta') return '#facc15';
              if (node.type === 'group') return '#10b981';
              if (node.type === 'option') return '#a855f7';
              if (node.type === 'container') {
                const containerData = node.data as ContainerNodeData;
                return containerData.containerType === 'inventory' ? '#8b5cf6' : '#ec4899';
              }
              if (node.type === 'action') {
                const actionData = node.data as ActionNodeData;
                return actionData.containerType === 'inventory' ? '#8b5cf6' : '#ec4899';
              }
              return node.data && (node.data as DialogueNodeData).speaker === 'npc'
                ? '#f97316'
                : '#3b82f6';
            }}
          />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/xml,.xml"
        className="hidden"
        onChange={handleFileSelected}
      />
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import XML</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="paste">Paste XML</TabsTrigger>
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="autosaves">Auto-saves ({autosaves.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="space-y-4 mt-4">
              <Textarea
                placeholder="Paste your XML here..."
                value={pastedXml}
                onChange={(e) => setPastedXml(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePasteXml}>
                  Import
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="file" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8">
                <IconFileCode size={48} className="text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Select an XML file to import
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      fileInputRef.current.click();
                    }
                  }}
                >
                  Choose File
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="autosaves" className="space-y-4 mt-4">
              {autosaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No auto-saves found.</p>
                  <p className="text-xs mt-2">Auto-saves are created every minute.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {autosaves.map((autosave, idx) => (
                    <div
                      key={autosave.timestamp}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleLoadAutosaveFromList(autosave.xml)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {autosave.sessionId === sessionIdRef.current ? 'Current Session' : `Session ${autosaves.length - idx}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(autosave.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadAutosaveFromList(autosave.xml);
                        }}
                      >
                        Load
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearAutosaves}
                  className="text-destructive hover:text-destructive"
                >
                  Clear All
                </Button>
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                  Close
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset canvas?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will clear all dialogue nodes and restore the default setup. This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowResetConfirm(false);
                initializeNodes();
              }}
            >
              Reset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={xmlModalOpen} onOpenChange={setXmlModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dialogue XML Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full h-72 rounded-md border border-border bg-muted/40 p-3 font-mono text-xs"
              value={xmlPreview}
              readOnly
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyXml}>
                Copy
              </Button>
              <Button size="sm" onClick={handleDownloadXml}>
                Download XML
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogueBlockEditor(props: DialogueBlockEditorProps) {
  return (
    <ReactFlowProvider>
      <DialogueBlockEditorInner {...props} />
    </ReactFlowProvider>
  );
}

export default function AlterPage() {
  const [activeTab, setActiveTab] = useState('dialogue');

  return (
    <PageContainer scrollable>
      <div className="container mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="dialogue" className="flex-1 gap-2">
              <IconMessage2 size={16} />
              Dialogue Editor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dialogue" className="space-y-6">
            <div className="rounded-2xl border bg-background shadow-lg overflow-hidden h-[calc(100dvh-140px)]">
              <DialogueBlockEditor className="h-full" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
