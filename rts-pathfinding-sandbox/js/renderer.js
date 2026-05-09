// Canvas 2D renderer — all drawing lives here

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  }

  render(state) {
    const { ctx }  = this;
    const { map, result, start, goal, unitPos, settings, highlightCell } = state;
    const W = this.canvas.width, H = this.canvas.height;

    // Background
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, W, H);

    this._drawGrid(W, H);
    this._drawObstacles(map.obstacles);

    if (result) {
      if (settings.showExplored && result.explored?.length) this._drawExplored(result.explored);
      if (settings.showTree    && result.tree?.length)      this._drawTree(result.tree);
      if (settings.showPath    && result.path?.length > 1)  this._drawPath(result.path);
    }

    this._drawMarker(start, '#a6e3a1', 'S');
    this._drawMarker(goal,  '#f38ba8', 'G');

    if (unitPos) this._drawUnit(unitPos);
  }

  // ── private ────────────────────────────────────────────────────────────────

  _drawGrid(W, H) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    const step = 40;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  _drawObstacles(obstacles) {
    const { ctx } = this;
    for (const obs of obstacles) {
      // Fill
      ctx.fillStyle = '#313244';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      // Border
      ctx.strokeStyle = '#585b70';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(obs.x + 0.5, obs.y + 0.5, obs.w - 1, obs.h - 1);
      // Inner highlight (top edge)
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(obs.x + 2, obs.y + 1.5);
      ctx.lineTo(obs.x + obs.w - 2, obs.y + 1.5);
      ctx.stroke();
    }
  }

  _drawExplored(explored) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(249,226,175,0.18)';
    for (const p of explored) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawTree(tree) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(203,166,247,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (const { from, to } of tree) {
      if (!from) continue;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
  }

  _drawPath(path) {
    const { ctx } = this;

    // Glow / shadow
    ctx.shadowColor = '#89b4fa';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Waypoint dots
    ctx.fillStyle = '#b4befe';
    for (let i = 1; i < path.length - 1; i++) {
      ctx.beginPath();
      ctx.arc(path[i].x, path[i].y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMarker(p, color, label) {
    const { ctx } = this;
    const R = 12;

    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;

    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fillStyle   = color + '33'; // translucent fill
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle  = color;
    ctx.font       = 'bold 11px monospace';
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y);
  }

  _drawUnit(pos) {
    const { ctx } = this;
    const R = 8;

    // Direction chevron shadow
    ctx.shadowColor = '#fab387';
    ctx.shadowBlur  = 16;

    // Outer ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(250,179,135,0.35)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Core
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
    ctx.fillStyle = '#fab387';
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // Draw a simple legend / info overlay in top-right
  drawHUD(stats) {
    const { ctx } = this;
    const W = this.canvas.width;
    const lines = [];
    if (stats.algorithm)   lines.push(stats.algorithm);
    if (stats.pathLength != null) lines.push(`Path: ${stats.pathLength.toFixed(0)} px`);
    if (stats.explored    != null) lines.push(`Explored: ${stats.explored}`);
    if (stats.status)      lines.push(stats.status);

    if (!lines.length) return;

    const PAD = 8, LH = 16;
    const boxW = 200, boxH = lines.length * LH + PAD * 2;
    const bx = W - boxW - 10, by = 10;

    ctx.fillStyle = 'rgba(30,30,46,0.82)';
    ctx.strokeStyle = '#45475a';
    ctx.lineWidth = 1;
    this._roundRect(bx, by, boxW, boxH, 4);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle    = '#cdd6f4';
    ctx.font         = '12px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + PAD, by + PAD + i * LH));
  }

  _roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
