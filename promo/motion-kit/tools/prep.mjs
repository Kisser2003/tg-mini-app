// Turns captured DOM/CSS snapshots into shadow-DOM-ready screen files + a shared fonts.css.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
fs.mkdirSync(path.join(root, 'screens'), { recursive: true }); fs.mkdirSync(path.join(root, 'assets/fonts'), { recursive: true });
const names = fs.readdirSync(path.join(root, 'ref')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
const faces = new Map();
for (const n of names) {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'ref', n + '.json'), 'utf8'));
  let css = d.css;
  css = css.replace(/@font-face\s*\{[^}]*\}/g, m => { faces.set(m, 1); return ''; });
  // :root / html / body → shadow equivalents
  css = css.replace(/:root/g, ':host').replace(/(^|[\s,{}])html(?=[\s,{.:\[])/g, '$1.shroot').replace(/(^|[\s,{}])body(?=[\s,{.:\[])/g, '$1.shroot');
  // freeze the layout at a 390×844 phone: media queries + viewport units
  css = css.replace(/\(min-width:\s*([\d.]+)px\)/g, (m, v) => +v <= 390 ? '(min-width: 0px)' : '(min-width: 99999px)')
           .replace(/\(max-width:\s*([\d.]+)px\)/g, (m, v) => +v >= 390 ? '(min-width: 0px)' : '(min-width: 99999px)')
           .replace(/\(min-height:\s*([\d.]+)px\)/g, (m, v) => +v <= 844 ? '(min-width: 0px)' : '(min-width: 99999px)')
           .replace(/\(max-height:\s*([\d.]+)px\)/g, (m, v) => +v >= 844 ? '(min-width: 0px)' : '(min-width: 99999px)')
           .replace(/(-?[\d.]+)(d|s|l)?vh\b/g, (m, v) => (+v * 8.44).toFixed(2) + 'px')
           .replace(/(-?[\d.]+)(d|s|l)?vw\b/g, (m, v) => (+v * 3.9).toFixed(2) + 'px');
  // library header nick per screen (by request): «Все» — нейтральный ADMIN, фильтр — артист релиза
  const NICK = { library: 'ADMIN', 'library-sheet': 'ADMIN', 'library-filter': '4mess', 'library-filter-rej': 'KISSER', 'v2-library': 'ADMIN' };
  let html = d.html.replace(/border-omf-yellow/g, '');
  if (NICK[n]) html = html.replace(/(tracking-\[-0\.045em\][^>]*>)[^<]+(<\/h1>)/, `$1${NICK[n]}$2`);
  fs.writeFileSync(path.join(root, 'screens', n + '.json'), JSON.stringify({ css: css + '\n.shroot{background:var(--omf-bg)}', html, cls: d.htmlClass + ' ' + d.bodyClass }));
}
const urls = new Set(); let fcss = '';
for (const f of faces.keys()) { fcss += f.replace(/url\("?\/_next\/static\/media\/([^")]+)"?\)/g, (m, file) => { urls.add(file); return `url("assets/fonts/${file}")`; }) + '\n'; }
fs.writeFileSync(path.join(root, 'assets/fonts.css'), fcss);
for (const u of urls) { const r = await fetch(`http://localhost:${process.env.PORT || 3000}/_next/static/media/` + u); fs.writeFileSync(path.join(root, 'assets/fonts', u), Buffer.from(await r.arrayBuffer())); }
console.log('screens', names.length, 'faces', faces.size, 'font files', urls.size);
