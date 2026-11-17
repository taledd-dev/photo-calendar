# Photoplan — design reference

This folder is the hand-over for design work. It reproduces what
photoplan.studio looks like **today**, without the app, so a design session
can start from the real thing and iterate.

Everything here except this file and `build-reference.js` is generated from
`../index.html`. Don't edit the generated files by hand — re-run the generator.

## What's here

| File | What it is |
| --- | --- |
| `style-reference.html` | **Start here.** One static page: the design principles, every colour token as a day/night swatch pair, the type system, and the app's own components (header and nav, tiles, the location brief, the calendar grid, trip card, gallery, weather day cards, the dialogs). The markup and inline styles are the app's own, serialised from the running site. A switch in the corner flips night mode. |
| `tokens.css` | The colour tokens on their own — `:root` (day) and `:root[data-theme="night"]` — as CSS custom properties with a note on what each is used for. |
| `pages/*.html` | Whole-page static snapshots: `home`, `month` (brief open, owner view), `month-visitor` (view-only), `month-phone` (390px wide), `trips`, `gallery`, `gallery-review`, `weather`, `map`. |
| `build-reference.js` | The generator. |

Each HTML file stands alone: the app's stylesheet, the logo and the wordmark
font are embedded, and the photographs are drawn stand-ins. The only outside
request is Google Fonts (Zilla Slab, Spectral, IBM Plex Mono). The data shown
is the app's built-in sample content plus invented examples — nothing from the
real calendar.

## Giving it to Claude Design

1. Upload `style-reference.html` and `tokens.css`. Add one or two files from
   `pages/` if the session is about a particular page (the page snapshots are
   the better guide to layout; the reference page is the better guide to the
   parts).
2. Ask it to recreate the current state first, before changing anything —
   for example:

   > These files are the current design of Photoplan, a photography planning
   > calendar. `style-reference.html` shows the tokens, type and components
   > exactly as they are on the live site; `tokens.css` is the palette for day
   > and night. Rebuild this look faithfully as your starting point — same
   > tokens, fonts, spacing and component shapes — and show it to me before
   > proposing changes. Then we'll iterate.

3. Iterate there. Changes that are only **colour** can come back as a new set
   of token values; anything structural comes back as a description or mock-up
   to be built into `index.html`.

## The design language in brief

- **Feel:** a printed field notebook. Warm cream paper on a dotted, slightly
  darker page; near-black warm ink; olive green for actions and the UK,
  terracotta for International and warnings; gold and slate as supporting
  accents.
- **Type:** Zilla Slab for names and titles, Spectral for prose, IBM Plex Mono
  in small tracked capitals for labels, buttons and data. Figtree only for the
  wordmark.
- **Shape:** square corners, 1px hairlines, hard offset shadows
  (`3px 3px 0`) rather than soft blurs; hover nudges an element up-left by 1px.
- **Layout:** one 1180px column with 26px gutters (13px on phones; the
  breakpoint is 640px). Cards are rows of a narrow mono label column plus
  content, separated by soft rules.
- **Colour is tokenised.** Surfaces, lines and inks, then accent families
  (green, terracotta, gold/amber, slate, plus the event-type families), each
  with a wash, an ink and an accent. Night mode changes token values only.
- **Photographs are never recoloured.** Controls and captions drawn over a
  photo use fixed "on-photo" tokens in both themes, and the photo viewer is
  dark in both.
- **The printable calendar always uses the day palette**, whatever the screen
  theme.

## Bringing a design back into the app

- The source of truth for colour is the block between `/* tokens:start */`
  and `/* tokens:end */` in the `<style>` of `index.html`. Every colour in the
  app's CSS and inline styles is a `var(--token)` from that block, so changing
  a value there restyles the whole site; add a night value alongside each day
  value.
- A handful of colours are deliberately literal and stay that way: the sun and
  moon direction lines on the mini map, the Instagram glyph's gradient, the
  black hero caption box, and pure-black photo shadows.
- Layout, spacing and type sizes are inline styles on the components in
  `index.html` (there is no build step and no separate stylesheet per
  component), so structural changes are code edits there.

## Regenerating

After the app's look changes:

```
node design/build-reference.js
```

It needs Node 18+ and Playwright. It starts a throwaway local server, runs the
app in headless Chromium with the storage and forecast services faked, and
rewrites the generated files (about fifteen seconds).

## What the snapshots can't show

- The **map** page and the small map in the location brief are drawn at run
  time (d3 / Leaflet) and are not in the snapshots; the map page snapshot has
  the header and controls only.
- Hover and focus states, the slideshow, drag-and-drop and anything else that
  needs the app running. The hover rules are in the embedded stylesheet.
- Real photographs — the stand-ins only hold the space.
- The **printable calendar** (owner only) is not captured; it follows the same
  tokens and type, laid out on A4-landscape sheets.
