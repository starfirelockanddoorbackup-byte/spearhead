'use strict';
/* SPEARHEAD // world — map, nav grid, cover, line of sight, visibility polygons */
const OT = {
  wall:  { cover: 1,  sight: 1, bullet: 1, walk: 0,  h: 2.4, n: 'Wall' },
  bldg:  { cover: 1,  sight: 1, bullet: 1, walk: 0,  h: 4.5, n: 'Building' },
  door:  { cover: 1,  sight: 1, bullet: 1, walk: 0,  h: 2.4, n: 'Steel door' },
  wreck: { cover: 1,  sight: 1, bullet: 1, walk: 0,  h: 1.6, n: 'Vehicle wreck' },
  sand:  { cover: .5, sight: 0, bullet: 0, walk: 0,  h: .9,  n: 'Sandbags' },
  crate: { cover: .5, sight: 0, bullet: 0, walk: 0,  h: 1.1, n: 'Crates' },
  brush: { cover: 0,  sight: 1, bullet: 0, walk: .6, h: 1.4, n: 'Brush', conceal: 1 },
  floor: { cover: 0,  sight: 0, bullet: 0, walk: 1,  h: 0,   n: 'Floor' }
};
const NAV_CS = .5, NAV_PAD = .35;

/* Liang–Barsky: does segment a→b cross rect o (with pad)? returns [t0,t1] or null */
function clipRect(ax, ay, bx, by, o, pad = 0) {
  const dx = bx - ax, dy = by - ay, x0 = o.x - pad, y0 = o.y - pad, x1 = o.x + o.w + pad, y1 = o.y + o.h + pad;
  let t0 = 0, t1 = 1; const p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return null; } else { const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } } }
  return [t0, t1];
}

class World {
  constructor(m) {
    this.W = m.W; this.H = m.H; this.night = !!m.night;
    this.obs = (m.map || []).map(o => Object.assign({}, o)).filter(o => o.w > .2 || o.h > .2);
    this.hills = (m.hills || []).map(h => Object.assign({}, h));
    this.zones = JSON.parse(JSON.stringify(m.zones || {}));
    this.smokes = []; this.flares = [];
    this.rebuild();
  }
  rebuild() {
    for (const o of this.obs) o.p = OT[o.t] || OT.wall;
    this.solid = this.obs.filter(o => o.p.sight && !o.p.conceal && !o.open);   // blocks sight completely
    this.bulletB = this.obs.filter(o => o.p.bullet && !o.open);
    this.brush = this.obs.filter(o => o.p.conceal);
    this.coverObs = this.obs.filter(o => o.p.cover > 0 && !o.open);
    this.segs = []; for (const o of this.solid) for (const s of rectSegs(o)) this.segs.push(s);
    this.buildNav(); this.buildCoverNodes(); this.groundCache = null;
  }
  buildNav() {
    const w = Math.ceil(this.W / NAV_CS), h = Math.ceil(this.H / NAV_CS), cost = new Float32Array(w * h).fill(1);
    for (const o of this.obs) {
      if (o.open || o.t === 'floor') continue;
      const pad = o.p.walk ? 0 : NAV_PAD;
      const x0 = Math.max(0, Math.floor((o.x - pad) / NAV_CS)), x1 = Math.min(w - 1, Math.floor((o.x + o.w + pad) / NAV_CS));
      const y0 = Math.max(0, Math.floor((o.y - pad) / NAV_CS)), y1 = Math.min(h - 1, Math.floor((o.y + o.h + pad) / NAV_CS));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (!o.p.walk) cost[i] = 0; else if (cost[i] > 0) cost[i] = Math.max(cost[i], 1 / o.p.walk); }
    }
    this.nav = { w, h, cs: NAV_CS, cost };
  }
  walkable(x, y) { const g = this.nav, gx = Math.floor(x / g.cs), gy = Math.floor(y / g.cs); return gx >= 0 && gy >= 0 && gx < g.w && gy < g.h && g.cost[gy * g.w + gx] > 0; }
  inBrush(x, y) { return this.brush.some(o => ptInRect(x, y, o)); }
  buildCoverNodes() {
    const N = [];
    for (const o of this.coverObs) {
      const off = .75, step = 1.1;
      const add = (x, y, nx, ny) => { if (x > .5 && y > .5 && x < this.W - .5 && y < this.H - .5 && this.walkable(x, y)) N.push({ x, y, o, nx, ny, cov: o.p.cover }); };
      for (let s = .4; s <= o.w - .4 + 1e-6; s += step) { add(o.x + s, o.y - off, 0, -1); add(o.x + s, o.y + o.h + off, 0, 1); }
      for (let s = .4; s <= o.h - .4 + 1e-6; s += step) { add(o.x - off, o.y + s, -1, 0); add(o.x + o.w + off, o.y + s, 1, 0); }
      if (o.w < 1) { add(o.x + o.w / 2, o.y - off, 0, -1); add(o.x + o.w / 2, o.y + o.h + off, 0, 1); }
      if (o.h < 1) { add(o.x - off, o.y + o.h / 2, -1, 0); add(o.x + o.w + off, o.y + o.h / 2, 1, 0); }
    }
    this.coverNodes = N;
  }
  elev(x, y) { for (const h of this.hills) if (Math.hypot(x - h.x, y - h.y) < h.r) return 1; return 0; }
  /* cover a unit at (x,y) has against a shot from (sx,sy): 0, .5 or 1 */
  coverAt(x, y, sx, sy) {
    let best = 0;
    for (const o of this.coverObs) {
      if (o.p.cover <= best) continue;
      const dx = Math.max(o.x - x, 0, x - (o.x + o.w)), dy = Math.max(o.y - y, 0, y - (o.y + o.h));
      if (dx * dx + dy * dy > 1.5 * 1.5) continue;
      if (clipRect(x, y, sx, sy, o)) best = o.p.cover;
    }
    return best;
  }
  /* bullets: blocked by solid bullet-stoppers (not sandbags/crates, those are handled as cover) */
  shotClear(ax, ay, bx, by) {
    for (const o of this.bulletB) { const c = clipRect(ax, ay, bx, by, o, -.05); if (c && c[0] > .001 && c[0] < .999) return false; }
    return true;
  }
  /* sight: solid blockers, smoke, and deep brush (concealment) */
  sightClear(ax, ay, bx, by) {
    for (const o of this.solid) { const c = clipRect(ax, ay, bx, by, o, -.05); if (c && c[0] > .001 && c[0] < .999) return false; }
    for (const s of this.smokes) if (s.r > 1.5 && segCircle(ax, ay, bx, by, s.x, s.y, s.r * .8) >= 0) return false;
    const L = Math.hypot(bx - ax, by - ay); let deep = 0;
    for (const o of this.brush) { const c = clipRect(ax, ay, bx, by, o); if (!c) continue; let a = c[0] * L, b = c[1] * L; a = Math.max(a, 1.4); b = Math.min(b, L - 1.4); if (b > a) deep += b - a; }
    return deep < 1.6;
  }
  /* visibility polygon for fog of war: rays against solid edges + smoke */
  visPoly(x, y, face, fov, R) {
    const segs = [], ang = new Set();
    for (const s of this.segs) { const mx = (s[0] + s[2]) / 2, my = (s[1] + s[3]) / 2; if (Math.hypot(mx - x, my - y) - Math.hypot(s[2] - s[0], s[3] - s[1]) / 2 < R) segs.push(s); }
    const full = fov >= TAU - .01, a0 = face - fov / 2, a1 = face + fov / 2;
    const inFov = a => full || angDiff(a, face) <= fov / 2;
    for (const s of segs) for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) { const a = Math.atan2(py - y, px - x); for (const e of [-.002, .002]) if (inFov(a + e)) ang.add(a + e); }
    const N = full ? 48 : Math.ceil(fov / .05); for (let i = 0; i <= N; i++) ang.add(full ? i / N * TAU : a0 + fov * i / N);
    const list = [...ang].map(a => full ? wrapA(a) : face + wrapA(a - face)).sort((p, q) => p - q);
    const pts = [];
    for (const a of list) {
      const ex = x + Math.cos(a) * R, ey = y + Math.sin(a) * R; let best = 1;
      for (const s of segs) { const t = segX(x, y, ex, ey, s[0], s[1], s[2], s[3]); if (t >= 0 && t < best) best = t; }
      for (const sm of this.smokes) if (sm.r > 1.5) { const t = segCircle(x, y, ex, ey, sm.x, sm.y, sm.r * .8); if (t >= 0 && t < best) best = Math.max(t, .02); }
      pts.push([x + (ex - x) * best, y + (ey - y) * best]);
    }
    if (!full) pts.unshift([x, y]);
    return pts;
  }
  path(sx, sy, tx, ty) { return astar(this.nav, sx, sy, tx, ty); }
  /* best cover spot near (x,y) against threat point; radius r */
  bestCover(x, y, tx, ty, r, avoid) {
    let best = null, bs = -1e9;
    for (const n of this.coverNodes) {
      const d = Math.hypot(n.x - x, n.y - y); if (d > r) continue;
      if (avoid && avoid.some(a => Math.hypot(a.x - n.x, a.y - n.y) < 1.4)) continue;
      const toT = Math.atan2(ty - n.y, tx - n.x), facing = Math.cos(toT) * -n.nx + Math.sin(toT) * -n.ny; // obstacle between node and threat?
      if (facing < .45) continue;
      const s = n.cov * 10 + facing * 3 - d * .5;
      if (s > bs) { bs = s; best = n; }
    }
    return best;
  }
  openDoor(o) { o.open = true; this.rebuild(); }
}
