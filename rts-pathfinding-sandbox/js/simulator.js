// Simulator — owns all state, drives the animation loop

class Simulator {
  constructor(canvas) {
    this.canvas   = canvas;
    this.renderer = new Renderer(canvas);

    // Map & path state
    this.map    = null;
    this.start  = null;
    this.goal   = null;
    this.result = null;   // { path, explored?, tree? }

    // Animation
    this.animating = false;
    this.animIdx   = 0;   // current segment index
    this.animT     = 0;   // progress along current segment [0,1]
    this.lastTime  = null;
    this.unitPos   = null;

    // Settings (mutated by UI)
    this.settings = {
      showExplored: true,
      showPath:     true,
      showTree:     false,
      speed:        180,   // px / second
    };

    this._rafId = null;
    this._loop  = this._loop.bind(this);
  }

  // ── public API ─────────────────────────────────────────────────────────────

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width;
    this.canvas.height = rect.height;
  }

  generateMap(numObstacles, seed) {
    this.resize();
    this.map    = GameMap.generate(this.canvas.width, this.canvas.height, numObstacles, seed);
    this.start  = { x: 60,                       y: this.canvas.height / 2 };
    this.goal   = { x: this.canvas.width - 60,   y: this.canvas.height / 2 };
    this.result = null;
    this.unitPos = Vec2.clone(this.start);
    this._resetAnim();
    this._render();
  }

  runPathfinder(name) {
    if (!this.map || !this.start || !this.goal) return null;
    const pf = PathfinderRegistry.getByName(name);
    if (!pf) return null;

    const t0 = performance.now();
    this.result = pf.findPath(this.start, this.goal, this.map);
    const elapsed = performance.now() - t0;

    this._resetAnim();
    this._render();
    return { result: this.result, elapsed };
  }

  play() {
    if (!this.result?.path || this.result.path.length < 2) return;
    this.animating = true;
    this.lastTime  = null;
    if (!this._rafId) this._rafId = requestAnimationFrame(this._loop);
  }

  pause() {
    this.animating = false;
  }

  resetAnim() {
    this._resetAnim();
    this._render();
  }

  setStart(p) {
    if (!this.map?.isPointClear(p, 4)) return false;
    this.start   = Vec2.clone(p);
    this.result  = null;
    this.unitPos = Vec2.clone(p);
    this._resetAnim();
    this._render();
    return true;
  }

  setGoal(p) {
    if (!this.map?.isPointClear(p, 4)) return false;
    this.goal   = Vec2.clone(p);
    this.result = null;
    this._resetAnim();
    this._render();
    return true;
  }

  // ── HUD stats ──────────────────────────────────────────────────────────────

  getStats(algorithmName) {
    const stats = { algorithm: algorithmName };
    if (this.result) {
      const p = this.result.path;
      if (p && p.length > 1) {
        let len = 0;
        for (let i = 1; i < p.length; i++) len += Vec2.dist(p[i - 1], p[i]);
        stats.pathLength = len;
        stats.waypoints  = p.length;
      }
      if (this.result.explored) stats.explored = this.result.explored.length;
      stats.status = p ? 'Path found' : 'No path';
    }
    return stats;
  }

  // ── private ────────────────────────────────────────────────────────────────

  _resetAnim() {
    this.animating = false;
    this.animIdx   = 0;
    this.animT     = 0;
    this.unitPos   = this.start ? Vec2.clone(this.start) : null;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _loop(ts) {
    if (!this.animating) { this._rafId = null; return; }

    if (this.lastTime != null) {
      const dt = Math.min((ts - this.lastTime) / 1000, 0.1); // cap at 100 ms
      this._advanceAnim(dt);
    }
    this.lastTime = ts;
    this._render();

    this._rafId = requestAnimationFrame(this._loop);
  }

  _advanceAnim(dt) {
    const path = this.result?.path;
    if (!path || path.length < 2) return;

    const speed = this.settings.speed;

    let remaining = speed * dt; // px to travel this frame

    while (remaining > 0 && this.animIdx < path.length - 1) {
      const from = path[this.animIdx];
      const to   = path[this.animIdx + 1];
      const segLen = Vec2.dist(from, to);

      if (segLen < 1e-6) { this.animIdx++; continue; }

      const left = segLen * (1 - this.animT); // px left in this segment

      if (remaining >= left) {
        remaining    -= left;
        this.animT    = 0;
        this.animIdx++;
      } else {
        this.animT   += remaining / segLen;
        remaining     = 0;
      }
    }

    if (this.animIdx >= path.length - 1) {
      this.animIdx   = path.length - 2;
      this.animT     = 1;
      this.animating = false;
      if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    }

    const from = path[this.animIdx];
    const to   = path[Math.min(this.animIdx + 1, path.length - 1)];
    this.unitPos = Vec2.lerp(from, to, Math.min(this.animT, 1));
  }

  _render() {
    if (!this.map) return;
    this.renderer.render({
      map:      this.map,
      result:   this.result,
      start:    this.start,
      goal:     this.goal,
      unitPos:  this.unitPos,
      settings: this.settings,
    });
  }
}
