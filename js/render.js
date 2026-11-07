'use strict';
/* SPEARHEAD // render — oblique top-down canvas renderer with fog of war */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const fogC = document.createElement('canvas'), fctx = fogC.getContext('2d');
let SW = 0, SH = 0, DPR = 1;
const CAM = { x: 25, y: 70, z: 12, tx: null, ty: null };
const PPM = 10; // ground texture pixels per metre
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); SW = cv.clientWidth; SH = cv.clientHeight;
  cv.width = SW * DPR; cv.height = SH * DPR; fogC.width = Math.ceil(SW * DPR / 2); fogC.height = Math.ceil(SH * DPR / 2);
}
const w2s = (x, y) => [(x - CAM.x) * CAM.z + SW / 2, (y - CAM.y) * CAM.z + SH / 2];
const s2w = (sx, sy) => [(sx - SW / 2) / CAM.z + CAM.x, (sy - SH / 2) / CAM.z + CAM.y];
function clampCam() { if (!G) return; const W = G.world; const hw = SW / 2 / CAM.z, hh = SH / 2 / CAM.z; CAM.x = W.W < hw * 2 ? W.W / 2 : cl(CAM.x, hw - 2, W.W - hw + 2); CAM.y = W.H < hh * 2 ? W.H / 2 : cl(CAM.y, hh - 4, W.H - hh + 4); }
function fitCam(x, y) { CAM.z = cl(Math.min(SW / 23, SH / 36), 10, 34); CAM.x = x; CAM.y = y - 8; clampCam(); }

/* ---------- ground texture (cached per mission) ---------- */
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildGround() {
  const W = G.world, m = G.m, c = document.createElement('canvas'); c.width = W.W * PPM; c.height = W.H * PPM; const g = c.getContext('2d'), r = seeded(m.id * 97 + 3);
  const urban = m.id === 6, night = W.night;
  const base = urban ? ['#3b3d40', '#34363a', '#414347'] : m.id === 4 ? ['#3e4a30', '#465435', '#37422b'] : ['#8a7a5a', '#7f7051', '#958563'];
  g.fillStyle = base[0]; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2600; i++) { g.fillStyle = base[1 + (i % 2)]; g.globalAlpha = .25 + r() * .35; const s = r() * 26 + 4; g.beginPath(); g.ellipse(r() * c.width, r() * c.height, s, s * (.4 + r() * .6), r() * 3, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  if (!urban) { // grass tufts & pebbles
    for (let i = 0; i < 3000; i++) { const x = r() * c.width, y = r() * c.height; g.strokeStyle = m.id === 4 ? '#5d7040' : r() < .5 ? '#6f7a48' : '#a39470'; g.globalAlpha = .5; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 3 - 1.5, y - 2 - r() * 4); g.stroke(); }
    for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? '#5c5040' : '#b8aa88'; g.globalAlpha = .6; g.fillRect(r() * c.width, r() * c.height, 2, 2); }
    // tyre tracks
    g.globalAlpha = .18; g.strokeStyle = '#3d3326'; g.lineWidth = 5; for (let k = 0; k < 2; k++) { g.beginPath(); let x = r() * c.width, y = c.height; g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (r() - .5) * 120; y -= c.height / 8; g.lineTo(x, y); } g.stroke(); }
  } else { // street: asphalt, lane markings, sidewalks
    g.fillStyle = '#2b2d30'; g.fillRect(13 * PPM, 0, 24 * PPM, c.height);
    g.strokeStyle = '#c8b25a'; g.globalAlpha = .55; g.lineWidth = 3; g.setLineDash([30, 26]); g.beginPath(); g.moveTo(25 * PPM, 0); g.lineTo(25 * PPM, c.height); g.stroke(); g.setLineDash([]);
    g.globalAlpha = 1; g.fillStyle = '#55575b'; g.fillRect(13 * PPM, 0, 2 * PPM, c.height); g.fillRect(35 * PPM, 0, 2 * PPM, c.height);
    for (let i = 0; i < 700; i++) { g.fillStyle = r() < .5 ? '#232427' : '#4a4c50'; g.globalAlpha = .5; g.fillRect(r() * c.width, r() * c.height, 3, 2); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = '#1a1b1d'; g.globalAlpha = .5; g.lineWidth = 1.5; g.beginPath(); let x = r() * c.width, y = r() * c.height; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  }
  g.globalAlpha = 1;
  // hills: contour lines
  for (const h of W.hills) { for (let k = 4; k >= 1; k--) { g.fillStyle = `rgba(255,240,200,${.035})`; g.beginPath(); g.ellipse(h.x * PPM, h.y * PPM, h.r * PPM * k / 4, h.r * PPM * k / 4 * .85, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,40,20,.25)'; g.lineWidth = 1.2; g.stroke(); } }
  // building floors
  for (const o of W.obs.filter(o => o.t === 'floor')) { g.fillStyle = '#5a554c'; g.fillRect(o.x * PPM, o.y * PPM, o.w * PPM, o.h * PPM); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; for (let x = o.x * PPM; x < (o.x + o.w) * PPM; x += 12) { g.beginPath(); g.moveTo(x, o.y * PPM); g.lineTo(x, (o.y + o.h) * PPM); g.stroke(); } for (let y = o.y * PPM; y < (o.y + o.h) * PPM; y += 12) { g.beginPath(); g.moveTo(o.x * PPM, y); g.lineTo((o.x + o.w) * PPM, y); g.stroke(); } }
  // faint 10 m map grid
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; for (let x = 0; x < W.W; x += 10) { g.beginPath(); g.moveTo(x * PPM, 0); g.lineTo(x * PPM, c.height); g.stroke(); } for (let y = 0; y < W.H; y += 10) { g.beginPath(); g.moveTo(0, y * PPM); g.lineTo(c.width, y * PPM); g.stroke(); }
  W.groundCache = c;
}

/* ---------- obstacles in oblique projection ---------- */
const LIFT = .42; // screen-y lift per metre of height (fake oblique camera)
const OCOL = { wall: ['#8a8f96', '#5f646b', '#4a4e54'], bldg: ['#6d6a66', '#4c4945', '#3a3835'], door: ['#56708a', '#3c4f63', '#2e3d4d'], wreck: ['#5b4a3f', '#3e322b', '#2d2520'], sand: ['#bba878', '#93835a', '#776a48'], crate: ['#9a7a4a', '#73592f', '#5c4625'] };
function drawObstacle(o) {
  const z = CAM.z, [x, y] = w2s(o.x, o.y), w = o.w * z, h = o.h * z, H = o.p.h * z * LIFT, c = OCOL[o.t] || OCOL.wall;
  if (o.open) { ctx.fillStyle = 'rgba(30,30,30,.5)'; ctx.fillRect(x, y, w, h); return; }
  // cast shadow (sun from upper-left)
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); const sx = H * .6, sy = H * .25; ctx.moveTo(x + w, y); ctx.lineTo(x + w + sx, y + sy); ctx.lineTo(x + w + sx, y + h + sy); ctx.lineTo(x + sx, y + h + sy); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  // front face (south side) then top
  ctx.fillStyle = c[1]; ctx.fillRect(x, y + h - H, w, H);
  ctx.fillStyle = c[0]; ctx.fillRect(x, y - H, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y - H + .5, w - 1, h - 1);
  if (o.t === 'sand') { ctx.strokeStyle = 'rgba(70,55,30,.6)'; const n = Math.max(1, Math.round(Math.max(o.w, o.h) / .7)); for (let i = 1; i < n; i++) { ctx.beginPath(); if (o.w > o.h) { ctx.moveTo(x + w * i / n, y - H); ctx.lineTo(x + w * i / n, y - H + h); ctx.moveTo(x + w * i / n, y + h - H); ctx.lineTo(x + w * i / n, y + h); } else { ctx.moveTo(x, y - H + h * i / n); ctx.lineTo(x + w, y - H + h * i / n); } ctx.stroke(); } }
  if (o.t === 'crate') { ctx.strokeStyle = 'rgba(40,25,10,.6)'; ctx.beginPath(); ctx.moveTo(x, y - H); ctx.lineTo(x + w, y - H + h); ctx.moveTo(x + w, y - H); ctx.lineTo(x, y - H + h); ctx.stroke(); }
  if (o.t === 'wreck') { ctx.fillStyle = '#1d2630'; const v = o.w > o.h; if (v) { ctx.fillRect(x + w * .25, y - H + h * .15, w * .18, h * .7); ctx.fillRect(x + w * .55, y - H + h * .15, w * .2, h * .7); } else { ctx.fillRect(x + w * .15, y - H + h * .25, w * .7, h * .18); ctx.fillRect(x + w * .15, y - H + h * .55, w * .7, h * .2); } ctx.fillStyle = 'rgba(255,120,40,.18)'; ctx.fillRect(x + w * .05, y - H + h * .05, w * .2, h * .2); }
  if (o.t === 'bldg') { ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y - H + 4, w - 8, h - 8); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + w * .2, y - H + h * .2, w * .25, h * .18); ctx.fillStyle = '#56524d'; ctx.fillRect(x + w * .62, y - H + h * .55, w * .16, h * .14); for (let i = 0; i < Math.floor(o.w / 4); i++) { ctx.fillStyle = 'rgba(255,214,140,.22)'; ctx.fillRect(x + 6 + i * 4 * z, y + h - H * .6, 1.2 * z, H * .3); } }
  if (o.t === 'door') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + w / 2 - 2, y - H + h / 2 - 2, 4, 4); }
}
function drawBrush(o, alpha) {
  const z = CAM.z, r = seeded(Math.floor(o.x * 13 + o.y * 7));
  for (let i = 0; i < Math.max(4, o.w * o.h / 2.2); i++) { const bx = o.x + r() * o.w, by = o.y + r() * o.h, s = (.8 + r() * 1.1) * z; const [px, py] = w2s(bx, by);
    ctx.fillStyle = `rgba(${40 + r() * 30 | 0},${70 + r() * 40 | 0},${35 + r() * 20 | 0},${alpha})`; ctx.beginPath(); ctx.arc(px, py - s * .3, s, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(120,160,80,${alpha * .25})`; ctx.beginPath(); ctx.arc(px - s * .3, py - s * .6, s * .45, 0, TAU); ctx.fill(); }
}

/* ---------- units ---------- */
function drawSoldier(u, sel) {
  const [x, y] = w2s(u.x, u.y), z = CAM.z, r = .74 * z, F = u.side === 'F', col = F ? u.def.col : '#f43f5e';
  if (u.state === 'dead') { ctx.globalAlpha = .55; ctx.fillStyle = '#5a1018'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r * .9, u.face, 0, TAU); ctx.fill(); ctx.fillStyle = F ? '#3b4a5a' : '#4a2a2e'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * .55, u.face, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; return; }
  if (u.def.veh) return drawVehicle(u);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + r * .25, y + r * .35, r * 1.05, r * .8, 0, 0, TAU); ctx.fill();
  if (u.state === 'down') {
    ctx.fillStyle = 'rgba(150,15,25,.6)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.7 * (u.stable ? .8 : 1.1), r * 1.1, .4, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(u.face + Math.PI / 2); ctx.fillStyle = '#4b5a3c'; ctx.fillRect(-r * .5, -r * 1.3, r, r * 2.4); ctx.fillStyle = '#c9a27c'; ctx.beginPath(); ctx.arc(0, -r * 1.35, r * .42, 0, TAU); ctx.fill(); ctx.restore();
    // bleed-out ring
    const max = u.inj === 'limb' ? 75 : 95, frac = cl(u.bleed / Math.max(max, u.key ? 120 : max), 0, 1), safe = u.stable || (u.tq && u.inj === 'limb');
    ctx.strokeStyle = safe ? '#34d399' : '#f43f5e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 1.9, -Math.PI / 2, -Math.PI / 2 + TAU * (safe ? 1 : frac)); ctx.stroke();
    ctx.fillStyle = safe ? '#34d399' : '#f43f5e'; ctx.font = `800 ${Math.max(10, z * .9)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(u.stable ? 'STABLE' : u.tq && u.inj === 'limb' ? 'TQ ✓' : `✚ ${Math.ceil(u.bleed)}s`, x, y - r * 2.3);
    if (u.uf > 0 && !u.stable) { ctx.fillStyle = '#fbbf24'; ctx.fillText('UNDER FIRE', x, y + r * 3); }
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
  const bob = u.moving ? Math.sin(G.t * 12 + u.bob) * r * .12 : 0, crouch = u.supp > 50 ? .85 : 1;
  // weapon
  ctx.fillStyle = '#16181b'; const wl = u.w === WPN.lmg || u.w === WPN.pkm ? 1.5 : u.w === WPN.dmr || u.w === WPN.svd ? 1.7 : u.w === WPN.rpg ? 1.6 : u.w === WPN.shotgun ? 1.25 : 1.3;
  ctx.fillRect(r * .2, r * .15, r * wl, r * .22); if (u.w === WPN.rpg) { ctx.fillStyle = '#4a5a3a'; ctx.fillRect(r * .1, -r * .25, r * 1.4, r * .32); }
  // shoulders + pack
  ctx.fillStyle = F ? '#4f5d43' : '#5b4b3b'; ctx.beginPath(); ctx.ellipse(-r * .05, 0, r * .62 * crouch, r * 1.0 * crouch, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = F ? '#3d4834' : '#46392d'; ctx.fillRect(-r * .75, -r * .45, r * .45, r * .9);
  // arms toward weapon
  ctx.strokeStyle = F ? '#4f5d43' : '#5b4b3b'; ctx.lineWidth = r * .28; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.lineTo(r * .7, r * .1); ctx.moveTo(0, r * .7); ctx.lineTo(r * .45, r * .3); ctx.stroke();
  // helmet
  ctx.fillStyle = F ? '#5e6b4c' : '#3a2f28'; ctx.beginPath(); ctx.arc(r * .05 + bob, 0, r * .5, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(-r * .25 + bob, -r * .08, r * .3, r * .16); // role stripe / enemy band
  if (F && u.type === 'MED') { ctx.fillStyle = '#fff'; ctx.fillRect(-r * .55, -r * .12, r * .3, r * .24); ctx.fillStyle = '#e11d48'; ctx.fillRect(-r * .47, -r * .06, r * .14, r * .12); }
  ctx.restore();
  // rings: selection, health
  if (F) {
    if (sel) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r * 1.75, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    const hp = u.hp / u.max; ctx.strokeStyle = hp > .5 ? 'rgba(52,211,153,.9)' : hp > .25 ? '#fbbf24' : '#f43f5e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r * 1.35, -Math.PI / 2, -Math.PI / 2 + TAU * hp); ctx.stroke();
    ctx.fillStyle = col; ctx.font = `800 ${Math.max(9, z * .75)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(u.type, x, y - r * 1.75);
  } else { const hp = u.hp / u.max; if (hp < 1) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - r, y - r * 1.9, r * 2, 3); ctx.fillStyle = '#f43f5e'; ctx.fillRect(x - r, y - r * 1.9, r * 2 * hp, 3); } }
  if (u.supp > 40) { ctx.strokeStyle = `rgba(251,191,36,${u.supp / 100})`; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = G.t * 3 + i * TAU / 3; ctx.beginPath(); ctx.arc(x, y, r * 2.1, a, a + .5); ctx.stroke(); } }
  if (u.stun > 0) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(9, z * .7)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('STUNNED', x, y + r * 2.6); }
  if (u.task && u.task.k === 'treat' && u.task.p > 0) { ctx.strokeStyle = '#34d399'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 2.2, -Math.PI / 2, -Math.PI / 2 + TAU * u.task.p); ctx.stroke(); }
}
function drawVehicle(u) {
  const [x, y] = w2s(u.x, u.y), z = CAM.z;
  ctx.save(); ctx.translate(x, y); ctx.rotate(u.face);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-2.2 * z + 4, -1.1 * z + 5, 4.6 * z, 2.3 * z);
  ctx.fillStyle = '#6b5a45'; ctx.fillRect(-2.3 * z, -1.1 * z, 4.6 * z, 2.2 * z); ctx.fillStyle = '#4d4031'; ctx.fillRect(-2.3 * z, -1.1 * z, 2.2 * z, 2.2 * z);
  ctx.fillStyle = '#1d2630'; ctx.fillRect(.4 * z, -.95 * z, .7 * z, 1.9 * z);
  ctx.fillStyle = '#222'; ctx.fillRect(-1.6 * z, -.15 * z, 2.2 * z, .3 * z); ctx.beginPath(); ctx.arc(-1.2 * z, 0, .5 * z, 0, TAU); ctx.fill();
  ctx.restore();
  const hp = u.hp / u.max; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 2 * z, y - 2 * z, 4 * z, 4); ctx.fillStyle = '#f43f5e'; ctx.fillRect(x - 2 * z, y - 2 * z, 4 * z * hp, 4);
}

/* ---------- frame ---------- */
function render() {
  if (!G) return; const W = G.world, z = CAM.z;
  if (!W.groundCache) buildGround();
  if (!G.editor && CAM.tx == null && performance.now() - (CAM.manual || 0) > 3000) { const F = friends().filter(u => u.state !== 'dead'); if (F.length) { let x = 0, y = 0; for (const u of F) { x += u.x; y += u.y; } x /= F.length; y /= F.length; const e = foes().filter(e => e.state === 'ok' && e.spotted); if (e.length) { let ex = 0, ey = 0; for (const q of e) { ex += q.x; ey += q.y; } x = x * .7 + ex / e.length * .3; y = y * .7 + ey / e.length * .3; } CAM.x = lerp(CAM.x, x, .025); CAM.y = lerp(CAM.y, y - 2, .025); clampCam(); } }
  if (CAM.tx != null) { CAM.x = lerp(CAM.x, CAM.tx, .12); CAM.y = lerp(CAM.y, CAM.ty, .12); if (Math.hypot(CAM.x - CAM.tx, CAM.y - CAM.ty) < .05) CAM.tx = null; clampCam(); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#0b0e11'; ctx.fillRect(0, 0, SW, SH);
  const sh = G.shake * 6; ctx.save(); if (sh) ctx.translate(rr(-sh, sh), rr(-sh, sh));
  const [gx, gy] = w2s(0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(W.groundCache, gx, gy, W.W * z, W.H * z);
  // zones
  for (const k in W.zones) { const zn = W.zones[k], [x, y] = w2s(zn.x, zn.y); ctx.fillStyle = 'rgba(52,211,153,.12)'; ctx.strokeStyle = 'rgba(52,211,153,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(x, y, zn.r * z, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#34d399'; ctx.font = `800 ${Math.max(11, z)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(zn.label || k.toUpperCase(), x, y + 4); }
  // decals
  for (const d of G.decals) { const [x, y] = w2s(d.x, d.y); ctx.fillStyle = d.k === 'blood' ? 'rgba(110,12,20,.55)' : 'rgba(10,10,10,.5)'; ctx.beginPath(); ctx.ellipse(x, y, d.r * z * (d.k === 'scorch' ? 1.6 : 1.2), d.r * z * (d.k === 'scorch' ? 1.4 : .8), 0, 0, TAU); ctx.fill(); }
  // obstacles (back to front) and units interleaved by y
  const draw = [];
  for (const o of W.obs) if (o.t !== 'floor' && o.t !== 'brush') draw.push({ y: o.y + o.h, o });
  for (const u of G.units) { if (u.side === 'E' && u.state === 'ok' && !u.spotted) continue; if (u.side === 'E' && u.state === 'dead' && !u.everSpotted) continue; draw.push({ y: u.y + .2, u }); }
  draw.sort((a, b) => a.y - b.y);
  for (const d of draw) d.o ? drawObstacle(d.o) : drawSoldier(d.u, d.u.id === G.sel);
  for (const o of W.brush) drawBrush(o, .82);
  // projectiles
  for (const p of G.proj) { const [x, y] = w2s(p.x, p.y), hh = (p.h || 0) * z; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); ctx.fillStyle = p.k === 'rpg' ? '#ffb35a' : p.k === 'smoke' ? '#cfd6dc' : p.k === 'flare' ? '#fff' : '#2d3a2a'; ctx.beginPath(); ctx.arc(x, y - hh, p.k === 'rpg' ? 3.5 : 3, 0, TAU); ctx.fill(); if (p.k === 'rpg') { ctx.strokeStyle = 'rgba(220,220,220,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - hh); const [sx, sy] = w2s(p.sx + (p.x - p.sx) * .7, p.sy + (p.y - p.sy) * .7); ctx.lineTo(sx, sy); ctx.stroke(); } if (p.fuse != null) { ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, (4.6 * z) * (1 - p.fuse / .5 * .3), 0, TAU); ctx.stroke(); } }
  // tracers & flashes & particles
  ctx.lineCap = 'round';
  for (const t of G.tracers) { const k = t.t / .12, [x1, y1] = w2s(t.x1, t.y1), [x2, y2] = w2s(t.x2, t.y2), ax = lerp(x1, x2, Math.max(0, k * 1.6 - .6)), ay = lerp(y1, y2, Math.max(0, k * 1.6 - .6)), bx = lerp(x1, x2, Math.min(1, k * 1.6)), by = lerp(y1, y2, Math.min(1, k * 1.6)); ctx.strokeStyle = t.c; ctx.lineWidth = t.big ? 2.6 : 1.6; ctx.globalAlpha = .95; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const f of G.fx) { const [x, y] = w2s(f.x, f.y); if (f.k === 'flash') { ctx.fillStyle = f.c; ctx.globalAlpha = 1 - f.t / f.T; ctx.beginPath(); ctx.arc(x, y, z * .6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } if (f.k === 'ring') { const k = f.t / f.T; ctx.strokeStyle = `rgba(255,220,160,${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(x, y, lerp(f.r, f.R, k) * z, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(255,170,80,${(1 - k) * .5})`; ctx.beginPath(); ctx.arc(x, y, lerp(f.r, f.R, k) * z * .6, 0, TAU); ctx.fill(); } }
  for (const p of G.parts) { const [x, y] = w2s(p.x, p.y); ctx.globalAlpha = cl(p.l / p.L, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(x - p.s * z / 2, y - p.s * z / 2, p.s * z, p.s * z); } ctx.globalAlpha = 1;
  // smoke
  for (const s of W.smokes) { const [x, y] = w2s(s.x, s.y); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + G.t * .15, d = s.r * .45, px = x + Math.cos(a) * d * z, py = y + Math.sin(a) * d * z * .8, R = s.r * z * .7; const g = ctx.createRadialGradient(px, py, 0, px, py, R); g.addColorStop(0, `rgba(205,210,215,${.5 * Math.min(1, s.life / 3)})`); g.addColorStop(1, 'rgba(205,210,215,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill(); } }
  // heli
  if (G.heli) { const k = cl(G.heli.t / 3, 0, 1), [x, y] = w2s(G.heli.x, G.heli.y - (1 - k) * 40 + (G.heli.t > 4.5 ? -(G.heli.t - 4.5) * 25 : 0)); ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(10, 14, 3 * z, 1.2 * z, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3d4a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 1.4 * z, 3 * z, 0, 0, TAU); ctx.fill(); ctx.fillRect(-.3 * z, 2 * z, .6 * z, 3.2 * z); ctx.strokeStyle = 'rgba(200,200,200,.6)'; ctx.lineWidth = 3; const a = G.t * 30; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4.5 * z, Math.sin(a) * 4.5 * z); ctx.lineTo(-Math.cos(a) * 4.5 * z, -Math.sin(a) * 4.5 * z); ctx.moveTo(Math.cos(a + 1.57) * 4.5 * z, Math.sin(a + 1.57) * 4.5 * z); ctx.lineTo(-Math.cos(a + 1.57) * 4.5 * z, -Math.sin(a + 1.57) * 4.5 * z); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  if (!G.editor) drawFog();
  drawOverlay();
  if (G.editor) ED.overlay(ctx);
  if (W.night) { ctx.fillStyle = 'rgba(30,80,40,.22)'; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(0, 0, SW, SH); ctx.globalCompositeOperation = 'source-over'; }
  const vg = ctx.createRadialGradient(SW / 2, SH / 2, Math.min(SW, SH) * .45, SW / 2, SH / 2, Math.max(SW, SH) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, SH);
}
function updateVis() {
  G.vis = [];
  for (const u of friends()) { if (!alive(u)) continue; const R = fRange(u); G.vis.push({ u, cone: G.world.visPoly(u.x, u.y, u.face, FOV_F, R), near: G.world.visPoly(u.x, u.y, 0, TAU, AWARE), R }); }
}
function drawFog() {
  const W = G.world, k = DPR / 2; fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fogC.width, fogC.height);
  fctx.fillStyle = W.night ? 'rgba(2,6,4,.88)' : 'rgba(6,9,12,.66)'; fctx.fillRect(0, 0, fogC.width, fogC.height);
  fctx.globalCompositeOperation = 'destination-out'; fctx.setTransform(k, 0, 0, k, 0, 0);
  for (const v of G.vis) { const [ux, uy] = w2s(v.u.x, v.u.y);
    for (const poly of [v.cone, v.near]) { if (poly.length < 3) continue; const g = fctx.createRadialGradient(ux, uy, 0, ux, uy, (poly === v.near ? AWARE : v.R) * CAM.z); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.75, 'rgba(0,0,0,.95)'); g.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = g; fctx.beginPath(); poly.forEach((p, i) => { const [sx, sy] = w2s(p[0], p[1]); i ? fctx.lineTo(sx, sy) : fctx.moveTo(sx, sy); }); fctx.closePath(); fctx.fill(); } }
  for (const f of W.flares) { const [x, y] = w2s(f.x, f.y), g = fctx.createRadialGradient(x, y, 0, x, y, f.r * CAM.z); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, f.r * CAM.z, 0, TAU); fctx.fill(); }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(fogC, 0, 0, cv.width, cv.height); ctx.restore();
  // muzzle flashes punch through the dark
  if (W.night) for (const f of G.fx) if (f.k === 'flash') { const [x, y] = w2s(f.x, f.y), g = ctx.createRadialGradient(x, y, 0, x, y, 5 * CAM.z); g.addColorStop(0, 'rgba(255,230,160,.35)'); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 5 * CAM.z, 0, TAU); ctx.fill(); }
  for (const fl of W.flares) { const [x, y] = w2s(fl.x, fl.y); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff6c0'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(x, y - 30, 4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
}
function drawOverlay() {
  const z = CAM.z;
  // last-known enemy positions & sniper glints
  for (const e of foes()) {
    if (e.state !== 'ok') continue;
    if (!e.spotted && e.lastPos && G.t - e.lastSpotT < 10) { const [x, y] = w2s(e.lastPos.x, e.lastPos.y); ctx.strokeStyle = 'rgba(244,63,94,.6)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, .9 * z, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(244,63,94,.8)'; ctx.font = `800 ${Math.max(10, z * .8)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('?', x, y + 4); }
    if (e.spotted) { const [x, y] = w2s(e.x, e.y); ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(x, y - 1.6 * z); ctx.lineTo(x - 5, y - 1.6 * z - 7); ctx.lineTo(x + 5, y - 1.6 * z - 7); ctx.fill(); if (friends().some(u => u.focus === e.id)) { ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2; const s = 1.5 * z; ctx.strokeRect(x - s, y - s, s * 2, s * 2); } }
    if (e.w.aim && e.aimT > 0 && e.target) { const t = byId(e.target); if (t) { const [x1, y1] = w2s(e.x, e.y), [x2, y2] = w2s(t.x, t.y); ctx.strokeStyle = `rgba(255,40,60,${.25 + e.aimT / e.w.aim * .6})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x1, y1, 3 + Math.sin(G.t * 30) * 1.5, 0, TAU); ctx.fill(); } }
  }
  // friendly routes, sectors, carry links
  for (const u of friends()) {
    if (u.state !== 'ok') continue; const [x, y] = w2s(u.x, u.y), sel = u.id === G.sel;
    if (u.path.length) { ctx.strokeStyle = sel ? 'rgba(56,189,248,.9)' : 'rgba(56,189,248,.45)'; ctx.lineWidth = sel ? 2.5 : 1.5; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(x, y); for (const p of u.path) { const [px, py] = w2s(p.x, p.y); ctx.lineTo(px, py); } ctx.stroke(); ctx.setLineDash([]); const e = u.path[u.path.length - 1]; coverIcon(e.x, e.y, u); }
    if (u.sector != null) { ctx.strokeStyle = 'rgba(56,189,248,.5)'; ctx.fillStyle = 'rgba(56,189,248,.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 9 * z, u.sector - .5, u.sector + .5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (u.carry) { const c = byId(u.carry); if (c) { const [cx, cy] = w2s(c.x, c.y); ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke(); } }
  }
  if (typeof INPUT !== 'undefined') INPUT.drawOverlay(ctx);
}
function coverIcon(wx, wy, u) {
  const th = threatDir(u, { x: wx, y: wy }); const c = th ? G.world.coverAt(wx, wy, th.x, th.y) : 0; const [x, y] = w2s(wx, wy), s = Math.max(9, CAM.z * .75);
  ctx.fillStyle = c >= 1 ? '#34d399' : c > 0 ? '#fbbf24' : '#f43f5e'; ctx.strokeStyle = '#0b0e11'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s * .85, y - s * .75); ctx.lineTo(x + s * .7, y + s * .2); ctx.lineTo(x, y + s * .8); ctx.lineTo(x - s * .7, y + s * .2); ctx.lineTo(x - s * .85, y - s * .75); ctx.closePath(); ctx.stroke(); ctx.fill();
  if (c < 1) { ctx.fillStyle = '#0b0e11'; if (c > 0) ctx.fillRect(x, y - s * .9, s * .8, s * 1.6); else { ctx.font = `900 ${s}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('!', x, y + s * .35); } }
  return c;
}
