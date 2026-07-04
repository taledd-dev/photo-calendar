# Photo storage gatekeeper (Cloudflare Worker)

This folder holds the code for the small Cloudflare Worker that connects the
Photo Calendar website to R2 cloud storage.

- **Anyone** can view photos (they're public — family can see the calendar).
- **Only the owner** can upload or delete, protected by a secret password that
  lives inside Cloudflare and never appears in the website code.

## What you configure in the Cloudflare dashboard

| Setting | Type | Value |
|---|---|---|
| `BUCKET` | R2 bucket binding | the `photo-calendar` bucket |
| `UPLOAD_PASSWORD` | Secret (encrypted) | a password only you know |

## Deploy via GitHub (recommended — auto-deploys on every push)

The repo includes a `wrangler.toml` at the root, so Cloudflare can build and
deploy this Worker automatically whenever the code changes.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker** →
   **Connect to Git** (Workers Builds).
2. Pick the `taledd-dev/photo-calendar` repo and approve access.
3. Cloudflare reads `wrangler.toml` automatically (Worker name, entry file, and
   the `BUCKET` binding). Leave the build settings at their defaults and deploy.
4. Worker → **Settings** → **Variables and Secrets** → add a **Secret** named
   `UPLOAD_PASSWORD` with your chosen password. (Secrets are set here, never in
   the repo, and they persist across auto-deploys.)
5. Copy the Worker's URL (looks like
   `https://photo-calendar-storage.<your-subdomain>.workers.dev`).
   This URL goes into the website config — it is **not** secret.

After this is set up, any future change to `photo-storage-worker.js` that is
pushed to GitHub redeploys the Worker automatically — no manual steps.
