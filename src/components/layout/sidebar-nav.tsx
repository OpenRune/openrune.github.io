"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBrandDiscord } from "@tabler/icons-react";
import {
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Code2,
  Coffee,
  PanelLeft,
  Settings,
} from "lucide-react";

import {
  canUsePageOffline,
  findLeafNavPageByPath,
  NAV_PAGES,
  type NavPage,
} from "@/config/nav-pages";
import { useCacheType } from "@/context/cache-type-context";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CacheTypeSelectorCard } from "@/components/cache-type-selector-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SettingsModal } from "@/components/layout/settings-modal";
import { useSettings } from "@/context/settings-context";

function isLeafActive(pathname: string, page: NavPage) {
  if (page.children?.length) return false;
  if (page.path === "/") {
    return pathname === "/" && page.label === "Home";
  }
  const hit = findLeafNavPageByPath(pathname);
  return hit === page;
}

function isGroupActive(pathname: string, page: NavPage) {
  return page.children?.some((c) => pathname === c.path) ?? false;
}

function isPageDisabled(page: NavPage, isOnline: boolean): boolean {
  return !isOnline && !canUsePageOffline(page);
}

const mainItemClass =
  "peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-2 text-left text-sm font-medium outline-none ring-sidebar-ring transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:shrink-0 min-w-8";

const childItemClass =
  "peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-medium outline-none ring-sidebar-ring transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:shrink-0 min-w-8";

function navSizeClass(size: "small" | "medium" | "large") {
  if (size === "small") return "text-xs";
  if (size === "large") return "text-base py-2.5";
  return "";
}

function LeafNavItem({
  page,
  pathname,
  collapsed,
  isOnline,
  itemSize,
  onNavigate,
}: {
  page: NavPage;
  pathname: string;
  collapsed: boolean;
  isOnline: boolean;
  itemSize: "small" | "medium" | "large";
  onNavigate?: () => void;
}) {
  const Icon = page.icon;
  const active = isLeafActive(pathname, page);
  const disabled = isPageDisabled(page, isOnline);

  return (
    <Link
      href={disabled ? "#" : page.path}
      className={cn(
        mainItemClass,
        navSizeClass(itemSize),
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-inherit",
        collapsed && "justify-center gap-0 p-2",
      )}
      title={collapsed ? page.label : undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      aria-label={page.label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{page.label}</span>
        </>
      )}
    </Link>
  );
}

function GroupNavItem({
  page,
  pathname,
  collapsed,
  isOnline,
  itemSize,
  isOpen,
  onOpenChange,
  onNavigate,
}: {
  page: NavPage;
  pathname: string;
  collapsed: boolean;
  isOnline: boolean;
  itemSize: "small" | "medium" | "large";
  isOpen: boolean;
  onOpenChange: (label: string, open: boolean) => void;
  onNavigate?: () => void;
}) {
  const Icon = page.icon;
  const groupActive = isGroupActive(pathname, page);
  const groupIsOpen = isOpen;
  const children = page.children ?? [];

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            mainItemClass,
            navSizeClass(itemSize),
            "justify-center gap-0 p-2",
            groupActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "text-muted-foreground",
          )}
          title={page.label}
          aria-label={page.label}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={4} className="min-w-40">
          {children.map((child) => {
            const ChildIcon = child.icon;
            const childDisabled = isPageDisabled(child, isOnline);
            return (
              <DropdownMenuItem
                key={child.path}
                disabled={childDisabled}
                className={cn(childDisabled && "opacity-45")}
              >
                <Link
                  href={childDisabled ? "#" : child.path}
                  onClick={(event) => {
                    if (childDisabled) {
                      event.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  className="flex w-full items-center gap-2"
                  aria-disabled={childDisabled}
                  tabIndex={childDisabled ? -1 : undefined}
                >
                  <ChildIcon className="size-4" />
                  <span>{child.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible
      open={groupIsOpen || groupActive}
      onOpenChange={(open) => {
        onOpenChange(page.label, open);
      }}
      className="group/collapsible"
    >
      <CollapsibleTrigger
        className={cn(
          mainItemClass,
          navSizeClass(itemSize),
          groupActive &&
            "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
        )}
        aria-label={page.label}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="ml-1 truncate">{page.label}</span>
        <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pt-1">
        <div className="flex flex-col gap-1 border-l border-sidebar-border/60 pl-2">
          {children.map((child) => (
            <ChildLink
              key={child.path}
              child={child}
              pathname={pathname}
              collapsed={false}
              isOnline={isOnline}
              itemSize={itemSize}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChildLink({
  child,
  pathname,
  collapsed,
  isOnline,
  itemSize,
  onNavigate,
}: {
  child: NavPage;
  pathname: string;
  collapsed: boolean;
  isOnline: boolean;
  itemSize: "small" | "medium" | "large";
  onNavigate?: () => void;
}) {
  const Icon = child.icon;
  const active = pathname === child.path;
  const disabled = isPageDisabled(child, isOnline);

  return (
    <Link
      href={disabled ? "#" : child.path}
      className={cn(
        childItemClass,
        navSizeClass(itemSize),
        "hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-primary/15 text-sidebar-primary-foreground",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-inherit",
        collapsed && "justify-center gap-0 p-2",
        !collapsed && "pl-4",
      )}
      title={collapsed ? child.label : undefined}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      aria-label={child.label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{child.label}</span>
      ) : null}
    </Link>
  );
}

export function SidebarNav({
  collapsed,
  onNavigate,
  onToggleSidebar,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleSidebar?: () => void;
}) {
  const pathname = usePathname();
  const footerItemClass = cn(
    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors duration-200",
    "border border-sidebar-border/70 bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    collapsed && "justify-center gap-0 px-0",
  );
  const { selectedCacheType, cacheStatuses, checkingStatuses } = useCacheType();
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [cacheTypeDialogOpen, setCacheTypeDialogOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<string[]>([]);
  const selectedStatus = cacheStatuses.get(selectedCacheType.id);
  const selectedStatusChecking = checkingStatuses.has(selectedCacheType.id);
  const isOnline = selectedStatus?.isOnline === true || selectedStatusChecking;

  const handleGroupOpenChange = React.useCallback(
    (groupLabel: string, open: boolean) => {
      setOpenGroups((prev) => {
        if (!open) return prev.filter((label) => label !== groupLabel);
        if (settings.allowMultipleCollapsiblesOpen) {
          return prev.includes(groupLabel) ? prev : [...prev, groupLabel];
        }
        return [groupLabel];
      });
    },
    [settings.allowMultipleCollapsiblesOpen],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="flex flex-col gap-1 pt-2 pb-2">
          {!selectedStatusChecking && !isOnline ? (
            <div className="mb-1 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {!collapsed ? (
                <span>
                  OpenRune cache servers offline.{" "}
                  <Link
                    href="https://discord.gg/v2qcXzBCwf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
                  >
                    <IconBrandDiscord className="size-3.5 text-foreground/80" />
                    Support
                  </Link>
                </span>
              ) : null}
            </div>
          ) : null}
          {collapsed && onToggleSidebar ? (
            <button
              type="button"
              className="flex items-center justify-center rounded-lg px-0 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={onToggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeft className="size-4 shrink-0" aria-hidden />
            </button>
          ) : null}
          {NAV_PAGES.map((page) =>
            page.children?.length ? (
              <GroupNavItem
                key={page.label}
                page={page}
                pathname={pathname}
                collapsed={collapsed}
                isOnline={isOnline}
                itemSize={settings.navItemSize}
                isOpen={openGroups.includes(page.label)}
                onOpenChange={handleGroupOpenChange}
                onNavigate={onNavigate}
              />
            ) : (
              <LeafNavItem
                key={page.label}
                page={page}
                pathname={pathname}
                collapsed={collapsed}
                isOnline={isOnline}
                itemSize={settings.navItemSize}
                onNavigate={onNavigate}
              />
            ),
          )}
        </nav>
      </ScrollArea>

      <div className="px-2 pt-1 pb-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={footerItemClass}
            aria-label={
              collapsed ? "Cache Type" : `Cache Type: ${selectedCacheType.name}`
            }
            onClick={() => setCacheTypeDialogOpen(true)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {selectedCacheType.icon ? (
                  <div className="text-muted-foreground">{selectedCacheType.icon}</div>
                ) : (
                  <Image
                    src={selectedCacheType.image ?? "/cache-osrs.png"}
                    alt={selectedCacheType.name}
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                  />
                )}
              </div>
              {!collapsed ? (
                <span className="truncate leading-none">{selectedCacheType.name}</span>
              ) : null}
            </div>
            {!collapsed ? <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-70" /> : null}
          </button>

          <Dialog open={cacheTypeDialogOpen} onOpenChange={setCacheTypeDialogOpen}>
            <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Select Cache Type</DialogTitle>
              </DialogHeader>
              <CacheTypeSelectorCard showUnavailableBanner={false} onSelect={() => setCacheTypeDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          <Link href="/api-docs" className={footerItemClass} aria-label="API Endpoints">
            <Code2 className="size-4 shrink-0" />
            {!collapsed ? <span className="ml-1 truncate">API Endpoints</span> : null}
          </Link>

          <button
            type="button"
            className={footerItemClass}
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed ? <span className="ml-1 truncate">Settings</span> : null}
          </button>

          <Link
            href="https://buymeacoffee.com/openrune"
            target="_blank"
            rel="noopener noreferrer"
            className={footerItemClass}
            aria-label="Buy Me a Coffee"
          >
            <Coffee className="size-4 shrink-0" />
            {!collapsed ? <span className="ml-1 truncate">Buy Me a Coffee</span> : null}
          </Link>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
