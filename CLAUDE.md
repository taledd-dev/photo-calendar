# Photo Location Calendar — project notes

A single-page **2026 photography planning calendar**: month-by-month locations
(UK + international), astro/nature events, drop-in photos, and a map of every
spot. It's a personal planning tool for the owner; family can view it.

## Architecture at a glance

- **Everything is one file: `index.html`.** No build step. React 18 is loaded
  from unpkg (CDN); the code uses `const e = React.createElement` and plain
  function components — **no JSX**. Edit the inline `<script>` directly.
- **Photos live in Cloudflare R2**, reached through a small **Worker gatekeeper**
  (`worker/photo-storage-worker.js`, deployed at
  `https://photo-calendar-storage.taledd95.workers.dev`, set as
  `PHOTO_STORAGE_BASE` in `index.html`).
  - `GET /photo/<key>` is public (viewing). `PUT`/`DELETE` require the header
    `x-upload-key` matching the Worker secret `UPLOAD_PASSWORD`.
  - Each photo is stored twice: `<base>` (hero, ~1600px) and `<base>-thumb`
    (~500px). `base = "<monthKey>-ref-<locId>"`, e.g. `jan-ref-lake-district`.
  - The **whole calendar dataset** (locations, events, edits, coordinates, years,
    done/visited ticks) is shared via `calendar-data.json` in R2, shaped
    `{ version, savedAt, data }`. Everyone reads it; only the owner (password)
    writes it, debounced.
- **What's cloud-shared vs local:**
  - **Cloud (everyone sees the same):** the photos **and** the entire calendar
    dataset (`calendar-data.json`). Owner writes, everyone reads — so all devices
    and viewers see the same locations, edits, ticks, map markers, etc.
  - **Local only:** the owner's upload password (`calendar:uploadKey`), plus a
    `localStorage` cache of the data (`calendar:data`) for instant/offline render,
    which the cloud copy overrides on load.
  - `App` gates cloud *saving* behind a `cloudReady` flag (set once the load
    settles) so a fresh device can't overwrite the cloud with defaults; a
    `cloudEcho` ref stops the load from immediately re-saving. The old per-year
    `photo-meta.json` is superseded (years live in `calendar-data.json`;
    `loadMeta`/`saveMeta` remain in `Storage` but are unused).

## Key pieces in `index.html`

- **`Storage`** — the single seam to persistence. `photoUrl`, `getUploadKey`
  (prompts) / `peekUploadKey` (silent), `saveImage`/`removeImage`,
  `savePhotoVariants`/`removePhotoVariants` (resize + upload/delete both sizes),
  `loadCloudData`/`saveCloudData` (the shared `calendar-data.json`),
  `loadData`/`saveData` (localStorage cache).
- **`resizeImage(file, maxEdge, quality)`** — canvas downscale to a JPEG blob
  (respects EXIF orientation).
- **Components:** `HeroCaption` (read-only caption overlay), `PhotoSlideshow`
  (hero slideshows — random order, 15s, pause button, cache-busts via `epoch`),
  `LocThumb` (tile thumbnail), `LocationPhoto` (the upload control),
  `KitField` (pill chips that flip to an editable line), `Editable` (inline
  click-to-edit text), `MapView`, and `App`.
- **Views:** `App` holds `yearView` / `monthIdx` / `mapView`. Navigation:
  `goToYear`, `goToMonth(idx, locId)`, `goToMap`, `changeMonth`; the shared
  `navRow(showYearBtn)` renders the top buttons (year page drops the redundant
  right arrow).

## The Map (`MapView`)

- **`LOCATION_COORDS`** (module scope) maps each built-in location id → `[lat,lng]`
  (precise real coordinates). On load, `App` backfills these onto each location
  as `loc.lat`/`loc.lng` so the detail panel's editable "Map coordinates" field
  is populated. Added locations have no built-in entry — the owner pastes coords.
- **`buildMapPlaces(data)`** builds one pin per location, preferring the
  location's own `loc.lat`/`loc.lng`, else `LOCATION_COORDS`, else skipping it.
- d3 + topojson-client + world-atlas load lazily from a CDN the first time the
  map opens. Projection is `geoMercator().fitExtent(...)` over all points; the
  memo is keyed to a signature of the places so **adding/moving a pin reframes**
  the map. Fit-to-all means a far outlier (e.g. Canada) zooms everything out.
- Card month-rows deep-link via the calendar's `goToMonth`. **"Visited" = the
  location's `done` tick** (one source of truth); toggling on the map ticks it
  off in the calendar too.

## Decisions already made (don't silently reverse)

- Photos are **public to view, owner-only to upload** (password gate).
- Hero captions are **auto** (`Location · Month YY`); only the **year** is
  user-entered, and it's cloud-synced so viewers see it.
- **Visited is the `done` tick.** Coordinates come from the built-in table and
  are **per-location editable**; the old **postcode** field was removed.
- The **2026 cover** slideshow cycles *all* location photos; each **month hero**
  cycles that month's location photos.
- Deleting a photo (×) **and** deleting a location both remove the R2 images.

## Working on it

- **Deploy = publish to `main`.** GitHub Pages serves `main` at
  `https://taledd-dev.github.io/photo-calendar/`. Development happens on a feature
  branch, then fast-forward `main`. (Pages can lag a minute or two after a push;
  cache-bust with `?v=something` when testing.)
- **The Worker is deployed manually** via the Cloudflare dashboard (paste
  `worker/photo-storage-worker.js`, bind R2 bucket `photo-calendar` as `BUCKET`,
  set the `UPLOAD_PASSWORD` secret). `wrangler.toml` exists for reference.
- **Always syntax-check before publishing** — extract the inline script and run
  `node --check`:
  ```
  python3 - <<'PY'
  import re; h=open('index.html',encoding='utf-8').read()
  open('/tmp/app.js','w').write(max(re.findall(r'<script>(.*?)</script>',h,flags=re.S),key=len))
  PY
  node --check /tmp/app.js
  ```
- The environment can't reach the CDNs (React/d3) or R2, so the app can't be run
  headless here — rely on the syntax check and ask the owner to test live.
