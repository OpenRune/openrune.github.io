import React from "react";
import { Badge } from "@/components/ui/badge";
import { IconTarget, IconCircleDashed } from "@tabler/icons-react";

// Reuse the SearchTag component from SearchTable
function SearchTag({ value, exact, onToggle, onRemove }: { value: string; exact: boolean; onToggle: () => void; onRemove: () => void }) {
    return (
        <Badge
            variant={exact ? "default" : "secondary"}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono select-none ${exact ? 'border border-primary bg-primary/10 text-primary' : ''}`}
            style={{ minWidth: 0, maxWidth: 160, height: 22 }}
        >
            <span className="flex items-center" style={{ width: 18, justifyContent: 'center' }}>
                <button
                    className={`p-0.5 focus:outline-none ${exact ? 'text-primary' : 'text-muted-foreground'} hover:text-primary flex items-center`}
                    onClick={onToggle}
                    aria-label={`Toggle exact for ${value}`}
                    type="button"
                    tabIndex={0}
                >
                    {exact ? <IconTarget size={13} /> : <IconCircleDashed size={13} />}
                </button>
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

interface GamevalTagsProps {
    tags: { value: string; exact: boolean }[];
    onToggle: (idx: number) => void;
    onRemove: (idx: number) => void;
    onClear: () => void;
}

const GamevalTags: React.FC<GamevalTagsProps> = ({ tags, onToggle, onRemove, onClear }) => (
    <div className="flex flex-col gap-1 mt-1 pl-1">
        <div className="flex flex-wrap gap-1 items-center">
            {tags.map((item, idx) => (
                <SearchTag
                    key={item.value}
                    value={item.value}
                    exact={item.exact}
                    onToggle={() => onToggle(idx)}
                    onRemove={() => onRemove(idx)}
                />
            ))}
            {tags.length > 0 && (
                <button
                    className="ml-2 px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs hover:bg-destructive/80"
                    onClick={onClear}
                    type="button"
                    aria-label="Clear all values"
                >
                    Clear All
                </button>
            )}
        </div>
    </div>
);

export default GamevalTags; 