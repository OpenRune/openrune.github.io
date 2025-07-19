import React from "react";
import type { SearchModeConfig } from "./gameval";

const name: SearchModeConfig = {
    value: 'name',
    label: 'Name',
    placeholder: '',
    help: (
        <>
            <b>Name mode:</b><br />
            <ul className="pl-4 list-disc">
                <li>Search by name (partial matches allowed).</li>
            </ul>
        </>
    ),
};

export default name; 