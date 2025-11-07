export class AABB {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;

    // Constructor overloads
    constructor(regionId: number);
    constructor(x: number, y: number);
    constructor(x: number, y: number, z: number);
    constructor(x1: number, y1: number, x2: number, y2: number);
    constructor(x1: number, y1: number, x2: number, y2: number, z: number);
    constructor(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number);
    constructor(...args: number[]) {
        if (args.length === 1) {
            const regionId = args[0];
            this.minX = (regionId >>> 8) << 6;
            this.minY = (regionId & 0xFF) << 6;
            this.maxX = this.minX + 63;
            this.maxY = this.minY + 63;
            this.minZ = Number.MIN_SAFE_INTEGER;
            this.maxZ = Number.MAX_SAFE_INTEGER;
        } else if (args.length === 2) {
            const [x, y] = args;
            this.minX = this.maxX = x;
            this.minY = this.maxY = y;
            this.minZ = Number.MIN_SAFE_INTEGER;
            this.maxZ = Number.MAX_SAFE_INTEGER;
        } else if (args.length === 3) {
            const [x, y, z] = args;
            this.minX = this.maxX = x;
            this.minY = this.maxY = y;
            this.minZ = this.maxZ = z;
        } else if (args.length === 4) {
            const [x1, y1, x2, y2] = args;
            this.minX = Math.min(x1, x2);
            this.minY = Math.min(y1, y2);
            this.maxX = Math.max(x1, x2);
            this.maxY = Math.max(y1, y2);
            this.minZ = Number.MIN_SAFE_INTEGER;
            this.maxZ = Number.MAX_SAFE_INTEGER;
        } else if (args.length === 5) {
            const [x1, y1, x2, y2, z] = args;
            this.minX = Math.min(x1, x2);
            this.minY = Math.min(y1, y2);
            this.maxX = Math.max(x1, x2);
            this.maxY = Math.max(y1, y2);
            this.minZ = this.maxZ = z;
        } else if (args.length === 6) {
            const [x1, y1, z1, x2, y2, z2] = args;
            this.minX = Math.min(x1, x2);
            this.minY = Math.min(y1, y2);
            this.minZ = Math.min(z1, z2);
            this.maxX = Math.max(x1, x2);
            this.maxY = Math.max(y1, y2);
            this.maxZ = Math.max(z1, z2);
        } else {
            throw new Error('Invalid number of arguments for AABB constructor');
        }
    }
}