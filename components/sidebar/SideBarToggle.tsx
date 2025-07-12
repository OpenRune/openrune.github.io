"use client";

import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import React from "react";
import { PanelLeftIcon } from "lucide-react";

export function SideBarToggle() {
    const { toggleSidebar, open } = useSidebar();

    return (
        <SidebarMenuButton
            size="lg"
            onClick={toggleSidebar}
            className="flex items-center justify-start py-2 md:py-1"
        >
            <span className="flex items-center gap-2">
                <PanelLeftIcon className="w-5 h-5 ml-1" />
            </span>
            {open && <span className="ml-2 flex items-center mt-0.5">Toggle Sidebar</span>}
        </SidebarMenuButton>
    );
}