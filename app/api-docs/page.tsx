'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconCopy, IconCheck, IconChevronDown, IconChevronRight, IconPlayerPlay } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QueryParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string | null;
}

interface EndpointInfo {
  method: string;
  path: string;
  description: string;
  category: string;
  queryParams: QueryParam[];
  examples: string[];
  responseType?: string | null;
}

interface EndpointsData {
  baseUrl: string;
  endpoints: EndpointInfo[];
}

export default function ApiDocsPage() {
  const [data, setData] = useState<EndpointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string>('');
  const [testEndpoint, setTestEndpoint] = useState<EndpointInfo | null>(null);

  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchFromBuildUrl('endpoints/data');

        if (!response.ok) {
          throw new Error(`Failed to fetch endpoints: ${response.statusText}`);
        }
        
        const endpointsData: EndpointsData = await response.json();
        setData(endpointsData);
        
        // Set first category as default active tab
        const categories = Array.from(new Set(endpointsData.endpoints.map(e => e.category))).sort();
        if (categories.length > 0) {
          setActiveTab(categories[0]);
        }
        
        // Set default open endpoints based on category size
        const initialOpenEndpoints = new Set<string>();
        categories.forEach(category => {
          const categoryEndpoints = endpointsData.endpoints.filter(e => e.category === category);
          if (categoryEndpoints.length === 2) {
            // Open both if only 2 endpoints
            categoryEndpoints.forEach(endpoint => {
              initialOpenEndpoints.add(`${endpoint.method}-${endpoint.path}`);
            });
          } else if (categoryEndpoints.length > 0) {
            // Open first one if more than 2
            const firstEndpoint = categoryEndpoints[0];
            initialOpenEndpoints.add(`${firstEndpoint.method}-${firstEndpoint.path}`);
          }
        });
        setOpenEndpoints(initialOpenEndpoints);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchEndpoints();
  }, []);

  // Cleanup blob URLs when modal closes
  useEffect(() => {
    return () => {
      if (testResponse?.type === 'image' && testResponse?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(testResponse.url);
      }
    };
  }, [testModalOpen]);

  // Update parameter value - memoized to prevent unnecessary re-renders
  const updateParamValue = useCallback((endpoint: EndpointInfo, paramName: string, value: string) => {
    const endpointKey = `${endpoint.method}-${endpoint.path}`;
    setParamValues(prev => {
      // Only update if value actually changed
      const currentValue = prev[endpointKey]?.[paramName];
      if (currentValue === value) return prev;
      
      return {
        ...prev,
        [endpointKey]: {
          ...prev[endpointKey],
          [paramName]: value,
        },
      };
    });
  }, []);

  // Get parameter value
  const getParamValue = useCallback((endpoint: EndpointInfo, paramName: string): string => {
    const endpointKey = `${endpoint.method}-${endpoint.path}`;
    return paramValues[endpointKey]?.[paramName] || '';
  }, [paramValues]);

  // Render parameter input - memoized to prevent re-renders
  const renderParamInput = useCallback((endpoint: EndpointInfo, param: QueryParam) => {
    const value = getParamValue(endpoint, param.name);
    const isBoolean = param.type.toLowerCase().includes('boolean');
    const isSearchMode = param.name === 'searchMode';
    const isDataType = param.name === 'dataType';
    
    if (isDataType) {
      const currentValue = value || 'web';
      const inputId = `${endpoint.path}-${param.name}`;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id={inputId} variant="outline" size="sm" className="h-8 w-24 text-xs flex items-center justify-between">
              <span className="capitalize">{currentValue}</span>
              <IconChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-24">
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'web')}
              className={currentValue === 'web' ? 'font-bold' : ''}
            >
              Web
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'cache')}
              className={currentValue === 'cache' ? 'font-bold' : ''}
            >
              Cache
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    
    if (isSearchMode) {
      const currentValue = value || '';
      const inputId = `${endpoint.path}-${param.name}`;
      const searchModeLabels: Record<string, string> = {
        'ID': 'ID',
        'GAMEVAL': 'Gameval',
        'REGEX': 'Regex',
        'NAME': 'Name',
      };
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id={inputId} variant="outline" size="sm" className="h-8 w-28 text-xs flex items-center justify-between">
              <span>{currentValue ? searchModeLabels[currentValue] || currentValue : 'Select...'}</span>
              <IconChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-28">
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'ID')}
              className={currentValue === 'ID' ? 'font-bold' : ''}
            >
              ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'GAMEVAL')}
              className={currentValue === 'GAMEVAL' ? 'font-bold' : ''}
            >
              Gameval
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'REGEX')}
              className={currentValue === 'REGEX' ? 'font-bold' : ''}
            >
              Regex
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateParamValue(endpoint, param.name, 'NAME')}
              className={currentValue === 'NAME' ? 'font-bold' : ''}
            >
              Name
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (isBoolean) {
      const inputId = `${endpoint.path}-${param.name}`;
      return (
        <Select
          value={value}
          onValueChange={(newValue) => updateParamValue(endpoint, param.name, newValue)}
        >
          <SelectTrigger id={inputId} className="h-8 w-24 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" className="text-xs">true</SelectItem>
            <SelectItem value="false" className="text-xs">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        id={`${endpoint.path}-${param.name}`}
        type="text"
        placeholder={param.defaultValue ? `Default: ${param.defaultValue}` : param.name}
        value={value}
        onChange={(e) => updateParamValue(endpoint, param.name, e.target.value)}
      />
    );
  }, [getParamValue, updateParamValue]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const runQuery = async (endpoint: EndpointInfo, url: string) => {
    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestUrl(url);
    setTestEndpoint(endpoint);
    setTestModalOpen(true);

    try {
      // Extract the path from the full URL
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      
      // Remove the baseUrl to get just the endpoint path
      const endpointPath = path.startsWith('/') ? path : `/${path}`;
      
      // Use fetchFromBuildUrl which handles the API proxy
      const response = await fetchFromBuildUrl(endpointPath);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      // Check if response is JSON or an image
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const jsonData = await response.json();
        setTestResponse(jsonData);
      } else if (contentType.includes('image/')) {
        // For images, create a blob URL
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setTestResponse({ type: 'image', url: imageUrl, contentType });
      } else if (contentType.includes('application/octet-stream')) {
        // For binary data, show info
        const blob = await response.blob();
        setTestResponse({ 
          type: 'binary', 
          size: blob.size, 
          contentType: 'application/octet-stream' 
        });
      } else {
        // Try to parse as text
        const text = await response.text();
        try {
          const jsonData = JSON.parse(text);
          setTestResponse(jsonData);
        } catch {
          setTestResponse({ type: 'text', content: text });
        }
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setTestLoading(false);
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PUT':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getTypeColor = (type: string) => {
    if (type.includes('Int')) return 'text-blue-400';
    if (type.includes('String')) return 'text-green-400';
    if (type.includes('Boolean')) return 'text-yellow-400';
    if (type.includes('Range')) return 'text-purple-400';
    return 'text-muted-foreground';
  };

  const formatType = (type: string) => {
    // Remove package prefix if present
    return type.replace(/^dev\.openrune\.server\./, '');
  };

  const formatDescription = (param: QueryParam): string => {
    // Simplify the 'q' parameter description
    if (param.name === 'q') {
      return 'Search query. Format depends on searchMode. Use ranges for ID mode, quoted strings for exact gameval matches, or plain text for regex/name.';
    }
    return param.description;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8 max-w-7xl">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-4">API Endpoints</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading endpoints: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-4">API Endpoints</h1>
        <p className="text-muted-foreground">No endpoint data available</p>
      </div>
    );
  }

  // Group endpoints by category
  const groupedEndpoints = data.endpoints.reduce((acc, endpoint) => {
    if (!acc[endpoint.category]) {
      acc[endpoint.category] = [];
    }
    acc[endpoint.category].push(endpoint);
    return acc;
  }, {} as Record<string, EndpointInfo[]>);

  const categories = Object.keys(groupedEndpoints).sort();

  // Common query parameters that appear across many endpoints
  const commonParamNames = ['limit', 'searchMode', 'q', 'idRange', 'id', 'gameVal'];
  
  // Find common parameters from the first endpoint that has them
  const findCommonParams = (): QueryParam[] => {
    for (const endpoint of data.endpoints) {
      const commonParams = endpoint.queryParams.filter(param => 
        commonParamNames.includes(param.name)
      );
      if (commonParams.length > 0) {
        return commonParams.sort((a, b) => {
          const idxA = commonParamNames.indexOf(a.name);
          const idxB = commonParamNames.indexOf(b.name);
          return idxA - idxB;
        });
      }
    }
    return [];
  };

  const commonParams = findCommonParams();

  // Filter out common parameters from endpoint params
  const getEndpointSpecificParams = (endpoint: EndpointInfo): QueryParam[] => {
    return endpoint.queryParams.filter(param => 
      !commonParamNames.includes(param.name)
    );
  };

  // Get all parameters (common + endpoint-specific) for URL building
  const getAllParams = (endpoint: EndpointInfo): QueryParam[] => {
    // For /models/{param} endpoint, only show id parameter
    if (endpoint.path.includes('/models/{param}')) {
      const idParam = endpoint.queryParams.find(p => p.name === 'id');
      return idParam ? [idParam] : [];
    }
    
    // For /sprites endpoint, only show specific parameters
    if (endpoint.path === '/sprites') {
      const allowedParams = ['id', 'width', 'height', 'keepAspectRatio', 'indexed'];
      return endpoint.queryParams.filter(param => allowedParams.includes(param.name));
    }
    
    const allParams = [...endpoint.queryParams];
    
    // Add dataType parameter if it doesn't exist
    const hasDataType = allParams.some(p => p.name === 'dataType');
    if (!hasDataType) {
      allParams.unshift({
        name: 'dataType',
        type: 'String',
        required: false,
        description: 'Data type: web (default) or cache',
        defaultValue: 'web',
      });
    }
    
    return allParams;
  };

  // Build URL from parameters
  const buildUrl = (endpoint: EndpointInfo): string => {
    const endpointKey = `${endpoint.method}-${endpoint.path}`;
    const values = paramValues[endpointKey] || {};
    const params: string[] = [];
    
    // Handle /models/{param} endpoint - replace {param} with id value
    let path = endpoint.path;
    const isModelsParamEndpoint = path.includes('/models/{param}');
    if (isModelsParamEndpoint) {
      const idValue = values['id'];
      if (idValue && idValue.trim() !== '') {
        path = path.replace('{param}', idValue);
      } else {
        path = path.replace('{param}', 'id');
      }
    }
    
    getAllParams(endpoint).forEach(param => {
      // Skip id param for /models/{param} as it's in the path
      if (isModelsParamEndpoint && param.name === 'id') {
        return;
      }
      
      const value = values[param.name];
      if (value && value.trim() !== '') {
        params.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`);
      } else if (param.name === 'dataType' && !value) {
        // Default dataType to 'web' if not set
        params.push(`${encodeURIComponent(param.name)}=web`);
      } else if (param.required && param.defaultValue) {
        params.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(param.defaultValue)}`);
      }
    });

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return `${data.baseUrl}${path}${queryString}`;
  };


  return (
    <div className="w-full h-screen overflow-hidden p-8 flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold mb-2">API Endpoints</h1>
        <p className="text-muted-foreground">
          Base URL: <code className="bg-muted px-2 py-1 rounded text-sm">{data.baseUrl}</code>
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
          <TabsList className="flex flex-col h-fit w-64">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="text-sm justify-start">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex-1 min-w-0 min-h-0">
          {categories.map((category) => (
            <div key={category} className={activeTab === category ? 'block h-full' : 'hidden'}>
              <Card className="h-full flex flex-col">
                <CardContent className="pt-6 flex-1 overflow-hidden">
                  <div className="h-full overflow-y-scroll pr-4 space-y-6">
                {groupedEndpoints[category].map((endpoint, idx) => {
                  const endpointKey = `${endpoint.method}-${endpoint.path}`;
                  const isOpen = openEndpoints.has(endpointKey);
                  
                  return (
                    <Collapsible
                      key={idx}
                      open={isOpen}
                      onOpenChange={(open) => {
                        setOpenEndpoints(prev => {
                          const next = new Set(prev);
                          if (open) {
                            next.add(endpointKey);
                          } else {
                            next.delete(endpointKey);
                          }
                          return next;
                        });
                      }}
                    >
                      <div className="border-b last:border-b-0 pb-4 last:pb-0">
                        <CollapsibleTrigger asChild>
                          <button className="w-full text-left">
                            <div className="flex items-center gap-3 mb-3 hover:bg-muted/50 -mx-3 px-3 py-2 rounded transition-colors">
                              <IconChevronDown className={cn(
                                "h-4 w-4 flex-shrink-0 transition-transform duration-300",
                                !isOpen && "-rotate-90"
                              )} />
                              <Badge className={cn('font-mono', getMethodColor(endpoint.method))}>
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
                                {endpoint.path.includes('/models/{param}') ? endpoint.path.replace('{param}', 'id') : endpoint.path}
                              </code>
                              {endpoint.responseType && (
                                <Badge variant="outline" className="text-xs">
                                  {endpoint.responseType}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{endpoint.description}</p>
                          </button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>

                    {getEndpointSpecificParams(endpoint).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-2">Query Parameters</h4>
                        <div className="space-y-2">
                          {getEndpointSpecificParams(endpoint).map((param, paramIdx) => (
                            <div key={paramIdx} className="bg-muted/50 p-3 rounded border">
                              <div className="flex items-start gap-2 mb-1">
                                <code className="text-sm font-semibold text-foreground">
                                  {param.name}
                                </code>
                                <Badge variant="outline" className="text-xs">
                                  <span className={getTypeColor(param.type)}>{formatType(param.type)}</span>
                                </Badge>
                                {param.required && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {param.defaultValue && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default: {param.defaultValue}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatDescription(param)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {getAllParams(endpoint).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">URL Builder</h4>
                        <div className="space-y-2 mb-4">
                          {getAllParams(endpoint).map((param, paramIdx) => (
                            <div key={paramIdx} className="flex items-center gap-2">
                              <div className="flex items-center gap-2 min-w-[200px]">
                                <Label htmlFor={`${endpoint.path}-${param.name}`} className="text-xs font-medium">
                                  {param.name}
                                  {param.required && <span className="text-destructive ml-1">*</span>}
                                </Label>
                                <Badge variant="outline" className="text-xs">
                                  <span className={getTypeColor(param.type)}>{formatType(param.type)}</span>
                                </Badge>
                              </div>
                              <div className="flex-1">
                                {renderParamInput(endpoint, param)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const builtUrl = buildUrl(endpoint);
                          return (
                            <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono text-green-400 flex-1 break-all">
                                  {builtUrl}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                  onClick={() => runQuery(endpoint, builtUrl)}
                                  title="Run Query"
                                >
                                  <IconPlayerPlay className="h-4 w-4 text-blue-400" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                  onClick={() => copyToClipboard(builtUrl)}
                                >
                                  {copiedUrl === builtUrl ? (
                                    <IconCheck className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <IconCopy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {commonParams.length > 0 && (
          <div className="w-[18.75rem] flex-shrink-0 min-h-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0 pb-2">
                <CardTitle className="text-base">Common Query Parameters</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pr-6 pt-0">
                <div className="space-y-3 -mt-6">
                  {commonParams.map((param, paramIdx) => {
                    const isSearchMode = param.name === 'searchMode';
                    const searchModeValues = ['ID', 'GAMEVAL', 'REGEX', 'NAME'];
                    
                    return (
                      <div key={paramIdx} className="bg-muted/50 p-3 rounded border">
                        <div className="flex items-start gap-2 mb-1">
                          <code className="text-sm font-semibold text-foreground">
                            {param.name}
                          </code>
                          <Badge variant="outline" className="text-xs">
                            <span className={getTypeColor(param.type)}>{formatType(param.type)}</span>
                          </Badge>
                          {param.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                          {param.defaultValue && (
                            <Badge variant="secondary" className="text-xs">
                              Default: {param.defaultValue}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{formatDescription(param)}</p>
                        {isSearchMode && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-foreground mb-1.5">Valid values:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {searchModeValues.map((mode) => (
                                <Badge 
                                  key={mode} 
                                  variant="outline" 
                                  className="text-xs font-mono bg-blue-500/10 text-blue-400 border-blue-500/30"
                                >
                                  {mode}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Test Query Modal */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPlayerPlay className="h-5 w-5" />
              Test Query Result
            </DialogTitle>
            <DialogDescription className="break-all">
              {testEndpoint && (
                <span className="flex items-center gap-2">
                  <Badge className={cn('font-mono', getMethodColor(testEndpoint.method))}>
                    {testEndpoint.method}
                  </Badge>
                  <code className="text-xs">{testUrl}</code>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-4">
            {testLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading response...</p>
                </div>
              </div>
            ) : testError ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-destructive font-semibold mb-2">Error</p>
                <p className="text-sm text-muted-foreground">{testError}</p>
              </div>
            ) : testResponse ? (
              <div className="flex-1 overflow-y-auto min-h-0">
                {testResponse.type === 'image' ? (
                  <div className="space-y-4">
                    <img 
                      src={testResponse.url} 
                      alt="Response" 
                      className="max-w-full h-auto rounded border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Content-Type: {testResponse.contentType}
                    </p>
                  </div>
                ) : testResponse.type === 'binary' ? (
                  <div className="bg-muted/50 p-4 rounded border">
                    <p className="text-sm font-semibold mb-2">Binary Data</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {(testResponse.size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Content-Type: {testResponse.contentType}
                    </p>
                  </div>
                ) : testResponse.type === 'text' ? (
                  <pre className="bg-muted/50 p-4 rounded border overflow-x-auto text-xs">
                    {testResponse.content}
                  </pre>
                ) : (
                  <pre className="bg-muted/50 p-4 rounded border overflow-x-auto text-xs">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}