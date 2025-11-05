'use client';

import { useSettings } from '@/components/layout/settings-provider';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

export function ContentWrapper({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  
  return (
    <div className={cn('w-full flex-1 min-h-0 overflow-y-auto', settings.fullWidthContent ? 'px-4 py-2' : 'm-[10px]')}>
      {children}
    </div>
  );
}

