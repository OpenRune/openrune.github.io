"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import RSSprite from "@/lib/RSSprite";

export default function ItemSearch() {
    return (
        <SearchTable
            name = "Sprites"
            baseUrl="/public/sprites"
            disabledModes={["name"]}
            columns={[
                {
                    key: "image",
                    label: "Image",
                    render: (row) => (
                        <RSSprite
                            id={row.id}
                            width={32}
                            height={32}
                            rounded
                            thumbnail
                            onClick={() => console.log("Clicked", row.id)}
                        />
                    ),
                },
                { key: "id", label: "ID" },
                { key: "gameval", label: "Gameval" }
            ]}
        />
    );
}