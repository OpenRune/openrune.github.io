'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { CacheType } from '@/lib/cacheTypes';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { IconPackage } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CacheTypeSelectorPage() {
  const { selectedCacheType, setSelectedCacheType, availableCacheTypes, cacheStatuses, checkingStatuses } = useCacheType();
  const pathname = usePathname();
  
  // Pages with SearchTable that auto-refresh without reload
  const tablePages = ['/objects', '/items', '/npcs', '/texures', '/sprites', '/models', '/animations', '/spotanims', '/underlays-overlays'];
  const hasTable = tablePages.includes(pathname);

  const handleSelectCacheType = (cacheType: CacheType) => {
    setSelectedCacheType(cacheType);
    // Only reload if page doesn't have a table (tables auto-refresh via useEffect)
    if (!hasTable) {
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPackage size={24} />
            Select Cache Type
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Your current cache server is unavailable. Please select a different cache type to continue.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableCacheTypes.map((cacheType) => {
              const isChecking = checkingStatuses.has(cacheType.id);
              const isOnline = cacheStatuses?.get(cacheType.id) ?? (isChecking ? null : true);
              const isSelected = selectedCacheType.id === cacheType.id;
              const isDisabled = isOnline === false || isChecking;
              
              return (
                <button
                  key={cacheType.id}
                  onClick={() => isDisabled ? undefined : handleSelectCacheType(cacheType)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                    isChecking
                      ? 'border-border bg-muted/50'
                      : isOnline === false
                      ? 'border-destructive/50 bg-destructive/5 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isChecking ? (
                      <Skeleton className="w-12 h-12 rounded-md" />
                    ) : cacheType.icon ? (
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
                  <div className="flex-1 text-left">
                    {isChecking ? (
                      <>
                        <Skeleton className="h-5 w-24 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </>
                    ) : (
                      <>
                        <div className="font-semibold flex items-center gap-2">
                          {cacheType.name}
                          {isOnline === false && (
                            <span className="text-xs text-destructive font-normal">(Offline)</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {cacheType.description}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isChecking ? (
                      <Skeleton className="w-5 h-5 rounded" />
                    ) : (
                      <>
                        {isOnline === false && (
                          <div className="text-destructive">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                        )}
                        {isSelected && isOnline === true && (
                          <div className="text-primary">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

