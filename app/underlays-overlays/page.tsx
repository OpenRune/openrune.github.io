"use client";

import SearchTable from "@/components/SearchTable";
import RSColorBox from "@/components/ui/RSColorBox";
import RSTexture from "@/lib/RSTexture";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function UnderlaysOverlaysSearch() {
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <div className="w-full">
            <Tabs defaultValue="overlays" className="w-full">
                <div className="w-full mb-4">
                    <div className="w-full max-w-7xl mx-auto px-4">
                        <TabsList className="w-full">
                            <TabsTrigger value="overlays" className="flex-1">Overlays</TabsTrigger>
                            <TabsTrigger value="underlays" className="flex-1">Underlays</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="overlays" className="!mt-0">
                    <div className="[&>div]:!h-[calc(100vh-80px)] [&>div]:!gap-0">
                        <SearchTable
                            name="Overlays"
                            baseUrl="/public/overlays"
                            disabledModes={["name", "gameval"]}
                            defaultSearchMode="id"
                            columns={[
                            { key: "id", label: "ID" },
                            {
                                key: "extra.primaryRgb",
                                label: "Primary RGB",
                                render: (row) => (
                                    <RSColorBox
                                        width={32}
                                        height={32}
                                        packedHsl={row.extraData?.primaryRgb}
                                        showHex={false}
                                        tooltip={true}
                                    />
                                ),
                            },
                            {
                                key: "extra.secondaryRgb",
                                label: "Secondary RGB",
                                render: (row) => {
                                    const secondaryRgb = row.extraData?.secondaryRgb;
                                    if (secondaryRgb === -1 || secondaryRgb === undefined) {
                                        return <span className="text-muted-foreground">-</span>;
                                    }
                                    return (
                                        <RSColorBox
                                            width={32}
                                            height={32}
                                            packedHsl={secondaryRgb}
                                            showHex={false}
                                            tooltip={true}
                                        />
                                    );
                                },
                            },
                            {
                                key: "extra.texture",
                                label: "Texture",
                                render: (row) => {
                                    const texture = row.extraData?.texture;
                                    if (texture === -1 || texture === undefined) {
                                        return <span className="text-muted-foreground">-</span>;
                                    }
                                    return (
                                        <RSTexture 
                                            id={texture}
                                            width={32}
                                            height={32}
                                            rounded
                                            thumbnail
                                            saveSprite={true}
                                            enableClickModel={true}
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
                                    );
                                },
                            },
                            {
                                key: "extra.water",
                                label: "Water",
                                render: (row) => {
                                    const water = row.extraData?.water;
                                    if (water === -1 || water === undefined) {
                                        return <span className="text-muted-foreground">-</span>;
                                    }
                                    return water;
                                },
                            },
                            {
                                key: "extra.hideUnderlay",
                                label: "Hide Underlay",
                                render: (row) => {
                                    const hideUnderlay = row.extraData?.hideUnderlay;
                                    return hideUnderlay ? "Yes" : "No";
                                },
                            },
                        ]}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="underlays" className="!mt-0">
                    <div className="[&>div]:!h-[calc(100vh-80px)] [&>div]:!gap-0">
                        <SearchTable
                            name="Underlays"
                            baseUrl="/public/underlays"
                            disabledModes={["name", "gameval"]}
                            defaultSearchMode="id"
                            columns={[
                            { key: "id", label: "ID" },
                            {
                                key: "extra.rgb",
                                label: "RGB",
                                render: (row) => (
                                    <RSColorBox
                                        width={32}
                                        height={32}
                                        packedHsl={row.extraData?.rgb}
                                        showHex={false}
                                        tooltip={true}
                                    />
                                ),
                            },
                        ]}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
