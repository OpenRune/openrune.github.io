// Image URL constants
export const IMAGE_URLS = {
  object: (id: string | number) => `https://chisel.weirdgloop.org/static/img/osrs-object/${String(id)}_orient1.png`,
  npc: (id: string | number) => `https://chisel.weirdgloop.org/static/img/osrs-npc/${String(id)}_128.png`,
  sprite: (id: string | number) => `https://chisel.weirdgloop.org/static/img/osrs-sprite/${String(id)}.png`,
  fallback: 'https://oldschool.runescape.wiki/images/Bank_filler_detail.png?7d983',
} as const;


