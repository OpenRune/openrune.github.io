import type * as React from "react";

import {
  IconAdjustments,
  IconBinary,
  IconBox,
  IconBrandGoogleMaps,
  IconBuildingFortress,
  IconCardboards,
  IconChartBubble,
  IconChevronUp,
  IconCompass,
  IconDeviceDesktop,
  IconFileSettings,
  IconKeyframe,
  IconKeyframes,
  IconPackage,
  IconPhoto,
  IconPointer,
  IconTexture,
  IconUser,
} from "@tabler/icons-react";

import type { Section } from "./diff-types";

function SwordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.5 2.5l3 3" />
      <path d="M4 10l6.5-6.5 2 2L6 12" />
      <path d="M3 13l2-2" />
      <path d="M2.5 11.5l2 2" />
    </svg>
  );
}

function OverlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3" width="11" height="4" rx="1" />
      <rect x="2.5" y="9" width="11" height="4" rx="1" />
      <path d="M8 6v4" />
      <path d="M6.8 7.8L8 9l1.2-1.2" />
    </svg>
  );
}

function UnderlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3" width="11" height="4" rx="1" />
      <rect x="2.5" y="9" width="11" height="4" rx="1" />
      <path d="M8 10V6" />
      <path d="M6.8 7.2L8 6l1.2 1.2" />
    </svg>
  );
}

const DIFF_TYPE_ICON_OVERRIDES: Record<string, React.ReactElement> = {
  items: <SwordIcon />,
  objects: <IconBox size={16} />,
  param: <IconAdjustments size={16} />,
  npcs: <IconUser size={16} />,
  textures: <IconTexture size={16} />,
  inv: <IconBox size={16} />,
  sequences: <IconKeyframes size={16} />,
  spotanim: <IconKeyframe size={16} />,
  overlay: <OverlayIcon />,
  underlay: <UnderlayIcon />,
  sprites: <IconPhoto size={16} />,
  enum: <IconBinary size={16} />,
  healthbar: <IconChartBubble size={16} />,
  mapelement: <IconBrandGoogleMaps size={16} />,
  varp: <IconChevronUp size={16} />,
  varbit: <IconPointer size={16} />,
  worldentity: <IconBuildingFortress size={16} />,
  worldmaparea: <IconCompass size={16} />,
  struct: <IconCardboards size={16} />,
  varclan: <IconPackage size={16} />,
  varclient: <IconDeviceDesktop size={16} />,
};

export function DiffTypeIcon({ type }: { type: Section }) {
  return DIFF_TYPE_ICON_OVERRIDES[type.toLowerCase()] ?? <IconFileSettings size={16} />;
}
