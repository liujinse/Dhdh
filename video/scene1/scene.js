// 情景短视频1 — Q版 underground gym construction site, three characters.
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 1920, H = 1080;
const FONT = '"ZCOOL KuaiLe", "WenQuanYi Zen Hei", sans-serif';
const OUT = '#4a3428';
const FLOOR = 840;
let TL = null;

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function rr(x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fs(fill, lw = 5, stroke = OUT) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function text(str, x, y, size, fill, o = {}) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  if (o.stroke) { ctx.lineWidth = o.lw || size * 0.18; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

function curLine(t) {
  const L = TL.lines;
  for (let i = 0; i < L.length; i++) {
    const l = L[i], next = L[i + 1];
    const hold = next ? next.start : l.end + 1.2;
    if (t >= l.start - 0.1 && t < hold) return { line: l, talking: t < l.end };
  }
  return null;
}
function speakerStart(who) { return TL.lines.find(l => l.who === who).start; }

// ---------- background: underground gym under construction ----------
const R = rng(21);
const DUST = Array.from({ length: 50 }, () => ({ x: R(), y: R(), s: 1.5 + R() * 2.5, v: 0.2 + R() * 0.5 }));

function drawSite(t) {
  // back wall (cast concrete)
  const g = ctx.createLinearGradient(0, 120, 0, FLOOR);
  g.addColorStop(0, '#dfe5ee'); g.addColorStop(1, '#cbd3df');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
  // formwork panels + tie holes
  ctx.strokeStyle = 'rgba(120,135,160,0.35)'; ctx.lineWidth = 3;
  for (let x = 0; x <= W; x += 240) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x, FLOOR); ctx.stroke(); }
  for (let y = 150 + 230; y < FLOOR; y += 230) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(110,125,150,0.45)';
  for (let x = 60; x < W; x += 120) for (let y = 210; y < FLOOR - 20; y += 115) { circle(x, y, 5); ctx.fill(); }

  // ceiling slab with an opening to the sky
  const ox0 = 1380, ox1 = 1720;
  ctx.fillStyle = '#b9c2cf'; ctx.fillRect(0, 0, W, 150);
  const sky = ctx.createLinearGradient(0, 0, 0, 150); sky.addColorStop(0, '#7cc8ff'); sky.addColorStop(1, '#cfeeff');
  ctx.fillStyle = sky; ctx.fillRect(ox0, 0, ox1 - ox0, 130);
  for (const [cx, cy, s] of [[1450, 50, 0.7], [1650, 85, 0.55]]) {
    const x = ox0 + ((cx - ox0 + t * 10 * s) % (ox1 - ox0 + 160)) - 80;
    ctx.save(); ctx.beginPath(); ctx.rect(ox0, 0, ox1 - ox0, 130); ctx.clip();
    ctx.translate(x, cy); ctx.scale(s, s); ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-34, 8, 26, 0, 7); ctx.arc(0, -6, 34, 0, 7); ctx.arc(36, 8, 26, 0, 7); ctx.fill(); ctx.restore();
  }
  rr(-10, 118, W + 20, 40, 6); fs('#c6ced9', 5);
  ctx.clearRect; // slab edge drawn; re-open the hole edge
  ctx.fillStyle = sky; ctx.fillRect(ox0 + 4, 0, ox1 - ox0 - 8, 120);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.strokeRect(ox0, -10, ox1 - ox0, 168);
  // rebar stubs along slab edge
  ctx.strokeStyle = '#e07a45'; ctx.lineWidth = 5;
  for (let x = 40; x < ox0 - 20; x += 60) { ctx.beginPath(); ctx.moveTo(x, 158); ctx.lineTo(x, 176); ctx.stroke(); }
  // sun beam
  ctx.save();
  const beam = ctx.createLinearGradient(0, 120, 0, FLOOR);
  beam.addColorStop(0, 'rgba(255,250,215,0.55)'); beam.addColorStop(1, 'rgba(255,250,215,0.0)');
  ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(ox0, 150); ctx.lineTo(ox1, 150); ctx.lineTo(ox1 + 120, FLOOR); ctx.lineTo(ox0 - 40, FLOOR); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.8)';
  for (const d of DUST) { const y = 160 + ((d.y * 680 + t * 20 * d.v) % 680); const x = lerp(ox0, ox1 + 60, d.x) + Math.sin(t + d.y * 9) * 10; circle(x, y, d.s); ctx.fill(); }
  ctx.restore();

  // string of work lights
  ctx.beginPath(); ctx.moveTo(0, 200);
  for (let x = 0; x <= ox0; x += 20) ctx.lineTo(x, 200 + Math.sin((x / ox0) * Math.PI * 4) * 14 + 14);
  ctx.lineWidth = 3; ctx.strokeStyle = '#5d6470'; ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const x = 80 + i * 150, y = 200 + Math.sin((x / ox0) * Math.PI * 4) * 14 + 14;
    const sw = Math.sin(t * 1.5 + i) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
    const gl = ctx.createRadialGradient(0, 30, 2, 0, 30, 70); gl.addColorStop(0, 'rgba(255,236,150,0.65)'); gl.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = gl; circle(0, 30, 70); ctx.fill();
    rr(-7, 0, 14, 14, 3); fs('#5d6470', 3);
    ellipse(0, 28, 13, 16); fs('#fff2a8', 3);
    ctx.restore();
  }

  // columns
  for (const x of [130, 1060]) {
    rr(x - 55, 150, 110, FLOOR - 150 + 10, 6); fs('#d3dae4', 5);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 38, 165, 14, FLOOR - 185);
    ctx.fillStyle = 'rgba(110,125,150,0.25)'; ctx.fillRect(x + 30, 165, 14, FLOOR - 185);
  }

  // scaffolding (left)
  const sx0 = 230, sx1 = 470;
  ctx.lineCap = 'round';
  for (const x of [sx0, sx0 + 120, sx1]) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x, 300); ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#5fa8ff'; ctx.stroke(); }
  for (const y of [420, 600, 780]) {
    ctx.beginPath(); ctx.moveTo(sx0 - 10, y); ctx.lineTo(sx1 + 10, y); ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 7; ctx.strokeStyle = '#5fa8ff'; ctx.stroke();
    rr(sx0 - 14, y - 22, sx1 - sx0 + 28, 16, 4); fs('#f2c27a', 4);
  }
  for (const [y0, y1] of [[420, 600], [600, 780]]) { ctx.beginPath(); ctx.moveTo(sx0, y1); ctx.lineTo(sx0 + 120, y0); ctx.moveTo(sx0 + 120, y1); ctx.lineTo(sx1, y0); ctx.lineWidth = 5; ctx.strokeStyle = '#ffcc33'; ctx.stroke(); }

  // floor
  const fg = ctx.createLinearGradient(0, FLOOR, 0, H); fg.addColorStop(0, '#c2c8d1'); fg.addColorStop(1, '#aab2be');
  ctx.fillStyle = fg; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.strokeStyle = 'rgba(90,100,120,0.25)'; ctx.lineWidth = 3;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 140, FLOOR); ctx.lineTo(W / 2 + i * 300, H); ctx.stroke(); }
  for (const y of [900, 990]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // props: rebar bundle, cement bags, cones, wheelbarrow
  rr(1460, FLOOR - 20, 360, 26, 8); fs('#8a6a4f', 4);
  for (let i = 0; i < 6; i++) { rr(1440 - (i % 2) * 10, FLOOR - 38 - i * 11, 400, 11, 5); fs('#e8743b', 3); }
  for (const [x, y] of [[1560, FLOOR - 140], [1650, FLOOR - 140], [1605, FLOOR - 190]]) { rr(x, y + 60, 90, 50, 14); fs('#f3ead8', 4); ctx.fillStyle = '#9ab0c8'; ctx.fillRect(x + 18, y + 78, 54, 12); }
  for (const x of [700, 1830]) cone(x, FLOOR + 40);
}

function cone(x, y) {
  ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 10, y - 70); ctx.lineTo(x + 10, y - 70); ctx.lineTo(x + 30, y); ctx.closePath(); fs('#ff8a3d', 4);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 20, y - 26); ctx.lineTo(x - 15, y - 44); ctx.lineTo(x + 15, y - 44); ctx.lineTo(x + 20, y - 26); ctx.closePath(); ctx.fill();
  rr(x - 40, y - 4, 80, 12, 5); fs('#ff8a3d', 4);
}
function wheelbarrow(x, y) {
  ctx.beginPath(); ctx.moveTo(x - 90, y - 70); ctx.lineTo(x + 50, y - 70); ctx.lineTo(x + 20, y - 25); ctx.lineTo(x - 70, y - 25); ctx.closePath(); fs('#4fb38a', 4);
  ctx.beginPath(); ctx.moveTo(x - 70, y - 25); ctx.lineTo(x - 140, y - 50); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
  circle(x + 30, y - 10, 18); fs('#5d6470', 4); circle(x + 30, y - 10, 6); fs('#c2c9d4', 2);
  ctx.beginPath(); ctx.moveTo(x - 60, y - 25); ctx.lineTo(x - 60, y); ctx.lineWidth = 6; ctx.stroke();
}

// ---------- Q版 character ----------
// feet at (x,y). o: {helmet, letter, vest, shirt, pants, hair, glasses, look, talking, t, arm, seed}
function chibi(x, y, s, o) {
  const t = o.t;
  const breathe = Math.sin(t * 2.4 + (o.seed || 0)) * 3;
  const bob = o.talking ? Math.abs(Math.sin(t * 7 + (o.seed || 0))) * 6 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // shadow
  ellipse(0, 4, 85, 14); ctx.fillStyle = 'rgba(60,70,90,0.18)'; ctx.fill();
  ctx.translate(0, -bob);
  // legs + shoes
  rr(-42, -78, 34, 66, 14); fs(o.pants, 5); rr(8, -78, 34, 66, 14); fs(o.pants, 5);
  rr(-52, -22, 50, 26, 13); fs('#6b4a36', 5); rr(2, -22, 50, 26, 13); fs('#6b4a36', 5);
  // arms (behind body for the far side)
  const armL = o.armL || 0, armR = o.armR || 0;
  arm(-58, -175 + breathe, 0.35 + armL, o.shirt, -1);
  // body
  rr(-66, -200 + breathe, 132, 135 - breathe, 40); fs(o.shirt, 5);
  if (o.vest) {
    ctx.save(); rr(-66, -200 + breathe, 132, 135 - breathe, 40); ctx.clip();
    ctx.fillStyle = o.vest; ctx.fillRect(-66, -205, 48, 150); ctx.fillRect(18, -205, 48, 150);
    ctx.fillStyle = '#fffbe0'; ctx.fillRect(-66, -130, 48, 12); ctx.fillRect(18, -130, 48, 12);
    ctx.restore();
    rr(-66, -200 + breathe, 132, 135 - breathe, 40); fs(null, 5);
  }
  if (o.tie) { ctx.beginPath(); ctx.moveTo(0, -196 + breathe); ctx.lineTo(-10, -170); ctx.lineTo(0, -120); ctx.lineTo(10, -170); ctx.closePath(); fs(o.tie, 3); }
  if (o.blueprint) { ctx.save(); ctx.translate(-36, -128 + breathe); ctx.rotate(-0.5); rr(-12, -52, 26, 104, 12); fs('#8fc9ff', 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(8, -30); ctx.moveTo(-6, 0); ctx.lineTo(8, 0); ctx.stroke(); ctx.restore(); }
  arm(58, -175 + breathe, -0.35 + armR, o.shirt, 1, o.wave ? Math.sin(t * 9) * 0.35 : 0);
  // head
  const hy = -310 + breathe;
  const tilt = (o.tilt || 0) + (o.talking ? Math.sin(t * 3.1) * 0.03 : 0);
  ctx.save(); ctx.translate(0, hy); ctx.rotate(tilt);
  // ears
  ellipse(-108, 12, 18, 24); fs(o.skin || '#ffdcbf', 5); ellipse(108, 12, 18, 24); fs(o.skin || '#ffdcbf', 5);
  ellipse(0, 0, 112, 106); fs(o.skin || '#ffdcbf', 5);
  // hair fringe under helmet
  ctx.save(); ellipse(0, 0, 112, 106); ctx.clip();
  ctx.fillStyle = o.hair; ctx.beginPath(); ctx.moveTo(-120, -10);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-112 + i * 28, -36 + (i % 2 ? 22 : 0));
  ctx.lineTo(120, -120); ctx.lineTo(-120, -120); ctx.closePath(); ctx.fill();
  ctx.restore();
  ellipse(0, 0, 112, 106); fs(null, 5);
  // helmet
  ctx.beginPath(); ctx.moveTo(-112, -34); ctx.bezierCurveTo(-112, -150, 112, -150, 112, -34); ctx.closePath(); fs(o.helmet, 5);
  rr(-130, -46, 260, 26, 13); fs(o.helmet, 5);
  rr(-14, -134, 28, 92, 12); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  ellipse(-55, -100, 16, 10, -0.5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  if (o.letter) { circle(0, -84, 30); fs('#fff', 4); text(o.letter, 0, -82, 38, OUT); }
  // face
  const look = o.look || 0;
  const blink = ((t + (o.seed || 0) * 1.7) % 3.6) < 0.13;
  // brows
  ctx.lineWidth = o.browW || 6; ctx.strokeStyle = o.hair; ctx.lineCap = 'round';
  const browUp = o.talking ? Math.abs(Math.sin(t * 2.3)) * 4 : 0;
  ctx.beginPath(); ctx.moveTo(-58, -8 - browUp); ctx.quadraticCurveTo(-40, -18 - browUp, -22, -10 - browUp); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, -10 - browUp); ctx.quadraticCurveTo(40, -18 - browUp, 58, -8 - browUp); ctx.stroke();
  for (const ex of [-40, 40]) {
    if (blink) { ctx.beginPath(); ctx.moveTo(ex - 16, 24); ctx.quadraticCurveTo(ex, 32, ex + 16, 24); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); }
    else {
      ellipse(ex, 22, 19, 24); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ellipse(ex + look * 7, 25, 14, 18); ctx.fillStyle = '#3a2a22'; ctx.fill();
      circle(ex + look * 7 - 5, 17, 6); ctx.fillStyle = '#fff'; ctx.fill();
      circle(ex + look * 7 + 5, 32, 3); ctx.fill();
    }
  }
  if (o.glasses) {
    ctx.lineWidth = 5; ctx.strokeStyle = OUT;
    rr(-70, -4, 60, 52, 18); ctx.stroke(); rr(10, -4, 60, 52, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 18); ctx.lineTo(10, 18); ctx.stroke();
  }
  ellipse(-70, 60, 18, 10); ctx.fillStyle = 'rgba(255,130,120,0.55)'; ctx.fill();
  ellipse(70, 60, 18, 10); ctx.fill();
  // mouth
  const open = o.talking ? Math.abs(Math.sin(t * 15 + (o.seed || 0))) : 0;
  if (open > 0.2) { ellipse(look * 4, 66, 16, 6 + open * 12); fs('#b8453f', 4); ellipse(look * 4, 72 + open * 4, 8, 4); ctx.fillStyle = '#ff8f8f'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(look * 4, 56, 16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
function arm(x, y, rot, col, side, extra = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot + extra);
  rr(-17, -10, 34, 92, 17); fs(col, 5);
  circle(0, 88, 19); fs('#ffdcbf', 5);
  ctx.restore();
}

// ---------- subtitle ----------
function subtitle(t) {
  const c = curLine(t); if (!c) return;
  const l = c.line;
  const a = clamp((t - l.start + 0.1) / 0.2);
  const name = TL.voices[l.who];
  const col = { jia: '#ff8c2e', yi: '#2f9be0', wang: '#6a5acd' }[l.who];
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `52px ${FONT}`;
  const tw = ctx.measureText(l.text).width;
  const w = Math.max(700, tw + 120), x = (W - w) / 2, y = 930, h = 110;
  rr(x, y, w, h, 36); fs('rgba(255,252,245,0.95)', 5);
  ctx.font = `30px ${FONT}`;
  const nw = ctx.measureText(name).width + 50;
  rr(x + 40, y - 30, nw, 52, 26); fs(col, 4);
  text(name, x + 40 + nw / 2, y - 3, 30, '#fff');
  text(l.text, W / 2, y + h / 2 + 6, 52, '#3d2a20');
  ctx.restore();
}

// ---------- main ----------
function draw(t) {
  ctx.clearRect(0, 0, W, H);
  const c = curLine(t);
  const who = c && c.talking ? c.line.who : null;
  const wangT0 = speakerStart('wang');
  // camera: wide shot, then push in on 王工 as he turns to the camera
  const z = ease(clamp((t - (wangT0 - 0.5)) / 1.1));
  const zoom = lerp(1, 1.95, z);
  const fx = lerp(W / 2, 1400, z), fy = lerp(H / 2, 560, z);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy);
  drawSite(t);
  const wangToCam = t > wangT0 - 0.4;
  const jiaLook = who === 'yi' ? 0.6 : 1, yiLook = who === 'jia' ? -0.7 : 1;
  chibi(560, FLOOR + 40, 1.12, { t, seed: 1, helmet: '#ffc533', letter: '甲', vest: '#ff8c2e', shirt: '#fff4e0', pants: '#3e5a8a', hair: '#2e2420', look: wangToCam ? 0.5 : jiaLook, talking: who === 'jia', armR: who === 'jia' ? -0.9 + Math.sin(t * 4) * 0.15 : 0, tilt: 0.04 });
  chibi(850, FLOOR + 40, 1.08, { t, seed: 2.3, helmet: '#4aa8ff', letter: '乙', vest: '#9bdc4a', shirt: '#f2fbff', pants: '#5a4a7a', hair: '#3a2b22', look: wangToCam ? 0.5 : yiLook, talking: who === 'yi', armR: who === 'yi' ? -1.9 + Math.sin(t * 5) * 0.2 : 0, tilt: 0.04 });
  const wangLook = wangToCam ? 0 : (who === 'yi' ? -0.8 : -1);
  const greet = t > wangT0 && t < wangT0 + 2.4;
  chibi(1400, FLOOR + 40, 1.18, { t, seed: 3.1, helmet: '#ffffff', shirt: '#cfe6ff', pants: '#4a4f5c', hair: '#2b2b2b', glasses: true, tie: '#3d6fd9', blueprint: true, look: wangLook, talking: who === 'wang', armR: greet ? -2.05 : (who === 'wang' ? -0.8 + Math.sin(t * 3) * 0.2 : 0), wave: greet, tilt: wangToCam ? 0 : -0.04 });
  ctx.restore();
  subtitle(t);
  // fade in / out
  const fade = Math.min(clamp(t / 0.6), clamp((TL.duration - t) / 0.8));
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}

window.init = tl => { TL = tl; };
window.draw = draw;
window.fontsReady = async chars => { await document.fonts.load(`52px "ZCOOL KuaiLe"`, chars); await document.fonts.ready; return document.fonts.check(`52px "ZCOOL KuaiLe"`, '王工'); };
