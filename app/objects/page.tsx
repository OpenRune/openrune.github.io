"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";

export default function ObjectSearch() {
    return (
        <SearchTable
            name = "Objects"
            baseUrl="/public/objects"
            filters={[
                { key: "interactiveOnly", label: "Interactive Only" },
                { key: "requireName", label: "Require Name" },
            ]}
            columns={[
                {
                    key: "image",
                    label: "Image",
                    render: (row) => (
                        <img
                            src={`https://chisel.weirdgloop.org/static/img/osrs-object/${row.id}_orient1.png`}
                            onError={(e) => {
                                e.currentTarget.src =
                                    "https://oldschool.runescape.wiki/images/Bank_filler_detail.png?7d983";
                            }}
                            className="w-12 h-12 object-contain"
                            alt={row.name || "Object image"}
                        />
                    ),
                },
                { key: "id", label: "ID" },
                { key: "name", label: "Name" },
                { key: "gameval", label: "Gameval" },
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