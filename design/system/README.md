Photoplan is a photography planning calendar: a year of places to photograph, month by month, with the light, the sky and the weather for each. It should feel like a printed field notebook — warm paper, dark ink, small typewritten labels, square corners — and stay out of the way of the photographs.

## Voice

Write the way a photographer briefs a friend: concrete, place-first, no selling.

- Lead with what is there to see. “The ridge rising from a sea of valley fog at sunrise, the winding Great Ridge path, frost on the grass.”
- Give conditions as plain instructions. “Nov mornings after a cold, still, damp night. Hike up in the dark for first light above the cloud.”
- Month lines are one short sentence with a full stop: “Fog, frost and a million starlings at dusk.”
- British spelling and dates: “Sat 15 Nov 2026”, 24-hour times (“07:41”), compass points for bearings (“ESE”), a two-digit year with an apostrophe in captions (“Mam Tor · Nov '25”).
- Join facts with a spaced middle dot (“3 spots · 1 done”), ranges with a spaced en dash (“Wed 18 – Thu 19 Nov 2026”), and use an em dash for an aside.
- Sentence case everywhere in running text. Labels and buttons are also written in sentence case and only *shown* in capitals by the type style — never type them in capitals.
- Buttons are a verb and its object: “Add location”, “Schedule photo op”, “Log visit”, “Set default”. A confirmation names the thing and the consequence: “Delete "Mam Tor" from November? Its photos will be removed from the cloud as well. This cannot be undone.”
- Hints say what to do, quietly: “Add a shot to get here and press Enter”, “Drag a tile to reorder”.
- No exclamation marks, no emoji in copy, no marketing adjectives.

## Colour

Use the tokens by role, never a raw value. Every colour has a day and a night value; night mode changes values only, never layout.

- **Ground.** The page is `page` with a dot pattern in `page-dot` (0.8px dots on a 22px grid). Cards, buttons and dialogs are `paper`; inputs and selects are `field`; chips, tags and empty photo slots are `sunken`.
- **Ink.** Headings and names in `ink`; running text in `ink-body`; intros and quiet sentences in `ink-3`; chip text in `ink-2`. Small capital labels step down through `muted`, `label`, `faint` and `ghost` — these four are for short labels and hints only, never for sentences (their usage notes give the contrast).
- **Lines.** `line` is the standard hairline and section rule; `line-soft` parts rows inside a card; `line-strong` borders fields and flat cards; `ink` borders anything pressable or raised. Dashed outlines (`line-dash`) mean “add something here”.
- **Green is the action colour.** `green` fills the one primary button in a view and colours links, ticks and the UK. Set text on a green fill in `paper`, never white. `green-wash` with `green-deep` text is the “promising” or “done” tint.
- **Terracotta is International** (`terra`, `terra-wash`) and a glyph accent. **`danger`** is only for delete, restore and errors: outlined in `danger-line` at rest, filled on hover.
- **Gold and amber** mark the starred photo and photo ops (`gold`, `amber`). **Slate** belongs to trips (`slate`, `slate-wash`, `slate-ink`).
- **Event types** each have a wash, a text colour and an accent, used together and never mixed:

| Type | Glyph | Wash | Text | Accent |
| --- | --- | --- | --- | --- |
| Photo op | ◉ | `ink` | `paper` | `amber` |
| Full moon | ● | `moon-wash` | `moon-ink` | `moon-ink` |
| New moon | ○ | `moon-wash` | `newmoon-ink` | `ink-3` |
| Meteor shower | ✦ | `amber-wash` | `amber-ink` | `amber` |
| Eclipse | ◐ | `eclipse-wash` | `danger` | `danger` |
| Nature window | icon | `nature-wash` | `green-deep` | `green-2` |
| Season window | icon | `season-wash` | `ink-2` | `season-accent` |
| Trip | ▲ | `slate-wash` | `slate-ink` | `slate` |
| Custom types | ◆ | `plum-wash` … `stone-wash` | `plum-ink` … | `plum` … `stone` |

- **On photographs** use only the fixed tokens (`on-photo`, `photo-veil-*`, `photo-glass-*`); they are the same day and night. The photo viewer is dark in both themes (`lb-*`). Never tint, filter or recolour a photograph.
- **Printed pages always use the day values**, whatever the screen theme.

## Type

Three voices, each with one job. Do not swap them.

- **Zilla Slab** (`--font-slab`) for anything that is a name or a title: `title-page` for the page, `title-month` and `title-card` for cards, `name-list` and `name-tile` for places. Weights 600 and 700 only.
- **Spectral** (`--font-serif`) for sentences: `prose-intro`, `prose`, `prose-small`, `prose-note`. Weight 400 only; never bold, never italic.
- **IBM Plex Mono** (`--font-mono`) for every label, button, chip and figure. Labels and buttons (`label-section`, `label-button`, `label-row`, `label-link`, `label-tag`) are shown in capitals with wide tracking; data (`data`, `chip`, `micro`) is not.
- **Figtree** (`--font-wordmark`) sets the word PHOTOPLAN (`wordmark`, `wordmark-small`) and nothing else.
- A section opens with a `label-section` in `muted` followed by a hairline that runs to the edge of the column; a count or note may sit at the right end of that line.
- Sizes are small on purpose. Do not enlarge labels to fill space; add air instead.

## Shape, borders and shadow

- **Square corners.** `radius-none` is the rule. `radius-2` to `radius-4` appear only on tiny things (event bars, tick boxes, the brief's photo); `radius-round` only on dots and on the round controls that sit on a photograph.
- **Hairlines, not fills.** Structure comes from 1px rules and borders. A card is `paper` with a border; a big card adds a 5px bar of its accent colour across the top (`accent-bar`).
- **Hard shadows.** Raised things cast an offset with no blur (`offset-sm` to `offset-dialog`), as if the paper were lifted. Flat cards get only `lip-under`. Do not use soft drop shadows, glows or gradients.
- **Hover and press.** A raised button moves 1px up-left and takes `offset-hover`; pressed, it moves 2px down-right and takes `offset-pressed`. Rows and quiet controls change background (`paper-shade`, `sunken`) or turn `green`. Keyboard focus is a solid 2px `green` outline, 2px clear of the control; a focused input gets a `green` border and `ring-field`.
- **Motion** is limited to those nudges and a 0.9s fade between slideshow photographs. Nothing bounces, slides or spins.

## Layout

- One column, at most `column` wide, with `page-x` either side (13px on phones). Below `breakpoint-phone` everything stacks; there is no separate phone design.
- A page opens with the small lockup, the `title-page`, one line of intro and the nav buttons to the right; a hairline; then sections.
- Inside a card, content is rows of a narrow label column (`label-col`) and a value, each row padded `row-y` and parted by a `line-soft` rule.
- Controls are `control-nav` tall in the page header, `control-action` in a card's footer, `control-sm` in tool rows; chips are `chip-h`.
- Photographs are framed, never full-bleed on screen: the hero sits in a `paper-bright` mat with an `ink` border; tiles are 3:2.

## Iconography

- **Glyphs, not an icon font.** Controls and legends use single characters set in the mono face, in the text colour: ◍ map, ☁ weather, ▲ trips, ▦ gallery, ⎙ printable calendar, ⤓ export, ⟲ backups, ✎ edit, ☾ night, ☀ day, ⌕ search, ⌖ focus point, ★ star, ✓ done, ✕ delete, × close, ⇄ switch, ↑ ↓ rise and set, ‹ › step, → ← go, ↗ opens elsewhere. Reuse these; do not introduce a second symbol for the same thing.
- **Window icons** are the twenty small pictures in the Icons asset group (bluebell, mist, puffin and so on): 24px drawings in one ink, shown at 12–14px in a day's corner in the event's accent colour, with no label — the legend under the grid names them.
- **The mark** is in the Logos asset group. Use the on-dark version on dark grounds; never redraw it, recolour it or set the wordmark in another face.
- **Weather symbols** on forecast day cards are the platform's own weather characters (☀ ⛅ ☁ 🌧 🌫) at 26px. They are the only pictographs of that kind in the product; do not add others.
