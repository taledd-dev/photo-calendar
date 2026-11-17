// Photoplan — the Claude design system's files.
//
// Called by build-reference.js --system <dir>. Writes, under <dir>/project/, the
// files of the "Photoplan" Design System artifact (the look Claude's design
// sessions start from), and under <dir>/uploads/ the logo and icon files that
// are uploaded to it as assets:
//
//   tokens.json                    colours from index.html's token block (day +
//                                  night) merged with system/tokens-extra.json
//   README.md                      the brand book (system/README.md)
//   components/<Name>/README.md    guidelines (system/components.json)
//   components/<Name>/preview.html the app's own markup for that piece
//   components/Cover/preview.html  the cover (system/cover.html)
//   components/bundle.css          the app's stylesheet without the token block
//   fonts/Figtree-Variable.woff2   the wordmark face
//   assets/<Group>/README.md       notes for the Logos and Icons groups
//   design-system.json             the index — ONLY for a first publish, and
//                                  only once <dir>/blobs.json maps each upload
//                                  to the id it was given
//
// It then renders every preview headless in both themes, sets each card's
// height from what it measured, and saves screenshots to <dir>/check/.
//
// Publishing is done from a Claude session with the Artifact tool (see
// design/README.md); this script only prepares the files.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const INK_DAY = '#2a251e', PAPER_DAY = '#fbf7ec';

module.exports = async function buildSystem({ outDir, ROOT, sections, TOKENS, appCss, fontsLink, eventIcons }) {
  const SRC = path.join(ROOT, 'design', 'system');
  const extra = JSON.parse(fs.readFileSync(path.join(SRC, 'tokens-extra.json'), 'utf8'));
  const comps = JSON.parse(fs.readFileSync(path.join(SRC, 'components.json'), 'utf8')).components;
  const P = path.join(outDir, 'project'), UP = path.join(outDir, 'uploads'), CHECK = path.join(outDir, 'check');
  for (const d of [P, UP, CHECK]) fs.rmSync(d, { recursive: true, force: true });
  const put = (rel, text) => { const f = path.join(P, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const notes = [];

  // ── colours ───────────────────────────────────────────────────────────────
  const norm = (v) => /^#/.test(v) ? v.toLowerCase() : v.replace(/\s+/g, '');
  const byName = {}; TOKENS.forEach(t => { byName[t.name] = t; });
  const rgb = (v) => { if (/^#/.test(v)) { const h = v.slice(1); const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)).concat(1); } const m = v.match(/rgba?\(([^)]+)\)/); const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const la = lum(rgb(a)), lb = lum(rgb(b)); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const val = (name, theme) => { const t = byName[name]; return theme === 'night' && t.night !== null ? t.night : t.day; };
  const sentence = (s) => { s = s.trim(); if (!s) return s; s = s[0].toUpperCase() + s.slice(1); return /[.!?]$/.test(s) ? s : s + '.'; };
  const weak = [];
  const colorTokens = TOKENS.map(t => {
    let usage = extra.colorUsage[t.name] || sentence(t.note);
    if (!usage) notes.push('no usage note for colour token ' + t.name);
    const grounds = (extra.textGrounds[t.name] || []).filter(g => byName[g]);
    if (grounds.length) {
      const parts = grounds.map(g => { const d = ratio(val(t.name, 'day'), val(g, 'day')), n = ratio(val(t.name, 'night'), val(g, 'night')); if (Math.min(d, n) < 4.5) weak.push({ text: t.name, ground: g, day: d, night: n }); return '`' + g + '` (' + d.toFixed(1) + ':1 day, ' + n.toFixed(1) + ':1 night)'; });
      const low = grounds.some(g => Math.min(ratio(val(t.name, 'day'), val(g, 'day')), ratio(val(t.name, 'night'), val(g, 'night'))) < 4.5);
      usage += ' As text it is read on ' + parts.join(', ') + '.' + (low ? ' Below 4.5:1 where shown — kept exactly as the site has it; use it for short labels and hints, never for sentences.' : '');
    }
    return { name: t.name, value: t.night === null ? norm(t.day) : { day: norm(t.day), night: norm(t.night) }, usage: usage.slice(0, 1000) };
  });
  const perTheme = (v) => { const one = (theme) => v.replace(/\{([a-z0-9-]+)\}/g, (m, n) => { if (!byName[n]) throw new Error('shadow refers to unknown colour ' + n); return norm(val(n, theme)); }); const d = one('day'), n = one('night'); return d === n ? d : { day: d, night: n }; };
  const strip = (o) => { const c = { ...o }; delete c._about; return c; };
  let sha = ''; try { sha = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (_) {}
  const today = new Date().toISOString().slice(0, 10);
  const tokens = {
    name: 'Photoplan', version: 1,
    color: { themes: [{ id: 'day', name: 'Day' }, { id: 'night', name: 'Night' }], tokens: colorTokens },
    type: extra.type,
    spacing: strip(extra.spacing), radius: strip(extra.radius),
    shadow: { note: extra.shadow.note, tokens: extra.shadow.tokens.map(t => ({ ...t, value: perTheme(t.value) })) },
    size: strip(extra.size),
    meta: { source: 'github', repo: 'taledd-dev/photo-calendar', ref: 'main' + (sha ? '@' + sha : ''), paths: { tokens: ['index.html', 'design/system/tokens-extra.json'], fonts: ['assets/fonts/Figtree-Variable.woff2'], assets: ['assets/*.svg', 'index.html (EVENT_ICONS)'], docs: ['design/system/README.md', 'design/system/components.json'] }, components: Object.fromEntries(comps.map(c => [c.name, 'index.html'])), synced: today },
  };
  // names share one namespace across every family but type
  const seen = {}; [['color', colorTokens], ['spacing', tokens.spacing.tokens], ['radius', tokens.radius.tokens], ['shadow', tokens.shadow.tokens], ['size', tokens.size.tokens]].forEach(([fam, list]) => list.forEach(t => { if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(t.name)) throw new Error('bad token name ' + t.name); if (seen[t.name]) throw new Error('token name used twice: ' + t.name + ' (' + seen[t.name] + ', ' + fam + ')'); seen[t.name] = fam; if (!t.usage) notes.push('no usage: ' + t.name); }));
  put('tokens.json', JSON.stringify(tokens, null, 2) + '\n');

  // ── brand book, stylesheet, font ──────────────────────────────────────────
  put('README.md', fs.readFileSync(path.join(SRC, 'README.md'), 'utf8'));
  const bundleCss = '/* Photoplan — the site\'s own stylesheet (hover, focus and helper rules), without its colour tokens:\n   those live in tokens.json. Layout, spacing and type are inline styles on the markup. */\n'
    + appCss.replace(/\/\* tokens:start \*\/[\s\S]*?\/\* tokens:end \*\//, '').replace(/^\s*@font-face[^\n]*\n/gm, '').replace(/^\s*\/\* Brand fonts[\s\S]*?\*\/\n/m, '').replace(/^ {4}/gm, '').trim()
    + '\n/* Stage for the previews in this design system: the page ground with its dot pattern. */\n.ds-stage { box-sizing: border-box; padding: 22px; background: var(--page); background-image: radial-gradient(var(--page-dot) 0.8px, transparent 0.8px); background-size: 22px 22px; color: var(--ink); font-family: \'Spectral\', Georgia, serif; }\n.ds-stage [style*="position: fixed"] { position: static !important; }\n';
  if (/<\/style/i.test(bundleCss)) throw new Error('bundle.css would close a style element');
  put('components/bundle.css', bundleCss);
  fs.mkdirSync(path.join(P, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', 'Figtree-Variable.woff2'), path.join(P, 'fonts', 'Figtree-Variable.woff2'));

  // ── assets: logos copied as they are, the window icons written out one a file ─
  const logos = [
    ['photoplan-mark.svg', 'The mark: a viewfinder frame around a peak and a low sun. Ink #8c491a (a deep terracotta). Use on paper and page grounds; 54px high beside the wordmark, 22px in the small lockup.'],
    ['photoplan-mark-on-dark.svg', 'The same mark in #f6a06b, for dark grounds: night mode and the band across the printed cover.'],
    ['photoplan-lockup-light.svg', 'Mark and wordmark together for light grounds — the header of each printed calendar page.'],
    ['photoplan-lockup-dark.svg', 'Mark and wordmark together for dark grounds — the band at the foot of the printed cover.'],
    ['photoplan-app-icon.svg', 'The app icon: the mark on a dark olive tile. For home-screen icons only.'],
    ['photoplan-favicon.svg', 'The browser-tab icon.'],
    ['social-card.png', 'The link-preview card (1200 × 630).'],
  ].filter(([f]) => fs.existsSync(path.join(ROOT, 'assets', f)));
  const uploads = [];
  const stage = (group, file, bytes) => { const f = path.join(UP, group, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bytes); uploads.push({ group, name: file, path: f, size: fs.statSync(f).size, type: /\.svg$/.test(file) ? 'image/svg+xml' : /\.png$/.test(file) ? 'image/png' : 'application/octet-stream' }); };
  logos.forEach(([f]) => stage('Logos', f, fs.readFileSync(path.join(ROOT, 'assets', f))));
  put('assets/Logos/README.md', '# Logos\n\nThe mark and its lockups, copied from the site. Never redraw or recolour them; choose the file made for the ground. The wordmark beside the mark is the word PHOTOPLAN in the `wordmark` type style.\n\n' + logos.map(([f, n]) => '- `' + f + '` — ' + n).join('\n') + '\n');
  eventIcons.forEach(ic => stage('Icons', ic.key + '.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + INK_DAY + '">' + ic.svg.replace(/currentColor/g, INK_DAY).replace(/var\(--paper\)/g, PAPER_DAY) + '</svg>\n'));
  put('assets/Icons/README.md', '# Icons\n\nThe window icons: one small picture for each kind of nature or season window, shown in the corner of every day the window covers. Each is a 24 × 24 drawing in a single ink. These files are drawn in `ink` (' + INK_DAY + ') so they can be seen here; on the site they take the event\'s accent colour (`green-2` for nature, `season-accent` for season windows) at 12–14px, with no label — the legend under the grid names them.\n\n' + eventIcons.map(ic => '- `' + ic.key + '.svg` — ' + ic.label + '.').join('\n') + '\n');

  // ── components: the app's own markup, one preview each ────────────────────
  const fontsHead = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' + fontsLink;
  const previews = [];
  comps.forEach(c => {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(c.name)) throw new Error('component name must be an identifier: ' + c.name);
    const s = sections.find(x => x.title === c.from);
    if (!s || /not captured/.test(s.html)) { notes.push('NOT BUILT (capture missing): ' + c.name + ' ← ' + c.from); return; }
    if (/<(iframe|frame|object|embed|portal|noscript)\b/i.test(s.html)) throw new Error(c.name + ': preview holds a tag previews may not use');
    previews.push({ ...c, body: '<div class="ds-stage">\n' + s.html + '\n</div>' });
    put('components/' + c.name + '/README.md', '# ' + c.name + '\n\n' + c.guide + '\n');
  });
  const doc = (c, height) => '<!-- @dsCard group="' + c.group + '" height=' + height + ' width=' + c.width + ' subtitle="' + c.subtitle.replace(/"/g, '&quot;') + '" -->\n<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + c.name + ' — preview</title>\n' + fontsHead + '\n<style>html, body { margin: 0; }</style>\n</head>\n<body>\n' + c.body + '\n</body>\n</html>\n';
  const cover = fs.readFileSync(path.join(SRC, 'cover.html'), 'utf8');

  // ── render check: tokens.css as the page compiles it, each preview in both themes ─
  const decl = (t, theme) => '--' + t.name + ': ' + (typeof t.value === 'string' ? t.value : (t.value[theme] || t.value.day)) + ';';
  const themed = colorTokens.concat(tokens.shadow.tokens);
  const simCss = ':root, [data-theme="day"] { ' + themed.map(t => decl(t, 'day')).join(' ') + ' }\n[data-theme="night"] { ' + themed.filter(t => typeof t.value !== 'string').map(t => decl(t, 'night')).join(' ') + ' }\n:root { '
    + [tokens.spacing, tokens.radius, tokens.size].flatMap(f => f.tokens).map(t => '--' + t.name + ': ' + t.value + ';').join(' ') + ' ' + Object.entries(tokens.type.families).map(([k, v]) => '--font-' + k + ': ' + v + ';').join(' ') + ' }\n'
    + tokens.type.groups.flatMap(g => g.styles.map(st => '.' + st.name + ' { font-family: var(--font-' + (st.family || g.family) + '); font-size: ' + st.fontSize + ';' + (st.lineHeight ? ' line-height: ' + st.lineHeight + ';' : '') + ' font-weight: ' + st.fontWeight + ';' + (st.letterSpacing ? ' letter-spacing: ' + st.letterSpacing + ';' : '') + ' }')).join('\n')
    + '\n@font-face { font-family: \'Figtree\'; src: url(\'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'Figtree-Variable.woff2')).toString('base64') + '\') format(\'woff2\'); font-weight: 300 900; }\n';
  fs.mkdirSync(CHECK, { recursive: true });
  const browser = await chromium.launch();
  const frame = (html, theme) => html.replace('<html lang="en">', '<html lang="en" data-theme="' + theme + '">').replace('</head>', '<style>' + simCss + '</style>\n<style>' + bundleCss + '</style>\n</head>');
  const results = [];
  for (const c of previews.concat([{ name: 'Cover', width: 960, cover: true }])) {
    const ctx = await browser.newContext({ viewport: { width: c.width, height: 600 }, deviceScaleFactor: 1 });
    await ctx.route(/^https?:\/\//, r => r.abort());   // previews must stand on their own (fonts fall back here)
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const html = c.cover ? cover : doc(c, 120);
    let height = 0; const seenTheme = {};
    for (const theme of ['day', 'night']) {
      await page.setContent(frame(html, theme), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(120);
      const m = await page.evaluate(() => { const st = document.querySelector('.ds-stage, .cover'); const r = st.getBoundingClientRect(); const scrolls = (e) => { for (let n = e.parentElement; n && n !== st.parentElement; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; }; const over = Array.from(st.querySelectorAll('*')).filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !scrolls(e)).length; return { h: Math.ceil(r.height), text: st.textContent.replace(/\s+/g, ' ').trim().length, nodes: st.querySelectorAll('*').length, over, bg: getComputedStyle(st).backgroundColor }; });
      height = Math.max(height, m.h); seenTheme[theme] = m;
      await page.screenshot({ path: path.join(CHECK, c.name + '-' + theme + '.png'), fullPage: true });
    }
    // every var(--x) the preview uses must be a token the system defines
    const used = Array.from(new Set((html.match(/var\(--[a-z0-9-]+/g) || []).map(v => v.slice(6)))); const missing = used.filter(n => !seen[n] && !tokens.type.families[n.replace(/^font-/, '')]);
    if (missing.length) notes.push(c.name + ': uses undefined tokens ' + missing.join(', '));
    if (errs.length) notes.push(c.name + ': page error ' + errs[0]);
    if (seenTheme.day.nodes < 3 || seenTheme.day.text < 2) notes.push(c.name + ': preview looks blank');
    if (seenTheme.day.bg === seenTheme.night.bg) notes.push(c.name + ': ground did not change between day and night');
    if (seenTheme.day.over) notes.push(c.name + ': ' + seenTheme.day.over + ' elements run past the ' + c.width + 'px layout width');
    await ctx.close();
    if (c.cover) { put('components/Cover/preview.html', cover); results.push('Cover 288'); continue; }
    const out = doc(c, Math.min(4000, Math.max(40, height)));
    if (Buffer.byteLength(out) > 256 * 1024) notes.push(c.name + ': preview is ' + Math.round(Buffer.byteLength(out) / 1024) + ' KB (cap 256 KB)');
    put('components/' + c.name + '/preview.html', out); results.push(c.name + ' ' + height);
  }
  await browser.close();
  fs.writeFileSync(path.join(CHECK, 'tokens.sim.css'), simCss.replace(/data:font\/woff2;base64,[^']+/, '…'));

  // ── the index, for a first publish, once the uploads have ids ──────────────
  fs.writeFileSync(path.join(outDir, 'uploads.json'), JSON.stringify(uploads.map(u => ({ group: u.group, name: u.name, path: u.path, size: u.size, type: u.type })), null, 2) + '\n');
  const blobsFile = path.join(outDir, 'blobs.json');
  if (fs.existsSync(blobsFile)) {
    const blobs = JSON.parse(fs.readFileSync(blobsFile, 'utf8')); const groups = {};
    uploads.forEach(u => { const id = blobs[u.group + '/' + u.name]; if (!id) { notes.push('no upload id for ' + u.group + '/' + u.name); return; } const g = groups[u.group] = groups[u.group] || { name: u.group, tile: u.group === 'Icons' ? 's' : 'l', order: [], files: {} }; g.order.push(u.name); g.files[u.name] = { name: u.name, blob: id, size: u.size, type: u.type }; });
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    put('design-system.json', JSON.stringify({ v: 3, layout: 'files', createdOnFiles: { v: 1, at: now }, title: 'Photoplan', namespace: 'Photoplan', libraries: [], sections: {}, groups: Object.keys(groups), assetGroups: groups, blobs: {}, docs: { sections: [] }, lastChange: { by: 'Claude', at: now, via: 'Claude Code · taledd-dev/photo-calendar' + (sha ? '@' + sha : ''), note: 'Built from the site: ' + colorTokens.length + ' colours in two themes, ' + tokens.type.groups.reduce((n, g) => n + g.styles.length, 0) + ' type styles, ' + previews.length + ' components.' } }, null, 2) + '\n');
  }

  const files = []; (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : files.push(path.relative(outDir, f)); }); })(P);
  fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(files.sort(), null, 2) + '\n');
  console.log('design system → ' + outDir + ': ' + files.length + ' files under project/, ' + uploads.length + ' uploads (' + uploads.filter(u => u.group === 'Logos').length + ' logos, ' + uploads.filter(u => u.group === 'Icons').length + ' icons)' + (fs.existsSync(blobsFile) ? '' : ' — no index yet (needs blobs.json)'));
  console.log('previews (height px): ' + results.join(' · '));
  if (weak.length) console.log('text colours under 4.5:1 (flagged in their notes): ' + weak.map(w => w.text + ' on ' + w.ground + ' ' + w.day.toFixed(1) + '/' + w.night.toFixed(1)).join(' · '));
  console.log(notes.length ? 'NOTES:\n - ' + notes.join('\n - ') : 'no problems found');
};
