"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";

import { CacheTypeSelectorCard } from "@/components/cache-type-selector-card";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/svg/logo";
import { Sygnet } from "@/components/ui/svg/sygnet";
import {
  canUsePageOffline,
  findLeafNavPageByPath,
} from "@/config/nav-pages";
import { useCacheType } from "@/context/cache-type-context";
import { useShellPreferences } from "@/context/shell-preferences-context";
import { useSettings } from "@/context/settings-context";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { selectedCacheType, cacheStatuses, checkingStatuses } = useCacheType();
  const {
    sidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    toggleSidebarCollapsed,
  } = useShellPreferences();
  const { settings } = useSettings();

  const closeMobile = React.useCallback(() => {
    setMobileNavOpen(false);
  }, [setMobileNavOpen]);

  React.useEffect(() => {
    if (!isMobile && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [isMobile, mobileNavOpen, setMobileNavOpen]);

  const selectedStatus = cacheStatuses.get(selectedCacheType.id);
  const selectedStatusChecking = checkingStatuses.has(selectedCacheType.id);
  const currentPage = React.useMemo(() => findLeafNavPageByPath(pathname), [pathname]);
  const [requestForcedCacheSelection, setRequestForcedCacheSelection] = React.useState(false);
  const requestForcedRef = React.useRef(false);
  const shouldForceCacheSelection = Boolean(
    requestForcedCacheSelection && currentPage && !canUsePageOffline(currentPage),
  );

  React.useEffect(() => {
    requestForcedRef.current = requestForcedCacheSelection;
  }, [requestForcedCacheSelection]);

  React.useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const shouldIgnoreAsImageRequest = (input: RequestInfo | URL, init?: RequestInit): boolean => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith(".png") || lowerUrl.includes("/sprite/")) return true;

      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const accept = (headers.get("accept") ?? "").toLowerCase();
      if (accept.includes("image/")) return true;
      return false;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const lowerUrl = url.toLowerCase();
      const isApiRequest = lowerUrl.includes("/api/");
      const isStatusRequest = lowerUrl.includes("/api/status");

      if (
        requestForcedRef.current &&
        isApiRequest &&
        !isStatusRequest &&
        !shouldIgnoreAsImageRequest(input, init)
      ) {
        return new Response(
          JSON.stringify({ error: "cache-selection-required", message: "Select an online cache server to continue." }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          },
        );
      }

      const response = await originalFetch(input, init);
      const failed = response.status === 502 || response.status === 503;

      if (isApiRequest && failed && !shouldIgnoreAsImageRequest(input, init)) {
        setRequestForcedCacheSelection(true);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  React.useEffect(() => {
    if (!requestForcedCacheSelection) return;
    if (!selectedStatusChecking && selectedStatus?.isOnline) {
      setRequestForcedCacheSelection(false);
    }
  }, [requestForcedCacheSelection, selectedStatusChecking, selectedStatus]);

  return (
    <div className="flex min-h-dvh w-full">
      <aside
        className={cn(
          "relative z-20 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out md:flex",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
        aria-label="Primary navigation"
      >
        <div
          className={cn(
            "flex h-14 items-center border-b border-sidebar-border px-3",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          {sidebarCollapsed ? (
            <div className="flex w-full items-center justify-center">
              <Sygnet
                className="h-8 w-8 text-sidebar-foreground"
                aria-label="OpenRune signet"
                role="img"
              />
            </div>
          ) : (
            <>
              <Logo
                className="h-8 w-full text-sidebar-foreground"
                aria-label="OpenRune logo"
                role="img"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-2 shrink-0"
                aria-label="Collapse sidebar"
                onClick={toggleSidebarCollapsed}
              >
                <PanelLeft className="size-4" />
              </Button>
            </>
          )}
        </div>
        <SidebarNav
          collapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapsed}
        />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="flex items-center">
              <Logo
                className="h-8 w-full text-foreground"
                aria-label="OpenRune logo"
                role="img"
              />
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 py-2">
            <SidebarNav collapsed={false} onNavigate={closeMobile} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <main data-app-main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className={cn(!settings.fullWidthContent && "mx-auto w-full max-w-7xl")}>
            {children}
          </div>
        </main>
      </div>

      {shouldForceCacheSelection ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 md:p-6">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CacheTypeSelectorCard
              showUnavailableBanner={false}
              showGoHomeButton
              onSelect={() => {
                setRequestForcedCacheSelection(false);
                window.location.reload();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
