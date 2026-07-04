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

## Deploy (dashboard, no command line)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.
2. Name it `photo-calendar-storage`, create, then **Edit code**.
3. Replace the starter code with the contents of `photo-storage-worker.js`, then **Deploy**.
4. Worker → **Settings** → **Bindings** → add an **R2 bucket** binding:
   variable name `BUCKET`, bucket `photo-calendar`.
5. Worker → **Settings** → **Variables and Secrets** → add a **Secret** named
   `UPLOAD_PASSWORD` with your chosen password.
6. Copy the Worker's URL (looks like `https://photo-calendar-storage.<your-subdomain>.workers.dev`).
   This URL goes into the website config — it is **not** secret.
