// 地下体育馆诞生记 — cute cross-section construction animation.
// window.init(timeline) then window.draw(t) renders frame at time t (seconds).
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 1920, H = 1080;
const FONT = '"ZCOOL KuaiLe", "WenQuanYi Zen Hei", sans-serif';

// ---------- geometry ----------
const G = 420;                 // ground surface
const PX0 = 600, PX1 = 1320;   // pit inner edges (retaining walls inside faces)
const WL = 40;                 // retaining wall thickness
const PB = 800;                // pit bottom
const PILE_TOE = 930;
const STRUTS = [535, 660];
const WATER_OUT = 545;
const ROOF_T = 470, ROOF_B = 510, SLAB_T = 745, SLAB_B = 785;
const WALL_L = [612, 648], WALL_R = [1272, 1308];
const COLS = [[760, 786], [1134, 1160]];
const WELLS = [705, 960, 1215];
const OUTLINE = '#5b3b2c';

let TL = null;

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const backOut = k => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const elastic = k => k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
const sub = (p, a, b) => clamp((p - a) / (b - a));

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function rr(x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillStroke(fill, lw = 4, stroke = OUTLINE) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function text(str, x, y, size, fill, opts = {}) {
  ctx.font = `${opts.weight || ''} ${size}px ${FONT}`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = opts.base || 'middle';
  if (opts.stroke) { ctx.lineWidth = opts.lw || size * 0.18; ctx.strokeStyle = opts.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

// ---------- timeline queries ----------
function scene(id) { return TL.scenes.find(s => s.id === id); }
function sceneP(id, t) {           // 0..1 progress of the scene's main animation
  const s = scene(id);
  const lead = s.step ? 1.8 : 0.4;
  return clamp((t - s.start - lead) / (s.end - s.start - lead - 0.5));
}
function lineStart(id, i) { return scene(id).lines[i].start; }
function curScene(t) { let c = TL.scenes[0]; for (const s of TL.scenes) if (t >= s.start) c = s; return c; }
function curLine(t) {
  for (const s of TL.scenes) for (let i = 0; i < s.lines.length; i++) {
    const l = s.lines[i];
    const next = s.lines[i + 1];
    const hold = next ? next.start : Math.min(s.end, l.end + 0.6);
    if (t >= l.start - 0.08 && t < hold) return { line: l, talking: t < l.end };
  }
  return null;
}

// ---------- state from timeline ----------
function state(t) {
  const p = id => sceneP(id, t);
  const S = {};
  S.why = p('why');
  S.survey = p('survey');
  S.piles = p('piles');
  S.dewater = p('dewater');
  S.dig = p('dig');
  S.wp = p('waterproof');
  S.st = p('structure');
  S.roof = p('roof');
  S.inn = p('interior');
  S.fin = t >= scene('finale').start ? 1 : 0;
  S.finT = t - scene('finale').start;
  S.whyActive = t >= scene('why').start && t < scene('why').end;
  return S;
}

// ---------- background ----------
const R0 = rng(7);
const PEBBLES = Array.from({ length: 260 }, () => ({ x: R0() * W, y: G + 20 + R0() * (H - G), r: 2 + R0() * 5, c: R0() }));
const CLOUDS = [[200, 120, 1.0], [700, 80, 0.8], [1150, 150, 1.1], [1500, 70, 0.7], [1900, 140, 0.9]];
const CITY = (() => { const r = rng(3); const a = []; let x = 380; while (x < 1960) { const w = 50 + r() * 70; a.push([x, w, 70 + r() * 130, r()]); x += w + 8; } return a; })();

function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, G);
  g.addColorStop(0, '#86d0ff'); g.addColorStop(1, '#dff4ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, G);
  // sun with face
  const sx = 1780, sy = 115;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.3);
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); rr(62, -7, 26, 14, 7); ctx.fillStyle = '#ffd34d'; ctx.fill(); }
  ctx.restore();
  circle(sx, sy, 55); fillStroke('#ffe066', 4, '#f0a43a');
  circle(sx - 18, sy - 5, 5); ctx.fillStyle = OUTLINE; ctx.fill();
  circle(sx + 18, sy - 5, 5); ctx.fill();
  ellipse(sx - 32, sy + 12, 9, 5); ctx.fillStyle = '#ff9f8a'; ctx.fill();
  ellipse(sx + 32, sy + 12, 9, 5); ctx.fill();
  ctx.beginPath(); ctx.arc(sx, sy + 8, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  // clouds
  for (const [cx, cy, s] of CLOUDS) {
    let x = ((cx + t * 14 * s) % (W + 300)) - 150;
    ctx.save(); ctx.translate(x, cy); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(-40, 10, 30, 0, 7); ctx.arc(0, -5, 40, 0, 7); ctx.arc(42, 8, 30, 0, 7); ctx.fill();
    rr(-70, 5, 140, 36, 18); ctx.fill();
    ctx.restore();
  }
  // pastel city skyline
  for (const [x, w, h, c] of CITY) {
    const col = ['#c9dcf5', '#d7cdf2', '#c6e8e0', '#f3d6e4'][Math.floor(c * 4)];
    rr(x, G - h, w, h + 10, 10); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let wy = G - h + 16; wy < G - 20; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 20) rr(wx, wy, 10, 12, 3), ctx.fill();
  }
}

function drawSchool(t) {
  const x = 40, y = 225, w = 300, h = G - y;
  rr(x, y + 40, w, h - 40, 14); fillStroke('#fff1d6');
  ctx.beginPath(); ctx.moveTo(x - 15, y + 48); ctx.lineTo(x + w / 2, y - 10); ctx.lineTo(x + w + 15, y + 48); ctx.closePath(); fillStroke('#ff8a7a');
  circle(x + w / 2, y + 22, 18); fillStroke('#fff', 3);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 22); ctx.lineTo(x + w / 2, y + 10); ctx.moveTo(x + w / 2, y + 22); ctx.lineTo(x + w / 2 + 9, y + 26); ctx.lineWidth = 3; ctx.stroke();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { rr(x + 22 + c * 70, y + 70 + r * 60, 46, 38, 8); fillStroke('#9fdcff', 3); }
  rr(x + w / 2 - 28, G - 62, 56, 62, 10); fillStroke('#c9885a', 3);
  // flag
  ctx.beginPath(); ctx.moveTo(x + w + 40, G); ctx.lineTo(x + w + 40, y - 30); ctx.lineWidth = 5; ctx.strokeStyle = '#8a8f99'; ctx.stroke();
  ctx.beginPath(); const fy = y - 28, fx = x + w + 42;
  ctx.moveTo(fx, fy);
  for (let i = 0; i <= 10; i++) ctx.lineTo(fx + i * 7, fy + Math.sin(t * 4 + i * 0.6) * 4);
  for (let i = 10; i >= 0; i--) ctx.lineTo(fx + i * 7, fy + 44 + Math.sin(t * 4 + i * 0.6) * 4);
  ctx.closePath(); ctx.fillStyle = '#ff4d4d'; ctx.fill();
  text('学校', x + w / 2, y + 190, 34, '#fff', { stroke: '#c9885a', lw: 8 });
}

function tree(x, y, s, t) {
  const sway = Math.sin(t * 1.5 + x) * 0.03;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.scale(s, s);
  rr(-8, -50, 16, 52, 6); fillStroke('#b07a4f', 3);
  ctx.beginPath(); ctx.arc(-22, -62, 26, 0, 7); ctx.arc(22, -62, 26, 0, 7); ctx.arc(0, -86, 30, 0, 7);
  ctx.fillStyle = '#7ccf6b'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.beginPath(); ctx.arc(-6, -94, 9, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  ctx.restore();
}

const SOIL = ['#d9a56b', '#c9905a', '#b97d4a', '#a96d3f', '#9a6238'];
function bandY(k, x) { return G + 22 + k * 135 + Math.sin(x / 95 + k * 1.7) * 7; }
function drawGround() {
  for (let k = 0; k < SOIL.length; k++) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, k === 0 ? G : bandY(k - 1, x) + 10);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = SOIL[k]; ctx.fill();
  }
  for (const p of PEBBLES) { ellipse(p.x, p.y, p.r * 1.4, p.r); ctx.fillStyle = p.c < 0.5 ? 'rgba(255,240,220,0.35)' : 'rgba(80,45,25,0.25)'; ctx.fill(); }
}
function drawGrass(x0, x1, y = G) {
  rr(x0, y - 8, x1 - x0, 22, 8); ctx.fillStyle = '#86d46f'; ctx.fill();
  ctx.fillStyle = '#6cc257';
  for (let x = x0 + 6; x < x1 - 6; x += 18) { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y - 16); ctx.lineTo(x + 10, y - 6); ctx.fill(); }
}

// ---------- characters ----------
function drawAnan(x, y, s, o = {}) {
  const t = o.t || 0;
  const bounce = o.talking ? Math.abs(Math.sin(t * 9)) * 8 : Math.sin(t * 2.2) * 2;
  ctx.save(); ctx.translate(x, y - bounce); ctx.scale(s, s);
  // feet
  ellipse(-20, -6, 16, 9); fillStroke('#f0a43a', 3); ellipse(20, -6, 16, 9); fillStroke('#f0a43a', 3);
  // arms
  const wave = o.wave ? Math.sin(t * 10) * 0.5 : 0;
  ctx.save(); ctx.translate(48, -55); ctx.rotate(-0.6 + wave - (o.wave ? 0.9 : 0)); rr(-6, -6, 34, 14, 7); fillStroke('#ffe08a', 3); ctx.restore();
  ctx.save(); ctx.translate(-48, -55); ctx.rotate(0.6); rr(-28, -6, 34, 14, 7); fillStroke('#ffe08a', 3); ctx.restore();
  // body
  ellipse(0, -62, 56, 56); fillStroke('#ffe08a', 4);
  // vest stripe
  ctx.save(); ellipse(0, -62, 56, 56); ctx.clip(); ctx.fillStyle = '#ffb44d'; ctx.fillRect(-60, -30, 120, 30);
  ctx.fillStyle = '#fff6c9'; ctx.fillRect(-60, -24, 120, 7); ctx.restore();
  ellipse(0, -62, 56, 56); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  // helmet
  ctx.beginPath(); ctx.moveTo(-50, -92); ctx.quadraticCurveTo(-48, -150, 0, -150); ctx.quadraticCurveTo(48, -150, 50, -92); ctx.closePath(); fillStroke('#ff8c2e', 4);
  rr(-62, -98, 124, 14, 7); fillStroke('#ff8c2e', 4);
  rr(-7, -148, 14, 50, 6); ctx.fillStyle = '#ffb066'; ctx.fill();
  circle(-24, -126, 7); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  // face
  const blink = (Math.floor(t * 0.7 + (o.seed || 0)) % 5 === 0) && ((t * 0.7) % 1 < 0.12);
  ctx.fillStyle = OUTLINE;
  if (blink) { ctx.fillRect(-26, -66, 16, 4); ctx.fillRect(10, -66, 16, 4); }
  else { ellipse(-18, -66, 7, 9); ctx.fill(); ellipse(18, -66, 7, 9); ctx.fill(); ctx.fillStyle = '#fff'; circle(-15, -70, 3); ctx.fill(); circle(21, -70, 3); ctx.fill(); }
  ellipse(-34, -50, 9, 5); ctx.fillStyle = '#ff9f8a'; ctx.fill(); ellipse(34, -50, 9, 5); ctx.fill();
  if (o.talking && Math.abs(Math.sin(t * 16)) > 0.25) { ellipse(0, -46, 9, 8 * Math.abs(Math.sin(t * 16)) + 3); ctx.fillStyle = '#c0504d'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, -52, 9, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
  ctx.restore();
}

function drawXiaoyu(x, y, s, o = {}) {
  const t = o.t || 0;
  const bounce = o.talking ? Math.abs(Math.sin(t * 9 + 1)) * 8 : Math.sin(t * 2.2 + 1) * 2;
  ctx.save(); ctx.translate(x, y - bounce); ctx.scale(s, s);
  // legs
  rr(-22, -40, 16, 36, 7); fillStroke('#3d4f8a', 3); rr(6, -40, 16, 36, 7); fillStroke('#3d4f8a', 3);
  ellipse(-16, -4, 14, 7); fillStroke('#fff', 3); ellipse(16, -4, 14, 7); fillStroke('#fff', 3);
  // arms
  const wave = o.wave ? Math.sin(t * 10) * 0.5 : 0;
  ctx.save(); ctx.translate(30, -80); ctx.rotate(-0.4 + wave - (o.wave ? 1.2 : 0)); rr(-6, -7, 38, 15, 7); fillStroke('#4f8ef7', 3); ctx.restore();
  ctx.save(); ctx.translate(-30, -80); ctx.rotate(0.5); rr(-32, -7, 38, 15, 7); fillStroke('#4f8ef7', 3); ctx.restore();
  // body
  rr(-36, -100, 72, 66, 22); fillStroke('#4f8ef7', 4);
  ctx.beginPath(); ctx.moveTo(-14, -100); ctx.lineTo(0, -82); ctx.lineTo(14, -100); ctx.closePath(); fillStroke('#fff', 3);
  ctx.beginPath(); ctx.moveTo(0, -82); ctx.lineTo(0, -40); ctx.lineWidth = 3; ctx.stroke();
  // head
  circle(0, -140, 44); fillStroke('#ffd9b8', 4);
  ctx.beginPath(); ctx.moveTo(-46, -138); ctx.quadraticCurveTo(-44, -192, 0, -188); ctx.quadraticCurveTo(46, -190, 46, -136);
  ctx.quadraticCurveTo(30, -160, 8, -156); ctx.lineTo(14, -170); ctx.lineTo(-6, -156); ctx.quadraticCurveTo(-30, -160, -46, -138); ctx.closePath();
  fillStroke('#3a2b2b', 4);
  const blink = (Math.floor(t * 0.6 + 2) % 4 === 0) && ((t * 0.6) % 1 < 0.12);
  ctx.fillStyle = OUTLINE;
  if (blink) { ctx.fillRect(-24, -136, 14, 4); ctx.fillRect(10, -136, 14, 4); }
  else { ellipse(-16, -136, 6, 8); ctx.fill(); ellipse(16, -136, 6, 8); ctx.fill(); ctx.fillStyle = '#fff'; circle(-14, -139, 2.5); ctx.fill(); circle(18, -139, 2.5); ctx.fill(); }
  ellipse(-28, -120, 8, 5); ctx.fillStyle = '#ff9f8a'; ctx.fill(); ellipse(28, -120, 8, 5); ctx.fill();
  if (o.talking && Math.abs(Math.sin(t * 17)) > 0.25) { ellipse(0, -116, 8, 7 * Math.abs(Math.sin(t * 17)) + 3); ctx.fillStyle = '#c0504d'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, -122, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke(); }
  ctx.restore();
}

function worker(x, y, s, t, col = '#ff8c2e', act = 0) {
  const b = Math.abs(Math.sin(t * 6 + x)) * 4;
  ctx.save(); ctx.translate(x, y - b); ctx.scale(s, s);
  rr(-16, -36, 32, 34, 12); fillStroke('#ffb44d', 3);
  ctx.fillStyle = '#fff6c9'; ctx.fillRect(-14, -24, 28, 5);
  circle(0, -52, 18); fillStroke('#ffd9b8', 3);
  ctx.beginPath(); ctx.moveTo(-20, -54); ctx.quadraticCurveTo(-18, -78, 0, -78); ctx.quadraticCurveTo(18, -78, 20, -54); ctx.closePath(); fillStroke(col, 3);
  ctx.fillStyle = OUTLINE; circle(-6, -50, 2.5); ctx.fill(); circle(6, -50, 2.5); ctx.fill();
  ctx.save(); ctx.translate(14, -28); ctx.rotate(-0.8 + Math.sin(t * 8 + x) * 0.5 * act); rr(0, -4, 24, 8, 4); fillStroke('#ffd9b8', 2); ctx.restore();
  ctx.restore();
}

// ---------- machines ----------
function eyes(x, y, s = 1) {
  ctx.fillStyle = '#fff'; ellipse(x - 9 * s, y, 7 * s, 8 * s); ctx.fill(); ellipse(x + 9 * s, y, 7 * s, 8 * s); ctx.fill();
  ctx.fillStyle = OUTLINE; circle(x - 7 * s, y + 1, 3.5 * s); ctx.fill(); circle(x + 11 * s, y + 1, 3.5 * s); ctx.fill();
}
function tracks(x, y, w, t) {
  rr(x, y - 30, w, 30, 15); fillStroke('#5d6470', 4);
  for (let i = 0; i < 4; i++) { circle(x + 18 + i * (w - 36) / 3, y - 15, 9); fillStroke('#aab1bd', 3); }
}
function excavator(x, y, t, dig = 1) {
  ctx.save(); ctx.translate(x, y);
  tracks(-80, 0, 160, t);
  rr(-70, -80, 120, 52, 14); fillStroke('#ffcc33');
  rr(-20, -125, 66, 52, 12); fillStroke('#ffcc33');
  rr(-10, -116, 46, 30, 8); fillStroke('#bfe9ff', 3);
  eyes(13, -101, 0.9);
  // arm
  const a1 = -0.9 + Math.sin(t * 2.4) * 0.25 * dig, a2 = 1.5 + Math.sin(t * 2.4 + 1) * 0.35 * dig;
  ctx.save(); ctx.translate(45, -70); ctx.rotate(a1);
  rr(0, -10, 110, 22, 10); fillStroke('#ffb000');
  ctx.translate(105, 0); ctx.rotate(a2);
  rr(0, -8, 80, 18, 8); fillStroke('#ffb000');
  ctx.translate(78, 0); ctx.rotate(0.4 + Math.sin(t * 2.4 + 2) * 0.4 * dig);
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(34, -6); ctx.lineTo(30, 26); ctx.lineTo(-4, 16); ctx.closePath(); fillStroke('#8a8f99');
  ctx.restore();
  ctx.restore();
}
function dumpTruck(x, y, t, load = 1, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  rr(-90, -78, 120, 52, 10); fillStroke('#ff7a59');
  if (load > 0) { ctx.beginPath(); ctx.moveTo(-86, -78); ctx.quadraticCurveTo(-30, -78 - 46 * load, 26, -78); ctx.closePath(); fillStroke('#b97d4a', 3); }
  rr(34, -92, 58, 66, 14); fillStroke('#ffd166');
  rr(46, -84, 36, 26, 7); fillStroke('#bfe9ff', 3);
  eyes(64, -48, 0.8);
  const spin = t * 6;
  for (const wx of [-60, 0, 62]) { circle(wx, -14, 18); fillStroke('#5d6470', 4); ctx.save(); ctx.translate(wx, -14); ctx.rotate(spin); ctx.fillStyle = '#aab1bd'; ctx.fillRect(-10, -2, 20, 4); ctx.restore(); }
  ctx.restore();
}
function pileRig(x, y, t, drilling) {
  ctx.save(); ctx.translate(x, y);
  tracks(-80, 0, 160, t);
  rr(-72, -78, 120, 50, 14); fillStroke('#7bc8f6');
  rr(-60, -118, 60, 44, 10); fillStroke('#7bc8f6'); rr(-52, -110, 44, 26, 7); fillStroke('#e6f7ff', 3);
  eyes(-30, -96, 0.85);
  // mast
  rr(14, -330, 22, 300, 6); fillStroke('#ffcc33');
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
  for (let yy = -320; yy < -40; yy += 24) { ctx.beginPath(); ctx.moveTo(16, yy); ctx.lineTo(34, yy + 22); ctx.stroke(); }
  // drill rod
  rr(20, -300, 10, 300 + 20, 4); fillStroke('#8a8f99', 2);
  ctx.restore();
}
function pumpTruck(x, y, t, tipX, tipY, pouring) {
  ctx.save(); ctx.translate(x, y);
  rr(-120, -80, 170, 54, 12); fillStroke('#a88ff0');
  rr(52, -96, 66, 70, 14); fillStroke('#ffd166'); rr(64, -88, 42, 28, 7); fillStroke('#bfe9ff', 3); eyes(85, -52, 0.8);
  for (const wx of [-90, -40, 80]) { circle(wx, -14, 18); fillStroke('#5d6470', 4); }
  ctx.restore();
  // boom: base on truck, elbow, tip
  const bx = x - 30, by = y - 90;
  const ex = (bx + tipX) / 2 + 20, ey = Math.min(by, tipY) - 140;
  ctx.lineCap = 'round';
  for (const [lw, col] of [[20, OUTLINE], [13, '#c9b8ff']]) {
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.lineTo(tipX, tipY - 120); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(tipX, tipY - 120); ctx.lineTo(tipX, tipY - 20); ctx.lineWidth = 12; ctx.strokeStyle = '#5d6470'; ctx.stroke();
  ctx.lineCap = 'butt';
  circle(bx, by, 12); fillStroke('#c9b8ff', 3); circle(ex, ey, 10); fillStroke('#c9b8ff', 3);
  if (pouring) {
    ctx.fillStyle = '#9aa1ad';
    for (let i = 0; i < 6; i++) { const k = ((t * 2.5 + i / 6) % 1); circle(tipX + Math.sin(i * 3) * 4, tipY - 20 + k * 40, 6 - k * 2); ctx.fill(); }
  }
}
function surveyor(x, y, t, beamTo, k) {
  // tripod + total station
  ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE;
  ctx.beginPath(); ctx.moveTo(x + 50, y); ctx.lineTo(x + 70, y - 90); ctx.lineTo(x + 90, y); ctx.moveTo(x + 70, y - 90); ctx.lineTo(x + 70, y); ctx.stroke();
  rr(x + 52, y - 128, 36, 40, 8); fillStroke('#ffcc33', 4);
  rr(x + 86, y - 116, 16, 12, 4); fillStroke('#8a8f99', 3);
  if (beamTo && k > 0) {
    ctx.save(); ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(x + 100, y - 110); ctx.lineTo(lerp(x + 100, beamTo[0], k), lerp(y - 110, beamTo[1], k));
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,60,60,0.85)'; ctx.stroke(); ctx.restore();
  }
  worker(x, y, 1.25, t, '#ff8c2e', 0.3);
}
function stake(x, y, h, s) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, backOut(clamp(s)));
  rr(-6, -h, 12, h, 4); fillStroke('#fff', 3);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ff5a5a'; ctx.fillRect(-4, -h + 6 + i * 22, 8, 10); }
  ctx.beginPath(); ctx.moveTo(6, -h + 4); ctx.lineTo(36, -h + 14); ctx.lineTo(6, -h + 24); ctx.closePath(); fillStroke('#ff5a5a', 3);
  ctx.restore();
}
function fence(x, w, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  for (let i = 0; i < w / 40; i++) {
    rr(x + i * 40, G - 70, 36, 66, 6); fillStroke(i % 2 ? '#ffffff' : '#5fb3ff', 3);
  }
  ctx.restore();
}

// ---------- construction layers ----------
function drawWater(S, t) {
  const inLevel = lerp(WATER_OUT, PB + 70, ease(sub(S.dewater, 0.35, 1)));
  // water is subtle normally, highlighted during the dewatering scene
  const hi = sub(S.dewater, 0, 0.15) * (1 - sub(S.dig, 0, 0.2));
  const alpha = 0.10 + 0.22 * hi;
  const wave = (x0, x1, y) => { ctx.beginPath(); ctx.moveTo(x0, H); for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, y + Math.sin(x / 40 + t * 2) * 4); ctx.lineTo(x1, H); ctx.closePath(); };
  ctx.fillStyle = `rgba(70,175,255,${alpha})`;
  wave(0, PX0, WATER_OUT); ctx.fill();
  wave(PX1, W, WATER_OUT); ctx.fill();
  wave(PX0, PX1, inLevel); ctx.fill();
  const r = rng(11);
  ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * hi})`;
  for (let i = 0; i < 40; i++) {
    const x = r() * W, sp = 10 + r() * 20, ph = r();
    const top = (x > PX0 && x < PX1) ? inLevel : WATER_OUT;
    const y = H - ((t * sp + ph * 600) % (H - top));
    circle(x, y, 3 + r() * 3); ctx.fill();
  }
  return inLevel;
}

function drawRetainingWalls(S, t) {
  if (S.piles <= 0) return;
  const kL = ease(sub(S.piles, 0.0, 0.42)), kR = ease(sub(S.piles, 0.55, 0.97));
  for (const [x, k] of [[PX0 - WL, kL], [PX1, kR]]) {
    if (k <= 0) continue;
    const bottom = lerp(G, PILE_TOE, k);
    rr(x, G - 4, WL, bottom - G + 4, 10); fillStroke('#bcc3cf', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 8, G + 4, 6, bottom - G - 14);
    ctx.strokeStyle = 'rgba(91,59,44,0.35)'; ctx.lineWidth = 2;
    for (let y = G + 60; y < bottom - 10; y += 60) { ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + WL - 4, y); ctx.stroke(); }
  }
  // crown beam badge text during piles scene
}

function drawHole(S, digY) {
  if (digY <= G) return;
  const g = ctx.createLinearGradient(0, G, 0, PB);
  g.addColorStop(0, '#fff3dc'); g.addColorStop(1, '#f3d7a8');
  ctx.fillStyle = g; ctx.fillRect(PX0, G - 10, PX1 - PX0, digY - G + 10);
  // dig floor
  ctx.beginPath(); ctx.moveTo(PX0, digY);
  for (let x = PX0; x <= PX1; x += 20) ctx.lineTo(x, digY + (S.dig < 1 ? Math.sin(x / 30) * 3 : 0));
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(91,59,44,0.6)'; ctx.stroke();
}

function drawWells(S, t) {
  const show = sub(S.dewater, 0, 0.35);
  const fade = 1 - sub(S.st, 0, 0.15);
  if (show <= 0 || fade <= 0) return;
  ctx.save(); ctx.globalAlpha = fade;
  WELLS.forEach((x, i) => {
    const k = ease(sub(show, i * 0.2, i * 0.2 + 0.6));
    if (k <= 0) return;
    const bot = lerp(G, PB + 110, k);
    rr(x - 9, G - 30, 18, bot - G + 30, 8); fillStroke('#e9eef5', 3);
    rr(x - 22, G - 58, 44, 32, 8); fillStroke('#5fb3ff', 3);
    eyes(x, G - 42, 0.55);
    if (S.dewater > 0.35 && S.wp < 1) {
      ctx.fillStyle = '#4aa8ff';
      for (let j = 0; j < 5; j++) { const q = (t * 0.8 + j / 5) % 1; circle(x, lerp(bot, G - 20, q), 5); ctx.fill(); }
      // spout arc
      for (let j = 0; j < 4; j++) { const q = (t * 1.5 + j / 4) % 1; circle(x + 22 + q * 30, G - 50 + q * q * 40, 4); ctx.fill(); }
    }
  });
  ctx.restore();
}

function drawStruts(S, digY, t) {
  const remove = sub(S.roof, 0.33, 0.55);
  STRUTS.forEach((y, i) => {
    const k = easeOut(clamp((digY - y - 25) / 60));
    if (k <= 0) return;
    const lift = ease(clamp(remove * 2 - i * 0.6));
    if (lift >= 1) return;
    ctx.save(); ctx.globalAlpha = 1 - lift; ctx.translate(0, -lift * 180);
    const w = (PX1 - PX0) * k;
    rr(PX0, y - 13, w, 26, 8); fillStroke('#ffcc33', 4);
    ctx.save(); rr(PX0, y - 13, w, 26, 8); ctx.clip();
    ctx.fillStyle = '#ff9a2e';
    for (let x = PX0 - 40; x < PX0 + w; x += 44) { ctx.beginPath(); ctx.moveTo(x, y + 13); ctx.lineTo(x + 18, y - 13); ctx.lineTo(x + 34, y - 13); ctx.lineTo(x + 16, y + 13); ctx.fill(); }
    ctx.restore();
    rr(PX0, y - 13, w, 26, 8); ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.stroke();
    rr(PX0 - 4, y - 20, 18, 40, 5); fillStroke('#8a8f99', 3);
    if (k > 0.98) { rr(PX1 - 14, y - 20, 18, 40, 5); fillStroke('#8a8f99', 3); }
    ctx.restore();
  });
}

function drawWaterproof(S, t) {
  const cush = ease(sub(S.wp, 0, 0.4));
  if (cush > 0) { rr(PX0, SLAB_B, (PX1 - PX0) * cush, PB - SLAB_B, 3); fillStroke('#c4c8cf', 3); }
  const mem = sub(S.wp, 0.4, 1);
  if (mem > 0) {
    const pts = [[PX0 + 5, ROOF_T], [PX0 + 5, SLAB_B - 2], [PX1 - 5, SLAB_B - 2], [PX1 - 5, ROOF_T]];
    const lens = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
    let rem = total * ease(mem);
    ctx.beginPath(); ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length && rem > 0; i++) {
      const k = Math.min(1, rem / lens[i - 1]);
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)); rem -= lens[i - 1];
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 12; ctx.strokeStyle = '#1f8f96'; ctx.stroke();
    ctx.lineWidth = 7; ctx.strokeStyle = '#3cd1d8'; ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

function rebarRect(x0, y0, x1, y1, k, vertical) {
  if (k <= 0) return;
  ctx.save(); ctx.beginPath();
  if (vertical) ctx.rect(x0 - 4, lerp(y1, y0, k) - 4, x1 - x0 + 8, (y1 - y0) * k + 8);
  else ctx.rect(x0 - 4, y0 - 4, (x1 - x0) * k + 8, y1 - y0 + 8);
  ctx.clip();
  ctx.strokeStyle = '#e8743b'; ctx.lineWidth = 3.5;
  ctx.beginPath();
  const step = 22;
  ctx.moveTo(x0, y0 + 6); ctx.lineTo(x1, y0 + 6); ctx.moveTo(x0, y1 - 6); ctx.lineTo(x1, y1 - 6);
  ctx.moveTo(x0 + 6, y0); ctx.lineTo(x0 + 6, y1); ctx.moveTo(x1 - 6, y0); ctx.lineTo(x1 - 6, y1);
  if (vertical) for (let y = y0 + step; y < y1; y += step) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  else for (let x = x0 + step; x < x1; x += step) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  ctx.stroke(); ctx.restore();
}
function concrete(x0, y0, x1, y1, k, vertical) {
  if (k <= 0) return;
  if (vertical) rr(x0, lerp(y1, y0, k), x1 - x0, (y1 - y0) * k, 4);
  else rr(x0, y0, (x1 - x0) * k, y1 - y0, 4);
  fillStroke('#cfd4dc', 3.5, '#6f7787');
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(120,128,140,0.25)';
  const r = rng(x0 * 7 + y0);
  for (let i = 0; i < (x1 - x0) * (y1 - y0) / 500; i++) { circle(lerp(x0, x1, r()), lerp(y0, y1, r()), 2 + r() * 2); ctx.fill(); }
  ctx.restore();
}

function drawStructure(S, t) {
  const reb = sub(S.st, 0, 0.38);
  const pour = sub(S.st, 0.42, 1);
  const base = ease(sub(pour, 0, 0.35)), walls = ease(sub(pour, 0.35, 0.75)), cols = ease(sub(pour, 0.6, 0.95));
  // rebar
  rebarRect(WALL_L[1], SLAB_T, WALL_R[0], SLAB_B, ease(sub(reb, 0, 0.5)), false);
  rebarRect(WALL_L[0], ROOF_T, WALL_L[1], SLAB_B, ease(sub(reb, 0.3, 0.8)), true);
  rebarRect(WALL_R[0], ROOF_T, WALL_R[1], SLAB_B, ease(sub(reb, 0.3, 0.8)), true);
  for (const [a, b] of COLS) rebarRect(a, ROOF_B, b, SLAB_T, ease(sub(reb, 0.55, 1)), true);
  // concrete
  concrete(WALL_L[0], SLAB_T, WALL_R[1], SLAB_B, base, false);
  concrete(WALL_L[0], ROOF_T, WALL_L[1], SLAB_T + 4, walls, true);
  concrete(WALL_R[0], ROOF_T, WALL_R[1], SLAB_T + 4, walls, true);
  for (const [a, b] of COLS) concrete(a, ROOF_B - 2, b, SLAB_T + 2, cols, true);
  // roof
  const rReb = ease(sub(S.roof, 0, 0.14)), rCon = ease(sub(S.roof, 0.14, 0.33));
  rebarRect(WALL_L[0], ROOF_T, WALL_R[1], ROOF_B, rReb, false);
  concrete(WALL_L[0], ROOF_T, WALL_R[1], ROOF_B, rCon, false);
  return { reb, pour, base, walls, cols, rCon };
}

function drawInterior(S, t) {
  const k = S.inn; if (k <= 0) return;
  const x0 = WALL_L[1], x1 = WALL_R[0], y0 = ROOF_B, y1 = SLAB_T;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  // back wall
  const wa = ease(sub(k, 0, 0.25));
  ctx.globalAlpha = wa;
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#e6f4ff'); g.addColorStop(1, '#cfe7ff');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(120,160,210,0.35)'; ctx.lineWidth = 2;
  for (let x = x0 + 52; x < x1; x += 52) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 - 45); ctx.stroke(); }
  ctx.fillStyle = '#ffd36b'; ctx.fillRect(x0, y1 - 80, x1 - x0, 10);
  ctx.globalAlpha = 1;
  // floor (pseudo perspective band)
  const fk = ease(sub(k, 0.3, 0.6));
  if (fk > 0) {
    const fy = y1 - 44;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, fy - 2, (x1 - x0) * fk, 50); ctx.clip();
    ctx.beginPath(); ctx.moveTo(x0 + 40, fy); ctx.lineTo(x1 - 40, fy); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath();
    ctx.fillStyle = '#eab67a'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,100,50,0.35)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { const yy = fy + i * 11; ctx.beginPath(); ctx.moveTo(x0 + 40 - i * 10, yy); ctx.lineTo(x1 - 40 + i * 10, yy); ctx.stroke(); }
    // court lines
    const lk = sub(k, 0.82, 1);
    if (lk > 0) {
      ctx.globalAlpha = lk; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      const cx = (x0 + x1) / 2;
      ctx.beginPath(); ctx.moveTo(cx, fy + 2); ctx.lineTo(cx, y1 - 2); ctx.stroke();
      ellipse(cx, fy + 22, 60, 14); ctx.stroke();
      for (const side of [-1, 1]) {
        const ex = side < 0 ? x0 + 40 : x1 - 40;
        ctx.beginPath(); ctx.moveTo(ex, fy + 4); ctx.lineTo(ex - side * 110, fy + 10); ctx.lineTo(ex - side * 120, y1 - 6); ctx.lineTo(ex - side * -2, y1 - 6); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex, fy + 22, 200, 30, 0, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // ducts
  const dk = ease(sub(k, 0.1, 0.4));
  if (dk > 0) {
    rr(x0 + 10, y0 + 12, (x1 - x0 - 20) * dk, 24, 12); fillStroke('#e3e8ef', 3, '#7d8796');
    for (let x = x0 + 60; x < x0 + 10 + (x1 - x0 - 20) * dk - 20; x += 120) { rr(x, y0 + 32, 30, 10, 3); fillStroke('#c2c9d4', 2, '#7d8796'); }
  }
  // lights
  const lamps = [720, 840, 960, 1080, 1200];
  lamps.forEach((x, i) => {
    const on = sub(k, 0.03 + i * 0.05, 0.08 + i * 0.05);
    if (on <= 0) return;
    ctx.globalAlpha = Math.min(1, on * 2);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 52); ctx.lineWidth = 3; ctx.strokeStyle = '#7d8796'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 24, y0 + 70); ctx.quadraticCurveTo(x, y0 + 40, x + 24, y0 + 70); ctx.closePath(); fillStroke('#ffffff', 3);
    if (on > 0.5) {
      const gl = ctx.createRadialGradient(x, y0 + 72, 4, x, y0 + 120, 120);
      gl.addColorStop(0, 'rgba(255,240,170,0.75)'); gl.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(x - 22, y0 + 70); ctx.lineTo(x - 110, y1); ctx.lineTo(x + 110, y1); ctx.lineTo(x + 22, y0 + 70); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  // hoops
  const hk = sub(k, 0.6, 0.8);
  if (hk > 0) {
    const drop = (1 - backOut(hk)) * -120;
    for (const side of [-1, 1]) {
      const wx = side < 0 ? x0 : x1, dir = -side;
      ctx.save(); ctx.translate(0, drop);
      ctx.beginPath(); ctx.moveTo(wx, y0 + 90); ctx.lineTo(wx + dir * 40, y0 + 90); ctx.lineWidth = 6; ctx.strokeStyle = '#7d8796'; ctx.stroke();
      rr(wx + dir * 40 - 5, y0 + 60, 10, 70, 3); fillStroke('#fff', 3);
      ctx.beginPath(); ctx.ellipse(wx + dir * 62, y0 + 120, 18, 5, 0, 0, 7); ctx.lineWidth = 4; ctx.strokeStyle = '#ff5a3c'; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.moveTo(wx + dir * 62 + j * 8, y0 + 122); ctx.lineTo(wx + dir * 62 + j * 5, y0 + 148); ctx.stroke(); }
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawBackfill(S, t) {
  const k = ease(sub(S.roof, 0.55, 0.78));
  if (k <= 0) return;
  const top = lerp(ROOF_T, G, k);
  ctx.beginPath(); ctx.moveTo(PX0 - WL, ROOF_T);
  ctx.lineTo(PX0 - WL, top);
  for (let x = PX0 - WL; x <= PX1 + WL; x += 20) ctx.lineTo(x, top + (k < 1 ? Math.sin(x / 25 + t * 3) * 4 : 0));
  ctx.lineTo(PX1 + WL, ROOF_T); ctx.closePath();
  ctx.fillStyle = SOIL[0]; ctx.fill();
  const r = rng(5); ctx.fillStyle = 'rgba(255,240,220,0.35)';
  for (let i = 0; i < 40; i++) { const x = lerp(PX0 - WL, PX1 + WL, r()), y = lerp(top + 6, ROOF_T - 4, r()); if (y > top) { ellipse(x, y, 5, 3); ctx.fill(); } }
}
function drawPark(S, t) {
  const g = ease(sub(S.roof, 0.78, 0.9));
  if (g <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(PX0 - WL, 0, (PX1 - PX0 + 2 * WL) * g, G + 20); ctx.clip();
  drawGrass(PX0 - WL, PX1 + WL);
  ctx.restore();
  const tk = ease(sub(S.roof, 0.86, 1));
  if (tk > 0) {
    const x0 = 650, x1 = 1270, y = G - 4;
    ctx.save(); ctx.globalAlpha = tk;
    rr(x0, y - 16, x1 - x0, 20, 8); fillStroke('#ff7a6b', 3);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    for (const yy of [y - 10, y - 4]) { ctx.beginPath(); ctx.moveTo(x0 + 10, yy); ctx.lineTo(x1 - 10, yy); ctx.stroke(); }
    // goal posts
    for (const [gx, d] of [[690, -1], [1230, 1]]) { ctx.beginPath(); ctx.moveTo(gx, y - 16); ctx.lineTo(gx, y - 70); ctx.lineTo(gx + d * 40, y - 70); ctx.lineTo(gx + d * 40, y - 16); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.restore();
    // trees & flowers pop
    [[600, 0], [1330, 0.15], [820, 0.3], [1100, 0.45]].forEach(([x, d]) => { const s = backOut(clamp((tk - d) / 0.4)); if (s > 0) tree(x, G - 6, 0.75 * s, t); });
    // entrance pavilion
    const pk = backOut(clamp((tk - 0.3) / 0.5));
    if (pk > 0) {
      ctx.save(); ctx.translate(1440, G); ctx.scale(pk, pk);
      rr(-60, -110, 120, 110, 12); fillStroke('rgba(170,225,255,0.85)');
      rr(-75, -126, 150, 22, 10); fillStroke('#ffd166');
      rr(-22, -70, 44, 70, 8); fillStroke('#e6f7ff', 3);
      text('入口', 0, -92, 22, '#3d4f8a');
      ctx.restore();
    }
  }
}

// ---------- UI ----------
function drawStepCard(t) {
  const s = curScene(t);
  // badge (persistent once steps begin)
  let stepIdx = 0, title = '';
  for (const sc of TL.scenes) if (sc.step && t >= sc.start) { stepIdx = sc.step; title = sc.title; }
  const lt = t - s.start;
  const cardOn = s.step && lt < 1.8;
  const finale = t >= scene('finale').start;
  if (stepIdx && !finale) {
    const a = cardOn ? sub(lt, 1.4, 1.8) : 1;
    ctx.save(); ctx.globalAlpha = a;
    rr(36, 30, 420, 112, 30); fillStroke('rgba(255,255,255,0.92)', 4);
    rr(52, 46, 120, 50, 22); fillStroke('#ff8c2e', 3);
    text(`第${'一二三四五六七八'[stepIdx - 1]}步`, 112, 72, 30, '#fff');
    text(title, 186, 72, 40, '#5b3b2c', { align: 'left' });
    for (let i = 0; i < 8; i++) { circle(70 + i * 46, 118, 10); fillStroke(i < stepIdx ? '#ffb44d' : '#efe6dc', 3); }
    ctx.restore();
  }
  if (s.id === 'why') {
    const a = clamp(lt / 0.4) * clamp((s.end - t) / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    rr(36, 30, 380, 84, 30); fillStroke('rgba(255,255,255,0.92)', 4);
    text('为什么建在地下？', 226, 72, 40, '#5b3b2c');
    ctx.restore();
  }
  if (cardOn) {
    const sIn = elastic(clamp(lt / 0.9));
    const out = sub(lt, 1.35, 1.8);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(lerp(W / 2, 240, ease(out)), lerp(330, 80, ease(out)));
    const sc = sIn * lerp(1, 0.4, ease(out)); ctx.scale(sc, sc); ctx.rotate(Math.sin(lt * 3) * 0.02);
    rr(-330, -130, 660, 260, 60); fillStroke('#fffaf0', 7);
    rr(-120, -150, 240, 70, 35); fillStroke('#ff8c2e', 6);
    text(`第${'一二三四五六七八'[s.step - 1]}步`, 0, -114, 44, '#fff');
    text(s.title, 0, 20, 96, '#ff8c2e', { stroke: '#5b3b2c', lw: 10 });
    for (let i = 0; i < 3; i++) { const st = (lt * 2 + i) % 3; ctx.save(); ctx.translate(-300 + i * 300, 110); ctx.rotate(st); star(0, 0, 18, '#ffd34d'); ctx.restore(); }
    ctx.restore();
  }
}
function star(x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath(); fillStroke(col, 3);
}

function drawSubtitle(t) {
  const c = curLine(t); if (!c) return;
  const l = c.line;
  const appear = easeOut(clamp((t - l.start + 0.08) / 0.2));
  const y = 1048 - 145, h = 132;
  ctx.save(); ctx.globalAlpha = appear; ctx.translate(0, (1 - appear) * 20);
  ctx.font = `50px ${FONT}`;
  const tw = ctx.measureText(l.text).width;
  const w = Math.max(760, tw + 260), x = (W - w) / 2;
  rr(x, y, w, h, 40); fillStroke('rgba(255,252,245,0.96)', 5);
  // avatar
  const ax = x + 78, ay = y + h / 2;
  circle(ax, ay, 52); fillStroke(l.who === 'anan' ? '#fff0b3' : '#d6e8ff', 4);
  ctx.save(); circle(ax, ay, 50); ctx.clip();
  if (l.who === 'anan') drawAnan(ax, ay + 88, 0.9, { t, talking: c.talking });
  else drawXiaoyu(ax, ay + 128, 0.82, { t, talking: c.talking });
  ctx.restore();
  const name = TL.voices[l.who];
  rr(ax - 44, y + h - 22, 88, 34, 17); fillStroke(l.who === 'anan' ? '#ff8c2e' : '#4f8ef7', 3);
  text(name, ax, y + h - 4, 24, '#fff');
  text(l.text, x + 150 + (w - 170) / 2, ay + 2, 50, '#4a2f22');
  ctx.restore();
}

function drawTitle(t) {
  const s = scene('intro');
  if (t > s.end + 0.5) return;
  const a = clamp((s.end + 0.5 - t) / 0.6);
  const str = '地下体育馆诞生记';
  ctx.save(); ctx.globalAlpha = a;
  for (let i = 0; i < str.length; i++) {
    const k = clamp((t - 0.2 - i * 0.08) / 0.6);
    if (k <= 0) continue;
    const sc = backOut(k);
    const x = W / 2 + (i - (str.length - 1) / 2) * 118;
    const y = 175 + Math.sin(t * 3 + i * 0.7) * 8;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate(Math.sin(t * 2 + i) * 0.05);
    text(str[i], 0, 0, 118, ['#ff8c2e', '#ffcc33', '#5fb3ff', '#7ccf6b'][i % 4], { stroke: '#fff', lw: 22 });
    text(str[i], 0, 0, 118, ['#ff8c2e', '#ffb000', '#3d9bff', '#55b844'][i % 4], { stroke: OUTLINE, lw: 6 });
    ctx.restore();
  }
  const k2 = clamp((t - 1.2) / 0.5);
  if (k2 > 0) { ctx.globalAlpha = a * k2; rr(W / 2 - 200, 262, 400, 56, 28); fillStroke('#fff', 4); text('跟着安安看施工', W / 2, 291, 34, '#5b3b2c'); }
  ctx.restore();
}

function drawWhy(S, t) {
  const s = scene('why');
  if (t < s.start || t > scene('survey').start + 0.6) return;
  const fadeOut = 1 - clamp((t - s.end) / 0.6);
  // planned gym outline
  const a = clamp((t - s.start) / 0.6) * fadeOut;
  ctx.save(); ctx.globalAlpha = a;
  ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 40;
  rr(WALL_L[0], ROOF_T, WALL_R[1] - WALL_L[0], SLAB_B - ROOF_T, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.setLineDash([]);
  text('未来的体育馆', 960, 628 + Math.sin(t * 3) * 6, 56, '#fff', { stroke: '#a86a3f', lw: 10 });
  ctx.restore();
  const bubbles = [
    [lineStart('why', 1), 700, '省出地面', 'tree'],
    [lineStart('why', 2), 960, '冬暖夏凉', 'temp'],
    [lineStart('why', 2) + 1.2, 1220, '安静', 'quiet'],
  ];
  const cheer = t > lineStart('why', 3) ? Math.abs(Math.sin((t - lineStart('why', 3)) * 8)) * 12 : 0;
  for (const [t0, x, label, icon] of bubbles) {
    const k = clamp((t - t0) / 0.6); if (k <= 0) continue;
    ctx.save(); ctx.globalAlpha = fadeOut; ctx.translate(x, 250 - cheer + Math.sin(t * 2 + x) * 5); ctx.scale(backOut(k), backOut(k));
    circle(0, 0, 92); fillStroke('rgba(255,255,255,0.95)', 5);
    if (icon === 'tree') { ctx.save(); ctx.translate(0, 18); tree(0, 0, 0.62, t); ctx.restore(); }
    if (icon === 'temp') {
      circle(-26, -16, 24); fillStroke('#ffd34d', 3);
      ctx.strokeStyle = '#5fb3ff'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(28, -6); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.restore(); }
    }
    if (icon === 'quiet') {
      text('Z', -20, -4, 40, '#7c6cf0'); text('z', 14, -24, 30, '#9b8ff5'); text('z', 36, -42, 22, '#b6adf8');
    }
    text(label, 0, 52, 32, '#5b3b2c');
    ctx.restore();
  }
}

function drawConfetti(t, k) {
  if (k <= 0) return;
  const r = rng(99);
  for (let i = 0; i < 90; i++) {
    const x0 = r() * W, sp = 120 + r() * 160, ph = r() * H, col = ['#ff8c2e', '#ffd34d', '#5fb3ff', '#7ccf6b', '#ff7ab6'][i % 5];
    const y = ((t * sp + ph) % (H + 40)) - 20;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(x0 + Math.sin(t * 2 + i) * 30, y); ctx.rotate(t * 3 + i);
    ctx.fillStyle = col; ctx.fillRect(-7, -4, 14, 8); ctx.restore();
  }
}

function drawKids(S, t) {
  if (!S.fin) return;
  const ft = S.finT;
  const fy = SLAB_T - 6;
  const kids = [[830, '#ff7ab6', 0], [960, '#7ccf6b', 0.4], [1070, '#ffcc33', 0.9]];
  kids.forEach(([x, col, d]) => {
    const k = backOut(clamp((ft - d) / 0.5)); if (k <= 0) return;
    const jump = Math.abs(Math.sin(ft * 5 + d * 3)) * 18;
    ctx.save(); ctx.translate(x, fy - jump); ctx.scale(0.75 * k, 0.75 * k);
    rr(-20, -60, 40, 44, 14); fillStroke(col, 3);
    rr(-16, -18, 12, 18, 5); fillStroke('#3d4f8a', 3); rr(4, -18, 12, 18, 5); fillStroke('#3d4f8a', 3);
    circle(0, -84, 26); fillStroke('#ffd9b8', 3);
    ctx.beginPath(); ctx.arc(0, -90, 27, Math.PI, 0); ctx.fillStyle = '#3a2b2b'; ctx.fill();
    ctx.fillStyle = OUTLINE; circle(-9, -82, 3); ctx.fill(); circle(9, -82, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -74, 7, 0, Math.PI); ctx.fill();
    ctx.save(); ctx.translate(18, -54); ctx.rotate(-2.2 + Math.sin(ft * 10 + d) * 0.4); rr(0, -5, 28, 10, 5); fillStroke(col, 2); ctx.restore();
    ctx.save(); ctx.translate(-18, -54); ctx.rotate(-1 - Math.sin(ft * 10 + d) * 0.4); rr(-28, -5, 28, 10, 5); fillStroke(col, 2); ctx.restore();
    ctx.restore();
  });
  // ball arc from middle kid to right hoop
  const cyc = 1.8, q = ((ft - 0.8) % cyc) / cyc;
  if (ft > 0.8) {
    const sx = 980, sy = fy - 90, ex = WALL_R[0] - 62, ey = ROOF_B + 112;
    const bx = lerp(sx, ex, q), by = lerp(sy, ey, q) - Math.sin(q * Math.PI) * 120;
    circle(bx, by, 16); fillStroke('#ff8a3d', 3);
    ctx.beginPath(); ctx.moveTo(bx - 16, by); ctx.lineTo(bx + 16, by); ctx.moveTo(bx, by - 16); ctx.lineTo(bx, by + 16); ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawEndCard(t) {
  const fs = scene('finale');
  const t0 = fs.end - 3.3;
  const k = clamp((t - t0) / 0.6); if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k * 0.9; ctx.fillStyle = '#fff7e6'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  const bob = Math.sin(t * 3) * 10;
  drawAnan(720, 760, 2.2, { t, wave: true, seed: 1 });
  drawXiaoyu(1200, 760, 2.0, { t: t + 0.5, wave: true });
  const sc = backOut(clamp((t - t0 - 0.2) / 0.6));
  ctx.translate(W / 2, 200 + bob); ctx.scale(sc, sc);
  text('下次见！', 0, 0, 150, '#ff8c2e', { stroke: '#fff', lw: 26 });
  text('下次见！', 0, 0, 150, '#ff8c2e', { stroke: OUTLINE, lw: 7 });
  ctx.restore();
  drawConfetti(t, k);
}

// ---------- main draw ----------
function draw(t) {
  const S = state(t);
  ctx.clearRect(0, 0, W, H);
  drawSky(t);
  drawSchool(t);
  drawGround();
  drawGrass(0, W);
  // retaining walls cut the grass
  const inLevel = drawWater(S, t);
  const digY = lerp(G, PB, ease(S.dig));
  if (S.dig > 0) { ctx.fillStyle = '#fff3dc'; }
  drawHole(S, digY);
  drawRetainingWalls(S, t);
  drawWaterproof(S, t);
  drawWells(S, t);
  const st = drawStructure(S, t);
  drawInterior(S, t);
  drawStruts(S, digY, t);
  drawBackfill(S, t);
  // surface: trees left of site, fence
  tree(1545, G, 0.8, t);
  if (S.roof > 0.8) drawPark(S, t);
  const fenceA = 1 - sub(S.roof, 0.75, 0.85);
  if (S.roof < 0.78) { drawGrassCut(S, digY); }
  fence(PX0 - WL - 124, 120, fenceA); fence(PX1 + WL + 4, 120, fenceA);

  // --- machines & people ---
  // survey
  if (t > scene('survey').start - 0.5 && S.piles < 0.3) {
    const a = 1 - sub(S.piles, 0, 0.3);
    ctx.save(); ctx.globalAlpha = a;
    const k1 = sub(S.survey, 0.05, 0.4), k2 = sub(S.survey, 0.45, 0.8);
    surveyor(390, G, t, k2 > 0 ? [PX1, G - 70] : [PX0, G - 70], k2 > 0 ? k2 : k1);
    ctx.restore();
  }
  if (S.survey > 0 && S.piles < 0.5) {
    const a = 1 - sub(S.piles, 0.2, 0.5);
    ctx.save(); ctx.globalAlpha = a;
    stake(PX0 - 20, G, 74, sub(S.survey, 0.3, 0.45));
    stake(PX1 + 20, G, 74, sub(S.survey, 0.75, 0.9));
    const lk = ease(sub(S.survey, 0.85, 1));
    if (lk > 0) {
      ctx.setLineDash([20, 12]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.moveTo(PX0 - 20, G - 2); ctx.lineTo(lerp(PX0 - 20, PX1 + 20, lk), G - 2); ctx.lineWidth = 6; ctx.strokeStyle = '#ff3d3d'; ctx.stroke();
      ctx.setLineDash([]);
      if (lk > 0.9) text('体育馆的位置', 960, G - 46, 40, '#ff3d3d', { stroke: '#fff', lw: 10 });
    }
    ctx.restore();
  }
  // pile rig
  if (S.piles > 0 && S.dewater < 0.3) {
    const a = 1 - sub(S.dewater, 0, 0.3);
    const rx = S.piles < 0.45 ? PX0 - WL / 2 : S.piles < 0.55 ? lerp(PX0 - WL / 2, PX1 + WL / 2, ease(sub(S.piles, 0.45, 0.55))) : PX1 + WL / 2;
    ctx.save(); ctx.globalAlpha = a * clamp(S.piles * 10);
    pileRig(rx - 25, G, t, true);
    ctx.restore();
    const k = S.piles > 0.85 ? sub(S.piles, 0.85, 1) : 0;
    if (k > 0) {
      ctx.save(); ctx.globalAlpha = (1 - sub(S.dewater, 0, 0.2));
      text('围护墙', PX0 - WL / 2, 700, 40, '#fff', { stroke: '#5b6475', lw: 10 });
      text('围护墙', PX1 + WL / 2, 700, 40, '#fff', { stroke: '#5b6475', lw: 10 });
      ctx.restore();
    }
  }
  if (S.dewater > 0.4 && S.dig < 0.15) {
    ctx.save(); ctx.globalAlpha = sub(S.dewater, 0.4, 0.55) * (1 - sub(S.dig, 0, 0.15));
    text('地下水', 300, 760, 44, '#fff', { stroke: '#2f86d6', lw: 10 });
    text('水位下降 ↓', 960, Math.min(inLevel + 60, 900), 40, '#fff', { stroke: '#2f86d6', lw: 10 });
    ctx.restore();
  }
  // excavator + dump truck
  if (S.dig > 0 && S.wp < 0.25) {
    const a = clamp(S.dig * 8) * (1 - sub(S.wp, 0, 0.25));
    ctx.save(); ctx.globalAlpha = a;
    const ex = 820 + Math.sin(t * 0.5) * 140;
    excavator(ex, Math.max(digY, G), t, 1);
    const cyc = (t * 0.18) % 1;
    const tx = 1420 + Math.sin(cyc * Math.PI * 2) * 60;
    dumpTruck(tx, G, t, cyc < 0.5 ? 1 : 0.6, 1);
    ctx.restore();
  }
  if (S.dig > 0.5 && S.wp < 0.2) {
    ctx.save(); ctx.globalAlpha = sub(S.dig, 0.5, 0.6) * (1 - sub(S.wp, 0, 0.2));
    text('钢支撑', 1180, STRUTS[0] + 44, 36, '#fff', { stroke: '#d98a00', lw: 9 });
    ctx.restore();
  }
  if (S.dig > 0.8 && S.wp < 0.25) {
    // depth ruler
    ctx.save(); ctx.globalAlpha = sub(S.dig, 0.8, 0.95) * (1 - sub(S.wp, 0, 0.25));
    for (let i = 0; i < 4; i++) { const y0 = G + i * (PB - G) / 4; rr(1250, y0 + 6, 46, (PB - G) / 4 - 12, 10); fillStroke('#fff', 3); text(`${i + 1}F`, 1273, y0 + (PB - G) / 8, 26, '#5b3b2c'); }
    ctx.restore();
  }
  // waterproof labels & workers
  if (S.wp > 0 && S.st < 0.06) {
    const a = clamp(S.wp * 6) * (1 - sub(S.st, 0, 0.06));
    ctx.save(); ctx.globalAlpha = a;
    worker(lerp(700, 1200, ease(sub(S.wp, 0, 0.4))), SLAB_B, 1.1, t, '#ff8c2e', 1);
    worker(lerp(760, 1240, ease(sub(S.wp, 0.4, 1))), SLAB_B, 1.1, t + 1, '#5fb3ff', 1);
    if (S.wp > 0.15) text('垫层', 760, 830, 32, '#fff', { stroke: '#6f7787', lw: 8 });
    if (S.wp > 0.6) text('防水卷材', 960, 680, 44, '#fff', { stroke: '#1f8f96', lw: 10 });
    ctx.restore();
  }
  if (S.st > 0 && S.st < 1) {
    const a = clamp(S.st * 8) * (1 - sub(S.st, 0.92, 1));
    ctx.save(); ctx.globalAlpha = a;
    if (S.st < 0.45) {
      worker(820, SLAB_T, 1.0, t, '#ff8c2e', 1); worker(1000, SLAB_T, 1.0, t + 0.7, '#7ccf6b', 1); worker(1180, SLAB_T, 1.0, t + 1.3, '#5fb3ff', 1);
      text('钢筋 = 骨架', 960, 600, 46, '#fff', { stroke: '#e8743b', lw: 10 });
    } else {
      text('混凝土 = 肌肉', 960, 600, 46, '#fff', { stroke: '#6f7787', lw: 10 });
    }
    ctx.restore();
  }
  // pump truck
  const pourScene = (S.st > 0.38 && S.st < 1) || (S.roof > 0.1 && S.roof < 0.36);
  const pumpA = Math.max(sub(S.st, 0.38, 0.45) * (1 - sub(S.roof, 0.33, 0.4)), 0);
  if (pumpA > 0) {
    let tipX = 960, tipY = SLAB_T;
    if (S.roof > 0) { tipX = lerp(WALL_L[0], WALL_R[1], ease(sub(S.roof, 0.14, 0.33))); tipY = ROOF_T - 10; }
    else if (st.pour < 0.35) { tipX = lerp(WALL_L[1], WALL_R[0], st.base); tipY = SLAB_T - 6; }
    else if (st.pour < 0.6) { tipX = 630; tipY = lerp(SLAB_T, ROOF_T, st.walls); }
    else if (st.pour < 0.75) { tipX = 1290; tipY = lerp(SLAB_T, ROOF_T, st.walls); }
    else { tipX = 1147; tipY = lerp(SLAB_T, ROOF_B, st.cols); }
    tipY = Math.min(tipY, G + 200);
    ctx.save(); ctx.globalAlpha = pumpA;
    pumpTruck(300, G, t, tipX, Math.max(tipY, G - 40 + (tipY - G) * 0.0) , pourScene);
    ctx.restore();
  }
  if (S.roof > 0.35 && S.roof < 0.6) {
    ctx.save(); ctx.globalAlpha = sub(S.roof, 0.35, 0.4) * (1 - sub(S.roof, 0.55, 0.6));
    text('拆除钢支撑', 960, 420 - 120, 48, '#fff', { stroke: '#d98a00', lw: 10 });
    ctx.restore();
  }
  if (S.roof > 0.55 && S.roof < 0.8) {
    ctx.save(); ctx.globalAlpha = sub(S.roof, 0.55, 0.6) * (1 - sub(S.roof, 0.75, 0.8));
    dumpTruck(lerp(1700, 1420, ease(sub(S.roof, 0.5, 0.6))), G, t, 1 - sub(S.roof, 0.6, 0.78), -1);
    text('回填土', 960, 330, 48, '#fff', { stroke: '#a86a3f', lw: 10 });
    ctx.restore();
  }
  if (S.inn > 0 && !S.fin) {
    const labels = [[0.05, 0.3, '灯光', 760, 640], [0.12, 0.42, '通风管道', 960, 580], [0.32, 0.62, '木地板', 960, 660], [0.62, 1, '篮球架', 960, 620]];
    for (const [a0, a1, lab, x, y] of labels) {
      const k = sub(S.inn, a0, a0 + 0.05) * (1 - sub(S.inn, a1 - 0.03, a1));
      if (k > 0) { ctx.save(); ctx.globalAlpha = k; text(lab, x, y, 40, '#fff', { stroke: '#4f8ef7', lw: 9 }); ctx.restore(); }
    }
  }
  drawKids(S, t);
  drawWhy(S, t);

  // narrators on the surface (right side)
  const c = curLine(t);
  const talkA = c && c.talking && c.line.who === 'anan', talkX = c && c.talking && c.line.who === 'xiaoyu';
  const introWave = t < scene('intro').end || S.fin;
  drawAnan(1650, G + 2, 0.9, { t, talking: talkA, wave: introWave && !talkA, seed: 3 });
  drawXiaoyu(1795, G + 2, 0.85, { t, talking: talkX, wave: S.fin && !talkX });

  drawTitle(t);
  if (S.fin) drawConfetti(t, clamp(S.finT / 0.5));
  drawStepCard(t);
  drawSubtitle(t);
  drawEndCard(t);
}

// grass strip above the pit disappears when digging begins / walls exist
function drawGrassCut(S, digY) {
  if (S.piles > 0) {
    // crown beam on top of retaining walls
    const kL = sub(S.piles, 0.3, 0.42), kR = sub(S.piles, 0.85, 0.97);
    if (kL > 0) { rr(PX0 - WL - 6, G - 10, WL + 12, 22, 6); fillStroke('#a9b1be', 3); }
    if (kR > 0) { rr(PX1 - 6, G - 10, WL + 12, 22, 6); fillStroke('#a9b1be', 3); }
  }
}

window.init = tl => { TL = tl; };
window.draw = draw;
window.fontsReady = async (chars) => {
  await document.fonts.load(`50px "ZCOOL KuaiLe"`, chars);
  await document.fonts.ready;
  return document.fonts.check(`50px "ZCOOL KuaiLe"`, '地下体育馆');
};
