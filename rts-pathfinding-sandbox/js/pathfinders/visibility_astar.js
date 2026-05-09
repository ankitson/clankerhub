// Visibility Graph A*
//
// Builds a visibility graph from the corners of expanded obstacles, then runs A*.
// Produces optimal Euclidean-length paths for polygonal obstacles.

PathfinderRegistry.register({
  name: 'Visibility Graph A*',
  description: 'Optimal any-angle paths via visibility graph + A*. ' +
               'Nodes are obstacle corners; edges exist when two nodes can see each other.',

  findPath(start, goal, map) {
    const CLEARANCE = 6;
    const expanded  = map.obstacles.map(o => o.expanded(CLEARANCE));

    // Collect candidate waypoints: corners of expanded obstacles
    const waypoints = [Vec2.clone(start), Vec2.clone(goal)];

    for (let oi = 0; oi < expanded.length; oi++) {
      for (const corner of expanded[oi].corners) {
        // Skip corners outside the map
        if (corner.x < 0 || corner.x > map.width ||
            corner.y < 0 || corner.y > map.height) continue;
        // Skip corners that fall inside a different expanded obstacle
        if (expanded.some((o, j) => j !== oi && o.containsPointStrict(corner))) continue;
        waypoints.push(corner);
      }
    }

    const n = waypoints.length;

    // Build adjacency list (only bidirectional edges between mutually visible nodes)
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (segmentClearOf(waypoints[i], waypoints[j], expanded)) {
          const d = Vec2.dist(waypoints[i], waypoints[j]);
          adj[i].push({ to: j, cost: d });
          adj[j].push({ to: i, cost: d });
        }
      }
    }

    // A* — node 0 = start, node 1 = goal
    const gCost  = new Float64Array(n).fill(Infinity);
    const prev   = new Int32Array(n).fill(-1);
    gCost[0] = 0;

    // Simple binary-heap-less priority queue (fine for typical map sizes)
    const open   = [{ node: 0, f: Vec2.dist(start, goal) }];
    const closed = new Uint8Array(n);

    while (open.length > 0) {
      // Pop minimum-f entry
      let minIdx = 0;
      for (let k = 1; k < open.length; k++) {
        if (open[k].f < open[minIdx].f) minIdx = k;
      }
      const { node } = open[minIdx];
      open.splice(minIdx, 1);

      if (closed[node]) continue;
      closed[node] = 1;

      if (node === 1) {
        // Reconstruct path
        const path = [];
        let cur = 1;
        while (cur !== -1) { path.unshift(waypoints[cur]); cur = prev[cur]; }
        const explored = waypoints.filter((_, i) => closed[i]);
        return { path, explored };
      }

      for (const { to, cost } of adj[node]) {
        if (closed[to]) continue;
        const g = gCost[node] + cost;
        if (g < gCost[to]) {
          gCost[to] = g;
          prev[to]  = node;
          open.push({ node: to, f: g + Vec2.dist(waypoints[to], goal) });
        }
      }
    }

    return null;
  },
});
