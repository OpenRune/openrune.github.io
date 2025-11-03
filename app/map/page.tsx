"use client";

import { useEffect, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";

export default function MapPage() {
    const { setOpen, open } = useSidebar();
    const previousSidebarState = useRef<boolean | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Wait for sidebar state to be available, then capture and collapse if needed
    useEffect(() => {
        // Small delay to ensure sidebar context is fully initialized
        const timer = setTimeout(() => {
            if (!isReady) {
                // Capture current state before changing it
                previousSidebarState.current = open;
                setIsReady(true);
                // Only collapse if it's currently expanded
                if (open) {
                    setOpen(false);
                }
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [open, setOpen, isReady]);

    // Restore the previous state when leaving the page
    useEffect(() => {
        return () => {
            if (isReady && previousSidebarState.current !== null) {
                setOpen(previousSidebarState.current);
            }
        };
    }, [isReady, setOpen]);

    return (
        <div className="fixed inset-0 left-[3rem] top-0 right-0 bottom-0 -m-[10px]">
            <iframe
                src="https://mejrs.github.io/osrs"
                className="w-full h-full border-0"
                title="OSRS Map"
                allowFullScreen
            />
        </div>
    );
}

