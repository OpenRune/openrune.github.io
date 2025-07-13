import { IconHome, IconUser, IconFileSettings, IconCreditCard } from "@tabler/icons-react";
import type { ReactNode } from "react";

export type NavPage = {
  label: string;
  path: string;
  icon?: ReactNode;
  requiresAuth?: boolean;
  children?: NavPage[];
};

export const NAV_PAGES: NavPage[] = [
  {
    label: "Home",
    path: "/",
    icon: <IconHome size={18} />,
    requiresAuth: false,
  },
  {
    label: "Configs",
    path: "/",
    icon: <IconFileSettings size={18} />,
    requiresAuth: true,
    children: [
      {
        label: "Objects",
        path: "/objects",
        requiresAuth: false,
      },
      {
        label: "Items",
        path: "/items",
        requiresAuth: false,
      },
      {
        label: "Npcs",
        path: "/npcs",
        requiresAuth: false,
      },
      {
        label: "Textures",
        path: "/texures",
        requiresAuth: false,
      },
      {
        label: "Sprites",
        path: "/sprites",
        requiresAuth: false,
      }
    ],
  }
]; 