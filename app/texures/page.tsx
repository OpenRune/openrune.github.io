"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import RSSprite from "@/lib/RSSprite";
import RSColorBox from "@/components/ui/RSColorBox";

export default function TextureSearch() {
    return (
        <SearchTable
            name = "Textures"
            baseUrl="/public/textures"
            filters={[
                { key: "noted", label: "Noted Items" }
            ]}
            columns={[
                {
                    key: "image",
                    label: "Image",
                    render: (row) => (
                        <RSSprite
                            id={row.extraData.fileIds[0]}
                            width={64}
                            height={64}
                            rounded
                            thumbnail
                            onClick={() => console.log("Clicked", row.id)}
                        />
                    ),
                },
                { key: "id", label: "ID" },
                { key: "gameval", label: "Gameval" },
                {
                    key: "extra.averageRgb",
                    label: "Average RGB" ,
                    render: (row) => (
                        <RSColorBox
                            width={64}
                            height={64}
                            packedHsl={row.extraData.averageRgb}
                            showHex={true}
                            tooltip={true}
                        />
                    ),
                },
                { key: "extra.isTransparent", label: "Transparency" },
                { key: "extra.animationSpeed", label: "Speed" },
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