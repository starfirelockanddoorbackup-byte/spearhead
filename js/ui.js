'use strict';
/* SPEARHEAD // ui — screens, HUD, MARCH sheet, debrief, manual, settings */
const KEY = 'spearhead.v2';
const UI = {
  data: { stars: {}, squads: {}, sandbox: null },
  set: { snd: 1, hap: 1, diff: 'regular', all: 0 },
  load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) { Object.assign(this.data, d.data || {}); Object.assign(this.set, d.set || {}); } } catch (e) { } },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ data: this.data, set: this.set })); } catch (e) { } },
  scr(html, dim) { const s = $('#scr'); s.hidden = false; s.className = dim ? 'dim' : ''; s.innerHTML = `<div class="wrap">${html}</div>`; s.scrollTop = 0; },
  hideScr() { $('#scr').hidden = true; },
  toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 1800); }
};
const LOGO = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#38bdf8" stroke-width="2" fill="none"><polygon points="12 2 22 22 2 22"/><line x1="12" y1="9" x2="12" y2="16"/></svg>`;
const brand = () => `<div class="brand"><div class="logo">${LOGO}</div><div><span class="tag">FUTURELAB // R&amp;D</span><div class="sub" style="margin-top:3px">Matthews Operations Lab</div></div></div>`;
const starsHTML = n => `<span class="stars">${[0, 1, 2].map(i => `<span class="${i < n ? 'on' : ''}">★</span>`).join('')}</span>`;

/* ---------- title / menus ---------- */
UI.title = function () {
  G = null; $('#hud').hidden = true; if (typeof ED !== 'undefined') ED.close();
  const total = Object.values(this.data.stars).reduce((a, b) => a + b, 0);
  this.scr(`${brand()}
   <div class="title">SPEARHEAD</div><div class="title2">TACTICAL KINETIC SIMULATOR // v2.0</div>
   <p class="lead">Lead a fireteam through six live-fire problems. Learn why cover beats concealment, how suppression lets you move, and how to keep a wounded teammate alive under fire.</p>
   <button class="btn pri" onclick="UI.missions()">Missions <small>${total}/18 stars earned</small></button>
   <button class="btn" onclick="ED.open()">Sandbox editor <small>Build and test your own scenario</small></button>
   <div class="row"><button class="btn" onclick="UI.manual('title')">Field manual</button><button class="btn" onclick="UI.settings('title')">Settings</button></div>
   <div class="foot">FUTURELAB R&amp;D PROTOTYPE // MATTHEWS OPERATIONS LAB<br>Training game. Not a substitute for certified TCCC or tactics instruction.<br><a href="legacy.html" style="color:#4b5867">v1 legacy build</a></div>`);
};
UI.missions = function () {
  const cards = MISSIONS.map((m, i) => { const st = this.data.stars[m.id] || 0, open = this.set.all || i === 0 || (this.data.stars[MISSIONS[i - 1].id] || 0) > 0;
    return `<button class="mcard ${open ? '' : 'lock'}" ${open ? `onclick="UI.brief(${m.id})"` : 'onclick="UI.toast(\'Earn a star on the previous mission first\')"'}><div class="no">${m.id}</div><div class="i"><b>${m.name}</b><span>${m.tag}</span></div>${open ? starsHTML(st) : '🔒'}</button>`; }).join('');
  this.scr(`${brand()}<h2>Missions</h2><p class="card" style="font-size:13.5px;color:var(--mu);margin-top:8px">Each mission teaches one idea. ★ win · ★ no one killed · ★ mission challenge</p>${cards}<button class="btn" onclick="UI.title()">Back</button>`);
};
const cfgFor = m => {
  const saved = UI.data.squads[m.id];
  if (saved && saved.length <= m.squad.slots) return saved.map(s => Object.assign({ load: { armor: 'plate', optic: 'iron', extra: 'none' } }, s));
  return m.squad.def.map(r => ({ role: r, load: { armor: 'plate', optic: 'iron', extra: 'none' } }));
};
UI.brief = function (id) {
  const m = typeof id === 'object' ? id : MISSIONS.find(q => q.id === id); this.cur = m; this.cfg = cfgFor(m); this.renderBrief();
};
UI.renderBrief = function () {
  const m = this.cur, cfg = this.cfg, used = cfg.reduce((a, s) => a + FR[s.role].pts, 0), over = used > m.squad.budget;
  const roles = Object.keys(FR).filter(r => r !== 'TL');
  const cyc = (i, k, opts) => `<button onclick="UI.cy(${i},'${k}')">${opts}</button>`;
  const slots = cfg.map((s, i) => { const R = FR[s.role]; return `<div class="slot"><div class="rb" style="background:${R.col}">${s.role}</div>
    <div class="nm">${R.n}<small>${R.pts ? R.pts + ' PTS' : 'LEADER'}</small></div>
    <div class="cy">${i ? `<button class="r" onclick="UI.cy(${i},'role')">Change role ↻</button>` : ''}${cyc(i, 'armor', LOAD.armor[s.load.armor].n)}${cyc(i, 'optic', LOAD.optic[s.load.optic].n)}${cyc(i, 'extra', LOAD.extra[s.load.extra].n)}${i ? `<button onclick="UI.rm(${i})">✕</button>` : ''}</div></div>`; }).join('');
  this.scr(`<div class="mono" style="color:var(--ac);font-size:11px;letter-spacing:.12em">MISSION ${m.id === 99 ? 'SANDBOX' : m.id} // ${m.tag}</div><h2>${m.name}</h2>
   <div class="card"><p class="lessonq">${m.lesson}</p></div>
   <div class="card">${m.brief.map(p => `<p>${p}</p>`).join('')}</div>
   <h3 class="sec">OBJECTIVE</h3><div class="card"><div class="goal"><i class="on">★</i>${m.objText}</div><div class="goal"><i class="on">★</i>No one killed in action</div><div class="goal"><i class="on">★</i>${thirdText(m)}</div></div>
   <h3 class="sec">FIRETEAM // ${cfg.length}/${m.squad.slots} SLOTS</h3>
   <div class="pts ${over ? 'over' : ''}"><span>POINTS</span><span>${used} / ${m.squad.budget}</span></div>
   ${slots}
   ${cfg.length < m.squad.slots ? `<button class="btn" onclick="UI.add()">+ Add soldier</button>` : ''}
   <p class="card" style="font-size:12.5px;color:var(--mu)">${roles.map(r => `<b style="color:${FR[r].col}">${r}</b> ${FR[r].n}: ${FR[r].d}`).join('<br>')}</p>
   <button class="btn pri" ${over ? 'disabled style="opacity:.4"' : ''} onclick="UI.go()">Deploy</button>
   <button class="btn" onclick="${m.id === 99 ? 'ED.open(true)' : 'UI.missions()'}">Back</button>`);
};
UI.cy = function (i, k) {
  const s = this.cfg[i];
  if (k === 'role') { const r = Object.keys(FR).filter(x => x !== 'TL'); s.role = r[(r.indexOf(s.role) + 1) % r.length]; }
  else { const keys = Object.keys(LOAD[k]); s.load[k] = keys[(keys.indexOf(s.load[k]) + 1) % keys.length]; }
  SFX.unlock(); SFX.play('ui'); const y = $('#scr').scrollTop; this.renderBrief(); $('#scr').scrollTop = y;
};
UI.add = function () { this.cfg.push({ role: 'RFL', load: { armor: 'plate', optic: 'iron', extra: 'none' } }); const y = $('#scr').scrollTop; this.renderBrief(); $('#scr').scrollTop = y; };
UI.rm = function (i) { this.cfg.splice(i, 1); const y = $('#scr').scrollTop; this.renderBrief(); $('#scr').scrollTop = y; };
UI.go = function () {
  const m = this.cur; if (m.id !== 99) { this.data.squads[m.id] = this.cfg.map(s => ({ role: s.role, load: { ...s.load } })); this.save(); }
  SFX.unlock(); this.start(m, this.cfg);
};
UI.start = function (m, cfg) {
  this.hideScr(); newGame(m, cfg, { diff: this.set.diff }); resize(); const s = m.squad.start; fitCam(s.x, s.y);
  $('#hud').hidden = false; $('#mName').textContent = `${m.id === 99 ? 'SANDBOX' : 'M' + m.id} // ${m.name}`; $('#mObj').textContent = m.objText;
  $('#radio').innerHTML = ''; this.buildDock(); this.refresh(); this.hints = HINTS[m.id] ? HINTS[m.id].map(h => Object.assign({}, h)) : []; this.hintI = 0; this.hintT = 0;
  if (this.data.stars[m.id] && m.id !== 1) this.hints = [];
};

/* ---------- HUD ---------- */
UI.buildDock = function () {
  $('#dock').innerHTML = friends().map(u => `<button class="sc" data-id="${u.id}"><span class="r" style="background:${u.def.col}">${u.type}</span><span class="n">${u.name}</span><div class="bar"><div></div></div><div class="bar s"><div></div></div><span class="st"></span></button>`).join('');
  for (const b of $$('#dock .sc')) { let lt = 0; b.onclick = () => { const id = +b.dataset.id, u = byId(id); if (!u) return; const now = performance.now(); if (G.sel === id && now - lt < 350 || u.state === 'down') { CAM.tx = u.x; CAM.ty = u.y; } lt = now; if (u.state === 'ok') G.sel = id; else if (u.state === 'down') tapAt(u.x, u.y); SFX.play('ui'); UI.refresh(); }; }
};
UI.tick = function () {
  if (!G || G.editor) return;
  for (const b of $$('#dock .sc')) {
    const u = byId(+b.dataset.id); if (!u) continue; const bars = b.querySelectorAll('.bar div');
    bars[0].style.width = (u.state === 'ok' ? u.hp / u.max * 100 : 0) + '%'; bars[1].style.width = u.supp + '%';
    let st = u.state === 'dead' ? 'KIA' : u.state === 'down' ? (u.stable ? 'STABLE' : u.tq && u.inj === 'limb' ? 'TQ ON · NEEDS MEDIC' : `BLEEDING ${Math.ceil(u.bleed)}s`) : u.carry ? 'CARRYING' : u.task && u.task.k === 'treat' ? 'TREATING' : u.supp > 75 ? 'PINNED' : u.target ? 'ENGAGING' : u.moving ? 'MOVING' : u.sector != null ? 'WATCHING' : 'READY';
    b.querySelector('.st').textContent = st;
    b.className = `sc ${u.id === G.sel ? 'sel' : ''} ${u.state === 'down' ? (u.stable ? 'down stable' : 'down') : ''} ${u.state === 'dead' ? 'dead' : ''}`;
  }
  const m = G.m, t = m.timer ? m.timer - G.t : G.t, tm = $('#mTime'); tm.textContent = fmtT(t); tm.className = 'timer mono' + (m.timer && t < 20 ? ' warn' : '');
  if (this._actSel !== G.sel || this._actSig !== this.actSig()) this.refresh();
  this.tickHints();
};
UI.actSig = function () { const u = G.sel && byId(G.sel); if (!u) return ''; const near = friends().find(c => c.state === 'down' && !c.carrier && Math.hypot(c.x - u.x, c.y - u.y) < 2.2); return JSON.stringify([u.kit, !!u.carry, !!near, INPUT.ability, u.state]); };
UI.refresh = function () {
  if (!G || G.editor) return; const u = G.sel && byId(G.sel);
  $('#slowB').className = 'slow' + (G.slow ? ' on' : ''); $('#slowB b').textContent = G.slow ? '¼×' : '1×';
  this._actSel = G.sel; this._actSig = this.actSig();
  if (!u || u.state !== 'ok') { $('#acts').innerHTML = ''; return; }
  const B = []; const ab = (k, i, n, c, on) => `<button class="ab ${on ? 'on' : ''}" onclick="UI.act('${k}')"><i>${i}</i>${n}${c != null ? `<em>${c}</em>` : ''}</button>`;
  B.push(ab('hold', '■', 'HOLD'));
  if (u.kit.frag) B.push(ab('frag', '✹', 'FRAG', u.kit.frag, INPUT.ability === 'frag'));
  if (u.kit.gl) B.push(ab('gl', '◉', '40MM', u.kit.gl, INPUT.ability === 'gl'));
  if (u.kit.smoke) B.push(ab('smoke', '☁', 'SMOKE', u.kit.smoke, INPUT.ability === 'smoke'));
  if (u.kit.flare) B.push(ab('flare', '✦', 'FLARE', u.kit.flare, INPUT.ability === 'flare'));
  if (u.kit.breach) B.push(ab('breach', '⊠', 'BREACH', u.kit.breach, INPUT.ability === 'breach'));
  const near = friends().find(c => c.state === 'down' && !c.carrier && Math.hypot(c.x - u.x, c.y - u.y) < 2.2);
  if (u.carry) B.push(`<button class="ab go" onclick="UI.act('drop')"><i>⇩</i>DROP</button>`); else if (near) B.push(`<button class="ab go" onclick="UI.act('drag')"><i>⇧</i>DRAG</button>`);
  if (u.sector != null) B.push(ab('clrsec', '◌', 'FREE AIM'));
  $('#acts').innerHTML = B.join('');
};
UI.act = function (k) {
  const u = G.sel && byId(G.sel); if (!u) return; SFX.play('ui');
  if (k === 'hold') { orderHold(u); radio(`${u.name}: holding.`, 'cmd'); }
  else if (k === 'drop') orderDrop(u);
  else if (k === 'drag') { const c = friends().find(c => c.state === 'down' && !c.carrier && Math.hypot(c.x - u.x, c.y - u.y) < 2.2); if (c) { orderCarry(u, c); this.toast('Now draw a route: drag from ' + u.name); } }
  else if (k === 'clrsec') { u.sector = null; }
  else if (ABIL[k]) { if (INPUT.ability === k) { INPUT.ability = null; G.slow = INPUT.wasSlow; } else { if (!INPUT.ability) INPUT.wasSlow = G.slow; INPUT.ability = k; G.slow = true; this.toast(k === 'breach' ? 'Tap the locked door' : `Tap where to ${k === 'smoke' ? 'throw smoke' : k === 'flare' ? 'fire the flare' : 'aim'}`); } }
  this.refresh();
};
UI.toggleSlow = function () { G.slow = !G.slow; INPUT.wasSlow = G.slow; SFX.play('ui'); this.refresh(); };
UI.togglePause = function () {
  if (!G || G.over) return; G.paused = true; SFX.play('ui');
  this.scr(`${brand()}<h2>Paused</h2><p class="card" style="margin-top:10px"><b>${G.m.name}</b><br>${G.m.objText}</p>
   <button class="btn pri" onclick="UI.resume()">Resume</button><button class="btn" onclick="UI.start(G.m, UI.cfg || cfgFor(G.m))">Restart mission</button>
   <div class="row"><button class="btn" onclick="UI.manual('pause')">Field manual</button><button class="btn" onclick="UI.settings('pause')">Settings</button></div>
   <button class="btn" onclick="${G.m.id === 99 ? 'ED.open(true)' : 'UI.missions()'}">Quit mission</button>
   <div class="card" style="font-size:13px;line-height:1.6;color:var(--mu)"><b style="color:#fff">Controls</b><br>Drag from a soldier: draw a route · Tap ground: move the selected soldier · Tap an enemy: everyone focuses fire · Tap a wounded soldier: send help · Long-press ground: set the watch direction · Pinch: zoom · Drag empty ground: pan · SLOW-MO: ¼ speed</div>`, true);
};
UI.resume = function () { this.hideScr(); if (G) G.paused = false; };
UI.onRadio = function (t, k) {
  const r = $('#radio'); if (!r) return; const el = document.createElement('div'); el.className = 'rm ' + k; el.textContent = t; r.appendChild(el);
  while (r.children.length > 4) r.removeChild(r.firstChild);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, 4200);
};

/* ---------- MARCH sheet ---------- */
UI.openMarch = function () {
  const M = G.march, c = byId(M.cas); $('#marchWho').textContent = (c ? c.name : '').toUpperCase();
  const order = [...MARCH_STEPS].sort(() => Math.random() - .5);
  $('#mbtns').innerHTML = order.map(s => `<button class="mb" data-k="${s.k}"><b>${s.k}</b><span>${s.n}</span></button>`).join('');
  for (const b of $$('#mbtns .mb')) b.onclick = () => { marchStep(b.dataset.k); if (G.march) UI.marchProg(); };
  $('#mtip').className = 'mtip'; $('#mtip').textContent = 'The medic keeps working on their own, slowly. Tap the steps in order to go faster.';
  $('#march').hidden = false; this.marchProg(); this.marchSlow = G.slow; G.slow = true; this.refresh();
  if (!this.marchTimer) this.marchTimer = setInterval(() => { if (G && G.march) UI.marchProg(); }, 250);
};
UI.marchProg = function () { const M = G.march; if (!M) return; $('#mprog').innerHTML = MARCH_STEPS.map((s, i) => `<span class="${i < M.step ? 'ok' : ''}">${s.k}</span>`).join(''); for (const b of $$('#mbtns .mb')) { const i = MARCH_STEPS.findIndex(s => s.k === b.dataset.k); b.style.opacity = i < M.step ? .35 : 1; } };
UI.marchErr = function (k, want) { const s = MARCH_STEPS.find(q => q.k === want); $('#mtip').className = 'mtip err'; $('#mtip').textContent = `Not yet. ${s.n} comes first: ${s.d}`; const b = $(`#mbtns .mb[data-k="${k}"]`); if (b) { b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); } buzz(40); };
UI.closeMarch = function () { $('#march').hidden = true; clearInterval(this.marchTimer); this.marchTimer = null; if (G) { G.slow = this.marchSlow || false; this.refresh(); } };

/* ---------- debrief ---------- */
UI.onFinish = function (r) {
  const m = G.m, s = G.stats; $('#march').hidden = true;
  if (r.win && m.id !== 99) { this.data.stars[m.id] = Math.max(this.data.stars[m.id] || 0, r.stars); this.save(); }
  const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0, L = lessons();
  const next = MISSIONS[MISSIONS.findIndex(q => q.id === m.id) + 1];
  const goals = [[r.win, m.objText], [r.win && s.kia === 0, 'No one killed in action'], [r.stars >= 3 || (r.win && third(m, s)), thirdText(m)]];
  this.scr(`<div class="res" style="color:${r.win ? 'var(--ok)' : 'var(--bad)'}">${r.win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}</div><h2 style="text-align:center">${m.name}</h2>
   <div class="big-stars">${[0, 1, 2].map(i => `<span class="${r.win && i < r.stars ? 'on' : ''}">★</span>`).join('')}</div>
   ${r.why ? `<p class="card" style="text-align:center;color:#ffc2cc">${r.why}</p>` : ''}
   <div class="card">${goals.map(g => `<div class="goal"><i class="${g[0] ? 'on' : ''}">★</i>${g[1]}</div>`).join('')}</div>
   <div class="sgrid"><div><b>${fmtT(r.t)}</b><span>TIME</span></div><div><b>${acc}%</b><span>HIT RATE</span></div><div><b>${s.kills}</b><span>KILLS</span></div><div><b>${s.down}</b><span>WOUNDED</span></div><div><b style="color:${s.kia ? 'var(--bad)' : ''}">${s.kia}</b><span>KIA</span></div><div><b>${s.tq}</b><span>TOURNIQUETS</span></div></div>
   <h3 class="sec">AFTER ACTION REVIEW</h3>${L.map(l => `<div class="ls ${l[2]}"><div><b>${l[0]}</b>${l[1]}</div></div>`).join('')}
   <p class="card" style="margin-top:10px"><span class="lessonq">${m.lesson}</span></p>
   <button class="btn pri" onclick="UI.start(UI.cur || G.m, UI.cfg || cfgFor(G.m))">Retry</button>
   ${r.win && next && m.id !== 99 ? `<button class="btn ok" onclick="UI.brief(${next.id})">Next: ${next.name}</button>` : ''}
   <button class="btn" onclick="${m.id === 99 ? 'ED.open(true)' : 'UI.missions()'}">${m.id === 99 ? 'Back to editor' : 'Mission list'}</button>`, true);
  $('#hud').hidden = true;
};

/* ---------- manual & settings ---------- */
UI.manual = function (back) {
  this.scr(`${brand()}<h2>Field manual</h2><p class="lead" style="margin:6px 0 14px">The ideas behind each mission, in plain words.</p>${MANUAL.map((c, i) => `<details class="man" ${i === 0 ? 'open' : ''}><summary>${c[0]}</summary><p>${c[1]}</p></details>`).join('')}
   <div class="card"><p class="lessonq">MARCH</p>${MARCH_STEPS.map(s => `<p><b style="color:var(--ok);font-family:'IBM Plex Mono'">${s.k}</b> · <b>${s.n}</b>: ${s.d}</p>`).join('')}</div>
   <button class="btn" onclick="${back === 'pause' ? 'UI.togglePause()' : 'UI.title()'}">Back</button>`, back === 'pause');
};
UI.settings = function (back) {
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${this.set[k] == v ? 'on' : ''}" onclick="UI.set.${k}=${typeof v === 'string' ? `'${v}'` : v};UI.save();UI.settings('${back}')">${n}</button>`).join('')}</div>`;
  this.scr(`${brand()}<h2>Settings</h2><div class="card">
   <div class="opt">Difficulty ${seg('diff', [['recruit', 'Recruit'], ['regular', 'Regular'], ['veteran', 'Veteran']])}</div>
   <div class="opt">Sound ${seg('snd', [[1, 'On'], [0, 'Off']])}</div>
   <div class="opt">Vibration ${seg('hap', [[1, 'On'], [0, 'Off']])}</div>
   <div class="opt">Instructor mode (unlock all) ${seg('all', [[1, 'On'], [0, 'Off']])}</div></div>
   <button class="btn" onclick="if(confirm)UI.resetP(this)">Reset progress</button>
   <button class="btn" onclick="${back === 'pause' ? 'UI.togglePause()' : 'UI.title()'}">Back</button>`, back === 'pause');
};
UI.resetP = function (b) { if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Tap again to erase all stars'; return; } this.data.stars = {}; this.data.squads = {}; this.save(); this.toast('Progress reset'); this.settings('title'); };

/* ---------- coaching hints ---------- */
const HINTS = {
  1: [{ t: 'Drag from a soldier to draw their route', until: () => G.units.some(u => u.side === 'F' && u.path.length) },
      { t: 'The shield at the end of a route shows cover: green = full, yellow = half, red = none', dur: 5 },
      { t: 'Soldiers shoot on their own. Tap an enemy to make everyone focus on it.', when: () => foes().some(e => e.spotted), until: () => friends().some(u => u.focus), dur: 8 },
      { t: 'Long-press the ground to set a soldier’s watch direction. SLOW-MO buys thinking time.', dur: 6 }],
  2: [{ t: 'Drag your yellow AR behind the sandbags. Its fire pins the nest down.', dur: 7 }, { t: 'While they’re pinned (yellow rings), flank with a second team.', when: () => foes().some(e => e.supp > 60 && e.spotted), dur: 6 }],
  3: [{ t: 'Select the Breacher (pink) and tap the locked door to blow it', dur: 7 }, { t: 'Frag a room before entering. Select a Rifleman → FRAG → tap the room.', when: () => G.world.obs.some(o => o.t === 'door' && o.open), dur: 6 }],
  4: [{ t: 'Long-press the ground to give each soldier a different direction to watch', dur: 7 }, { t: 'Select the Team Leader → FLARE to light up the dark', when: () => G.t > 20, dur: 6 }],
  5: [{ t: 'Win the firefight first. Put fire on the ridge before anyone runs to Reyes.', dur: 7 }, { t: 'Tap Reyes to send help. Under fire, only a tourniquet goes on.', when: () => G.t > 8, dur: 6 }, { t: 'Select the rescuer → DRAG, then draw a route back to cover', when: () => friends().some(u => u.key === 'patient' && u.tq), dur: 7 }],
  6: [{ t: 'Throw SMOKE between you and the machine gun, then move behind it', dur: 7 }, { t: 'Technical incoming! Use the Grenadier’s 40MM on it.', when: () => foes().some(e => e.def.veh && e.spotted), dur: 6 }]
};
UI.tickHints = function () {
  const H = this.hints; if (!H || this.hintI >= H.length || G.over) { $('#hint').hidden = true; return; }
  const h = H[this.hintI];
  if (!h.shown) { if (h.when && !h.when()) return; h.shown = G.t; $('#hint').textContent = h.t; $('#hint').hidden = false; }
  if ((h.until && h.until()) || (h.dur && G.t - h.shown > h.dur) || (!h.until && !h.dur && G.t - h.shown > 5)) { $('#hint').hidden = true; this.hintI++; }
};
$('#pauseB').onclick = () => UI.togglePause();
$('#slowB').onclick = () => UI.toggleSlow();
