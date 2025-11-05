import { IconTarget, IconCircleDashed } from "@tabler/icons-react";
import React from "react";

export interface SearchModeConfig {
    value: string;
    label: string;
    placeholder: string;
    help: React.ReactNode;
}

const gameval: SearchModeConfig = {
    value: 'gameval',
    label: 'Gameval',
    placeholder: 'Paste or type values (comma, space, or newline separated)',
    help: (
        <div className="space-y-2 text-sm text-white">
            <div className="font-semibold text-base text-white">Gameval Search Mode</div>
            <div className="space-y-1.5">
                <p className="text-white/90">Search by gameval values with tag-based filtering.</p>
                <div>
                    <p className="font-medium mb-1 text-white">How to use:</p>
                    <ul className="pl-4 list-disc space-y-0.5 text-xs text-white/90">
                        <li>Type a value and press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs border border-zinc-700 text-white">Enter</kbd> to add it as a tag</li>
                        <li>Each tag is a separate search value</li>
                        <li>Click the tag icon to toggle between exact and fuzzy match</li>
                        <li>If no tags exist, your input is used for live search</li>
                        <li>Use <b className="text-white">Clear All</b> to remove all tags</li>
                    </ul>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs font-medium mb-1.5 text-white">Tag States:</p>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-white">
                                <IconTarget size={12} className="text-blue-400" />
                                <span className="font-mono">"TREE"</span>
                            </span>
                            <span className="text-white/90">Exact match</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white">
                                <IconCircleDashed size={12} className="text-white/70" />
                                <span className="font-mono">TREE</span>
                            </span>
                            <span className="text-white/90">Fuzzy match</span>
                        </div>
                    </div>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs font-medium mb-1 text-white">Examples:</p>
                    <div className="space-y-1 text-xs">
                        <div className="px-2 py-1 bg-zinc-800 rounded font-mono text-white">TREE</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded font-mono text-white">TREE, ROCK, STONE</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded font-mono text-white">"EXACT VALUE"</div>
                    </div>
                </div>
            </div>
        </div>
    ),
};

export default gameval; 