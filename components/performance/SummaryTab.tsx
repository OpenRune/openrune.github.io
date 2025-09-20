'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Area } from 'recharts';

interface FrameData {
  timestamp: number;
  drawnTiles: number;
  drawnStatic: number;
  drawnDynamic: number;
  npcDisplacementCacheSize: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryFree: number;
  memoryMax: number;
  cpu: Record<string, number>;
  gpu: Record<string, number>;
  // Computed fields
  elapsed?: number;
  bottleneck?: string;
  estimatedFps?: number;
  cpuTime?: number;
  gpuTime?: number;
  timingMap?: Record<string, number>;
}

interface SummaryTabProps {
  frames: FrameData[];
  getTimingMapKeys: () => string[];
  formatTime: (nanoseconds: number) => string;
  formatMemory: (bytes: number) => string;
  compareMode?: boolean;
  snapshotData?: any;
}

export default function SummaryTab({ frames, getTimingMapKeys, formatTime, formatMemory, compareMode = false, snapshotData }: SummaryTabProps) {
  // Generate color palette based on base color and count
  const generateColorPalette = (baseColor: string, count: number) => {
    // Convert hex to HSL for easier manipulation
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      
      return { h: h * 360, s: s * 100, l: l * 100 };
    };
    
    // Convert HSL back to hex
    const hslToHex = (h: number, s: number, l: number) => {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const hNorm = h / 360;
      const sNorm = s / 100;
      const lNorm = l / 100;
      
      let r, g, b;
      if (sNorm === 0) {
        r = g = b = lNorm;
      } else {
        const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
        const p = 2 * lNorm - q;
        r = hue2rgb(p, q, hNorm + 1/3);
        g = hue2rgb(p, q, hNorm);
        b = hue2rgb(p, q, hNorm - 1/3);
      }
      
      const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };
    
    if (count <= 1) return [baseColor];
    
    const baseHsl = hexToHsl(baseColor);
    const colors: string[] = [];
    
    // Generate colors by shifting hue and adjusting lightness/saturation
    for (let i = 0; i < count; i++) {
      const ratio = i / (count - 1);
      
      // Shift hue slightly (within 60 degrees)
      const hueShift = (ratio - 0.5) * 60;
      const h = (baseHsl.h + hueShift + 360) % 360;
      
      // Adjust saturation (slightly more vibrant for middle colors)
      const s = Math.min(100, baseHsl.s + (ratio < 0.5 ? ratio * 20 : (1 - ratio) * 20));
      
      // Adjust lightness (slightly darker for middle colors)
      const l = Math.max(20, Math.min(80, baseHsl.l + (ratio < 0.5 ? -ratio * 15 : -(1 - ratio) * 15)));
      
      colors.push(hslToHex(h, s, l));
    }
    
    return colors;
  };
  // Parse GPU information from the combined string
  const parseGpuInfo = (gpuName: string) => {
    if (!gpuName || gpuName === 'Unknown') {
      return {
        renderer: 'Unknown',
        vendor: 'Unknown',
        version: 'Unknown',
        driver: 'Unknown'
      };
    }

    console.log('Parsing GPU string:', gpuName);

    // Parse format: "Renderer (Vendor, OpenGL Version)"
    const match = gpuName.match(/^(.+?)\s*\((.+?),\s*OpenGL\s*(.+?)\)$/);
    if (match) {
      const [, renderer, vendor, version] = match;
      const driver = extractDriverVersion(version, vendor);
      
      console.log('GPU parsed:', {
        renderer: renderer.trim(),
        vendor: vendor.trim(),
        version: version.trim(),
        driver
      });
      
      return {
        renderer: renderer.trim(),
        vendor: vendor.trim(),
        version: extractOpenGLVersion(version.trim()),
        driver
      };
    }

    // Fallback if format doesn't match
    console.log('GPU parsing failed, using fallback');
    return {
      renderer: gpuName,
      vendor: 'Unknown',
      version: 'Unknown',
      driver: 'Unknown'
    };
  };

  // Extract OpenGL version only (without driver version)
  const extractOpenGLVersion = (version: string) => {
    // Extract just the OpenGL version part (e.g., "4.6.0" from "4.6.0 25.9.1.250822")
    const openGLMatch = version.match(/^(\d+\.\d+\.\d+)/);
    return openGLMatch ? openGLMatch[1] : version;
  };

  // Extract driver version from OpenGL version string
  const extractDriverVersion = (version: string, vendor: string) => {
    const vendorLower = vendor.toLowerCase();
    
    // AMD driver detection - driver version is usually at the end after OpenGL version
    if (vendorLower.includes('amd') || vendorLower.includes('ati')) {
      // AMD format: "4.6.0 25.9.1.250822" or "4.6.0 AMD 25.9.1.250822"
      const amdMatch = version.match(/OpenGL\s+\d+\.\d+\.\d+\s+(?:AMD\s+)?(\d+\.\d+\.\d+\.\d+)/);
      if (amdMatch) {
        return amdMatch[1];
      }
      // Fallback: look for 4-part version at the end
      const fallbackMatch = version.match(/(\d+\.\d+\.\d+\.\d+)$/);
      if (fallbackMatch) {
        return fallbackMatch[1];
      }
    }
    
    // NVIDIA driver detection
    if (vendorLower.includes('nvidia')) {
      // NVIDIA format: "4.6.0 NVIDIA 551.23.01"
      const nvidiaMatch = version.match(/OpenGL\s+\d+\.\d+\.\d+\s+NVIDIA\s+(\d+\.\d+\.\d+\.\d+)/);
      if (nvidiaMatch) {
        return nvidiaMatch[1];
      }
    }
    
    // Intel driver detection
    if (vendorLower.includes('intel')) {
      // Intel format: "4.6.0 Intel 31.0.101"
      const intelMatch = version.match(/OpenGL\s+\d+\.\d+\.\d+\s+Intel\s+(\d+\.\d+\.\d+)/);
      if (intelMatch) {
        return intelMatch[1];
      }
    }
    
    return 'Unknown';
  };

  // Get more detailed driver information
  const getDriverInfo = (renderer: string, vendor: string, version: string) => {
    const vendorLower = vendor.toLowerCase();
    const rendererLower = renderer.toLowerCase();
    const driverVersion = extractDriverVersion(version, vendor);
    
    if (driverVersion === 'Unknown') {
      return null;
    }
    
    // NVIDIA detection
    if (vendorLower.includes('nvidia') || rendererLower.includes('geforce') || rendererLower.includes('quadro')) {
      return {
        type: 'NVIDIA',
        version: driverVersion,
        downloadUrl: 'https://www.nvidia.com/drivers/',
        supportUrl: 'https://www.nvidia.com/support/'
      };
    }
    
    // AMD detection
    if (vendorLower.includes('amd') || rendererLower.includes('radeon') || rendererLower.includes('ati')) {
      return {
        type: 'AMD',
        version: driverVersion,
        downloadUrl: 'https://www.amd.com/support/',
        supportUrl: 'https://www.amd.com/support/'
      };
    }
    
    // Intel detection
    if (vendorLower.includes('intel')) {
      return {
        type: 'Intel',
        version: driverVersion,
        downloadUrl: 'https://www.intel.com/content/www/us/en/support/articles/000005629/graphics.html',
        supportUrl: 'https://www.intel.com/content/www/us/en/support/articles/000005629/graphics.html'
      };
    }
    
    return null;
  };

  // Get vendor URL
  const getVendorUrl = (vendor: string) => {
    const vendorLower = vendor.toLowerCase();
    if (vendorLower.includes('nvidia') || vendorLower.includes('geforce')) {
      return 'https://www.nvidia.com/drivers/';
    } else if (vendorLower.includes('amd') || vendorLower.includes('radeon')) {
      return 'https://www.amd.com/support/';
    } else if (vendorLower.includes('intel')) {
      return 'https://www.intel.com/content/www/us/en/support/articles/000005629/graphics.html';
    }
    return null;
  };
  const getSummaryStats = () => {
    if (frames.length === 0) return null;

    const avgFps = frames.reduce((sum, frame) => sum + (frame.estimatedFps || 0), 0) / frames.length;
    const avgCpuTime = frames.reduce((sum, frame) => sum + (frame.cpuTime || 0), 0) / frames.length;
    const avgGpuTime = frames.reduce((sum, frame) => sum + (frame.gpuTime || 0), 0) / frames.length;
    const avgMemoryUsed = frames.reduce((sum, frame) => sum + frame.memoryUsed, 0) / frames.length;
    const avgDrawnTiles = frames.reduce((sum, frame) => sum + frame.drawnTiles, 0) / frames.length;
    const avgDrawnStatic = frames.reduce((sum, frame) => sum + frame.drawnStatic, 0) / frames.length;
    const avgDrawnDynamic = frames.reduce((sum, frame) => sum + frame.drawnDynamic, 0) / frames.length;
    const avgNpcCacheSize = frames.reduce((sum, frame) => sum + frame.npcDisplacementCacheSize, 0) / frames.length;

    const bottlenecks = frames.reduce((acc, frame) => {
      const bottleneck = frame.bottleneck || 'Unknown';
      acc[bottleneck] = (acc[bottleneck] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalFrames: frames.length,
      avgFps: avgFps.toFixed(2),
      avgCpuTime: avgCpuTime.toFixed(0),
      avgGpuTime: avgGpuTime.toFixed(0),
      avgMemoryUsed: formatMemory(avgMemoryUsed),
      avgDrawnTiles: Math.round(avgDrawnTiles),
      avgDrawnStatic: Math.round(avgDrawnStatic),
      avgDrawnDynamic: Math.round(avgDrawnDynamic),
      avgNpcCacheSize: Math.round(avgNpcCacheSize),
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
                  <span className="font-semibold">{summaryStats.avgDrawnStatic.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Drawn Dynamic:</span>
                  <span className="font-semibold">{summaryStats.avgDrawnDynamic.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg NPC Cache Size:</span>
                  <span className="font-semibold">{summaryStats.avgNpcCacheSize}</span>
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
                        // Collect GPU timing names dynamically from frame data
                        const gpuTimings = new Set<string>();
                        frames.forEach(frame => {
                          if (frame.gpu) {
                            Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                          }
                        });

                        // Collect CPU timing names dynamically from frame data
                        const cpuTimings = new Set<string>();
                        frames.forEach(frame => {
                          if (frame.cpu) {
                            Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                          }
                        });

                        // Calculate average timing values for each operation from CPU and GPU data
                        const timingAverages: Record<string, number> = {};

                        // Process CPU timings
                        frames.forEach(frame => {
                          if (frame.cpu) {
                            Object.entries(frame.cpu).forEach(([key, value]) => {
                              if (!timingAverages[key]) {
                                timingAverages[key] = 0;
                              }
                              timingAverages[key] += value;
                            });
                          }
                        });

                        // Process GPU timings
                        frames.forEach(frame => {
                          if (frame.gpu) {
                            Object.entries(frame.gpu).forEach(([key, value]) => {
                              if (!timingAverages[key]) {
                                timingAverages[key] = 0;
                              }
                              timingAverages[key] += value;
                            });
                          }
                        });

                        // Calculate averages
                        Object.keys(timingAverages).forEach(key => {
                          timingAverages[key] = timingAverages[key] / frames.length;
                        });

                        // Debug: Log timing averages to help verify data processing
                        console.log('Timing Averages:', timingAverages);
                        console.log('GPU Timings:', gpuTimings);
                        console.log('Available Keys:', Object.keys(timingAverages));

                        // Get GPU operations (inner ring)
                        const gpuOperations = Object.entries(timingAverages)
                          .filter(([timing]) => gpuTimings.has(timing))
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 6);

                        // Get CPU operations (outer ring)
                        const cpuOperations = Object.entries(timingAverages)
                          .filter(([timing]) => cpuTimings.has(timing))
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 8);

                        // Generate dynamic color palettes based on actual operation count
                        const gpuColors = generateColorPalette('#2563eb', gpuOperations.length);
                        const cpuColors = generateColorPalette('#e66312', cpuOperations.length);

                        // Debug: Log classified operations
                        console.log('GPU Operations:', gpuOperations);
                        console.log('CPU Operations:', cpuOperations);
                        console.log('GPU Operations Length:', gpuOperations.length);
                        console.log('CPU Operations Length:', cpuOperations.length);
                        
                        // Check if GPU operations have valid data
                        if (gpuOperations.length > 0) {
                          console.log('GPU Operations Data:', gpuOperations.map(([name, value]) => ({ name, value: formatTime(value) })));
                        } else {
                          console.log('No GPU operations found!');
                          console.log('Available timing keys:', Object.keys(timingAverages));
                          console.log('GPU timing names we\'re looking for:', gpuTimings);
                        }

                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                                             {/* Inner Ring - GPU Operations */}
                              {gpuOperations.length > 0 && (
                               <Pie
                                 data={gpuOperations.map(([timing, value], index) => ({
                                   name: timing,
                                   value: value,
                                   fill: gpuColors[index % gpuColors.length]
                                 }))}
                                 cx="50%"
                                 cy="50%"
                                 innerRadius={0}
                                  outerRadius={50}
                                 paddingAngle={2}
                                 dataKey="value"
                               />
                              )}

                               {/* Outer Ring - CPU Operations */}
                              {cpuOperations.length > 0 && (
                               <Pie
                                 data={cpuOperations.map(([timing, value], index) => ({
                                   name: timing,
                                   value: value,
                                   fill: cpuColors[index % cpuColors.length]
                                 }))}
                                 cx="50%"
                                 cy="50%"
                                  innerRadius={gpuOperations.length > 0 ? 60 : 0}
                                  outerRadius={90}
                                 paddingAngle={2}
                                 dataKey="value"
                               />
                              )}

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
                              // Collect GPU timing names dynamically from frame data
                              const gpuTimings = new Set<string>();
                              frames.forEach(frame => {
                                if (frame.gpu) {
                                  Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                                }
                              });

                              // Collect CPU timing names dynamically from frame data
                              const cpuTimings = new Set<string>();
                              frames.forEach(frame => {
                                if (frame.cpu) {
                                  Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                                }
                              });

                              // Calculate timing averages for legend from CPU and GPU data
                              const timingAverages: Record<string, number> = {};

                              // Process CPU timings
                              frames.forEach(frame => {
                                if (frame.cpu) {
                                  Object.entries(frame.cpu).forEach(([key, value]) => {
                                    if (!timingAverages[key]) {
                                      timingAverages[key] = 0;
                                    }
                                    timingAverages[key] += value;
                                  });
                                }
                              });

                              // Process GPU timings
                              frames.forEach(frame => {
                                if (frame.gpu) {
                                  Object.entries(frame.gpu).forEach(([key, value]) => {
                                    if (!timingAverages[key]) {
                                      timingAverages[key] = 0;
                                    }
                                    timingAverages[key] += value;
                                  });
                                }
                              });

                              // Calculate averages
                              Object.keys(timingAverages).forEach(key => {
                                timingAverages[key] = timingAverages[key] / frames.length;
                              });

                              // Generate dynamic color palette based on actual GPU operations count
                              const gpuOperations = Object.entries(timingAverages)
                                .filter(([timing]) => gpuTimings.has(timing))
                                .sort(([,a], [,b]) => (b as number) - (a as number))
                                .slice(0, 6);
                              const gpuColors = generateColorPalette('#2563eb', gpuOperations.length);

                              return Object.entries(timingAverages)
                                .filter(([timing]) => gpuTimings.has(timing))
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
                              // Collect GPU timing names dynamically from frame data
                              const gpuTimings = new Set<string>();
                              frames.forEach(frame => {
                                if (frame.gpu) {
                                  Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                                }
                              });

                              // Collect CPU timing names dynamically from frame data
                              const cpuTimings = new Set<string>();
                              frames.forEach(frame => {
                                if (frame.cpu) {
                                  Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                                }
                              });

                              // Calculate timing averages first to determine color count
                              const timingAverages: Record<string, number> = {};

                              // Process CPU timings
                              frames.forEach(frame => {
                                if (frame.cpu) {
                                  Object.entries(frame.cpu).forEach(([key, value]) => {
                                    if (!timingAverages[key]) {
                                      timingAverages[key] = 0;
                                    }
                                    timingAverages[key] += value;
                                  });
                                }
                              });

                              // Process GPU timings
                              frames.forEach(frame => {
                                if (frame.gpu) {
                                  Object.entries(frame.gpu).forEach(([key, value]) => {
                                    if (!timingAverages[key]) {
                                      timingAverages[key] = 0;
                                    }
                                    timingAverages[key] += value;
                                  });
                                }
                              });

                              // Calculate averages
                              Object.keys(timingAverages).forEach(key => {
                                timingAverages[key] = timingAverages[key] / frames.length;
                              });

                              // Generate dynamic color palette based on actual CPU operations count
                              const cpuOperations = Object.entries(timingAverages)
                                .filter(([timing]) => cpuTimings.has(timing))
                                .sort(([,a], [,b]) => (b as number) - (a as number))
                                .slice(0, 8);
                              const cpuColors = generateColorPalette('#e66312', cpuOperations.length);

                              return Object.entries(timingAverages)
                                .filter(([timing]) => cpuTimings.has(timing))
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
                <span className="font-semibold">{summaryStats.avgDrawnStatic.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Drawn Dynamic:</span>
                <span className="font-semibold">{summaryStats.avgDrawnDynamic.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg NPC Cache Size:</span>
                <span className="font-semibold">{summaryStats.avgNpcCacheSize}</span>
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
                      // Collect GPU timing names dynamically from frame data
                      const gpuTimings = new Set<string>();
                      frames.forEach(frame => {
                        if (frame.gpu) {
                          Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                        }
                      });

                      // Collect CPU timing names dynamically from frame data
                      const cpuTimings = new Set<string>();
                      frames.forEach(frame => {
                        if (frame.cpu) {
                          Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                        }
                      });

                      // Calculate average timing values for each operation from CPU and GPU data
                      const timingAverages: Record<string, number> = {};

                      // Process CPU timings
                      frames.forEach(frame => {
                        if (frame.cpu) {
                          Object.entries(frame.cpu).forEach(([key, value]) => {
                            if (!timingAverages[key]) {
                              timingAverages[key] = 0;
                            }
                            timingAverages[key] += value;
                          });
                        }
                      });

                      // Process GPU timings
                      frames.forEach(frame => {
                        if (frame.gpu) {
                          Object.entries(frame.gpu).forEach(([key, value]) => {
                            if (!timingAverages[key]) {
                              timingAverages[key] = 0;
                            }
                            timingAverages[key] += value;
                          });
                        }
                      });

                      // Calculate averages
                      Object.keys(timingAverages).forEach(key => {
                        timingAverages[key] = timingAverages[key] / frames.length;
                      });

                      // Get GPU operations (inner ring)
                      const gpuOperations = Object.entries(timingAverages)
                        .filter(([timing]) => gpuTimings.has(timing))
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6);

                      // Get CPU operations (outer ring)
                      const cpuOperations = Object.entries(timingAverages)
                        .filter(([timing]) => cpuTimings.has(timing))
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 8);

                      // Generate dynamic color palettes based on actual operation count
                      const gpuColors = generateColorPalette('#2563eb', gpuOperations.length);
                      const cpuColors = generateColorPalette('#e66312', cpuOperations.length);

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            {/* Inner Ring - GPU Operations */}
                            {gpuOperations.length > 0 && (
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
                            )}

                            {/* Outer Ring - CPU Operations */}
                            {cpuOperations.length > 0 && (
                            <Pie
                              data={cpuOperations.map(([timing, value], index) => ({
                                name: timing,
                                value: value,
                                fill: cpuColors[index % cpuColors.length]
                              }))}
                              cx="50%"
                              cy="50%"
                                innerRadius={gpuOperations.length > 0 ? 80 : 0}
                              outerRadius={120}
                              paddingAngle={2}
                              dataKey="value"
                            />
                            )}

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
                            // Collect GPU timing names dynamically from frame data
                            const gpuTimings = new Set<string>();
                            frames.forEach(frame => {
                              if (frame.gpu) {
                                Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                              }
                            });

                            // Collect CPU timing names dynamically from frame data
                            const cpuTimings = new Set<string>();
                            frames.forEach(frame => {
                              if (frame.cpu) {
                                Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                              }
                            });

                            // Calculate timing averages for legend
                            const timingAverages: Record<string, number> = {};

                            timingMapKeys.forEach(timing => {
                              const values = frames.map(frame => frame.timingMap?.[timing]).filter(v => v !== undefined);
                              if (values.length > 0) {
                                timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                              }
                            });

                            // Generate dynamic color palette based on actual GPU operations count
                            const gpuOperations = Object.entries(timingAverages)
                              .filter(([timing]) => gpuTimings.has(timing))
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 6);
                            const gpuColors = generateColorPalette('#2563eb', gpuOperations.length);

                            return Object.entries(timingAverages)
                              .filter(([timing]) => gpuTimings.has(timing))
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
                            // Collect GPU timing names dynamically from frame data
                            const gpuTimings = new Set<string>();
                            frames.forEach(frame => {
                              if (frame.gpu) {
                                Object.keys(frame.gpu).forEach(key => gpuTimings.add(key));
                              }
                            });

                            // Collect CPU timing names dynamically from frame data
                            const cpuTimings = new Set<string>();
                            frames.forEach(frame => {
                              if (frame.cpu) {
                                Object.keys(frame.cpu).forEach(key => cpuTimings.add(key));
                              }
                            });

                            // Calculate timing averages for legend
                            const timingAverages: Record<string, number> = {};

                            timingMapKeys.forEach(timing => {
                              const values = frames.map(frame => frame.timingMap?.[timing]).filter(v => v !== undefined);
                              if (values.length > 0) {
                                timingAverages[timing] = values.reduce((sum, val) => sum + val, 0) / values.length;
                              }
                            });

                            // Generate dynamic color palette based on actual CPU operations count
                            const cpuOperations = Object.entries(timingAverages)
                              .filter(([timing]) => cpuTimings.has(timing))
                              .sort(([,a], [,b]) => (b as number) - (a as number))
                              .slice(0, 8);
                            const cpuColors = generateColorPalette('#e66312', cpuOperations.length);

                            return Object.entries(timingAverages)
                              .filter(([timing]) => cpuTimings.has(timing))
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
                  <span className="font-semibold">{snapshotData?.osName || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span className="font-semibold">{snapshotData?.osArch || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-semibold">{snapshotData?.osVersion || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Java:</span>
                  <span className="font-semibold">{snapshotData?.javaVersion || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Cores:</span>
                  <span className="font-semibold">{snapshotData?.cpuCores || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="font-semibold">{snapshotData?.memoryMaxMiB ? `${snapshotData.memoryMaxMiB} MiB` : 'Unknown'}</span>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-muted-foreground text-xs">GPU:</div>
                    <div className="text-xs font-semibold leading-tight text-foreground">
                      {parseGpuInfo(snapshotData?.gpuName || '').renderer}
                  </div>
                  </div>
                  {(() => {
                    const gpuInfo = parseGpuInfo(snapshotData?.gpuName || '');
                    const driverInfo = getDriverInfo(gpuInfo.renderer, gpuInfo.vendor, gpuInfo.version);
                    
                    console.log('Driver detection debug:', {
                      gpuName: snapshotData?.gpuName,
                      gpuInfo,
                      driverInfo
                    });
                    
                    return (
                      <div className="text-xs space-y-1">
                        <div className="text-muted-foreground">
                          Vendor: <span className="font-semibold text-foreground">{gpuInfo.vendor}</span>
                        </div>
                        <div className="text-muted-foreground">
                          OpenGL: <span className="font-semibold text-foreground">{gpuInfo.version}</span>
                        </div>
                        {gpuInfo.driver !== 'Unknown' && (
                          <div className="text-muted-foreground">
                            Driver: <span className="font-semibold text-foreground">{gpuInfo.driver}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                         label={{ value: 'Memory (MiB)', angle: -90, position: 'insideLeft' }}
                         tickFormatter={(value) => `${value.toFixed(0)}`}
                       />
                       <RechartsTooltip
                         formatter={(value: number, name: string) => [
                           `${value.toFixed(1)} MiB`,
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
                                   <div>Used: {data.used.toFixed(1)} MiB</div>
                                   <div>Free: {data.free.toFixed(1)} MiB</div>
                                   <div>Total: {data.total.toFixed(1)} MiB</div>
                                   <div>Max: {data.max.toFixed(1)} MiB</div>
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
                   <span className="font-semibold">{snapshotData?.osName || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Architecture:</span>
                   <span className="font-semibold">{snapshotData?.osArch || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Version:</span>
                   <span className="font-semibold">{snapshotData?.osVersion || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Java:</span>
                   <span className="font-semibold">{snapshotData?.javaVersion || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">CPU Cores:</span>
                   <span className="font-semibold">{snapshotData?.cpuCores || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Memory:</span>
                   <span className="font-semibold">{snapshotData?.memoryMaxMiB ? `${snapshotData.memoryMaxMiB} MiB` : 'Unknown'}</span>
                 </div>
                 <div className="mt-2 pt-2 border-t">
                   <div className="flex items-center gap-2 mb-1">
                     <div className="text-muted-foreground text-xs">GPU:</div>
                     <div className="text-xs font-semibold leading-tight text-foreground">
                       {parseGpuInfo(snapshotData?.gpuName || '').renderer}
                   </div>
                   </div>
                   {(() => {
                     const gpuInfo = parseGpuInfo(snapshotData?.gpuName || '');
                     const driverInfo = getDriverInfo(gpuInfo.renderer, gpuInfo.vendor, gpuInfo.version);
                     
                     return (
                       <div className="text-xs space-y-1">
                         <div className="text-muted-foreground">
                           Vendor: <span className="font-semibold text-foreground">{gpuInfo.vendor}</span>
                         </div>
                         <div className="text-muted-foreground">
                           OpenGL: <span className="font-semibold text-foreground">{gpuInfo.version}</span>
                         </div>
                         {gpuInfo.driver !== 'Unknown' && (
                           <div className="text-muted-foreground">
                             Driver: <span className="font-semibold text-foreground">{gpuInfo.driver}</span>
                           </div>
                         )}
                       </div>
                     );
                   })()}
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
                   <span className="font-semibold">{snapshotData?.osName || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Architecture:</span>
                   <span className="font-semibold">{snapshotData?.osArch || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Version:</span>
                   <span className="font-semibold">{snapshotData?.osVersion || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Java:</span>
                   <span className="font-semibold">{snapshotData?.javaVersion || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">CPU Cores:</span>
                   <span className="font-semibold">{snapshotData?.cpuCores || 'Unknown'}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Memory:</span>
                   <span className="font-semibold">{snapshotData?.memoryMaxMiB ? `${snapshotData.memoryMaxMiB} MiB` : 'Unknown'}</span>
                 </div>
                 <div className="mt-2 pt-2 border-t">
                   <div className="flex items-center gap-2 mb-1">
                     <div className="text-muted-foreground text-xs">GPU:</div>
                     <div className="text-xs font-semibold leading-tight text-foreground">
                       {parseGpuInfo(snapshotData?.gpuName || '').renderer}
                   </div>
                   </div>
                   {(() => {
                     const gpuInfo = parseGpuInfo(snapshotData?.gpuName || '');
                     const driverInfo = getDriverInfo(gpuInfo.renderer, gpuInfo.vendor, gpuInfo.version);
                     
                     return (
                       <div className="text-xs space-y-1">
                         <div className="text-muted-foreground">
                           Vendor: <span className="font-semibold text-foreground">{gpuInfo.vendor}</span>
                         </div>
                         <div className="text-muted-foreground">
                           OpenGL: <span className="font-semibold text-foreground">{gpuInfo.version}</span>
                         </div>
                         {gpuInfo.driver !== 'Unknown' && (
                           <div className="text-muted-foreground">
                             Driver: <span className="font-semibold text-foreground">{gpuInfo.driver}</span>
                           </div>
                         )}
                       </div>
                     );
                   })()}
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>
       )}
    </div>
  );
} 