'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SseConnection } from '@/lib/sse/fetchSSE';
import { ZipProgressResponse } from '@/lib/sse/types';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';
import { IconChevronDown, IconChevronUp, IconX, IconDownload } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface DownloadItem {
  id: string;
  type: 'SPRITES' | 'MODELS' | 'TEXTURES';
  jobId: string;
  progress: number;
  message: string;
  downloadUrl: string | null;
  error: string | null;
  sseConnection: SseConnection | null;
  expanded: boolean;
}

interface DownloadManagerContextType {
  startDownload: (type: 'SPRITES' | 'MODELS' | 'TEXTURES', backendUrl: string) => void;
  hasActiveDownloads: (type?: 'SPRITES' | 'MODELS' | 'TEXTURES') => boolean;
}

const DownloadManagerContext = React.createContext<DownloadManagerContextType | undefined>(undefined);

export function useDownloadManager() {
  const context = React.useContext(DownloadManagerContext);
  if (context === undefined) {
    throw new Error('useDownloadManager must be used within DownloadManagerProvider');
  }
  return context;
}

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const downloadIdCounter = useRef(0);

  const startDownload = useCallback(async (type: 'SPRITES' | 'MODELS' | 'TEXTURES', backendUrl: string) => {
    const downloadId = `download-${++downloadIdCounter.current}`;
    
    // Show the download manager when starting a new download
    setIsVisible(true);
    setIsFadingOut(false);
    
    try {
      // Create new download item
      const newDownload: DownloadItem = {
        id: downloadId,
        type,
        jobId: '',
        progress: 0,
        message: 'Creating zip job...',
        downloadUrl: null,
        error: null,
        sseConnection: null,
        expanded: true,
      };
      
      setDownloads((prev) => [...prev, newDownload]);

      // POST to create zip job
      const response = await fetchFromBuildUrl('/zip/create', { type }, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to create zip job: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.jobId;

      // Check if zip is already ready (status === "ready")
      if (data.status === 'ready' && data.downloadUrl) {
        // Zip already exists, handle immediately
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === downloadId
              ? {
                  ...d,
                  jobId,
                  progress: 100.0,
                  message: data.message || 'Complete - Ready for download',
                  downloadUrl: data.downloadUrl,
                }
              : d
          )
        );

        // Auto-download immediately
        setTimeout(() => {
          const downloadPath = data.downloadUrl.startsWith('/')
            ? data.downloadUrl
            : `/${data.downloadUrl}`;

          const link = document.createElement('a');
          link.href = `/api${downloadPath}`;
          link.download = `${type.toLowerCase()}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, 100);

        // Check for auto-close
        setTimeout(() => {
          setDownloads((prev) => {
            const updated = prev.map((d) => (d.id === downloadId ? { ...d, sseConnection: null } : d));

            // Auto-close if all downloads are complete and visible
            const allComplete = updated.every((d) => d.downloadUrl || d.error);
            if (allComplete && updated.length > 0 && !isFadingOut) {
              // Wait a few seconds, then fade out
              setTimeout(() => {
                setIsFadingOut(true);
                // After fade animation completes, hide and clear
                setTimeout(() => {
                  setIsVisible(false);
                  setDownloads([]);
                  setIsFadingOut(false);
                }, 300); // Fade animation duration
              }, 3000); // Wait 3 seconds before starting fade
            }

            return updated;
          });
        }, 1000);

        return; // Exit early, no SSE needed
      }

      // Zip needs to be created, connect to SSE for progress updates
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId ? { ...d, jobId, message: 'Job created, waiting for progress...' } : d
        )
      );

      // Connect to SSE for progress updates via proxy route
      let sseUrl: string;
      try {
        const url = new URL(backendUrl);
        const ip = url.hostname;
        const port = url.port || (url.protocol === 'https:' ? '443' : '80');
        // Use proxy route with ip, port, type, and jobId
        sseUrl = `/api/server/sse?type=ZIP_PROGRESS&jobId=${encodeURIComponent(jobId)}&ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
      } catch (e) {
        // Fallback to proxy route without ip/port (will use cookie/header)
        sseUrl = `/api/server/sse?type=ZIP_PROGRESS&jobId=${encodeURIComponent(jobId)}`;
      }
      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setDownloads((prev) =>
          prev.map((d) => (d.id === downloadId ? { ...d, message: 'Connected, waiting for progress...' } : d))
        );
      };

      // Handle all message events (both default and typed)
      const handleProgressUpdate = (rawData: any) => {
        try {
          let progressData: ZipProgressResponse;
          
          // Parse if it's a string
          const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          
          // Handle wrapped event format { type: "ZIP_PROGRESS", data: {...} }
          if (data.type && data.data) {
            progressData = data.data;
          } else if (data.jobId) {
            // Direct data format: { jobId, type, progress, message, downloadUrl }
            progressData = data;
          } else {
            // Invalid format - skip
            return;
          }
          
          // Check if this is for our job (convert to string for comparison)
          if (String(progressData.jobId) === String(jobId)) {
            // Check if download is already complete (progress 100.0 or has downloadUrl)
            const isComplete = progressData.downloadUrl && (progressData.progress === 100 || progressData.progress === 100.0);
            
            setDownloads((prev) =>
              prev.map((d) => {
                if (d.id === downloadId) {
                  const updated = {
                    ...d,
                    progress: typeof progressData.progress === 'number' 
                      ? parseFloat(progressData.progress.toFixed(1))
                      : d.progress,
                    message: progressData.message || d.message,
                    downloadUrl: progressData.downloadUrl || d.downloadUrl,
                  };
                  
                  // Auto-download when complete (including if already complete when SSE connects)
                  if (progressData.downloadUrl && !d.downloadUrl) {
                    setTimeout(() => {
                      const downloadPath = progressData.downloadUrl!.startsWith('/')
                        ? progressData.downloadUrl!
                        : `/${progressData.downloadUrl!}`;
                      
                      const link = document.createElement('a');
                      link.href = `/api${downloadPath}`;
                      link.download = `${type.toLowerCase()}.zip`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }, 100);
                  }
                  
                  return updated;
                }
                return d;
              })
            );
            
            // Close connection when complete (including if it was already complete when SSE connected)
            if (isComplete) {
              setTimeout(() => {
                eventSource.close();
                setDownloads((prev) => {
                  const updated = prev.map((d) => (d.id === downloadId ? { ...d, sseConnection: null } : d));
                  
                  // Auto-close if all downloads are complete and visible
                  const allComplete = updated.every((d) => d.downloadUrl || d.error);
                  if (allComplete && updated.length > 0 && !isFadingOut) {
                    // Wait a few seconds, then fade out
                    setTimeout(() => {
                      setIsFadingOut(true);
                      // After fade animation completes, hide and clear
                      setTimeout(() => {
                        setIsVisible(false);
                        setDownloads([]);
                        setIsFadingOut(false);
                      }, 300); // Fade animation duration
                    }, 3000); // Wait 3 seconds before starting fade
                  }
                  
                  return updated;
                });
              }, 1000);
            }
          }
        } catch (err) {
          // Log error for debugging
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === downloadId
                ? { ...d, error: `Parse error: ${err instanceof Error ? err.message : 'Unknown'}` }
                : d
            )
          );
        }
      };

      // Listen to typed ZIP_PROGRESS event (this is the primary event type)
      eventSource.addEventListener('ZIP_PROGRESS', (event: Event) => {
        const messageEvent = event as MessageEvent;
        handleProgressUpdate(messageEvent.data);
      });

      // Also listen to lowercase version
      eventSource.addEventListener('zip_progress', (event: Event) => {
        const messageEvent = event as MessageEvent;
        handleProgressUpdate(messageEvent.data);
      });

      // Fallback to default message event
      eventSource.onmessage = (event: MessageEvent) => {
        handleProgressUpdate(event.data);
      };

      eventSource.onerror = (err) => {
        // Check connection state periodically
        const checkConnection = () => {
          if (eventSource.readyState === EventSource.CLOSED) {
            setDownloads((prev) =>
              prev.map((d) => {
                if (d.id === downloadId) {
                  // Close the connection
                  if (d.sseConnection) {
                    d.sseConnection.close();
                  }
                  // Only show error if download wasn't completed
                  if (!d.downloadUrl) {
                    return { ...d, error: 'Connection closed unexpectedly', sseConnection: null };
                  }
                  // If completed, just clean up
                  return { ...d, sseConnection: null };
                }
                return d;
              })
            );
          }
        };
        
        // Check immediately
        checkConnection();
        
        // Also check after a short delay in case it's closing
        setTimeout(checkConnection, 100);
      };

      const sseConnection: SseConnection = {
        close: () => eventSource.close(),
        readyState: () => eventSource.readyState,
      };

      setDownloads((prev) =>
        prev.map((d) => (d.id === downloadId ? { ...d, sseConnection } : d))
      );
    } catch (err) {
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId
            ? { ...d, error: err instanceof Error ? err.message : 'Failed to start download' }
            : d
        )
      );
    }
  }, []);

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => {
      const download = prev.find((d) => d.id === id);
      if (download?.sseConnection) {
        download.sseConnection.close();
      }
      return prev.filter((d) => d.id !== id);
    });
  }, []);

  const toggleDownload = useCallback((id: string) => {
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, expanded: !d.expanded } : d))
    );
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate offset from mouse position to the container's top-left corner
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        e.preventDefault();
        // Calculate new position: mouse position minus the drag offset
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        
        // Calculate absolute position from top-left of viewport
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - containerWidth;
        const maxY = window.innerHeight - containerHeight;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const hasActiveDownloads = useCallback((type?: 'SPRITES' | 'MODELS' | 'TEXTURES') => {
    if (type) {
      return downloads.some((d) => d.type === type && !d.downloadUrl && !d.error);
    }
    return downloads.some((d) => !d.downloadUrl && !d.error);
  }, [downloads]);

  return (
    <DownloadManagerContext.Provider value={{ startDownload, hasActiveDownloads }}>
      {children}
      {downloads.length > 0 && isVisible && (
        <div
          ref={containerRef}
          className={cn(
            "fixed w-80 transition-opacity duration-300",
            isFadingOut ? "opacity-0" : "opacity-100"
          )}
          style={{
            animation: !isFadingOut ? 'fadeIn 0.3s ease-in' : undefined,
            ...(position 
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : { right: '1rem', bottom: '1rem' }
            ),
            cursor: isDragging ? 'grabbing' : 'default',
            zIndex: 99999,
          }}
        >
          <div className="bg-card border rounded-lg shadow-lg">
            <div
              className={cn(
                "flex items-center justify-between p-2 border-b select-none",
                !isDragging && "cursor-grab active:cursor-grabbing"
              )}
              onMouseDown={handleMouseDown}
            >
              <span className="text-sm font-medium">Downloads ({downloads.length})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-6 w-6 p-0"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isCollapsed ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </Button>
            </div>
            {!isCollapsed && (
              <div className="max-h-96 overflow-y-auto">
                {downloads.map((download) => (
                  <div key={download.id} className="border-b last:border-b-0 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDownload(download.id)}
                          className="h-6 w-6 p-0"
                        >
                          {download.expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        </Button>
                        <span className="text-sm font-medium flex-1">{download.type}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDownload(download.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <IconX size={14} />
                        </Button>
                      </div>
                    </div>
                    {download.expanded && (
                      <div className="space-y-2 mt-2">
                        {download.error ? (
                          <div className="text-sm text-destructive">{download.error}</div>
                        ) : (
                          <>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{download.message}</span>
                              <span>{download.progress.toFixed(1)}%</span>
                            </div>
                            <Progress value={download.progress} />
                            {download.downloadUrl && (
                              <div className="flex items-center gap-2 text-xs text-green-600">
                                <IconDownload size={14} />
                                <span>Downloaded</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DownloadManagerContext.Provider>
  );
}

