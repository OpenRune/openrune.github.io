import React from "react";
import type { SearchModeConfig } from "./gameval";

const regex: SearchModeConfig = {
    value: 'regex',
    label: 'Regex',
    placeholder: '',
    help: (
        <>
            <b>Regex mode:</b><br />
            <ul className="pl-4 list-disc">
                <li>Enter a regular expression to match values.</li>
            </ul>
        </>
    ),
};

export default regex; 