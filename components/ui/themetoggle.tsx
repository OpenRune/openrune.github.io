'use client';

import { IconSun, IconMoon } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useThemeConfig } from '@/components/active-theme';
import { Check } from 'lucide-react';

const DEFAULT_THEMES = [
    { name: 'Default', value: 'default' },
    { name: 'Blue', value: 'blue' },
    { name: 'Green', value: 'green' },
    { name: 'Amber', value: 'amber' }
];

const SCALED_THEMES = [
    { name: 'Default', value: 'default-scaled' },
    { name: 'Blue', value: 'blue-scaled' }
];

const MONO_THEMES = [
    { name: 'Mono', value: 'mono-scaled' }
];

export function ModeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const { activeTheme, setActiveTheme } = useThemeConfig();

    const handleThemeToggle = React.useCallback(
        (e?: React.MouseEvent) => {
            const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
            const root = document.documentElement;

            if (!document.startViewTransition) {
                setTheme(newMode);
                return;
            }

            if (e) {
                root.style.setProperty('--x', `${e.clientX}px`);
                root.style.setProperty('--y', `${e.clientY}px`);
            }

            document.startViewTransition(() => {
                setTheme(newMode);
            });
        },
        [resolvedTheme, setTheme]
    );

    const createThemeItems = (
        label: string,
        themes: { name: string; value: string }[]
    ) => (
        <>
            <ContextMenuLabel>{label}</ContextMenuLabel>
            {themes.map((theme) => (
                <ContextMenuItem
                    key={theme.value}
                    inset
                    onSelect={() => setActiveTheme(theme.value)}
                    className='flex justify-between items-center'
                >
                    <span>{theme.name}</span>
                    {activeTheme === theme.value && (
                        <Check className='w-4 h-4 text-primary opacity-70' />
                    )}
                </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
        </>
    );

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <Button
                    variant='secondary'
                    size='icon'
                    className='group/toggle size-8'
                    onClick={handleThemeToggle}
                >
                    {resolvedTheme === 'dark' ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
                    <span className='sr-only'>Toggle theme</span>
                </Button>
            </ContextMenuTrigger>
            <ContextMenuContent className='w-56'>
                <ContextMenuItem inset disabled className='opacity-100 font-semibold'>
                    Toggle dark/light
                </ContextMenuItem>

                {createThemeItems('Default Themes', DEFAULT_THEMES)}
                {createThemeItems('Scaled Themes', SCALED_THEMES)}
                {createThemeItems('Mono Themes', MONO_THEMES)}
            </ContextMenuContent>
        </ContextMenu>
    );
}
