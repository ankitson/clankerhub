// GameMap: obstacle layout and spatial queries

class GameMap {
  constructor(width, height, obstacles) {
    this.width     = width;
    this.height    = height;
    this.obstacles = obstacles; // Array<AABB>
  }

  // True if point p is not inside any obstacle (and within map bounds with given margin).
  isPointClear(p, margin = 0) {
    if (p.x < margin || p.y < margin ||
        p.x > this.width - margin || p.y > this.height - margin) return false;
    for (const obs of this.obstacles) {
      const check = margin > 0 ? obs.expanded(margin) : obs;
      if (check.containsPoint(p)) return false;
    }
    return true;
  }

  // True if segment p1→p2 does not pass through any obstacle.
  // Optional margin expands each obstacle before checking.
  isSegmentClear(p1, p2, margin = 0) {
    for (const obs of this.obstacles) {
      const check = margin > 0 ? obs.expanded(margin) : obs;
      if (check.intersectsSegment(p1, p2)) return false;
    }
    return true;
  }

  // Generate a random map. Uses an LCG seeded RNG if seed is provided.
  static generate(width, height, numObstacles, seed = null) {
    const rand = seed != null ? lcgRandom(seed) : () => Math.random();
    const obstacles = [];

    const mapMargin = 50;   // keep obstacles away from map edge
    const obsMargin = 12;   // minimum gap between obstacles
    const minW = 35, maxW = 110;
    const minH = 25, maxH = 90;
    const maxAttempts = numObstacles * 20;

    for (let attempts = 0; obstacles.length < numObstacles && attempts < maxAttempts; attempts++) {
      const w = minW + rand() * (maxW - minW);
      const h = minH + rand() * (maxH - minH);
      const x = mapMargin + rand() * (width  - w - mapMargin * 2);
      const y = mapMargin + rand() * (height - h - mapMargin * 2);
      const candidate = new AABB(x, y, w, h);
      const padded    = candidate.expanded(obsMargin);

      if (!obstacles.some(o => o.overlaps(padded))) {
        obstacles.push(candidate);
      }
    }

    return new GameMap(width, height, obstacles);
  }
}

function lcgRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
