'use strict';
/* SPEARHEAD // input — one-finger commands, two-finger camera.
   drag from a soldier = draw route · tap ground = move selected · tap enemy = focus fire
   tap casualty = treat · long-press ground = set sector · drag empty ground = pan · pinch = zoom */
const INPUT = {
  ptr: new Map(), mode: null, unit: null, pts: [], start: null, lp: null, ability: null, hover: null, wasSlow: false, pinch: null,
  drawOverlay(c) {
    if (!G) return; const z = CAM.z;
    if (this.mode === 'path' && this.pts.length) {
      const u = byId(this.unit); if (!u) return; const [x, y] = w2s(u.x, u.y);
      c.strokeStyle = '#38bdf8'; c.lineWidth = 3.5; c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowColor = '#38bdf8'; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(x, y); for (const p of this.pts) { const [px, py] = w2s(p.x, p.y); c.lineTo(px, py); } c.stroke(); c.shadowBlur = 0;
      const e = this.pts[this.pts.length - 1]; const ok = G.world.walkable(e.x, e.y); coverIcon(e.x, e.y, u);
      if (!ok) { const [ex, ey] = w2s(e.x, e.y); c.fillStyle = '#f43f5e'; c.font = '800 12px system-ui'; c.textAlign = 'center'; c.fillText('BLOCKED', ex, ey + 22); }
    }
    if (this.ability && G.sel) {
      const u = byId(G.sel); if (!u) return; const A = ABIL[this.ability], [x, y] = w2s(u.x, u.y);
      c.strokeStyle = 'rgba(251,191,36,.6)'; c.setLineDash([6, 6]); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, A.rng * z, 0, TAU); c.stroke(); c.setLineDash([]);
      if (this.hover) { const [hx, hy] = w2s(this.hover.x, this.hover.y), r = { frag: 4.6, gl: 3.6, smoke: 6.5, flare: 18, breach: 1.5 }[this.ability] * z; c.strokeStyle = '#fbbf24'; c.lineWidth = 2; c.beginPath(); c.arc(hx, hy, r, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(hx - 10, hy); c.lineTo(hx + 10, hy); c.moveTo(hx, hy - 10); c.lineTo(hx, hy + 10); c.stroke(); }
    }
    if (this.lp && this.lp.show) { const u = byId(G.sel); if (u) { const [x, y] = w2s(u.x, u.y), a = Math.atan2(this.lp.wy - u.y, this.lp.wx - u.x); c.fillStyle = 'rgba(56,189,248,.18)'; c.strokeStyle = '#38bdf8'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.arc(x, y, 9 * z, a - .5, a + .5); c.closePath(); c.fill(); c.stroke(); } }
  },
  hit(wx, wy) {
    const R = Math.max(1.5, 26 / CAM.z);
    let best = null, bd = R;
    for (const u of G.units) { if (u.state === 'dead') continue; if (u.side === 'E' && !u.spotted) continue; const d = Math.hypot(u.x - wx, u.y - wy) - (u.def.veh ? 1.5 : 0); if (d < bd) { bd = d; best = u; } }
    return best;
  }
};
function evW(e) { const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const [wx, wy] = s2w(sx, sy); return { sx, sy, wx, wy }; }
cv.addEventListener('pointerdown', e => {
  if (!G || G.over || G.editor) return; cv.setPointerCapture(e.pointerId); const p = evW(e); INPUT.ptr.set(e.pointerId, p); SFX.unlock();
  if (INPUT.ptr.size === 2) { // pinch begins: cancel any one-finger gesture
    if (INPUT.mode === 'path') endSlow(); INPUT.mode = 'pinch'; INPUT.lp && clearTimeout(INPUT.lp.h); INPUT.lp = null;
    const [a, b] = [...INPUT.ptr.values()]; INPUT.pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), z: CAM.z, mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2, cx: CAM.x, cy: CAM.y }; return;
  }
  INPUT.start = { ...p, t: performance.now() }; INPUT.mode = 'press'; INPUT.pts = [];
  const h = INPUT.hit(p.wx, p.wy); INPUT.startHit = h;
  if (!INPUT.ability && (!h || h.side === 'E')) INPUT.lp = { wx: p.wx, wy: p.wy, h: setTimeout(() => { if (INPUT.mode === 'press' && G.sel) { INPUT.lp.show = true; buzz(15); SFX.play('ui'); } }, 420) };
});
cv.addEventListener('pointermove', e => {
  if (!G || G.editor) return; const p = evW(e);
  if (INPUT.ability) INPUT.hover = { x: p.wx, y: p.wy };
  if (!INPUT.ptr.has(e.pointerId)) return; INPUT.ptr.set(e.pointerId, p);
  if (INPUT.mode === 'pinch' && INPUT.ptr.size >= 2) { const [a, b] = [...INPUT.ptr.values()], P = INPUT.pinch, d = Math.hypot(a.sx - b.sx, a.sy - b.sy); CAM.z = cl(P.z * d / P.d, 5, 34); const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2; CAM.x = P.cx - (mx - P.mx) / CAM.z; CAM.y = P.cy - (my - P.my) / CAM.z; CAM.tx = null; CAM.manual = performance.now(); clampCam(); return; }
  const s = INPUT.start; if (!s) return; const moved = Math.hypot(p.sx - s.sx, p.sy - s.sy);
  if (INPUT.mode === 'press' && moved > 12) {
    if (INPUT.lp) { clearTimeout(INPUT.lp.h); if (INPUT.lp.show) { INPUT.lp.wx = p.wx; INPUT.lp.wy = p.wy; return; } INPUT.lp = null; }
    const h = INPUT.startHit;
    if (!INPUT.ability && h && h.side === 'F' && h.state === 'ok') { INPUT.mode = 'path'; INPUT.unit = h.id; G.sel = h.id; INPUT.wasSlow = G.slow; G.slow = true; UI.refresh(); SFX.play('ui'); }
    else if (!INPUT.ability) { INPUT.mode = 'pan'; INPUT.panS = { x: CAM.x, y: CAM.y }; CAM.tx = null; }
  }
  if (INPUT.lp && INPUT.lp.show) { INPUT.lp.wx = p.wx; INPUT.lp.wy = p.wy; }
  if (INPUT.mode === 'path') { const last = INPUT.pts[INPUT.pts.length - 1] || byId(INPUT.unit); if (Math.hypot(p.wx - last.x, p.wy - last.y) > 1.6) INPUT.pts.push({ x: cl(p.wx, .5, G.world.W - .5), y: cl(p.wy, .5, G.world.H - .5) }); }
  if (INPUT.mode === 'pan' || INPUT.mode === 'pinch') CAM.manual = performance.now();
  if (INPUT.mode === 'pan') { CAM.x = INPUT.panS.x - (p.sx - s.sx) / CAM.z; CAM.y = INPUT.panS.y - (p.sy - s.sy) / CAM.z; clampCam(); }
});
function endSlow() { G.slow = INPUT.wasSlow; UI.refresh(); }
const upH = e => {
  if (!G || G.editor || !INPUT.ptr.has(e.pointerId)) return; const p = INPUT.ptr.get(e.pointerId); INPUT.ptr.delete(e.pointerId);
  if (INPUT.mode === 'pinch') { if (INPUT.ptr.size === 0) INPUT.mode = null; return; }
  const lp = INPUT.lp; if (lp) clearTimeout(lp.h); INPUT.lp = null;
  const s = INPUT.start; INPUT.start = null;
  if (lp && lp.show) { const u = byId(G.sel); if (u) { orderSector(u, lp.wx, lp.wy); radio(`${u.name}: covering that sector.`, 'cmd'); } INPUT.mode = null; return; }
  if (INPUT.mode === 'path') { const u = byId(INPUT.unit); endSlow(); if (u && INPUT.pts.length) { const pts = INPUT.pts.filter((q, i) => i % 2 === 0 || i === INPUT.pts.length - 1); orderPath(u, pts); SFX.play('order'); buzz(10); } INPUT.mode = null; INPUT.pts = []; return; }
  if (INPUT.mode === 'press' && s) { tapAt(p.wx, p.wy); }
  INPUT.mode = null;
};
cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', e => { INPUT.ptr.delete(e.pointerId); INPUT.mode = null; INPUT.lp && clearTimeout(INPUT.lp.h); INPUT.lp = null; });
function tapAt(wx, wy) {
  const sel = G.sel && byId(G.sel);
  if (INPUT.ability) { const k = INPUT.ability; INPUT.ability = null; INPUT.hover = null; if (sel && useAbility(sel, k, wx, wy)) buzz(15); G.slow = INPUT.wasSlow; UI.refresh(); return; }
  const h = INPUT.hit(wx, wy);
  if (h && h.side === 'F' && h.state === 'ok') { G.sel = h.id; SFX.play('ui'); UI.refresh(); return; }
  if (h && h.side === 'F' && h.state === 'down') {
    let r = sel && alive(sel) ? sel : null;
    if (!r || (r.type !== 'MED' && friends().some(f => f.type === 'MED' && alive(f) && !f.task))) r = friends().filter(f => alive(f) && f.type === 'MED' && !f.task)[0] || r;
    if (!r) r = friends().filter(alive).sort((a, b) => dist(a, h) - dist(b, h))[0];
    if (r) { orderTreat(r, h); G.sel = r.id; SFX.play('order'); radio(`${r.name}: on my way to ${h.name}.`, 'cmd'); UI.refresh(); }
    return;
  }
  if (h && h.side === 'E') { orderFocus(h); SFX.play('order'); buzz(10); return; }
  if (sel && alive(sel)) { const door = G.world.obs.find(o => o.t === 'door' && !o.open && ptInRect(wx, wy, o, .8)); if (door && sel.kit.breach > 0) { useAbility(sel, 'breach', wx, wy); return; }
    orderPath(sel, [{ x: wx, y: wy }]); SFX.play('order'); buzz(8); }
}
cv.addEventListener('wheel', e => { e.preventDefault(); if (!G) return; const p = evW(e); const z0 = CAM.z; CAM.z = cl(CAM.z * (1 - e.deltaY * .0012), 5, 34); CAM.x = p.wx - (p.sx - SW / 2) / CAM.z; CAM.y = p.wy - (p.sy - SH / 2) / CAM.z; CAM.tx = null; CAM.manual = performance.now(); clampCam(); }, { passive: false });
addEventListener('keydown', e => {
  if (!G || G.over) return;
  if (e.key === ' ') { e.preventDefault(); UI.toggleSlow(); }
  if (e.key === 'Escape') { INPUT.ability = null; UI.refresh(); }
  if (e.key === 'p') UI.togglePause();
  const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) { const f = friends()[n - 1]; if (f) { G.sel = f.id; UI.refresh(); } }
});
