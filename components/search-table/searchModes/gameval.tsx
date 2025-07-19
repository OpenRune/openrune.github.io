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
        <>
            <b>Gameval mode:</b><br />
            <ul className="pl-4 list-disc">
                <li>Type a value and press <kbd>Enter</kbd> to add it as a <b>tag</b> below the search bar.</li>
                <li>Each tag is a separate search value.</li>
                <li>
                  Click
                  <span className="inline-flex items-center mx-1">
                    <IconTarget size={12} className="inline mr-1 text-primary" /> <span className="text-xs font-semibold">Exact</span>
                  </span>
                  or
                  <span className="inline-flex items-center mx-1">
                    <IconCircleDashed size={12} className="inline mr-1 text-muted-foreground" /> <span className="text-xs font-semibold">Fuzzy</span>
                  </span>
                  to toggle <b>exact match</b>.
                </li>
                <li>If there are no tags, your current input is used for live search.</li>
                <li>Use <b>Clear All</b> to remove all tags.</li>
            </ul>
            <span className="text-muted-foreground">Example: <kbd>TREE</kbd> <kbd>Enter</kbd> → <kbd>"TREE"</kbd> (Exact on) → <kbd>Clear All</kbd></span>
        </>
    ),
};

export default gameval; 