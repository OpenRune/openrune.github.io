
import React from 'react';
import { ActiveThemeProvider, useThemeConfig } from '../active-theme';
import { Toaster } from 'sonner';

function getToasterTheme(activeTheme: string) {
    if (activeTheme.includes('dark')) return 'dark';
    if (activeTheme.includes('light')) return 'light';
    // fallback to system if not clear
    return 'system';
}

export function ClientToaster() {
    const { activeTheme } = useThemeConfig();
    return <Toaster position="top-center" theme={getToasterTheme(activeTheme)} />;
}

export default function Providers({
    activeThemeValue,
    children
}: {
    activeThemeValue: string;
    children: React.ReactNode;
}) {
    return (
        <ActiveThemeProvider initialTheme={activeThemeValue}>
            {children}
        </ActiveThemeProvider>
    );
}