// Captures real app states (dev server on $PORT, default 3000) as screenshots + DOM/CSS snapshots.
// usage: node tools/capture.mjs [library|wizard|success|all|next]
// next — video 2 «Всегда понятно, что дальше»: one release per next-step line + the release screen.
// No Chrome on the box? CHROME_PATH=/path/to/chromium node tools/capture.mjs …
import { chromium } from '../../../node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'ref'); fs.mkdirSync(out, { recursive: true });
const img = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'assets/covers', n)).toString('base64');
const cover = img('c-holod.jpg');
const h = n => new Date(Date.now() - n * 36e5).toISOString();
const rows = [
  { id: 'r1', title: 'Холод', track_name: 'Холод', artist_name: '4mess', artwork_url: img('c-holod.jpg'), status: 'processing', submitted_at: h(3), created_at: h(5), release_type: 'single' },
  { id: 'r2', title: 'REGOS', track_name: 'REGOS', artist_name: 'KISSER', artwork_url: img('c-reis.jpg'), status: 'failed', admin_notes: 'Обложка меньше 3000×3000 px. Загрузи обложку в полном размере.', rejection_reasons: ['cover_size'], created_at: h(30), release_type: 'single' },
  { id: 'r3', title: 'JAPAN', track_name: 'JAPAN', artist_name: 'KISSER', artwork_url: img('c-japan.jpg'), status: 'ready', smart_link: 'https://band.link/example', created_at: h(200), release_type: 'single' },
  { id: 'r4', title: 'JEEP', track_name: 'JEEP', artist_name: 'SAKRON', artwork_url: img('c-jeep.jpg'), status: 'draft', created_at: h(2), release_type: 'single' },
  { id: 'r5', title: 'Пульс', track_name: 'Пульс', artist_name: 'SAKRON', artwork_url: null, status: 'pending', created_at: h(1), release_type: 'single' },
];
const mode = process.argv[2] || 'all';
if (mode === 'next') {
  // order = list order (newest first) = the release lifecycle, so the camera reads the grid left→right, top→bottom
  const id = n => `7c1e2a90-1f3b-4d2e-9a10-00000000000${n}`;
  rows.length = 0;
  rows.push(
    { id: id(5), title: 'JEEP', track_name: 'JEEP', artist_name: 'SAKRON', artwork_url: img('c-jeep.jpg'), status: 'draft', created_at: h(1), release_type: 'single' },
    { id: id(2), title: 'Пульс', track_name: 'Пульс', artist_name: 'SAKRON', artwork_url: null, status: 'pending', created_at: h(2), release_type: 'single' },
    { id: id(6), title: 'Холод', track_name: 'Холод', artist_name: '4mess', artwork_url: img('c-holod.jpg'), status: 'processing', submitted_at: h(3.2), created_at: h(5), release_type: 'single' },
    { id: id(4), title: 'Ночной рейс', track_name: 'Ночной рейс', artist_name: 'SAKRON', artwork_url: null, status: 'processing', submitted_at: h(30), created_at: h(48), release_type: 'single' },
    { id: id(7), title: 'REGOS', track_name: 'REGOS', artist_name: 'KISSER', artwork_url: img('c-reis.jpg'), status: 'failed', admin_notes: 'Обложка меньше 3000×3000 px. Загрузи обложку в полном размере.', rejection_reasons: ['cover_size'], created_at: h(72), release_type: 'single' },
    { id: id(8), title: 'JAPAN', track_name: 'JAPAN', artist_name: 'KISSER', artwork_url: img('c-japan.jpg'), status: 'ready', smart_link: 'https://band.link/example', created_at: h(240), release_type: 'single' },
  );
}
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
const browser = await chromium.launch({ ...launchOpts, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.route('**/api/releases/my**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows }) }));
async function snap(name) {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }); await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, name + '.png') });
  const dom = await page.evaluate(() => {
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
    const body = document.body.cloneNode(true);
    body.querySelectorAll('script, nextjs-portal, next-route-announcer').forEach(e => e.remove());
    return { css, html: body.innerHTML, htmlClass: document.documentElement.className, bodyClass: document.body.className };
  });
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(dom));
  console.log('snap', name);
}
// release screen: `/api/releases/<id>?tracks=1` → the same fake row + its track and passport
await page.route(/\/api\/releases\/[0-9a-f-]{36}(\?|$)/, r => {
  const rid = new URL(r.request().url()).pathname.split('/').pop();
  const row = rows.find(x => x.id === rid);
  if (!row) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  const record = { user_id: 1, genre: 'Hip-hop', performance_language: 'ru', explicit: false, audio_url: null, error_message: null, ...row };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, record, tracks: [{ title: row.track_name, explicit: false, duration: 154, index: 0 }] }) });
});
const go = async (u, w = 6000) => { await page.goto(`http://localhost:${process.env.PORT || 3000}` + u, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(w); };

if (mode === 'all' || mode === 'library') {
  await go('/library?devUserId=1', 9000); await snap('library');
  await page.getByText('На проверке', { exact: true }).first().click(); await page.waitForTimeout(800); await snap('library-filter');
  await page.getByText('Отклонены', { exact: true }).first().click(); await page.waitForTimeout(800); await snap('library-filter-rej');
  await page.getByText('Все', { exact: true }).first().click(); await page.waitForTimeout(600);
  await page.getByText('REGOS').first().click(); await page.waitForTimeout(1200); await snap('library-sheet');
  await go('/requirements', 5000); await snap('help');
}
if (mode === 'all' || mode === 'wizard') {
  await go('/create/metadata?devUserId=1', 6000);
  await page.getByPlaceholder('Имя на обложке').fill('4mess');
  await page.getByPlaceholder('Основное название релиза').fill('Холод');
  await page.waitForTimeout(800);
  await page.evaluate(() => { const k = 'omf_create_release_draft_v2'; const v = JSON.parse(localStorage.getItem(k)); v.state.metadata.genre = 'Hip-hop'; localStorage.setItem(k, JSON.stringify(v)); });
  await go('/create/metadata', 6000); await snap('step1');
  await go('/create/assets', 6000); await snap('step2');
}
if (mode === 'all' || mode === 'success') {
  await page.addInitScript(c => {
    if (!location.pathname.startsWith('/create/success')) return;
    const k = 'omf_create_release_draft_v2';
    let v; try { v = JSON.parse(localStorage.getItem(k)); } catch {}
    v = v || { state: {}, version: 0 };
    v.state.successSummary = { artistName: '4mess', trackName: 'Холод', releaseName: 'Холод', coverUrl: c };
    localStorage.setItem(k, JSON.stringify(v));
  }, cover);
  await go('/create/success?devUserId=1', 6000); await snap('success');
}
if (mode === 'next') {
  await go('/library?devUserId=1', 9000); await snap('v2-library');
  // tile tap on a release that is under review → its screen (the app pushes /release/<id>).
  // Inside Telegram the screen knows the user (initDataUnsafe.user) and promises a bot message too.
  await page.evaluate(() => { window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 1, first_name: 'ADMIN' } } } }; });
  await page.getByText('Холод', { exact: true }).first().click(); await page.waitForTimeout(2500); await snap('v2-release-holod');
  await go('/release/' + rows[5].id + '?devUserId=1', 6000); await snap('v2-release-japan');
}
await browser.close();
