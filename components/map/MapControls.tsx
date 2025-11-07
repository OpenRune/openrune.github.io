"use client";

import { useState, useEffect } from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Maximize2, Settings } from 'lucide-react';
import { ObjectFinder, ObjectPosition } from './ObjectFinder';
import { AreaSelection } from './AreaSelection';
import { Position } from '@/lib/map/model/Position';
import { CollectionControl } from '@/lib/map/controls/CollectionControl';

interface MapControlsProps {
  className?: string;
  children?: React.ReactNode;
  combined?: boolean; // If true, combine fullscreen and settings in one card
  onJumpToPosition?: (position: Position) => void;
  onObjectSearch?: (query: string, mode: 'gameval' | 'id') => Promise<ObjectPosition[]>;
  collectionControl?: CollectionControl | null;
}

export function MapControls({ className, children, combined = false, onJumpToPosition, onObjectSearch, collectionControl }: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importMode, setImportMode] = useState(false);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (combined) {
    // Combined layout for main map page
    return (
      <div className={cn("absolute top-4 right-4 z-[1000]", className)}>
        <Card className="p-2 relative">
          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <Button
              variant="outline"
              size="default"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={cn(
                "h-9 px-3 border-border hover:bg-gray-800 text-white",
                settingsOpen 
                  ? "bg-gray-800" 
                  : "bg-black"
              )}
              aria-pressed={settingsOpen}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>

            {/* Fullscreen Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleFullscreen}
              className="h-9 w-9 bg-black border-border hover:bg-gray-800 text-white"
              aria-label="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Settings Dropdown Card */}
          {settingsOpen && (
            <div className="absolute top-full right-0 mt-2 z-[1001]">
              <Card className="w-80 h-[70vh] shadow-xl border animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col">
                <CardContent className="px-4 pt-0 pb-4 flex-1 flex flex-col overflow-hidden">
                  {importMode ? (
                    <Tabs defaultValue="normal" className="flex flex-col flex-1 overflow-hidden" key="import-tabs">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="normal">Normal</TabsTrigger>
                        <TabsTrigger value="117hd">117HD</TabsTrigger>
                      </TabsList>
                      <TabsContent value="normal" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: true,
                            importFormat: 'normal',
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={true}
                            importFormat="normal"
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="117hd" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: true,
                            importFormat: '117hd',
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={true}
                            importFormat="117hd"
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <Tabs defaultValue="area-selection" className="flex flex-col flex-1 overflow-hidden" key="main-tabs">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="area-selection">Area Selection</TabsTrigger>
                        <TabsTrigger value="object-finder">Object Finder</TabsTrigger>
                      </TabsList>
                      <TabsContent value="area-selection" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: false,
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={false}
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="object-finder" className="flex-1 overflow-y-auto mt-0">
                        {onJumpToPosition ? (
                          <ObjectFinder 
                            onJumpToPosition={onJumpToPosition}
                            onSearch={onObjectSearch}
                          />
                        ) : (
                          <div className="space-y-3 text-sm text-muted-foreground">
                            <p>Object Finder content goes here.</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Separate layout for other pages
  return (
    <>
      {/* Fullscreen Button - Always visible */}
      <div className={cn("absolute top-4 right-4 z-[1000]", className)}>
        <Card className="p-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleFullscreen}
            className="h-9 w-9 bg-black border-border hover:bg-gray-800 text-white"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      {/* Settings Button and Panel */}
      <div className={cn("absolute top-4 right-[4.5rem] z-[1000]", className)}>
        <Card className="p-2 relative">
          {/* Settings Button */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              "h-9 px-3 border-border hover:bg-gray-800 text-white",
              settingsOpen 
                ? "bg-gray-800" 
                : "bg-black"
            )}
            aria-pressed={settingsOpen}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>

          {/* Settings Dropdown Card */}
          {settingsOpen && (
            <div className="absolute top-full right-0 mt-2 z-[1001]">
              <Card className="w-80 h-[70vh] shadow-xl border animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col">
                <CardContent className="px-4 pt-0 pb-4 flex-1 flex flex-col overflow-hidden">
                  {importMode ? (
                    <Tabs defaultValue="normal" className="flex flex-col flex-1 overflow-hidden" key="import-tabs">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="normal">Normal</TabsTrigger>
                        <TabsTrigger value="117hd">117HD</TabsTrigger>
                      </TabsList>
                      <TabsContent value="normal" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: true,
                            importFormat: 'normal',
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={true}
                            importFormat="normal"
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="117hd" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: true,
                            importFormat: '117hd',
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={true}
                            importFormat="117hd"
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <Tabs defaultValue="area-selection" className="flex flex-col flex-1 overflow-hidden" key="main-tabs">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="area-selection">Area Selection</TabsTrigger>
                        <TabsTrigger value="object-finder">Object Finder</TabsTrigger>
                      </TabsList>
                      <TabsContent value="area-selection" className="flex-1 overflow-y-auto mt-0">
                        {children ? (
                          React.cloneElement(children as React.ReactElement, {
                            importMode: false,
                            onImportModeChange: setImportMode
                          })
                        ) : (
                          <AreaSelection 
                            importMode={false}
                            onImportModeChange={setImportMode}
                            collectionControl={collectionControl}
                            onItemClick={(item) => {
                              console.log('Area/Poly clicked:', item);
                            }}
                          />
                        )}
                      </TabsContent>
                      <TabsContent value="object-finder" className="flex-1 overflow-y-auto mt-0">
                        {onJumpToPosition ? (
                          <ObjectFinder 
                            onJumpToPosition={onJumpToPosition}
                            onSearch={onObjectSearch}
                          />
                        ) : (
                          <div className="space-y-3 text-sm text-muted-foreground">
                            <p>Object Finder content goes here.</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

