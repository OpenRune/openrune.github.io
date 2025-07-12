"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export default function FloatingSidebarTrigger() {
  const isMobile = useIsMobile();
  const { openMobile } = useSidebar();
  if (!isMobile || openMobile) return null;
  return (
    <div style={{ position: 'fixed', top: 5, left: 5, zIndex: 1000 }}>
      <SidebarTrigger />
    </div>
  );
} 