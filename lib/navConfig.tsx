import {
  IconHome,
  IconUser,
  IconFileSettings,
  IconTools,
  IconPhoto,
  Icon3dCubeSphere,
  IconStairs,
  IconTexture, IconPackage, IconCube, IconPalette, IconKeyframe, IconKeyframes, IconChartBar, IconMap
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export type NavPage = {
  label: string;
  path: string;
  icon?: ReactNode;
  requiresAuth?: boolean;
  usableOffline?: boolean; // Can be used when cache is offline
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
        icon: <IconCube size={18} />,
        requiresAuth: false,
      },
      {
        label: "Items",
        path: "/items",
        icon: <IconPackage size={18} />,
        requiresAuth: false,
      },
      {
        label: "Npcs",
        path: "/npcs",
        icon: <IconUser size={18} />,
        requiresAuth: false,
      },
      {
        label: "Textures",
        path: "/texures",
        icon: <IconTexture size={18} />,
        requiresAuth: false,
      },
      {
        label: "Sprites",
        path: "/sprites",
        icon: <IconPhoto size={18} />,
        requiresAuth: false,
      },
      {
        label: "Models",
        path: "/models",
        icon: <Icon3dCubeSphere size={18} />,
        requiresAuth: false,
      },
      {
        label: "Animations",
        path: "/animations",
        icon: <IconKeyframes size={18} />,
        requiresAuth: false,
      },
      {
        label: "Spot Animations",
        path: "/spotanims",
        icon: <IconKeyframe size={18} />,
        requiresAuth: false,
      },
      {
        label: "Overlay/Underlay",
        path: "/underlays-overlays",
        icon: <IconStairs size={18} />,
        requiresAuth: false,
      }
    ],
  },
  {
    label: "Tools",
    path: "/",
    icon: <IconTools size={18} />,
    requiresAuth: true,
    children: [
      {
        label: "Color Helper",
        path: "/colors",
        icon: <IconPalette size={18} />,
        requiresAuth: false,
        usableOffline: true,
      },
      {
        label: "117 Performance",
        path: "/117performance",
        icon: <IconChartBar size={18} />,
        requiresAuth: false,
        usableOffline: true,
      },
      {
        label: "Model Viewer",
        path: "/modelview",
        icon: <Icon3dCubeSphere size={18} />,
        requiresAuth: false,
      }
    ],
  },
  {
    label: "Map",
    path: "/map",
    icon: <IconMap size={18} />,
    requiresAuth: false,
    usableOffline: true,
  }
]; 