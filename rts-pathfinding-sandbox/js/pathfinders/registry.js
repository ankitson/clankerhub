// Pathfinder plugin registry.
//
// To add a new algorithm, create a JS file with an object implementing:
//
//   {
//     name: string,
//     description: string,
//     findPath(start, goal, map) → Result | null
//   }
//
// Where Result = {
//   path:     Array<{x,y}>,   // waypoints; unit travels straight between consecutive pairs
//   explored: Array<{x,y}>,   // (optional) nodes visited during search, for visualization
//   tree:     Array<{from:{x,y}, to:{x,y}}>, // (optional) graph edges (RRT, etc.)
// }
//
// Return null if no path was found.
//
// Then call: PathfinderRegistry.register(myAlgorithm)
// And include your script BEFORE simulator.js in index.html.
//
// The map object exposes:
//   map.width, map.height
//   map.obstacles          — Array<AABB>
//   map.isPointClear(p, margin?)   — boolean
//   map.isSegmentClear(p1, p2, margin?) — boolean
//   AABB.expanded(margin)  — returns a new AABB padded by margin on all sides
//
// Vec2 utilities are available globally (see geometry.js).

const PathfinderRegistry = (() => {
  const _list = [];
  return {
    register(pf)      { _list.push(pf); },
    getAll()          { return [..._list]; },
    getByName(name)   { return _list.find(p => p.name === name) || null; },
    getByIndex(i)     { return _list[i] || null; },
    count()           { return _list.length; },
  };
})();
