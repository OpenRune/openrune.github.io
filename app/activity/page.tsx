'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { fetchSSE, SseConnection } from '@/lib/sse/fetchSSE';
import { SseEventType, ActivityStats } from '@/lib/sse/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';
import { toast } from 'sonner';
import { IconTrash, IconChevronDown } from '@tabler/icons-react';
import { BASE_CACHE_TYPES, LOCALHOST_CACHE_TYPE, CacheType } from '@/lib/cacheTypes';
import { useCacheType } from '@/components/layout/cache-type-provider';

// Simple password - change this to whatever you want
const ACTIVITY_PASSWORD = 'admin';
const AUTH_KEY = 'activity_authenticated';

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatTimeUntil(ms: number): string {
  if (ms < 0) return 'Expired';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default function ActivityPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  const { cacheStatuses } = useCacheType();
  
  // Get available cache types for dropdown (including localhost if in local env)
  const isLocalEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      process.env.NEXT_PUBLIC_IS_LOCAL === 'true' ||
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  const availableServers = useMemo(() => {
    return isLocalEnv
      ? [LOCALHOST_CACHE_TYPE, ...BASE_CACHE_TYPES]
      : BASE_CACHE_TYPES;
  }, [isLocalEnv]);

  const [selectedServer, setSelectedServer] = useState<CacheType>(() => {
    return availableServers[0] || LOCALHOST_CACHE_TYPE;
  });

  // Update selectedServer if availableServers changes and current selection is not in list
  useEffect(() => {
    if (!availableServers.some(s => s.id === selectedServer.id)) {
      setSelectedServer(availableServers[0] || LOCALHOST_CACHE_TYPE);
    }
  }, [availableServers, selectedServer.id]);

  // Clear data when server changes
  useEffect(() => {
    setStats(null);
    setSseEvents([]);
    setIsConnected(false);
    setSseIsConnected(false);
    setError(null);
    setSseError(null);
    setSelectedCacheEndpoint(null);
  }, [selectedServer.id]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState<string | null>(null);
  const [selectedCacheEndpoint, setSelectedCacheEndpoint] = useState<string | null>(null);
  const connectionRef = useRef<SseConnection | null>(null);

  // SSE Monitor state
  const [sseEvents, setSseEvents] = useState<Array<{ id: number; timestamp: Date; type: SseEventType | string; data: any }>>([]);
  const [sseIsConnected, setSseIsConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);
  const [sseEventType, setSseEventType] = useState<SseEventType | 'ALL'>(SseEventType.STATUS);
  const sseConnectionRef = useRef<EventSource | null>(null);
  const sseEventIdRef = useRef(0);
  const sseEventsContainerRef = useRef<HTMLDivElement>(null);

  // Helper to get backend URL from cache type
  const getBackendUrl = useCallback((cacheType: CacheType) => {
    return `https://${cacheType.ip}:${cacheType.port}`;
  }, []);

  // Helper to create event from parsed data
  const createEvent = useCallback((data: any, type: SseEventType | string) => {
    return {
      id: sseEventIdRef.current++,
      timestamp: new Date(),
      type,
      data: data.type && data.data ? data.data : data,
    };
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ACTIVITY_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, 'true');
      setPasswordError(null);
      setPassword('');
    } else {
      setPasswordError('Incorrect password');
      setPassword('');
    }
  };

  const connectToSSE = useCallback(() => {
    // Close existing connection
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    setError(null);

    const backendUrl = getBackendUrl(selectedServer);

    // Use the type-safe fetchSSE function
    const connection = fetchSSE(
      SseEventType.ACTIVITY,
      (data: ActivityStats) => {
        setStats(data);
        setIsConnected(true);
      },
      (err) => {
        console.error('[Activity Page] Connection error:', err);
        setError('Connection error. Attempting to reconnect...');
        setIsConnected(false);
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (connectionRef.current) {
            connectToSSE();
          }
        }, 5000);
      },
      () => {
        console.log('[Activity Page] Connection established');
        setIsConnected(true);
        setError(null);
      },
      backendUrl
    );

    connectionRef.current = connection;
  }, [selectedServer, getBackendUrl]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    connectToSSE();

    // Cleanup on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.close();
      }
    };
  }, [isAuthenticated, connectToSSE]);

  // SSE Monitor connection
  const connectToSSEMonitor = useCallback(() => {
    if (sseConnectionRef.current) {
      sseConnectionRef.current.close();
      sseConnectionRef.current = null;
    }

    setSseError(null);

    const backendUrl = getBackendUrl(selectedServer);

    // If "ALL" is selected, connect without type query parameter to get all events
    if (sseEventType === 'ALL') {
      try {
        // No type parameter = all event types
        const sseUrl = `${backendUrl}/sse`;
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log('[SSE Monitor] Connection established (ALL types)');
          setSseIsConnected(true);
          setSseError(null);
        };

        const handleEvent = (eventType: string, data: any) => {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            const type = parsed.type || eventType;
            const eventData = parsed.data || parsed;
            setSseEvents(prev => [...prev, createEvent({ type, data: eventData }, type)]);
          } catch (error) {
            console.error(`[SSE Monitor] Error parsing ${eventType} event:`, error);
          }
        };

        eventSource.onmessage = (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type && parsed.data) {
              setSseEvents(prev => [...prev, createEvent(parsed, parsed.type)]);
            } else {
              setSseEvents(prev => [...prev, createEvent(parsed, 'UNKNOWN')]);
            }
          } catch (error) {
            console.error('[SSE Monitor] Error parsing event:', error);
          }
        };

        // Listen for specific event types (both lowercase and uppercase)
        ['status', 'activity', 'STATUS', 'ACTIVITY'].forEach(eventType => {
          eventSource.addEventListener(eventType, (event: Event) => {
            const messageEvent = event as MessageEvent;
            const expectedType = eventType.toUpperCase() === 'STATUS' ? SseEventType.STATUS : SseEventType.ACTIVITY;
            handleEvent(expectedType, messageEvent.data);
          });
        });

        eventSource.onerror = (error: Event) => {
          if (eventSource.readyState === EventSource.CLOSED) {
            return;
          }
          
          console.error('[SSE Monitor] Connection error:', error);
          setSseError('Connection error. Attempting to reconnect...');
          setSseIsConnected(false);
          
          setTimeout(() => {
            if (sseConnectionRef.current) {
              connectToSSEMonitor();
            }
          }, 5000);
        };

        sseConnectionRef.current = eventSource;
      } catch (error) {
        console.error('[SSE Monitor] Failed to create connection:', error);
        setSseError('Failed to create connection');
        setSseIsConnected(false);
      }
    } else {
      // Use the type-safe fetchSSE function for specific event types
      const connection = fetchSSE(
        sseEventType as SseEventType,
        (data: any) => {
          const newEvent = {
            id: sseEventIdRef.current++,
            timestamp: new Date(),
            type: sseEventType,
            data,
          };
          
          setSseEvents(prev => [...prev, newEvent]);
          setSseIsConnected(true);
        },
        (err) => {
          console.error('[SSE Monitor] Connection error:', err);
          setSseError('Connection error. Attempting to reconnect...');
          setSseIsConnected(false);
          
          setTimeout(() => {
            if (sseConnectionRef.current) {
              connectToSSEMonitor();
            }
          }, 5000);
        },
        () => {
          console.log('[SSE Monitor] Connection established');
          setSseIsConnected(true);
          setSseError(null);
        },
        backendUrl
      );

      // Store the underlying EventSource for cleanup
      if (connection) {
        // We need to access the EventSource, but fetchSSE doesn't expose it
        // For now, we'll just store the connection and close it properly
        (sseConnectionRef.current as any) = connection;
      }
    }
  }, [sseEventType, selectedServer, getBackendUrl]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    connectToSSEMonitor();

    return () => {
      if (sseConnectionRef.current) {
        if (sseEventType === 'ALL') {
          (sseConnectionRef.current as EventSource).close();
        } else {
          (sseConnectionRef.current as any).close?.();
        }
        sseConnectionRef.current = null;
      }
    };
  }, [isAuthenticated, connectToSSEMonitor, sseEventType]);

  // Auto-scroll SSE events
  useEffect(() => {
    if (sseEventsContainerRef.current) {
      sseEventsContainerRef.current.scrollTop = sseEventsContainerRef.current.scrollHeight;
    }
  }, [sseEvents]);

  // Set selected cache endpoint when stats change
  useEffect(() => {
    if (stats && Object.keys(stats.cacheStats).length > 0) {
      if (!selectedCacheEndpoint || !stats.cacheStats[selectedCacheEndpoint]) {
        setSelectedCacheEndpoint(Object.keys(stats.cacheStats)[0]);
      }
    }
  }, [stats, selectedCacheEndpoint]);

  const reconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    setError(null);
    connectToSSE();
  }, [connectToSSE]);

  const clearCache = useCallback(async (endpoint: string) => {
    setClearingCache(endpoint);
    try {
      const response = await fetchFromBuildUrl(
        `cache-proxy/cache/clear`,
        { endpoint },
        {
          method: 'POST',
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.statusText}`);
      }
      
      toast.success(`Cache cleared for ${endpoint}`);
    } catch (err) {
      console.error('Error clearing cache:', err);
      toast.error(`Failed to clear cache for ${endpoint}`);
    } finally {
      setClearingCache(null);
    }
  }, []);

  // Show password prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Activity Page - Password Required</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password:
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter password"
                  className={passwordError ? 'border-red-500' : ''}
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-full mx-auto space-y-6 flex flex-col h-[calc(100vh-3rem)]">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle>Activity Monitor</CardTitle>
                  <CardDescription>Real-time query performance and cache statistics</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px]">
                      {selectedServer.name}
                      <IconChevronDown size={14} className="ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {availableServers.map((server) => {
                      const statusInfo = cacheStatuses?.get(server.id);
                      // Only disable if we have status info and it's offline
                      // If statusInfo is null/undefined, we haven't checked yet, so allow selection
                      const isDisabled = statusInfo !== undefined && !statusInfo.isOnline;
                      
                      return (
                        <DropdownMenuItem
                          key={server.id}
                          onClick={() => {
                            if (!isDisabled) {
                              setSelectedServer(server);
                              if (connectionRef.current) {
                                connectionRef.current.close();
                                connectionRef.current = null;
                              }
                            }
                          }}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                        >
                          <span className={isDisabled ? 'text-muted-foreground' : ''}>
                            {server.name}
                          </span>
                          {isDisabled && (
                            <span className="ml-auto text-xs text-muted-foreground">(Offline)</span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`text-sm font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <Button
                  onClick={reconnect}
                  variant="outline"
                  size="sm"
                >
                  Reconnect
                </Button>
              </div>
            </div>
          </CardHeader>
          {error && (
            <CardContent>
              <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            </CardContent>
          )}
        </Card>

        <Tabs defaultValue="activity" className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity">Activity Monitor</TabsTrigger>
            <TabsTrigger value="sse">SSE Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="flex-1 mt-6 min-h-0 overflow-hidden">
            {stats ? (
              <>
                {/* Query Statistics, Recent Activity, and Cache Statistics - 3 card layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full max-h-full">
                  {/* Query Statistics */}
                  <Card className="flex flex-col h-full max-h-full overflow-hidden">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle className="text-lg">Query Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1 overflow-y-auto min-h-0">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Queries:</span>
                        <span className="font-semibold">{stats.queries.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cached Queries:</span>
                        <span className="font-semibold">{stats.queries.cached.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cache Hit Rate:</span>
                        <span className="font-semibold">
                          {stats.queries.total > 0
                            ? `${((stats.queries.cached / stats.queries.total) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Time:</span>
                        <span className="font-semibold">{formatDuration(stats.queries.averageTimeMs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Cached Time:</span>
                        <span className="font-semibold">{formatDuration(stats.queries.cachedAverageTimeMs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Max Time:</span>
                        <span className="font-semibold">{formatDuration(stats.queries.maxTimeMs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Max Cached Time:</span>
                        <span className="font-semibold">{formatDuration(stats.queries.cachedMaxTimeMs)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activity */}
                  <Card className="flex flex-col h-full max-h-full overflow-hidden">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                      <CardDescription>{stats.recentActivity.length} queries</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                      <div className="flex-1 overflow-y-auto min-h-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Time</TableHead>
                              <TableHead>Endpoint</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.recentActivity.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                  No recent activity
                                </TableCell>
                              </TableRow>
                            ) : (
                              stats.recentActivity
                                .slice()
                                .reverse()
                                .map((activity, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono text-xs">
                                      {formatTimestamp(activity.timestamp)}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm">{activity.endpoint}</TableCell>
                                    <TableCell className="font-mono">
                                      <Badge variant={activity.durationMs > 100 ? 'destructive' : activity.durationMs > 50 ? 'outline' : 'secondary'}>
                                        {formatDuration(activity.durationMs)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={activity.cached ? 'default' : 'outline'}>
                                        {activity.cached ? 'Cached' : 'Live'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cache Statistics */}
                  <Card className="flex flex-col h-full max-h-full overflow-hidden">
                    <CardHeader className="flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Cache Statistics</CardTitle>
                        {Object.keys(stats.cacheStats).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2">
                                {selectedCacheEndpoint || 'Select endpoint'}
                                <IconChevronDown size={14} className="ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {Object.keys(stats.cacheStats).map((endpoint) => (
                                <DropdownMenuItem
                                  key={endpoint}
                                  onClick={() => setSelectedCacheEndpoint(endpoint)}
                                >
                                  {endpoint}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto min-h-0">
                      {selectedCacheEndpoint && stats.cacheStats[selectedCacheEndpoint] ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{selectedCacheEndpoint}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => clearCache(selectedCacheEndpoint)}
                              disabled={clearingCache === selectedCacheEndpoint}
                              className="h-7 px-2"
                            >
                              <IconTrash size={14} className="mr-1" />
                              {clearingCache === selectedCacheEndpoint ? 'Clearing...' : 'Clear'}
                            </Button>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Size:</span>
                            <span>{stats.cacheStats[selectedCacheEndpoint].size} / {stats.cacheStats[selectedCacheEndpoint].maxSize}</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${(stats.cacheStats[selectedCacheEndpoint].size / stats.cacheStats[selectedCacheEndpoint].maxSize) * 100}%` }}
                            />
                          </div>
                          {stats.cacheStats[selectedCacheEndpoint].earliestExpirationMs !== null && stats.cacheStats[selectedCacheEndpoint].earliestExpirationMs !== undefined && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Earliest Expires:</span>
                              <span>{formatTimeUntil(stats.cacheStats[selectedCacheEndpoint].earliestExpirationMs)}</span>
                            </div>
                          )}
                          {stats.cacheStats[selectedCacheEndpoint].latestExpirationMs !== null && stats.cacheStats[selectedCacheEndpoint].latestExpirationMs !== undefined && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Latest Expires:</span>
                              <span>{formatTimeUntil(stats.cacheStats[selectedCacheEndpoint].latestExpirationMs)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No cache statistics available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : isConnected ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Waiting for activity data...
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="sse" className="flex-1 mt-6 min-h-0 overflow-hidden">
            <Card className="h-full max-h-full flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Server-Sent Events Monitor</CardTitle>
                      <CardDescription>Monitor SSE events in real-time</CardDescription>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${sseIsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={`text-sm font-medium ${sseIsConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {sseIsConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                      <Button
                        onClick={() => setSseEvents([])}
                        variant="outline"
                        size="sm"
                      >
                        Clear Events
                      </Button>
                      <Button
                        onClick={() => {
                          if (sseConnectionRef.current) {
                            if (sseEventType === 'ALL') {
                              (sseConnectionRef.current as EventSource).close();
                            } else {
                              (sseConnectionRef.current as any).close?.();
                            }
                            setSseIsConnected(false);
                            sseConnectionRef.current = null;
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Disconnect
                      </Button>
                      <Button
                        onClick={() => {
                          if (sseConnectionRef.current) {
                            if (sseEventType === 'ALL') {
                              (sseConnectionRef.current as EventSource).close();
                            } else {
                              (sseConnectionRef.current as any).close?.();
                            }
                            sseConnectionRef.current = null;
                          }
                          setSseEvents([]);
                          setSseError(null);
                          connectToSSEMonitor();
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Reconnect
                      </Button>
                      </div>
                    </div>
                  </div>
                  {/* Event Type Selector */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2">
                        Event Type:
                      </label>
                      <select
                        value={sseEventType}
                        onChange={(e) => {
                          const newType = e.target.value as SseEventType | 'ALL';
                          setSseEventType(newType);
                          if (sseConnectionRef.current) {
                            if (newType === 'ALL') {
                              (sseConnectionRef.current as EventSource).close();
                            } else {
                              (sseConnectionRef.current as any).close?.();
                            }
                            sseConnectionRef.current = null;
                          }
                        }}
                        className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground"
                      >
                        <option value="ALL">ALL</option>
                        <option value={SseEventType.STATUS}>{SseEventType.STATUS}</option>
                        <option value={SseEventType.ACTIVITY}>{SseEventType.ACTIVITY}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4 min-h-0">

                {sseError && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
                    {sseError}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Events ({sseEvents.length})</h3>
                    <span className="text-sm text-muted-foreground">
                      Endpoint: {getBackendUrl(selectedServer)}/sse{sseEventType !== 'ALL' ? `?type=${sseEventType}` : ''}
                    </span>
                  </div>
                </div>

                <div
                  ref={sseEventsContainerRef}
                  className="bg-muted rounded-lg p-4 flex-1 overflow-y-auto border min-h-0"
                >
                  {sseEvents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p>No events received yet...</p>
                      <p className="text-sm mt-2">Waiting for events from the server...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sseEvents.map((event) => (
                        <div
                          key={event.id}
                          className="bg-background p-4 rounded-lg border shadow-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {event.timestamp.toLocaleTimeString()}
                              </span>
                              <Badge variant="outline">
                                {event.type}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">#{event.id}</span>
                          </div>
                          
                          {/* Display event data based on type */}
                          {event.type === SseEventType.STATUS ? (
                            <div className="space-y-2 mt-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="font-semibold">Status:</span>
                                  <span className="ml-2">{event.data.status}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Game:</span>
                                  <span className="ml-2">{event.data.game}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Revision:</span>
                                  <span className="ml-2">{event.data.revision}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Port:</span>
                                  <span className="ml-2">{event.data.port}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Environment:</span>
                                  <span className="ml-2">{event.data.environment}</span>
                                </div>
                                {event.data.progress !== null && event.data.progress !== undefined && (
                                  <div>
                                    <span className="font-semibold">Progress:</span>
                                    <span className="ml-2">{event.data.progress}%</span>
                                  </div>
                                )}
                              </div>
                              
                              {event.data.statusMessage && (
                                <div className="mt-2 p-2 bg-muted rounded">
                                  <span className="font-semibold">Message:</span>
                                  <span className="ml-2">{event.data.statusMessage}</span>
                                </div>
                              )}
                            </div>
                          ) : event.type === SseEventType.ACTIVITY ? (
                            <div className="space-y-2 mt-3">
                              <div className="text-sm">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <span className="font-semibold">Total Queries:</span>
                                    <span className="ml-2">{event.data.queries?.total || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Cached Queries:</span>
                                    <span className="ml-2">{event.data.queries?.cached || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Active Queries:</span>
                                    <span className="ml-2">{event.data.active?.activeQueries || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Recent Activity:</span>
                                    <span className="ml-2">{event.data.recentActivity?.length || 0} entries</span>
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Cache endpoints: {event.data.cacheStats ? Object.keys(event.data.cacheStats).join(', ') : 'N/A'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 mt-3 text-sm text-muted-foreground">
                              <p>Event type: {event.type}</p>
                              <p>Data structure not recognized. View raw JSON for details.</p>
                            </div>
                          )}

                          {/* Raw JSON view */}
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              View Raw JSON
                            </summary>
                            <pre className="mt-2 bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                              {JSON.stringify(event.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

