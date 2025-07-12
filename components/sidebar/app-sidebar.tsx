import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
    SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
    SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar, SidebarTrigger, SidebarSeparator
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
    IconBell,
    IconBrandGoogleFilled,
    IconChevronRight,
    IconChevronsDown,
    IconLogout2,
    IconUserCircle
} from "@tabler/icons-react";
import { AppHeaderContent } from "@/components/sidebar/app-header-content";
import Link from "next/link";
import { NAV_PAGES } from "@/lib/navConfig";
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {cookies} from "next/headers";
import {cn} from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {UserAvatarProfile} from "@/components/ui/user-avatar-profile";
import React from "react";
import {SideBarToggle} from "@/components/sidebar/SideBarToggle";

export function AppSidebar() {

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
                    return (
                        <Collapsible
                            key={item.label}
                            defaultOpen
                            asChild
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <span
                                        className={"peer/menu-button flex w-full objects-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-sm min-w-8 duration-200 ease-linear"}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={item.label}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                        <IconChevronRight
                                            className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"/>
                                    </span>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {children.map(sub => (
                                            <SidebarMenuSubItem key={sub.label}>
                                                <Link
                                                    href={sub.path}
                                                    className={"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px objects-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sm group-data-[collapsible=icon]:hidden block"}
                                                    aria-label={sub.label}
                                                >
                                                    <span>{sub.label}</span>
                                                </Link>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                }

                return (
                    <SidebarMenuItem key={item.label}>
                        <Link
                            href={item.path}
                            className={"peer/menu-button flex w-full objects-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-sm min-w-8 duration-200 ease-linear"}
                            aria-label={item.label}
                        >
                            {item.icon}
                            <span>{item.label}</span>
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

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem className="py-3 md:py-2">
                        <DropdownMenu>
                            <DropdownMenuContent
                                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                                side='bottom'
                                align='end'
                                sideOffset={4}
                            >
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="h-3" />
                        <SideBarToggle/>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
