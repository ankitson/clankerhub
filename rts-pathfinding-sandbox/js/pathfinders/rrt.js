// RRT — Rapidly-exploring Random Tree
//
// Sampling-based pathfinder. Non-optimal but works in high-dimensional spaces and
// produces interesting tree visualisations showing the exploration process.
// Uses goal-biased sampling to converge faster.

PathfinderRegistry.register({
  name: 'RRT',
  description: 'Sampling-based tree search. Non-optimal but visually rich — ' +
               'toggle "Show tree" to see the full exploration structure.',

  MAX_ITER:    4000,
  STEP:        25,     // max expansion distance per iteration (px)
  GOAL_BIAS:   0.15,   // probability of sampling the goal directly
  GOAL_RADIUS: 25,     // distance threshold to declare goal reached

  findPath(start, goal, map) {
    const { MAX_ITER, STEP, GOAL_BIAS, GOAL_RADIUS } = this;
    const CLEARANCE = 4;

    const nodes = [{ pos: Vec2.clone(start), parent: -1 }];

    for (let iter = 0; iter < MAX_ITER; iter++) {
      // Sample: goal-biased random point
      const target = Math.random() < GOAL_BIAS
        ? Vec2.clone(goal)
        : { x: Math.random() * map.width, y: Math.random() * map.height };

      // Nearest node in tree
      let nearIdx  = 0;
      let nearDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Vec2.dist(nodes[i].pos, target);
        if (d < nearDist) { nearDist = d; nearIdx = i; }
      }

      const nearest = nodes[nearIdx].pos;
      const dir     = Vec2.norm(Vec2.sub(target, nearest));
      const newPos  = Vec2.add(nearest, Vec2.scale(dir, Math.min(STEP, nearDist)));

      // Reject if new node is blocked
      if (!map.isPointClear(newPos, CLEARANCE)) continue;
      if (!map.isSegmentClear(nearest, newPos, CLEARANCE)) continue;

      const newIdx = nodes.length;
      nodes.push({ pos: newPos, parent: nearIdx });

      // Check if we can connect to goal
      if (Vec2.dist(newPos, goal) <= GOAL_RADIUS &&
          map.isSegmentClear(newPos, goal, CLEARANCE)) {
        nodes.push({ pos: Vec2.clone(goal), parent: newIdx });

        const path = [];
        let i = nodes.length - 1;
        while (i !== -1) { path.unshift(nodes[i].pos); i = nodes[i].parent; }

        const tree = nodes
          .filter(n => n.parent >= 0)
          .map(n => ({ from: nodes[n.parent].pos, to: n.pos }));

        return { path, explored: nodes.map(n => n.pos), tree };
      }
    }

    return null;
  },
});
