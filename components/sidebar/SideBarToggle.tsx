"use client";

import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import React from "react";
import { PanelLeftIcon } from "lucide-react";

export function SideBarToggle() {
    const { toggleSidebar } = useSidebar();

    return (
        <SidebarMenuButton
            size="sm"
            onClick={toggleSidebar}
            className="flex items-center justify-center p-1.5"
        >
            <PanelLeftIcon className="w-5 h-5" />
        </SidebarMenuButton>
    );
}