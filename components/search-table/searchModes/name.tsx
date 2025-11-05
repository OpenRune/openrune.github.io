import React from "react";
import type { SearchModeConfig } from "./gameval";

const name: SearchModeConfig = {
    value: 'name',
    label: 'Name',
    placeholder: 'Search by name (partial matches)',
    help: (
        <div className="space-y-2 text-sm text-white">
            <div className="font-semibold text-base text-white">Name Search Mode</div>
            <div className="space-y-1.5">
                <p className="text-white/90">Search by name with partial matching support.</p>
                <div>
                    <p className="font-medium mb-1 text-white">Features:</p>
                    <ul className="pl-4 list-disc space-y-0.5 text-xs text-white/90">
                        <li>Partial matching (substring search)</li>
                        <li>Case-insensitive by default</li>
                        <li>Finds names containing your search term</li>
                    </ul>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs font-medium mb-1 text-white">Examples:</p>
                    <div className="space-y-1 text-xs">
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">tree</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">oak tree</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">sword</div>
                    </div>
                    <p className="text-xs text-white/70 mt-1 italic">Matches any name containing the search term</p>
                </div>
            </div>
        </div>
    ),
};

export default name; 