'use strict';
/* SPEARHEAD // audio — synthesized SFX, distance-attenuated, throttled */
const SFX = {
  ctx: null, nb: null, out: null, n: 0, last: 0, amb: null,
  unlock() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } try { const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C(); const c = this.ctx; this.out = c.createGain(); this.out.gain.value = .8; const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; this.out.connect(comp); comp.connect(c.destination);
    const b = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = b; this.ambient(); } catch (e) { this.ctx = null; } },
  on() { return this.ctx && (typeof UI === 'undefined' || UI.set.snd); },
  noise(t, dur, { f = 1200, q = 1, type = 'bandpass', v = .3, f2 } = {}) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.nb; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * .8); s.stop(t + dur + .02); },
  tone(t, f, dur, { type = 'sine', v = .2, f2 } = {}) { const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + .02); },
  play(k, at) {
    if (!this.on()) return; const c = this.ctx, t = c.currentTime;
    let vol = 1; if (at && typeof CAM !== 'undefined') { const d = Math.hypot(at.x - CAM.x, at.y - CAM.y); vol = cl(1.2 - d / 70, .18, 1); }
    if (k in GUNS) { const now = performance.now(); if (now - this.last > 1000) { this.last = now; this.n = 0; } if (++this.n > 34) return; const g = GUNS[k]; this.noise(t, g[1], { f: g[0], q: .8, v: g[2] * vol }); this.tone(t, g[3], g[1] * .8, { type: 'triangle', v: g[2] * .6 * vol, f2: 40 }); if (k === 'dmr') this.noise(t, .03, { f: 4000, q: 2, v: .25 * vol }); return; }
    switch (k) {
      case 'boom': this.noise(t, 1.1, { type: 'lowpass', f: 900, f2: 120, v: .9 * vol }); this.tone(t, 90, .7, { v: .6 * vol, f2: 30 }); break;
      case 'throw': this.noise(t, .12, { f: 3000, v: .08 }); break;
      case 'gl': this.tone(t, 160, .12, { type: 'square', v: .18, f2: 60 }); this.noise(t, .1, { f: 600, v: .2 }); break;
      case 'rpg': this.noise(t, .5, { f: 900, f2: 2500, v: .4 * vol }); break;
      case 'smoke': this.noise(t, 1.4, { type: 'highpass', f: 2500, v: .08 }); break;
      case 'flare': this.tone(t, 300, .5, { type: 'sawtooth', v: .06, f2: 1600 }); break;
      case 'ui': this.tone(t, 880, .05, { v: .08 }); break;
      case 'order': this.tone(t, 660, .05, { v: .07 }); this.tone(t + .06, 990, .06, { v: .07 }); break;
      case 'deny': this.tone(t, 220, .15, { type: 'square', v: .07 }); break;
      case 'contact': this.noise(t, .05, { f: 2500, q: 3, v: .12 }); this.tone(t + .05, 1200, .07, { type: 'square', v: .05 }); break;
      case 'down': this.tone(t, 520, .18, { type: 'square', v: .08 }); this.tone(t + .2, 400, .25, { type: 'square', v: .08 }); break;
      case 'heli': for (let i = 0; i < 24; i++) this.noise(t + i * .09, .07, { type: 'lowpass', f: 300, v: .35 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * .12, f, .3, { type: 'triangle', v: .14 })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => this.tone(t + i * .18, f, .4, { type: 'triangle', v: .14 })); break;
    }
  },
  ambient() { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.nb; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = c.createGain(); g.gain.value = .05; s.connect(f); f.connect(g); g.connect(this.out); s.start(); this.amb = g; }
};
/* [bandpass Hz, duration, volume, thump Hz] */
const GUNS = { rifle: [1700, .09, .3, 120], lmg: [1300, .08, .28, 110], dmr: [900, .2, .4, 80], shotgun: [700, .22, .45, 70], ak: [1250, .1, .28, 100], smg: [2300, .06, .22, 150], hmg: [520, .16, .45, 60] };
