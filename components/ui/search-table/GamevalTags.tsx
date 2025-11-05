'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { IconTarget, IconCircleDashed } from '@tabler/icons-react';

interface Tag {
  value: string;
  exact: boolean;
}

interface GamevalTagsProps {
  tags: Tag[];
  onToggle: (idx: number) => void;
  onRemove: (idx: number) => void;
  onClear: () => void;
}

function stripQuotes(str: string) {
  return str.replace(/^"(.+)"$/, '$1');
}

function SearchTag({ value, exact, onToggle, onRemove }: { value: string; exact: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <Badge
      variant={exact ? "default" : "secondary"}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono select-none ${exact ? 'border border-primary bg-primary/10 text-primary' : ''}`}
      style={{ minWidth: 0, maxWidth: 160, height: 22 }}
    >
      <span className="flex items-center" style={{ width: 18, justifyContent: 'center' }}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`p-0.5 focus:outline-none ${exact ? 'text-primary' : 'text-muted-foreground'} hover:text-primary flex items-center`}
                onClick={onToggle}
                aria-label={`Toggle exact for ${value}`}
                type="button"
                tabIndex={0}
              >
                {exact ? <IconTarget size={13} /> : <IconCircleDashed size={13} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {exact ? 'Exact match' : 'Fuzzy match'}
              <br />
              Click to toggle mode
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
      <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', fontSize: 12 }} className="select-none">
        <span style={{ visibility: exact ? 'visible' : 'hidden' }}>
          "
        </span>
        {value}
        <span style={{ visibility: exact ? 'visible' : 'hidden' }}>
          "
        </span>
      </span>
      <button
        className="ml-0.5 text-muted-foreground hover:text-destructive text-xs"
        onClick={onRemove}
        aria-label={`Remove ${value}`}
        type="button"
      >
        ×
      </button>
    </Badge>
  );
}

export default function GamevalTags({ tags, onToggle, onRemove, onClear }: GamevalTagsProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag, idx) => (
        <SearchTag
          key={idx}
          value={tag.value}
          exact={tag.exact}
          onToggle={() => onToggle(idx)}
          onRemove={() => onRemove(idx)}
        />
      ))}
      <button
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-destructive px-1"
        type="button"
      >
        Clear all
      </button>
    </div>
  );
}






