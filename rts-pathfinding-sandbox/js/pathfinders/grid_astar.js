// Grid A*
//
// Rasterizes obstacles onto a uniform grid, then runs A* with 8-directional movement.
// Shows the characteristic "staircase" diagonal artifact of grid-based approaches.

PathfinderRegistry.register({
  name: 'Grid A*',
  description: 'Classic grid-based A* with 8-directional movement. ' +
               'Fast and simple, but produces grid-aligned paths with visible stair-step artifacts.',

  CELL: 20,

  findPath(start, goal, map) {
    const CELL     = this.CELL;
    const CLEARANCE = 5;
    const cols     = Math.ceil(map.width  / CELL);
    const rows     = Math.ceil(map.height / CELL);

    // Rasterize obstacles: mark cells whose centre falls inside any expanded obstacle
    const blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
        for (const obs of map.obstacles) {
          if (obs.expanded(CLEARANCE).containsPoint(p)) { blocked[r * cols + c] = 1; break; }
        }
      }
    }

    const w2g = p => ({ c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) });
    const g2w = (c, r) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL });
    const idx  = (c, r) => r * cols + c;

    const startG = w2g(start);
    const goalG  = w2g(goal);

    if (blocked[idx(startG.c, startG.r)] || blocked[idx(goalG.c, goalG.r)]) return null;

    const gCost  = new Float32Array(cols * rows).fill(Infinity);
    const prev   = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    gCost[idx(startG.c, startG.r)] = 0;

    const h = (c, r) => Vec2.dist(g2w(c, r), goal);
    const open = [{ c: startG.c, r: startG.r, f: h(startG.c, startG.r) }];

    const DIRS = [
      { dc:  1, dr:  0, cost: CELL },
      { dc: -1, dr:  0, cost: CELL },
      { dc:  0, dr:  1, cost: CELL },
      { dc:  0, dr: -1, cost: CELL },
      { dc:  1, dr:  1, cost: CELL * Math.SQRT2 },
      { dc: -1, dr:  1, cost: CELL * Math.SQRT2 },
      { dc:  1, dr: -1, cost: CELL * Math.SQRT2 },
      { dc: -1, dr: -1, cost: CELL * Math.SQRT2 },
    ];

    while (open.length > 0) {
      let minIdx = 0;
      for (let k = 1; k < open.length; k++) {
        if (open[k].f < open[minIdx].f) minIdx = k;
      }
      const cur = open[minIdx];
      open.splice(minIdx, 1);

      const ci = idx(cur.c, cur.r);
      if (closed[ci]) continue;
      closed[ci] = 1;

      if (cur.c === goalG.c && cur.r === goalG.r) {
        const path = [];
        let i = idx(goalG.c, goalG.r);
        while (i !== -1) {
          path.unshift(g2w(i % cols, Math.floor(i / cols)));
          i = prev[i];
        }
        path[0] = Vec2.clone(start);
        path[path.length - 1] = Vec2.clone(goal);

        const explored = [];
        for (let j = 0; j < cols * rows; j++) {
          if (closed[j]) explored.push(g2w(j % cols, Math.floor(j / cols)));
        }
        return { path, explored };
      }

      for (const { dc, dr, cost } of DIRS) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const ni = idx(nc, nr);
        if (closed[ni] || blocked[ni]) continue;

        const g = gCost[ci] + cost;
        if (g < gCost[ni]) {
          gCost[ni] = g;
          prev[ni]  = ci;
          open.push({ c: nc, r: nr, f: g + h(nc, nr) });
        }
      }
    }

    return null;
  },
});
