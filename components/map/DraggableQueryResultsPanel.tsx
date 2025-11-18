"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GripVertical, PanelRightClose, PanelRightOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { QueryResultsPanel, QueryResultsPanelProps, QueryResultsFormat } from "./QueryResultsModal"

interface DraggableQueryResultsPanelProps extends QueryResultsPanelProps {
  onDock?: () => void
  onUndock?: () => void
  initialPosition?: { x: number; y: number }
  initialSize?: { width: number; height: number }
  forceDocked?: boolean // Force docked state from parent
  settingsPanelOpen?: boolean // Whether settings panel is open (for positioning when docked)
}

const STORAGE_KEY = 'query_results_panel_state'

interface SavedPanelState {
  isDocked: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  format?: QueryResultsFormat
}

export function DraggableQueryResultsPanel({
  onDock,
  onUndock,
  initialPosition,
  initialSize,
  format,
  onFormatChange,
  variant = "display",
  forceDocked,
  settingsPanelOpen = false,
  ...panelProps
}: DraggableQueryResultsPanelProps) {
  // Load saved state from localStorage on mount
  const loadSavedState = (): SavedPanelState | null => {
    if (typeof window === 'undefined') return null
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load saved panel state:', error)
    }
    return null
  }

  const savedStateRef = useRef<SavedPanelState | null>(null)
  if (savedStateRef.current === null) {
    savedStateRef.current = loadSavedState()
  }

  const [isDocked, setIsDocked] = useState(() => {
    if (forceDocked !== undefined) return forceDocked
    return savedStateRef.current?.isDocked ?? true
  })

  // Sync with parent forceDocked prop
  useEffect(() => {
    if (forceDocked !== undefined) {
      setIsDocked(forceDocked)
    }
  }, [forceDocked])
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition
    if (savedStateRef.current?.position) return savedStateRef.current.position
    return { x: 0, y: 0 }
  })
  const [size, setSize] = useState(() => {
    if (initialSize) return initialSize
    if (savedStateRef.current?.size) return savedStateRef.current.size
    return { width: 500, height: 500 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<'bottom-right' | 'top-left' | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })
  
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // Calculate docked position (bottom right of screen)
  const getDockedPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 }
    // Position at bottom right with margin
    const panelWidth = size.width || 500
    const panelHeight = size.height || 500
    const margin = 20 // Margin from edges
    return {
      x: window.innerWidth - panelWidth - margin, // Right side with margin
      y: window.innerHeight - panelHeight - margin // Bottom with margin
    }
  }, [size.width, size.height])

  // Update position when docking
  useEffect(() => {
    if (isDocked) {
      const dockedPos = getDockedPosition()
      setPosition(dockedPos)
    }
  }, [isDocked, getDockedPosition])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDocked) return
    if (e.target instanceof HTMLElement && e.target.closest('[data-resize-handle]')) {
      return // Don't start dragging if clicking on resize handle
    }
    e.preventDefault() // Prevent text selection
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }, [isDocked, position])

  const handleResizeMouseDown = useCallback((direction: 'bottom-right' | 'top-left') => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault() // Prevent text selection
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    })
  }, [size, position])

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault() // Prevent text selection
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      } else if (isResizing) {
        e.preventDefault() // Prevent text selection
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        
        if (resizeDirection === 'bottom-right') {
          // Resize from bottom-right: only adjust size
          setSize({
            width: Math.max(300, resizeStart.width + deltaX),
            height: Math.max(200, resizeStart.height + deltaY)
          })
        } else if (resizeDirection === 'top-left') {
          // Resize from top-left: adjust both position and size
          // When dragging left (negative deltaX), increase width and move position left
          // When dragging up (negative deltaY), increase height and move position up
          const newWidth = Math.max(300, resizeStart.width - deltaX)
          const newHeight = Math.max(200, resizeStart.height - deltaY)
          const widthDelta = resizeStart.width - newWidth
          const heightDelta = resizeStart.height - newHeight
          
          setSize({
            width: newWidth,
            height: newHeight
          })
          // Adjust position to keep bottom-right corner fixed
          // When width increases (widthDelta negative), move left (subtract absolute value)
          // When height increases (heightDelta negative), move up (subtract absolute value)
          setPosition({
            x: resizeStart.posX + widthDelta,
            y: resizeStart.posY + heightDelta
          })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, resizeDirection, dragStart, resizeStart])

  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const stateToSave: SavedPanelState = {
      isDocked,
      position,
      size,
      format: format
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (error) {
      console.error('Failed to save panel state:', error)
    }
  }, [isDocked, position, size, format])

  const handleDock = useCallback(() => {
    setIsDocked(true)
    onDock?.()
  }, [onDock])

  const handleUndock = useCallback(() => {
    setIsDocked(false)
    // When undocking, position it near the docked position but slightly offset
    const dockedPos = getDockedPosition()
    setPosition({
      x: dockedPos.x - 20,
      y: dockedPos.y + 20
    })
    onUndock?.()
  }, [getDockedPosition, onUndock])

  const handleFormatChange = (value: string) => {
    if (!onFormatChange) return
    if (value === "table" || value === "json" || value === "list") {
      onFormatChange(value as QueryResultsFormat)
    }
  }

  // When docked, render as a fixed panel below settings (if open)
  if (isDocked) {
    return (
      <div
        ref={panelRef}
        className="fixed z-[1002] shadow-2xl border rounded-lg bg-background flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Header with dock button */}
        <div
          ref={headerRef}
          className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 select-none"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">Query Results ({panelProps.results.length})</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {variant === "display" && onFormatChange && (
              <Select value={format} onValueChange={handleFormatChange}>
                <SelectTrigger 
                  className="h-7 w-[100px] text-xs" 
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table" className="text-foreground">Table</SelectItem>
                  <SelectItem value="list" className="text-foreground">List</SelectItem>
                  <SelectItem value="json" className="text-foreground">JSON</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation()
                handleUndock()
              }}
              title="Undock panel"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <QueryResultsPanel {...panelProps} format={format} onFormatChange={onFormatChange} variant={variant} hideTitle={true} />
        </div>
      </div>
    )
  }

  // Floating draggable panel
  return (
    <div
      ref={panelRef}
      className="fixed z-[1002] shadow-2xl border rounded-lg bg-background flex flex-col"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        userSelect: (isDragging || isResizing) ? 'none' : 'auto'
      }}
    >
      {/* Header with drag handle and dock button */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <h3 className="text-sm font-semibold truncate">Query Results ({panelProps.results.length})</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {variant === "display" && onFormatChange && (
            <Select value={format} onValueChange={handleFormatChange}>
              <SelectTrigger 
                className="h-7 w-[100px] text-xs" 
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table" className="text-foreground">Table</SelectItem>
                <SelectItem value="list" className="text-foreground">List</SelectItem>
                <SelectItem value="json" className="text-foreground">JSON</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              handleDock()
            }}
            title="Dock panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <QueryResultsPanel {...panelProps} format={format} onFormatChange={onFormatChange} variant={variant} hideTitle={true} />
      </div>

      {/* Resize handle - bottom right */}
      <div
        data-resize-handle="bottom-right"
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-border hover:bg-primary/50 transition-colors select-none"
        style={{
          clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
          userSelect: 'none'
        }}
        onMouseDown={handleResizeMouseDown('bottom-right')}
      />
      {/* Resize handle - top left */}
      <div
        data-resize-handle="top-left"
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize bg-border hover:bg-primary/50 transition-colors select-none"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          userSelect: 'none'
        }}
        onMouseDown={handleResizeMouseDown('top-left')}
      />
    </div>
  )
}

