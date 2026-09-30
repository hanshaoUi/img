// 逐帧渲染 index.html 并合成 MP4。
//   node render.cjs                      → 输出 out/cream-duck-30s.mp4（需要先运行 music.py 生成 out/music.wav）
//   node render.cjs --stills 1,4.5,8     → 只导出指定时间点的截图到 out/stills/，用于检查画面
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const FPS = 30, DUR = 30;
const OUT = path.join(__dirname, 'out');
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); }
  catch { return 'ffmpeg'; }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render');
  await page.waitForFunction(() => window.__ready === true);
  const canvas = await page.$('#c');
  const frame = async (t, type = 'jpeg') => {
    await page.evaluate(t => window.render(t), t);
    return canvas.screenshot(type === 'png' ? { type } : { type, quality: 95 });
  };

  if (stillsArg) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of stillsArg.split(',').map(Number)) {
      fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await frame(t, 'png'));
    }
    await browser.close();
    return;
  }

  const music = path.join(OUT, 'music.wav');
  const mp4 = path.join(OUT, 'cream-duck-30s.mp4');
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (fs.existsSync(music)) ffArgs.push('-i', music, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  ffArgs.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
  const ff = spawn(ffmpegPath(), ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg exited ' + code))));

  const total = FPS * DUR;
  for (let i = 0; i < total; i++) {
    const buf = await frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}\n`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('wrote', mp4);
})().catch(e => { console.error(e); process.exit(1); });
