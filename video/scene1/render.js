// Render frames with headless Chromium and encode the final video.
// usage: node render.js stills t1 t2 ...   |   node render.js video
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const HERE = __dirname, FPS = 30;
const tl = JSON.parse(fs.readFileSync(path.join(HERE, 'timeline.json'), 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(HERE, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(HERE) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}
const CHARS = [...new Set(tl.lines.map(l => l.text).join('') + Object.values(tl.voices).join('') +
  '甲乙')].join('');

async function openPage(browser, port) {
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(`http://127.0.0.1:${port}/index.html`);
  await pg.evaluate(t => window.init(t), tl);
  if (!await pg.evaluate(c => window.fontsReady(c), CHARS)) throw new Error('font not loaded');
  return pg;
}
async function shot(pg, t) { await pg.evaluate(t => window.draw(t), t); return pg.screenshot({ type: 'jpeg', quality: 93 }); }

async function renderChunk(browser, port, i0, i1, out) {
  const pg = await openPage(browser, port);
  const enc = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => enc.on('close', r));
  for (let i = i0; i < i1; i++) {
    const buf = await shot(pg, i / FPS);
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
    if ((i - i0) % 300 === 0) console.log(path.basename(out), i - i0, '/', i1 - i0);
  }
  enc.stdin.end(); await done; await pg.close();
}

(async () => {
  const srv = await serve(); const port = srv.address().port;
  const browser = await chromium.launch();
  const mode = process.argv[2];
  if (mode === 'stills') {
    fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
    const pg = await openPage(browser, port);
    pg.on('pageerror', e => console.error('PAGE ERROR', e.message));
    for (const a of process.argv.slice(3)) {
      const t = parseFloat(a);
      fs.writeFileSync(path.join(HERE, 'stills', `t${t.toFixed(1).padStart(6, '0')}.jpg`), await shot(pg, t));
    }
  } else {
    const n = Math.ceil(tl.duration * FPS), K = 4;
    fs.mkdirSync(path.join(HERE, 'build'), { recursive: true });
    const parts = [];
    const jobs = [];
    for (let k = 0; k < K; k++) {
      const out = path.join(HERE, 'build', `part${k}.mp4`); parts.push(out);
      jobs.push(renderChunk(browser, port, Math.round(n * k / K), Math.round(n * (k + 1) / K), out));
    }
    await Promise.all(jobs);
    const lst = path.join(HERE, 'build', 'list.txt');
    fs.writeFileSync(lst, parts.map(p => `file '${p}'\n`).join(''));
    const out = path.join(HERE, '情景短视频1.mp4');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-i', path.join(HERE, 'audio', 'soundtrack.wav'),
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
    console.log('wrote', out, n, 'frames');
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
