'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface PluginSettings {
  [key: string]: string;
}

interface SettingsTabProps {
  pluginSettings?: PluginSettings;
}

export default function SettingsTab({ pluginSettings }: SettingsTabProps) {
  if (!pluginSettings) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold mb-2">No Settings Data</h3>
        <p className="text-muted-foreground">
          No plugin settings data found in the performance file.
        </p>
      </div>
    );
  }

  const settings = Object.entries(pluginSettings).sort(([a], [b]) => a.localeCompare(b));

  const getValueColor = (value: string) => {
    if (value === 'true') return 'bg-green-100 text-green-800';
    if (value === 'false') return 'bg-red-100 text-red-800';
    if (value.includes('RES_')) return 'bg-blue-100 text-blue-800';
    if (value.includes('DISTANCE_')) return 'bg-purple-100 text-purple-800';
    if (value === 'DEFAULT') return 'bg-gray-100 text-gray-800';
    if (value === 'NONE') return 'bg-gray-100 text-gray-800';
    if (value === 'DISABLED') return 'bg-red-100 text-red-800';
    if (value === 'ENABLED') return 'bg-green-100 text-green-800';
    if (value.includes('SOME')) return 'bg-yellow-100 text-yellow-800';
    if (value.includes('ALL')) return 'bg-green-100 text-green-800';
    if (value.includes('HD')) return 'bg-blue-100 text-blue-800';
    if (value.includes('OSRS')) return 'bg-orange-100 text-orange-800';
    if (value.includes('AUTOMATIC')) return 'bg-purple-100 text-purple-800';
    if (value.includes('NORTHERN') || value.includes('SOUTHERN')) return 'bg-indigo-100 text-indigo-800';
    if (value.includes('LINEAR')) return 'bg-cyan-100 text-cyan-800';
    if (value.includes('ADAPTIVE')) return 'bg-teal-100 text-teal-800';
    if (value.includes('DETAILED')) return 'bg-emerald-100 text-emerald-800';
    if (value.includes('DYNAMIC')) return 'bg-violet-100 text-violet-800';
    if (value.includes('SUN')) return 'bg-amber-100 text-amber-800';
    if (value.includes('HOODER')) return 'bg-pink-100 text-pink-800';
    if (value.includes('OFF')) return 'bg-gray-100 text-gray-800';
    if (value.includes('SHOW_IN_PVM')) return 'bg-lime-100 text-lime-800';
    if (value.includes('100')) return 'bg-green-100 text-green-800';
    if (value.includes('50')) return 'bg-yellow-100 text-yellow-800';
    if (value.includes('200')) return 'bg-blue-100 text-blue-800';
    if (value.includes('512')) return 'bg-purple-100 text-purple-800';
    if (value.includes('2048')) return 'bg-indigo-100 text-indigo-800';
    if (value.includes('4096')) return 'bg-red-100 text-red-800';
    if (value.includes('256')) return 'bg-orange-100 text-orange-800';
    if (value.includes('16')) return 'bg-cyan-100 text-cyan-800';
    if (value.includes('60')) return 'bg-emerald-100 text-emerald-800';
    if (value.includes('53')) return 'bg-violet-100 text-violet-800';
    if (value.includes('20')) return 'bg-teal-100 text-teal-800';
    if (value.includes('5')) return 'bg-pink-100 text-pink-800';
    if (value.includes('3')) return 'bg-lime-100 text-lime-800';
    if (value.includes('2')) return 'bg-amber-100 text-amber-800';
    if (value.includes('1')) return 'bg-slate-100 text-slate-800';
    if (value.includes('0')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatSettingName = (name: string) => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plugin Settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            All plugin configuration settings from the performance data
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Setting</TableHead>
                  <TableHead className="w-2/3">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">
                      {formatSettingName(key)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`${getValueColor(value)} border-0`}
                      >
                        {value}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 