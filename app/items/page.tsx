"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";

export default function ItemSearch() {
    return (
        <SearchTable
            name = "Items"
            baseUrl="/public/items"
            filters={[
                { key: "noted", label: "Noted Items" }
            ]}
            columns={[
                {
                    key: "image",
                    label: "Image",
                    render: (row) => (
                        <img
                            src={`https://chisel.weirdgloop.org/static/img/osrs-sprite/${row.id}.png`}
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
                { key: "extra.noted", label: "Noted" },
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