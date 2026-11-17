#!/usr/bin/env node
// Photoplan design reference — generator.
//
// Rebuilds the files in this folder from the live app (../index.html), so a
// design session starts from exactly what the site looks like today:
//
//   tokens.css            every colour token, day and night
//   style-reference.html  one static page: tokens as swatches, the type
//                         system, and the app's own components (real markup,
//                         real inline styles), with a day/night switch
//   pages/*.html          static snapshots of whole pages
//
// It runs the app in headless Chromium against a throwaway local server, with
// the storage Worker and forecast services faked (sample data only — nothing
// from the real calendar), then serialises the rendered DOM.
//
//   node design/build-reference.js
//   node design/build-reference.js --system <dir>   (also builds the Claude
//                                                    design system's files)
//
// Needs Node 18+ and Playwright (`require('playwright')`; pre-installed in the
// Claude Code cloud environment). No other dependencies.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = __dirname;
const SITE = 'https://photoplan.studio/';
const WORKER = 'https://photo-calendar-storage.taledd95.workers.dev';
const PORT = 8137;
const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const NOW = new Date();
const plus = (n) => iso(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + n));

// ── the app's stylesheet and token block ────────────────────────────────────
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appCss = (indexHtml.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const tokenBlock = (appCss.match(/\/\* tokens:start \*\/([\s\S]*?)\/\* tokens:end \*\//) || [])[1] || '';
if (!tokenBlock) { console.error('No token block found in index.html'); process.exit(1); }
const fontsLink = (indexHtml.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/) || [''])[0];

// name → { day, night, note, group } parsed from the two rules of the block
function parseTokens() {
  const rule = (re) => (tokenBlock.match(re) || [])[1] || '';
  const dayRule = rule(/:root, \.print-sheet \{([\s\S]*?)\n    \}/), nightRule = rule(/:root\[data-theme="night"\] \{([\s\S]*?)\n    \}/);
  const out = []; const byName = {}; let group = '';
  dayRule.split('\n').forEach(line => {
    const g = line.match(/^\s*\/\* (.+) \*\/\s*$/); if (g) { group = g[1]; return; }
    const m = line.match(/^\s*--([a-z0-9-]+):\s*([^;]+);(?:\s*\/\*\s*(.*?)\s*\*\/)?/); if (!m) return;
    const t = { name: m[1], day: m[2].trim(), night: null, note: m[3] || '', group }; out.push(t); byName[t.name] = t;
  });
  nightRule.split('\n').forEach(line => { const m = line.match(/^\s*--([a-z0-9-]+):\s*([^;]+);/); if (m && byName[m[1]]) byName[m[1]].night = m[2].trim(); });
  return out;
}
const TOKENS = parseTokens();

// ── tiny static server for the repo ─────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});

// A stand-in photograph (dusk sky, a ridge, a low sun) as an SVG data URI.
const PHOTO_SVG = (a, b, c) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="300" height="130" fill="url(#s)"/><circle cx="212" cy="62" r="11" fill="#FAE8BE"/><rect y="118" width="300" height="82" fill="' + c + '"/><path d="M0 122 L70 96 L130 120 L196 92 L262 118 L300 106 L300 150 L0 150Z" fill="' + c + '"/></svg>');
const PHOTOS = [PHOTO_SVG('#48628C', '#ECBE96', '#404E3A'), PHOTO_SVG('#283454', '#D28C6E', '#34303C'), PHOTO_SVG('#96AABE', '#E6E2D2', '#606E50')];
// Small repo assets are embedded so each generated file stands on its own.
const svgAsset = (file) => { const f = path.join(ROOT, 'assets', file); return fs.existsSync(f) ? 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(f, 'utf8')).replace(/'/g, '%27') : SITE + 'assets/' + file; };
const fontAsset = (file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'fonts', file)).toString('base64');
const photoFor = (key) => { let h = 0; for (const ch of key.replace(/-(thumb|print)$/, '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PHOTOS[h % PHOTOS.length]; };
const svgBody = (dataUri) => decodeURIComponent(dataUri.slice('data:image/svg+xml,'.length));

function forecast(url) {
  const u = new URL(url); const past = parseInt(u.searchParams.get('past_days') || '0', 10);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const dates = []; for (let k = -past; k < 7; k++) dates.push(new Date(today.getTime() + k * 86400000).toISOString().slice(0, 10));
  const H = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [], cloud_cover: [], cloud_cover_low: [], visibility: [], wind_speed_10m: [], wind_gusts_10m: [], cloud_cover_mid: [], cloud_cover_high: [], relative_humidity_2m: [], dew_point_2m: [] };
  dates.forEach((d, i) => { const n = i - past; for (let h = 0; h < 24; h++) {
    H.time.push(d + 'T' + pad2(h) + ':00');
    const fog = n === 1 && h >= 5 && h <= 8, colour = n === 2 && h >= 15 && h <= 17, dull = n === 3 || n === 4, clear = (n === 5 && h >= 20) || (n === 6 && h <= 5);
    H.temperature_2m.push(fog ? 2 : 8); H.precipitation_probability.push(dull ? 85 : 5); H.weather_code.push(fog ? 45 : dull ? 63 : 2);
    H.cloud_cover.push(dull ? 100 : colour ? 55 : clear ? 5 : 88); H.cloud_cover_low.push(dull ? 95 : colour ? 10 : 60);
    H.visibility.push(fog ? 250 : 20000); H.wind_speed_10m.push(dull ? 24 : fog ? 2 : 9); H.wind_gusts_10m.push(dull ? 40 : 12);
    H.cloud_cover_mid.push(colour ? 40 : 5); H.cloud_cover_high.push(colour ? 50 : 5); H.relative_humidity_2m.push(fog ? 98 : 70); H.dew_point_2m.push(fog ? 1.6 : 3);
  } });
  const dull = (i) => (i - past === 3 || i - past === 4);
  return { latitude: 53.35, longitude: -1.81, utc_offset_seconds: 0, timezone_abbreviation: 'GMT', hourly: H, daily: { time: dates, weather_code: dates.map((_, i) => dull(i) ? 63 : 2), temperature_2m_max: dates.map(() => 9), temperature_2m_min: dates.map(() => 3), sunrise: dates.map(d => d + 'T07:22'), sunset: dates.map(d => d + 'T16:12'), precipitation_sum: dates.map((_, i) => dull(i) ? 9 : 0), precipitation_probability_max: dates.map((_, i) => dull(i) ? 90 : 10), wind_speed_10m_max: dates.map((_, i) => dull(i) ? 26 : 10), wind_gusts_10m_max: dates.map(() => 20), snowfall_sum: dates.map(() => 0) } };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + PORT + '/';
  const browser = await chromium.launch();
  const state = { doc: null, keys: [] };

  const newPage = async ({ owner = true, width = 1280, cloud = true } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
      const req = route.request(), url = req.url();
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-photoplan-worker', 'x-photoplan-worker': '2' }, body: JSON.stringify(body) });
      if (url.startsWith('https://api.open-meteo.com/v1/forecast')) return json(forecast(url));
      if (url.includes('noaa-planetary-k-index-forecast.json')) return json([['time_tag', 'kp', 'observed', 'noaa_scale']]);
      if (url.includes('noaa-planetary-k-index.json')) return json([['time_tag', 'Kp'], ['2026-01-01 12:00:00.000', '2.33']]);
      if (!url.startsWith(WORKER) || !cloud) return route.abort();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS' } });
      const p = decodeURIComponent(new URL(url).pathname);
      if (p === '/list') return json({ keys: state.keys });
      if (p === '/backups') return json({ backups: [1, 2, 3].map(i => ({ key: 'backups/calendar-data-2026-11-0' + (7 - i) + 'T14-30.json', uploaded: '2026-11-0' + (7 - i) + 'T14:32:10.000Z', size: 48213 - i * 300 })) });
      if (p === '/photo/calendar-data.json') { if (req.method() === 'GET') return state.doc ? json(state.doc) : json({ error: 'Not found' }, 404); return json({ ok: true }); }
      if (p.startsWith('/photo/photos/') && state.keys.includes(p.slice('/photo/'.length))) return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svgBody(photoFor(p.slice('/photo/'.length))) });
      return json({ error: 'Not found' }, 404);
    });
    await ctx.addInitScript(({ owner }) => {
      let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      try { if (owner) localStorage.setItem('calendar:uploadKey', 'pw'); else localStorage.removeItem('calendar:uploadKey'); localStorage.removeItem('calendar:theme'); localStorage.setItem('calendar:year', String(new Date().getFullYear())); } catch (_) {}
    }, { owner });
    const page = await ctx.newPage();
    page.go = async (hash, wait) => { await page.goto('about:blank'); await page.goto(BASE + hash); await page.waitForSelector(wait || 'h1'); await page.waitForTimeout(900); };
    return page;
  };

  // ── sample data: the app's own seed plus a little of everything ───────────
  const boot = await newPage({ cloud: false });
  await boot.go('#/' + NOW.getFullYear());
  const seed = await boot.evaluate(() => JSON.parse(JSON.stringify(migrateYearEvents(makeData()))));
  const eventIcons = await boot.evaluate(() => Object.keys(EVENT_ICONS).map(k => ({ key: k, label: EVENT_ICONS[k].label, svg: EVENT_ICONS[k].svg })));
  await boot.context().close();
  const Y = NOW.getFullYear(), mi = NOW.getMonth(), mk = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][mi];
  const month = seed[mi], A = month.locations[0], B = month.locations[1] || month.locations[0];
  Object.assign(A, { photos: [{ slot: 1, year: String(Y).slice(2), tags: ['portfolio', 'dawn'] }, { slot: 2, year: String(Y - 1).slice(2) }], photoYear: String(Y).slice(2), area: 'Sample county', country: 'United Kingdom', done: true,
    shots: [{ id: 's1', text: 'The wide view at first light', done: true }, { id: 's2', text: 'A long-lens detail from the top', done: false }],
    visits: [{ id: 'v1', date: plus(-9), note: 'Clear and cold; best light twenty minutes after sunrise' }], links: 'Parking info | https://example.org/parking', notes: 'Sample note: the gate is on the left after the cattle grid.' });
  B.photoYear = String(Y).slice(2);
  month.printLoc = A.id;
  month.eventsByYear[Y] = (month.eventsByYear[Y] || []).concat([{ id: 'x1', type: 'day', day: 20, kind: 'photoop', label: A.name, locId: A.id }, { id: 'x2', type: 'range', start: 24, end: 26, kind: 'x-workshop', kindLabel: 'Workshop', kindColor: 'teal', label: 'Printing workshop' }]);
  seed[0].trips = [{ id: 'sample', name: 'A sample weekend', start: plus(1), end: plus(2), locIds: [A.id, B.id], notes: 'Sample trip notes.', packing: ['Camera body (+ spare)', 'Lenses — wide, standard, telephoto', 'Batteries ×4, charged · charger', 'Tripod + plate · L-bracket', 'Head-torch + spare batteries'].map((t, i) => ({ id: 'p' + i, text: t, done: i < 2 })) }];
  seed[0].weatherDefault = A.id;
  state.doc = { version: 1, savedAt: 1700000000000, data: seed };
  state.keys = [[A.id, ''], [A.id, '.2'], [B.id, '']].flatMap(([id, sfx]) => { const b = 'photos/' + mk + '-ref-' + id + sfx; return [b, b + '-thumb']; });
  const briefHash = '#/' + Y + '/' + mk + '/' + A.id;

  // ── serialising a piece of the rendered app ───────────────────────────────
  // In the page: outerHTML of an element with form values written into the
  // markup. Then: photos become inline stand-ins and asset paths absolute.
  const grab = (page, pick, arg) => page.evaluate(({ pick, arg }) => {
    const el = (new Function('arg', 'return (' + pick + ')(arg)'))(arg);
    if (!el) return null;
    el.querySelectorAll('input').forEach(i => { if (i.type === 'checkbox') { if (i.checked) i.setAttribute('checked', ''); } else i.setAttribute('value', i.value); });
    el.querySelectorAll('select').forEach(s => { Array.from(s.options).forEach(o => { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); }); });
    return el.outerHTML;
  }, { pick: pick.toString(), arg });
  const clean = (html) => (html || '<!-- not captured -->')
    .replace(/src="https:\/\/photo-calendar-storage[^"]*\/photo\/([^"?]*)[^"]*"/g, (m, key) => 'src="' + photoFor(decodeURIComponent(key)).replace(/"/g, '&quot;') + '"')
    .replace(/src="\/?assets\/([a-z0-9-]+\.svg)"/g, (m, f) => 'src="' + svgAsset(f) + '"')
    .replace(/(src|href)="\/?assets\//g, '$1="' + SITE + 'assets/')
    .replace(/ contenteditable="[^"]*"/g, '');
  const card = 'el => { let n = el; while (n && !(n.style && n.style.boxShadow)) n = n.parentElement; return n; }';
  const sections = []; const pages = [];
  const add = (group, title, note, html, opts) => sections.push({ group, title, note, html: clean(html), ...(opts || {}) });
  const snapshotPage = async (page, name, title) => pages.push({ name, title, html: clean(await grab(page, () => document.querySelector('.app-shell'))) });

  // Home
  let page = await newPage();
  await page.go('#/' + Y);
  await snapshotPage(page, 'home', 'Home');
  add('Navigation', 'Masthead, tools and the home nav column', 'Home page header. Buttons are 40px tall mono caps with a hard 3px offset shadow; the green button is the primary action.', await grab(page, () => document.querySelector('.app-shell > div > div > div')));
  add('Home', 'Coming up', 'The next events from today; each card opens its month, location or trip.', await grab(page, () => { const l = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim() === 'Coming up'); return l ? l.parentElement.parentElement : null; }));
  add('Home', 'A month in the year list', 'One month block of “The year, month by month”.', await grab(page, () => { const h = Array.from(document.querySelectorAll('h2, h3, div')).find(d => d.textContent.trim() === 'January' && d.children.length === 0); let n = h; for (let i = 0; i < 4 && n; i++) { if (n.parentElement && n.parentElement.children.length > 3 && n.parentElement.textContent.includes('February')) break; n = n.parentElement; } return n; }));
  await page.click('button:has-text("Backups")'); await page.waitForSelector('.backup-row');
  add('Dialogs', 'Backups list', 'A modal list with paired quiet/danger actions.', await grab(page, () => document.querySelector('[aria-labelledby="pp-backups-title"]')), { width: 560 });
  await page.context().close();

  // Month + brief
  page = await newPage();
  await page.go(briefHash, 'button[aria-label="Close the location brief"]');
  await snapshotPage(page, 'month', 'Month page with a location brief open');
  add('Navigation', 'Month page header', 'Month name with the year picker, the nav row, and the row with search and the two quiet switches.', await grab(page, () => { const root = document.querySelector('.app-shell > div > div'); const w = document.createElement('div'); Array.from(root.children).slice(0, 3).forEach(c => w.appendChild(c.cloneNode(true))); return w; }));
  add('Month page', 'Location tiles', 'Tiles carry a region bar, thumbnail, tag, name and region dot; the owner sees tick, star and drag controls. The selected tile has the ink outline.', await grab(page, () => document.querySelector('.tile').parentElement));
  add('Month page', 'Location brief', 'The shoot brief: label column in mono caps, values in Spectral, chips for kit/links, checklists, the day stepper with Light and Sky rows.', await grab(page, (c) => (new Function('el', 'return (' + c + ')(el)'))(document.querySelector('button[aria-label="Close the location brief"]')), card));
  add('Month page', 'Calendar grid', 'Seven columns; events are 19px bars with a 3px accent edge, windows are corner icons named in the legend under the grid.', await grab(page, () => { const l = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim() === 'Typical light'); let n = l; while (n && !(n.style && n.style.marginTop === '40px')) n = n.parentElement; return n; }));
  // Small controls, gathered from the page as real nodes (cloned into a row).
  add('Controls', 'Buttons', 'Primary (green), paper, card actions, danger, dashed “add”, quiet links and the square close button — all square-cornered, mono capitals.', await grab(page, () => {
    const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:16px 14px';
    const btn = (t) => Array.from(document.querySelectorAll('.app-shell button')).find(b => b.textContent.replace(/\s+/g, ' ').trim().includes(t));
    ['Home', 'Map', 'Add location', 'Completed', 'Schedule photo op', 'Delete location', 'Log visit', 'Add event', 'show tides here', 'Night mode', 'Editing on'].forEach(t => { const b = btn(t); if (b) { const c = b.cloneNode(true); c.style.margin = '0'; w.appendChild(c); } });
    const x = document.querySelector('button[aria-label="Close the location brief"]'); if (x) w.appendChild(x.cloneNode(true));
    return w;
  }));
  add('Controls', 'Chips and pills', 'One fact or one link each: kit, area, links, the region badge, a trip pill.', await grab(page, () => {
    const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:12px 12px';
    const put = (el) => { if (el) { const c = el.cloneNode(true); c.style.margin = '0'; w.appendChild(c); } };
    put(document.querySelector('.region-uk, .region-int'));
    put(document.querySelector('.kit-view'));
    put(document.querySelector('.area-input')); put(document.querySelector('.country-input'));
    put(Array.from(document.querySelectorAll('.app-shell a')).find(a => /Parking info/.test(a.textContent)));
    put(document.querySelector('button[title="Open this trip"]'));
    return w;
  }));
  add('Controls', 'Fields', 'Search, selects, the quiet year picker, coordinates, date and text inputs.', await grab(page, () => {
    const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:16px 16px';
    const put = (el) => { if (el) { const c = el.cloneNode(true); c.style.margin = '0'; w.appendChild(c); } };
    const search = document.querySelector('input[type=search]'); put(search && search.parentElement);
    const month = Array.from(document.querySelectorAll('.app-shell select')).find(s2 => Array.from(s2.options).some(o => o.textContent.trim() === 'January')); put(month && month.parentElement);
    put(document.querySelector('.year-pick'));
    put(document.querySelector('.coord-input'));
    const visit = document.querySelector('input[aria-label="Visit date"]'); put(visit && visit.parentElement);
    return w;
  }));
  add('Controls', 'Checklist', 'Tick boxes with a line each, and the dashed add row.', await grab(page, () => { const r = document.querySelector('.check-row'); return r ? r.parentElement.cloneNode(true) : null; }), { width: 620 });
  await page.click('.ev-chip[title="Printing workshop"]'); await page.waitForSelector('text=Save event');
  add('Dialogs', 'Event editor', 'Type chips use each event type’s own wash, ink and accent.', await grab(page, () => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Save event'); let n = b; while (n && !(n.style && n.style.width === '392px')) n = n.parentElement; return n; }), { width: 392 });
  await page.click('button[aria-label="Close the event editor"]');
  await page.click('button:has-text("Add location")'); await page.waitForSelector('[role=dialog] input'); await page.fill('[role=dialog] input', 'Buttermere');
  add('Dialogs', 'Text prompt', 'The in-app dialog used for names and the edit password.', await grab(page, () => document.querySelector('[aria-labelledby="pp-dialog-title"]')), { width: 380 });
  await page.keyboard.press('Escape');
  await page.click('button:has-text("Delete location")'); await page.waitForSelector('[role=dialog]');
  add('Dialogs', 'Confirmation (danger)', 'Irreversible actions colour the top bar and the confirm button red.', await grab(page, () => document.querySelector('[aria-labelledby="pp-dialog-title"]')), { width: 380 });
  await page.keyboard.press('Escape');
  await page.click('.ev-chip[title^="A sample weekend"]'); await page.waitForSelector('[aria-labelledby="pp-trip-title"]');
  add('Dialogs', 'Trip pop-up', 'Opened from a trip bar or pill; a compact reading of the trip.', await grab(page, () => document.querySelector('[aria-labelledby="pp-trip-title"]')), { width: 520 });
  await page.context().close();

  // Visitor month page (view-only)
  page = await newPage({ owner: false });
  await page.go(briefHash, 'button[aria-label="Close the location brief"]');
  await snapshotPage(page, 'month-visitor', 'Month page as a visitor sees it (view-only)');
  await page.context().close();

  // Trips, gallery, weather, map header
  page = await newPage();
  await page.go('#/' + Y + '/trips/sample', '.trip-card');
  await snapshotPage(page, 'trips', 'Trips');
  add('Trips', 'Trip card (open)', 'Dates, locations, shot roll-up, packing checklist, notes.', await grab(page, () => document.querySelector('.trip-card')));
  await page.go('#/' + Y + '/gallery', '.tile[aria-label]');
  await snapshotPage(page, 'gallery', 'Gallery — photos');
  add('Gallery', 'Controls and tiles', 'Tabs, the group/filter/sort row, and 3:2 tiles under a group heading.', await grab(page, () => { const t = document.querySelector('[role=tablist]'); const w = document.createElement('div'); let n = t; while (n) { w.appendChild(n.cloneNode(true)); n = n.nextElementSibling; } return w; }));
  await page.go('#/' + Y + '/gallery/review', '[role=tablist]');
  await snapshotPage(page, 'gallery-review', 'Gallery — year in review');
  add('Gallery', 'Year in review', 'Stat tiles, the month strip and the visit log.', await grab(page, () => { const t = document.querySelector('[role=tablist]'); return t.nextElementSibling; }));
  await page.go('#/' + Y + '/weather/' + A.id);
  await page.waitForFunction(() => document.querySelectorAll('[data-day]').length >= 7, null, { timeout: 15000 });
  await snapshotPage(page, 'weather', 'Weather');
  add('Weather', 'Outlook days with condition flags', 'A day card; “Promising for” chips appear only on days that suit a kind of shoot.', await grab(page, () => { const w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:8px'; Array.from(document.querySelectorAll('[data-day]')).slice(0, 3).forEach(d => w.appendChild(d.cloneNode(true))); return w; }));
  add('Weather', 'Guide card', 'One of the conditions-and-settings cards.', await grab(page, () => document.querySelector('[id^="guide-"]')), { width: 580 });
  await page.go('#/' + Y + '/map');
  await snapshotPage(page, 'map', 'Map (the map itself is drawn by d3 at runtime and is not in this snapshot)');
  await page.context().close();

  // Offline banner + phone
  page = await newPage({ cloud: false });
  await page.go('#/' + Y);
  add('Navigation', 'Sync banner', 'Shown while the shared calendar can’t be reached or a save is pending.', await grab(page, () => document.querySelector('.app-shell > div > div')));
  await page.context().close();
  page = await newPage({ width: 390 });
  await page.go(briefHash, 'button[aria-label="Close the location brief"]');
  await snapshotPage(page, 'month-phone', 'Month page at phone width (390px)');
  await page.context().close();
  await browser.close(); server.close();

  // ── write the files ───────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cssForStandalone = appCss
    .replace(/^\s*@font-face \{ font-family: 'Caprasimo'[^\n]*\n/m, '')   // declared for future use, drawn nowhere
    .replace(/url\('\/assets\/fonts\/(Figtree-Variable\.woff2)'\)/, (m, f) => "url('" + fontAsset(f) + "')")
    .replace(/url\('\/assets\//g, "url('" + SITE + 'assets/');
  const tokensCss = '/* Photoplan colour tokens — generated by design/build-reference.js from the\n   token block in index.html (the source of truth). Day values are the\n   original design; the night values apply under :root[data-theme="night"].\n   Photographs and the lightbox use the fixed "on-photo"/"lb-" tokens. */\n' + tokenBlock.replace(/^    /gm, '').trim() + '\n';
  fs.writeFileSync(path.join(OUT, 'tokens.css'), tokensCss);

  const head = (title) => '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>' + esc(title) + '</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' + fontsLink + '\n<style>\n' + cssForStandalone + '\n</style>\n';
  const themeSwitch = '<button id="ref-theme" onclick="var r=document.documentElement;if(r.getAttribute(\'data-theme\')===\'night\'){r.removeAttribute(\'data-theme\');this.textContent=\'☾ Night\'}else{r.setAttribute(\'data-theme\',\'night\');this.textContent=\'☀ Day\'}" style="position:fixed;top:12px;right:12px;z-index:999;height:34px;padding:0 14px;background:var(--paper);color:var(--ink);border:1px solid var(--ink);font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;box-shadow:3px 3px 0 var(--shadow-12)">☾ Night</button>';
  const stamp = 'Generated ' + NOW.toISOString().slice(0, 10) + ' from index.html by design/build-reference.js — sample data only.';

  // whole-page snapshots
  fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
  pages.forEach(p => fs.writeFileSync(path.join(OUT, 'pages', p.name + '.html'), head('Photoplan snapshot — ' + p.title) + '</head>\n<body>\n<!-- ' + stamp + ' Static snapshot of the rendered page: real markup and inline styles, no scripts. -->\n' + themeSwitch + '\n' + p.html + '\n</body>\n</html>\n'));

  // the reference page
  const mono = "font-family:'IBM Plex Mono',monospace";
  const swatch = (t) => {
    const fixed = t.night === null;
    const chip = (v) => '<span style="display:inline-block;width:46px;height:30px;border:1px solid rgba(128,128,128,.45);background:' + v + ';vertical-align:middle"></span>';
    return '<tr><td style="padding:5px 12px 5px 0;white-space:nowrap">' + chip(t.day) + (fixed ? '' : ' ' + chip(t.night)) + '</td><td style="padding:5px 14px 5px 0;' + mono + ';font-size:12px;color:var(--ink)">--' + t.name + '</td><td style="padding:5px 14px 5px 0;' + mono + ';font-size:11px;color:var(--muted);white-space:nowrap">' + esc(t.day) + (fixed ? ' (fixed)' : ' → ' + esc(t.night)) + '</td><td style="padding:5px 0;font-size:13.5px;color:var(--ink-3)">' + esc(t.note) + '</td></tr>';
  };
  const groups = []; TOKENS.forEach(t => { let g = groups.find(x => x.name === t.group); if (!g) { g = { name: t.group, items: [] }; groups.push(g); } g.items.push(t); });
  const h2 = (t) => '<div style="display:flex;align-items:center;gap:14px;margin:54px 0 16px"><span style="' + mono + ';font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);white-space:nowrap">' + esc(t) + '</span><span style="flex:1;height:1px;background:var(--line)"></span></div>';
  const h3 = (t, note) => '<div style="margin:30px 0 12px"><div style="font-family:\'Zilla Slab\',serif;font-weight:700;font-size:21px;color:var(--ink)">' + esc(t) + '</div>' + (note ? '<div style="margin-top:4px;font-size:14.5px;color:var(--ink-3);line-height:1.5;max-width:74ch">' + esc(note) + '</div>' : '') + '</div>';
  const type = [
    ["'Figtree', system-ui, sans-serif", '700', '33px', '0.24em', 'PHOTOPLAN', 'Wordmark — Figtree 700, wide-tracked caps (self-hosted variable font)', 'text-transform:uppercase'],
    ["'Zilla Slab', serif", '700', '58px', '-0.01em', 'November', 'Page title — Zilla Slab 700, clamp(40px, 6vw, 58px), line-height .95', ''],
    ["'Zilla Slab', serif", '700', '24px', '0', 'Mam Tor', 'Card title — Zilla Slab 700, 21–24px', ''],
    ["'Zilla Slab', serif", '600', '15px', '0', 'Lake District', 'List and tile names — Zilla Slab 600, 14–17px', ''],
    ["'Spectral', Georgia, serif", '400', '17px', '0', 'A year of places to point a camera — frost on the fells, bluebells and lavender.', 'Intro copy — Spectral 400, 15–17px, line-height 1.5', ''],
    ["'Spectral', Georgia, serif", '400', '15px', '0', 'The ridge rising from a sea of valley fog at sunrise.', 'Body in cards — Spectral 400, 14–15px, line-height 1.5', ''],
    ["'IBM Plex Mono', monospace", '400', '11px', '.2em', 'Locations this month', 'Section label — Plex Mono 11px, .2em tracking, caps', 'text-transform:uppercase'],
    ["'IBM Plex Mono', monospace", '400', '10.5px', '.14em', 'Where · Idea · When', 'Row label — Plex Mono 10.5px, .14em tracking, caps', 'text-transform:uppercase'],
    ["'IBM Plex Mono', monospace", '500', '11px', '.12em', 'Add location', 'Button text — Plex Mono 11px, .12em tracking, caps', 'text-transform:uppercase'],
    ["'IBM Plex Mono', monospace", '400', '12.5px', '0', '07:41 ESE · 16:04 WSW · 86% waxing gibbous', 'Data — Plex Mono 12–13px', ''],
  ];
  const typeRows = type.map(([ff, w, size, ls, sample, label, extra]) => '<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:baseline;padding:13px 0;border-top:1px solid var(--line-soft)"><div style="font-family:' + ff + ';font-weight:' + w + ';font-size:' + size + ';letter-spacing:' + ls + ';color:var(--ink);line-height:1.2;' + extra + '">' + esc(sample) + '</div><div style="' + mono + ';font-size:11px;color:var(--muted);line-height:1.5">' + esc(label) + '</div></div>').join('\n');
  let body = '';
  body += '<div style="display:flex;align-items:center;gap:16px"><img src="' + svgAsset('photoplan-mark.svg') + '" class="logo-day" alt="" style="height:54px;display:block"><img src="' + svgAsset('photoplan-mark-on-dark.svg') + '" class="logo-night" alt="" style="height:54px;display:block"><div><div style="font-family:\'Figtree\',system-ui,sans-serif;font-weight:700;font-size:26px;letter-spacing:.24em;text-transform:uppercase;color:var(--brand-ink)">Photoplan</div><div style="' + mono + ';font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:6px">Style reference — the site as it is today</div></div></div>';
  body += '<div style="margin-top:20px;font-size:16px;color:var(--ink-3);line-height:1.55;max-width:78ch">This page recreates the current look of photoplan.studio without the app: the colour tokens, the type system, and the real components, serialised from the running site with their own markup and inline styles. Use the switch in the corner for night mode. Whole-page snapshots are in <a href="pages/" style="color:var(--green)">pages/</a>: ' + pages.map(p => '<a href="pages/' + p.name + '.html" style="color:var(--green)">' + esc(p.name) + '</a>').join(' · ') + '.</div>';
  body += '<div style="margin-top:8px;' + mono + ';font-size:10.5px;color:var(--faint);letter-spacing:.04em">' + esc(stamp) + '</div>';
  body += h2('Principles');
  body += '<ul style="margin:0;padding-left:20px;font-size:15px;color:var(--ink-body);line-height:1.7;max-width:86ch">'
    + ['A printed field-notebook feel: warm cream paper on a dotted, slightly darker page; near-black warm ink; olive green for actions and the UK, terracotta for International and warnings.',
       'Three type voices: Zilla Slab for names and titles, Spectral for prose, IBM Plex Mono in small tracked capitals for every label, button and datum. Figtree only for the wordmark.',
       'Square corners (radius 0–4px), 1px hairlines, and hard offset shadows (e.g. 3px 3px 0) rather than soft blurs; hover nudges an element up-left by 1px.',
       'Content column 1180px max, 26px page gutters (13px on phones, breakpoint 640px); cards pad 16–22px; rows in cards are a 74px label column plus content, separated by soft rules.',
       'Colour is semantic and tokenised: surfaces, lines, inks, then accent families (green, terracotta, gold/amber, slate) each with a wash, an ink and an accent. Night mode swaps token values only.',
       'Photographs are never recoloured; controls drawn over a photo use the fixed “on-photo” tokens in both themes.'].map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>';
  body += h2('Colour tokens');
  body += '<div style="font-size:14.5px;color:var(--ink-3);line-height:1.5;max-width:78ch;margin-bottom:8px">Each swatch pair is day then night. The same list is in <a href="tokens.css" style="color:var(--green)">tokens.css</a>.</div>';
  groups.forEach(g => { body += '<div style="margin-top:22px;' + mono + ';font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--label)">' + esc(g.name) + '</div><table style="border-collapse:collapse;margin-top:6px">' + g.items.map(swatch).join('') + '</table>'; });
  body += h2('Type');
  body += typeRows;
  const ORDER = ['Controls', 'Navigation', 'Home', 'Month page', 'Trips', 'Gallery', 'Weather', 'Dialogs'];
  sections.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group));   // stable: capture order kept within a group
  let lastGroup = '';
  sections.forEach(s => { if (s.group !== lastGroup) { body += h2(s.group); lastGroup = s.group; } body += h3(s.title, s.note) + '<div class="ref-frame"' + (s.width ? ' style="max-width:' + s.width + 'px"' : '') + '>' + s.html + '</div>'; });
  const refCss = '\n    /* reference-page chrome */\n    body { margin: 0; background: var(--page); background-image: radial-gradient(var(--page-dot) 0.8px, transparent 0.8px); background-size: 22px 22px; color: var(--ink); font-family: \'Spectral\', Georgia, serif; }\n    .ref-wrap { max-width: 1180px; margin: 0 auto; padding: 40px 26px 90px; }\n    .ref-frame { position: relative; }\n    .ref-frame [style*="position: fixed"] { position: static !important; }\n';
  fs.writeFileSync(path.join(OUT, 'style-reference.html'), head('Photoplan — style reference').replace('</style>', refCss + '</style>') + '</head>\n<body>\n<!-- ' + stamp + ' -->\n' + themeSwitch + '\n<div class="ref-wrap">\n' + body + '\n</div>\n</body>\n</html>\n');

  // --system <dir>: also assemble the files of the Claude design system (see build-system.js)
  const sysAt = process.argv.indexOf('--system');
  if (sysAt > -1) await require('./build-system.js')({ outDir: path.resolve(process.argv[sysAt + 1] || path.join(OUT, 'system-out')), ROOT, sections, TOKENS, appCss, fontsLink, eventIcons });

  const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB';
  console.log('tokens.css ' + kb('tokens.css') + ' · style-reference.html ' + kb('style-reference.html') + ' · ' + pages.length + ' page snapshots (' + pages.map(p => p.name + ' ' + kb('pages/' + p.name + '.html')).join(', ') + ')');
  console.log(TOKENS.length + ' tokens · ' + sections.length + ' components' + (sections.some(s => /not captured/.test(s.html)) ? ' · NOT CAPTURED: ' + sections.filter(s => /not captured/.test(s.html)).map(s => s.title).join(', ') : ''));
})().catch(e => { console.error(e); try { server.close(); } catch (_) {} process.exit(1); });
