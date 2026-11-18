# Photo Location Calendar — project notes

A single-page **photography planning calendar** ("Photoplan"): month-by-month
locations (UK + international), astro/nature events, drop-in photos, and a map
of every spot. It's a personal planning tool for the owner; family can view it.

**Years:** the calendar is year-agnostic and **unbounded**. Locations (and
their photos) are shared across years; **events and the day-grid are
per-year**, stored in each month's `eventsByYear` map (keyed by year string).
`YEARS` is a rolling range (2026 → today + 9) offered by the year pickers
(choice kept in `localStorage['calendar:year']`). The grid's start-weekday/
day-count is computed from `Date` (the seeded `dow`/`days`/`year` fields on
months are legacy, unused). **Astronomy is computed** (the "Astronomy" block
before `migrateYearEvents`): Meeus moon phases, equinoxes/solstices by
iterating the Sun's longitude, UK clock changes, NOAA sunrise/sunset/golden/
civil-twilight times at any coordinates (`lightAt`; UK coords in GMT/BST,
elsewhere UTC; `HOME_REF` = Hindhead is the fixed reference for the month-
level sunrise/sunset). `generatedEvents(year)` builds a year's events from these
(named full moons incl. Harvest/Blue, the `ECLIPSES` table for 2029–2040 —
computed and checked with PyEphem, see its comment; extend it the same way
(scratch `eclipses.py` + `eclipse_test.js`) — and the annual meteor/nature
windows taken from the 2028 seed);
`storedOrGenerated(m, year)` returns the stored list **or** the generated
one; `eventsFor(m, year)` prepends the month's **yearly repeaters**
(`month.annualEvents`, events flagged `annual: true` — birthdays etc., set
by the "Repeats every year" checkbox in the event editor; dates clamped to
the month length) and is what every view uses. `saveEvent`/`deleteEvent`
materialise the generated list into the data the first time a year is
edited, and move an event between the year list and `annualEvents` when the
checkbox is toggled (`mutateData`'s deep copy clones `annualEvents` too). `migrateYearEvents` upgrades old data on load
(bare `events` → 2026) and fills only the hand-seeded `YEAR_EVENTS` years
(2027/28), then runs `applySeedPatches` — `SEED_PATCHES` are one-off
additions to already-stored years (e.g. the October "Red deer rut" window),
each applied once per dataset and recorded in `data[0].seedPatches` so an
owner's deletion sticks; add new annual windows to the 2028 seed (the
template for generated years) **and** as a patch. A patch with a `year`
applies to that stored year only: the eclipses from `ECLIPSE_PATCH_FROM`
(2031) on are generated as such patches, so a year the owner had already
edited still receives them. The seeded `sunrise`/`sunset` month fields are **unused**: the
home rows, month header and print grid show `monthLight(m2, i)` (15th of the
month at `HOME_REF`, Hindhead — labelled on screen, unnamed in print), and
the brief has a per-location "Light" row. `daylightNote` stays editorial.

## The redesign — "option D" (in progress; preview at `/next/`)

The owner chose a new look in a design session (18 Nov 2026): warm cream
paper, olive-green actions, rounded corners, **two typefaces** (Zilla Slab
700 for titles and names, Figtree for everything else, 17px body), 44px
controls with 10px corners, 12–16px cards, pill chips, no shadows except on
pop-ups and menus, line icons instead of font characters. The drawings are
the boards titled **"D · …"** on the design canvas
`https://claude.ai/artifact/8JDNdoTUnMnv7HCPksyT1W` (boards A, B, C and
"Today" are not to be built); the written brief was the hand-over document
the owner attached. **Where the brief and a board disagree, ask the owner.**

- **It is being built in `next/index.html`**, a full copy of the app
  published at `photoplan.studio/next/` (`noindex`; same data, password and
  photos as the live site — an edit there is a real edit). **The live
  `index.html` keeps the old look until the owner approves**, then
  `next/index.html` replaces it. A fix that should reach visitors now goes
  into both files. Asset paths in `next/` are absolute (`/assets/…`).
- **Build order (the brief's), one step at a time for the owner to review:**
  1 shared look ✔ · 2 top bar + Settings menu ✔ · 3 month page ✔ ·
  4 Home ✔ · 5 Weather, Trips, Gallery, Map ✔ · 6 pop-ups + photo viewer ✔ ·
  7 Calendar ✔ (28 pages; the photo index is 2 pages of 6 with one large
  photo chosen per page, remembered per calendar year in the shared data,
  default January and July — this supersedes "four per page") · 8 phone,
  then night, across the pages ✔ · 9 **link-only access** (propose the
  approach in plain language and get agreement before building — proposed,
  awaiting the owner's answer; nothing built).
  Every page is now in the new look; `.old-page` survives only for the
  stored-away Home list (`renderMonthIndexList`). The old components'
  non-`d` branches and `…Old` helpers are dead code to clear out when
  `next/` replaces the live page.
- **Shared pieces** (module scope, after `const e`): `sx('css text')` turns
  CSS text into a cached style object (so a board's styles paste in with the
  colour literals swapped for tokens); `SLAB`; `D_ICONS` + `DIcon` (2px line
  icons: cog, search, target, close, chevL/R/D/U, plus, minus, fit, check,
  up, pause, play, star, expand); `dTrack(on)` (the on/off switch's track);
  **`D`** = the drawn controls (`btn`, `primary`, `danger`, `iconBtn`,
  `round` — the light round button over a photo, `field`, `pill`, `pillOn`,
  `label`); `DInput` (a real input that saves on blur/Enter, plain text for
  visitors); `textWidth(text, font)` (canvas measure, cached once the face
  has loaded). CSS classes `.d-root` (the shell: Figtree, 17px, tabular
  figures), `.d-btn/.d-primary/.d-danger/.d-iconbtn/.d-round` (hover),
  `.d-field`, `.d-edit` (click-to-edit text: wash on hover, field look while
  typing, `data-ph` placeholder), `.d-ev`, `.d-card`, `.d-x`, `.d-linkbtn`,
  `.d-slot`. New tokens: `on-photo-ink`, `tile`, `slot`, `dash`,
  `green-wash-ink`, `pop-shadow`, `map-ground`, `fullmoon-wash` (print
  bars) and the viewer's fixed `lb-ground`, `lb-ink-2`, `lb-field`,
  `lb-veil`, `lb-link`; `--page` is now `#F1EBDB`.
  Zilla Slab 600/700 is self-hosted (`assets/fonts/ZillaSlab-*.woff2`).
- **Top bar** (`renderTopBar`, every page): logo → Home · the six word links
  (Home, Map, Weather, Trips, Gallery, Calendar — Calendar = the printable
  calendar, owner only, as before) · search (`searchBoxD`, where the page
  has one) · the page's one green button (`pageAction()` / `actionBtn`;
  on phones it moves into the page, `phoneAction`) · the Settings cog
  (`renderSettingsMenu`: Night mode and Editing switches; Export calendar and
  Calendar backups for the owner). `navRow`, `homeTools`, `editToggle`,
  `backupsLink` are stubbed to `null` (originals kept as `…Old`).
- **Month page** (`renderMonthPage`, drawn on "D · Combined" / "D · Month
  night" / "D · Month phone"), top to bottom: full-width `PhotoSlideshow d`
  (caption **under** the photo via `onCurrent` → `heroCap`; only the round
  next/pause buttons on it; sized by **`heroLook`** — a phone: edge to
  edge, 3:2; **every wider window, laptop and monitor alike: the whole 3:2
  photo, never a banner crop**, inset with 16px corners and centred,
  `min(100% − 64px, 1180px, max(90vh, 420px))` wide — the text column's
  width at most and no taller than 60% of the window, so the title shows
  beneath it; `heroCapRow` keeps the caption line to the photo's width.
  This is the **owner's decision over the board's edge-to-edge banner**: the
  banner cut too much off a photo (a sliver on his 32-inch monitor), and a
  photo at 82% of the window's height was too big); month name + year (`.d-yearsel`, a select that
  reads as text) + tagline + month picker; **"at a glance"**: typical light,
  Add event and the **month strip** — one column per day (weekends tinted,
  a photo-op day's number dark), events as rounded bars in rows by kind
  (nature/season windows · the sky · trips · photo ops and own events),
  the name beside the bar (right, or left when the month ends first), an
  all-month or long window as a pale bar with the name inside, the "Shown
  as" picture before the name; a bar or its name opens the editor (owner) or
  the trip pop-up; on phones the strip is a list (swatch, name, days);
  **location cards** (`LocationPhoto d:'card'`, Visited / To visit / Photo op
  chips — the done tick is worded **"Visited" everywhere**, the owner's
  choice, never Done / Completed / ticked off — All/UK/International filter `locFilter`, the owner's round ★ for
  the print pick, drag to reorder on desktop, green outline when open; a
  sideways-scrolling row on phones); and the **brief** — header (name,
  subject · where · region, Visited (or "Mark as visited") / Schedule photo
  op / ×), left column
  (main photo with round focus and remove buttons, thumbnails with
  `[year][↑][×]` — the thumbnail itself is the focus control — the dashed
  "Add photo" slot, year taken, the mini map, its legend, coordinates and
  map links), right column (Light: Weather button, day stepper, four tiles,
  Daylight / Moon / Milky Way lines; Tides: `TideChartD` — the day's curve
  with daylight shaded and sunrise/sunset marked, a tile per high and low,
  "About this data" → `renderTideAbout`; then Where / Idea / When), the
  lower grid (Shots, Visits, Trips + Same spot, Kit, Parking and Links,
  Notes) and the footer (Move to…, the UK/International select, Delete).
  The components carry their option-D form behind a `d` prop
  (`PhotoSlideshow`, `LocationPhoto` `'main' | 'thumb' | 'add' | 'card'`,
  `KitField`, `LinksField`, `NotesField`, `Checklist`, `MiniMap`).
  The print calendar still uses `buildWeeks` and the day-corner icons.
- **Home** (`renderYearPage`, "D · Home" / night / phone): the same
  full-width photo and caption; "The year ahead" + year, the editable intro,
  the counts and the Instagram link; the year picker (`dSelect`, "Year
  2026"); **Coming up** cards (swatch, when, title, "kind · month"; a trip
  opens its pop-up, a photo op the brief); and **a card per month** — its
  photo (`monthPick(m2)`: the starred location's, else the first with one;
  an owner without one sees a dashed hint to add it on the month page), the
  light, the tagline and its locations as links — with the All / UK /
  International chips (`homeFilter`; months with no match drop out). No
  idea/when text and no Cards/List switch: the old list is kept whole as
  `renderMonthIndexList()` (unused) so the switch can return.
- **Weather, Trips, Gallery, Map** (each: a large title and intro, its
  controls, its content; `maxWidth: 1244`, `padding: 36px 32px 80px`).
  *Weather* (`WeatherView`, props `action` = the phone's green button,
  `hrefFor`): the picker — **one A–Z list of places, no month groups and no
  place twice** (`spots`, keyed by `normPlaceKey(name)`; the owner's request,
  a spot shot in several months has one forecast) — and **Set default**
  (green, as the owner asked) / `● Default`; the spot's name is a link to its brief; the aurora pill and
  the outside links; a card per day with `WxIcon` (line drawings from the
  WMO code: clear, partly, cloud, fog, rain, snow, storm), cloud at dawn /
  dusk / night with a note that goes green for good news, rain / wind /
  visibility, and the Promising-for chips; the guide cards (Conditions, a
  tinted Settings panel, Tips). *Trips* (`renderTripsPage`): a card per
  trip — name, `Tomorrow`-style chip, dates, a chevron to open; opened:
  three tiles (Locations, Shots taken, Packed), Dates / Locations (photo,
  name → brief, the first day's light, the dashed "Choose a location…"
  picker) / Notes beside Shots / Packing (`Checklist d`: 32px rows with a
  mouse, 44px on a phone) and Delete trip in the foot. **"Edit the usual
  packing list" is a button on the first heading's row** (`listBtn`, beside
  "Coming up"; the owner's request): it opens `listPanel` under the row,
  saves when the box loses focus and stays open until the button ("Close
  the usual packing list") or Escape. Two sections only: **Coming up** (a
  trip under way, marked Now, the ones ahead and any without dates) and
  **Past trips** (latest first). *Gallery* (`renderGalleryPage`): pill tabs, one filter card,
  the owner's two links ("Fill in areas and countries", "@handle on photos ·
  on/off"), 320px tiles (thumb/hero by `srcSet`) with a gold star badge;
  the Year in review (not drawn) in the same style. **A caption per photo**
  (the owner's request): `loc.photos[i].caption`, set with
  `setPhotoCaption(locId, slot, text)` from the viewer's "Caption" field
  (blur/Enter; empty removes it; a legacy single photo becomes a `photos`
  list), carried on gallery items as `text` (the automatic "Place · Mon
  'YY" stays `caption`) and shown **only on the Gallery page, beneath the
  place's name** — on a tile and in the viewer, where the owner's Caption
  field sits at the foot (it was tried directly under the photo, above the
  name, and the owner asked for it back). The viewer's way to the
  location's page is a **"More info" button** (a link styled as one; the
  owner's wording, in place of "Open brief →"). The Gallery's old
  "@handle on photos" switch is gone — see the watermark. *Map* (`MapView`, props
  `photoFor`, `hrefFor`): the "Visited" tile with its bar (the wording is
  **"Visited", never "ticked off"** — the owner's choice), one filter
  card (Region, Status, When), the live map unchanged in a rounded frame
  (the 1000 × 640 drawing is centred in the box and its coastlines overflow
  to fill it — pointer maths untouched), `+ −` (and a fit button once
  zoomed), the zoom tag, and the pin's card: photo, name, month and status
  chips, the owner's Visited box, an "Open <month> →" link per month
  (beside the pin on a wide screen, docked at the map's foot on a phone).
- **Pop-ups and the photo viewer** share `popScrim(z)`, `popCard(width,
  gap)`, `popTitle` and `popClose(run, label, focus)`: `renderBackups`,
  `renderTripPeek`, `renderTideAbout`, `renderEventModal` (title
  `#pp-event-title`, type chips with `aria-pressed`, the "Shown as"
  picture buttons, a × that reads "Close the event editor"), `renderDialog`
  (a `form role=dialog`, `#pp-dialog-title`; the confirm button is red —
  `.d-reddanger` — when `danger`), and `renderLightbox` (the viewer: dark in
  both themes, `.lb-btn` / `.lb-field`; **on a phone held sideways** —
  `isShort` = `useMedia('(max-height: 520px) and (orientation: landscape)')`
  — the photo takes the whole height, `.lb-short-img`, and the count, place,
  caption, fields and links sit in a 250px column beside it; "i" hides the
  column). The sync banner
  (`renderCloudBanner`) and the toast are in the new look too.
- **Watermark** (the owner's request; replaces the photo-credit pill in
  the preview). `Watermark({ size, inset, rightShift })` draws
  `OWNER_NAME` in the bottom-left corner and `@IG_HANDLE` in the
  bottom-right of the **large photos: the hero slideshows (the handle sits
  just left of the round buttons), the Gallery's tiles and the viewer**.
  It is **on by default for everyone**; the owner's switch is "Watermark on
  photos" in the Settings menu, shown only while editing, stored as
  `data[0].watermark` (`false` = off; unset = on; `markOn` in `App`,
  carried as `FocusCtx.credit`). While it is on, `App` also blocks
  `contextmenu` and `dragstart` on any photo `<img>` (Worker or `blob:`
  address) and `.pp-guard` switches off the phone's long-press save — a
  **deterrent only**: the overlay is not in the stored file, whose address
  is still in the page. The owner has been told; a watermark **burnt into
  the web copies** (a watermarked hero/thumb served to the public, the
  clean ones and the print copy behind the password — needs the Worker
  updated and every photo reprocessed) was offered as the stronger step
  and is **not built; wait for his answer**. Not on the smaller photos
  (location cards, the brief, Home's month cards) or on print.
- **Calendar** (`renderPrintPage`, "D · Calendar"; owner only; the top
  bar's green button is "Print / Save PDF"): title + "… · 28 pages · A4
  landscape", the year picker, two cards — **What prints** (a dark pill
  with a tick per event type, `printPrefs.hideKinds`; the "Photo captions"
  switch) and **Before you print** (six steps) — then the 28 sheets, each a
  `section.cal-sheet` (its name, `.no-print`) around `.sheet-box >
  .print-sheet`. **A sheet is a fixed 281 × 193 mm drawing**;
  `SheetScale` sets `--sheet-scale` on the column and CSS scales every sheet
  to the width on hand (a phone shows the whole sheet), while `.sheet-fixed`
  / `.sheet-fixed-bar` controls on a sheet are scaled back up to stay 44px;
  the print rules switch the scale off and turn the wrappers into plain
  blocks (the last sheet carries `.last` — no trailing blank page). Sheets:
  cover and back cover (`LocationPhoto d:'sheet'` — fills the sheet, shows
  the print-size copy, round focus/remove buttons — under `coverBand()`,
  the live band with Figtree in place of the mono); per month the photo
  page and the grid page (Zilla month + Figtree year | mark + PHOTOPLAN |
  caption, light, note; a rounded grid; day number, named-day text, window
  pictures; **bars with rounded ends** in the type's pale wash — square
  where an event runs into another week — each led by **its symbol**
  (`GlyphIcon`, drawn from `GLYPH_ART` by the glyph in `EVENT_STYLE`: ● ○ ✦
  ◐ ◉ ▲ ◆; the board left them out and the owner asked for them back), the
  name set smaller, down to 10px, before it is ever cut; **a named day is
  never cut off** (`fitName`: as large as fits beside the number and the
  window pictures, 12.5px at most, two lines rather than under 10px); `{ top: 31, step: 24 }`, 22px
  bars, slimmer from `top: 28` when a six-week month's busiest week would
  not fit; the key = a strong-colour pill and the symbol per type, new moon outlined, then
  each window picture with its dates; the handle with `igGlyph`); and the
  **photo index** — two sheets (January–June, July–December), three columns
  of 3:2 tiles, the large one `span 2` × `span 2` first and the other five
  in month order, no month labels. The large month per sheet is
  **`data[0].indexLarge = { '<year>': ['<month key>', '<month key>'] }`**
  (unset = January and July; `setLarge(page, key)`), chosen with the round
  `expand` button on a small photo (on a phone the small photo itself is
  the button, under a 26px `.sheet-badge`, and the tag is `.sheet-tag` — a
  44px disc smothered a 113px photo); the "Large photo · <Month>" tag and
  the buttons are `.no-print`. `printSizeBadge(text, foot)` is the "web size
  only" pill (top-left; foot-left and shorter on an index tile).
- **Link-only access (step 9) — proposed, not built; wait for the owner's
  answer.** The proposal and its drawn screens:
  `https://claude.ai/artifact/522af196pjvpoYbtEkf4JW`. Recommended:
  **private share links** — the Worker refuses `calendar-data.json`,
  `/list` and every `/photo/*` without a valid view key (a header on
  fetches, `?k=` on photo addresses through `Storage.photoUrl`) or the
  owner password; the links (name, key, made, last opened, off) live in a
  private R2 object managed from Settings → "Sharing links"; a "Private
  viewing" switch turns it all on; a visitor without a key sees "This
  calendar is private" (a paste-your-link field and an owner link); the key
  arrives as `?k=` (the hash belongs to the router), is kept in
  `localStorage` and stripped from the address bar. Also offered: a
  Cloudflare Access sign-in, or one viewing password. Asked of the owner:
  which option, the private page's wording, whether the starter data in
  the page's code moves behind the lock too, and when to build.
- **Parked by the brief:** starring stays exactly as it is (the starred
  location is **shared across years** — `month.printLoc`); the Home page's
  Cards/List toggle is dropped but the list should stay easy to restore; the
  Photoplan design system is not yet updated to option D (ask the owner
  when).
- **Checking a step:** scratchpad `boards/` — `render.js` (the boards,
  rendered with their own runtime → `boards/shots/`), `b2js.py` (board
  markup → `e(…, { style: sx('…') })` with tokens), `dshots.js <dir> [only]`
  (the preview seeded like the boards; full-page shots at 1280, night, 390
  and as a visitor; fails on sideways overflow, a tap target under 44px, a
  page error), `strips.js` (the month strip for all twelve months),
  `month_test.js` (65 click-through checks of the month page against a
  faked Worker), and `home_test.js`, `weather_d_test.js` (+ the older
  `weather_next.js` flags test), `trips_d_test.js`, `gallery_d_test.js`,
  `map_d_test.js` (d3 / topojson / world-atlas served from `maplibs/`),
  `popups_shots.js` (29 checks of the pop-ups and the viewer),
  `calendar_d_test.js` (48: the controls, symbols and fitted names, the
  per-year large photo, day colours at night, the 390px scale, and the PDF
  from `page.pdf()` — 28 pages of A4 landscape by `pdfinfo`, pages rendered
  with `pdftoppm`) and `fb1_test.js` (36: the hero on a laptop, a monitor
  and a phone, photo captions, the watermark and its switch, the viewer at
  844 × 390).
  `dshots.js` also scans every text for contrast under 4.5:1 (3:1 for
  large type) against its real background, day and night.
  The brief's own checks per step: matches the board at 1280
  and 390, nothing spills at 390, taps ≥ 44px, no photo tinted at night,
  print stays 28 day-coloured pages, nothing stored changes, and the owner
  has seen it on a real phone.

## Architecture at a glance

- **Everything is one file: `index.html`.** No build step. React 18.3.1 is
  **self-hosted** (`assets/vendor/react*.production.min.js`, the UMD builds
  from the npm tarballs); the code uses `const e = React.createElement` and
  plain function components — **no JSX**. Edit the inline `<script>` directly.
  Google Fonts loads only the weights in use (Zilla 600/700, Spectral 400,
  Plex Mono 400/500/600); Figtree/Caprasimo are self-hosted in `assets/fonts`.
  `manifest.webmanifest` + `assets/icon-*.png` make it installable; the
  `<head>` carries description/Open Graph tags with `assets/social-card.png`
  (icons and card are generated by a throwaway Pillow script, not kept).
- **Colours are theme tokens.** Every colour in the CSS and the inline styles
  is a CSS custom property (`var(--green)`, `var(--paper)`, `var(--ink-2)`…)
  defined in the block between `/* tokens:start */` and `/* tokens:end */` at
  the top of the `<style>`: `:root, .print-sheet { day values }` then
  `:root[data-theme="night"] { night values }`. **That block is the source of
  truth — never write a hex/rgba literal in new code; reuse a token or add
  one (day value + night partner, with its `/* note */`).** The day theme was
  proven pixel-identical to the pre-token site on 29 screenshots. Families:
  surfaces (`page`, `paper`, `field`, `sunken`…), lines (`line`,
  `line-soft`, `line-strong`…), inks (`ink`, `ink-2`, `ink-3`, `muted`,
  `label`, `faint`, `ghost`), accents (`green`, `terra`, `gold`, `slate`,
  `danger` + washes), the event-type and custom-palette families, shadows /
  scrims / focus rings, and **fixed** ones that never change with the theme:
  `on-photo`, `photo-veil-*`, `photo-glass-*` (controls over a photograph) and
  `lb-*` (the lightbox, dark in both themes). Deliberately literal: Leaflet
  marker/ray colours (`#D9A441 #C8551F #6F7F9E #8A98B3`, Leaflet takes
  attribute values), the Instagram gradient stops, the print cover's
  `#F6A06B`, the hero caption's `#000/#fff` and pure-black `rgba(0,0,0,…)`
  shadows. SVG presentation attributes can't hold `var()`, so themed SVG
  uses `style: { fill, stroke }` (see `igGlyph`, the map legend,
  `EVENT_ICONS` cut-outs).
- **Night mode.** `theme` state in `App` ('day' | 'night', per device in
  `localStorage['calendar:theme']`; a one-line `<head>` script sets
  `data-theme="night"` on `<html>` before first paint; the effect also sets
  `<meta name="theme-color">`). `themeToggle()` is the "☾ Night mode / ☀ Day
  mode" quiet link; `editToggle()` now renders it beside `editSwitch()` (the
  edit link), and the Weather page's nav column carries it too. **Print
  sheets always use the day palette** (`.print-sheet` re-declares the day
  tokens). After `/* tokens:end */` sit the night extras: the mini map's
  tiles are dimmed with a CSS filter and its controls restyled; **`LogoMark`**
  renders both `assets/photoplan-mark.svg` (`.logo-day`) and
  `photoplan-mark-on-dark.svg` (`.logo-night`) and CSS shows one — use it
  wherever the mark appears.
- **`design/` is the design hand-over** (for a Claude Design session — the
  owner wants to iterate on the look from an accurate copy of the current
  state): `tokens.css`, `style-reference.html` (principles, swatches, type,
  22 real components serialised from the running app, day/night switch),
  `pages/*.html` (whole-page snapshots) and `README.md` (how to use it, how
  a design comes back). **All generated by `node design/build-reference.js`**
  (Playwright; own server on :8137; fakes the Worker/forecast; sample data
  only; logos + Figtree embedded so each file stands alone; `noindex`) —
  **re-run it after any visual change** so the folder stays true. It is
  served publicly by Pages like everything else on `main`.
- **The Claude design system** (“Photoplan”, a Design System artifact in the
  owner's Claude account — address and asset ids in
  `design/system/published.json`; standalone claude.ai/design closes
  14 Dec 2026, so this is the route the owner chose). A design session uses
  it when told “use my Photoplan design system” (it is listed as theirs but
  not marked default — only the owner can do that). It holds `tokens.json`
  (the 118 colours as themes `day`/`night` — the same `data-theme` the app
  uses — plus type styles, spacing, radius, shadow, size), a brand-book
  `README.md`, 22 components (README + static `preview.html` = the app's own
  markup; `components/bundle.css` = the app's stylesheet minus the token
  block), a cover, the logos + 20 window icons as uploads, and Figtree.
  **Sources:** hand-written half in `design/system/` (`README.md`,
  `tokens-extra.json` — every value measured from the app, plus the grounds
  each text colour is read on; `components.json` — capture → component +
  guidelines; `cover.html`); the rest comes from `index.html`.
  **`node design/build-reference.js --system`** → `design/system-out/`
  (git-ignored): `project/…` files, `uploads/`, and `check/` screenshots of
  every preview in both themes; it fails loudly on a duplicate/invalid token
  name, a preview using an undefined token, a blank preview or one wider
  than its layout, and appends each text colour's contrast to its usage note
  (several small-label inks — `muted`, `label`, `faint`, `ghost` — are under
  4.5:1 on paper; flagged there, kept as the site has them, owner told).
  **Refreshing it** (after a visual change, on the owner's say-so): rebuild;
  `read` the live `project/design-system.json` and any file you will replace
  — the owner can edit tokens and the brand book on the page, so merge
  rather than overwrite `README.md`/`tokens.json`; publish only the changed
  files under `project/` in one Artifact call with `root` =
  `design/system-out` (previews and `bundle.css` are safe to replace
  wholesale); never write `tokens.css`, `api/` or `manifest.json` (the page
  generates them) and never send a rebuilt index — edit the one just read
  (set `lastChange`). New logo/icon files are uploaded as assets first and
  recorded in the index's `assetGroups`. The type's own instructions come
  with any `read` of the artifact's `SKILL.md`; follow those.
- **Photos live in Cloudflare R2**, reached through a small **Worker gatekeeper**
  (`worker/photo-storage-worker.js`, deployed at
  `https://photo-calendar-storage.taledd95.workers.dev`, set as
  `PHOTO_STORAGE_BASE` in `index.html`).
  - `GET /photo/<key>` is public (viewing) **except keys ending `-print`**,
    which need the password header too (the public never gets more than the
    1600px web copy). `PUT`/`DELETE` require the header `x-upload-key`
    matching the Worker secret `UPLOAD_PASSWORD`. Because an `<img>` can't
    send a header, the site fetches print copies with it and shows `blob:`
    URLs: `fetchPrivateUrl(key, bust)` (session cache) + the
    `usePrivateImage(key, bust)` hook, used by `PrintMonthPhoto` and
    `LocationPhoto full`; the hero shows until the copy arrives ("Loading the
    print-size copy…" on-screen badge). `copyImage` sends the header so moves
    carry the print copy.
  - Each photo is stored three times: `<base>` (hero, ~1600px, the slideshows),
    `<base>-thumb` (~500px, tiles) and `<base>-print` (`PRINT_MAX_EDGE` =
    3200px, ~290 dpi across A4 — only the printable calendar loads it), under
    a **`photos/` folder**. `base = photoBase(monthKey, locId) =
    "photos/<monthKey>-ref-<locId>"`, e.g. `photos/jan-ref-lake-district`.
    Photos uploaded before the print size existed have no `-print` copy; the
    print page falls back to the hero and shows an on-screen "web size only"
    flag (`printSizeBadge`) until the photo is dropped on again.
    New locations get a readable slug id from their name (`slugify`), so
    added-location photos get readable filenames too. The Worker key sanitizer
    allows `/` for the folder.
  - **Several photos per location.** `loc.photos` is an ordered list of
    `{ slot, year }` — the **first is the main photo** (tiles, print, the
    brief's big photo), and **each photo has its own caption year**. Slot 1
    lives at `photoBase(...)`, slot n>1 at `photoBase(...) + '.' + n`. A
    location without `photos` is the legacy single photo (slot 1 +
    `loc.photoYear`). **Always read through the helpers** next to `photoBase`:
    `locPhotos(loc)`, `slotBase(mk, id, slot)`, `mainBase(mk, loc)`,
    `mainYear(loc)`, `photoCaption(loc, monthName, year)`. In `App`:
    `setPhotoYear(locId, slot, y)`, `addPhotoSlot` (after an extra uploads),
    `removePhotoSlot` (after a removal; removing the main promotes the next),
    `makeMainPhoto` (reorder). The brief shows a "More photos" strip of
    compact `LocationPhoto`s (year + ↑ make-main each) plus an empty "+" slot
    for the next number; hero slideshows cycle every photo, extras included.
    Delete/move a location handles every slot. `LocationPhoto.onChange` is
    called with `'uploaded'` or `'removed'`.
  - **Focus points.** `data[0].photoFocus = { '<storage base>': [fx, fy] }`
    (fractions of the image; unset = centre) says what a cropped photo keeps.
    `FocusCtx` carries `{ map, set }` (set = `setPhotoFocus` for the owner,
    null for visitors) and `focusStyle(map, base)` gives the `object-position`
    — applied by `LocationPhoto`, `LocThumb`, `PhotoSlideshow` and
    `PrintMonthPhoto`. `LocationPhoto` has a ⌖ button (owner, next to ×):
    focus mode shows the whole photo (`object-fit: contain`), a click sets
    the point, "Centre" clears it. Moving a location renames the keys.
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
  - **Sync safety (the "Cloud sync" block in `App`):** `loadCloudData` resolves
    to `{status:'ok'|'empty'|'error'}` — an *error* (unreachable or unreadable)
    is never treated as empty. `ensureUnlocked` refuses edits until a load has
    settled as ok/empty, with a banner ("editing paused") while offline and
    retries every 15 s. Each device keeps `cloudStamp` (the `savedAt` of the
    copy it is in step with); `saveCloudData(data, key, expectSavedAt)` checks
    the cloud still carries that stamp before writing (and the v2 Worker
    re-checks via `x-if-saved-at` → 409). On conflict the newer cloud copy is
    adopted and the owner is told their last change was not kept. The copy is
    re-fetched on tab focus/visibility, `online`, and a 5-minute poll (skipped
    while local edits are pending or a field is being typed in). Saves are
    serialised (`pushingRef`/`queuedRef`); a failed save shows a banner,
    retries every 10 s, warns on tab close (`beforeunload`), and sets
    `localStorage['calendar:dirty']` so the next visit asks keep-or-discard.
    `syncedRef` marks the data object that came from the cloud so the save
    effect never echoes it back. The old per-year `photo-meta.json` is
    superseded (`loadMeta`/`saveMeta` remain in `Storage` but are unused).
  - **Editing is password-gated.** `ensureUnlocked(retry)` guards `mutateData`
    (and `addLocation`/`deleteLocation`/`moveLocation` early): with no password
    stored it opens the **in-app dialog** (`askText`, `renderDialog` — masked
    input with an eye toggle; also used for the new-location and new-event-type
    names; never a browser `prompt()`; `askConfirm(opts)` is the same dialog
    as a yes/no with no input — `danger` colours it red — used for photo
    removal (via the `ConfirmCtx` context in `LocationPhoto`), location
    deletion and the keep-or-discard question; never `window.confirm()`),
    returns `false`, and runs `retry` once
    the password is entered (so the attempted action completes by itself).
    Enter it once (stored in `calendar:uploadKey`) and you're unlocked on that
    device forever. A 401 on save re-locks. NB `localStorage` is **per-origin**,
    so moving to the custom domain reset every device's unlock (expected).
  - **View-only mode.** `editMode` state in `App` (starts true only when the
    device holds the password) is published through the `EditCtx` React context;
    `Editable`, `KitField` and `LocationPhoto` read it and render plain
    text/photo (no placeholders, no upload) when off. Tiles drop the tick/star/
    drag controls (a static ✓ shows done), the brief hides its footer, region
    toggle and empty fields, add-location/add-event buttons and the map's
    "Mark as visited" hide, and event chips stop being clickable. The
    "✎ Unlock editing / Editing on · hide controls" link (`editSwitch()`,
    shown by `editToggle()` beside the night-mode link; in
    the home/map nav column, and on month pages in its own row between the
    header rule and the hero) prompts for the password or just hides controls
    (keeps the password) so the owner can preview the visitor view.
  - **Photo index.** `Storage.loadPhotoIndex()` calls the Worker's `GET /list`
    (every key under `photos/`) once; `App` keeps it as `photoIndex` (a Set;
    `undefined` = loading, `null` = Worker without `/list` → components fall
    back to probing thumbnails). Refreshed on cloud adoption and before each
    `bumpImg` epoch bump. `PhotoSlideshow`, `LocThumb`, `LocationPhoto` and
    `PrintMonthPhoto` all take it as a prop. The slideshow only adopts a key
    list that actually changed, so index refreshes don't restart it.

## Key pieces in `index.html`

- **`Storage`** — the single seam to persistence. `photoUrl`, `peekUploadKey` /
  `setUploadKey` / `clearUploadKey` (never prompts), `saveImage`/`removeImage`,
  `savePhotoVariants`/`removePhotoVariants` (resize + upload/delete both sizes),
  `loadCloudData`/`saveCloudData` (the shared `calendar-data.json`),
  `loadData`/`saveData` (localStorage cache), `loadPhotoIndex` (`GET /list`),
  `loadBackups` (`GET /backups` → `[{key, uploaded, size}]` newest first, or
  null) / `loadBackup(key)` (one backup's `{version, savedAt, data}`).
- **`resizeImage(file, maxEdge, quality)`** — canvas downscale to a JPEG blob
  (respects EXIF orientation).
- **`readPhotoInfo(file)`** (+ `parseExifTiff`) — reads a JPEG's EXIF
  (first 256 KB): `DateTimeOriginal` → `{ year:'YY', date }` and the GPS IFD →
  `{ lat, lng }`; null when there's nothing. `LocationPhoto.uploadFile` runs it
  alongside the upload and calls `onChange('uploaded', info)`; `App`'s
  `applyPhotoInfo(locId, slot, info)` fills the slot's caption year **only if
  empty** and the location's coordinates (+ region) **only if it has none**
  (`coordsOf` null — i.e. owner-added spots), then shows a `showNotice` toast
  ("From the photo: the year '24 and the map coordinates filled in."). HEIC
  and PNG give nothing (not JPEG). Test harness: scratchpad `exif_test.js`
  against Pillow-made JPEGs (`make_exif_jpegs.py`).
- **Deep links.** The hash mirrors the view: `#/<year>` home,
  `#/<year>/<monKey>[/<locId>]` (brief open), `#/<year>/map`,
  `#/<year>/weather[/<locId>]`, `#/<year>/print` (owner; turns edit mode on
  if the password is held, else falls back to home). In `App`: `routeHash()`
  (state → hash), `routeTitle()` (→ `document.title`), `applyHash(hash)`
  (hash → `setViewYear` + the `goTo*` calls; an unknown location id is kept in
  `selectedLoc` so the brief opens once the cloud copy brings the location).
  A mount effect applies the arrival hash and listens to `hashchange` (back/
  forward); a state effect `pushState`s when the hash differs (first run only
  `replaceState`s a missing hash — no extra history entry on arrival).
- **Search.** `query`/`searchHits` (memo: name prefix > name > tag/where/idea/
  when/kit/notes/links; max 8) and `searchBox()` — a nav-button-styled
  `<input type=search>` ("Find a location") with a dropdown listbox (↑ ↓
  Enter, Escape clears, blur closes after 150 ms); a hit calls
  `goToMonth(i, loc.id)`. It sits at the end of `homeTools()` and, on month
  pages, left of the edit switch in the row under the header rule. `/`
  anywhere outside a field focuses it.
- **Backups in the app (owner).** `⟲ Backups` (`backupsLink()`, beside the
  edit switch on the home page) opens `renderBackups()` (zIndex 60, under the
  dialog): the Worker's list with en-GB dates (`backupDate` from `uploaded`)
  and sizes, "Download the current calendar" (`downloadCurrent`), and per
  backup Download (`downloadBackup`) / Restore (`restoreBackup`: refuses
  while the cloud is unsettled or local edits are pending, `askConfirm`
  danger, then `Storage.saveCloudData(snap.data, key, cloudStamp.current)` —
  the normal stamp check, so a 409/conflict adopts the newer copy and says so
  — then `adoptCloud({data, savedAt})` + toast). The Worker backs up the
  overwritten copy as usual, so a restore is itself undoable.
- **`showNotice(text)`** — the bottom toast (`notice` state, 5 s), used by
  the EXIF fill and restore.
- **`keyActivate(handler)`** — Enter/Space keydown handler for the `role=button`
  divs/spans (month rows, tiles, lockups, agenda rows…); icon-only buttons carry
  `title` + `aria-label`; a `:focus-visible` ring is in the CSS.
- **`coordsOf(loc)` / `mapLinks(coords, name)`** — Google/Apple Maps deep links
  shown under the brief's coordinates and on the map card. **Parking**
  (`parkingOf(loc)` / `parkingText(loc)`, stored as `loc.parkLat`/`parkLng`,
  set by `setLocParking` in `App`) is a second coordinate box in the brief's
  right column under Kit, with the same map links; it isn't on the map page.
- **`MiniMap`** — a small Leaflet map (1.9.4 + CSS lazy-loaded from jsDelivr
  via `ensureScript`/`ensureStyle`, OpenStreetMap tiles) under the brief's
  coordinates: green dot = location, "P" = parking, fitted to both. Scroll-wheel
  zoom off; wrapper has `zIndex:0` so Leaflet's controls stay under the app's
  dialogs. Renders nothing without coordinates or if the CDN fails. Takes
  `rays` (`[{ az, color, dash, label }]`, built in `App` as `skyRays` from
  `sky`): polylines from the spot (`destPoint`), sunrise gold `#D9A441` /
  sunset `#C8551F` solid, moonrise/moonset slate dashed, sized to 30 % of
  the first view's diagonal and redrawn in place (`rayLayer`) when the day
  changes — the map is only rebuilt when coordinates/parking change. A small
  legend (swatches + the day) sits under the map.
- **The brief's day + Sky row.** `skyPick` state (reset on location/month/
  year change) → `skyDay`: the location's photo-op day in this month/year
  (`selOp`, `skyFromOp`) else the 15th; `stepSkyDay(±1)` wraps within the
  month. The **Light** row now computes `lightAt(..., skyDay)` and carries the
  `‹ Sat 15 Nov 2026 ›` stepper (`skyDayLabel`, en-GB). The **Sky** row
  (under Light, needs coordinates) shows `sky = skyAt(lat, lng, year, mi,
  skyDay)`: Sun ↑/↓ with 16-point compass directions, Moon ↑/↓ + direction +
  `illum`% + `phase` (`moonPhaseName`), and the **Milky Way** line: `core` =
  the night's longest stretch with the Galactic Centre (`GALACTIC_CENTRE`,
  precessed by `ofDate`) above the horizon in astronomical darkness (Sun <
  −18°) — "Core up 22:55–00:30 (1.6 h), peaking 7° in the SSW · moon down /
  moon-free a–b / moon up throughout (x% lit)"; no window → "no full darkness
  tonight" (`dark` false) or "core below the horizon while it's dark". The
  footnote lists the **core season** (`coreSeason` memo: months whose 15th
  has a window, compressed to ranges, e.g. "Feb–Apr, Aug–Sep" for the Peak
  District). Times follow `lightAt`'s zone rule (UK civil time, else UTC).
- **Sky maths** (after `moonIllumination`): `gmstDeg`, `obliquityDeg`,
  `eclToEq`, `altAz(ra, dec, jd, lat, lng)` (geometric alt, az from north),
  `sunEquatorial`, `moonPosition(jd)` (Meeus ch. 47, tables 47.A/B in full as
  `MOON_LR`/`MOON_B`; geocentric), `riseSetScan(startJd, lat, lng, posFn,
  h0Fn)` (10-min steps + bisection; `MOON_H0` = 0.7275π − 0°34′, `SUN_H0` =
  −0.8333°), `compass16`, `moonPhaseName`, `skyAt`. Validated against PyEphem
  (28 site/date cases, rise/set within 0.3 min and 0.1° az; scratchpad
  `ephem_ref.py` → `ephem_ref.json`, `astro2_test.js`, run through
  `load_app.js`, which evaluates the inline script in a node `vm` with React/
  DOM stubs and returns every top-level function — reuse it for unit tests).
- **Shot lists.** `loc.shots = [{ id, text, done }]` — the brief's **Shots**
  row (after When; visitors see it only when non-empty) via the reusable
  **`Checklist`** component (`items`, `onToggle/onAdd/onRemove`; read-only
  without them; tick box, strike-through, × on hover, add field saving on
  Enter/blur). `App`: `addShot/toggleShot/removeShot` (always a fresh array
  — `mutateData` only shallow-copies locations). `newId(prefix)` makes ids.
- **Trips** (`data[0].trips = [{ id, name, start:'YYYY-MM-DD', end, locIds,
  notes, packing:[{id,text,done}] }]`): the **Trips page** (`tripsView` +
  `tripOpen`, route `#/<year>/trips[/<id>]`, "▲ Trips" button on home/
  month/weather navs, `renderTripsPage` in `App`): cards (upcoming, then
  "Past trips"), each a header (name — Editable for the owner — dates via
  `fmtTripDates`, nights, a now/tomorrow/in-N-days/past badge, summary
  counts) that expands to Dates (two `<input type=date>`, `setTripDates`
  keeps end ≥ start), Locations (chips with the first day's sunrise/sunset,
  open the brief; add via a month-grouped `<select>`), Shots (roll-up of the
  locations' shot lists, editable), Packing (`Checklist` + "kit from these
  locations" = the Kit chips not already listed, "untick all", "reset to the
  usual list"), Notes (`NotesField`), Delete. New trips start from the
  **usual packing list** (`data[0].packingTemplate`, one per line; the
  editable block at the page foot; `DEFAULT_PACKING` until set). Trips also
  appear everywhere events do: `tripEventsFor(trips, monthIdx, year)` makes
  `kind:'trip'` events (`id 'trip:<id>'`, `tripId`, clipped per month) which
  `allEventsFor(m2, i, y)` appends to `eventsFor` for the month grid,
  Coming up, the .ics and the print page (a "Trip" switch). They're never
  stored. A trip bar's label names the trip's locations ("Peaks weekend ·
  Mam Tor, Ham Wall" — `tripEventsFor`'s 4th arg `data`). **Trip pop-up:**
  `chipClick(ev)`, `openEventEditor`, the brief's Trips pills and Coming-up
  cards all open `renderTripPeek()` (`tripPeek` state, zIndex 60, Escape
  closes) — dates, the `tripWhen` badge, location chips (→ the brief),
  tickable shots, packing progress bar + the unpacked items, notes, and an
  "Edit on the Trips page →" button — so the reader stays on the page. The
  editor's type list skips `'trip'`. The brief has a **Trips** row (pills →
  pop-up; owner "+ add to a trip…" select). `EVENT_STYLE.trip` is the
  slate-blue ▲. The locations `<select>` on a card reads "Choose a
  location…" and ends with a "New location in…" group (`new:<monthIdx>` →
  `addNewLocToTrip`: `askText` name → `createLocation(idx, name)` — the
  shared half of `addLocation` — then `addTripLoc`). An undated card tells
  the owner to set dates to put it on the calendar. The usual packing list
  is hidden behind a quiet "✎ edit the usual packing list" link
  (`tplEditing`) at the page foot.
- **Tides** (coastal spots; `loc.tidal = true`, the owner's "+ show tides
  here" / "hide tides" in the brief's **Tides** row after Sky): `TideRow`
  calls `loadTides(lat, lng)` (cached per place/session) → Open-Meteo marine
  `hourly=sea_level_height_msl` (`TIDE_API`; `past_days` 60, then 30, then
  none if refused; `forecast_days=8`, UTC) and fits a harmonic model
  (`fitTides`: least squares, `solveLinear`; constituents by span —
  M2 S2 N2 K1 O1 Q1 M4 MS4 ≥ 27 d, M2 S2 K1 O1 M4 MS4 ≥ 14.5 d, else
  M2 K1 O1 M4). `tidesForDay(tides, y, m, d, offH, refs)`: a day inside the
  fetched span uses the series (`sampleExtrema`, parabola through hourly
  samples; label "forecast (tide + surge)"), any other day the model
  (`tideExtrema` at 6-min steps; label "predicted … ≈ ±20 min"); plus the
  level/trend at sunrise and sunset and an "Official tables ↗" link
  (EasyTide for UK coords, tide-forecast.com elsewhere). Heights are v. mean
  sea level, not chart datum. No sea-level cell (inland) → `status:'none'`
  message; a fetch error isn't cached. The response's own `latitude`/
  `longitude` (the sea cell that answered) is kept as `cell` and the footnote
  says "sea cell N km from the spot" when ≥ 0.5 km — Open-Meteo picks its
  nearest cell with data, so coordinates a little inland still work; near
  estuaries/headlands it may be the wrong side. Synthetic-tide test:
  scratchpad `tide_test.js`.
- **Places, area & country, visits, photo tags** (Batch 4 data):
  `placeGroups(data)` unions locations with the same normalised name
  (`normPlaceKey`) or coordinates within 800 m (`distKm`) into places →
  `{ groups, byId }` (`places` memo in `App`): the gallery's Place grouping
  and the brief's **Same spot** row (chips to the other months' entries + "all
  photos of this place →"). `loc.area` / `loc.country` — the brief's **Area**
  row (two Editables, after Where; shown to visitors when set) — typed, or
  filled in by the Gallery page's owner button "⌖ fill in areas & countries"
  (`fillAreas` → `lookupArea(lat, lng)` = Nominatim reverse geocode, zoom 10,
  `county || state_district || region || state …` + `country`, one call per
  location 1.1 s apart with a `geocoding {done,total}` progress; only
  locations lacking a value; typed values are never overwritten).
  `loc.visits = [{ id, date:'YYYY-MM-DD', note }]` — the brief's **Visits**
  row (after Shots; list newest first; owner form: date (`visitDate`, default
  today) + note → `addVisit`, × → `removeVisit`). Photo tags live on the
  photo entry (`loc.photos[i].tags`, `setPhotoTags(locId, slot, tags)`
  materialises a legacy single photo; `parseTags` splits a comma line, dedupes,
  max 12). `togglePrintStarIn(i, locId)` stars from outside the month page.
- **Gallery page** (`galleryView`, tabs `galleryTab` 'photos' | 'review',
  route `#/<year>/gallery[/review]`, "▦ Gallery" on home/month/weather/trips
  navs, `renderGalleryPage` in `App`): `galleryItems` memo = one entry per
  photo slot present in the photo index (`{ key, base, i, month, loc, slot,
  year, tags, starred, caption }`). Photos tab: **Group by** (`galleryGroup`,
  **opens on country — the owner's choice**; locations without one fall
  under "No country yet", last:
  place / area / country / month / year taken / subject (= `loc.tag`) / tag /
  trip / none — tag and trip can file a photo under several groups), filters
  (`galleryF`: region all/uk/int, ★ starred = the month's print pick,
  ✓ visited = `loc.done`, year taken, tag), **Sort** (`gallerySort`: calendar
  order / year taken / name), a per-group count, and 3:2 tiles (thumb +
  `focusStyle`, ★ badge, name, Mon 'YY, area · tags). **Year in review** tab
  (for `viewYear`, with `yearRow()`): stat tiles (visits logged, photos dated
  that year, trips, places, areas, countries), a 12-month bar strip (visits
  green, photos gold; click → month), Most visited (by place), Trips (→
  pop-up), the Visit log (→ brief) and the year's photos. **Lightbox**
  (`lightbox = { items, idx }`, `openLightbox(list, it)`, `renderLightbox`,
  zIndex 60): hero image, ‹ › / arrow keys / Escape (an effect on `lightbox`),
  caption + meta (month 'YY · area, country · subject), counter, "Open brief
  →", owner: a comma-separated **Tags** input (saves on blur/Enter) and the
  **★ Star** toggle; reads the live item from `galleryItems` so edits show
  at once. The image box has a **fixed height** (72vh / 58vh phone) so the
  bar never jumps while the next photo loads, and the neighbours are
  preloaded (an effect on `lightbox.idx`). The round **i** button (or the
  `i` key) toggles `lbBare` — bar hidden, box 88vh / 84vh — remembered per
  device in `localStorage['calendar:lbBare']`.
- **`LinksField` / `parseLinks`** — per-location links (`loc.links`, text, one
  per line, `Label | url` or a bare address) shown as chips in a "Links" row
  under Parking; owner edits via an "edit" button → textarea. **`NotesField`**
  (`loc.notes`, free text, pre-wrap; click → textarea) is the "Notes" row
  under Links.
- **Components:** `HeroCaption` (read-only caption overlay), `PhotoSlideshow`
  (hero slideshows — random order, 15s, skip (») + pause buttons, cache-busts
  via `epoch`),
  `LocThumb` (tile thumbnail), `LocationPhoto` (the upload control),
  `KitField` (pill chips that flip to an editable line), `Editable` (inline
  click-to-edit text), `MapView`, and `App`.
- **Print view** (`renderPrintPage`, "Print" button on the home nav —
  **owner only**: the button and the view are gated on `editMode`, and an
  effect leaves the view when editing goes off): an **A4-landscape** wall
  calendar for the selected year, page order: cover photo → per month a
  full-bleed photo page then a grid page → three photo-index pages (4 month
  photos each as **3:2 tiles**, two across at 130mm wide — the most two rows
  plus a small month label fit in the height — no caption, block centred;
  **four per page is the owner's decision**, Nov 2026, over six)
  → back-cover photo. `.print-sheet` CSS keeps sheets at
  281×193mm (aspect-ratio preview on screen; exact one-page height in
  `@media print`; `.pad` adds the grid page's padding; `.print-label` is the
  on-screen-only page caption). Cover/back photos are `LocationPhoto` slots
  (`full: true` → print-size image) on R2 keys `photos/print-cover` /
  `photos/print-back`; both carry `coverBand()` — the darkened foot band with
  the lockup left and the year + `@IG_HANDLE` right. `PrintMonthPhoto`
  (variant `page`, or `tile`) shows
  the month's **starred** location (`month.printLoc`, ★ on the month-page
  tiles) if it has a photo, else the first with one, using the `-print` copy
  when it exists. The photo page is clean (no overlay): the **caption sits
  top-right of the grid page** (`printPick(m2)` resolves the same pick from
  the photo index; shown when `printPrefs.captions`), above sunrise/sunset
  at Hindhead (`monthLight`, no place name) and the `daylightNote`. Grid pages carry the light lockup
  (`assets/photoplan-lockup-light.svg`) centred in the header row and
  `@IG_HANDLE` (with `igGlyph`) bottom-right under the grid. What prints:
  per-event `noPrint` (checkbox in the event editor) **and**
  `data[0].printPrefs` = `{ hideKinds:[kind…], captions:bool }` — the
  "Print these event types" / "Photo captions" chips on the print page,
  cloud-synced. **UK bank holidays** (`ukBankHolidays(year)` /
  `holidayEvents(year, monthIdx)`, computed: Easter via Meeus, Monday
  holidays, Christmas/Boxing substitutes; kind `holiday`, "Bank holidays"
  switch) and **named days** (`namedDays(year)` / `namedDayEvents`: saints'
  days, Shrove Tuesday / Mothering Sunday / Easter Sunday from Easter,
  Father's Day and Remembrance Sunday by weekday, St Dwynwen's Day (25 Jan;
  no Burns Night — owner's choice), Valentine's, Halloween, Bonfire Night,
  Accounting Day (10 Nov), Remembrance Day, Christmas Eve/Day, Boxing Day,
  New Year's Eve; kind `named`, "Named days" switch) are print-only, always
  offered, merged per page by `printDayNames(year, i, holidays, named)` —
  a name beats a coinciding bank holiday and substitutes become plain "Bank
  holiday" — and drawn as small corner text beside the date, not bars (so
  neither is in the page key). The print grid uses `buildWeeks(..., { top:30, step:24 })`
  geometry with 21px bars and a per-page type key.
- **Coming up** (home page, under the hero): `upcoming` memo — the next 7
  events within `UPCOMING_DAYS` (120) of *today* (real date, this year and
  next, via `eventsFor`), ongoing windows first as "Now · until …"; cards open
  the month (and the location for a photo op) after switching `viewYear`.
- **Calendar file**: `downloadIcs()` (home nav "⤓ Calendar file", owner only)
  writes the selected year's events as all-day VEVENTs (folded lines, GEO +
  LOCATION on photo ops) to `photoplan-<year>.ics` via a Blob download.
- **Weather page** (`WeatherView`, "☁ Weather" button on the home and month
  nav rows for everyone; `goToWeather(locId)` also from the brief's Light row
  "Forecast & conditions →"): **one Location `<select>`** (grouped by month,
  only locations with coordinates) and, for the owner, a green **"Set
  default"** button beside it — the owner asked for this in place of the old
  Default + View pair. It saves the spot on show as
  `data[0].weatherDefault` (cloud-synced; the page opens on it unless
  arriving from a brief, else on the current month's first spot); on the
  default itself the button reads "✓ Default" (outlined; a click clears it)
  and the list marks it "· default" for everyone. `pickedRef`: until the
  reader picks a spot, the view follows the saved default, so a first visit
  straight onto the page still gets it once the calendar loads. Then a
  seven-day outlook from
  **Open-Meteo** (`api.open-meteo.com`,
  `timezone=auto`; `models=ukmo_seamless` tried first for UK coords, then the
  default model; cached per coordinates for the session) summarised per day
  as cloud at the sunrise/sunset hours and 01:00, min visibility, rain chance,
  wind/gusts, temperatures, moon illumination (`moonIllumination`) and a
  `lightVerdict` line; the live NOAA planetary Kp with an aurora reading;
  deep links (Met Office via `geohash(lat,lng,9)`, Windy, Clear Outside,
  meteoblue, light-pollution map, MWIS/Met Office mountain, tide times,
  AuroraWatch); and the `WEATHER_GUIDE` cards (conditions / settings / tips
  per kind of shoot — editorial, edit the array). All fetches fail quietly.
  **Condition flags** (the owner chose these over a single "best evening"
  badge): each day card ends with a "Promising for" row of chips, one per
  guide card whose conditions that day meets ("≋ Mist & inversions · dawn";
  the chip's `title` says why, a click scrolls to the card, `guideId`), and
  each flagged guide card lists its days ("Promising at Mam Tor: Thu 19 Nov
  (sunset)", `flaggedDays`). A kind that suits no day never appears. Pure,
  module-level pieces: `forecastDays(H, D)` (the day summaries + `cx`, the
  readings at the sunrise/sunset hours, a dawn window −2..+1 h, 09–16 and
  22:00–03:00), `conditionFlags(c)` (the rules — thresholds live here, one
  block per guide title; rules that lack data stay off; "Coast & long
  exposure" has no rule), `auroraKpNeeded(lat, lng)` (dipole geomagnetic
  latitude → Kp: 7 southern England, 5 central Scotland, 1 Abisko) and
  `parseKpForecast` (NOAA `noaa-planetary-k-index-forecast.json`, table or
  object rows). `WeatherView` adds per day: the calendar's nature/season
  windows, meteor and eclipse events on that date (`eventsFor`), `skyAt`
  (core window), `nightDark` (Sun below −9° at local midnight) and the
  night's highest predicted Kp. The request asks first for the extra
  variables (`FC_HOURLY_EXTRA`: mid/high cloud, humidity, dew point;
  `snowfall_sum`) and `past_days=1` (yesterday's rain, for "the day after";
  `json._past` days are sliced off the display), falling back to the old
  request if refused. Tests: scratch `flags_test.js` (rules), `weather.js`
  (page, faked Open-Meteo + NOAA) and `weather_default.js` (picker + default).
- **Views:** `App` holds `yearView` / `monthIdx` / `mapView` / `weatherView`
  / `tripsView` / `galleryView`. Navigation:
  `goToYear`, `goToMonth(idx, locId)`, `goToMap`, `goToTrips(id)`,
  `goToGallery(tab)`, `changeMonth` (all mirrored
  in the URL hash — see Deep links); the shared
  `navRow(showYearBtn)` renders the top buttons. Month pages: `[month picker]
  ‹ › | Map Weather | ← Home`, with the owner's "+ Add location" (`addLocBtn`)
  at the foot of the nav column and `[search] … [edit switch]` in the row
  under the rule; home: the tools `Map Weather (⎙ Calendar =
  print view, ⤓ Export = .ics — owner) [search]` sit **under the intro on the
  left** (`homeTools()`), the right column holds `‹ January →`, the year,
  legend and the edit switch (+ `⟲ Backups` for the owner). `monthPicker()` and `yearPicker(size)` are native
  `<select>`s styled in place (`appearance: none` + a chevron span) — the year is the quiet dotted-underline picker
  beside the month name (`'title'`), and `yearRow()` (label + `'small'`
  picker) on the home page. The year chips are gone.

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
- Hero captions are **auto** (`Location · Mon 'YY`, month abbreviated, year
  shown with a leading apostrophe); only the **year** is user-entered (raw,
  e.g. `24`), per photo, and it's cloud-synced so viewers see it.
- **Visited is the `done` tick.** Coordinates come from the built-in table and
  are **per-location editable**; the old **postcode** field was removed.
- The **2026 cover** slideshow cycles *all* location photos; each **month hero**
  cycles that month's location photos.
- Deleting a photo (×) **and** deleting a location both remove the R2 images —
  both ask for confirmation first (irreversible).
- Locations can be **moved between months** ("Move to…" select in the brief's
  footer): every photo (all sizes, all slots) is copied to the new month's key
  first, the old objects deleted only after a copy lands, then the location
  object moves in the data. Blocked if the target month already has that
  location id.
- The **map already has touch gestures** (pinch-to-zoom + one/two-finger pan via
  pointer events on the SVG, `touchAction:'none'`) — don't rebuild them.
- The **home page** has an Instagram link (`@llandscapist` = `IG_HANDLE`,
  `.ig-link`) beside the header label; it's home-page only on screen, and the
  handle also prints on every grid page of the printable calendar.
- **Window icons.** Nature/season events show as a small inline-SVG picture
  in the corner of each day they cover (`EVENT_ICONS` catalogue, `EventIcon`
  component, accent-coloured; **icon only, no label in the grid** — the
  legend under the grid and the print key name each window with its dates)
  instead of a bar. Bank holidays (print) use the same corner slot as small
  text (`days[i].icons` items carry `icon` and/or `text`). `eventIconKey(ev)`: explicit `ev.icon` (`'none'` = bar),
  else a title keyword match (`ICON_KEYWORDS`/`defaultIconKey`) for
  nature/season kinds, else a bar. The editor's "Shown as" row (nature,
  season, custom kinds) offers Auto / Bar / each icon; only an explicit
  choice is stored. `buildWeeks` keeps icon events out of the bar lanes and
  puts them on `days[i].icons` as `{ ev, icon, first, accent }`.
- **Custom event types** live on the events themselves (`kind:'x-<slug>'` plus
  `kindLabel` and a `kindColor` palette key from `CUSTOM_PALETTES`), so they sync
  through the shared data with no schema change; the editor's type list derives
  them from the data (`styleOf` resolves any event's colours). A type vanishes
  when no event uses it. "＋ Add event" / "Schedule photo op" only open a
  **draft** — nothing is written to the data until "Save event" is clicked.
- **(Live site; in the preview the watermark above supersedes this.)**
  **Photo credit is an overlay, off by default.** `data[0].photoCredit`
  (owner switch "@llandscapist on photos" on the Gallery controls, cloud-
  synced so visitors see it) → `FocusCtx.credit` → `PhotoCredit` (`.photo-
  credit`): the handle top-right on the hero slideshows and bottom-right of
  the photo in the lightbox (the image is shrink-wrapped in a relative box
  so the credit sits in the photo's own corner). Not on tiles, the brief's
  photos or print; nothing is burnt into the stored images.
- **Night mode is a per-device choice** (not synced, not following the OS
  setting) and **the style refresh happens in a design session first** —
  don't restyle the app speculatively; change token values or components
  only on the owner's say-so, then regenerate `design/`.

## Working on it

- **Live at `https://photoplan.studio`** (custom domain). Set up via a `CNAME`
  file (`photoplan.studio`) + Cloudflare DNS (four A records to GitHub's
  `185.199.108–111.153`, **DNS-only/grey**, plus a `www` CNAME) + GitHub Pages
  "Enforce HTTPS". The old `taledd-dev.github.io/photo-calendar` redirects here.
- **Deploy = publish to `main`.** GitHub Pages serves `main`. Development happens
  on a feature branch, then fast-forward `main`. (Pages can lag a minute or two
  after a push; cache-bust with `?v=something` when testing.)
- **The Worker is deployed manually** via the Cloudflare dashboard (paste
  `worker/photo-storage-worker.js`, bind R2 bucket `photo-calendar` as `BUCKET`,
  set the `UPLOAD_PASSWORD` secret). `wrangler.toml` exists for reference.
  **Worker v2** (header `x-photoplan-worker: 2`) adds the `x-if-saved-at`
  optimistic lock on `calendar-data.json` and **automatic backups**: before each
  overwrite the previous copy goes to `backups/calendar-data-<UTC time>.json`
  (one per 15-min window, newest 60 kept); `GET /backups` lists them, and
  `GET /list` returns every photo key (the site's photo index). The site only
  sends the lock header once it has seen the v2 response header, so it works
  with the old Worker too (client-side check only, no backups, thumbnail
  probing) until the new file is pasted in. **Restore** = the in-app Backups
  list (home page, owner) — or by hand: download a backup from the R2
  dashboard and upload it as `calendar-data.json`. The **print-
  copy lock** (GET of `-print` keys needs the password) is in the same file;
  the site works either way, since it always sends the header for them.
- **Always syntax-check before publishing** — extract the inline script and run
  `node --check`:
  ```
  python3 - <<'PY'
  import re; h=open('index.html',encoding='utf-8').read()
  open('/tmp/app.js','w').write(max(re.findall(r'<script>(.*?)</script>',h,flags=re.S),key=len))
  PY
  node --check /tmp/app.js
  ```
- **The app can be run headless here** now that React is self-hosted: serve
  the folder (`python3 -m http.server 8123 --bind 127.0.0.1`) and drive it
  with the pre-installed Playwright, aborting every outside host with
  `context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort())` (the cloud
  load then settles as "offline" and the UI still renders) — or answer the
  Worker's URLs from the route handler to fake the cloud (the scratchpad
  `smoke.js` / `restore.js` / `trips.js` / `gallery.js` / `credit.js` scripts
  do both: routes, search, backups modal, restore + conflict, an EXIF upload,
  shots/trips/tides with a faked marine API, visits/gallery/lightbox/review
  with a faked photo index + Nominatim, the photo credit + lightbox geometry
  for wide/tall/panorama images + the night switch; `theme_shots.js <dir>
  [light|night]` takes 29 deterministic screenshots of every page/state and
  `imgdiff.py A B` compares two such folders pixel by pixel — the way to
  prove a refactor changed nothing, or to review night mode). d3/Google Fonts stay unreachable (the map body
  doesn't render); Leaflet can be served from a local `npm pack leaflet@1.9.4`
  copy via the route handler (see `sky.js`) so the mini map does. Setting
  `localStorage['calendar:uploadKey']` makes the page the owner's. NB a
  `page.goto` that only changes the hash is a same-document navigation —
  go via `about:blank` for a real reload. And the inline `<script>` sits in
  `<body>`, so `body.textContent` contains the app's **source** — a text
  check or wait against `body` can match a string literal in the code and
  pass (or stop waiting) before anything is drawn; read `.app-shell` or use
  a selector instead. Still have the owner test live.

## Next up: mobile / phone layout pass (not started)

The app was built desktop-first. Goal: make it read well on phones **without a
separate mobile site** (responsive, one codebase). Key points for whoever picks
this up:

- **Inline styles can't use `@media`.** Use a JS breakpoint — e.g. a
  `useIsMobile()` hook around `window.matchMedia('(max-width: 640px)')` that
  re-renders on change — then apply mobile style overrides conditionally. Scope
  changes to the small breakpoint so **desktop is untouched**.
- **Likely pain points:** the month **day-grid** (7 columns with absolutely-
  positioned event bars) is the hardest on a narrow screen — may need to scroll
  sideways or simplify; then location tiles, the detail panel two-column layout,
  nav-row wrapping, page margins/padding, and font sizes.
- **The map is already touch-optimised** (pinch/pan) — leave it.
- **Testing is iterative:** this environment can't render a phone, so make a
  change, publish, and have the owner check on their phone and report back.
  Ask the owner up front which single thing annoys them most and start there.
