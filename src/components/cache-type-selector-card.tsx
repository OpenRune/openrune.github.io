"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Check, CloudDownload, Loader2, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCacheType } from "@/context/cache-type-context";
import { ServerStatus } from "@/lib/cache-status";
import type { CacheType } from "@/lib/cache-types";
import { cn } from "@/lib/utils";

type CacheTypeSelectorCardProps = {
  className?: string;
  showUnavailableBanner?: boolean;
  showGoHomeButton?: boolean;
  onSelect?: () => void;
};

function StatusBadge({
  status,
  checking,
}: {
  status: ServerStatus | null;
  checking: boolean;
}) {
  if (checking && !status) {
    return (
      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
        Checking...
      </Badge>
    );
  }

  if (!status) {
    return (
      <Badge variant="destructive" className="px-2 py-0.5 text-xs">
        Offline
      </Badge>
    );
  }

  if (checking && status !== ServerStatus.LIVE) {
    return (
      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
        Checking...
      </Badge>
    );
  }

  if (status === ServerStatus.LIVE) {
    return (
      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
        Live
      </Badge>
    );
  }

  if (status === ServerStatus.UPDATING) {
    return (
      <Badge variant="outline" className="px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
        Updating
      </Badge>
    );
  }

  if (status === ServerStatus.BOOTING) {
    return (
      <Badge variant="outline" className="px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
        Booting
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="px-2 py-0.5 text-xs">
      Error
    </Badge>
  );
}

function StatusIcon({
  status,
  checking,
}: {
  status: ServerStatus | null;
  checking: boolean;
}) {
  if (checking) {
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  }

  if (!status) {
    return <AlertCircle className="size-5 text-destructive" />;
  }

  if (status === ServerStatus.LIVE) {
    return <Check className="size-5 text-emerald-700/80 dark:text-emerald-400/70" />;
  }

  if (status === ServerStatus.UPDATING) {
    return <CloudDownload className="size-5 text-blue-600 dark:text-blue-400" />;
  }

  if (status === ServerStatus.BOOTING) {
    return <Loader2 className="size-5 animate-spin text-blue-600 dark:text-blue-400" />;
  }

  return <AlertCircle className="size-5 text-destructive" />;
}

function CacheImage({ cacheType }: { cacheType: CacheType }) {
  if (cacheType.icon) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {cacheType.icon}
      </div>
    );
  }

  if (cacheType.image) {
    return (
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-muted">
        <Image
          src={cacheType.image}
          alt={cacheType.name}
          width={48}
          height={48}
          className="h-12 w-12 object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
      <span className="text-xs font-semibold">{cacheType.name}</span>
    </div>
  );
}

export function CacheTypeSelectorCard({
  className,
  showUnavailableBanner = true,
  showGoHomeButton = false,
  onSelect,
}: CacheTypeSelectorCardProps) {
  const {
    selectedCacheType,
    setSelectedCacheType,
    availableCacheTypes,
    cacheStatuses,
    checkingStatuses,
    refreshCacheStatuses,
    setStatusLiveUpdatesEnabled,
  } = useCacheType();

  React.useEffect(() => {
    void refreshCacheStatuses();
  }, [refreshCacheStatuses]);

  React.useEffect(() => {
    setStatusLiveUpdatesEnabled(true);
    return () => setStatusLiveUpdatesEnabled(false);
  }, [setStatusLiveUpdatesEnabled]);

  const selectedStatus = cacheStatuses.get(selectedCacheType.id);
  const selectedChecking = checkingStatuses.has(selectedCacheType.id);
  const selectedUnavailable = !selectedChecking && !(selectedStatus?.isOnline === true);

  return (
    <div className={cn("w-full", className)}>
      {showUnavailableBanner && selectedUnavailable ? (
        <div className="w-full rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Server Unavailable</p>
              <p className="mt-1 text-sm text-destructive/90">
                The selected cache server "{selectedCacheType.name}" is currently offline or
                unavailable. Please select a different cache type to continue.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card className={cn("w-full", showUnavailableBanner && "mt-4")}>
        <CardHeader className="border-b border-border">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4" />
              Select Cache Type
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Your current cache server is unavailable. Please select a different cache type to
              continue.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-4">
          {availableCacheTypes.map((cacheType) => {
            const info = cacheStatuses.get(cacheType.id);
            const status = info?.status ?? null;
            const checking = checkingStatuses.has(cacheType.id);
            const isSelected = selectedCacheType.id === cacheType.id;
            const canSelect = info?.isOnline === true && !checking;

            return (
              <button
                key={cacheType.id}
                type="button"
                disabled={!canSelect}
                onClick={() => {
                  setSelectedCacheType(cacheType);
                  onSelect?.();
                }}
                className={[
                  "w-full rounded-lg border p-4 text-left transition-colors",
                  !status || status === ServerStatus.ERROR
                    ? "cursor-not-allowed border-destructive/40 bg-destructive/5"
                    : status === ServerStatus.UPDATING || status === ServerStatus.BOOTING
                      ? "border-blue-500/40 bg-blue-500/5"
                      : isSelected
                        ? "border-border bg-muted/40"
                        : "border-border hover:border-primary/50 hover:bg-accent",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <CacheImage cacheType={cacheType} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {cacheType.name}
                      <StatusBadge status={status} checking={checking} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                      {cacheType.description}
                    </p>
                    {info?.statusResponse?.game && info.statusResponse?.revision ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {info.statusResponse.game} (Rev {info.statusResponse.revision})
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <StatusIcon status={status} checking={checking} />
                  </div>
                </div>

                {info?.statusResponse?.statusMessage ? (
                  <div
                    className={[
                      "mt-2 rounded px-2 py-1 text-xs sm:text-sm",
                      info.status === ServerStatus.ERROR
                        ? "bg-destructive/10 text-destructive"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                    ].join(" ")}
                  >
                    {info.status === ServerStatus.ERROR ? "Error: " : ""}
                    {info.statusResponse.statusMessage}
                  </div>
                ) : null}

                {info?.statusResponse?.status === ServerStatus.UPDATING &&
                typeof info.statusResponse.progress === "number" ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(info.statusResponse.progress)}%</span>
                    </div>
                    <div className="h-2 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary transition-all"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, info.statusResponse.progress),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {isSelected && info?.isOnline ? (
                  <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                    Currently Selected
                  </p>
                ) : null}
              </button>
            );
          })}
        </CardContent>
        {showGoHomeButton ? (
          <CardFooter className="border-t border-border p-4">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-9 w-full justify-center text-sm font-semibold",
              )}
            >
              Go Home
            </Link>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}
