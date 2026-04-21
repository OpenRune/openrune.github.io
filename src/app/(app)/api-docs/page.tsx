"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Copy, Play, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type QueryParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string | null;
};

type EndpointInfo = {
  method: string;
  path: string;
  description: string;
  category: string;
  queryParams: QueryParam[];
  responseType?: string | null;
  pathOptions?: string[] | null;
};

type EndpointsData = {
  baseUrl: string;
  endpoints: EndpointInfo[];
};

const ID_RANGE_PARTS = ["idRangeMin", "idRangeMax"] as const;
const COMMON_PARAM_NAMES = ["limit", "searchmode", "q", "idrange", "id", "gameval"] as const;

function nameEq(name: string, expected: string): boolean {
  return name.trim().toLowerCase() === expected.trim().toLowerCase();
}

function normalizeEndpointsData(input: unknown): EndpointsData {
  const root = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const baseUrl = typeof root.baseUrl === "string"
    ? root.baseUrl
    : (typeof root.base_url === "string" ? root.base_url : "");

  const rawEndpoints = Array.isArray(root.endpoints)
    ? root.endpoints
    : (Array.isArray(root.data) ? root.data : []);

  const endpoints: EndpointInfo[] = rawEndpoints
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((endpoint) => {
      const method = typeof endpoint.method === "string" ? endpoint.method : "GET";
      const path = typeof endpoint.path === "string" ? endpoint.path : "";
      const description = typeof endpoint.description === "string" ? endpoint.description : "";
      const category = typeof endpoint.category === "string" ? endpoint.category : "General";

      const rawQueryParams = Array.isArray(endpoint.queryParams)
        ? endpoint.queryParams
        : (Array.isArray(endpoint.query_params)
          ? endpoint.query_params
          : (Array.isArray(endpoint.params) ? endpoint.params : []));

      const queryParams: QueryParam[] = rawQueryParams
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((param) => ({
          name: typeof param.name === "string" ? param.name : "",
          type: typeof param.type === "string" ? param.type : "String",
          required: typeof param.required === "boolean"
            ? param.required
            : (typeof param.isRequired === "boolean" ? param.isRequired : false),
          description: typeof param.description === "string" ? param.description : "",
          defaultValue: typeof param.defaultValue === "string"
            ? param.defaultValue
            : (typeof param.default_value === "string"
              ? param.default_value
              : (param.defaultValue === null || param.default_value === null ? null : undefined)),
        }))
        .filter((param) => param.name.length > 0);

      const responseType = typeof endpoint.responseType === "string"
        ? endpoint.responseType
        : (typeof endpoint.response_type === "string" ? endpoint.response_type : null);

      const pathOptionsRaw = Array.isArray(endpoint.pathOptions)
        ? endpoint.pathOptions
        : (Array.isArray(endpoint.path_options) ? endpoint.path_options : null);
      const pathOptions = pathOptionsRaw
        ? pathOptionsRaw.filter((v): v is string => typeof v === "string" && v.length > 0)
        : null;

      return { method, path, description, category, queryParams, responseType, pathOptions };
    })
    .filter((endpoint) => endpoint.path.length > 0);

  return { baseUrl, endpoints };
}

async function fetchApiJson<T>(path: string): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`/api${normalized}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "POST":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    case "PUT":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "DELETE":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function typeColor(type: string): string {
  if (type.includes("Int")) return "text-blue-400";
  if (type.includes("String")) return "text-green-400";
  if (type.includes("Boolean")) return "text-amber-400";
  if (type.includes("Range")) return "text-violet-400";
  return "text-muted-foreground";
}

function formatParamType(type: string): string {
  return type.replace(/^dev\.openrune\.server\./, "");
}

function createEndpointKey(endpoint: EndpointInfo): string {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}

function endpointSpecificParams(endpoint: EndpointInfo): QueryParam[] {
  return endpoint.queryParams.filter((param) => !COMMON_PARAM_NAMES.includes(param.name.toLowerCase() as (typeof COMMON_PARAM_NAMES)[number]));
}

function allBuilderParams(endpoint: EndpointInfo): QueryParam[] {
  if (endpoint.path.includes("/models/{param}")) {
    const idParam = endpoint.queryParams.find((p) => p.name === "id");
    return idParam ? [idParam] : [];
  }

  if (endpoint.path === "/sprites") {
    const allowed = new Set(["id", "width", "height", "keepAspectRatio", "indexed"]);
    return endpoint.queryParams.filter((p) => allowed.has(p.name));
  }

  const params = [...endpoint.queryParams];
  if (!params.some((p) => p.name === "dataType")) {
    params.unshift({
      name: "dataType",
      type: "String",
      required: false,
      description: "Data type: web (default) or cache",
      defaultValue: "web",
    });
  }
  return params;
}

function buildUrlForEndpoint(
  endpoint: EndpointInfo,
  baseUrl: string,
  values: Record<string, string>,
  configPathSegments: string[],
): string {
  let path = endpoint.path;
  const pathOptions = endpoint.path === "/configs" ? configPathSegments : (endpoint.pathOptions ?? []);
  if (pathOptions.length > 0) {
    const selected = values.__pathOption?.trim() || pathOptions[0];
    path = `/${selected}`;
  }

  const isModelsParam = path.includes("/models/{param}");
  if (isModelsParam) {
    const id = values.id?.trim() || "id";
    path = path.replace("{param}", encodeURIComponent(id));
  }

  const params: string[] = [];
  const idRangeMin = values.idRangeMin?.trim() ?? "";
  const idRangeMax = values.idRangeMax?.trim() ?? "";
  const hasIdRange = idRangeMin !== "" || idRangeMax !== "";

  for (const param of allBuilderParams(endpoint)) {
    const name = param.name;
    if (name === "__pathOption") continue;
    if (isModelsParam && nameEq(name, "id")) continue;
    if (nameEq(name, "id") && hasIdRange) continue;

    if (nameEq(name, "idRange")) {
      if (hasIdRange) {
        const min = idRangeMin || idRangeMax;
        const max = idRangeMax || idRangeMin;
        params.push(`idRange=${encodeURIComponent(`${min}..${max}`)}`);
      }
      continue;
    }

    if (nameEq(name, "rev")) {
      const rev = values.rev?.trim() || "latest";
      if (rev !== "latest") params.push(`rev=${encodeURIComponent(rev)}`);
      continue;
    }

    const value = values[name]?.trim();
    if (value) {
      params.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
    } else if (nameEq(name, "dataType")) {
      params.push("dataType=web");
    } else if (param.required && param.defaultValue) {
      params.push(`${encodeURIComponent(name)}=${encodeURIComponent(param.defaultValue)}`);
    }
  }

  return `${baseUrl}${path}${params.length ? `?${params.join("&")}` : ""}`;
}

export default function ApiDocsPage() {
  const [data, setData] = React.useState<EndpointsData | null>(null);
  const [configPathSegments, setConfigPathSegments] = React.useState<string[]>([]);
  const [revisionOptions, setRevisionOptions] = React.useState<string[]>(["latest"]);
  const [serverRevision, setServerRevision] = React.useState<number | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeCategory, setActiveCategory] = React.useState("");
  const [openEndpointKeys, setOpenEndpointKeys] = React.useState<Set<string>>(new Set());
  const [paramValues, setParamValues] = React.useState<Record<string, Record<string, string>>>({});
  const [copied, setCopied] = React.useState<string | null>(null);

  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testLoading, setTestLoading] = React.useState(false);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [testResponse, setTestResponse] = React.useState<unknown>(null);
  const [testUrl, setTestUrl] = React.useState("");
  const [testMethod, setTestMethod] = React.useState("GET");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [endpointsDataRaw] = await Promise.all([
          fetchApiJson<unknown>("/endpoints/data"),
          fetchApiJson<{ pathSegments?: string[] }>("/config-types")
            .then((v) => {
              if (!cancelled && Array.isArray(v.pathSegments)) setConfigPathSegments(v.pathSegments);
            })
            .catch(() => {
              // Optional endpoint.
            }),
          fetchApiJson<{ revisionOptions?: string[]; serverRevision?: number }>("/revisions")
            .then((v) => {
              if (cancelled) return;
              if (Array.isArray(v.revisionOptions) && v.revisionOptions.length > 0) {
                setRevisionOptions(v.revisionOptions);
              }
              if (typeof v.serverRevision === "number") setServerRevision(v.serverRevision);
            })
            .catch(() => {
              // Optional endpoint.
            }),
        ]);

        if (cancelled) return;
        const endpointsData = normalizeEndpointsData(endpointsDataRaw);
        setData(endpointsData);

        const categories = Array.from(new Set(endpointsData.endpoints.map((e) => e.category))).sort();
        if (categories.length > 0) setActiveCategory(categories[0]);

        const initialOpen = new Set<string>();
        for (const category of categories) {
          const inCat = endpointsData.endpoints.filter((e) => e.category === category);
          if (inCat.length === 2) {
            initialOpen.add(createEndpointKey(inCat[0]));
            initialOpen.add(createEndpointKey(inCat[1]));
          } else if (inCat.length > 0) {
            initialOpen.add(createEndpointKey(inCat[0]));
          }
        }
        setOpenEndpointKeys(initialOpen);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load API docs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = React.useMemo(() => {
    if (!data) return {} as Record<string, EndpointInfo[]>;
    return data.endpoints.reduce((acc, endpoint) => {
      (acc[endpoint.category] ||= []).push(endpoint);
      return acc;
    }, {} as Record<string, EndpointInfo[]>);
  }, [data]);

  const categories = React.useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const commonParams = React.useMemo(() => {
    if (!data) return [] as QueryParam[];
    const byName = new Map<string, QueryParam>();
    for (const endpoint of data.endpoints) {
      for (const param of endpoint.queryParams) {
        const key = param.name.toLowerCase();
        if (COMMON_PARAM_NAMES.includes(key as (typeof COMMON_PARAM_NAMES)[number]) && !byName.has(key)) {
          byName.set(key, param);
        }
      }
    }
    return Array.from(byName.entries())
      .sort((a, b) => COMMON_PARAM_NAMES.indexOf(a[0] as (typeof COMMON_PARAM_NAMES)[number]) - COMMON_PARAM_NAMES.indexOf(b[0] as (typeof COMMON_PARAM_NAMES)[number]))
      .map(([, param]) => param);
  }, [data]);

  const setParam = React.useCallback((endpointKey: string, name: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [endpointKey]: { ...(prev[endpointKey] ?? {}), [name]: value },
    }));
  }, []);

  const copyText = React.useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  }, []);

  const runQuery = React.useCallback(async (method: string, fullUrl: string) => {
    setTestModalOpen(true);
    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestUrl(fullUrl);
    setTestMethod(method);

    try {
      const target = new URL(fullUrl);
      const response = await fetch(`/api${target.pathname}${target.search}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        setTestResponse(await response.json());
      } else if (contentType.startsWith("image/")) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setTestResponse({ type: "image", url: objectUrl, contentType });
      } else {
        setTestResponse({ type: "text", content: await response.text(), contentType });
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setTestLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!testModalOpen && testResponse && typeof testResponse === "object") {
      const maybe = testResponse as { type?: string; url?: string };
      if (maybe.type === "image" && typeof maybe.url === "string" && maybe.url.startsWith("blob:")) {
        URL.revokeObjectURL(maybe.url);
      }
    }
  }, [testModalOpen, testResponse]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading API Endpoints...</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Fetching endpoint metadata.</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>API Endpoints Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error ?? "No endpoint data returned."}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              <RefreshCw className="mr-1 size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5.5rem)] w-full max-w-[96rem] flex-col gap-4 px-2">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">API Endpoints</h1>
        <p className="text-sm text-muted-foreground">
          Base URL: <code className="rounded bg-muted px-2 py-1">{data.baseUrl}</code>
          {serverRevision != null ? ` · Latest rev ${serverRevision}` : ""}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
          <TabsList className="h-auto w-full flex-col gap-1 p-1">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="w-full justify-start text-sm">
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="min-h-0">
          <CardContent className="space-y-4 overflow-y-auto p-4 lg:h-[calc(100vh-12.25rem)]">
            {(grouped[activeCategory] ?? []).map((endpoint) => {
              const endpointKey = createEndpointKey(endpoint);
              const values = paramValues[endpointKey] ?? {};
              const builtUrl = buildUrlForEndpoint(endpoint, data.baseUrl, values, configPathSegments);
              const isOpen = openEndpointKeys.has(endpointKey);
              const pathOptions = endpoint.path === "/configs" ? configPathSegments : (endpoint.pathOptions ?? []);

              return (
                <Collapsible
                  key={endpointKey}
                  open={isOpen}
                  onOpenChange={(open) => {
                    setOpenEndpointKeys((prev) => {
                      const next = new Set(prev);
                      if (open) next.add(endpointKey);
                      else next.delete(endpointKey);
                      return next;
                    });
                  }}
                >
                  <div className="rounded-lg border bg-muted/20">
                    <CollapsibleTrigger className={cn("flex w-full items-center gap-2 px-3 py-3 text-left", "hover:bg-muted/40")}>
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <Badge className={cn("font-mono", methodColor(endpoint.method))}>{endpoint.method.toUpperCase()}</Badge>
                      <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">{endpoint.path}</code>
                      {endpoint.responseType ? (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {endpoint.responseType}
                        </Badge>
                      ) : null}
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="space-y-4 border-t px-3 py-3">
                        <p className="text-sm text-muted-foreground">{endpoint.description}</p>

                        {pathOptions.length > 0 ? (
                          <div className="space-y-1">
                            <Label className="text-xs">Path option</Label>
                            <NativeSelect
                              value={values.__pathOption ?? pathOptions[0]}
                              onChange={(e) => setParam(endpointKey, "__pathOption", e.target.value)}
                              className="h-8 w-56 px-2 text-xs"
                            >
                              {pathOptions.map((option) => (
                                <option key={option} value={option}>
                                  /{option}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                        ) : null}

                        {endpointSpecificParams(endpoint).length > 0 ? (
                          <div>
                            <h4 className="mb-2 text-sm font-semibold">Query Parameters</h4>
                            <div className="space-y-2">
                              {endpointSpecificParams(endpoint).map((param) => (
                                <div key={param.name} className="rounded border bg-muted/40 p-2.5">
                                  <div className="mb-1 flex items-center gap-2">
                                    <code className="text-sm font-semibold">{param.name}</code>
                                    <Badge variant="outline" className="text-xs">
                                      <span className={typeColor(param.type)}>{formatParamType(param.type)}</span>
                                    </Badge>
                                    {param.required ? <Badge variant="destructive" className="text-xs">Required</Badge> : null}
                                    {param.defaultValue ? (
                                      <Badge variant="secondary" className="text-xs">
                                        Default: {param.defaultValue}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{param.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <h4 className="mb-3 text-sm font-semibold">URL Builder</h4>
                          <div className="space-y-2.5 mb-3">
                            {allBuilderParams(endpoint).map((param) => {
                              const inputId = `${endpointKey}-${param.name}`;
                              const value = values[param.name] ?? "";
                              const isBool = param.type.toLowerCase().includes("boolean");
                              const isRev = nameEq(param.name, "rev");
                              const isIdRange = nameEq(param.name, "idRange");
                              const isSearchMode = nameEq(param.name, "searchMode");
                              const isDataType = nameEq(param.name, "dataType");

                              return (
                                <div key={param.name} className="grid grid-cols-[13rem_minmax(0,1fr)] items-center gap-2">
                                  <Label htmlFor={inputId} className="text-xs">
                                    {param.name}
                                    {param.required ? <span className="ml-1 text-destructive">*</span> : null}
                                    <span className="ml-2 text-[11px] text-muted-foreground">{formatParamType(param.type)}</span>
                                  </Label>

                                  {isBool ? (
                                    <NativeSelect
                                      id={inputId}
                                      value={value}
                                      onChange={(e) => setParam(endpointKey, param.name, e.target.value)}
                                      className="h-8 px-2 text-xs"
                                    >
                                      <option value="">Select</option>
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </NativeSelect>
                                  ) : isSearchMode ? (
                                    <NativeSelect
                                      id={inputId}
                                      value={value}
                                      onChange={(e) => setParam(endpointKey, param.name, e.target.value)}
                                      className="h-8 px-2 text-xs"
                                    >
                                      <option value="">Select</option>
                                      <option value="ID">ID</option>
                                      <option value="GAMEVAL">GAMEVAL</option>
                                      <option value="REGEX">REGEX</option>
                                      <option value="NAME">NAME</option>
                                    </NativeSelect>
                                  ) : isDataType ? (
                                    <NativeSelect
                                      id={inputId}
                                      value={value || "web"}
                                      onChange={(e) => setParam(endpointKey, param.name, e.target.value)}
                                      className="h-8 px-2 text-xs"
                                    >
                                      <option value="web">web</option>
                                      <option value="cache">cache</option>
                                    </NativeSelect>
                                  ) : isRev ? (
                                    <NativeSelect
                                      id={inputId}
                                      value={value || "latest"}
                                      onChange={(e) => setParam(endpointKey, param.name, e.target.value)}
                                      className="h-8 px-2 text-xs"
                                    >
                                      {revisionOptions.map((option) => (
                                        <option key={option} value={option}>
                                          {option === "latest" && serverRevision != null ? `latest (${serverRevision})` : option}
                                        </option>
                                      ))}
                                    </NativeSelect>
                                  ) : isIdRange ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        placeholder="min"
                                        value={values[ID_RANGE_PARTS[0]] ?? ""}
                                        onChange={(e) => setParam(endpointKey, ID_RANGE_PARTS[0], e.target.value)}
                                        className="h-8 px-2 text-xs"
                                      />
                                      <span className="text-xs text-muted-foreground">..</span>
                                      <Input
                                        type="number"
                                        placeholder="max"
                                        value={values[ID_RANGE_PARTS[1]] ?? ""}
                                        onChange={(e) => setParam(endpointKey, ID_RANGE_PARTS[1], e.target.value)}
                                        className="h-8 px-2 text-xs"
                                      />
                                    </div>
                                  ) : (
                                    <Input
                                      id={inputId}
                                      type="text"
                                      value={value}
                                      onChange={(e) => setParam(endpointKey, param.name, e.target.value)}
                                      placeholder={param.defaultValue ? `Default: ${param.defaultValue}` : param.name}
                                      className="h-8 px-2 text-xs"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="rounded-md border border-border bg-zinc-950/60 p-2">
                            <div className="flex items-center gap-2">
                              <code className="flex-1 break-all text-xs text-emerald-400">{builtUrl}</code>
                              <Button variant="ghost" size="icon-sm" onClick={() => runQuery(endpoint.method, builtUrl)} aria-label="Run endpoint query">
                                <Play className="size-4 text-blue-400" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => copyText(builtUrl)} aria-label="Copy endpoint URL">
                                {copied === builtUrl ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Common Query Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto pt-0 lg:h-[calc(100vh-12.25rem)]">
            {commonParams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No common query params found in endpoint metadata.
              </p>
            ) : null}
            {commonParams.map((param) => (
              <div key={param.name} className="rounded border bg-muted/40 p-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <code className="text-sm font-semibold">{param.name}</code>
                  <Badge variant="outline" className="text-xs">
                    <span className={typeColor(param.type)}>{formatParamType(param.type)}</span>
                  </Badge>
                  {param.required ? <Badge variant="destructive" className="text-xs">Required</Badge> : null}
                  {param.defaultValue ? <Badge variant="secondary" className="text-xs">Default: {param.defaultValue}</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">{param.description}</p>
                {nameEq(param.name, "searchMode") ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["ID", "GAMEVAL", "REGEX", "NAME"].map((mode) => (
                      <Badge key={mode} variant="outline" className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-400">
                        {mode}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="size-4" />
              Query Result
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <span className={cn("inline-flex rounded border px-2 py-0.5 text-xs font-medium", methodColor(testMethod))}>{testMethod}</span>
              <code className="block break-all text-xs">{testUrl}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded border bg-muted/25 p-3">
            {testLoading ? (
              <p className="text-sm text-muted-foreground">Loading response...</p>
            ) : testError ? (
              <p className="text-sm text-destructive">{testError}</p>
            ) : testResponse && typeof testResponse === "object" && (testResponse as { type?: string }).type === "image" ? (
              <img src={(testResponse as { url: string }).url} alt="Endpoint response" className="max-w-full rounded border" />
            ) : (
              <Textarea
                readOnly
                value={typeof testResponse === "string" ? testResponse : JSON.stringify(testResponse, null, 2)}
                className="min-h-[18rem] resize-none border-none bg-transparent p-0 font-mono text-xs focus-visible:ring-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
