import React from "react";
import type { SearchModeConfig } from "./gameval";

const id: SearchModeConfig = {
    value: 'id',
    label: 'ID',
    placeholder: 'ID search (e.g. "10 + 100" supported)',
    help: (
        <>
            <b>ID mode:</b><br />
            <ul className="pl-4 list-disc">
                <li>Search by numeric ID.</li>
                <li>Supports math expressions (e.g. <code>10 + 100</code>).</li>
            </ul>
        </>
    ),
};

export default id; 