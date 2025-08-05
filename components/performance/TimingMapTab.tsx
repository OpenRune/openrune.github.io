'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Area, ResponsiveContainer } from 'recharts';
import { IconList } from '@tabler/icons-react';

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

interface TimingMapTabProps {
  frames: FrameData[];
  getTimingMapKeys: () => string[];
  formatTime: (nanoseconds: number) => string;
}

export default function TimingMapTab({ frames, getTimingMapKeys, formatTime }: TimingMapTabProps) {
  const [selectedTiming, setSelectedTiming] = useState<string>('all');
  const timingMapKeys = getTimingMapKeys();

  const isAllSelected = selectedTiming === 'all';

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Select Timing:</label>
        <Select value={selectedTiming} onValueChange={setSelectedTiming}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Choose a timing to analyze" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Timings</SelectItem>
            {timingMapKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isAllSelected && (
        <div className="space-y-4 h-full">
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader>
              <CardTitle className="text-lg">All Timing Data</CardTitle>
            </CardHeader>
            <CardContent className="h-full">
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timing Name</TableHead>
                      {frames.map((_, index) => (
                        <TableHead key={index} className="text-center">Frame {index + 1}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timingMapKeys.map((timingKey) => (
                      <TableRow key={timingKey}>
                        <TableCell className="font-medium">{timingKey}</TableCell>
                        {frames.map((frame, frameIndex) => {
                          const value = frame.timingMap[timingKey];
                          return (
                            <TableCell key={frameIndex} className="text-center">
                              {value !== undefined ? formatTime(value) : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTiming && !isAllSelected && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{selectedTiming} Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const values = frames.map(frame => frame.timingMap[selectedTiming]).filter((v): v is number => v !== undefined);
                const avgValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
                const maxValue = values.length > 0 ? Math.max(...values) : 0;
                const minValue = values.length > 0 ? Math.min(...values) : 0;
                const sortedValues = [...values].sort((a, b) => a - b);
                const medianValue = sortedValues.length > 0
                  ? sortedValues.length % 2 === 0
                    ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
                    : sortedValues[Math.floor(sortedValues.length / 2)]
                  : 0;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Average:</span>
                      <div className="font-semibold">{formatTime(avgValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Median:</span>
                      <div className="font-semibold">{formatTime(medianValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Maximum:</span>
                      <div className="font-semibold">{formatTime(maxValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Minimum:</span>
                      <div className="font-semibold">{formatTime(minValue)}</div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Frame Values for {selectedTiming}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Frame</TableHead>
                        <TableHead>Value (ms)</TableHead>
                        <TableHead>Percentage of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {frames.map((frame, index) => {
                        const value = frame.timingMap[selectedTiming];
                        const totalTime = frame.cpuTime + frame.gpuTime;
                        const percentage = totalTime > 0 ? ((value / totalTime) * 100).toFixed(2) : '0.00';

                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">Frame {index + 1}</TableCell>
                            <TableCell>{formatTime(value)}</TableCell>
                            <TableCell>{percentage}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedTiming} Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 w-full">
                  {(() => {
                    const timingData = frames.map((frame, index) => ({
                      frame: index + 1,
                      value: frame.timingMap[selectedTiming],
                      percentage: ((frame.timingMap[selectedTiming] / (frame.cpuTime + frame.gpuTime)) * 100).toFixed(2),
                      fps: frame.estimatedFps,
                      bottleneck: frame.bottleneck
                    }));

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timingData}>
                          <defs>
                            <linearGradient id="timingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8"/>
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2"/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="frame"
                            label={{ value: 'Frame', position: 'insideBottom', offset: -5 }}
                          />
                          <YAxis
                            label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }}
                            tickFormatter={(value) => formatTime(value)}
                          />
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [
                              `${formatTime(value)}`,
                              'Timing Value'
                            ]}
                            labelFormatter={(label) => `Frame ${label}`}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-popover border shadow-lg rounded-lg p-3">
                                    <div className="font-semibold">Frame {label}</div>
                                    <div className="text-sm space-y-1">
                                      <div>Value: {formatTime(data.value)}</div>
                                      <div>Percentage: {data.percentage}%</div>
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
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#3b82f6' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            fill="url(#timingGradient)"
                            stroke="none"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!selectedTiming && (
        <div className="text-center py-8">
          <IconList size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a Timing</h3>
          <p className="text-muted-foreground">
            Choose a timing from the dropdown above to view detailed statistics and frame values
          </p>
        </div>
      )}
    </div>
  );
} 