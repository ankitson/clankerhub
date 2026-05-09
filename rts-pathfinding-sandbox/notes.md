# RTS Pathfinding Sandbox — Development Notes

## Goal
Build an interactive browser-based sandbox to visualize and compare pathfinding algorithms
for RTS-style games. Obstacles are axis-aligned rectangles (AABBs), units move freely
(not grid-locked), and new algorithms can be plugged in as modular JS objects.

## Architecture Decisions

### Coordinate system
- Canvas pixel space = map space. No separate "world" coordinates.
- Map size tracks canvas size (updated on resize).

### Obstacle representation
- `AABB` class: x, y, w, h (top-left origin).
- Liang-Barsky segment–AABB intersection for correctness at edges/corners.

### Pathfinder interface
```
{
  name: string,
  description: string,
  findPath(start, goal, map) → { path, explored?, tree? } | null
}
```
- `path`: array of {x,y} waypoints (unit moves straight between consecutive pairs)
- `explored`: optional array of {x,y} visited nodes for visualization
- `tree`: optional array of {from,to} edges (for RRT tree drawing)
- Return `null` if no path exists.

### Clearance
Each pathfinder handles its own obstacle padding/expansion for unit clearance.
`AABB.expanded(margin)` returns a new AABB inflated by `margin` on all sides.
Map's `isSegmentClear` / `isPointClear` accept an optional `margin` parameter.

## Algorithms Implemented
1. **Visibility Graph A*** — builds visibility graph from AABB corners + start/goal,
   runs A* for optimal Euclidean paths. Classic approach for polygonal obstacles.
2. **Grid A*** — rasterizes obstacles to grid, 8-directional movement.
   Shows characteristic "diagonal staircase" artifact of grid-based approaches.
3. **Theta*** — grid-based but checks line-of-sight during relaxation, producing
   any-angle paths with much smoother curves than Grid A*.
4. **RRT** — sampling-based with goal bias. Non-optimal but interesting visuals,
   shows exploration tree.

## Key files
- `js/geometry.js` — Vec2, AABB, segment intersection
- `js/map.js` — GameMap class, obstacle generation
- `js/pathfinders/registry.js` — plugin registration system
- `js/pathfinders/*.js` — individual algorithm implementations
- `js/renderer.js` — Canvas 2D rendering
- `js/simulator.js` — animation loop, state management
- `js/ui.js` — DOM event wiring
- `index.html` — layout and script loading order
- `style.css` — Catppuccin Mocha dark theme

## Notes & Learnings
- Liang-Barsky: initializing tmin=0, tmax=1 automatically clamps to segment range,
  no separate out-of-range check needed.
- Theta* improvement over Grid A*: by checking line-of-sight to grandparent during
  relaxation, it effectively smooths the path for free.
- Visibility graph can fail if start/goal is inside an obstacle; handle gracefully.
- RRT step size of 25px with goal bias 0.15 gives good exploration/exploitation balance.
- Grid cell size 20px: fine enough for typical obstacle sizes, fast enough.
