import {
  IconBox,
  IconFileSettings,
  IconKeyframe,
  IconKeyframes,
  IconPackage,
  IconPhoto,
  IconStairs,
  IconTexture,
  IconUser,
} from "@tabler/icons-react";

import type { Section } from "./diff-types";

export function DiffTypeIcon({ type }: { type: Section }) {
  switch (type) {
    case "items":
      return <IconPackage size={16} />;
    case "npcs":
      return <IconUser size={16} />;
    case "textures":
      return <IconTexture size={16} />;
    case "inv":
      return <IconBox size={16} />;
    case "sequences":
      return <IconKeyframes size={16} />;
    case "spotanim":
      return <IconKeyframe size={16} />;
    case "overlay":
    case "underlay":
      return <IconStairs size={16} />;
    case "sprites":
      return <IconPhoto size={16} />;
    default:
      return <IconFileSettings size={16} />;
  }
}
