'use client';

import * as React from 'react'
import {
  SidebarMenu,
  useSidebar
} from '@/components/ui/sidebar'
import {ModeToggle} from "@/components/ui/themetoggle";
import { SideBarToggle } from './SideBarToggle';
import {Logo} from "@/components/ui/logo";
import {Sygnet} from "@/components/ui/sygnet";
import Image from "next/image";

export function AppHeaderContent() {
  const [mounted, setMounted] = React.useState(false);
  const { open } = useSidebar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SidebarMenu>
      <div className="flex flex-col gap-2 pt-3">
        <div
          className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm h-8 text-sm min-w-8"
          aria-label="Sidebar Header"
        >
          {!open && (
            <div className="flex w-full h-8 items-center justify-center">
              <Sygnet width={28} height={28} className="text-sidebar-primary-foreground" />
            </div>
          )}
          {open && (
            <>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0 max-w-[60%]">
                  <Logo width={200} height={32}/>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {mounted ? <ModeToggle /> : null}
                  <SideBarToggle />
                </div>
              </div>
            </>
          )}
        </div>
        {!open && (
          <div className="w-full flex justify-center px-2 mt-1">
            <SideBarToggle />
          </div>
        )}
      </div>
    </SidebarMenu>
  )
}
