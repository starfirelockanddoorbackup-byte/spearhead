'use strict';
/* SPEARHEAD // editor — sandbox scenario builder */
const ED = {
  on: false, tool: 'wall', m: null, drag: null, ptr: new Map(),
  TOOLS: [['wall', 'Wall'], ['sand', 'Sandbags'], ['crate', 'Crates'], ['brush', 'Brush'], ['wreck', 'Wreck'], ['bldg', 'Building'], ['house', 'House+door'],
          ['e:rfl', '+ Rifle'], ['e:mg', '+ MG'], ['e:rpg', '+ RPG'], ['e:snp', '+ Sniper'], ['e:flk', '+ Flanker'], ['start', 'Squad start'], ['exfil', 'Exfil zone'], ['erase', 'Erase'], ['pan', 'Pan']],
  blank() { return { id: 99, name: 'Sandbox', tag: 'CUSTOM SCENARIO', W: 50, H: 90, par: 180, lesson: 'Your scenario, your rules.', brief: ['A custom scenario built in the sandbox editor.'], obj: { type: 'kill' }, objText: 'Eliminate all hostiles',
    squad: { budget: 12, slots: 5, def: ['TL', 'AR', 'RFL', 'MED', 'DM'], start: { x: 25, y: 84 } }, map: [], houses: [], enemies: [], zones: {}, night: 0 }; },
  open(back) {
    this.m = this.m || UI.data.sandbox || this.blank(); this.on = true; UI.hideScr(); $('#hud').hidden = true; this.rebuild(true); this.ui();
  },
  close() { this.on = false; const e = $('#ed'), t = $('#edTop'); e && e.remove(); t && t.remove(); if (G && G.editor) G = null; },
  playable() {
    const m = JSON.parse(JSON.stringify(this.m)); m.map = [...m.map]; for (const h of m.houses || []) m.map.push(...building(h.x, h.y, h.w, h.h, [['s', Math.round(h.w / 2), 'open'], ['n', Math.round(h.w / 2), 'locked']]));
    if (m.zones.exfil) { m.obj = { type: 'exfil', zone: 'exfil', min: 1 }; m.objText = 'Get everyone to EXFIL'; } else if (m.survive) { m.obj = { type: 'survive', min: 1 }; m.timer = 120; m.objText = 'Hold for 2:00'; } else { m.obj = { type: 'kill' }; m.objText = 'Eliminate all hostiles'; }
    return m;
  },
  rebuild(fit) {
    const m = this.playable(); const cx = CAM.x, cy = CAM.y, cz = CAM.z;
    newGame(m, [], {}); G.editor = true; for (const e of foes()) { e.spotted = true; e.everSpotted = 1; }
    resize(); if (fit) fitCam(m.W / 2, m.H / 2 + 8); else { CAM.x = cx; CAM.y = cy; CAM.z = cz; }
  },
  ui() {
    $('#ed') && $('#ed').remove(); $('#edTop') && $('#edTop').remove();
    const top = document.createElement('div'); top.id = 'edTop'; top.textContent = 'SANDBOX EDITOR // drag to draw walls & areas · tap to place · two fingers to pan/zoom'; document.body.appendChild(top);
    const d = document.createElement('div'); d.id = 'ed';
    d.innerHTML = `<div class="tools">${this.TOOLS.map(([k, n]) => `<button class="${this.tool === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div>
     <div class="row"><button id="edNight">${this.m.night ? 'Night ✓' : 'Day'}</button><button id="edObj">${this.m.zones.exfil ? 'Goal: Exfil' : this.m.survive ? 'Goal: Survive' : 'Goal: Kill all'}</button><button id="edClr">Clear</button><button id="edExit">Exit</button><button class="pri" id="edGo">TEST ▶</button></div>`;
    document.body.appendChild(d);
    for (const b of d.querySelectorAll('.tools button')) b.onclick = () => { this.tool = b.dataset.k; SFX.unlock(); SFX.play('ui'); this.ui(); };
    $('#edNight').onclick = () => { this.m.night = this.m.night ? 0 : 1; this.save(); this.rebuild(); this.ui(); };
    $('#edObj').onclick = () => { if (this.m.zones.exfil) { delete this.m.zones.exfil; this.m.survive = 1; } else if (this.m.survive) { this.m.survive = 0; } else { this.m.zones.exfil = { x: this.m.W / 2, y: 6, r: 6, label: 'EXFIL' }; } this.save(); this.rebuild(); this.ui(); };
    $('#edClr').onclick = e => { const b = e.target; if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Sure?'; return; } this.m = this.blank(); this.save(); this.rebuild(true); this.ui(); };
    $('#edExit').onclick = () => { this.close(); UI.title(); };
    $('#edGo').onclick = () => { if (!this.m.enemies.length && !this.m.zones.exfil && !this.m.survive) { UI.toast('Add at least one enemy (or an exfil zone)'); return; } const m = this.playable(); this.close(); UI.brief(m); };
  },
  save() { UI.data.sandbox = this.m; UI.save(); },
  snap(v) { return Math.round(v * 2) / 2; },
  place(a, b) {
    const m = this.m, t = this.tool, x0 = this.snap(Math.min(a.x, b.x)), y0 = this.snap(Math.min(a.y, b.y)); let w = this.snap(Math.abs(b.x - a.x)), h = this.snap(Math.abs(b.y - a.y));
    if (['wall', 'sand'].includes(t)) { if (w >= h) h = 1; else w = 1; w = Math.max(w, 1); h = Math.max(h, 1); m.map.push(O(t, x0, y0, w, h)); }
    else if (['brush', 'bldg'].includes(t)) { if (w < 2 || h < 2) { w = Math.max(w, t === 'bldg' ? 8 : 5); h = Math.max(h, t === 'bldg' ? 8 : 5); } m.map.push(O(t, x0, y0, w, h)); }
    else if (t === 'house') { w = Math.max(w, 10); h = Math.max(h, 8); m.houses.push({ x: x0, y: y0, w, h }); }
    else if (t === 'crate') m.map.push(O('crate', this.snap(b.x - 1), this.snap(b.y - 1), 2, 2));
    else if (t === 'wreck') m.map.push(O('wreck', this.snap(b.x - 2.5), this.snap(b.y - 1.2), 5, 2.4));
    else if (t.startsWith('e:')) m.enemies.push({ t: t.slice(2), x: b.x, y: b.y });
    else if (t === 'start') m.squad.start = { x: b.x, y: b.y };
    else if (t === 'exfil') m.zones.exfil = { x: b.x, y: b.y, r: 6, label: 'EXFIL' };
    else if (t === 'erase') {
      const ei = m.enemies.findIndex(e => Math.hypot(e.x - b.x, e.y - b.y) < 2); if (ei >= 0) m.enemies.splice(ei, 1);
      else { const hi = m.houses.findIndex(o => ptInRect(b.x, b.y, o, .5)); if (hi >= 0) m.houses.splice(hi, 1); else { const oi = m.map.findIndex(o => ptInRect(b.x, b.y, o, .6)); if (oi >= 0) m.map.splice(oi, 1); else if (m.zones.exfil && Math.hypot(m.zones.exfil.x - b.x, m.zones.exfil.y - b.y) < 6) delete m.zones.exfil; } }
    }
    SFX.play('ui'); this.save(); this.rebuild(); this.ui();
  },
  overlay(c) {
    if (!this.on || !G) return; const s = this.m.squad.start, [x, y] = w2s(s.x, s.y);
    c.fillStyle = 'rgba(56,189,248,.18)'; c.strokeStyle = '#38bdf8'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 3 * CAM.z, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#38bdf8'; c.font = '800 12px system-ui'; c.textAlign = 'center'; c.fillText('SQUAD START', x, y + 4);
    if (this.drag && this.drag.b) { const [ax, ay] = w2s(this.drag.a.x, this.drag.a.y), [bx, by] = w2s(this.drag.b.x, this.drag.b.y); c.strokeStyle = '#fbbf24'; c.setLineDash([5, 4]); c.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); c.setLineDash([]); }
  }
};
cv.addEventListener('pointerdown', e => { if (!ED.on) return; const p = evW(e); ED.ptr.set(e.pointerId, p); if (ED.ptr.size === 2) { ED.drag = null; const [a, b] = [...ED.ptr.values()]; ED.pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), z: CAM.z, mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2, cx: CAM.x, cy: CAM.y }; return; } ED.drag = { a: { x: p.wx, y: p.wy }, s: p }; });
cv.addEventListener('pointermove', e => { if (!ED.on || !ED.ptr.has(e.pointerId)) return; const p = evW(e); ED.ptr.set(e.pointerId, p);
  if (ED.ptr.size >= 2 && ED.pinch) { const [a, b] = [...ED.ptr.values()], P = ED.pinch, d = Math.hypot(a.sx - b.sx, a.sy - b.sy); CAM.z = cl(P.z * d / P.d, 4, 30); CAM.x = P.cx - ((a.sx + b.sx) / 2 - P.mx) / CAM.z; CAM.y = P.cy - ((a.sy + b.sy) / 2 - P.my) / CAM.z; clampCam(); return; }
  if (!ED.drag) return; if (ED.tool === 'pan') { CAM.x -= (p.sx - ED.drag.s.sx) / CAM.z; CAM.y -= (p.sy - ED.drag.s.sy) / CAM.z; ED.drag.s = p; clampCam(); return; } ED.drag.b = { x: p.wx, y: p.wy }; });
cv.addEventListener('pointerup', e => { if (!ED.on) return; const p = ED.ptr.get(e.pointerId); ED.ptr.delete(e.pointerId); if (ED.ptr.size) return; ED.pinch = null; const d = ED.drag; ED.drag = null; if (!d || !p || ED.tool === 'pan') return; ED.place(d.a, { x: p.wx, y: p.wy }); });
