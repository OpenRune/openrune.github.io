"use client";

import { useEffect, useState, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import OSRSMap from "@/components/map/OSRSMap";

export default function MapPage() {
    const { state, setOpen } = useSidebar();
    const isExpanded = state === "expanded";
    const wasExpandedRef = useRef(isExpanded);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Update ref when sidebar state changes (but not when in fullscreen)
    useEffect(() => {
        if (!isFullscreen) {
            wasExpandedRef.current = isExpanded;
        }
    }, [isExpanded, isFullscreen]);

    // Listen for fullscreen changes and hide/show sidebar accordingly
    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreen = !!document.fullscreenElement;
            setIsFullscreen(fullscreen);
            
            if (fullscreen) {
                // Entering fullscreen - save current state (from ref) and hide sidebar
                // The ref is always up to date with the latest sidebar state
                setOpen(false);
            } else {
                // Exiting fullscreen - restore previous sidebar state
                setOpen(wasExpandedRef.current);
            }
        };

        // Check initial fullscreen state
        const initialFullscreen = !!document.fullscreenElement;
        setIsFullscreen(initialFullscreen);
        if (initialFullscreen) {
            setOpen(false);
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [setOpen]);

    // Calculate width and left offset based on sidebar state
    // Sidebar expanded: 16rem (256px), collapsed: 3rem (48px)
    // In fullscreen, sidebar is hidden so width is 0
    const sidebarWidth = isFullscreen ? "0" : (isExpanded ? "16rem" : "3rem");

    return (
        <div 
            className="fixed top-0 bottom-0 right-0 transition-all duration-200 ease-linear overflow-hidden"
            style={{
                left: sidebarWidth
            }}
        >
            <OSRSMap />
        </div>
    );
}

