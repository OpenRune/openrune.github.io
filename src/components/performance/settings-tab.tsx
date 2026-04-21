"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SettingsTabProps = {
  settings: Record<string, string> | null;
};

const ENABLED_VALUES = new Set(["true", "enabled", "on", "yes", "1"]);
const DISABLED_VALUES = new Set(["false", "disabled", "off", "no", "0"]);

function prettifySettingName(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (first) => first.toUpperCase())
    .trim();
}

function renderSettingValue(value: string) {
  const normalized = value.trim().toLowerCase();

  if (ENABLED_VALUES.has(normalized)) {
    return (
      <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600 dark:bg-emerald-500/85 dark:hover:bg-emerald-500">
        Enabled
      </Badge>
    );
  }

  if (DISABLED_VALUES.has(normalized)) {
    return (
      <Badge variant="destructive">
        Disabled
      </Badge>
    );
  }

  if (normalized === "auto" || normalized === "automatic") {
    return <Badge variant="secondary">Auto</Badge>;
  }

  return <span className="font-mono">{value}</span>;
}

export function SettingsTab({ settings }: SettingsTabProps) {
  if (!settings || Object.keys(settings).length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No plugin settings were found in this snapshot.
        </CardContent>
      </Card>
    );
  }

  const entries = Object.entries(settings).sort(([left], [right]) => left.localeCompare(right));

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle className="text-base">Plugin Settings</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 w-full flex-1 overflow-auto rounded-lg border">
          <Table className="table-fixed text-xs [&_tbody_td+td]:border-l [&_tbody_td+td]:border-muted [&_thead_th+th]:border-l [&_thead_th+th]:border-muted">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 text-muted-foreground backdrop-blur-xs">
              <TableRow>
                <TableHead className="w-1/3 p-2 text-left font-medium">Setting</TableHead>
                <TableHead className="w-2/3 p-2 text-left font-medium">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([key, value]) => (
                <TableRow key={key} className="border-t align-top hover:bg-muted/35">
                  <TableCell className="p-2 font-medium">{prettifySettingName(key)}</TableCell>
                  <TableCell className="p-2">{renderSettingValue(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
