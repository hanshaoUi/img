// Frame-accurate offline render of index.html → MP4.
//   node render.cjs                      full film → out/forbidden-city.mp4 (muxes audio/score.wav if present)
//   node render.cjs --stills 3,12.5,30   PNG stills → out/stills/
//   node render.cjs --workers 3          parallel browser workers (each renders a contiguous chunk)
// Needs the global `playwright` package and ffmpeg (FFMPEG env var, or imageio-ffmpeg via python).
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const FPS = 30;
const ROOT = __dirname, OUT = path.join(ROOT, 'out');
const args = process.argv.slice(2);
const arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const stills = arg('--stills', null), workers = +arg('--workers', 3);

const ffmpeg = process.env.FFMPEG || (() => { try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } catch { return 'ffmpeg'; } })();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  const shoot = async (t, type = 'jpeg') => {
    await page.evaluate(t => new Promise(r => { window.renderAt(t); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
    return page.screenshot(type === 'png' ? { type } : { type, quality: 94 });
  };
  const DUR = await page.evaluate(() => window.DUR);
  return { browser, page, shoot, DUR };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), port = srv.address().port;
  if (stills) {
    const { browser, shoot } = await openPage(port);
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      const t0 = Date.now(); fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), await shoot(t)); console.log('still', t, Date.now() - t0, 'ms');
    }
    await browser.close(); srv.close(); return;
  }
  // parallel chunks → segment files → concat
  const probe = await openPage(port); const DUR = probe.DUR; await probe.browser.close();
  const total = Math.round(DUR * FPS), per = Math.ceil(total / workers);
  const segs = [];
  const started = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per); if (a >= b) return;
    const seg = path.join(OUT, `seg${w}.mp4`); segs[w] = seg;
    const { browser, shoot } = await openPage(port);
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    for (let i = a; i < b; i++) {
      const buf = await shoot(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - a) % 30 === 0) console.log(`w${w} frame ${i}/${b}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await done; await browser.close();
  }));
  const list = path.join(OUT, 'segs.txt'); fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const audio = path.join(ROOT, 'audio', 'score.wav'), mp4 = path.join(OUT, 'forbidden-city.mp4');
  const cat = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (fs.existsSync(audio)) cat.push('-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest');
  cat.push('-c:v', 'copy', '-movflags', '+faststart', mp4);
  execFileSync(ffmpeg, cat, { stdio: 'inherit' });
  segs.filter(Boolean).forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);
  console.log('wrote', mp4, ((Date.now() - started) / 1000).toFixed(0) + 's');
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
