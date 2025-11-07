"use client";

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, X } from 'lucide-react';

interface MapSettingsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

export function MapSettingsPanel({ isOpen, onToggle, children }: MapSettingsPanelProps) {
  return (
    <>
      {/* Toggle Button - Only show when panel is closed */}
      {!isOpen && (
        <Button
          variant="default"
          size="icon"
          onClick={onToggle}
          className={cn(
            "fixed z-[1001] transition-all duration-300 shadow-xl",
            "top-1/2 -translate-y-1/2",
            "h-12 w-12 bg-card/90 border-2 border-border/80 hover:bg-accent/90 hover:border-accent-foreground/40",
            "flex items-center justify-center"
          )}
          style={{
            right: '-12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
          }}
          aria-label="Show settings"
        >
          <ChevronLeft className="h-6 w-6 stroke-[2]" />
        </Button>
      )}

      {/* Settings Panel - Slides in from Right */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 z-[1000] transition-transform duration-300 ease-in-out",
          "w-[280px] flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col bg-card border-l shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
            <h3 className="text-sm font-medium">Map Settings</h3>
            {isOpen && (
              <Button
                onClick={onToggle}
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mr-1"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {children || (
              <div className="text-sm text-muted-foreground">
                <p>Settings panel content goes here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

