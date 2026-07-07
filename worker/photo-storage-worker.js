// ─── Photo Calendar — R2 storage gatekeeper ───────────────────────────────────
// This small Cloudflare Worker is the ONLY thing allowed to write to the R2
// bucket. Anyone can VIEW photos (they're public, so family can see them), but
// UPLOADING or DELETING requires the secret password, which lives safely inside
// Cloudflare and is never exposed in the website code.
//
// Two settings are wired up in the Cloudflare dashboard (see worker/README.md):
//   • BUCKET          — an R2 binding pointing at the "photo-calendar" bucket
//   • UPLOAD_PASSWORD — a secret; the password required to upload or delete
//
// Endpoints (all under /photo/<name>):
//   GET    /photo/<name>  → returns the photo            (public, no password)
//   PUT    /photo/<name>  → saves/replaces the photo     (password required)
//   DELETE /photo/<name>  → removes the photo            (password required)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-upload-key',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    // Browsers send a "preflight" OPTIONS check before uploads — answer it.
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/photo\/(.+)$/);
    if (!match) {
      return json({ error: 'Not found' }, 404);
    }

    // Keep the storage name simple and safe (letters, numbers, dot, dash, _, and
    // "/" so photos can live in a "photos/" folder). Collapse any ".." segments.
    const key = decodeURIComponent(match[1]).replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.{2,}/g, '_');

    // ── Public: view a photo ──────────────────────────────────────────────────
    if (request.method === 'GET') {
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
