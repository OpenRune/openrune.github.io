"use client";

import { useState, useEffect, useCallback } from 'react';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { BlockEditor, Block } from './NodeEditor';

interface UseBlockEditorOptions {
  onExecute?: (blocks: Block[]) => void;
  mapInstance?: any;
}

export function useBlockEditor({ onExecute, mapInstance }: UseBlockEditorOptions = {}) {
  const [open, setOpen] = useState(false);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);

  // Open block editor via command palette
  const openBlockEditor = useCallback(() => {
    setOpen(false);
    setBlockEditorOpen(true);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const CommandPalette = useCallback(() => {
    return (
      <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette">
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Map Tools">
            <CommandItem onSelect={openBlockEditor}>
              <span>Open Block Query Editor</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );
  }, [open, openBlockEditor]);

  const BlockEditorComponent = useCallback(() => {
    return (
      <BlockEditor
        open={blockEditorOpen}
        onOpenChange={setBlockEditorOpen}
        onExecute={onExecute}
        mapInstance={mapInstance}
      />
    );
  }, [blockEditorOpen, onExecute, mapInstance]);

  return {
    CommandPalette,
    BlockEditorComponent,
    openBlockEditor,
    isOpen: blockEditorOpen,
    setBlockEditorOpen,
  };
}

