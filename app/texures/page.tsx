"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import RSSprite from "@/lib/RSSprite";
import RSColorBox from "@/components/ui/RSColorBox";
import {useState} from "react";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {GameValElement} from "@/lib/api/types";

export default function TextureSearch() {
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            <SearchTable
                name="Textures"
                baseUrl="/public/textures"
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
                                saveSprite={true}
                                onClick={() => console.log("Clicked", row.id)}
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
                                    setDialogOpen(true);
                                }}
                            >
                                View
                            </Button>
                        ),
                    },
                ]}
            />

            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setSelectedRow(null);
            }}>
                <DialogContent className="max-h-[60vh] overflow-y-auto flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            Attachments for Texture ID {selectedRow?.id}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedRow && (() => {
                        const attachments = selectedRow.extraData.attachments;
                        if (!attachments) return null;

                        const { overlays, total, models } = attachments;
                        const hasItems = models?.items?.length > 0;
                        const hasObjects = models?.objects?.length > 0;
                        const hasNpcs = models?.npcs?.length > 0;
                        const hasOverlays = overlays?.length > 0;

                        return (
                            <div className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-2">
                                <div><strong>Total:</strong> {total}</div>

                                {hasOverlays && (
                                    <div>
                                        <strong>Overlays:</strong>{" "}
                                        {overlays.join(", ")}
                                    </div>
                                )}

                                {hasItems && (
                                    <div>
                                        <strong>Items:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2">
                                            <ul className="list-disc ml-4">
                                                {models.items.map((item: GameValElement, i: number) => (
                                                    <li key={`item-${i}`}>
                                                        {item.name} (ID: {item.id})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {hasObjects && (
                                    <div>
                                    <strong>Objects:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2">
                                            <ul className="list-disc ml-4">
                                                {models.objects.map((obj: GameValElement, i: number) => (
                                                    <li key={`obj-${i}`}>
                                                        {obj.name} (ID: {obj.id})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {hasNpcs && (
                                    <div>
                                    <strong>NPCs:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2">
                                            <ul className="list-disc ml-4">
                                                {models.npcs.map((npc: GameValElement, i: number) => (
                                                    <li key={`npc-${i}`}>
                                                        {npc.name} (ID: {npc.id})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </>
    );
}