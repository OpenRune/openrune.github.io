'use client';

import React from 'react';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { CacheType } from '@/lib/cacheTypes';
import { ServerStatus } from '@/lib/cacheStatus';
import Image from 'next/image';
import { IconPackage, IconAlertCircle, IconLoader2, IconCloudDownload, IconCheck } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function CacheTypeSelectorPage() {
  const { selectedCacheType, setSelectedCacheType, availableCacheTypes, cacheStatuses, checkingStatuses } = useCacheType();

  const handleSelectCacheType = (cacheType: CacheType) => {
    setSelectedCacheType(cacheType);
  };

  const getStatusBadge = (statusResponse: any, isChecking: boolean) => {
    // If we have a status response, show that status (even if checking)
    if (statusResponse) {
      switch (statusResponse.status) {
        case ServerStatus.LIVE:
          return (
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
              Live
            </span>
          );
        case ServerStatus.ERROR:
          return (
            <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
              Error
            </span>
          );
        case ServerStatus.BOOTING:
          return (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
              Booting
            </span>
          );
        case ServerStatus.UPDATING:
          return (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
              Updating
            </span>
          );
        default:
          return null;
      }
    }

    // Only show "Checking..." if no status response yet
    if (isChecking) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
          Checking...
        </span>
      );
    }

    // Offline
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
        Offline
      </span>
    );
  };

  const getStatusIcon = (statusResponse: any, isChecking: boolean) => {

    if (!statusResponse) {
      return (
        <IconAlertCircle className="w-5 h-5 text-destructive" />
      );
    }

    switch (statusResponse.status) {
      case ServerStatus.LIVE:
        return (
          <IconCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
        );
      case ServerStatus.ERROR:
        return (
          <IconAlertCircle className="w-5 h-5 text-destructive" />
        );
      case ServerStatus.BOOTING:
        return (
          <IconLoader2 className="w-5 h-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
        );
      case ServerStatus.UPDATING:
        return (
          <IconCloudDownload className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <IconPackage size={24} />
                Select Cache Type
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Your current cache server is unavailable. Please select a different cache type to continue.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableCacheTypes.map((cacheType) => {
              const isChecking = checkingStatuses.has(cacheType.id);
              const statusInfo = cacheStatuses?.get(cacheType.id);
              const statusResponse = statusInfo?.statusResponse;
              const isOnline = statusInfo?.isOnline ?? false;
              const isSelected = selectedCacheType.id === cacheType.id;
              
              // Only allow selection if LIVE
              const canSelect = isOnline && !isChecking;
              
              return (
                <button
                  key={cacheType.id}
                  onClick={() => canSelect ? handleSelectCacheType(cacheType) : undefined}
                  disabled={!canSelect}
                  className={`w-full flex flex-col gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                    !statusResponse || statusResponse.status === ServerStatus.ERROR
                      ? 'border-destructive/50 bg-destructive/5 opacity-75 cursor-not-allowed'
                      : statusResponse.status === ServerStatus.UPDATING || statusResponse.status === ServerStatus.BOOTING
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : statusResponse.status === ServerStatus.LIVE
                      ? isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent cursor-pointer'
                      : 'border-destructive/50 bg-destructive/5 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {cacheType.icon ? (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                          <div className="text-primary">{cacheType.icon}</div>
                        </div>
                      ) : cacheType.image ? (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {cacheType.image.endsWith('.svg') ? (
                            <img
                              src={cacheType.image}
                              alt={cacheType.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-semibold">${cacheType.name}</div>`;
                                }
                              }}
                            />
                          ) : (
                            <Image
                              src={cacheType.image}
                              alt={cacheType.name}
                              width={48}
                              height={48}
                              className="object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-semibold">${cacheType.name}</div>`;
                                }
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                          <span className="text-sm font-semibold">{cacheType.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        {cacheType.name}
                        {getStatusBadge(statusResponse, isChecking)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cacheType.description}
                        {statusResponse?.game && statusResponse?.revision && (
                          <span className="block mt-1">
                            {statusResponse.game} (Rev {statusResponse.revision})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusIcon(statusResponse, isChecking)}
                    </div>
                  </div>

                  {/* Show error message if ERROR status */}
                  {statusResponse?.status === ServerStatus.ERROR && statusResponse.statusMessage && (
                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded ml-4">
                      <strong>Error:</strong> {statusResponse.statusMessage}
                    </div>
                  )}

                  {/* Show status message and progress bar if UPDATING status */}
                  {statusResponse?.status === ServerStatus.UPDATING && (
                    <>
                      {statusResponse.statusMessage && (
                        <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2 rounded ml-4 mb-2">
                          {statusResponse.statusMessage}
                        </div>
                      )}
                      {statusResponse.progress !== undefined && statusResponse.progress !== null && (
                        <div className="space-y-1 ml-4">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{Math.round(statusResponse.progress)}%</span>
                          </div>
                          <Progress value={statusResponse.progress} className="h-2" />
                        </div>
                      )}
                    </>
                  )}

                  {/* Show selected indicator */}
                  {isSelected && isOnline && (
                    <div className="text-xs text-primary font-medium">
                      Currently Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          </CardContent>
        </Card>
      </div>
    );
  }
