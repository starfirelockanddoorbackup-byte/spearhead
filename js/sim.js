'use strict';
/* SPEARHEAD // sim — units, perception, combat, suppression, AI, TCCC casualty care, objectives */
const NAMES = ['Cole', 'Diaz', 'Hart', 'Kim', 'Ruiz', 'Okafor', 'Shaw', 'Vance', 'Brooks', 'Nakamura', 'Ibarra', 'Lund'];
const SIGHT = 34, FOV_F = 2.6, FOV_E = 2.4, AWARE = 7;
let G = null, UID = 1;

function newGame(m, squadCfg, opts = {}) {
  UID = 1;
  const world = new World(m);
  G = { m, world, units: [], t: 0, speed: 1, slow: false, paused: false, over: false, result: null, fx: [], tracers: [], parts: [], proj: [], decals: [],
        msgs: [], waveI: 0, diff: DIFF[opts.diff || 'regular'], shake: 0, sel: null, march: null, heli: null, perceiveT: 0, visT: 0, vis: [],
        stats: { shots: 0, hits: 0, eShots: 0, kills: 0, down: 0, kia: 0, openHits: 0, coverHits: 0, cufAttempts: 0, rescuerHit: 0, suppKills: 0, flankKills: 0, smoke: 0, sectors: 0, frags: 0, marchOk: 0, marchErr: 0, marchDone: 0, doorHits: 0, tq: 0, pinned: 0 },
        events: [] };
  const names = [...NAMES].sort(() => Math.random() - .5);
  const st = m.squad.start;
  squadCfg.forEach((s, i) => {
    const ang = (i - (squadCfg.length - 1) / 2) * 1.6;
    const u = mkUnit('F', s.role, st.x + ang, st.y + (i % 2) * 1.2, { name: s.name || names[i], load: s.load });
    if (m.squad.kit) for (const k in m.squad.kit) if (s.role === 'TL' || s.role === 'RFL') u.kit[k] = (u.kit[k] || 0) + (s.role === 'TL' ? m.squad.kit[k] : 1);
    G.units.push(u);
  });
  if (m.preDown) { const p = m.preDown; const u = mkUnit('F', p.role, p.x, p.y, { name: p.name }); goDown(u, p.inj, true); u.bleed = p.bleed; u.key = 'patient'; G.units.push(u); }
  for (const e of (m.enemies || [])) G.units.push(mkUnit('E', e.t, e.x, e.y, e));
  G.sel = G.units.find(u => u.side === 'F' && u.state === 'ok')?.id || null;
  radio(`${m.name.toUpperCase()} // ${m.objText}`, 'info');
  return G;
}
function mkUnit(side, type, x, y, o = {}) {
  const def = side === 'F' ? FR[type] : EN[type], ld = o.load || { armor: 'plate', optic: 'iron', extra: 'none' };
  const arm = LOAD.armor[ld.armor] || LOAD.armor.plate;
  const u = { id: UID++, side, type, def, x, y, face: side === 'F' ? -Math.PI / 2 : (o.face ?? Math.PI / 2), hp: def.hp, max: def.hp, w: WPN[def.w],
    spd: def.spd * arm.spd, dmgK: arm.dmg, optic: LOAD.optic[ld.optic] || LOAD.optic.iron, load: ld, name: o.name || def.n,
    cd: rr(.2, 1.2), burst: 0, shotT: 0, supp: 0, state: 'ok', path: [], sector: null, focus: null, target: null, kit: Object.assign({}, def.kit || {}),
    carry: null, carrier: null, task: null, inj: null, bleed: 0, uf: 0, seen: 0, spotted: false, last: null, revealT: 0, morale: 100, think: rr(0, 1),
    hold: !!o.hold, key: o.key || null, kills: 0, stun: 0, aimT: 0, moving: false, el: 0, home: { x, y }, tq: false, stable: false, bob: R01() * 6 };
  if (ld.extra === 'frag') u.kit.frag = (u.kit.frag || 0) + 1; if (ld.extra === 'smoke') u.kit.smoke = (u.kit.smoke || 0) + 1; if (ld.extra === 'ifak') u.kit.tq = (u.kit.tq || 0) + 1;
  if (def.veh) { u.drive = [{ x, y: Math.min(G ? G.m.H * .55 : 50, y + 50) }]; }
  return u;
}
function R01() { return Math.random(); }
function radio(t, k = 'info') { G.msgs.push({ t, k, at: G.t, life: 5 }); if (G.msgs.length > 6) G.msgs.shift(); if (typeof UI !== 'undefined') UI.onRadio && UI.onRadio(t, k); }
const friends = () => G.units.filter(u => u.side === 'F');
const foes = () => G.units.filter(u => u.side === 'E');
const alive = u => u.state === 'ok';
const byId = id => G.units.find(u => u.id === id);

/* ---------------- orders (called by input/UI) ---------------- */
function orderPath(u, pts, snapThreat) {
  if (!alive(u)) return;
  const W = G.world; let full = [], cur = { x: u.x, y: u.y };
  for (const p of pts) { const seg = W.path(cur.x, cur.y, p.x, p.y); if (!seg) continue; full.push(...seg); cur = full[full.length - 1] || cur; }
  if (!full.length) return;
  const end = full[full.length - 1], th = snapThreat || threatDir(u, end);
  if (th) { const c = W.bestCover(end.x, end.y, th.x, th.y, 2.6, friends().filter(f => f !== u && alive(f)).map(f => f.dest || f)); if (c) { const tail = W.path(end.x, end.y, c.x, c.y); if (tail) full.push(...tail); else full.push({ x: c.x, y: c.y }); } }
  u.path = full; u.dest = full[full.length - 1]; u.task = u.task && u.task.k === 'carry' ? u.task : null; u.auto = 0;
}
function threatDir(u, at) {
  const p = at || u; let best = null, bd = 1e9;
  for (const e of foes()) if (alive(e) && (e.spotted || e.lastSpotT > G.t - 8)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
  if (best) return { x: best.x, y: best.y };
  if (u.sector != null) return { x: p.x + Math.cos(u.sector) * 20, y: p.y + Math.sin(u.sector) * 20 };
  return { x: p.x, y: p.y - 20 };
}
function orderSector(u, x, y) { if (!alive(u)) return; u.sector = Math.atan2(y - u.y, x - u.x); G.stats.sectors++; }
function orderFocus(e) { for (const u of friends()) if (alive(u)) u.focus = e.id; radio(`All callsigns, focus fire: ${e.def.n}.`, 'cmd'); }
function orderHold(u) { u.path = []; u.dest = null; }
function orderTreat(u, c) {
  if (!alive(u) || c.state !== 'down') return;
  u.task = { k: 'treat', id: c.id }; orderPathRaw(u, c.x, c.y);
  if (c.uf > 0) { radio(`${u.name}: moving to ${c.name} under fire!`, 'warn'); }
}
function orderPathRaw(u, x, y) { const p = G.world.path(u.x, u.y, x, y); u.path = p || []; u.dest = { x, y }; }
function orderCarry(u, c) { if (!alive(u) || c.state !== 'down' || c.carrier) return false; if (Math.hypot(c.x - u.x, c.y - u.y) > 2.2) return false; orderDrop(u); u.carry = c.id; c.carrier = u.id; u.task = { k: 'carry', id: c.id }; radio(`${u.name}: I've got ${c.name}. Moving!`, 'cmd'); return true; }
function orderDrop(u) { if (u.carry) { const c = byId(u.carry); if (c) c.carrier = null; u.carry = null; u.task = null; } }

/* ---------------- abilities ---------------- */
const ABIL = {
  frag:   { n: 'Frag', rng: 20, has: u => u.kit.frag > 0 },
  gl:     { n: '40mm', rng: 42, has: u => u.kit.gl > 0 },
  smoke:  { n: 'Smoke', rng: 22, has: u => u.kit.smoke > 0 },
  flare:  { n: 'Flare', rng: 36, has: u => u.kit.flare > 0 },
  breach: { n: 'Breach', rng: 2.8, has: u => u.kit.breach > 0 }
};
function useAbility(u, k, x, y) {
  if (!alive(u) || !ABIL[k].has(u)) return false;
  const d = Math.hypot(x - u.x, y - u.y), A = ABIL[k];
  if (k === 'breach') {
    const door = G.world.obs.find(o => o.t === 'door' && !o.open && ptInRect(x, y, o, 1.5));
    if (!door) { radio('No locked door there.', 'warn'); return false; }
    const cx = door.x + door.w / 2, cy = door.y + door.h / 2;
    if (Math.hypot(cx - u.x, cy - u.y) > 3.2) { u.task = { k: 'breach', door }; const side = { x: cx + (u.y > cy ? 0 : 0), y: cy + (u.y > cy ? 1.6 : -1.6) }; orderPathRaw(u, side.x, side.y); radio(`${u.name}: moving to breach.`, 'cmd'); return true; }
    doBreach(u, door); return true;
  }
  if (d > A.rng) { const k2 = A.rng / d; x = u.x + (x - u.x) * k2; y = u.y + (y - u.y) * k2; }
  u.kit[k]--; u.face = Math.atan2(y - u.y, x - u.x);
  if (k === 'frag') { G.proj.push({ k, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: x + rr(-1, 1), ty: y + rr(-1, 1), t: 0, T: 1.1, owner: u.id }); G.stats.frags++; radio(`${u.name}: FRAG OUT!`, 'cmd'); SFX.play('throw'); }
  if (k === 'gl') { G.proj.push({ k, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: x + rr(-1.2, 1.2), ty: y + rr(-1.2, 1.2), t: 0, T: d / 38 + .15, owner: u.id }); SFX.play('gl'); }
  if (k === 'smoke') { G.proj.push({ k, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: x, ty: y, t: 0, T: .9, owner: u.id }); G.stats.smoke++; radio(`${u.name}: popping smoke.`, 'cmd'); SFX.play('throw'); }
  if (k === 'flare') { G.proj.push({ k, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: x, ty: y, t: 0, T: .8, owner: u.id }); SFX.play('flare'); }
  return true;
}
function doBreach(u, door) {
  u.kit.breach--; G.world.openDoor(door); const cx = door.x + door.w / 2, cy = door.y + door.h / 2;
  explode(cx, cy, 2.2, 30, 0, u.id, true);
  for (const e of foes()) if (alive(e) && Math.hypot(e.x - cx, e.y - cy) < 8) { e.stun = 2.6; e.supp = 100; }
  radio(`${u.name}: BREACHING! Door's open, move move move!`, 'cmd'); u.task = null;
}

/* ---------------- casualty care (TCCC) ---------------- */
function goDown(u, inj, silent) {
  u.state = 'down'; u.hp = 0; u.path = []; u.task = null; u.supp = 0; u.carry && orderDrop(u);
  u.inj = inj || (Math.random() < .6 ? 'limb' : 'torso'); u.bleed = u.inj === 'limb' ? 75 : 95; u.tq = false; u.stable = false;
  if (!silent) { G.stats.down++; radio(`MAN DOWN! ${u.name}, ${u.inj === 'limb' ? 'heavy bleeding from the leg' : 'hit in the torso'}.`, 'bad'); SFX.play('down'); buzz([80, 40, 80]); }
}
function kia(u) { u.state = 'dead'; if (u.carrier) { const c = byId(u.carrier); if (c) { c.carry = null; c.task = null; } } radio(`${u.name} is KIA.`, 'bad'); G.stats.kia++; }
const isMedic = u => u.type === 'MED';
function careTick(u, dt) { // u = rescuer with task treat
  const c = byId(u.task.id); if (!c || c.state !== 'down') { u.task = null; return; }
  const d = Math.hypot(c.x - u.x, c.y - u.y);
  if (d > 1.6) { if (!u.path.length) orderPathRaw(u, c.x, c.y); return; }
  u.path = []; u.face = Math.atan2(c.y - u.y, c.x - u.x);
  const underFire = u.uf > 0 || c.uf > 0;
  if (u.uf > 0 && !u.task.hitNoted) { u.task.hitNoted = 1; }
  // CARE UNDER FIRE: tourniquet only
  if (c.inj === 'limb' && !c.tq) {
    const has = (u.kit.tq || 0) > 0 || (c.kit.tq || 0) > 0;
    if (!has) { radio(`${u.name}: no tourniquet left!`, 'warn'); u.task = null; return; }
    u.task.p = (u.task.p || 0) + dt / (isMedic(u) ? 2.4 : 4.2);
    if (u.task.p >= 1) { if ((c.kit.tq || 0) > 0) c.kit.tq--; else u.kit.tq--; c.tq = true; G.stats.tq++; u.task.p = 0; radio(`${u.name}: tourniquet on ${c.name}, high and tight.${underFire ? ' Still under fire, drag him to cover!' : ''}`, 'good'); SFX.play('ui'); }
    return;
  }
  if (c.stable) { u.task = null; return; }
  if (underFire) {
    if (!u.task.cufWarn) { u.task.cufWarn = 1; G.stats.cufAttempts++; radio(c.inj === 'torso' ? `${u.name}: can't pack a torso wound under this fire. Suppress them or drag him out!` : `${u.name}: bleeding's controlled. Field care has to wait until we're out of the fire.`, 'warn'); }
    return;
  }
  // TACTICAL FIELD CARE
  if (!isMedic(u)) { if (!u.task.noMed) { u.task.noMed = 1; radio(`${u.name}: I've done what I can. Need the medic for field care.`, 'warn'); } return; }
  if ((u.kit.kits || 0) <= 0 && !G.march) { radio(`${u.name}: aid bag is empty!`, 'bad'); u.task = null; return; }
  if (!G.march) { G.march = { med: u.id, cas: c.id, step: 0, err: 0, p: 0, auto: 0 }; u.kit.kits--; if (UI.openMarch) UI.openMarch(); }
  const M = G.march; if (M.med !== u.id) return;
  M.auto += dt; // the medic keeps working even if the player ignores the panel, just slower
  if (M.auto > 4 + M.step * 0) { M.auto = 0; marchStep(MARCH_STEPS[M.step].k, true); }
}
function marchStep(k, auto) {
  const M = G.march; if (!M) return; if (auto) M.anyAuto = 1;
  const want = MARCH_STEPS[M.step].k;
  if (k === want) { M.step++; M.auto = 0; if (!auto) G.stats.marchOk++; SFX.play('ui'); }
  else { M.err++; M.auto = Math.min(M.auto, 0) - 1.5; G.stats.marchErr++; SFX.play('deny'); if (UI.marchErr) UI.marchErr(k, want); return; }
  if (M.step >= MARCH_STEPS.length) {
    const c = byId(M.cas), u = byId(M.med); c.stable = true; c.bleed = Math.max(c.bleed, 1); G.stats.marchDone++; if (M.err === 0 && !M.anyAuto) G.march.perfect = 1;
    if (M.err === 0 && !M.anyAuto) G.stats.marchPerfect = (G.stats.marchPerfect || 0) + 1;
    radio(`${u ? u.name : 'Doc'}: ${c.name} is stable. Ready to move.`, 'good'); if (u) u.task = null; G.march = null; if (UI.closeMarch) UI.closeMarch();
  }
}

/* ---------------- perception ---------------- */
function sees(a, b, R, fov) {
  const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > R) return false;
  if (d > AWARE && angDiff(Math.atan2(b.y - a.y, b.x - a.x), a.face) > fov / 2) return false;
  return G.world.sightClear(a.x, a.y, b.x, b.y);
}
function fRange(u) { let r = SIGHT * (u.def.sight || 1) * (G.world.night ? .5 : 1); if (u.el) r *= 1.15; return r; }
function eRange(e) { let r = 31 * (e.def.sight || 1) * (G.world.night ? .7 : 1); if (e.el) r *= 1.1; return r; }
function lit(x, y) { return G.world.flares.some(f => Math.hypot(f.x - x, f.y - y) < f.r); }
function perceive() {
  const F = friends().filter(alive), E = foes().filter(alive);
  for (const e of E) {
    let s = false;
    if (lit(e.x, e.y)) s = true;
    else for (const u of F) { const conc = G.world.inBrush(e.x, e.y) ? .5 : 1; if (sees(u, e, fRange(u) * conc, FOV_F)) { s = true; break; } }
    if (!s && e.revealT > 0) for (const u of F) if (Math.hypot(u.x - e.x, u.y - e.y) < 62 && G.world.sightClear(u.x, u.y, e.x, e.y)) { s = true; break; }
    if (s && !e.spotted && !e.everSpotted) { e.everSpotted = 1; const d = e.def.veh ? 'TECHNICAL' : e.def.n.toUpperCase(); radio(`CONTACT! ${d}, ${clock(e)}.`, 'warn'); SFX.play('contact'); }
    e.spotted = s; if (s) { e.lastSpotT = G.t; e.lastPos = { x: e.x, y: e.y }; }
    // enemy perception of the squad
    let vis = null, vd = 1e9;
    for (const u of [...F, ...friends().filter(f => f.state === 'down')]) { const conc = G.world.inBrush(u.x, u.y) ? .55 : 1; const d = Math.hypot(u.x - e.x, u.y - e.y); if (d < vd && sees(e, u, eRange(e) * conc, e.alert ? FOV_E + .6 : FOV_E)) { vis = u; vd = d; } }
    if (vis) { alertEnemy(e, vis); e.seeT = G.t; }
  }
}
function clock(e) { const c = friends().filter(alive); if (!c.length) return ''; const cx = c.reduce((a, u) => a + u.x, 0) / c.length, cy = c.reduce((a, u) => a + u.y, 0) / c.length; const a = Math.atan2(e.y - cy, e.x - cx) + Math.PI / 2; let h = Math.round(wrapA(a) / TAU * 12); if (h <= 0) h += 12; return `${h} o'clock, ${Math.round(Math.hypot(e.x - cx, e.y - cy))} metres`; }
function alertEnemy(e, u) { if (!e.alert) { e.alert = 1; e.morale = Math.min(e.morale, 100); } e.threat = { x: u.x, y: u.y, id: u.id, t: G.t }; for (const o of foes()) if (alive(o) && o !== e && !o.alert && Math.hypot(o.x - e.x, o.y - e.y) < 22) { o.alert = 1; o.threat = { x: u.x, y: u.y, id: u.id, t: G.t }; } }

/* ---------------- combat ---------------- */
function canShoot(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y); return d <= a.w.rng && G.world.shotClear(a.x, a.y, b.x, b.y); }
function pickTarget(u) {
  const E = u.side === 'F' ? foes() : [...friends()];
  if (u.side === 'F' && u.focus) { const f = byId(u.focus); if (f && alive(f) && f.spotted && canShoot(u, f)) return f; if (!f || !alive(f)) u.focus = null; }
  let best = null, bs = -1e9;
  for (const t of E) {
    if (!alive(t)) continue;
    if (u.side === 'F' && !t.spotted) continue;
    if (u.side === 'E' && !(t.id === (u.threat && u.threat.id) || sees(u, t, eRange(u) * 1.1, TAU))) continue;
    if (!canShoot(u, t)) continue;
    const d = Math.hypot(t.x - u.x, t.y - u.y); let s = 100 - d;
    if (u.side === 'F') { s += { mg: 25, rpg: 22, snp: 18, tec: 10 }[t.type] || 0; if (u.sector != null && angDiff(Math.atan2(t.y - u.y, t.x - u.x), u.sector) < 1.0) s += 30; }
    else { const c = G.world.coverAt(t.x, t.y, u.x, u.y); s += (1 - c) * 25; if (t.carry || t.task) s += 15; }
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}
function fireTick(u, dt) {
  if (u.stun > 0) return;
  u.cd -= dt;
  const t = u.target && byId(u.target);
  if (!t || !alive(t)) { u.target = null; u.burst = 0; return; }
  const want = Math.atan2(t.y - u.y, t.x - u.x); u.aimFace = want;
  if (angDiff(u.face, want) > .3) return;
  if (u.w.aim && u.burst === 0 && u.cd <= 0) { u.aimT += dt; if (u.aimT < u.w.aim) return; } // sniper glint telegraph
  if (u.burst === 0 && u.cd <= 0) { u.burst = u.w.burst; u.shotT = 0; u.aimT = 0; }
  if (u.burst > 0) { u.shotT -= dt; if (u.shotT <= 0) { u.shotT = 1 / u.w.rof; u.burst--; shoot(u, t); if (u.burst === 0) u.cd = u.w.rest * rr(.8, 1.25) * (u.side === 'E' ? G.diff.think : 1) * (u.supp > 60 ? 1.8 : 1); } }
}
function shoot(a, t) {
  const w = a.w, d = Math.hypot(t.x - a.x, t.y - a.y);
  if (w.proj) { G.proj.push({ k: 'rpg', x: a.x, y: a.y, sx: a.x, sy: a.y, tx: t.x + rr(-2.5, 2.5) * (1 - w.acc), ty: t.y + rr(-2.5, 2.5) * (1 - w.acc), t: 0, T: d / 34, owner: a.id }); a.revealT = 2; muzzle(a, '#ffb35a'); SFX.play('rpg', a); if (a.side === 'E') radio('RPG!', 'bad'); return; }
  const cov = G.world.coverAt(t.x, t.y, a.x, a.y);
  let p = w.acc * (a.side === 'E' ? G.diff.acc : 1) * (1 - .55 * Math.pow(Math.min(1, d / w.rng), 1.5));
  if (a.side === 'F') p *= d < 20 ? a.optic.near : d > 28 ? a.optic.far : 1;
  p *= 1 - a.supp / 100 * .6; if (a.moving) p *= .62; if (t.moving) p *= .86;
  p *= cov >= 1 ? .22 : cov > 0 ? .55 : 1;
  if (G.world.inBrush(t.x, t.y) && d > 10) p *= .6;
  if (a.el > t.el) p *= 1.15;
  if (!G.world.sightClear(a.x, a.y, t.x, t.y)) p *= .35; // firing blind into smoke / brush
  if (t.def.veh) p *= 1.4;
  const hit = Math.random() < p;
  a.side === 'F' ? G.stats.shots++ : G.stats.eShots++;
  let ex = t.x, ey = t.y;
  if (!hit) { const off = rr(.8, 2.6) * (Math.random() < .5 ? -1 : 1), ang = Math.atan2(t.y - a.y, t.x - a.x); ex = t.x + Math.cos(ang + Math.PI / 2) * off + Math.cos(ang) * rr(0, 3); ey = t.y + Math.sin(ang + Math.PI / 2) * off + Math.sin(ang) * rr(0, 3);
    if (cov > 0) { const c = G.world.coverObs.find(o => clipRect(t.x, t.y, a.x, a.y, o) && Math.hypot(o.x + o.w / 2 - t.x, o.y + o.h / 2 - t.y) < 6); if (c) { const r = clipRect(a.x, a.y, t.x, t.y, c); if (r) { ex = a.x + (t.x - a.x) * r[0]; ey = a.y + (t.y - a.y) * r[0]; } } } }
  G.tracers.push({ x1: a.x + Math.cos(a.face) * .9, y1: a.y + Math.sin(a.face) * .9, x2: ex, y2: ey, t: 0, c: a.side === 'F' ? '#ffd27a' : '#ff6b6b', big: w === WPN.hmg || w === WPN.dmr || w === WPN.svd });
  impact(ex, ey, hit ? 'flesh' : 'dirt');
  muzzle(a); a.revealT = G.world.night ? 2.5 : 1.3; if (a.type === 'snp') a.shotsFired = (a.shotsFired || 0) + 1;
  if (a.side === 'E' && a.type !== 'tec') SFX.play(w.snd, a); else SFX.play(w.snd, a);
  // suppression: the target and anyone near the impact
  const sup = w.sup * (cov >= 1 ? .6 : 1) * (a.side === 'E' ? G.diff.acc : 1);
  for (const v of G.units) if (alive(v) && v.side !== a.side) { const dd = Math.hypot(v.x - ex, v.y - ey); if (v === t || dd < 3) { v.supp = Math.min(100, v.supp + (v === t ? sup : sup * .5)); v.uf = 3; if (v.side === 'E') { alertEnemy(v, a); } } }
  for (const v of friends()) if (v.state === 'down' && Math.hypot(v.x - ex, v.y - ey) < 4) v.uf = 3;
  if (hit) {
    let dmg = w.dmg * rr(.8, 1.2) * (a.side === 'E' ? G.diff.dmg : 1) * (t.dmgK || 1);
    if (t.def.veh) dmg *= .22;
    t.hp -= dmg; if (a.side === 'F') G.stats.hits++;
    if (t.side === 'F') { if (cov === 0) G.stats.openHits++; else G.stats.coverHits++; if (t.task && t.task.k === 'treat') G.stats.rescuerHit++; if (isDoorway(t)) G.stats.doorHits++; buzz(30); }
    if (t.hp <= 0) onKilled(t, a, cov);
  }
}
function isDoorway(u) { return G.world.obs.some(o => o.t === 'door' && o.open && ptInRect(u.x, u.y, o, 1.2)) || G.world.obs.some(o => o.t === 'floor' && (Math.abs(u.x - o.x) < 1 || Math.abs(u.x - o.x - o.w) < 1 || Math.abs(u.y - o.y) < 1 || Math.abs(u.y - o.y - o.h) < 1) && ptInRect(u.x, u.y, o, .6)); }
function onKilled(t, a, cov) {
  if (t.side === 'F') { goDown(t); return; }
  t.state = 'dead'; t.hp = 0; if (a) a.kills++; G.stats.kills++;
  if (t.supp > 50) G.stats.suppKills++;
  if (a && cov === 0 && G.world.coverNodes.some(n => Math.hypot(n.x - t.x, n.y - t.y) < 1.4)) G.stats.flankKills++;
  for (const o of foes()) if (alive(o) && Math.hypot(o.x - t.x, o.y - t.y) < 16) o.morale -= 22;
  G.decals.push({ x: t.x, y: t.y, k: t.def.veh ? 'burn' : 'blood', r: rr(.6, 1) });
  if (t.def.veh) { explode(t.x, t.y, 4, 40, 40, a && a.id, true); radio('Technical destroyed!', 'good'); }
  else if (Math.random() < .5) radio(pick(['Tango down.', 'Got him.', 'Hostile down.', 'Target neutralized.']), 'good');
}
function explode(x, y, r, dmg, sup, owner, quiet) {
  G.shake = Math.max(G.shake, .6); SFX.play('boom'); buzz(60);
  for (let i = 0; i < 26; i++) G.parts.push({ x, y, vx: rr(-1, 1) * 9, vy: rr(-1, 1) * 9, l: rr(.4, .9), L: .9, c: pick(['#ffb35a', '#ff7a2a', '#fff2c0', '#3a3a3a']), s: rr(.2, .6) });
  G.fx.push({ k: 'ring', x, y, r: .5, R: r * 1.6, t: 0, T: .45 }); G.decals.push({ x, y, k: 'scorch', r: r * .55 });
  for (const v of G.units) {
    if (v.state !== 'ok') continue; const d = Math.hypot(v.x - x, v.y - y);
    if (d < r * 2.2) { v.supp = Math.min(100, v.supp + sup * (1 - d / (r * 2.2))); v.uf = 3; if (v.side === 'E' && owner) { const o = byId(owner); o && alertEnemy(v, o); } }
    if (d < r && !(G.world.coverAt(v.x, v.y, x, y) >= 1 && d > 1.2)) { let k = (1 - d / r) * dmg * (v.def.veh ? 2.6 : 1) * (v.dmgK || 1); v.hp -= k; if (v.hp <= 0) onKilled(v, owner && byId(owner), 0); }
  }
  for (const v of friends()) if (v.state === 'down' && Math.hypot(v.x - x, v.y - y) < r * 2) v.uf = 3;
}
function muzzle(a, c) { G.fx.push({ k: 'flash', x: a.x + Math.cos(a.face) * 1.1, y: a.y + Math.sin(a.face) * 1.1, a: a.face, t: 0, T: .06, c: c || '#fff2b0' }); }
function impact(x, y, k) { for (let i = 0; i < (k === 'flesh' ? 5 : 3); i++) G.parts.push({ x, y, vx: rr(-3, 3), vy: rr(-3, 3), l: rr(.15, .35), L: .35, c: k === 'flesh' ? '#b4232f' : '#b9a27a', s: rr(.1, .22) }); }

/* ---------------- enemy AI ---------------- */
function enemyThink(e) {
  const W = G.world; if (!e.alert || !e.threat) { // idle: face home direction, small look-around
    if (!e.lookT || G.t > e.lookT) { e.lookT = G.t + rr(2, 5); e.wantFace = (e.def.veh ? Math.PI / 2 : Math.PI / 2) + rr(-.7, .7); } return; }
  const th = e.threat, d = Math.hypot(th.x - e.x, th.y - e.y), cov = W.coverAt(e.x, e.y, th.x, th.y);
  if (e.def.veh) return;
  if (e.morale < 25 && !e.hold) { // fall back
    const c = W.bestCover(e.x, e.y, th.x, th.y, 16, foes().filter(o => o !== e).map(o => o.dest || o)); if (c && Math.hypot(c.x - th.x, c.y - th.y) > d + 3) { setPathE(e, c); if (!e.fleeMsg) { e.fleeMsg = 1; if (e.spotted) radio('Enemy falling back!', 'good'); } } return; }
  if (e.supp > 70) return; // pinned
  if (e.hold) { if (d < 7) e.hold = false; return; }
  if (e.path.length) return;
  if (e.type === 'flk') {
    if (!e.flankT) e.flankT = G.t + rr(3, 6);
    if (G.t > e.flankT) { const a = Math.atan2(e.y - th.y, e.x - th.x) + (e.flankSide || (e.flankSide = Math.random() < .5 ? 1 : -1)) * 1.1; const px = cl(th.x + Math.cos(a) * 12, 2, W.W - 2), py = cl(th.y + Math.sin(a) * 12, 2, W.H - 2);
      const c = W.bestCover(px, py, th.x, th.y, 10, foes().filter(o => o !== e).map(o => o.dest || o)); setPathE(e, c || { x: px, y: py }); e.flankT = G.t + rr(6, 10); }
    return;
  }
  if (cov < 1 && e.type !== 'snp') { const c = W.bestCover(e.x, e.y, th.x, th.y, e.type === 'mg' ? 7 : 11, foes().filter(o => o !== e).map(o => o.dest || o)); if (c && Math.hypot(c.x - e.x, c.y - e.y) > 1) { setPathE(e, c); return; } }
  if (e.type === 'snp' && (e.shotsFired || 0) >= 3) { e.shotsFired = 0; const c = W.bestCover(e.x, e.y, th.x, th.y, 12, []); if (c) setPathE(e, c); return; }
  if (e.type === 'rfl' && e.morale > 55 && e.supp < 25 && d > 18 && Math.random() < .35 * (1 / G.diff.think)) { // bound forward while friends cover
    const cover = foes().some(o => o !== e && alive(o) && o.target); if (!cover) return;
    const c = W.bestCover(e.x + (th.x - e.x) * .35, e.y + (th.y - e.y) * .35, th.x, th.y, 9, foes().filter(o => o !== e).map(o => o.dest || o)); if (c && Math.hypot(c.x - th.x, c.y - th.y) < d - 3) setPathE(e, c);
  }
}
function setPathE(e, c) { const p = G.world.path(e.x, e.y, c.x, c.y); if (p) { e.path = p; e.dest = { x: c.x, y: c.y }; } }

/* ---------------- main update ---------------- */
function simUpdate(rdt) {
  if (!G || G.paused || G.over) { if (G && G.over) fxUpdate(rdt); return; }
  const dt = rdt * (G.slow ? .25 : 1) * G.speed; G.t += dt;
  const W = G.world;
  // waves
  const waves = G.m.waves || []; while (G.waveI < waves.length && G.t >= waves[G.waveI].t) { for (const [t, x, y] of waves[G.waveI].e) { const e = mkUnit('E', t, x, y, {}); e.alert = 1; const tgt = friends().filter(alive)[0]; if (tgt) e.threat = { x: tgt.x, y: tgt.y, id: tgt.id, t: G.t }; if (e.def.veh) { e.drive = [{ x, y: Math.min(W.H * .55, y + 52) }]; radio('Vehicle approaching from the north! Technical with a heavy gun!', 'bad'); } G.units.push(e); } G.waveI++; }
  // smoke & flares
  for (const s of W.smokes) { s.r = Math.min(s.R, s.r + dt * 3.2); s.life -= dt; if (s.life < 3) s.r *= 1 - dt * .3; } W.smokes = W.smokes.filter(s => s.life > 0);
  for (const f of W.flares) f.life -= dt; W.flares = W.flares.filter(f => f.life > 0);
  // perception
  G.perceiveT -= dt; if (G.perceiveT <= 0) { G.perceiveT = .15; perceive(); }
  for (const u of G.units) {
    if (u.state === 'dead') continue;
    u.uf = Math.max(0, u.uf - dt); u.revealT = Math.max(0, u.revealT - dt); u.stun = Math.max(0, u.stun - dt); u.el = W.elev(u.x, u.y);
    if (u.state === 'down') { // casualty
      if (!(u.tq && u.inj === 'limb') && !u.stable) { u.bleed -= dt; if (u.bleed <= 0) kia(u); }
      if (u.carrier) { const c = byId(u.carrier); if (c && alive(c)) { u.x = c.x - Math.cos(c.face) * .9; u.y = c.y - Math.sin(c.face) * .9; } else u.carrier = null; }
      continue;
    }
    // suppression recovery (team leader nearby helps)
    const rally = u.side === 'F' && friends().some(f => f.type === 'TL' && alive(f) && f !== u && Math.hypot(f.x - u.x, f.y - u.y) < 10);
    u.supp = Math.max(0, u.supp - dt * (u.uf > 0 ? 4 : 14) * (rally ? 1.6 : 1));
    if (u.side === 'E') { u.morale = Math.min(100, u.morale + dt * 1.5); if (u.supp > 70) u.morale -= dt * 3; }
    if (u.side === 'F' && u.supp > 75 && !u.pinnedNoted) { u.pinnedNoted = 1; G.stats.pinned++; radio(`${u.name}: I'm pinned down!`, 'warn'); } if (u.supp < 40) u.pinnedNoted = 0;
    // AI think
    u.think -= dt; if (u.think <= 0) { u.think = rr(.5, 1.1) * (u.side === 'E' ? G.diff.think : 1); if (u.side === 'E') enemyThink(u); else friendThink(u); u.target = (pickTarget(u) || {}).id || null; }
    // tasks
    if (u.side === 'F' && u.task) { if (u.task.k === 'treat') careTick(u, dt); else if (u.task.k === 'breach') { const d0 = u.task.door; if (Math.hypot(d0.x + d0.w / 2 - u.x, d0.y + d0.h / 2 - u.y) < 3.2) { u.task.p = (u.task.p || 0) + dt; u.path = []; if (u.task.p > 1.6) doBreach(u, d0); } } }
    // vehicle driving
    if (u.drive && u.drive.length) { const wp = u.drive[0], d = Math.hypot(wp.x - u.x, wp.y - u.y); if (d < 1) u.drive.shift(); else { u.x += (wp.x - u.x) / d * u.spd * dt; u.y += (wp.y - u.y) / d * u.spd * dt; u.face = turnTo(u.face, Math.atan2(wp.y - u.y, wp.x - u.x), dt * 3); } }
    // movement
    u.moving = false;
    if (u.path.length && u.stun <= 0 && !(u.task && u.task.k === 'treat' && u.task.p > 0)) {
      const wp = u.path[0], d = Math.hypot(wp.x - u.x, wp.y - u.y);
      let sp = u.spd * (1 - u.supp / 100 * .55) * (u.carry ? .45 : 1) * (W.inBrush(u.x, u.y) ? .65 : 1);
      if (d < .25) u.path.shift(); else { const k = Math.min(1, sp * dt / d); u.x += (wp.x - u.x) * k; u.y += (wp.y - u.y) * k; u.moving = true; if (!u.target || u.carry) u.wantFace = Math.atan2(wp.y - u.y, wp.x - u.x); }
      if (!u.path.length) { u.dest = null; if (u.side === 'F' && !u.task) { const th = threatDir(u); u.wantFace = th ? Math.atan2(th.y - u.y, th.x - u.x) : u.face; } }
    }
    // facing
    let wf = u.target ? u.aimFace ?? u.wantFace : (u.sector != null && !u.moving ? u.sector : u.wantFace);
    if (u.side === 'E' && !u.target && u.alert && u.threat && !u.moving) wf = Math.atan2(u.threat.y - u.y, u.threat.x - u.x);
    if (wf != null) u.face = turnTo(u.face, wf, dt * (u.def.veh ? 2 : 6));
    if (u.target) fireTick(u, dt); else { u.burst = 0; u.cd = Math.max(u.cd - dt, 0); u.aimT = 0; }
      if (u.hp <= 0 && u.state === 'ok') onKilled(u, null, 0);
  }
  // separation
  const L = G.units.filter(u => u.state === 'ok' && !u.def.veh);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < .9 && d > 0) { const k = (.9 - d) / 2 / d, dx = (a.x - b.x) * k, dy = (a.y - b.y) * k; if (W.walkable(a.x + dx, a.y + dy)) { a.x += dx; a.y += dy; } if (W.walkable(b.x - dx, b.y - dy)) { b.x -= dx; b.y -= dy; } } }
  // projectiles
  for (const p of G.proj) { p.t += dt; const u = Math.min(1, p.t / p.T); p.x = lerp(p.sx, p.tx, u); p.y = lerp(p.sy, p.ty, u); p.h = Math.sin(u * Math.PI) * (p.k === 'rpg' ? .5 : p.k === 'gl' ? 2 : 4);
    if (u >= 1 && !p.done) { p.done = 1;
      if (p.k === 'frag') { p.fuse = .5; }
      else if (p.k === 'gl') explode(p.x, p.y, 3.6, 95, 55, p.owner);
      else if (p.k === 'rpg') explode(p.x, p.y, 3.8, 95 * G.diff.dmg, 60, p.owner);
      else if (p.k === 'smoke') { W.smokes.push({ x: p.x, y: p.y, r: 1, R: 6.5, life: 24 }); SFX.play('smoke'); }
      else if (p.k === 'flare') { W.flares.push({ x: p.x, y: p.y, r: 18, life: 24 }); } }
    if (p.fuse != null) { p.fuse -= dt; if (p.fuse <= 0) { explode(p.x, p.y, 4.6, 110, 70, p.owner); p.gone = 1; } } else if (p.done) p.gone = 1; }
  G.proj = G.proj.filter(p => !p.gone);
  if (G.march) { const md = byId(G.march.med); if (!md || !alive(md) || !md.task || md.task.k !== 'treat') { G.march = null; UI.closeMarch && UI.closeMarch(); } }
  // helicopter (CASEVAC)
  if (G.heli) { G.heli.t += dt; if (G.heli.t > 6 && !G.heli.done) { G.heli.done = 1; finish(true); } }
  fxUpdate(rdt);
  checkObjectives();
}
function friendThink(u) {
  // auto-cover when pinned in the open and not under orders
  if (u.supp > 55 && !u.path.length && !u.task && !u.carry) {
    const th = threatDir(u); if (th && G.world.coverAt(u.x, u.y, th.x, th.y) === 0 && (!u.autoT || G.t > u.autoT)) { u.autoT = G.t + 4; const c = G.world.bestCover(u.x, u.y, th.x, th.y, 6, friends().filter(f => f !== u).map(f => f.dest || f)); if (c) { orderPathRaw(u, c.x, c.y); radio(`${u.name}: moving to cover!`, 'cmd'); } }
  }
  // medic reacts to casualties only when it is safe (teaches CUF)
  if (isMedic(u) && !u.task && !u.path.length) {
    const c = friends().find(f => f.state === 'down' && !f.stable && f.uf <= 0 && Math.hypot(f.x - u.x, f.y - u.y) < 25 && !friends().some(o => o.task && o.task.id === f.id));
    if (c) { orderTreat(u, c); radio(`${u.name}: moving to ${c.name}.`, 'cmd'); }
  }
}
function fxUpdate(dt) {
  for (const t of G.tracers) t.t += dt; G.tracers = G.tracers.filter(t => t.t < .12);
  for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.T);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; p.l -= dt; } G.parts = G.parts.filter(p => p.l > 0);
  G.shake = Math.max(0, G.shake - dt * 1.5); for (const m of G.msgs) m.life -= dt;
  if (G.decals.length > 120) G.decals.splice(0, G.decals.length - 120);
}

/* ---------------- objectives & scoring ---------------- */
function inZone(u, z) { return z && Math.hypot(u.x - z.x, u.y - z.y) < z.r; }
function checkObjectives() {
  const m = G.m, o = m.obj, F = friends(), ok = F.filter(alive), E = foes().filter(alive), Z = G.world.zones;
  if (!ok.length) return finish(false, 'The whole team is down.');
  if (m.timer && G.t >= m.timer && o.type !== 'survive') return finish(false, 'Out of time. Reinforcements arrived.');
  const pendingWaves = (m.waves || []).length > G.waveI;
  if (o.type === 'kill' && !E.length && !pendingWaves) return finish(true);
  if (o.type === 'killreach') { const k = foes().find(e => e.key === o.key); if (k && k.state !== 'ok' && ok.some(u => inZone(u, Z[o.zone]))) return finish(true); }
  if (o.type === 'survive') { if (ok.length < o.min) return finish(false, 'Too few left to hold the position.'); if (G.t >= m.timer) return finish(true); }
  if (o.type === 'casevac') { const p = F.find(u => u.key === 'patient'); if (!p || p.state === 'dead') return finish(false, `${p ? p.name : 'The casualty'} did not make it.`);
    if (!p.stable && inZone(p, Z[o.zone]) && !G.lzHint) { G.lzHint = 1; radio('LZ: the bird won\'t lift an unstable casualty. Medic needs to finish MARCH first.', 'warn'); }
    if (!G.heli && p.stable && inZone(p, Z[o.zone])) { G.heli = { t: 0, x: Z[o.zone].x, y: Z[o.zone].y }; radio('CASEVAC inbound, 6 seconds. Keep the LZ covered!', 'good'); SFX.play('heli'); } }
  if (o.type === 'exfil') { const living = F.filter(u => u.state !== 'dead'); if (ok.length < o.min) return finish(false, 'Too few operators left to break through.'); if (living.every(u => inZone(u, Z[o.zone]))) return finish(true); }
}
function finish(win, why) {
  if (G.over) return; G.over = true; G.result = { win, why, t: G.t };
  const s = G.stats, m = G.m, kia = s.kia + friends().filter(u => u.state === 'down' && !u.stable && !(u.tq && u.inj === 'limb')).length * 0;
  const stars = [win, win && s.kia === 0, win && third(m, s)];
  G.result.stars = stars.filter(Boolean).length; G.result.third = thirdText(m);
  SFX.play(win ? 'win' : 'lose'); buzz(win ? [40, 60, 40, 60, 160] : [300]);
  if (UI.onFinish) setTimeout(() => UI.onFinish(G.result), 900);
}
function third(m, s) {
  if (m.id === 4) return s.kills >= 12;
  if (m.id === 5) return (s.marchPerfect || 0) > 0 && s.down === 0;
  if (m.id === 3) return G.t <= m.par;
  return G.t <= m.par;
}
function thirdText(m) { if (m.id === 4) return '12+ kills'; if (m.id === 5) return 'Perfect MARCH, no new casualties'; return `Finish under ${fmtT(m.par)}`; }
/* debrief lessons, built from what actually happened */
function lessons() {
  const s = G.stats, L = [];
  const acc = s.shots ? s.hits / s.shots : 0;
  if (s.openHits > s.coverHits && s.openHits >= 2) L.push(['Cover', `${s.openHits} of your hits were taken in the open. End every move behind something solid. Watch for the shield icon when you draw a route.`, 'bad']);
  else if (s.coverHits + s.openHits > 0) L.push(['Cover', 'Most fire you took landed while you were in cover. Good habits.', 'good']);
  if (s.cufAttempts) L.push(['Care Under Fire', `Field care was attempted under effective fire ${s.cufAttempts} time${s.cufAttempts > 1 ? 's' : ''}. Under fire, only tourniquets are applied. Win the firefight or drag the casualty to cover first.`, 'bad']);
  if (s.rescuerHit) L.push(['Rescuer safety', `A rescuer was hit ${s.rescuerHit} time${s.rescuerHit > 1 ? 's' : ''} while helping a casualty. Suppress first, or use smoke, so you don't create a second casualty.`, 'bad']);
  if (s.marchErr) L.push(['MARCH order', `${s.marchErr} step${s.marchErr > 1 ? 's were' : ' was'} done out of order. Massive bleeding, Airway, Respiration, Circulation, Hypothermia/Head: what kills fastest comes first.`, 'bad']);
  else if (s.marchDone) L.push(['MARCH order', 'Field care done in the correct order.', 'good']);
  if (s.suppKills >= 2) L.push(['Fire and maneuver', `${s.suppKills} enemies were killed while suppressed. Pinning them down made them easy targets.`, 'good']);
  if (s.flankKills >= 2) L.push(['Flanking', `${s.flankKills} enemies died with their cover facing the wrong way. You hit them from the side.`, 'good']);
  if (s.pinned >= 2 && s.suppKills === 0) L.push(['Suppression', 'Your team got pinned repeatedly. Put your machine gun on the shooter to win the volume of fire before you move.', 'bad']);
  if (s.doorHits) L.push(['Fatal funnel', `${s.doorHits} hit${s.doorHits > 1 ? 's' : ''} landed on soldiers in doorways. Move through, never stop in the door.`, 'bad']);
  if (G.m.night && !s.flares) {}
  if (G.m.id === 4 && s.sectors < 3) L.push(['Sectors of fire', 'Only a few sectors were assigned. Long-press the ground so every soldier covers a different direction.', 'bad']);
  if (G.m.id === 6 && !s.smoke) L.push(['Smoke', 'No smoke used. Smoke between you and a shooter lets you cross open ground.', 'bad']);
  L.push(['Marksmanship', `Hit rate ${Math.round(acc * 100)}% (${s.hits}/${s.shots}). Moving fire and suppressed shooters miss a lot. Stop and fire from cover.`, acc > .3 ? 'good' : 'mid']);
  return L;
}
function buzz(p) { try { if (UI.set && UI.set.hap && navigator.vibrate) navigator.vibrate(p); } catch (e) { } }
