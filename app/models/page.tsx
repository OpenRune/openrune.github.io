"use client";

import { Button } from "@/components/ui/button";
import SearchTable from "@/components/SearchTable";

export default function ItemSearch() {
    return (
        <SearchTable
            name = "Models"
            baseUrl="/public/models"
            disabledModes={["name","gameval"]}
            defaultSearchMode={"id"}
            columns={[
                { key: "id", label: "ID" },
                { key: "extra.totalFaces", label: "Faces" },
                { key: "extra.totalVerts", label: "Verts" },
                { key: "extra.attachments", label: "Attachments" },
            ]}
        />
    );
}