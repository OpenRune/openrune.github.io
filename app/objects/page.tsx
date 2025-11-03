"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconMap } from "@tabler/icons-react";

export default function ObjectSearch() {
    const [mapModalOpen, setMapModalOpen] = useState(false);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);

    const handleMapClick = (objectId: number) => {
        setSelectedObjectId(objectId);
        setMapModalOpen(true);
    };

    return (
        <>
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
                                onClick={() => handleMapClick(row.id)}
                            >
                                <IconMap size={16} className="mr-2" />
                                View
                            </Button>
                        ),
                    },
                ]}
            />
            <Dialog open={mapModalOpen} onOpenChange={setMapModalOpen}>
                <DialogContent className="!max-w-[50vw] !w-[50vw] !max-h-[95vh] !h-[95vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle>
                            Map - Object ID: {selectedObjectId}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 w-full h-full min-h-0 pb-6 px-6">
                        <iframe
                            src={selectedObjectId ? `https://mejrs.github.io/osrs?objectid=${selectedObjectId}` : "https://mejrs.github.io/osrs"}
                            className="w-full h-full border-0 rounded"
                            title="OSRS Map"
                            allowFullScreen
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}