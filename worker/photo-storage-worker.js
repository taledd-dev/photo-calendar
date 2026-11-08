// ─── Photo Calendar — R2 storage gatekeeper ───────────────────────────────────
// This small Cloudflare Worker is the ONLY thing allowed to write to the R2
// bucket. Anyone can VIEW photos (they're public, so family can see them), but
// UPLOADING or DELETING requires the secret password, which lives safely inside
// Cloudflare and is never exposed in the website code.
//
// Two settings are wired up in the Cloudflare dashboard:
//   • BUCKET          — an R2 binding pointing at the "photo-calendar" bucket
//   • UPLOAD_PASSWORD — a secret; the password required to upload or delete
//
// Endpoints:
//   GET    /photo/<name>  → returns the photo / file         (public, no password —
//                           except print-size copies, names ending "-print", which
//                           need the password too: only the owner prints)
//   PUT    /photo/<name>  → saves/replaces it                (password required)
//   DELETE /photo/<name>  → removes it                       (password required)
//   GET    /backups       → lists the automatic backups of calendar-data.json
//   GET    /list          → every photo name under photos/ (the site's index)
//
// Safety for the shared calendar (calendar-data.json) — "v2", announced to the
// site through the `x-photoplan-worker: 2` response header:
//   • Optimistic locking: a PUT may carry `x-if-saved-at: <stamp>` (or `none`).
//     The write is refused with 409 unless the stored copy's `savedAt` matches,
//     so two devices can never overwrite each other unseen. PUTs without the
//     header (older site code) are accepted as before.
//   • Backups: before each overwrite, the previous copy is kept under
//     backups/calendar-data-<UTC time>.json — at most one per 15-minute window
//     (the state as it was before the first save in that window) and the
//     newest 60 are kept. To restore one: in the R2 dashboard, download the
//     backup and upload it as calendar-data.json (overwrite), or PUT it with
//     the password.

const DATA_KEY = 'calendar-data.json';
const BACKUP_PREFIX = 'backups/calendar-data-';
const BACKUP_WINDOW_MS = 15 * 60 * 1000;
const BACKUP_KEEP = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-upload-key, x-if-saved-at',
  'Access-Control-Expose-Headers': 'x-photoplan-worker, etag',
  'Access-Control-Max-Age': '86400',
  'x-photoplan-worker': '2',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// The `savedAt` stamp inside a stored calendar-data.json (null if unreadable).
function stampOf(buf) {
  try {
    const s = JSON.parse(new TextDecoder().decode(buf)).savedAt;
    return typeof s === 'number' ? s : null;
  } catch (_) { return null; }
}

// Keep a copy of the calendar as it was before this write — one per 15-minute
// window, oldest state in the window wins — then trim to the newest BACKUP_KEEP.
async function backupCalendarData(env, previousBytes) {
  const windowStart = Math.floor(Date.now() / BACKUP_WINDOW_MS) * BACKUP_WINDOW_MS;
  const stamp = new Date(windowStart).toISOString().slice(0, 16).replace(':', '-'); // e.g. 2026-11-06T14-30
  const key = BACKUP_PREFIX + stamp + '.json';
  if (await env.BUCKET.head(key)) return;
  await env.BUCKET.put(key, previousBytes, { httpMetadata: { contentType: 'application/json' } });
  const listed = await env.BUCKET.list({ prefix: BACKUP_PREFIX });
  const keys = listed.objects.map(o => o.key).sort(); // timestamps sort oldest → newest
  if (keys.length > BACKUP_KEEP) await env.BUCKET.delete(keys.slice(0, keys.length - BACKUP_KEEP));
}

export default {
  async fetch(request, env) {
    // Browsers send a "preflight" OPTIONS check before uploads — answer it.
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // ── Public: list the calendar backups (newest first) ──────────────────────
    if (url.pathname === '/backups' && request.method === 'GET') {
      const listed = await env.BUCKET.list({ prefix: BACKUP_PREFIX });
      const backups = listed.objects
        .map(o => ({ key: o.key, uploaded: o.uploaded, size: o.size }))
        .sort((a, b) => (a.key < b.key ? 1 : -1));
      return json({ backups });
    }

    // ── Public: which photos exist (every key under photos/), so the site can
    // show thumbnails and slideshows from one request instead of probing. ──────
    if (url.pathname === '/list' && request.method === 'GET') {
      const keys = [];
      let cursor;
      do {
        const page = await env.BUCKET.list({ prefix: 'photos/', cursor });
        page.objects.forEach(o => keys.push(o.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return json({ keys });
    }

    const match = url.pathname.match(/^\/photo\/(.+)$/);
    if (!match) {
      return json({ error: 'Not found' }, 404);
    }

    // Keep the storage name simple and safe (letters, numbers, dot, dash, _, and
    // "/" so photos can live in a "photos/" folder). Collapse any ".." segments.
    const key = decodeURIComponent(match[1]).replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.{2,}/g, '_');

    // ── Public: view a photo ──────────────────────────────────────────────────
    // The print-size copies stay private: the site fetches them with the
    // password header (an <img> can't), so visitors only ever get the web sizes.
    if (request.method === 'GET') {
      if (/-print$/.test(key)) {
        const given = request.headers.get('x-upload-key') || '';
        if (!env.UPLOAD_PASSWORD || given !== env.UPLOAD_PASSWORD) return json({ error: 'Unauthorized' }, 401);
      }
      const obj = await env.BUCKET.get(key);
      if (!obj) return json({ error: 'Not found' }, 404);
      const headers = new Headers(CORS);
      obj.writeHttpMetadata(headers);
      headers.set('etag', obj.httpEtag);
      headers.set('Cache-Control', 'public, max-age=3600');
      return new Response(obj.body, { headers });
    }

    // ── Password-protected: everything below requires the secret key ──────────
    const provided = request.headers.get('x-upload-key') || '';
    if (!env.UPLOAD_PASSWORD || provided !== env.UPLOAD_PASSWORD) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (request.method === 'PUT') {
      const contentType = request.headers.get('content-type') || 'application/octet-stream';
      const body = await request.arrayBuffer();
      if (key === DATA_KEY) {
        const existing = await env.BUCKET.get(DATA_KEY);
        const previousBytes = existing ? await existing.arrayBuffer() : null;
        // Optimistic lock: the caller says which stamp it last saw; refuse if the
        // stored copy has moved on (another device saved in between).
        const expect = request.headers.get('x-if-saved-at');
        if (expect !== null) {
          const have = previousBytes ? stampOf(previousBytes) : null;
          const want = expect === 'none' ? null : Number(expect);
          if (have !== want) return json({ error: 'Conflict', savedAt: have }, 409);
        }
        if (previousBytes) await backupCalendarData(env, previousBytes);
      }
      await env.BUCKET.put(key, body, { httpMetadata: { contentType } });
      return json({ ok: true, key });
    }

    if (request.method === 'DELETE') {
      await env.BUCKET.delete(key);
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
};
