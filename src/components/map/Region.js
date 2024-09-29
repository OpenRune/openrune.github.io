export const Region = (id) => {
  const x = id >> 8;
  const y = id & 0xff;

  const tile = () => ({ x: x << 6, y: y << 6, level: 0 });

  const add = (xAdd, yAdd) => Region(Region.id(x + xAdd, y + yAdd));
  const minus = (xSub = 0, ySub = 0) => add(-xSub, -ySub);
  const delta = (xDelta = 0, yDelta = 0) => ({ x: x - xDelta, y: y - yDelta });

  return {
    id,
    x,
    y,
    tile,
    add,
    minus,
    delta,
    toLevel: (level) => ({ x, y, level }),
    offset: (region) => ({
      x: (x << 6) - (region.x << 6),
      y: (y << 6) - (region.y << 6),
    }),
  };
};

Region.id = (x, y) => (y & 0xff) + ((x & 0xff) << 8);
Region.EMPTY = Region(0);
