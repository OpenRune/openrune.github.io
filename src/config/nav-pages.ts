import type { LucideIcon } from "lucide-react";

import { DIFF_ROUTE_DIFFVIEW, DIFF_ROUTE_FULL } from "@/components/diff/diff-constants";
import {
  BarChart3,
  Database,
  GitMerge,
  Home,
  Map,
  Palette,
  Wrench as Tools,
} from "lucide-react";

export type NavPage = {
  label: string;
  path: string;
  icon: LucideIcon;
  usableOffline?: boolean;
  requiresOnline?: boolean;
  children?: NavPage[];
};

export function canUsePageOffline(page: NavPage): boolean {
  if (typeof page.usableOffline === "boolean") {
    return page.usableOffline;
  }

  return page.requiresOnline !== true;
}

export function flattenNavPages(pages: NavPage[]): NavPage[] {
  return pages.flatMap((page) =>
    page.children?.length ? [page, ...flattenNavPages(page.children)] : [page],
  );
}

export function getLeafNavPages(pages: NavPage[]): NavPage[] {
  return flattenNavPages(pages).filter((page) => !page.children?.length);
}

export function findLeafNavPageByPath(pathname: string): NavPage | undefined {
  return getLeafNavPages(NAV_PAGES).find((page) => {
    if (page.path === DIFF_ROUTE_FULL) {
      return (
        pathname === DIFF_ROUTE_FULL ||
        pathname === "/diff" ||
        pathname === DIFF_ROUTE_DIFFVIEW ||
        pathname.startsWith(`${DIFF_ROUTE_DIFFVIEW}/`)
      );
    }
    return page.path === pathname;
  });
}

export const NAV_PAGES: NavPage[] = [
  {
    label: "Home",
    path: "/",
    icon: Home,
    usableOffline: true,
  },
  {
    label: "Cache Archive",
    path: "/cache-archive",
    icon: Database,
    usableOffline: true,
  },
  {
    label: "Configs / Diff",
    path: "/diff/full",
    icon: GitMerge,
    requiresOnline: true,
  },
  {
    label: "Tools",
    path: "/",
    icon: Tools,
    children: [
      {
        label: "Color Helper",
        path: "/colors",
        icon: Palette,
        usableOffline: true,
      },
      {
        label: "117 Performance",
        path: "/117performance",
        icon: BarChart3,
        usableOffline: true,
      },
    ],
  },
  {
    label: "Map",
    path: "/map",
    icon: Map,
    requiresOnline: true,
  },
];
