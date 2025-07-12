"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";

export default function NpcsSearch() {
    return (
        <SearchTable
            name = "Npcs"
            baseUrl="/public/npcs"
            filters={[
                { key: "noted", label: "Noted Items" }
            ]}
            columns={[
                {
                    key: "image",
                    label: "Image",
                    render: (row) => (
                        <img
                            width={32}
                            height={32}
                            src={`https://chisel.weirdgloop.org/static/img/osrs-npc/${row.id}_128.png`}
                            onError={(e) => {
                                e.currentTarget.src =
                                    "https://oldschool.runescape.wiki/images/Bank_filler_detail.png?7d983";
                            }}
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