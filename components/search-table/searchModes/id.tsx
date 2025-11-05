import React from "react";
import type { SearchModeConfig } from "./gameval";

const id: SearchModeConfig = {
    value: 'id',
    label: 'ID',
    placeholder: 'ID search (e.g. "10 + 100" supported)',
    help: (
        <div className="space-y-2 text-sm text-white">
            <div className="font-semibold text-base text-white">ID Search Mode</div>
            <div className="space-y-1.5">
                <p className="text-white/90">Search by numeric ID values.</p>
                <div>
                    <p className="font-medium mb-1 text-white">Features:</p>
                    <ul className="pl-4 list-disc space-y-0.5 text-xs text-white/90">
                        <li>Enter single IDs: <code className="px-1 py-0.5 bg-zinc-800 rounded text-xs font-mono text-white">10</code></li>
                        <li>Multiple IDs with addition: <code className="px-1 py-0.5 bg-zinc-800 rounded text-xs font-mono text-white">10 + 100</code></li>
                        <li>Ranges using plus: <code className="px-1 py-0.5 bg-zinc-800 rounded text-xs font-mono text-white">50 + 60 + 70</code></li>
                    </ul>
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs font-medium mb-1 text-white">Examples:</p>
                    <div className="space-y-1 text-xs font-mono">
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">10</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">10 + 100</div>
                        <div className="px-2 py-1 bg-zinc-800 rounded text-white">5 + 10 + 15</div>
                    </div>
                </div>
            </div>
        </div>
    ),
};

export default id; 