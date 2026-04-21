import type { Metadata } from "next";
import { Cinzel, Geist_Mono, Inter } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  /** Serif is rare on most routes; avoid competing with Inter on the critical path. */
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "OpenRune",
    template: "%s · OpenRune",
  },
  description:
    "RuneScape-inspired developer tooling — configs, maps, utilities, and more.",
  icons: {
    icon: [{ url: "/favicon.ico?v=2", type: "image/x-icon" }],
    shortcut: [{ url: "/favicon.ico?v=2", type: "image/x-icon" }],
    apple: [{ url: "/favicon.ico?v=2" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} ${cinzel.variable} font-sans antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
