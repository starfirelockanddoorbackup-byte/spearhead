'use strict';
/* SPEARHEAD // main loop */
let lastT = 0, visT = 0, uiT = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - lastT) / 1000 || .016); lastT = ts;
  try {
    if (G && !G.editor) { simUpdate(dt); visT -= dt; if (visT <= 0) { visT = .09; updateVis(); } }
    if (G) render(); else { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, SW, SH); }
    uiT -= dt; if (uiT <= 0) { uiT = .1; UI.tick(); }
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { resize(); clampCam(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.editor && !G.paused) UI.togglePause(); });
UI.load(); resize(); UI.title(); requestAnimationFrame(frame);
