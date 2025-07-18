"use client"

import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
    SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
    SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    useSidebar
} from "@/components/ui/sidebar";
import {
    IconChevronRight,
} from "@tabler/icons-react";
import { AppHeaderContent } from "@/components/sidebar/app-header-content";
import Link from "next/link";
import { NAV_PAGES } from "@/lib/navConfig";
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";

import {
    DropdownMenu,
    DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import React from "react";


export function AppSidebar() {

    const { open } = useSidebar();


    const renderNavIcons = (filterAuthed: boolean) =>
        NAV_PAGES
        .filter(item => !filterAuthed || !item.requiresAuth)
        .map(item => {
            let children: typeof item.children = [];
            if (Array.isArray(item.children)) {
                children = item.children.filter(child => !filterAuthed || !child.requiresAuth);
            }
            const hasVisibleChildren = children.length > 0;

            if (item.children && hasVisibleChildren) {
                if (!open) {
                    return (
                        <SidebarMenuItem key={item.label}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear"
                                        aria-label={item.label}
                                    >
                                        {item.icon}
                                        <span className="ml-1 hidden">{item.label}</span>
                                        <IconChevronRight className="ml-auto h-5 w-5"/>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start" sideOffset={4} className="min-w-40">
                                    {children.map((child) => (
                                        <DropdownMenuItem asChild key={child.label}>
                                            <Link href={child.path} className="flex items-center gap-2">
                                                {child.icon}
                                                <span>{child.label}</span>
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    );
                } else {
                    return (
                        <Collapsible
                            key={item.label}
                            defaultOpen={false}
                            asChild
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <button
                                        className="peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear"
                                        aria-label={item.label}
                                    >
                                        {item.icon}
                                        <span className="ml-1">{item.label}</span>
                                        <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 h-5 w-5"/>
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-4">
                                    {children.map((child) => (
                                        <SidebarMenuItem key={child.label}>
                                            <Link
                                                href={child.path}
                                                className="peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear"
                                                aria-label={child.label}
                                            >
                                                {child.icon}
                                                <span className="ml-1">{child.label}</span>
                                            </Link>
                                        </SidebarMenuItem>
                                    ))}
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                }
            }

            return (
                <SidebarMenuItem key={item.label}>
                    <Link
                        href={item.path}
                        className={"peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear"}
                        aria-label={item.label}
                    >
                        {item.icon}
                        <span className="ml-1">{item.label}</span>
                    </Link>
                </SidebarMenuItem>
            );
        })
        .filter(Boolean);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <AppHeaderContent/>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Application</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {renderNavIcons(false)}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

        </Sidebar>
    );
}
