"use client"

import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
    SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
    SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    useSidebar
} from "@/components/ui/sidebar";
import {
    IconChevronRight,
    IconChevronDown,
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

import React, { useState, useEffect } from "react";
import { IconSettings, IconPackage } from "@tabler/icons-react";
import SettingsModal from "@/components/ui/settings-modal";
import CacheTypeModal from "@/components/ui/cache-type-modal";
import { useSettings } from "@/components/layout/settings-provider";
import { useCacheType } from "@/components/layout/cache-type-provider";
import Image from "next/image";


export function AppSidebar() {

    const { open } = useSidebar();
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [cacheTypeModalOpen, setCacheTypeModalOpen] = useState(false);
    const { settings, updateSettings } = useSettings();
    const { selectedCacheType, cacheStatuses } = useCacheType();
    const [isMounted, setIsMounted] = useState(false);
    
    // Check if selected cache is offline - disable modal button and nav items if so
    const isCacheOffline = cacheStatuses?.get(selectedCacheType.id) === false;

    // Prevent hydration mismatch by only showing cache type name after mount
    useEffect(() => {
        setIsMounted(true);
    }, []);


    const renderNavIcons = (filterAuthed: boolean) =>
        NAV_PAGES
        .filter(item => !filterAuthed || !item.requiresAuth)
        .map(item => {
            let children: typeof item.children = [];
            if (Array.isArray(item.children)) {
                children = item.children.filter(child => !filterAuthed || !child.requiresAuth);
            }
            const hasVisibleChildren = children.length > 0;
            
            // Check if any child is usable offline
            const hasUsableOfflineChild = children.some(child => child.usableOffline === true);
            
            // Disable if cache is offline and not Home and not usable offline and has no usable offline children
            const isDisabled = isCacheOffline && item.path !== "/" && !item.usableOffline && !hasUsableOfflineChild;
            const disabledClassName = isDisabled ? "pointer-events-none opacity-50" : "";

            if (item.children && hasVisibleChildren) {
                if (!open) {
                    return (
                        <SidebarMenuItem key={item.label}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild disabled={isDisabled}>
                                    <button
                                        className={`peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear ${disabledClassName}`}
                                        aria-label={item.label}
                                    >
                                        {item.icon}
                                        <span className="ml-1 hidden">{item.label}</span>
                                        <IconChevronRight className="ml-auto h-5 w-5"/>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start" sideOffset={4} className="min-w-40">
                                    {children.map((child) => {
                                        const childDisabled = isCacheOffline && child.path !== "/" && !child.usableOffline;
                                        return (
                                            <DropdownMenuItem key={child.label} disabled={childDisabled} asChild={!childDisabled}>
                                                {childDisabled ? (
                                                    <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                                                        {child.icon}
                                                        <span>{child.label}</span>
                                                    </div>
                                                ) : (
                                                    <Link href={child.path} className="flex items-center gap-2">
                                                        {child.icon}
                                                        <span>{child.label}</span>
                                                    </Link>
                                                )}
                                            </DropdownMenuItem>
                                        );
                                    })}
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
                            disabled={isDisabled}
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild disabled={isDisabled}>
                                    <button
                                        className={`peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear ${disabledClassName}`}
                                        aria-label={item.label}
                                    >
                                        {item.icon}
                                        <span className="ml-1">{item.label}</span>
                                        <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 h-5 w-5"/>
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pl-4">
                                    {children.map((child) => {
                                        const childDisabled = isCacheOffline && child.path !== "/" && !child.usableOffline;
                                        return (
                                            <SidebarMenuItem key={child.label}>
                                                <Link
                                                    href={child.path}
                                                    className={`peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear ${childDisabled ? "pointer-events-none opacity-50" : ""}`}
                                                    aria-label={child.label}
                                                >
                                                    {child.icon}
                                                    <span className="ml-1">{child.label}</span>
                                                </Link>
                                            </SidebarMenuItem>
                                        );
                                    })}
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
                        className={`peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear ${disabledClassName}`}
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
        <>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <AppHeaderContent/>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {renderNavIcons(false)}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>

                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <button
                                onClick={() => !isCacheOffline && setCacheTypeModalOpen(true)}
                                disabled={isCacheOffline}
                                className="peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear border border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent"
                                aria-label="Cache Type"
                            >
                                {isMounted && selectedCacheType?.icon ? (
                                    <div className="flex-shrink-0 w-7 h-7 -ml-1 flex items-center justify-center text-primary drop-shadow-md [&>svg]:w-7 [&>svg]:h-7">
                                        {selectedCacheType.icon}
                                    </div>
                                ) : isMounted && selectedCacheType?.image ? (
                                    <div className="flex-shrink-0 w-7 h-7 -ml-1 rounded-md overflow-hidden shadow-md bg-muted flex items-center justify-center">
                                        {selectedCacheType.image.endsWith('.svg') ? (
                                            <img
                                                src={selectedCacheType.image}
                                                alt={selectedCacheType.name}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <Image
                                                src={selectedCacheType.image}
                                                alt={selectedCacheType.name}
                                                width={28}
                                                height={28}
                                                className="object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <IconPackage size={18} />
                                )}
                                <span className="ml-1 flex-1">{open && isMounted ? selectedCacheType.name : ""}</span>
                                {open && isMounted && (
                                    <IconChevronDown size={16} className="flex-shrink-0 opacity-70" />
                                )}
                            </button>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <button
                                onClick={() => setSettingsModalOpen(true)}
                                className="peer/menu-button flex w-full items-center gap-4 overflow-hidden rounded-md p-4 text-left outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 h-12 text-base font-medium min-w-8 duration-200 ease-linear"
                                aria-label="Settings"
                            >
                                <IconSettings size={18} />
                                <span className="ml-1">{open && isMounted ? "Settings" : ""}</span>
                            </button>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>

            </Sidebar>

            <SettingsModal
                isOpen={settingsModalOpen}
                onOpenChange={setSettingsModalOpen}
                copyGamevalsToUppercase={settings.copyGamevalsToUppercase}
                onCopyGamevalsToUppercaseChange={(value) => 
                    updateSettings({ copyGamevalsToUppercase: value })
                }
            />
            <CacheTypeModal
                isOpen={cacheTypeModalOpen}
                onOpenChange={setCacheTypeModalOpen}
            />
        </>
    );
}
