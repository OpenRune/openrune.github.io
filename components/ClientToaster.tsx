'use client';
import { Toaster } from 'sonner';
import { useThemeConfig } from '@/components/active-theme';

function getToasterTheme(activeTheme: string) {
  if (activeTheme.includes('dark')) return 'dark';
  if (activeTheme.includes('light')) return 'light';
  return 'system';
}

export default function ClientToaster() {
  const { activeTheme } = useThemeConfig();
  return <Toaster position="top-center" theme={getToasterTheme(activeTheme)} />;
} 