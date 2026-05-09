// Theta*
//
// Grid-based any-angle pathfinding. Like Grid A*, but during neighbour relaxation
// it checks if the grandparent has line-of-sight to the neighbour and skips the
// intermediate cell if so. Produces smooth paths without post-processing.
//
// Reference: Daniel, Nash, et al. "Theta*: Any-Angle Path Planning on Grids" (2010)

PathfinderRegistry.register({
  name: 'Theta*',
  description: 'Any-angle grid pathfinding. Checks line-of-sight to grandparent ' +
               'during relaxation, producing smoother paths than Grid A* for free.',

  CELL: 20,

  findPath(start, goal, map) {
    const CELL      = this.CELL;
    const CLEARANCE = 5;
    const cols      = Math.ceil(map.width  / CELL);
    const rows      = Math.ceil(map.height / CELL);

    const blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
        for (const obs of map.obstacles) {
          if (obs.expanded(CLEARANCE).containsPoint(p)) { blocked[r * cols + c] = 1; break; }
        }
      }
    }

    const g2w = (c, r) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL });
    const w2g = p  => ({ c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) });
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

    const los = (c1, r1, c2, r2) =>
      map.isSegmentClear(g2w(c1, r1), g2w(c2, r2), CLEARANCE);

    const DIRS = [
      { dc:  1, dr:  0 }, { dc: -1, dr:  0 },
      { dc:  0, dr:  1 }, { dc:  0, dr: -1 },
      { dc:  1, dr:  1 }, { dc: -1, dr:  1 },
      { dc:  1, dr: -1 }, { dc: -1, dr: -1 },
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

      for (const { dc, dr } of DIRS) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const ni = idx(nc, nr);
        if (closed[ni] || blocked[ni]) continue;

        // Theta*: try to link neighbour directly to cur's parent (grandparent shortcut)
        const pi = prev[ci];
        let bestG, bestPrev;

        if (pi >= 0) {
          const pc = pi % cols, pr = Math.floor(pi / cols);
          if (los(pc, pr, nc, nr)) {
            const g = gCost[pi] + Vec2.dist(g2w(pc, pr), g2w(nc, nr));
            bestG = g; bestPrev = pi;
          }
        }

        // Fall back to normal A* relaxation if LOS not available
        if (bestG === undefined || gCost[ci] + Vec2.dist(g2w(cur.c, cur.r), g2w(nc, nr)) < bestG) {
          bestG    = gCost[ci] + Vec2.dist(g2w(cur.c, cur.r), g2w(nc, nr));
          bestPrev = ci;
        }

        if (bestG < gCost[ni]) {
          gCost[ni] = bestG;
          prev[ni]  = bestPrev;
          open.push({ c: nc, r: nr, f: bestG + h(nc, nr) });
        }
      }
    }

    return null;
  },
});
