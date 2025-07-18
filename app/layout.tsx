import Providers from '@/components/layout/Providers';
import ClientToaster from '@/components/ClientToaster';
import {fontVariables} from '@/lib/font';
import ThemeProvider from '@/components/layout/theme-provider';
import {cn} from '@/lib/utils';
import type {Metadata, Viewport} from 'next';
import {cookies} from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import {NuqsAdapter} from 'nuqs/adapters/next/app';
import './globals.css';
import './theme.css';
import {SidebarProvider} from "@/components/ui/sidebar";
import {AppSidebar} from "@/components/sidebar/app-sidebar";
import FloatingSidebarTrigger from "@/components/FloatingSidebarTrigger";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const META_THEME_COLORS = {
    light: '#ffffff',
    dark: '#09090b'
};

export const metadata: Metadata = {
    title: 'OpenRune',
    description: 'Website for all your osrs data'
};

export const viewport: Viewport = {
    themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({
                                             children
                                         }: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const activeThemeValue = cookieStore.get('active_theme')?.value;
    const isScaled = activeThemeValue?.endsWith('-scaled');

    const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"
    const userSession = cookieStore.get("UserSession")?.value ?? null;
    const userAccountRaw = cookieStore.get("UserAccount")?.value ?? null;

    return (
        <html lang='en' suppressHydrationWarning>
        <head>
            <script
                dangerouslySetInnerHTML={{
                    __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
                }}
            />
        </head>
        <body
            className={cn(
                'bg-background overflow-hidden overscroll-none font-sans antialiased',
                activeThemeValue ? `theme-${activeThemeValue}` : '',
                isScaled ? 'theme-scaled' : '',
                fontVariables
            )}
        >
        <SpeedInsights/>
        <Analytics/>
        <NextTopLoader showSpinner={false}/>
        <NuqsAdapter>
            <ThemeProvider
                attribute='class'
                defaultTheme='system'
                enableSystem
                disableTransitionOnChange
                enableColorScheme
            >
                <Providers activeThemeValue={activeThemeValue as string}>
                    <ClientToaster />
                    <SidebarProvider defaultOpen={true}>
                        <AppSidebar/>
                        <FloatingSidebarTrigger />
                        <div className="w-full m-[10px]">
                            {children}
                        </div>
                    </SidebarProvider>
                </Providers>
            </ThemeProvider>
        </NuqsAdapter>
        </body>
        </html>
    );
}