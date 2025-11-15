// @ts-nocheck
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PageContainer from '@/components/layout/page-container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  IconFileCode,
  IconMessage2,
  IconMessageCircle2,
  IconListDetails,
  IconTrash,
  IconUser,
} from '@tabler/icons-react';
import type { GamevalSuggestion } from '@/components/search/GamevalIdSearch';
import {
  DialogueNodeData,
  DialogueSpeaker,
  OptionEntry,
  NpcMetaNodeData,
  DIALOGUE_EXPRESSIONS,
  NpcDialogueNode,
  PlayerDialogueNode,
  OptionNode,
  NpcMetaNode,
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

const DIALOGUE_PALETTE = [
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
];

const DEFAULT_SCRIPT: Omit<DialogueBlock, 'id'>[] = [
  {
    speaker: 'npc',
    text: 'Greetings, adventurer! Ready to learn the basics of Gielinor?',
  },
  {
    speaker: 'player',
    text: 'Absolutely, show me the ropes.',
  },
];

const nodeTypes: NodeTypes = {
  npc: NpcDialogueNode,
  player: PlayerDialogueNode,
  option: OptionNode,
  npcMeta: NpcMetaNode,
};

type EditorNodeData = DialogueNodeData | NpcMetaNodeData;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          npcLabel: npcGamevalValue || 'NPC',
          npcId: options?.npcId ?? '',
          expression: options?.expression ?? DIALOGUE_EXPRESSIONS[0].value,
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
                npcLabel: label,
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
      const label = suggestion.name || value || 'NPC';
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
                npcLabel: label,
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

  const initializeNodes = useCallback(() => {
    orderRef.current = 0;
    const metaNode = createNpcMetaNode();
    const npcNode = createNode('npc', {
      text: DEFAULT_SCRIPT[0].text,
      position: { x: 140, y: 140 },
    });
    const playerPrimary = createNode('player', {
      text: DEFAULT_SCRIPT[1].text,
      position: { x: 440, y: 140 },
    });

    setNodes([metaNode, npcNode, playerPrimary]);
    setEdges([
      {
        id: `edge-${metaNode.id}-${npcNode.id}`,
        source: metaNode.id,
        target: npcNode.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--border)', strokeWidth: 1.5 },
      },
      {
        id: `edge-${npcNode.id}-${playerPrimary.id}`,
        source: npcNode.id,
        target: playerPrimary.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--border)', strokeWidth: 1.5 },
      },
    ]);
  }, [createNode, setEdges, setNodes]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeNodes();
    }
  }, [initializeNodes]);

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

  const addDialogueNode = useCallback(
    (speaker: DialogueSpeaker) => {
      setNodes((current) => [...current, createNode(speaker)]);
    },
    [createNode, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

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
            setAttribute(dialogueEl, 'name', nodeData.npcLabel);
            setAttribute(dialogueEl, 'npcId', nodeData.npcId);
          }
          setAttribute(dialogueEl, 'expression', nodeData.expression);
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

        const metaNode = {
          id: 'npc_meta_node',
          type: 'npcMeta',
          position: { x: -220, y: 60 },
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

        const nodeElements = Array.from(doc.getElementsByTagName('nodes')[0]?.children ?? []);
        nodeElements.forEach((el) => {
          const id = el.getAttribute('id') ?? `imported_${Date.now()}`;
          const order = parseInt(el.getAttribute('order') ?? '0', 10);
          const posEl = el.getElementsByTagName('position')[0];
          const position = posEl
            ? {
                x: parseInt(posEl.getAttribute('x') ?? '0', 10),
                y: parseInt(posEl.getAttribute('y') ?? '0', 10),
              }
            : { x: 0, y: 0 };

          if (el.tagName === 'npc' || el.tagName === 'player') {
            const textContent = el.getElementsByTagName('text')[0]?.textContent ?? '';
            const nodeData: DialogueNodeData = {
              id,
              speaker: el.tagName === 'npc' ? 'npc' : 'player',
              text: textContent,
              expression: el.getAttribute('expression') ?? undefined,
              npcId: el.getAttribute('npcId') ?? undefined,
              npcLabel: el.getAttribute('name') ?? undefined,
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
                onChange: (key: keyof DialogueNodeData, value: any) => {
                  setNodes((current) =>
                    current.map((node) =>
                      node.id === id ? { ...node, data: { ...node.data, [key]: value } } : node
                    )
                  );
                },
              },
            });
          } else if (el.tagName === 'optionsNode') {
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
          }
        });

        const edgeElements = Array.from(doc.getElementsByTagName('edge'));
        edgeElements.forEach((edgeEl, idx) => {
          const source = edgeEl.getAttribute('source');
          const target = edgeEl.getAttribute('target');
          if (source && target) {
            newEdges.push({
              id: edgeEl.getAttribute('id') ?? `edge-${idx}`,
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
        console.error('Failed to import XML', error);
        if (typeof window !== 'undefined') {
          window.alert('Failed to import XML. Please ensure the file is valid.');
        }
      }
    },
    [
      handleGamevalModeChange,
      handleGamevalValueChange,
      handleNpcSuggestionSelect,
      setEdges,
      setNodes,
    ]
  );

  const handleImportXml = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
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
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Block palette
          </p>
          {DIALOGUE_PALETTE.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => addDialogueNode(item.type)}
            >
              <item.icon size={16} style={{ color: item.color }} />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
        <div className="space-y-2 pt-4">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleImportXml}
            >
              <IconFileCode size={16} />
              Import XML
            </Button>
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
          </div>
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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
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
              if (node.type === 'option') return '#a855f7';
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
