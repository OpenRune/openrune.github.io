"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";

export default function AnimationsSearch() {
    return (
        <SearchTable
            name = "Animations"
            baseUrl="/public/seq"
            disabledModes={["name"]}
            columns={[
                { key: "id", label: "ID" },
                { key: "gameval", label: "Gameval" },
                {
                    key: "extra.length",
                    label: "Tick Duration",
                    render: (row) => {
                        const ticks = row.extraData?.length ?? 0;
                        const seconds = (ticks * 0.6).toFixed(1);
                        return `${ticks} ticks (${seconds}s)`;
                    },
                },
                {
                    key: "view",
                    label: "View",
                    render: (row) => (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => alert(`View data for object ID ${row.id}`)}
                        >
                            View
                        </Button>
                    ),
                },
            ]}
        />
    );
}