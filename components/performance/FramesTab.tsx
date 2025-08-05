'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

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

interface FramesTabProps {
  frames: FrameData[];
  formatTime: (nanoseconds: number) => string;
  formatMemory: (bytes: number) => string;
}

export default function FramesTab({ frames, formatTime, formatMemory }: FramesTabProps) {
  const [collapsedFrames, setCollapsedFrames] = useState<Set<number>>(new Set(frames.map((_, index) => index)));

  const toggleFrame = (index: number) => {
    const newCollapsed = new Set(collapsedFrames);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedFrames(newCollapsed);
  };

  const collapseAll = () => {
    setCollapsedFrames(new Set(frames.map((_, index) => index)));
  };

  const expandAll = () => {
    setCollapsedFrames(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
        <Button variant="outline" size="sm" onClick={expandAll}>
          Expand All
        </Button>
      </div>
      
      {frames.map((frame, index) => (
        <Collapsible
          key={index}
          open={!collapsedFrames.has(index)}
          onOpenChange={() => toggleFrame(index)}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  {collapsedFrames.has(index) ? (
                    <IconChevronRight size={16} />
                  ) : (
                    <IconChevronDown size={16} />
                  )}
                  Frame {index + 1}
                  <Badge variant={frame.bottleneck === 'CPU' ? 'destructive' : 'default'}>
                    {frame.bottleneck}
                  </Badge>
                  <Badge variant="outline">{frame.estimatedFps.toFixed(1)} FPS</Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Elapsed:</span>
                    <div className="font-semibold">{frame.elapsed}ms</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CPU Time:</span>
                    <div className="font-semibold">{formatTime(frame.cpuTime)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GPU Time:</span>
                    <div className="font-semibold">{formatTime(frame.gpuTime)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Memory:</span>
                    <div className="font-semibold">{formatMemory(frame.memoryUsed)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Drawn Tiles:</span>
                    <div className="font-semibold">{frame.drawnTiles.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Static:</span>
                    <div className="font-semibold">{frame.drawnStatic.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dynamic:</span>
                    <div className="font-semibold">{frame.drawnDynamic.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">NPC Cache:</span>
                    <div className="font-semibold">{frame.npcCacheSize}</div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
} 