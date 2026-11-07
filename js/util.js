'use strict';
/* SPEARHEAD // util — math, geometry, pathfinding. World units are metres. */
const TAU = Math.PI * 2;
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const angDiff = (a, b) => Math.abs(wrapA(a - b));
const turnTo = (cur, tgt, max) => { const d = wrapA(tgt - cur); return cur + cl(d, -max, max); };

/* segment–segment intersection: returns t along first segment or -1 */
function segX(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax, rY = by - ay, sX = dx - cx, sY = dy - cy;
  const den = rX * sY - rY * sX;
  if (den === 0) return -1;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : -1;
}
/* ray vs circle: nearest t >= 0 (in units of ray length) or -1 */
function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c < 0) return 0;
  let disc = b * b - 4 * a * c; if (disc < 0) return -1;
  disc = Math.sqrt(disc);
  const t = (-b - disc) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
const ptInRect = (x, y, o, pad = 0) => x >= o.x - pad && x <= o.x + o.w + pad && y >= o.y - pad && y <= o.y + o.h + pad;
const rectSegs = o => [[o.x, o.y, o.x + o.w, o.y], [o.x + o.w, o.y, o.x + o.w, o.y + o.h], [o.x + o.w, o.y + o.h, o.x, o.y + o.h], [o.x, o.y + o.h, o.x, o.y]];

/* binary heap for A* */
class Heap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break;[a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break;[a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; }
  get size() { return this.a.length; }
}
/* grid A* with diagonal moves; grid.cost[i]: 0 = blocked, >0 = move cost multiplier */
function astar(grid, sx, sy, tx, ty, maxIter = 6000) {
  const W = grid.w, H = grid.h, C = grid.cs;
  let s = { x: cl(Math.floor(sx / C), 0, W - 1), y: cl(Math.floor(sy / C), 0, H - 1) };
  let t = { x: cl(Math.floor(tx / C), 0, W - 1), y: cl(Math.floor(ty / C), 0, H - 1) };
  const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid.cost[y * W + x] > 0;
  if (!free(t.x, t.y)) { const n = nearestFree(grid, t.x, t.y); if (!n) return null; t = n; }
  if (!free(s.x, s.y)) { const n = nearestFree(grid, s.x, s.y); if (!n) return null; s = n; }
  const si = s.y * W + s.x, ti = t.y * W + t.x;
  const g = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const h = (x, y) => { const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  const open = new Heap(); g[si] = 0; open.push(si, h(s.x, s.y));
  let it = 0;
  while (open.size && it++ < maxIter) {
    const cur = open.pop(); if (cur === ti) break; if (closed[cur]) continue; closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (!free(nx, ny)) continue;
      if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue; // no corner cutting
      const ni = ny * W + nx, ng = g[cur] + (dx && dy ? 1.414 : 1) * grid.cost[ni];
      if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; open.push(ni, ng + h(nx, ny)); }
    }
  }
  if (from[ti] === -1 && si !== ti) return null;
  const pts = []; let c = ti; while (c !== -1 && c !== si) { pts.push({ x: (c % W + .5) * C, y: (((c / W) | 0) + .5) * C }); c = from[c]; }
  pts.reverse(); return smoothPath(grid, { x: sx, y: sy }, pts);
}
function nearestFree(grid, x, y) { for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < grid.w && ny < grid.h && grid.cost[ny * grid.w + nx] > 0) return { x: nx, y: ny }; } return null; }
/* string-pull: drop waypoints that have a clear walk line */
function walkClear(grid, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / (grid.cs * .5));
  for (let i = 1; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; const gx = Math.floor(x / grid.cs), gy = Math.floor(y / grid.cs); if (gx < 0 || gy < 0 || gx >= grid.w || gy >= grid.h || grid.cost[gy * grid.w + gx] === 0) return false; }
  return true;
}
function smoothPath(grid, start, pts) {
  if (pts.length < 3) return pts; const out = []; let anchor = start, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !walkClear(grid, anchor, pts[j])) j--; out.push(pts[j]); anchor = pts[j]; i = j + 1; }
  return out;
}
const fmtT = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
