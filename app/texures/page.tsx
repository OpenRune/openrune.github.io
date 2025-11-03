"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import RSSprite from "@/lib/RSSprite";
import RSColorBox from "@/components/ui/RSColorBox";
import {useState} from "react";
import {GameValElement} from "@/lib/api/types";
import RSTexture, { setTexturesCache } from "@/lib/RSTexture";

export default function TextureSearch() {
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Populate texture cache when table results are loaded
    const handleResultsChange = (results: any[]) => {
        // Update the texture cache with the loaded results
        setTexturesCache(results);
    };

    return (
        <>
            <SearchTable
                name="Textures"
                baseUrl="/public/textures"
                onResultsChange={handleResultsChange}
                columns={[
                    {
                        key: "image",
                        label: "Image",
                        render: (row) => (
                            <RSTexture
                                key={row.id}
                                id={row.id}
                                width={64}
                                height={64}
                                rounded
                                thumbnail
                                saveSprite={true}
                                enableClickModel={true}
                                gameval={row.gameval}
                                extraData={row.extraData}
                                textureData={row} // Pass full row data to avoid cache lookup
                                modalOpen={selectedRow?.id === row.id ? modalOpen : false}
                                onModalOpenChange={(open) => {
                                    if (open) {
                                        setSelectedRow({ ...row });
                                        setModalOpen(true);
                                    } else {
                                        setModalOpen(false);
                                        setSelectedRow(null);
                                    }
                                }}
                            />
                        ),
                    },
                    { key: "id", label: "ID" },
                    { key: "gameval", label: "Gameval" },
                    {
                        key: "extra.averageRgb",
                        label: "Average RGB",
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
                    { key: "extra.attachmentsTotal", label: "Attachments" },
                    {
                        key: "view",
                        label: "View",
                        render: (row) => (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setSelectedRow(row);
                                    setModalOpen(true);
                                }}
                            >
                                View
                            </Button>
                        ),
                    },
                ]}
            />
        </>
    );
}