'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { IconChartBar, IconClock, IconList, IconSettings } from '@tabler/icons-react';
import SummaryTab from '@/components/performance/SummaryTab';
import FramesTab from '@/components/performance/FramesTab';
import TimingMapTab from '@/components/performance/TimingMapTab';
import SettingsTab from '@/components/performance/SettingsTab';
import { UploadedFile, FrameData } from '@/lib/types/performance';
import { formatTime, formatMemory } from '@/lib/utils/performance';

interface DataDisplayProps {
  uploadedFiles: UploadedFile[];
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  getFramesData: () => FrameData[];
  getFramesDataByFile: (fileIndex: number) => FrameData[];
  getTimingMapKeys: () => string[];
  getPluginSettings: () => any;
  formatTime: (nanoseconds: number) => string;
  formatMemory: (bytes: number) => string;
}

export default function DataDisplay({
  uploadedFiles,
  activeTab,
  onActiveTabChange,
  getFramesData,
  getFramesDataByFile,
  getTimingMapKeys,
  getPluginSettings,
  formatTime,
  formatMemory
}: DataDisplayProps) {
  const frames = getFramesData();
  const timingMapKeys = getTimingMapKeys();
  const isCompareMode = uploadedFiles.length > 1;

  if (isCompareMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Performance Comparison</h2>
          <div className="flex items-center gap-4">
            <Badge variant="outline">{uploadedFiles[0]?.name}</Badge>
            <span className="text-muted-foreground">vs</span>
            <Badge variant="outline">{uploadedFiles[1]?.name}</Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <IconChartBar size={16} />
              Summary
            </TabsTrigger>
            <TabsTrigger value="frames" className="flex items-center gap-2">
              <IconClock size={16} />
              Frames
            </TabsTrigger>
            <TabsTrigger value="timingmap" className="flex items-center gap-2">
              <IconList size={16} />
              Timing Map
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <IconSettings size={16} />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                <SummaryTab 
                  frames={getFramesDataByFile(0)}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                  compareMode={true}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                <SummaryTab 
                  frames={getFramesDataByFile(1)}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                  compareMode={true}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="frames" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                <FramesTab 
                  frames={getFramesDataByFile(0)}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                <FramesTab 
                  frames={getFramesDataByFile(1)}
                  formatTime={formatTime}
                  formatMemory={formatMemory}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timingmap" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                <TimingMapTab 
                  frames={getFramesDataByFile(0)}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                <TimingMapTab 
                  frames={getFramesDataByFile(1)}
                  getTimingMapKeys={getTimingMapKeys}
                  formatTime={formatTime}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[0]?.name}</h3>
                <SettingsTab 
                  pluginSettings={getPluginSettings()}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">{uploadedFiles[1]?.name}</h3>
                <SettingsTab 
                  pluginSettings={getPluginSettings()}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="summary" className="flex items-center gap-2">
          <IconChartBar size={16} />
          Summary
        </TabsTrigger>
        <TabsTrigger value="frames" className="flex items-center gap-2">
          <IconClock size={16} />
          Frames ({frames.length})
        </TabsTrigger>
        <TabsTrigger value="timingmap" className="flex items-center gap-2">
          <IconList size={16} />
          Timing Map ({timingMapKeys.length})
        </TabsTrigger>
        <TabsTrigger value="settings" className="flex items-center gap-2">
          <IconSettings size={16} />
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-4">
        <SummaryTab 
          frames={frames}
          getTimingMapKeys={getTimingMapKeys}
          formatTime={formatTime}
          formatMemory={formatMemory}
        />
      </TabsContent>

      <TabsContent value="frames" className="space-y-4">
        <FramesTab 
          frames={frames}
          formatTime={formatTime}
          formatMemory={formatMemory}
        />
      </TabsContent>

      <TabsContent value="timingmap" className="space-y-4">
        <TimingMapTab 
          frames={frames}
          getTimingMapKeys={getTimingMapKeys}
          formatTime={formatTime}
        />
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        <SettingsTab 
          pluginSettings={getPluginSettings()}
        />
      </TabsContent>
    </Tabs>
  );
} 