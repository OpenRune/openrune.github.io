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
import { QueryResultsPanel, QueryResultsFormat } from './QueryResultsModal';
import { DraggableQueryResultsPanel } from './DraggableQueryResultsPanel';

interface MapControlsProps {
  className?: string;
  children?: React.ReactNode;
  combined?: boolean; // If true, combine fullscreen and settings in one card
  onJumpToPosition?: (position: Position) => void;
  onObjectPositionsChange?: (positions: ObjectPosition[]) => void;
  onObjectCurrentIndexChange?: (index: number) => void;
  onObjectSearchQueryChange?: (query: string) => void;
  objectSearchQuery?: string;
  objectPositions?: ObjectPosition[];
  objectCurrentIndex?: number;
  collectionControl?: CollectionControl | null;
  queryResults?: any[];
  resultsFormat?: QueryResultsFormat;
  onResultsFormatChange?: (format: QueryResultsFormat) => void;
  showQueryResults?: boolean;
  onCloseQueryResults?: () => void;
  onResultClick?: (result: any) => void;
  resultsSource?: 'display' | 'highlight' | null;
  onHighlightIndexChange?: (index: number, result: any) => void;
  onMarkAll?: () => void;
  onUnmarkAll?: () => void;
  markAllActive?: boolean;
  getResultExtras?: (result: any) => { name?: string; imageUrl?: string } | null;
}

export function MapControls({
  className,
  children,
  combined = false,
  onJumpToPosition,
  onObjectPositionsChange,
  onObjectCurrentIndexChange,
  onObjectSearchQueryChange,
  objectSearchQuery,
  objectPositions,
  objectCurrentIndex,
  collectionControl,
  queryResults = [],
  resultsFormat = 'table',
  onResultsFormatChange,
  showQueryResults = false,
  onCloseQueryResults,
  onResultClick,
  resultsSource = null,
  onHighlightIndexChange,
  onMarkAll,
  onUnmarkAll,
  markAllActive,
  getResultExtras,
}: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [isPanelDocked, setIsPanelDocked] = useState(true);

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

  useEffect(() => {
    if (showQueryResults) {
      // Load dock state from localStorage
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('query_results_panel_state');
          if (saved) {
            const parsed = JSON.parse(saved);
            setIsPanelDocked(parsed.isDocked ?? true); // Default to docked
          } else {
            setIsPanelDocked(true); // Default to docked
          }
        } catch (error) {
          console.error('Failed to load panel dock state:', error);
          setIsPanelDocked(true); // Default to docked
        }
      } else {
        setIsPanelDocked(true); // Default to docked
      }
      setImportMode(false);
    }
  }, [showQueryResults]);

  if (combined) {
    // Combined layout for main map page
    return (
      <>
        {/* Draggable Query Results Panel - Always render as floating window */}
        {showQueryResults && (
          <DraggableQueryResultsPanel
            results={queryResults}
            format={resultsFormat}
            onFormatChange={onResultsFormatChange}
            onResultClick={onResultClick}
            variant={resultsSource === 'highlight' ? 'highlight' : 'display'}
            onHighlightIndexChange={onHighlightIndexChange}
            onMarkAll={onMarkAll}
            onUnmarkAll={onUnmarkAll}
            markAllActive={markAllActive}
            onClosePanel={onCloseQueryResults}
            forceDocked={isPanelDocked}
            settingsPanelOpen={settingsOpen}
            onUndock={() => {
              setIsPanelDocked(false)
            }}
            onDock={() => {
              setIsPanelDocked(true)
            }}
            getResultExtras={getResultExtras}
          />
        )}
        <div className={cn("absolute top-4 right-4 z-[1000]", className)}>
          <Card className="p-2 relative">
            <div className="flex items-center gap-2">
              {/* Settings Button */}
              <Button
                variant="outline"
                size="default"
              onClick={() => {
                setSettingsOpen(!settingsOpen)
              }}
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
                            onPositionsChange={onObjectPositionsChange}
                            onCurrentIndexChange={onObjectCurrentIndexChange}
                            onSearchQueryChange={onObjectSearchQueryChange}
                            initialSearchQuery={objectSearchQuery}
                            initialPositions={objectPositions}
                            initialCurrentIndex={objectCurrentIndex}
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

  // Separate layout for other pages
  return (
    <>
      {/* Draggable Query Results Panel - Always render, shows as floating when undocked */}
      {showQueryResults && (
        <DraggableQueryResultsPanel
          results={queryResults}
          format={resultsFormat}
          onFormatChange={onResultsFormatChange}
          onResultClick={onResultClick}
          variant={resultsSource === 'highlight' ? 'highlight' : 'display'}
          onHighlightIndexChange={onHighlightIndexChange}
          onMarkAll={onMarkAll}
          onUnmarkAll={onUnmarkAll}
          markAllActive={markAllActive}
          onClosePanel={onCloseQueryResults}
          forceDocked={isPanelDocked}
          onUndock={() => {
            // Close settings panel when undocking
            setIsPanelDocked(false)
            setSettingsOpen(false)
          }}
          onDock={() => {
            // Open settings panel when docking
            setIsPanelDocked(true)
            setSettingsOpen(true)
          }}
          getResultExtras={getResultExtras}
        />
      )}
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
              onClick={() => {
                setSettingsOpen(!settingsOpen)
              }}
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
              <Card className={cn("h-[70vh] shadow-xl border animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col", showQueryResults && isPanelDocked ? "w-[500px]" : "w-80")}>
                <CardContent className="px-4 pt-0 pb-4 flex-1 flex flex-col overflow-hidden">
                  {showQueryResults && isPanelDocked ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <DraggableQueryResultsPanel
                        results={queryResults}
                        format={resultsFormat}
                        onFormatChange={onResultsFormatChange}
                        onResultClick={onResultClick}
                        variant={resultsSource === 'highlight' ? 'highlight' : 'display'}
                        onHighlightIndexChange={onHighlightIndexChange}
                        onMarkAll={onMarkAll}
                        onUnmarkAll={onUnmarkAll}
                        markAllActive={markAllActive}
                        onClosePanel={onCloseQueryResults}
                        onUndock={() => {
                          // Close settings panel when undocking
                          setIsPanelDocked(false)
                          setSettingsOpen(false)
                        }}
                        onDock={() => {
                          // Open settings panel when docking
                          setIsPanelDocked(true)
                          setSettingsOpen(true)
                        }}
                        getResultExtras={getResultExtras}
                      />
                    </div>
                  ) : importMode ? (
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
                            onPositionsChange={onObjectPositionsChange}
                            onCurrentIndexChange={onObjectCurrentIndexChange}
                            onSearchQueryChange={onObjectSearchQueryChange}
                            initialSearchQuery={objectSearchQuery}
                            initialPositions={objectPositions}
                            initialCurrentIndex={objectCurrentIndex}
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

