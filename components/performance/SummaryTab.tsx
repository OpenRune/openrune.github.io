'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Area } from 'recharts';

interface FrameData {
  elapsed: number;
  currentTime: number;
  drawnTiles: number;
  drawnStatic: number;
  drawnDynamic: number;
  npcCacheSize: number;
  timings: number[];
  bottleneck: string;
  estimatedFps: number;
  cpuTime: number;
  gpuTime: number;
  timingMap: Record<string, number>;
  memoryUsed: number;
  memoryTotal: number;
  memoryFree: number;
  memoryMax: number;
}

interface SummaryTabProps {
  frames: FrameData[];
  getTimingMapKeys: () => string[];
  formatTime: (nanoseconds: number) => string;
  formatMemory: (bytes: number) => string;
  compareMode?: boolean;
}

export default function SummaryTab({ frames, getTimingMapKeys, formatTime, formatMemory, compareMode = false }: SummaryTabProps) {
  const getSummaryStats = () => {
    if (frames.length === 0) return null;

    const avgFps = frames.reduce((sum, frame) => sum + frame.estimatedFps, 0) / frames.length;
    const avgCpuTime = frames.reduce((sum, frame) => sum + frame.cpuTime, 0) / frames.length;
    const avgGpuTime = frames.reduce((sum, frame) => sum + frame.gpuTime, 0) / frames.length;
    const avgMemoryUsed = frames.reduce((sum, frame) => sum + frame.memoryUsed, 0) / frames.length;
    const avgDrawnTiles = frames.reduce((sum, frame) => sum + frame.drawnTiles, 0) / frames.length;

    const bottlenecks = frames.reduce((acc, frame) => {
      acc[frame.bottleneck] = (acc[frame.bottleneck] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFrames: frames.length,
      avgFps: avgFps.toFixed(2),
      avgCpuTime: avgCpuTime.toFixed(0),
      avgGpuTime: avgGpuTime.toFixed(0),
      avgMemoryUsed: formatMemory(avgMemoryUsed),
      avgDrawnTiles: Math.round(avgDrawnTiles),
      bottlenecks
    };
  };

  const summaryStats = getSummaryStats();
  const timingMapKeys = getTimingMapKeys();

  if (!summaryStats) return null;

  return (
    <div className="space-y-6">
      {compareMode ? (
        // Compare Mode - 2 cards per row
        <>
          {/* First Row: Performance Overview and Bottleneck Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Frames:</span>
                  <span className="font-semibold">{summaryStats.totalFrames}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average FPS:</span>
                  <span className="font-semibold">{summaryStats.avgFps}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg CPU Time:</span>
                  <span className="font-semibold">{formatTime(parseFloat(summaryStats.avgCpuTime))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg GPU Time:</span>
                  <span className="font-semibold">{formatTime(parseFloat(summaryStats.avgGpuTime))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Memory Used:</span>
                  <span className="font-semibold">{summaryStats.avgMemoryUsed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Drawn Tiles:</span>
                  <span className="font-semibold">{summaryStats.avgDrawnTiles}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Drawn Static:</span>
                  <span className="font-semibold">7,501</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Drawn Dynamic:</span>
                  <span className="font-semibold">170</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg NPC Cache Size:</span>
                  <span className="font-semibold">2</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Bottleneck Analysis
                  {(() => {
                    const bottleneckEntries = Object.entries(summaryStats.bottlenecks);
                    if (bottleneckEntries.length > 0) {
                      const [primaryBottleneck] = bottleneckEntries.sort(([,a], [,b]) => b - a);
                      return (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (Bottleneck = {primaryBottleneck[0]})
                        </span>
                      );
                    }
                    return null;
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="mt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Chart */}
                    <div className="h-64 w-full">
                      {(() => {
                        // Define which timing operations are GPU vs CPU based on the enum
                        const gpuTimings = [
                          'RENDER_FRAME',
                          'RENDER_TILED_LIGHTING',
                          'UPLOAD_GEOMETRY',
                          'UPLOAD_UI',
                          'COMPUTE',
                          'CLEAR_SCENE',
                          'RENDER_SHADOWS',
                          'RENDER_SCENE',
                          'RENDER_UI'
                        ];

                        // Calculate average timing values for each operation
                        const timingAverages: Record<string, number> = {};

                        timingMapKeys.forEach(timing => {
                          const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                          if (values.length > 0) {
                            timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                          }
                        });

                        // Define color palettes
                        const gpuColors = [
                          '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'
                        ];
                        const cpuColors = [
                          '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#f59e0b', '#f97316'
                        ];

                        // Get GPU operations (inner ring)
                        const gpuOperations = Object.entries(timingAverages)
                          .filter(([timing]) => gpuTimings.includes(timing))
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 6);

                        // Get CPU operations (outer ring)
                        const cpuOperations = Object.entries(timingAverages)
                          .filter(([timing]) => !gpuTimings.includes(timing))
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 8);

                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                                             {/* Inner Ring - GPU Operations */}
                               <Pie
                                 data={gpuOperations.map(([timing, value], index) => ({
                                   name: timing,
                                   value: value,
                                   fill: gpuColors[index % gpuColors.length]
                                 }))}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={0}
                                 outerRadius={36}
                                 paddingAngle={2}
                                 dataKey="value"
                               />

                               {/* Outer Ring - CPU Operations */}
                               <Pie
                                 data={cpuOperations.map(([timing, value], index) => ({
                                   name: timing,
                                   value: value,
                                   fill: cpuColors[index % cpuColors.length]
                                 }))}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={45}
                                 outerRadius={72}
                                 paddingAngle={2}
                                 dataKey="value"
                               />

                              <RechartsTooltip
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-popover border shadow-lg rounded-lg p-3">
                                        <div className="font-semibold text-sm">{data.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                          <div>Time: {formatTime(data.value)}</div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>

                    <div className="h-64">
                                          <Tabs defaultValue="gpu" className="h-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="gpu" className="text-xs">GPU</TabsTrigger>
                        <TabsTrigger value="cpu" className="text-xs">CPU</TabsTrigger>
                      </TabsList>

                        <TabsContent value="gpu" className="mt-2 h-48 overflow-y-auto">
                          <div className="text-xs space-y-1">
                            {(() => {
                              const gpuTimings = [
                                'RENDER_FRAME', 'RENDER_TILED_LIGHTING', 'UPLOAD_GEOMETRY',
                                'UPLOAD_UI', 'COMPUTE', 'CLEAR_SCENE', 'RENDER_SHADOWS',
                                'RENDER_SCENE', 'RENDER_UI'
                              ];

                              const gpuColors = [
                                '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'
                              ];

                              // Calculate timing averages for legend
                              const timingAverages: Record<string, number> = {};

                              timingMapKeys.forEach(timing => {
                                const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                                if (values.length > 0) {
                                  timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                                }
                              });

                              return Object.entries(timingAverages)
                                .filter(([timing]) => gpuTimings.includes(timing))
                                .sort(([,a], [,b]) => (b as number) - (a as number))
                                .slice(0, 6)
                                .map(([timing, avgValue], index) => (
                                  <div key={timing} className="flex items-center gap-2 p-1 rounded hover:bg-muted">
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: gpuColors[index] }}
                                    ></div>
                                    <span className="truncate flex-1" title={timing}>
                                      {timing}
                                    </span>
                                    <span className="text-muted-foreground text-xs flex-shrink-0">
                                      {formatTime(avgValue)}
                                    </span>
                                  </div>
                                ));
                            })()}
                          </div>
                        </TabsContent>

                        <TabsContent value="cpu" className="mt-2 h-48 overflow-y-auto">
                          <div className="text-xs space-y-1">
                            {(() => {
                              const gpuTimings = [
                                'RENDER_FRAME', 'RENDER_TILED_LIGHTING', 'UPLOAD_GEOMETRY',
                                'UPLOAD_UI', 'COMPUTE', 'CLEAR_SCENE', 'RENDER_SHADOWS',
                                'RENDER_SCENE', 'RENDER_UI'
                              ];

                              const cpuColors = [
                                '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#f59e0b', '#f97316'
                              ];

                              // Calculate timing averages for legend
                              const timingAverages: Record<string, number> = {};

                              timingMapKeys.forEach(timing => {
                                const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                                if (values.length > 0) {
                                  timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                                }
                              });

                              return Object.entries(timingAverages)
                                .filter(([timing]) => !gpuTimings.includes(timing))
                                .sort(([,a], [,b]) => (b as number) - (a as number))
                                .slice(0, 8)
                                .map(([timing, avgValue], index) => (
                                  <div key={timing} className="flex items-center gap-2 p-1 rounded hover:bg-muted">
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: cpuColors[index] }}
                                    ></div>
                                    <span className="truncate flex-1" title={timing}>
                                      {timing}
                                    </span>
                                    <span className="text-muted-foreground text-xs flex-shrink-0">
                                      {formatTime(avgValue)}
                                    </span>
                                  </div>
                                ));
                            })()}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          
        </>
      ) : (
        // Single Mode - Original layout
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Performance Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Total Frames:</span>
                <span className="font-semibold">{summaryStats.totalFrames}</span>
              </div>
              <div className="flex justify-between">
                <span>Average FPS:</span>
                <span className="font-semibold">{summaryStats.avgFps}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg CPU Time:</span>
                <span className="font-semibold">{formatTime(parseFloat(summaryStats.avgCpuTime))}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg GPU Time:</span>
                <span className="font-semibold">{formatTime(parseFloat(summaryStats.avgGpuTime))}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Memory Used:</span>
                <span className="font-semibold">{summaryStats.avgMemoryUsed}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Drawn Tiles:</span>
                <span className="font-semibold">{summaryStats.avgDrawnTiles}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Drawn Static:</span>
                <span className="font-semibold">7,501</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Drawn Dynamic:</span>
                <span className="font-semibold">170</span>
              </div>
              <div className="flex justify-between">
                <span>Avg NPC Cache Size:</span>
                <span className="font-semibold">2</span>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Bottleneck Analysis
                {(() => {
                  const bottleneckEntries = Object.entries(summaryStats.bottlenecks);
                  if (bottleneckEntries.length > 0) {
                    const [primaryBottleneck] = bottleneckEntries.sort(([,a], [,b]) => b - a);
                    return (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        (Bottleneck = {primaryBottleneck[0]})
                      </span>
                    );
                  }
                  return null;
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Chart */}
                  <div className="h-64 w-full">
                    {(() => {
                      // Define which timing operations are GPU vs CPU based on the enum
                      const gpuTimings = [
                        'RENDER_FRAME',
                        'RENDER_TILED_LIGHTING',
                        'UPLOAD_GEOMETRY',
                        'UPLOAD_UI',
                        'COMPUTE',
                        'CLEAR_SCENE',
                        'RENDER_SHADOWS',
                        'RENDER_SCENE',
                        'RENDER_UI'
                      ];

                      // Calculate average timing values for each operation
                      const timingAverages: Record<string, number> = {};

                      timingMapKeys.forEach(timing => {
                        const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                        if (values.length > 0) {
                          timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                        }
                      });

                      // Define color palettes
                      const gpuColors = [
                        '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'
                      ];
                      const cpuColors = [
                        '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#f59e0b', '#f97316'
                      ];

                      // Get GPU operations (inner ring)
                      const gpuOperations = Object.entries(timingAverages)
                        .filter(([timing]) => gpuTimings.includes(timing))
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6);

                      // Get CPU operations (outer ring)
                      const cpuOperations = Object.entries(timingAverages)
                        .filter(([timing]) => !gpuTimings.includes(timing))
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 8);

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            {/* Inner Ring - GPU Operations */}
                            <Pie
                              data={gpuOperations.map(([timing, value], index) => ({
                                name: timing,
                                value: value,
                                fill: gpuColors[index % gpuColors.length]
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={0}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                            />

                            {/* Outer Ring - CPU Operations */}
                            <Pie
                              data={cpuOperations.map(([timing, value], index) => ({
                                name: timing,
                                value: value,
                                fill: cpuColors[index % cpuColors.length]
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={120}
                              paddingAngle={2}
                              dataKey="value"
                            />

                            <RechartsTooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-popover border shadow-lg rounded-lg p-3">
                                      <div className="font-semibold text-sm">{data.name}</div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        <div>Time: {formatTime(data.value)}</div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>

                  <div className="h-64">
                    <Tabs defaultValue="gpu" className="h-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="gpu" className="text-xs">GPU</TabsTrigger>
                        <TabsTrigger value="cpu" className="text-xs">CPU</TabsTrigger>
                      </TabsList>

                      <TabsContent value="gpu" className="mt-2 h-48 overflow-y-auto">
                        <div className="text-xs space-y-1">
                          {(() => {
                            const gpuTimings = [
                              'RENDER_FRAME', 'RENDER_TILED_LIGHTING', 'UPLOAD_GEOMETRY',
                              'UPLOAD_UI', 'COMPUTE', 'CLEAR_SCENE', 'RENDER_SHADOWS',
                              'RENDER_SCENE', 'RENDER_UI'
                            ];

                            const gpuColors = [
                              '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'
                            ];

                            // Calculate timing averages for legend
                            const timingAverages: Record<string, number> = {};

                            timingMapKeys.forEach(timing => {
                              const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                              if (values.length > 0) {
                                timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                              }
                            });

                            return Object.entries(timingAverages)
                              .filter(([timing]) => gpuTimings.includes(timing))
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 6)
                              .map(([timing, avgValue], index) => (
                                <div key={timing} className="flex items-center gap-2 p-1 rounded hover:bg-muted">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: gpuColors[index] }}
                                  ></div>
                                  <span className="truncate flex-1" title={timing}>
                                    {timing}
                                  </span>
                                  <span className="text-muted-foreground text-xs flex-shrink-0">
                                    {formatTime(avgValue)}
                                  </span>
                                </div>
                              ));
                          })()}
                        </div>
                      </TabsContent>

                      <TabsContent value="cpu" className="mt-2 h-48 overflow-y-auto">
                        <div className="text-xs space-y-1">
                          {(() => {
                            const gpuTimings = [
                              'RENDER_FRAME', 'RENDER_TILED_LIGHTING', 'UPLOAD_GEOMETRY',
                              'UPLOAD_UI', 'COMPUTE', 'CLEAR_SCENE', 'RENDER_SHADOWS',
                              'RENDER_SCENE', 'RENDER_UI'
                            ];

                            const cpuColors = [
                              '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#f59e0b', '#f97316'
                            ];

                            // Calculate timing averages for legend
                            const timingAverages: Record<string, number> = {};

                            timingMapKeys.forEach(timing => {
                              const values = frames.map(frame => frame.timingMap[timing]).filter(v => v !== undefined);
                              if (values.length > 0) {
                                timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                              }
                            });

                            return Object.entries(timingAverages)
                              .filter(([timing]) => !gpuTimings.includes(timing))
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 8)
                              .map(([timing, avgValue], index) => (
                                <div key={timing} className="flex items-center gap-2 p-1 rounded hover:bg-muted">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: cpuColors[index] }}
                                  ></div>
                                  <span className="truncate flex-1" title={timing}>
                                    {timing}
                                  </span>
                                  <span className="text-muted-foreground text-xs flex-shrink-0">
                                    {formatTime(avgValue)}
                                  </span>
                                </div>
                              ));
                          })()}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">OS Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OS:</span>
                  <span className="font-semibold">Windows 11</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span className="font-semibold">AMD64</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-semibold">10.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Java:</span>
                  <span className="font-semibold">17.0.15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Cores:</span>
                  <span className="font-semibold">16</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="font-semibold">768 MB</span>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="text-muted-foreground text-xs mb-1">GPU:</div>
                  <div className="text-xs font-semibold leading-tight">
                    NVIDIA GeForce GTX 1070
                  </div>
                  <div className="text-xs text-muted-foreground">
                    OpenGL 4.6.0 NVIDIA 551.23
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

             {/* FPS Over Time and Memory Usage Cards */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-lg">FPS Over Time</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-80 w-full">
               {(() => {
                 const fpsData = frames.map((frame, index) => ({
                   frame: index + 1,
                   fps: frame.estimatedFps,
                   bottleneck: frame.bottleneck
                 }));

                 return (
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={fpsData}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis
                         dataKey="frame"
                         label={{ value: 'Frame', position: 'insideBottom', offset: -5 }}
                       />
                       <YAxis
                         label={{ value: 'FPS', angle: -90, position: 'insideLeft' }}
                       />
                       <RechartsTooltip
                         formatter={(value: number, name: string) => [
                           `${value.toFixed(1)} FPS`,
                           'FPS'
                         ]}
                         labelFormatter={(label) => `Frame ${label}`}
                         content={({ active, payload, label }) => {
                           if (active && payload && payload.length) {
                             const data = payload[0].payload;
                             return (
                               <div className="bg-popover border shadow-lg rounded-lg p-3">
                                 <div className="font-semibold">Frame {label}</div>
                                 <div className="text-sm space-y-1">
                                   <div>FPS: {data.fps.toFixed(1)}</div>
                                   <div>Bottleneck: {data.bottleneck}</div>
                                 </div>
                               </div>
                             );
                           }
                           return null;
                         }}
                       />
                       <Line
                         type="monotone"
                         dataKey="fps"
                         stroke="#3b82f6"
                         strokeWidth={2}
                         dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                         activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#3b82f6' }}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 );
               })()}
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <div className="flex items-center justify-between">
               <CardTitle className="text-lg">Memory Usage Over Time</CardTitle>
               <div className="flex flex-wrap gap-4 text-xs">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <span>Used</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span>Free</span>
                 </div>
               </div>
             </div>
           </CardHeader>
           <CardContent>
             <div className="h-80 w-full">
               {(() => {
                 const memoryData = frames.map((frame, index) => ({
                   frame: index + 1,
                   used: frame.memoryUsed,
                   free: frame.memoryFree,
                   total: frame.memoryTotal,
                   max: frame.memoryMax
                 }));

                 return (
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={memoryData}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis
                         dataKey="frame"
                         label={{ value: 'Frame', position: 'insideBottom', offset: -5 }}
                       />
                       <YAxis
                         label={{ value: 'Memory (MB)', angle: -90, position: 'insideLeft' }}
                         tickFormatter={(value) => `${(value / 1024 / 1024).toFixed(0)}`}
                       />
                       <RechartsTooltip
                         formatter={(value: number, name: string) => [
                           `${(value / 1024 / 1024).toFixed(1)} MB`,
                           name
                         ]}
                         labelFormatter={(label) => `Frame ${label}`}
                         content={({ active, payload, label }) => {
                           if (active && payload && payload.length) {
                             const data = payload[0].payload;
                             return (
                               <div className="bg-popover border shadow-lg rounded-lg p-3">
                                 <div className="font-semibold">Frame {label}</div>
                                 <div className="text-sm space-y-1">
                                   <div>Used: {(data.used / 1024 / 1024).toFixed(1)} MB</div>
                                   <div>Free: {(data.free / 1024 / 1024).toFixed(1)} MB</div>
                                   <div>Total: {(data.total / 1024 / 1024).toFixed(1)} MB</div>
                                   <div>Max: {(data.max / 1024 / 1024).toFixed(1)} MB</div>
                                 </div>
                               </div>
                             );
                           }
                           return null;
                         }}
                       />
                       <Line
                         type="monotone"
                         dataKey="used"
                         stroke="#ef4444"
                         strokeWidth={2}
                         name="Used Memory"
                         dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                         activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#ef4444' }}
                       />
                       <Line
                         type="monotone"
                         dataKey="free"
                         stroke="#22c55e"
                         strokeWidth={2}
                         name="Free Memory"
                         dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                         activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2, fill: '#22c55e' }}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 );
               })()}
             </div>
           </CardContent>
         </Card>
       </div>

       {/* OS Info Cards - At the bottom */}
       {compareMode && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           <Card>
             <CardHeader>
               <CardTitle className="text-lg">OS Info</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               <div className="text-xs space-y-1">
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">OS:</span>
                   <span className="font-semibold">Windows 11</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Architecture:</span>
                   <span className="font-semibold">AMD64</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Version:</span>
                   <span className="font-semibold">10.0</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Java:</span>
                   <span className="font-semibold">17.0.15</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">CPU Cores:</span>
                   <span className="font-semibold">16</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Memory:</span>
                   <span className="font-semibold">768 MB</span>
                 </div>
                 <div className="mt-2 pt-2 border-t">
                   <div className="text-muted-foreground text-xs mb-1">GPU:</div>
                   <div className="text-xs font-semibold leading-tight">
                     NVIDIA GeForce GTX 1070
                   </div>
                   <div className="text-xs text-muted-foreground">
                     OpenGL 4.6.0 NVIDIA 551.23
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

           <Card>
             <CardHeader>
               <CardTitle className="text-lg">OS Info</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               <div className="text-xs space-y-1">
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">OS:</span>
                   <span className="font-semibold">Windows 11</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Architecture:</span>
                   <span className="font-semibold">AMD64</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Version:</span>
                   <span className="font-semibold">10.0</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Java:</span>
                   <span className="font-semibold">17.0.15</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">CPU Cores:</span>
                   <span className="font-semibold">16</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Memory:</span>
                   <span className="font-semibold">768 MB</span>
                 </div>
                 <div className="mt-2 pt-2 border-t">
                   <div className="text-muted-foreground text-xs mb-1">GPU:</div>
                   <div className="text-xs font-semibold leading-tight">
                     NVIDIA GeForce GTX 1070
                   </div>
                   <div className="text-xs text-muted-foreground">
                     OpenGL 4.6.0 NVIDIA 551.23
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>
       )}
    </div>
  );
} 