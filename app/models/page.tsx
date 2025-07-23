"use client";

import { useState } from "react";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import RSSprite from "@/lib/RSSprite";
import RSColorBox from "@/components/ui/RSColorBox";
import {GameValElement} from "@/lib/api/types";

export default function ModelSearch() {
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            <SearchTable
                name="Models"
                baseUrl="/public/models"
                disabledModes={["name", "gameval"]}
                defaultSearchMode="id"
                columns={[
                    { key: "id", label: "ID" },
                    { key: "extra.totalFaces", label: "Faces" },
                    { key: "extra.totalVerts", label: "Verts" },
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
                        <DialogTitle>Attachments for Model ID {selectedRow?.id}</DialogTitle>
                    </DialogHeader>

                    {selectedRow && (() => {
                        const attachments = selectedRow.extraData.attachments;
                        if (!attachments) return null;

                        const hasItems = attachments.items?.length > 0;
                        const hasObjects = attachments.objects?.length > 0;
                        const hasNpcs = attachments.npcs?.length > 0;
                        const hasColors = selectedRow.extraData.colors?.length > 0;
                        const hasTextures = selectedRow.extraData.textures?.length > 0;

                        return (
                            <div className="text-sm max-h-[75vh] overflow-y-auto pr-2">

                                {selectedRow && (
                                    <div className="mb-4 text-sm space-x-4">
                                        <span><strong>Faces:</strong> {selectedRow.extraData.totalFaces}</span>
                                        <span><strong>Verts:</strong> {selectedRow.extraData.totalVerts}</span>
                                    </div>
                                )}

                                {hasColors && (
                                    <div>
                                        <strong>Colors:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-4 gap-2">
                                            {selectedRow.extraData.colors.map((color: number, i: number) => (
                                                <div key={`color-${i}`} className="flex flex-col items-center text-xs">
                                                    <RSColorBox width={32} height={32} packedHsl={color} tooltip={true} />
                                                    <span>0x{color.toString(16).padStart(6, '0').toUpperCase()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {hasTextures && (
                                    <div>
                                        <strong>Textures:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2 grid grid-cols-4 gap-2">
                                            {selectedRow.extraData.textures.map((tex: number, i: number) => (
                                                <div key={`texture-${i}`} className="flex flex-col items-center text-xs">
                                                    <RSSprite id={tex} width={32} height={32} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {hasItems && (
                                    <div>
                                        <strong>Items:</strong>
                                        <div className="max-h-40 overflow-y-auto border rounded p-2">
                                            <ul className="list-disc ml-4">
                                                {attachments.items.map((item: GameValElement, i: number) => (
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
                                                {attachments.objects.map((obj: GameValElement, i: number) => (
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
                                                {attachments.npcs.map((npc: GameValElement, i: number) => (
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
