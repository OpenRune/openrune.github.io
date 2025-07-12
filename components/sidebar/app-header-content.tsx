'use client';

import * as React from 'react'
import {
    SidebarMenu, useSidebar,
    // SidebarMenuButton, SidebarTrigger,
} from '@/components/ui/sidebar'
import {ModeToggle} from "@/components/ui/themetoggle";
import { Sygnet } from '@/components/ui/sygnet';
import {PanelLeftIcon} from "lucide-react";
import {Logo} from "@/components/ui/logo";

export function AppHeaderContent() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

    const { open } = useSidebar();

  return (
    <SidebarMenu>
      <div
          className="peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-sm min-w-8 duration-200 ease-linear"
          tabIndex={0}
          role="button"
          aria-label="Sidebar Header"
      >
        <div className="flex items-center justify-between w-full">
          <div>
              {open ? <Logo width={200} height={32}/> : <Sygnet width={200} height={32}/>}

          </div>

          <div className="flex-1 grid text-left text-sm leading-tight"/>

          <div
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
          >
            {mounted ? <ModeToggle/> : null}
          </div>
        </div>
      </div>
    </SidebarMenu>
  )
}
