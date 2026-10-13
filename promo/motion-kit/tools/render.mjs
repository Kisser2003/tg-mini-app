import { chromium } from '../../../node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.dirname(root);
const FPS = 30, DUR = 23, FRAMES = FPS * DUR, SUB = 4, SHUTTER = 0.5, CHUNK = 30, WORKERS = 6;
const tmp = path.join(root, 'tmp'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const chunks = Array.from({ length: FRAMES / CHUNK }, (_, i) => i);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--allow-file-access-from-files'] });
let next = 0, done = 0;
async function worker() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(root, 'index.html') + '?render=1');
  await page.evaluate(() => window.ready);
  while (next < chunks.length) {
    const c = chunks[next++]; const dir = path.join(tmp, `c${c}`); fs.mkdirSync(dir);
    let k = 0;
    for (let n = c * CHUNK; n < (c + 1) * CHUNK; n++) for (let j = 0; j < SUB; j++) {
      const t = Math.max(0, n / FPS + ((j + 0.5) / SUB - 0.5) * SHUTTER / FPS);
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(dir, `f${String(k++).padStart(5, '0')}.png`) });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS * SUB), '-i', path.join(dir, 'f%05d.png'),
      '-vf', `tmix=frames=${SUB}:weights='1 1 1 1',select='not(mod(n\\,${SUB}))',setpts=N/(${FPS}*TB)`,
      '-r', String(FPS), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', path.join(tmp, `c${c}.mp4`)]);
    fs.rmSync(dir, { recursive: true });
    console.log(`chunk ${c} (${++done}/${chunks.length})`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await browser.close();
fs.writeFileSync(path.join(tmp, 'list.txt'), chunks.map(c => `file 'c${c}.mp4'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-i', path.join(root, 'assets/music.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-r', String(FPS), '-c:a', 'aac', '-b:a', '256k', '-t', String(DUR), '-movflags', '+faststart', path.join(root, 'raw.mp4')]);
console.log('raw done');
