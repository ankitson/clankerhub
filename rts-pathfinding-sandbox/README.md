# RTS Pathfinding Sandbox

An interactive browser sandbox for experimenting with pathfinding algorithms on
maps with axis-aligned rectangular obstacles — the kind found in RTS games like
Age of Empires.

Open `index.html` directly in a browser (no build step, no server required).

---

## Features

| Feature | Detail |
|---|---|
| **Random map generation** | Seeded or random placement of non-overlapping AABB obstacles |
| **Free-angle movement** | Units move in straight lines between waypoints, not locked to grid |
| **4 built-in algorithms** | Visibility Graph A\*, Grid A\*, Theta\*, RRT |
| **Pluggable modules** | Drop in a new JS file + one `register()` call to add your own |
| **Live visualization** | Explored nodes, path, RRT exploration tree, all toggleable |
| **Animated unit** | Smooth movement along the found path at adjustable speed |
| **Click-to-place** | Set start / goal anywhere on the map with a click |

---

## Algorithms

### Visibility Graph A\*
Builds a visibility graph whose nodes are the corners of obstacle bounding boxes
(expanded by a clearance margin). Two nodes share an edge when they have unobstructed
line-of-sight. A\* finds the shortest Euclidean path through this graph.

- ✅ Optimal Euclidean path
- ✅ Any-angle — no grid artifacts
- ⚠️ O(n³) graph construction; fine for ≤30 obstacles

### Grid A\*
Rasterizes all obstacles onto a uniform 20 px cell grid, then runs A\* with
8-directional movement.

- ✅ Very fast, simple to understand
- ⚠️ Paths show characteristic diagonal staircase artifacts
- ⚠️ Resolution limited by cell size

### Theta\*
Identical setup to Grid A\*, but during neighbour relaxation it checks whether
the current node's *parent* has line-of-sight to the neighbour. If so, it
bypasses the intermediate cell. Produces near-optimal smooth paths with no
post-processing.

- ✅ Any-angle quality paths
- ✅ Only slightly slower than Grid A\*
- Reference: Daniel, Nash et al. *JAIR 2010*

### RRT (Rapidly-exploring Random Tree)
Samples random points in free space, grows a tree toward them, and connects to
the goal when close enough. Goal-biased sampling (15% chance) keeps convergence
fast. Toggle **Show RRT tree** to see the full exploration structure.

- ✅ Works in any continuous space
- ✅ Rich tree visualization
- ⚠️ Non-optimal, probabilistically complete, slightly different result each run

---

## Adding Your Own Algorithm

1. Create `js/pathfinders/my_algo.js`
2. Implement and register:

```javascript
PathfinderRegistry.register({
  name: 'My Algorithm',
  description: 'One-sentence description shown in the UI.',

  findPath(start, goal, map) {
    // start, goal: { x, y }
    // map.width, map.height
    // map.obstacles: Array<AABB>
    // map.isPointClear(p, margin?)   → boolean
    // map.isSegmentClear(p1,p2,margin?) → boolean
    // AABB.expanded(margin) → new AABB padded by margin
    // Vec2: .add .sub .scale .dist .norm .lerp .len (see geometry.js)

    // Return null if no path exists, otherwise:
    return {
      path:     [ /* {x,y}, ... */ ],   // required: waypoints
      explored: [ /* {x,y}, ... */ ],   // optional: visited nodes
      tree:     [ /* {from,to}, ... */], // optional: graph edges
    };
  },
});
```

3. Add a `<script>` tag in `index.html` **before** `simulator.js`:

```html
<script src="js/pathfinders/my_algo.js"></script>
```

That's it — your algorithm will appear in the dropdown immediately.

---

## File Structure

```
rts-pathfinding-sandbox/
├── index.html                     # Entry point — also documents script load order
├── style.css                      # Catppuccin Mocha dark theme
├── js/
│   ├── geometry.js                # Vec2, AABB, Liang-Barsky segment test
│   ├── map.js                     # GameMap class, seeded random map generation
│   ├── renderer.js                # Canvas 2D rendering (all draw calls live here)
│   ├── simulator.js               # State, animation loop, public API for UI
│   ├── ui.js                      # DOM event wiring
│   └── pathfinders/
│       ├── registry.js            # PathfinderRegistry — plugin registration
│       ├── visibility_astar.js    # Visibility graph A*
│       ├── grid_astar.js          # Grid-based A*
│       ├── theta_star.js          # Theta* (any-angle grid)
│       └── rrt.js                 # RRT
└── notes.md                       # Development notes
```

---

## Implementation Notes

**Segment–AABB intersection** uses the Liang-Barsky parametric clipping algorithm.
Initialising `tmin=0, tmax=1` automatically clamps the test to the segment range,
so a single `tmin ≤ tmax` comparison gives the answer. Touching the boundary
(t = 0 or t = 1 exactly) counts as intersection, which correctly blocks paths
that graze obstacle edges.

**Clearance** is handled per-algorithm via `AABB.expanded(margin)`. Each algorithm
chooses its own margin (typically 5–6 px). This keeps the `GameMap` data pure and
lets algorithms with different unit radii coexist.

**Animation** advances by tracking `(segmentIndex, t)` and converting wall-clock
delta time into pixels-travelled at the configured speed. Remaining distance spills
across segment boundaries within a single frame for smooth constant-speed movement.
