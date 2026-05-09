// 2D vector math and geometric primitives

const Vec2 = {
  add(a, b)   { return { x: a.x + b.x, y: a.y + b.y }; },
  sub(a, b)   { return { x: a.x - b.x, y: a.y - b.y }; },
  scale(v, s) { return { x: v.x * s,   y: v.y * s   }; },
  dot(a, b)   { return a.x * b.x + a.y * b.y; },
  len(v)      { return Math.sqrt(v.x * v.x + v.y * v.y); },
  dist(a, b)  { return Vec2.len(Vec2.sub(b, a)); },
  norm(v)     { const l = Vec2.len(v); return l > 1e-10 ? Vec2.scale(v, 1 / l) : { x: 0, y: 0 }; },
  lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; },
  clone(v)    { return { x: v.x, y: v.y }; },
};

// Axis-aligned bounding box
class AABB {
  constructor(x, y, w, h) {
    this.x = x;  // left edge
    this.y = y;  // top edge
    this.w = w;
    this.h = h;
  }

  get right()  { return this.x + this.w; }
  get bottom() { return this.y + this.h; }
  get cx()     { return this.x + this.w / 2; }
  get cy()     { return this.y + this.h / 2; }

  get corners() {
    return [
      { x: this.x,       y: this.y        },
      { x: this.right,   y: this.y        },
      { x: this.right,   y: this.bottom   },
      { x: this.x,       y: this.bottom   },
    ];
  }

  // Returns new AABB expanded (or shrunk for negative margin) by margin on all sides
  expanded(margin) {
    return new AABB(this.x - margin, this.y - margin,
                    this.w + 2 * margin, this.h + 2 * margin);
  }

  containsPoint(p) {
    return p.x >= this.x && p.x <= this.right &&
           p.y >= this.y && p.y <= this.bottom;
  }

  containsPointStrict(p) {
    return p.x > this.x && p.x < this.right &&
           p.y > this.y && p.y < this.bottom;
  }

  overlaps(other) {
    return this.x < other.right  && this.right  > other.x &&
           this.y < other.bottom && this.bottom > other.y;
  }

  // Liang-Barsky parametric segment clipping.
  // Returns true if segment p1→p2 intersects (passes through) this AABB.
  intersectsSegment(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    let tmin = 0, tmax = 1;

    const clip = (p, q) => {
      if (Math.abs(p) < 1e-10) {
        return q >= 0; // parallel; q<0 means p1 is outside this boundary
      }
      const t = q / p;
      if (p < 0) { if (t > tmax) return false; if (t > tmin) tmin = t; }
      else        { if (t < tmin) return false; if (t < tmax) tmax = t; }
      return true;
    };

    return clip(-dx, p1.x - this.x)   &&
           clip( dx, this.right - p1.x) &&
           clip(-dy, p1.y - this.y)   &&
           clip( dy, this.bottom - p1.y);
  }
}

// Check if segment [p1,p2] is clear of all obstacles in an array
function segmentClearOf(p1, p2, obstacles) {
  for (const obs of obstacles) {
    if (obs.intersectsSegment(p1, p2)) return false;
  }
  return true;
}
