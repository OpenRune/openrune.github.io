import React from "react";
import type { SearchModeConfig } from "./gameval";

const regex: SearchModeConfig = {
    value: 'regex',
    label: 'Regex',
    placeholder: 'Enter regex pattern (e.g. "^tree.*")',
    help: (
        <div className="space-y-2 text-sm text-white">
            <div className="font-semibold text-base text-white">Regex Search Mode</div>
            <div className="space-y-1.5">
                <p className="text-white/90">Search using regular expressions for advanced pattern matching.</p>
                <div>
                    <p className="font-medium mb-1 text-white">Features:</p>
                    <ul className="pl-4 list-disc space-y-0.5 text-xs text-white/90">
                        <li>Full regex pattern support</li>
                        <li>Case-sensitive matching</li>
                        <li>Use anchors, quantifiers, and groups</li>
                    </ul>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs font-medium mb-1 text-white">Examples:</p>
                    <div className="space-y-1 text-xs font-mono">
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">
                            <span className="text-blue-300">^tree</span> - Starts with "tree"
                        </div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">
                            <span className="text-blue-300">.*rock$</span> - Ends with "rock"
                        </div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">
                            <span className="text-blue-300">(tree|rock)</span> - Matches "tree" or "rock"
                        </div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">
                            <span className="text-blue-300">^[A-Z]{4}</span> - Exactly 4 uppercase letters
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ),
};

export default regex; 