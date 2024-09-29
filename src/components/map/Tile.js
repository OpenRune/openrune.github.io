export class Tile {
  constructor(x, y, level = 0) {
    this.id = Tile.id(x, y, level);
  }

  get x() {
    return Tile.x(this.id);
  }

  get y() {
    return Tile.y(this.id);
  }

  get level() {
    return Tile.level(this.id);
  }

  get zone() {
    return new Zone(this.x >> 3, this.y >> 3, this.level);
  }

  get region() {
    return new Region(this.x >> 6, this.y >> 6);
  }

  get regionLevel() {
    return new RegionLevel(this.x >> 6, this.y >> 6, this.level);
  }

  copy(x = this.x, y = this.y, level = this.level) {
    return new Tile(x, y, level);
  }

  distanceTo(other, width, height) {
    return this.distanceTo(Distance.getNearest(other, width, height, this));
  }

  distanceToTile(other) {
    if (this.level !== other.level) {
      return -1;
    }
    return Distance.chebyshev(this.x, this.y, other.x, other.y);
  }

  within(other, radius) {
    return Distance.within(this.x, this.y, this.level, other.x, other.y, other.level, radius);
  }

  withinCoords(x, y, level, radius) {
    return Distance.within(this.x, this.y, this.level, x, y, level, radius);
  }

  toCuboid(width = 1, height = 1) {
    return new Cuboid(this, width, height, 1);
  }

  toCuboidRadius(radius) {
    return new Cuboid(this.minus(radius, radius), radius * 2 + 1, radius * 2 + 1, 1);
  }

  minus(x = 0, y = 0) {
    return this.copy(this.x - x, this.y - y);
  }

  toString() {
    return `Tile(${this.x}, ${this.y}, ${this.level})`;
  }

  static id(x, y, level = 0) {
    return (y & 0x3fff) + ((x & 0x3fff) << 14) + ((level & 0x3) << 28);
  }

  static x(id) {
    return (id >> 14) & 0x3fff;
  }

  static y(id) {
    return id & 0x3fff;
  }

  static level(id) {
    return (id >> 28) & 0x3;
  }

  static fromMap(map) {
    return new Tile(map.x, map.y, map.level || 0);
  }

  static index(x, y) {
    return (x & 0x7) | ((y & 0x7) << 3);
  }

  static indexWithLayer(x, y, layer) {
    return Tile.index(x, y) | ((layer & 0x7) << 6);
  }

  static indexX(index) {
    return index & 0x7;
  }

  static indexY(index) {
    return (index >> 3) & 0x7;
  }

  static indexLayer(index) {
    return (index >> 6) & 0x7;
  }
}

Tile.EMPTY = new Tile(0);

Tile.equals = function (tile, x = tile.x, y = tile.y, level = tile.level) {
  return tile.x === x && tile.y === y && tile.level === level;
};
