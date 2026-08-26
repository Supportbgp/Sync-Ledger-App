# Ledger — Board Game Paradise Inventory App

Internal inventory/catalog tool for a TCG/collectibles shop (singles + graded
slabs). No traditional backend — a React SPA talking directly to Supabase.

## Architecture

- **Frontend**: Vite + React SPA, deployed to GitHub Pages via
  `.github/workflows/deploy.yml` on every push to `main`. `base:
  '/Sync-Ledger-App/'` in `vite.config.js` — the live URL is
  `https://supportbgp.github.io/Sync-Ledger-App/`.
- **Backend**: Supabase — Postgres (`catalog`, `sync_queue` tables), Supabase
  Auth (one shared login for shop staff, no per-user accounts), Supabase
  Realtime (cross-device live sync), one Edge Function
  (`scan-binder-page`, Deno) for the binder scanner's vision-LLM call.
- **No router library**: `src/main.jsx` checks the URL for a `?binder=`
  query param and renders either the authenticated `<App/>` or the public,
  no-login `<BinderView/>` — there's nothing else to route.
- **State**: no Redux/Zustand — `App.jsx` owns top-level state and passes
  handlers down; `UIContext.jsx` covers cross-cutting UI concerns (toasts,
  confirm dialogs, lightbox).

## Branding

- **Logo assets**: `src/assets/logo-icon.png` (square, transparent, used
  inline via `<img>` in `App.jsx`'s topbar, `Login.jsx`, and
  `BinderView.jsx`'s public topbar) plus `public/favicon.ico`,
  `public/favicon.png` (32×32), and `public/apple-touch-icon.png` (180×180,
  flattened onto white — iOS doesn't render transparent touch icons well),
  all referenced from `index.html`. All four are the same crop: just the
  palm/sun/meeple/wave emblem from the real Board Game Paradise logo, with
  the "BOARD GAME PARADISE" wordmark cropped out — favicon/topbar space is
  too small for a wordmark to read, and the emblem alone is distinctive
  enough. The wordmark and emblem sit almost flush against each other in
  the source logo (near-zero gap), so the crop's right edge cuts a couple
  px into the wave's outer curl rather than risk including a sliver of the
  "B" — imperceptible at icon size, and the only way to guarantee zero text
  bleed given how tight the source composition is.
- **Color palette** (`src/styles/index.css` `:root`): every existing
  variable (`--amber`, `--green`, `--rust`, `--purple`, `--blue`, `--bg`,
  `--surface-alt`, `--ink*`, `--border`) was recolored to a palette sampled
  directly from the logo's actual pixels (palm/grass green, sun gold,
  meeple red, wave teal, trunk brown), then deepened only as much as needed
  to clear ~4.5:1 WCAG contrast against white for text/filled-button use —
  computed with the real contrast formula per color, not eyeballed; several
  new values (e.g. green, blue) land *above* the original muted palette's
  own contrast levels. Variable **names and semantic roles are unchanged**
  (amber=pending/warning, green=success, rust=danger/sold, purple=slab,
  blue=informational/links) so no component needed touching — only the
  hex values moved. `--teal`/`--teal-soft` are new tokens (the logo's wave
  color has no prior UI equivalent) and now drive the primary button fill
  and the active-tab underline, so the brand color shows up on the app's
  actual primary actions, not just decoratively. A couple of hardcoded
  hex colors that bypassed the variable system entirely (`.pending-badge`'s
  border, `.binder-card-slab-badge`'s background) were found and moved
  onto the same token system / matching hues so they don't silently clash
  with the new palette.
- **To swap in a different/updated logo later**: replace
  `src/assets/logo-icon.png` and regenerate the three `public/` favicon
  files from the same source crop (square, transparent background) — there
  is no build step that derives them automatically, they're committed as
  static files.

## Polish & mobile responsiveness

- **Priority surfaces**: staff explicitly need the public binder page
  (`BinderView`), Catalog, Scanner, and Import/Export to be comfortably
  usable from a phone, not just the register desktop — Sync Queue and the
  Export/QR modals stay desktop-oriented for now (not asked for, not yet
  touched beyond not being actively broken).
- **One shared CSS breakpoint** (`@media (max-width: 640px)` in
  `styles/index.css`) covers every plain style/stacking fix — two-column
  grids (`.field-row2`, `.map-grid`) collapse to one column, `.img-preview-
  wrap` and `.scan-row` switch to column layout, `.overlay`/`.app` padding
  shrinks to give content more width. `CatalogTable`'s table-vs-cards swap
  uses its own JS breakpoint instead (`useIsMobile`, `hooks/useIsMobile.js`,
  700px via `matchMedia`) since that's a structural markup change, not a
  style tweak — a media query alone can't conditionally mount different
  JSX.
  - **Inline `style={{flex: N}}` silently defeats a CSS media query** —
    found this the hard way in `ScannerPanel`'s `ScanRow`: its inputs had
    hardcoded `style={{flex: 2}}` etc., which as an inline style always
    outranks any external stylesheet rule regardless of specificity or
    media query. Fixed by moving those to real classes (`.sf-wide`, `.sf`,
    `.sf-auto`) so the mobile breakpoint can actually override them. Worth
    remembering for any future inline flex/width styling on a component
    that might need a responsive override later.
- **CatalogTable mobile view**: below the 700px breakpoint, the dense
  table is replaced entirely (not just visually collapsed) by
  `.catalog-cards` — one compact card per item (thumb, name, game tag,
  qty, price) that expands on tap to reveal SKU/updated/location/notes/
  platform-status/Edit+Sell, via per-row `expandedSkus` state in
  `CatalogTable.jsx`. Batch-select checkboxes still work per-card plus a
  "Select all visible" row at the bottom. `deriveRow()` computes the
  qty/sold/subtitle/game-tag fields once, shared by both the desktop table
  and mobile card rendering paths, so the two layouts can't quietly
  disagree on what "sold" or the subtitle line means.
- **Per-game color tags** (`GAME_TAG_CLASS` in `cardUtils.js`, `.badge.tag-*`
  in CSS): a small colored badge next to each item's name showing its game.
  Originally reused the 6 shared UI accent tokens with some games sharing a
  color; real-phone testing found 3 exact repeats (Magic/SWU, Pokemon/
  Riftbound, Yugioh/Gundam) plus Lorcana/One Piece sitting only ~10° apart
  on the color wheel despite different tokens — all too close to tell apart
  at badge size. Every game now gets its own dedicated hue (4 new `--tag-*`
  tokens — `--tag-gundam`/`--tag-riftbound`/`--tag-swu`/`--tag-lorcana` —
  alongside the 5 shared tokens still reused for Magic/Pokemon/Yugioh/One
  Piece/Sports Singles), spaced ~30-40° apart around the wheel, each
  individually verified at ≥4.5:1 contrast against white. Games with no
  obvious color default to a neutral gray tag rather than no tag at all, so
  every row still shows its game. Adds a real scan-by-color aid on a
  catalog that stocks 9+ separate game lines, not just decoration.
- **Saturated palette v2**: every accent color (`--amber`/`--green`/`--rust`/
  `--purple`/`--blue`/`--teal`) was pushed noticeably more saturated than
  the first branding pass (which read as muted once actually deployed),
  then re-darkened just enough to hold ≥4.5:1 contrast against white again
  — recomputed with the real WCAG formula after each saturation bump, same
  discipline as the original palette pass. The three hand-picked border
  colors that sit between a token's `-soft` background and its saturated
  foreground (`.pending-badge`, `.pending-badge.zero`, `.batch-bar`) were
  recomputed to match (a 65%-soft/35%-fg blend) rather than left stale
  against the new colors.
- **EditModal reorganized into labeled boxed sections** (`.form-section` +
  the existing `.section-label` divider style, already used elsewhere in
  the app) — Item details / Channels / Quantity & pricing / Notes & status
  — instead of one long flat list of fields. Purely a markup/CSS
  reorganization; no field, handler, or validation logic changed.
- **SellModal** skips the quantity stepper entirely for a single-copy item
  (`card.qty === 1`) and shows a plain "Mark this item as sold?" yes/no
  confirmation instead — asking for a quantity when there's only one
  possible answer was pure friction for the common case. Multi-copy items
  keep the existing stepper.
- **Row actions**: Edit was a 28px icon-button with "Edit" as literal text
  crammed into it (too small to read comfortably, and rendered flush
  against Sell with no gap). Now a normal `.btn.secondary.small` with a
  `.row-actions` flex gap between it and Sell, used identically by both the
  desktop table and the mobile card's expanded view. "+ Add item" moved
  from `.btn.secondary.small` to a plain `.btn` (full-size, teal-filled)
  so it reads as the toolbar's primary action, not a peer of the filter
  dropdowns.
- **Manual QA note**: this sandbox has no network path to the real
  Supabase project, so Catalog/Scanner/Import (all behind the shared
  login) couldn't be screenshot-tested against live data. Verified instead
  with a throwaway local harness (mock catalog data, real components,
  deleted before committing — see git history for `devtest.html`/
  `src/devtest.jsx` if this needs redoing) — actually exercised CSV
  parsing (client-side, no network needed) and every modal (Add/Edit item,
  Sell) at both a phone and desktop viewport width via Playwright
  screenshots, which is what caught the inline-`flex`-style bug above.
  BinderView and Login were checked directly against the built app instead
  since they don't require a session.

## Mobile polish round 2 (real-phone findings)

A first pass at mobile (above) was verified via a local harness and
Playwright screenshots, not a real device. Actually testing on a real phone
surfaced a second round of issues, several of which trace back to two root
causes rather than N unrelated bugs:

- **The toast's `z-index` (60) was accidentally *higher* than the modal
  overlay's (50)** — a still-fading toast could sit on top of an open
  modal. Fixed by making `.overlay` categorically outrank everything else
  on screen (`z-index: 1000`) and dropping `.toast` to `40`.
- **Flex items don't shrink below their content's width by default** — a
  `<select>` inside a flex row (`.map-row` in the import column-mapper,
  `.sheet-picker`'s sheet selector) with a long option text could force the
  whole row, and the whole page, wider than the viewport. On mobile this
  didn't just look bad — it also visually mislaid the Binder QR modal
  (which centers on the *viewport*, so a page zoomed-to-fit to accommodate
  the overflow no longer has that centered modal within the visible area)
  and made the sheet picker read as "not there." Fixed at the source
  (`flex: 1; min-width: 0` on both selects) plus a `overflow-x: hidden`
  safety net on `body` so no future overflowing element can do this again.

Everything else found:

- **Modal system**: `EditModal`/`SellModal`/`SettingsModal`/`ConfirmModal`
  close only via their own explicit Cancel/confirm buttons — no backdrop-tap-
  to-close. That was tried (a shared `backdropClose(onClose)` helper wired
  onto each `.overlay`'s `onClick`, checking `e.target === e.currentTarget`
  so clicks on the modal card itself didn't bubble into a close) and then
  removed after real use found it caused more accidental dismissals than it
  prevented — deliberately staying with explicit-button-only closing rather
  than re-adding a backdrop shortcut. `Lightbox` is the one exception, and
  was never wired through that helper in the first place: it closes on a
  click anywhere (including the image), which is the expected pattern for a
  plain image viewer with no form state to protect.
  - **Also tried, then reverted before that: closing a modal on the mobile
    back button/gesture.** An earlier version pushed a throwaway `history` entry
    per modal and closed on the resulting `popstate` (`useModalBackClose`,
    since deleted). Real-device testing found this made Cancel and
    backdrop-tap *also* trigger a real "go back" navigation — this app has
    no history depth beneath a modal's pushed entry to safely consume, so
    the cleanup's own `history.back()` call (meant to tidy up after a
    non-back close) ended up navigating the browser away for real. Decided
    the win wasn't worth the risk here and dropped it entirely — at the
    time, Cancel plus backdrop-tap (since also removed, above) were enough;
    the physical back button/gesture just does its normal thing again, same
    as before this round.
    (This is also where a `<React.StrictMode>` double-invoke dev-mode-only
    bug briefly appeared — the *first* symptom found — where the modal
    closed itself the instant it opened, because the async `history.back()`
    from a phantom StrictMode cleanup landed its `popstate` on the second
    mount's listener instead of firing into a void. Fixed with a timing
    guard at the time; moot now that the whole back-button feature is
    gone, but worth remembering if anything else in this app ever pairs
    `pushState`/`history.back()` with effect cleanup.)
- **Touch targets were sized for a mouse**: `.btn`/`.btn.small` get real
  min-heights (44px/40px) under the mobile breakpoint; `.modal-foot`
  buttons (Cancel/Delete/Save etc.) go full-width and stack, Cancel first
  (top) — matching each modal's own markup order, so no per-modal
  reordering trick (e.g. `column-reverse`) is needed; `.checkbox-row`
  checkboxes and the mobile catalog card's platform-status chips and
  Edit/Sell buttons all got bigger specifically in that context
  (`.catalog-card-details` scoped rules), leaving the denser desktop table
  untouched.
- **`.img-frame.large` (EditModal's big preview) wasn't centering its own
  children** when the Real photo/Stock image toggle row rendered below the
  image — the toggle row could be wider than the image, and since the
  frame is `display: inline-block` sized to its widest child, the
  (narrower) image defaulted to the frame's left edge instead of centering
  within it. Switched to `flex; flex-direction: column; align-items:
  center`.
- **CatalogTable**: "Select all visible" moved to the top of the mobile
  card list (was at the bottom, easy to miss); the `deriveRow()` subtitle
  builder now assembles parts as an array and joins once instead of
  string-concatenating a separator onto a possibly-empty first join — the
  old version left a stray leading " · " before a slab's grade whenever
  set/condition/printing were *all* blank.
- **Pricing settings silently failing to open**: `multipliers` started as
  `null`, and the Settings modal was gated on it truthily
  (`{showSettings && multipliers && <SettingsModal/>}`) — on any network
  hiccup loading it (no `.catch` on that promise, so a thrown exception
  rather than a Supabase-shaped `{error}` would leave it `null` forever),
  tapping the footer link did nothing, with zero feedback. `multipliers`
  now starts as `DEFAULT_CONDITION_MULTIPLIERS` instead of `null` — the
  modal is usable immediately regardless of load state, and a real
  settings row (or the same defaults, via the added `.catch`) just
  overwrites it once the fetch actually resolves.
- **Pricing warning text reworded** (`EditModal`/`ScannerPanel`, both had
  the same copy) to actually explain itself — what Market Value is an
  estimate *of* (NM price × a flat condition %) and why that can be off by
  real money on an expensive card — instead of just asserting "this can be
  off," which staff had to come ask about.
- **Scanner file input dropped `capture="environment"`** — that attribute
  is exactly what skips the OS's normal file-picker chooser and launches
  the camera directly; removing it restores the OS's own "Camera / Photo
  Library / Files" choice so a photo already on the device can be shared in
  instead of always requiring a fresh one.
- **Scanner "Find another image" doing nothing**: `ScanRow`'s displayed
  image was `row.photoData || (stock image)` — since a crop almost always
  exists, it unconditionally won regardless of what stock candidate got
  picked, so a pick never visibly changed anything. Fixed by giving
  `ScanRow` the same dual-image model as `EditModal` (`row.activeImage`,
  defaulting to `'photo'`) with its own compact Photo/Stock toggle in the
  thumbnail column; picking a stock candidate now also flips the toggle to
  `'stock'` (same reasoning as `EditModal`'s `selectCandidate`), and the
  chosen `activeImage` is carried into the saved catalog row.
- **Rarity-based disambiguation** (`row.rarity` in `ScannerPanel`, a plain
  editable field next to Set — the vision model now guesses it too, see
  the crop-pipeline note above): the same-name/same-set-different-rarity
  case wasn't disambiguated at all before, since rarity wasn't captured
  anywhere. It's deliberately *not* a hard server-side filter for
  Scryfall/pokemontcg.io — `preferRarity()` in `cardSearch.js` re-sorts
  results whose own reported rarity loosely matches the hint to the front
  but never drops anything, since a hard filter risks silently zeroing out
  results over a free-text/vocabulary mismatch (same "never guess an
  external API's exact behavior" discipline as everywhere else in this
  project). For the three Egman-backed games (One Piece/Riftbound/Gundam),
  `rarityHint` narrows server-side in `card-lookup-proxy`'s `egmanQuery` —
  safe there specifically because `rarity` is a real, already-confirmed
  field on that response (same sample that confirmed `card_code`/
  `set_code`), using the identical narrow-if-it-helps/fall-back-if-not rule
  already used for `setHint`. SWU gets neither — no confirmed rarity field
  in its response, so nothing was added rather than guessed at. Requires
  redeploying both `scan-binder-page` (new schema field) and
  `card-lookup-proxy` (new request/response field) to take effect.

## Directory map

- `src/lib/` — all non-React logic. `db.js` (Supabase reads/writes + row↔card
  mapping), `cardUtils.js` (`normalizeCard`, game-name canonicalization,
  platform-status-reset logic, the canonical `GAMES` list), `cardSearch.js`
  (Scryfall/pokemontcg.io/YGOPRODeck card+image lookup), `csv.js`/
  `importParse.js`/`exportFormats.js` (import/export), `quoteUtils.js`
  (Quote tab totals/tiers/catalog-conversion logic), `image.js`
  (client-side photo resize), `scanner.js` (binder-scan Edge Function
  client), `qr.js` (QR generation), `supabase.js` (client init).
- `src/components/catalog/` — main catalog table, edit/sell modals, batch
  actions.
- `src/components/queue/` — the Sync Queue tab (POS/TCG Player/Collectr
  three-stamp tracking).
- `src/components/importexport/` — `ImportPanel.jsx` (the CSV/XLSX import
  flow, standalone enough to also be embedded in the Quote tab),
  `ExportPanel.jsx` (Export/Binder-QR/Reset-all-data), and
  `ImportExportPanel.jsx` (a thin composer of both — the real Import/Export
  tab).
- `src/components/scanner/` — the binder-page scanner review queue
  (`ScannerPanel.jsx`, also embeddable in the Quote tab).
- `src/components/quotes/` — the Quote tab: `QuotesTab.jsx` (landing list +
  new-quote entry point), `QuoteDetail.jsx` (one quote's detail view),
  `QuoteLineItemRow.jsx`, `CatalogItemPicker.jsx` (the local-catalog
  typeahead).
- `src/components/BinderView.jsx` — the public, read-only binder page (no
  `UIContext`, no auth).
- `src/components/docs/` — the standalone staff documentation page (also no
  `UIContext`, no auth; reached via `?help=1`), split into one section file
  per topic under `docs/sections/`.
- `supabase/migrations/` — SQL run manually via the Supabase SQL Editor
  (there is no migration runner wired up — each file's header comment says
  when/how to run it).
- `supabase/functions/scan-binder-page/` — the Edge Function; deploy with
  `supabase functions deploy scan-binder-page`, secret set with `supabase
  secrets set ANTHROPIC_API_KEY=sk-ant-...`.

## Data model notes

- A catalog item is either a `single` or a `slab` (`itemType`). Slabs are
  unique (grader/grade/cert fields); singles have qty.
- Three independent per-item platform-status booleans —
  `posSynced`/`tcgplayerSynced`/`collectrSynced` — plus matching `_done`
  columns on `sync_queue` tickets. These reset to `false` automatically when
  price/qty/condition/sold changes (see `needsPlatformStatusReset` in
  `cardUtils.js`) — the assumption is any of those changes invalidates
  whatever's currently listed elsewhere. Selling always resets all three.
- Not every item lives on every platform (some are in-store only) — three
  more per-item booleans, `posChannel`/`tcgplayerChannel`/`collectrChannel`
  (Sprint 2), gate whether a given platform even applies. Default `true` on
  every row so nothing pre-existing silently dropped out of tracking. The
  Sync Queue/status chips only show and require the channels an item is
  actually enrolled in (`isTicketComplete` in `cardUtils.js`), and Export
  filters TCG Player/Collectr/pending-POS lists to matching-channel items
  only. `sync_queue` tickets snapshot an item's channels at sale time, same
  as its other snapshotted fields. New items default their channels to
  whatever the majority of existing items in the same binder/case already
  use (`channelDefaultsForLocation`), editable per item either way.
- **CSV/XLSX import channel picker + image auto-fill**: `ImportExportPanel`
  now has the same per-batch channel checkboxes as the Edit modal/Scanner
  (`channelDefaultsForLocation` keyed off the import's binder/case field,
  same "follow the majority until staff touches a checkbox" behavior).
  Import also auto-searches an image for any row that doesn't already have
  one (no Image URL column mapped, or that cell was blank for that row) —
  same lookup Scanner/EditModal use, now shared as `searchCardImage` in
  `cardSearch.js` instead of three near-identical copies of the same
  by-game dispatch table. Unlike Scanner/EditModal there's no per-row
  review step or price/listing backfill: the top result fills the image
  slot directly, matching how little review any other imported column
  already gets. Runs with limited concurrency (`runWithConcurrency` in
  `importParse.js`, cap of 4) rather than firing one request per row
  unbounded — a large spreadsheet import can be hundreds of rows, unlike a
  ~9-card scanner batch.
- `game` values are canonicalized on read (`canonicalizeGame`/
  `GAME_ALIASES` in `cardUtils.js`) so imported data like "MTG" normalizes to
  "Magic" — several features (image search, scanner) do exact string checks
  against the canonical game names in the `GAMES` array (kept in sync across
  `EditModal.jsx` and `ScannerPanel.jsx`).
- `catalog_public_view` (SQL, not in the app code) is the only thing the
  public binder page reads — a restricted view exposing browsing-safe
  columns only, for unsold/in-stock rows. It relies on view-ownership
  bypassing the base table's RLS, so `anon` never touches `catalog` directly.
  Column list is `create or replace view`d per migration (see
  `phase6_dual_image.sql`) rather than tracked by hand elsewhere.
- **Dual-image model (Sprint 6)**: every item can carry two independent
  images — the existing "stock" reference (`image_url`/`image_data`, from
  card search or a manual paste/upload) plus a new "photo" (`photo_url`/
  `photo_data` — a real picture of this exact copy: a scanner crop or manual
  upload). `active_image` (`'stock'|'photo'`, DB default `'photo'`) records
  which one staff prefer displayed; `resolveActiveImage`/`activeImageSrc` in
  `cardUtils.js` are the single source of truth for which one actually shows
  — they honor that preference but fall back to whichever slot isn't blank,
  so a card with only one image type never renders empty just because the
  preferred slot is unset. Defaulting the column to `'photo'` (not `'stock'`)
  means a real photo added later to an old stock-only item takes over
  display automatically with no extra step, matching the original ask to
  prefer the real photo when both exist — existing rows are unaffected since
  their photo slot starts blank. `CatalogTable`'s `Thumb` and `BinderView`
  both render through `activeImageSrc`, so staff and public views stay
  consistent. In `EditModal.jsx`, "Find stock image" (search) and "Upload
  real photo" write to separate pending slots and auto-switch the toggle to
  show whatever was just changed; "Find market price" (Sprint 5) still
  never touches either image slot. The toggle itself only renders when both
  slots actually resolve to something. CSV/XLSX import and the Scanner's
  auto-fill still only populate the stock slot — CSV/XLSX import detects an
  existing image URL only (see the backlog item above), and the Scanner now
  crops the "photo" slot too (below).
- **Scanner per-card crop pipeline (Sprint 6)**: `scan-binder-page`'s
  `DETECT_CARDS_TOOL` schema now requires a `bbox` (`x_min/y_min/x_max/y_max`,
  each a 0.0-1.0 fraction of the full page photo's width/height) per
  detected card, tightly bounding just that card's pocket — the prompt
  explicitly warns the model not to bound a neighboring pocket instead.
  `cropImageRegion` (`image.js`) is a Canvas crop-and-downscale (same
  maxDim/quality pattern as `resizeImageFile`) that turns that bbox into an
  actual cropped data URL. `ScannerPanel.handleScan` crops every detected
  card immediately (no extra network call — it's the same page photo
  already in memory) into that row's `photoData`/`photoUrl:'local'`,
  independent of and parallel to the existing stock-image auto-search. A
  crop failure (bad/missing bbox) just leaves that row's photo slot blank —
  the stock search result is still there as a fallback. The scan review
  row's thumbnail shows the crop over the stock search result when both
  exist by default (same photo-first rule as `resolveActiveImage`), with a
  per-row Photo/Stock toggle (mirroring `EditModal`'s) once both actually
  exist — picking a different stock candidate switches this row's toggle
  to "Stock" automatically, same reasoning as `EditModal`'s
  `selectCandidate`. **Requires redeploying `scan-binder-page`**
  (`supabase functions deploy scan-binder-page`) before this takes effect —
  the schema change is server-side.
  - **Crop accuracy is hit-or-miss** — real-world testing showed the model's
    bbox tends to hug the card too tightly and most often clips the *top*
    edge (the bottom of a plastic pocket is a sharp, unambiguous line; the
    top blends into the pocket/page above it) — and a second round of
    real-phone testing found this specifically worse for the *bottom row* of
    a page (those cards are typically more foreshortened/steeper-angled in
    the photo, which degrades the model's already-weaker top-edge estimate
    further). Three mitigations now, not two: the prompt tells the model to
    anchor on the bottom edge first and err toward a slightly larger box;
    `cropImageRegion` pads the box outward before cropping regardless — 2%
    bottom, 3% left/right, flat (`DEFAULT_CROP_PADDING`); and top padding is
    no longer flat — `adaptiveTopPadding` scales it from ~8% (near the top
    of the photo) up to ~18% (near the bottom) based on the box's own
    `y_max`, targeting the specific bottom-row problem directly. All
    padding is relative to the detected box's own size, not the full page,
    so it scales with card size rather than being a fixed pixel margin.
  - **Toggle/lightbox click bug (fixed)**: the stock/photo toggle buttons in
    `EditModal.jsx` live inside the big-preview `div` that opens the
    lightbox on click. Without `stopPropagation()`, clicking a toggle also
    bubbled to that div's own `onClick`, which read the *pre-click* `src` —
    so the lightbox opened showing the previously-active image, not the one
    just switched to, even though the small preview itself updated
    correctly on the next render. Both toggle buttons now call
    `e.stopPropagation()`.
- **Pokemon set/rarity recognition was poor for alt-art/high-rarity cards**
  (e.g. a Special Illustration Rare getting "Scarlet & Violet" as its set —
  too vague to be useful — and "Pokemon EX" reported as a *rarity*, which
  isn't a real one). Root-caused to two schema/prompt gaps, not a vision
  capability limit: (1) the `rarity` field's description never distinguished
  a print's actual rarity tier from a Pokemon card's *subtype* printed in
  its name area (ex/GX/V/VMAX/VSTAR) — the model was doing exactly what an
  ambiguous instruction invited, reporting the subtype it could clearly see
  as if it were the rarity; (2) `set` had no guidance to prefer the specific
  expansion name over the general era/block, so it defaulted to the vaguer,
  easier-to-infer-from-styling answer. Fixed by rewriting both field
  descriptions with explicit anti-examples and real rarity-ladder terms
  (Double Rare/Illustration Rare/Special Illustration Rare/Hyper Rare,
  alongside older Rare Holo/Rare Secret), reinforced in `PROMPT_TEXT` too.
  Also added a new `number` field (the printed collector number, e.g.
  "280/217") — previously never captured at all, despite being the
  strongest disambiguator a print has among many same-name/alt-art
  versions. `searchPokemon` (`cardSearch.js`) now tries `name+set+number`,
  then `name+number` *before* falling back to `name+set` — number is
  deliberately given priority over set in the fallback ladder because set
  is the less reliable of the two signals per the above, so a set guess
  that's still just the vague era name shouldn't block a number-based
  match. **Requires redeploying `scan-binder-page`** (schema/prompt
  changes are server-side); `number` is threaded through `ScannerPanel` the
  same transient, never-saved way `rarity` already was — a plain editable
  field next to Rarity in the review row, used only to narrow the search.
  Scoped to Pokemon only for now, per an explicit decision to prove the
  approach on the game with the worst symptoms before generalizing the
  same rarity/set-description discipline to the other games.
- **Rarity detection (tier 2) now leans on visual border/frame treatment,
  not fine-print reading** — real testing of the tier-1 fix above (schema/
  prompt wording only) still found the model regularly failing to fill in
  Rarity at all, and separately misreading the specific Set on some cards
  (e.g. an XY-era Zapdos ex reported as "XY Evolutions" instead of the
  correct "XY — Phantom Forces"). Root cause: tier 1 only fixes the
  model's *instructions* for what counts as a rarity vs. a subtype — it
  doesn't help the model actually *see* a rarity symbol or set icon that's
  printed too small/blurry to read in an ordinary binder-page photo,
  which is a real, separate limitation. Rather than a second zoom/crop
  pass on that same tiny text (still fragile against any photo that isn't
  perfectly sharp), the `rarity` field's description was rewritten to
  judge PRIMARILY from the card's overall visual layout — a much bigger,
  more robust signal than reading small print, and a case where Claude's
  vision is far more reliable at holistic style recognition than
  fine-grained OCR under imperfect photo conditions. Researched (not
  guessed) via `pokemon-tcg-data` on GitHub — the actual open-source
  dataset pokemontcg.io serves, fetched directly (`curl` on
  `raw.githubusercontent.com`, not blocked here unlike most other TCG
  sites) and inspected for real rarity values across a modern set
  (`sv1.json`, Scarlet & Violet base) and an older one (`xy4.json`,
  Phantom Forces — the same set as the real Zapdos ex report). This
  caught and corrected a wrong first guess (this doc originally said
  Illustration Rare keeps "a colored info box" unlike Special Illustration
  Rare — false; both are fully borderless, the real difference is an
  added glitter-foil layer on SIR) before it shipped. Confirmed real
  values, by era — the field now asks for one of these exact strings
  (matching what `preferRarity`'s substring search actually matches
  against), not a free-text description:
  **Modern (2023+, lowercase "ex")**: `Double Rare` = normal small-boxed
  frame, all-over foil, for an ex Pokemon. `Illustration Rare` = full-bleed
  edge-to-edge art, holo border line, no ex suffix. `Ultra Rare` = same
  full-bleed treatment, ex suffix. `Special Illustration Rare` = same
  full-bleed art plus an extra glitter-foil layer. `Hyper Rare` = entire
  border/background gold-toned.
  **Older (2012-2022, uppercase "-EX"/"-GX"/"V")**: `Rare Holo` = normal
  frame, foil over the art only, no suffix. `Rare Holo EX`/`Rare Holo GX`/
  `Rare Holo V` = normal frame but the art breaks past its border, for an
  EX/GX/V Pokemon. `Rare Ultra` = full art, a colored text bar remains.
  `Rare Secret` = same full art plus a gold border, and/or a collector
  number past the set's listed total.
  Only the plain `Common`/`Uncommon`/`Rare` tiers still require reading an
  actual tiny rarity symbol, and the field stays blank rather than
  guessing if that's not legible — same never-guess discipline as before,
  just with a much higher chance of correctly identifying the higher (and
  more valuable, more disambiguation-critical) tiers. No schema change —
  same `rarity` field, so no client-side code changes needed, only the
  Edge Function's field description/`PROMPT_TEXT`. Doesn't address wrong
  Set guesses directly (border style doesn't tell you *which* expansion a
  card is from) — that failure mode instead relies on the existing
  number-before-set fallback priority in `searchPokemon` for resilience: a
  correctly-read collector number still finds the right card even when Set
  is guessed wrong, provided the number itself was legible.
  **Requires redeploying `scan-binder-page`** again (prompt-only change,
  no schema/version bump needed on the client side).
- **Mega Evolution era rarities added** (`Mega Attack Rare`, `Mega Hyper
  Rare`) — researched the same way as the rest of this section, against a
  real sample (`me1.json`/Mega Evolution base set and `me2pt5.json`/
  Ascended Heroes, both from `pokemon-tcg-data`) rather than assumed from
  the name alone. `Mega Hyper Rare` replaces plain `Hyper Rare` as this
  era's gold chase-card tier for a `Mega ___ ex` headliner; `Mega Attack
  Rare` debuted specifically with Ascended Heroes and — unlike every other
  visual-style rule above — isn't about border/art-bleed extent at all:
  its real tell is the attack name itself being printed in Japanese
  katakana instead of English, even on an otherwise-English card, which
  the prompt now checks for explicitly on any `Mega ___ ex` Pokemon.
  Also found and fixed a real data quirk while verifying: pokemontcg.io's
  actual API value for Mega Attack Rare is `MEGA_ATTACK_RARE` (all-caps,
  underscored) — inconsistent with every other rarity string in the same
  set, which are normal Title Case. Rather than special-case that one
  value, `preferRarity`'s matching (`cardSearch.js`) now normalizes
  underscores/hyphens to spaces before comparing, so the model's Title
  Case guess still connects to the real data regardless of this kind of
  formatting inconsistency, for this or any future rarity.
- **ScannerPanel's post-scan auto-fill silently failing, then working on
  manual retry** — also surfaced by the same round of real testing above,
  and a separate root cause from the two rarity/set issues above: an
  unbounded parallel search burst right after a scan (see the
  `runWithConcurrency` concurrency-cap note further down, under Market
  Value/pokemontcg.io reliability) was the actual culprit, not a
  search-logic bug.
- **Rarity field gained a `<datalist>` of real suggestions for Pokemon**
  (`RARITY_OPTIONS_BY_GAME` in `cardUtils.js`, the same researched rarity
  strings from the tier-2 fix above) in both `EditModal.jsx` and
  `ScannerPanel.jsx`'s `ScanRow` — still a plain text `<input>`, so staff
  can type any value, but now with a dropdown of real options to pick
  from instead of needing to remember/spell the exact rarity name. Games
  with no entry in `RARITY_OPTIONS_BY_GAME` (everything except Pokemon,
  for now) just get no suggestions, same free-text behavior as before —
  to be filled in "when the time comes" for each other game, matching the
  Pokemon-first staged rollout elsewhere in this doc. `ScannerPanel`'s
  `<datalist>` id is keyed per-row (`rarity-options-${row.id}`) since a
  single scan can review several cards — and therefore several `ScanRow`s
  — at once; a shared static id would collide.
  - **Found a real accessibility gap while wiring this up**: an `<input
    list="...">` gets an implicit ARIA `combobox` role per the HTML-ARIA
    mapping spec — same as a `<select>` — which shifted the position that
    `EditModal.test.jsx`'s `getAllByRole('combobox')[1]` hack depended on
    to find `LocationPicker`'s `<select>` (it had no accessible name of
    its own; its `<label>` was a visual sibling only, never wired via
    `htmlFor`). Fixed at the actual root cause rather than dodging the
    datalist pattern: `LocationPicker` now takes an `ariaLabel` prop
    (passed as each caller's own visible label text — "Binder / case /
    collection" in `EditModal`, "...for this page" in `ScannerPanel`),
    and the test now finds it via `getByLabelText` instead of a
    position-dependent index that any future added form control could
    just as easily have broken again.
- **Scanner post-scan auto-fill hardened further against overloading
  pokemontcg.io** (on top of the `runWithConcurrency` cap above), after
  the same round of real-phone testing that surfaced the concurrency and
  rarity/set issues above:
  - **Self-imposed request pacing**: the batch auto-fill in
    `ScannerPanel.handleScan` now staggers the first wave of requests
    (`Math.min(i, 2) * 220ms` before each row's search starts) instead of
    firing the initial concurrency-capped batch in the same instant — a
    deliberately conservative pace meant to stay under whatever limit the
    API enforces, rather than finding it the hard way via 5xx responses.
  - **Query de-duplication cache** (`pokemonQueryCache` in `cardSearch.js`,
    module-level, keyed on the exact query string): a binder page with
    several copies of the same card (bulk commons especially) previously
    fired one full search per copy — now the first search's promise is
    cached and reused for any identical query, whether still in-flight or
    already resolved, collapsing N duplicate requests into one for the
    rest of the session. Cleared on failure so a transient error doesn't
    get stuck cached; a successful result is safe to reuse indefinitely
    since a print's data doesn't change mid-session. Test-only
    `__resetPokemonQueryCacheForTests()` clears it between test cases so
    two tests reusing the same query string (e.g. two 5xx-retry tests
    both searching "Charizard") don't interfere with each other.
  - **Progress UI to mask the added latency**: a `fillProgress` counter
    ("Looking up images & prices — X of Y done…", reusing the existing
    `.status-line`/`.spinner` styling) shows while the batch runs, each
    `.scan-row` fades/slides in once on its first mount via a staggered
    `scanRowIn` CSS animation (`prefers-reduced-motion` respected) so the
    queue visibly populates card-by-card, and once every row settles the
    view scrolls smoothly back to the top of the review queue — covers
    the pacing/dedup changes with something that reads as intentional
    rather than makes scanning feel slower.
  - **Post-batch "needs review" nudge**: once the auto-fill batch settles,
    a toast reports how many rows ended up with no image found (tallied in
    a plain closure variable inside the `runWithConcurrency` callback, not
    read back off `rows` state — the `.then()` fires the instant every
    worker resolves, which can outrace React actually applying the last
    `setRows` calls). A blank thumbnail is easy to miss in a long list, and
    jumping straight into mass-retrying "Find another image" clicks would
    recreate the exact request burst the pacing above exists to avoid — one
    nudge is more useful than staff discovering blanks by scrolling.
- **Real-phone scan accuracy findings, round 2** — a 9-card real binder page
  test surfaced three more distinct issues beyond the rarity/set/number work
  above, each with a different fix:
  - **"Rare Ultra" (older era) and "Ultra Rare" (modern era) were getting
    swapped** — same two words, opposite order, for the visually-identical
    full-art "ex"/EX/GX/V treatment in different eras; an easy thing for the
    model to transpose. Both the `rarity` field's schema description and
    `PROMPT_TEXT` now call this out explicitly with a CAUTION note at the
    exact point each term is defined, telling the model to re-check word
    order before answering either one.
  - **Detection was noticeably non-deterministic** — the same 9-card photo
    scanned anywhere from 3 to 7 detected cards across reruns. Tried pinning
    `temperature: 0` on the Anthropic call to cut down that variance (this
    is forced tool-use structured extraction, not creative writing), but a
    real scan attempt came back with `"temperature" is deprecated for this
    model` — this model rejects the parameter outright rather than
    ignoring/clamping it, so it can't be set at all here. Reverted; this
    specific variance is unaddressed for now.
  - **"Find market price"/"Find another image" failed on every input
    combination for "Lillie's Clefairy ex"** specifically — first suspected
    to be the apostrophe in the name (fixed via `sanitizeForPokemonQuery`
    stripping it, same as its other special characters), but real-world
    retesting after that fix showed the client correctly sending the
    sanitized query and *still* hitting a 500. The apostrophe fix was
    real but not the actual cause here — see the fallback-ladder bug
    below, which is.
  **Requires redeploying `scan-binder-page`** (schema description + prompt
  + temperature are all server-side).
- **`searchPokemon`'s fallback ladder had no per-tier failure isolation** —
  a real regression from the retry-then-throw change above. Before that
  change, a failing tier silently returned "zero results" and the ladder
  moved on to the next, broader tier; after it, a *persistent* 5xx on the
  first tier tried (most often `name+set+number`, since Set is frequently
  wrong per the findings above) now threw straight out of `searchPokemon`
  entirely, aborting the whole search before ever reaching the plain-name
  tier that would likely have succeeded. This is almost certainly why
  "search by name only" empirically outperformed hint-narrowed search in
  real testing, and directly explains the Lillie's Clefairy 500 above (not
  the apostrophe). Fixed by restructuring the ladder into a list of tiers
  tried in a loop, wrapped so a thrown error is treated the same as an
  empty result and falls through to the next tier — except the *last*
  tier, whose failure still propagates, so a genuinely unreachable API
  still reports as an error rather than a misleading "no matches."
- **"Find another image"/"Find stock image"/"Find market price" briefly
  went name-only, then reverted** — the theory (a wrong hint narrows OUT
  the correct print) was real, but real-world retesting found it was a net
  regression: names with multiple genuine variants sharing a first word
  ("Eevee" vs "Eevee ex") lost their disambiguation entirely, and
  possessive names ("Lillie's", "Cynthia's") fell through to the broad
  first-word-prefix tier and matched unrelated cards (e.g. "Cynthia's
  Gabite" instead of "Cynthia's Garchomp ex") once hints weren't there to
  short-circuit before reaching it — the same prefix-tier fallback
  mechanism, just triggered by a missing hint instead of a wrong one.
  Reverted to using every hint again everywhere (both these manual actions
  and the initial auto-fill), trusting the fallback-ladder isolation fix
  above to degrade gracefully on a bad hint instead of removing hints
  altogether. EditModal's search calls now also pass `number` (via its new
  scratch field, added for Sprint 1 below) to match ScannerPanel's full
  hint set.
- **Possessive names ("Lillie's Clefairy ex", "Cynthia's Garchomp ex") were
  still broken after the fallback-ladder fix above — real-world retest found
  the *hint-restored* search now returning the right card mixed in with
  unrelated Trainer/Supporter cards literally named "Lillie"/"Cynthia".**
  Root cause was the original apostrophe fix itself: `sanitizeForPokemonQuery`
  replaced the apostrophe with a space, turning "Lillie's" into two tokens,
  `"Lillie"` + `"s"`. But Elasticsearch/Lucene's English analyzer (which
  pokemontcg.io's search is built on) applies a possessive filter that
  strips a trailing `'s` from a token *during indexing* — the real card is
  indexed as `["lillie","clefairy","ex"]`, never `["lillie","s","clefairy",
  "ex"]`. That spurious `"s"` token broke the exact-phrase tier's adjacency
  match, so every possessive-name search fell through past it to the broad
  first-word-prefix tier (`name:Lillie*`), which has no way to distinguish
  the searched-for Pokemon from an unrelated card that merely starts with
  the same word. Fixed by stripping a trailing `'s`/`’s` outright (no
  replacement character) instead of space-replacing it, mirroring the
  indexer's own possessive filter rather than fighting it — confirmed via
  the Elasticsearch/TCGPlayer pricing docs research below, not guessed.
  Non-possessive apostrophes still fall through to the general
  space-replacement rule.
- **No image candidate was ever showing a Market Value price, even for a
  card with real, live TCGPlayer listings (reported for Mega Gengar ex)** —
  traced to `pokemonTcgplayerPrice` only accepting a price variant when
  `market` or `mid` was populated. Per TCGPlayer's own pricing model
  (confirmed via their public pricing-settings docs), `market` is an
  aggregate of *sold* listings over the previous week and `mid` is the
  median of that same sold set — both come back null whenever a card
  simply hasn't sold that week, which is common for an expensive,
  low-volume chase card even while it has real active *listings* (which is
  what `low`/`high` reflect instead, since those are listing-based, not
  sale-based). `pokemonTcgplayerPrice` now falls back further, in the same
  most-reliable-first order (`market` → `mid` → average of `low`+`high` →
  whichever of `low`/`high` alone is present), so a real listing-based
  estimate surfaces instead of "no price data" whenever a card just hasn't
  had a sale recently. Scoped to Pokemon only, matching every other
  provider-specific fix in this doc — Scryfall/YGOPRODeck/Lorcast/the
  Egman-backed games each report a single flat price field with no
  equivalent sold-vs-listed split to fall back through.
  **Real-world retest after this fix still found Mega Gengar ex with no
  price** — the low/high fallback is a real, defensible improvement per
  TCGPlayer's own documented pricing model, but it can only surface a price
  that exists somewhere in the four sub-fields; it can't be confirmed to be
  the actual cause of this specific card's gap without inspecting a live
  response (`c.tcgplayer`), which this sandbox has no network path to (see
  the Manual QA note above — the same constraint that blocks Supabase also
  blocks pokemontcg.io directly). Left open pending either a pasted real
  API response for this print or confirmation of which message/candidate
  actually shows for it.
- **Possessive-name search ("Lillie's Clefairy ex", "Cynthia's Garchomp
  ex") hedges both apostrophe representations instead of committing to one
  theory** — the earlier fix (stripping a trailing `'s` outright, on the
  theory pokemontcg.io's index applies an English possessive filter) was
  real-world retested and still found unreliable. Without a way to inspect
  the live index from this sandbox, there's no way to confirm that theory
  over the alternative (the apostrophe needs to stay in the query
  literally). `searchPokemon` now tries both representations —
  `sanitizeStrippingPossessive` and the new `sanitizeKeepingApostrophe` —
  at every precision tier (set+number, number, set, exact phrase, unquoted)
  before ever falling through to the next, broader tier, so whichever one
  the index actually needs is found at the highest precision available
  instead of only being tried once everything else has failed. For a name
  with no apostrophe at all the two functions produce an identical string,
  so the common case still fires the same number of requests as before —
  this only doubles requests for the minority of possessive names, and even
  then only until one representation succeeds.
- **The dominant real cause of "search unreliable"/"no results" reports
  turned out to be pokemontcg.io's public tier being far flakier than a
  single retry could survive — not the apostrophe handling or the hint
  logic, which were both real but secondary.** Confirmed by directly
  querying `api.pokemontcg.io` by hand, repeatedly, for the exact queries
  this app sends: individual queries needed anywhere from 3 to 12
  *consecutive* 5xx responses before finally succeeding. The original
  "retry once" fix (added earlier in this doc) assumed occasional transient
  failures; against a streak that long, one retry gives up almost
  immediately, `searchPokemon`'s fallback ladder marks that tier "empty",
  and the search either lands on a broader/wrong-print tier or exhausts
  every tier and reports "no matches" — even when the exact right query
  would have succeeded on its 3rd or 4th try. `pokemonQueryUncached` now
  retries up to 3 times (4 attempts total) with a short backoff (400ms/1.0s/
  2.2s) instead of once, still only on a 5xx. This directly explains real
  reports that looked like search-logic bugs: a manually re-triggered
  search "just working" on a second attempt (observed for Lillie's Clefairy
  ex once Set/Number were correctly populated) was likely the API recovering
  between attempts, not the hints being the deciding factor.
  - **While diagnosing this, also directly confirmed two "no price data"
    reports are genuine, permanent data gaps on pokemontcg.io's side, not
    bugs**: Mega Gengar ex's Ascended Heroes print (`me2pt5-269`, Mega
    Attack Rare) has a `tcgplayer` object with only a `url`, no `prices` key
    at all; Lillie's Clefairy ex (`me2pt5-280`) has no `tcgplayer` field
    whatsoever. `pokemonTcgplayerPrice` already handles both correctly
    (returns `null`) — there's no client-side fix possible when the API
    itself never populated pricing for that exact print. A *different*,
    unrelated print of "Mega Gengar ex" in a different set did have real
    `market` pricing when found by a plain name-only query, confirming
    (again) that Pokemon commonly reprints the same name with wildly
    inconsistent price-data coverage per print — the existing "no per-
    condition pricing" acceptance in this doc extends to "no pricing at
    all for some individual prints," not just no per-condition granularity.
  - Also confirmed via direct query that "Ascended Heroes" alone (name +
    set, no number) returns 3 distinct real "Mega Gengar ex" prints
    (#125 Double Rare, #269 Mega Attack Rare, #284 Special Illustration
    Rare) — validating that Number remains the right disambiguator among
    same-name-same-set reprints, exactly as this doc has assumed throughout.
- **Manual TCGPlayer search link as a fallback for the two failure modes
  above** (search exhausts every retry and finds nothing, or finds a real
  card with no price data) — `tcgplayerSearchUrl(name, set)` in
  `cardSearch.js` builds a link straight to TCGPlayer's own search with the
  name/set already filled in, so staff aren't left with a dead end when the
  automated lookup can't help. Deliberately game-agnostic: it uses
  TCGPlayer's general `/search/all/product?q=...` results page (verified
  live, 2026-08-21 — a real, working URL) rather than a per-game category
  path like `/search/pokemon/product` — confirming the exact category slug
  for all 8 games this app supports without a real sample for each risks
  shipping a wrong one, and "all" is already confirmed correct for every
  game. Shown in `EditModal` right under the status line whenever
  `imageStatus.kind === 'err'` (covers both "no matches" and "found it, no
  price data" — both set that same `kind`), and in `ScannerPanel`'s
  `ScanRow` next to "Find another image" when `row.imageStatus === 'none'`
  and next to "Find market price" when no price is available
  (`row.pendingPrice == null`).
- **Scanner/EditModal: blocking modal during the post-scan image/price
  auto-fill, loading state + disabled state on every manual search button,
  and a "Search by name only" escape hatch** — three real-phone UX reports
  bundled into one pass since they share the same buttons/state:
  - The post-scan "Looking up images & prices" fill used to run with the
    review queue already fully visible and editable underneath it — staff
    could (and did) start correcting a row's name/set or toggling its
    image while the batch fill was still writing into that same row,
    racing it. Replaced the inline status line with a real, non-dismissible
    modal (`ScannerPanel`, same `.overlay`/`.modal` system as every other
    modal — z-index 1000 categorically covers and blocks clicks to
    everything below it) that shows only progress ("X of Y done") until the
    batch settles, then disappears on its own — no Cancel/backdrop-close,
    matching this app's explicit-button-only modal convention elsewhere,
    since there's nothing sensible to do mid-fill besides wait.
  - "Find stock image"/"Find market price" (`EditModal`) and "Find another
    image" (`ScannerPanel`'s `ScanRow`) already disabled themselves (or, for
    ScanRow, now newly disable themselves) while their own search is in
    flight, but gave no visible feedback beyond that — real testing reported
    this as "taking too long" with no way to tell if a click had registered.
    Each button's own label now switches to a spinner + "Searching…" while
    its specific search runs (`EditModal`'s `activeSearch` state, `ScanRow`'s
    existing `row.imageStatus === 'searching'`), and every *other* search
    button for that same item/row is disabled meanwhile too — a double-tap
    or a click on a sibling button can't fire a second overlapping search.
  - **"Search by name only", added then removed**: staff reported that a
    wrong Set/Rarity/Number hint can steer the search onto the wrong print,
    and once picked, that wrong print's own data backfills those same
    fields (Sprint 1's behavior), compounding the mistake on any retry
    using the same hints. Added as an explicit, opt-in per-click escape
    hatch — a second button next to each "Find stock image"/"Find market
    price"/"Find another image" that searched by name only for that one
    attempt, without touching the Set/Rarity/Number field values
    themselves — deliberately distinct from the earlier blanket
    name-only-search regression (which removed hints for *every* search
    and lost real disambiguation entirely). After real use with the
    retry-budget fix and the manual TCGPlayer link both in place (both
    below), staff found the extra button redundant and potentially
    confusing: clearing the Set field yourself and re-clicking the regular
    search button does the same thing, more transparently (you can see and
    control exactly what's being ignored, rather than a second button whose
    behavior has to be remembered). Removed — `runFindImage`/
    `runFindMarketPrice` (`EditModal`) and `findAnotherImageForRow`
    (`ScannerPanel`) no longer take a `clean` parameter.
- **Market Value (Sprint 5)** is never stored — `catalog.base_price` (the NM
  reference price captured from whichever search candidate staff actually
  selected) is the only new column; Market Value itself is computed live in
  the UI as `base_price × condition multiplier` (`marketValueForCondition`
  in `cardUtils.js`), so it can't go stale if the condition changes later.
  `price` keeps meaning what it already meant ("Our Price") — no rename.
  Condition multipliers live in a `store_settings` singleton row, editable
  via the "Pricing settings" link in the footer, defaulting to the
  NM100/LP85/MP65/HP45/DMG25 table decided earlier. The condition field
  stays free text; `canonicalizeCondition` fuzzy-matches it onto one of the
  five tiers for multiplier lookup only. Two independent soft, non-blocking
  toasts warn at save time: `priceOrderingWarning` (App.jsx) if an item's
  price breaks condition ordering against another *physical copy* of the
  same card in the same location, and `priceVsMarketValueWarning` (App.jsx)
  if Our Price diverges more than 15% from *this card's own* computed
  Market Value — a different kind of check (one compares inventory copies
  against each other, the other compares a price against the estimate).
  Neither blocks the save; deliberate pricing decisions are expected. One
  Piece/Riftbound/Gundam (Egman-backed) now have pricing too — Egman's
  `/api/prices/<game>` endpoint (confirmed by a real sample, joined to
  `/api/cards/<game>` by `card_code`; see the `card-lookup-proxy` note
  below). The Scanner's per-row Market Value is revealed by an explicit "Find
  market price" action, not fetched automatically — it reads whatever
  price/listing was already returned alongside the currently-selected
  image (auto-picked, or chosen via "Find another image"), so confirming
  the right card via the image is what gates seeing/trusting a price at
  all, with no extra network call needed since that data's already there.
- **EditModal's "Find market price" button moved into the Quantity &
  pricing section** (out of the image area's `.img-actions` row) — staff
  found its old spot next to "Find stock image" confusing, since it reads
  the same name/game/set/rarity fields but runs an independent search, not
  something tied to the image. The button, its underlying
  `handleFindMarketPrice` search, and `selectCandidate`'s `candidateMode
  === "price"` branch (still never touches either image slot) are
  unchanged — only where the button and its resulting status line/
  candidate grid render moved, gated on the same `candidateMode` state
  that already existed to distinguish an image-search result set from a
  price-search one. Picking a stock image via "Find stock image" still
  auto-backfills Market Value as a bonus, same as before — the new button
  is for refreshing/backfilling that price independently, without needing
  to touch (or already have) an image.
- **pokemontcg.io's key-less public tier occasionally returns a transient
  5xx** (real-world example: a card search for "Alolan Exeggutor ex" in
  "SV08: Surging Sparks (SSP)" hit a 500 then a 502 back to back) — before
  this fix, `pokemonQuery` (`cardSearch.js`) silently treated any
  non-`ok` response as "zero results," so a real API failure got
  misreported to staff as "No matches found" instead of a real error, and
  `searchPokemon`'s fallback ladder would then burn through 3 more
  requests against an endpoint that was already failing. `pokemonQuery`
  now retries once (600ms) on a 5xx before giving up, and throws instead of
  swallowing a failure that survives the retry, so EditModal's
  `handleFindImage`/`handleFindMarketPrice` catch it and show an honest
  "couldn't reach the database, try again" message rather than a
  misleading "no matches." A 4xx isn't retried (a bad query won't succeed
  on a second try). Doesn't touch Scryfall/Yugioh/Lorcana/the proxy-backed
  games — scoped to the one provider a real report came in for, same
  discipline as the Pokemon-only scan-accuracy work above.
- **ScannerPanel's post-scan image auto-fill is concurrency-capped, not
  unbounded** (`runWithConcurrency`, cap 3 — same helper CSV import already
  used for the same reason) — found via a real-phone test scan where a
  card's automatic image/price fill silently came up empty, but manually
  retrying that one row via "Find another image" immediately succeeded.
  Root cause: `handleScan` used to fire one search per detected card on the
  page all at once with no cap — a full 9-card page can mean 30+
  simultaneous requests against pokemontcg.io's key-less tier (each card's
  search can itself fire up to 4 fallback queries), which is exactly the
  kind of burst that tier's rate limiting/5xx-proneness (see above) hits
  hardest. A manual single-row retry doesn't compete with that burst, which
  is why it worked when the automatic pass didn't.
- **The condition-multiplier estimate can be materially wrong for
  high-value cards** — a flat percentage is a population average, not any
  specific card's real going rate, and a real example (M Rayquaza EX,
  XY-Roaring Skies) showed the HP estimate ~$13 under the real TCGPlayer HP
  price. True per-condition pricing still requires TCGPlayer's own
  partner-gated API (see below) — until/unless that's available, the
  mitigation is a direct link to the card's real TCGPlayer listing
  (`purchase_uris.tcgplayer` on Scryfall, `tcgplayer.url` on pokemontcg.io —
  both already returned by the same search call used for the image, no
  extra fetch), auto-captured into `sourceUrl`, plus a visible warning in
  the Edit modal/Scanner above a $25 base price nudging staff to check the
  real listing before pricing anything expensive — especially in a batch,
  where the same misestimate repeats across every copy. YGOPRODeck/Lorcast/
  SWU don't carry an equivalent direct-listing link today.

## Known constraints / accepted risks

- **Fixed**: `xlsx@0.18.5`'s two known vulnerabilities (prototype pollution,
  ReDoS) — `package.json` now points `xlsx` at SheetJS's own patched CDN
  build (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) instead of
  the vulnerable npm release (PR #11). One lasting nuance, not a
  vulnerability: `npm install`/`npm ci` needs outbound access to
  `cdn.sheetjs.com` specifically to resolve this dependency — confirmed
  working on GitHub Actions' runners (that's what the deploy workflow's
  `npm ci` step does on every run), but it'll fail in any environment
  without that egress (e.g. a network-restricted sandbox).
- TCG Player's **draft catalog accepts a bulk .xlsx/.csv upload for new
  products**, not just existing listings (confirmed by hands-on
  investigation, not docs) — corrects the earlier assumption that Export
  could only produce manual-entry-aid lists for TCG Player. Building the
  actual upload-ready export format is next up — see "Next sprints" below.
  Collectr still has no bulk-upload/bulk-create API found for this app;
  that part of Export stays manual-entry-aid only until/unless that
  changes.
- Card image/price search (`cardSearch.js`) covers Magic, Pokemon, Yu-Gi-Oh,
  Lorcana, One Piece, Riftbound, Gundam, and SWU. Sports Singles has no
  lookup — an accepted **drawback**, not a risk: no card database exists
  for it at all, so there's nothing to integrate against, not an
  unmitigated danger. Findings from Sprint 4,
  live-tested from the browser console/Postman — not just docs research,
  since CORS can't be verified any other way:
  - **Lorcana** — Lorcast (`api.lorcast.com`), free/no-key, confirmed
    CORS-safe for direct browser calls. Called directly from the client.
  - **One Piece**, **Riftbound**, and **Gundam** — all go through
    `card-lookup-proxy` (a Supabase Edge Function, same pattern as
    `scan-binder-page`), routed to **Egman's deckbuilder**
    (`deckbuilder.egmanevents.com/api/cards/<optcg|riftbound|gundam>`) — a
    one-person hobby project with no published API/ToS, used with his
    explicit go-ahead (asked via his X/Twitter account before building on
    it, given it's his app's internal backend rather than a documented
    public data source). The endpoint returns each game's full card list
    with no filter param, so the proxy fetches once and does the name match
    itself rather than guessing at an undocumented filter syntax. Pricing
    for these three comes from the same backend's `/api/prices/<game>`
    endpoint (confirmed by a real sample: `market_price`, `low_price`
    unused for now, and `tcgplayer_url` — a direct real-listing link, same
    role as Scryfall's/pokemontcg.io's), joined back to the card list by
    the `card_code` field both endpoints share.
    `optcgapi.com` (a real, documented One Piece API) was evaluated and
    rejected — confirmed CORS-blocked *and* has no search-by-name endpoint
    at all, only per-card-ID lookups.
  - **SWU** — real API at `api.swu-db.com` (note: `api.`, not `www.` — the
    docs page lives at `www.swu-db.com/api` but the API itself is on a
    different subdomain; `www.swu-db.com/cards/search` 404s). Confirmed
    CORS-blocked, routed through the same proxy — response fields confirmed
    by a real sample: array at `data.data`, fields `Name`/`FrontArt`/`Set`,
    plus `MarketPrice`/`LowPrice` (unused for now, but relevant to the
    Market Value feature later).
  - Piltover Archive (a Riftbound-specific fan database) was evaluated and
    rejected as an image source — its image URLs live under a `/temporary/`
    path with what looks like a signed-upload hash, suggesting they expire
    and aren't safe to store/reuse long-term.
- **Disambiguating same-name prints**: several games reuse a card's name
  across many separate prints (alt art, promos, Gundam's base-set generics
  like "EX Base" shared by dozens of unrelated cards) — a name-only search
  can't tell them apart, and a small result cap just cuts off whichever
  prints sort last. Every search function that supports it now takes an
  optional `setHint` (the item's own `set` field, which for the Egman-backed
  games doubles as wherever a printed set/card code the scanner read off the
  card ends up) to narrow results, alongside a raised candidate cap (20, not
  6) and labels that include the disambiguating info (card code + rarity for
  Egman games, collector number for Pokemon) so same-name prints are at
  least visually distinguishable even when the hint doesn't fully narrow it.
  Falls back to the unnarrowed name match if the hint doesn't match anything
  (typo, or no hint given) rather than returning empty. Scryfall/Yugioh/
  Lorcana weren't touched — Magic already has its own number-based
  disambiguation, and per-name collisions are much rarer for Yu-Gi-Oh/
  Lorcana.
- No per-condition market pricing exists in any free card-data API — every
  one (Scryfall, pokemontcg.io, YGOPRODeck, Lorcast, etc.) exposes a single
  NM-level aggregate price. True per-condition pricing requires TCGPlayer's
  own partner-gated Pricing API. Scraping vendor sites (eBay, CoolStuffInc,
  Star City Games, Troll and Toad) was evaluated and rejected — no real
  per-condition data gain, and most explicitly ban scraping in their ToS.
- **TCGPlayer Pricing API is frozen** (parked the same way as Phase 4/Cumulus
  below) — new applications have been closed since late 2024, and while
  existing seller API keys reportedly keep working, we don't yet know if
  this shop has one. No further work on this path until/unless a real
  credential surfaces. The Market Value feature (Sprint 5) instead derives
  non-NM prices from one NM baseline price via a configurable
  condition-multiplier table, defaulting to **NM 100% / LP 85% / MP 65% /
  HP 45% / DMG 25%** — anchored to CrystalCommerce's confirmed 100%/50%
  NM-to-Damaged default (the one concrete vendor-published anchor found;
  TCGPlayer itself ships no fixed percentage table since it prices each
  condition from real sales data) and centered on community-cited ranges.
  Store-configurable, not hardcoded.
- Phase 4 (a Cumulus POS SKU manager/import) is parked — needs the shop
  owner's go/no-go and a real Cumulus export/import file sample. Never guess
  Cumulus's file format.

## Mobile polish round 3 (continued real-phone findings)

Another round of live phone-testing feedback on top of round 2 above.

- **A fixed-position toast with no `pointer-events: none` still blocks
  clicks underneath it, even at `opacity: 0`** — opacity alone doesn't
  remove an element from hit-testing. `.toast` sits `position: fixed;
  bottom: 20px` centered, which is exactly where the footer (and its
  "Pricing settings" link) ends up once a page is scrolled to the bottom —
  so the first toast that ever fired (e.g. "Pricing settings saved" itself)
  left an invisible box permanently eating clicks in that screen region,
  matching the exact reported symptom ("the link is broken until I
  refresh" — refreshing just hadn't happened to re-trigger a toast yet at
  the moment they checked). Reproduced empirically with a throwaway
  Playwright harness before fixing (real click at the link's coordinates,
  toast fired first) — confirmed the click landed on `.toast`, not the
  link. Fixed with `pointer-events: none` on `.toast` — nothing inside it
  is ever clickable, so there's no reason for it to intercept anything.
- **EditModal's image area reworked**: the Real-photo/Stock-image toggle
  and the Find stock image/Find market price/Upload real photo/URL-paste
  actions used to stack as separate full-width blocks below the image on
  mobile (`.img-preview-wrap{flex-direction:column}`), which read as too
  tall/scrolly and left those actions hugging the left edge (missing
  `align-items` on the now-vertical cross-axis). Restructured so the
  toggle + actions share one new container (`.img-side`) that sits beside
  `.img-frame.large` in a row, on *both* desktop and mobile — removed the
  mobile column override entirely rather than patching its alignment,
  since "a lot of stacking" was the actual complaint. `.img-side`'s
  children default to stretching full width of that column, which
  incidentally also fixed the separate "buttons positioned to the left"
  report (a full-width button isn't left-hugging, and button text is
  center-aligned by default anyway). `.img-preview`/`.img-preview-empty`
  shrink a bit further (72×100, was 90×126) under the mobile breakpoint so
  `.img-side` has room for its button text next to the smaller image.
  - **First attempt at this still squashed the buttons**: the "Find stock
    image"/"Upload real photo" explainer paragraph originally stayed inside
    `.img-preview-wrap` as a third child — since that wrap is a flex *row*
    (image | `.img-side`), a third flex item squeezed `.img-side` down to
    almost nothing, the opposite of the fix's intent. Moved the explainer
    out to its own dismissible `.info-banner` (blue background, a ✕ to
    close, local-only state that resets next time the modal opens) below
    the whole image row instead of inside it.
- **`.img-candidates` (the search-result thumbnail grid) does *not* reorder
  by breakpoint** — a round-3 attempt moved it after the form sections on
  desktop via CSS `order`, on the theory that the grid is secondary to the
  fields staff are editing. Real feedback said otherwise: it should stay
  right after the image on both desktop and mobile, same position it was
  already in. Reverted — removed the `order` rule and the scoped
  `.modal-body-reorder` wrapper class entirely rather than leave unused CSS
  behind.
- **Scanner's file input gained a second, explicit "Take a photo" button**
  wired to its own `<input type="file" capture="environment">`, alongside
  the existing capture-less input (still the default click target, for
  choosing an existing photo). Round 2 removed `capture="environment"`
  entirely to restore the OS's native chooser (Camera/Library/Files) after
  it was found to skip straight to the camera — but real-phone testing
  found some mobile browsers' default chooser doesn't reliably surface a
  camera option at all without that attribute. Two explicit buttons sidesteps
  relying on OS-chooser behavior that varies by browser/version instead of
  re-introducing the original bug.
- **Edge Function CORS was exact-match on `localhost` only** —
  `scan-binder-page`/`card-lookup-proxy`'s `ALLOWED_ORIGINS` allowlist never
  matched a phone testing against `npm run dev -- --host` (needed to reach
  the dev server from a phone on the same LAN), since that serves from a
  private-IP origin, not `localhost` — explaining why the exact same scan
  worked from a laptop (`http://localhost:5173`) but failed only from a
  phone on the same network ("Failed to send a request to the Edge
  Function"). Added `DEV_ORIGIN_RE`, a regex matching any RFC1918 private
  range (`192.168.x.x`/`10.x.x.x`/`172.16-31.x.x`) plus `localhost`/
  `127.0.0.1` on Vite's dev/preview ports (5173/4173), alongside the
  existing exact-match list — duplicated in both functions, matching this
  codebase's existing convention of not sharing code between them.
  **Requires redeploying both `scan-binder-page` and `card-lookup-proxy`**
  to take effect.
- **Rarity field extended to EditModal and CSV/XLSX import** — was only on
  ScannerPanel's review rows before. EditModal gets the same transient,
  never-saved input (next to Set) feeding `handleFindImage`/
  `handleFindMarketPrice`'s `rarityHint` param. Import gets a new
  `FIELD_TARGETS` entry (`rarity`) in `importParse.js`; `ImportExportPanel`
  keeps the mapped column in a separate `rarityHints` array (indexed the
  same as `newRows`, never attached to the `normalizeCard` objects
  themselves) purely to pass into the per-row auto image search — same
  "never let a transient search hint leak into what's actually saved"
  discipline as the Scanner.
- **Known limitation, not fixed**: on mobile, selecting a multi-sheet `.xlsx`
  file for Import auto-loads the first sheet instead of showing the sheet
  picker — desktop shows the picker correctly. This is what the earlier
  "returns to the main view" report actually was: not a crash, just the
  sheet-picker step being silently skipped, which read as "nothing
  happened" on a phone. Root cause not yet isolated (couldn't reproduce with
  several synthetic multi-sheet test files against both `xlsx@0.20.3` and
  `0.18.5` through the real dev server on desktop — the mobile-specific
  trigger is still unknown). Deliberately parked rather than guessed at, per
  this project's never-guess discipline — revisit with either a real device
  repro or the actual file involved.

## Staff documentation

A standalone, no-login reference page — not an in-app help tab — so staff
can pull it up on a phone before ever signing in, bookmark it, or print it.

- **Routing**: same pattern as the public binder page — `src/main.jsx`
  checks `?help=1` (alongside the existing `?binder=`) and renders
  `<StaffDocs/>` with no `UIProvider`/session check, same reasoning as
  `BinderView.jsx`. Reached from a "Staff docs" link in the main app's
  footer (`target="_blank"`, next to "Pricing settings"/"Sign out") so
  opening it never interrupts an in-progress edit/import/scan.
- **`src/components/docs/StaffDocs.jsx`**: the page shell — reuses
  `.app`/`.topbar`/`.brand` for the same visual identity `BinderView.jsx`
  already uses, plus a sticky left nav beside the content column
  (collapses to a wrapped row of pill links above the content under the
  shared 640px mobile breakpoint — no room for two columns there).
  **Shows exactly one section at a time**, driven by the URL hash — not one
  long scrolling page. The first pass used in-page jump-link anchors on a
  single page, but staff wanted to be able to jump straight to what they
  need without scrolling past everything else, or read straight through via
  a Previous/Next stepper at the bottom without losing their place. Every
  nav/stepper link is a real `#hash` anchor rather than a click handler —
  `hashchange` is what drives which section renders, so browser back/
  forward and a directly-linked/bookmarked URL (e.g. `?help=1#scan-binder`)
  both just work for free; a missing/unrecognized hash falls back to the
  first section. The last section's "Next" loops back to the first instead
  of a dead end. Cross-reference links inside a section's own prose (e.g.
  Catalog's "see Selling an item") are plain `#hash` links too, so they now
  jump straight to that section instead of just scrolling to it.
- **`src/components/docs/sections/*.jsx`** — one file per topic (Getting
  started, Catalog, Editing an item, Selling an item, Sync Queue,
  Import/Export, Scan Binder, Pricing settings, the public binder page,
  Concepts & glossary, Known quirks), each a `<DocsSection>` with real
  field/button labels from the actual UI. Deliberately split this way so a
  future feature (e.g. the TCG Player export below) only means adding a
  paragraph to one existing section file — nothing else about this page
  changes.
- **`src/components/docs/DocsSection.jsx`** / **`DocsCallout.jsx`**: the two
  shared pieces every section is built from — a titled `<section>` wrapper,
  and a small note/warning callout box (`.docs-callout-note`/`-warn`) for a
  behavior worth flagging inline rather than burying in the glossary.
- The "Known quirks" section doubles as a living list of this doc's own
  "not a bug" answers — e.g. the mobile multi-sheet `.xlsx` sheet-picker
  issue noted above, Reset All Data being irreversible and shared, editing/
  selling resetting the P/T/C status chips. Update it alongside whatever
  section documents a quirk's actual feature area.
- `e2e/staff-docs.spec.js` follows the existing suite's conventions — loads
  `?help=1` with no `seedHarness` call at all (the page never touches the
  database), asserts every section heading renders and that a nav
  jump-link actually scrolls to its section.

## Next sprints

- **TCG Player draft-catalog export**: TCG Player's draft catalog accepts a
  bulk .xlsx/.csv upload for *new* products, not just updates to existing
  listings — confirmed by hands-on investigation (see Known constraints
  above), correcting the earlier "manual-entry-aid only" assumption Export
  was built around. This sprint builds an actual upload-ready export format
  for TCG Player specifically. Get the real required column layout/format
  before building — same "never guess an external platform's file format"
  discipline that's applied everywhere else in this project. Once built,
  add a paragraph to `ImportExportSection.jsx` in the staff docs above —
  that's the only doc change it needs.
- **Scan review UX, staged plan** (agreed after the real-phone round-2
  findings above) — Sprint 0 (rarity word-order/temperature/apostrophe
  fixes) and Sprint 1 (backfill from a confirmed candidate) are done;
  these are next, in order, each independently shippable. Every one
  applies equally to EditModal and ScannerPanel — this app has no separate
  "scanner-only" vs. "catalog-only" field behavior, and these shouldn't be
  the first exception:
  - ~~1. Backfill Number/Set/Rarity from a confirmed stock-image pick~~ —
    done. `pokemonQuery`'s candidates now carry structured `set`/`number`
    (previously only baked into the display label); picking a candidate in
    either EditModal's `selectCandidate` or ScannerPanel's per-row grid now
    overwrites the item's Set/Number/Rarity with that print's own values
    whenever the candidate actually carries them (a no-op for every
    non-Pokemon game today, which don't populate those fields). EditModal
    gained a Number scratch field to match ScannerPanel's, which already
    had one. Stays valuable independent of the name-only-search experiment
    above (tried and reverted) — confirming a candidate visually and
    trusting *that print's* real Set/Number/Rarity is a good source of
    truth for those fields regardless of how the search itself is hinted.
  ~~2. Rarity as a real `<select>`, not a `<datalist>`~~ — done. The
     datalist's browser-native filtering hid suggestions once the field
     already had a non-matching value typed, which wasn't the "always show
     me every option" behavior wanted here. Extracted `LocationPicker`'s
     select-plus-"add new" escape hatch into a new shared, generic
     `src/components/SelectWithCustom.jsx` — `LocationPicker` is now a thin
     wrapper over it (same external prop API, unchanged for its own
     callers), and both `EditModal`'s and `ScannerPanel`'s Rarity fields use
     it directly with `RARITY_OPTIONS_BY_GAME[game]` as the option list.
     Extracted rather than copy-pasted since this exact pattern is reused
     twice more below (Condition, Foil). Two behaviors added that
     `LocationPicker` didn't need before: (1) an empty options list (every
     non-Pokemon game today) skips straight to the free-text input instead
     of forcing a "+ Add new" click first, since there's nothing real to
     select from — matters here far more than for `LocationPicker`, where
     locations are rarely empty; (2) a `useEffect` re-opens that same
     escape hatch if `options` shrinks to empty *after* the picker already
     mounted in select mode — the concrete case being Rarity's options
     depending on the Game field, which staff can change after Rarity is
     already showing a dropdown for a different game.
  ~~3. Condition dropdown~~ — done. Same `SelectWithCustom` pattern as
     Rarity above. Options are the five tiers' full names ("Near Mint",
     "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"),
     not the short codes — each is already a recognized
     `canonicalizeCondition` alias for its tier (a test asserts this
     round-trip explicitly, so the dropdown can never offer a name the app
     itself wouldn't recognize), and full names read better than a bare
     code in a plain-text context like `CatalogTable`'s subtitle line. New
     `CONDITION_TIERS`/`CONDITION_OPTIONS` in `cardUtils.js` are the single
     source for these names — `SettingsModal`'s per-tier multiplier rows
     (which need the short codes alongside the names, e.g. "Lightly Played
     (LP)") now derive their labels from `CONDITION_TIERS` too instead of
     keeping a second hardcoded copy that could drift out of sync. Unlike
     Rarity, `CONDITION_OPTIONS` is never empty (fixed, game-independent
     list of 5), so the free-text escape hatch only opens for a value
     that's already a custom/legacy one — notably including plain "NM"-
     style short codes on existing items, since the dropdown's options are
     the full names, not the codes.
  ~~4. Printing/finish ("foil") dropdown~~ — done, UI only, no new
     scan-side recognition. Same `SelectWithCustom` pattern again; new
     `PRINTING_OPTIONS_BY_GAME` in `cardUtils.js` (Pokemon only, matching
     `POKEMON_PRICE_VARIANTS`' Normal/Holofoil/Reverse Holofoil/1st Edition
     Normal/1st Edition Holofoil — confirmed real via live API responses
     seen this session, not guessed) is the curated list. Two things
     researched and deliberately left out, to avoid two different kinds of
     mistake:
     - **Poke Ball/Master Ball/Love Ball/Friend Ball/Quick Ball/Dusk
       Ball-style reverse holo patterns** — real, and a genuine printing/
       finish distinction (same collector number as the plain card, just a
       different foil treatment): Prismatic Evolutions (Jan 2025)
       introduced Poke Ball + Master Ball; Ascended Heroes (Jan 2026 — the
       exact set Mega Gengar ex/Lillie's Clefairy ex are from, above)
       expanded this to five ball types. Not added as dropdown options
       because the vocabulary keeps growing with every new set and would
       need permanent upkeep — staff enter these through the free-text
       escape hatch instead. Confirmed with the user before implementing,
       given it's a real trade-off (dropdown completeness vs. maintenance).
     - **"Shadowless"** — looks like a finish variant but isn't modeled as
       one on TCGPlayer: it's a separate Set category ("Base Set
       (Shadowless)"), distinct from "Base Set" itself, not a
       printing/finish flag on the same card. Belongs in the Set field
       (already free text) — including it here would have been a real
       modeling mistake, not just an omission.
     - Also fixed a related inconsistency found while implementing this:
       `ScannerPanel`'s `detectedToRow` was still pre-filling `printing`
       from the scan's own `foil` boolean guess (`card.foil ? 'Foil' :
       ''`) — a leftover from before this "don't have the model guess
       foil type" decision was made, and one `ScanRow` had no UI to
       correct anyway (Printing/finish wasn't shown there at all before
       this sprint). Now starts blank, client-side only — no Edge Function
       change, no redeploy needed.
  **Future enhancements (parked, not scheduled)**: Set-symbol accuracy
  (near-always blank in real testing — tiny icons buried in busy full-art
  illustrations; fixing this for real would mean deterministic icon
  matching against a reference library, a much bigger investment for a
  field that's already low-yield) and Japanese-print price coverage
  (pokemontcg.io is English-print-focused; a name search on a Japanese
  card can surface the English equivalent's image with no matching price
  data — no verified alternative data source yet, don't guess one).

## Rarity/Condition/Printing catalog filters, Rarity persistence

- **Rarity is now a real, saved catalog attribute** (`catalog.rarity`,
  `phase7_rarity_column.sql`) — before this it only ever existed as a
  transient scratch/search-hint field in `EditModal`/`ScannerPanel`,
  discarded on save (confirmed by checking `normalizeCard`, `db.js`'s row
  mapping, and the schema — none of them had a `rarity` field at all).
  Explicitly confirmed with the user before persisting it, since "add a
  Rarity filter" implicitly meant "start saving Rarity," a bigger change
  than a filter alone. `EditModal`'s `rarity` state was folded into
  `form.rarity` (previously separate from the saved `form` object
  entirely) — it still does the same job of narrowing Find stock image/
  Find market price, it just also persists now. `ScannerPanel`'s
  `row.rarity` needed no such refactor (already part of the saved row
  shape); `handleConfirm` just needed one added line to actually include
  it. Deliberately NOT added to `catalog_public_view` (a staff-side
  disambiguation aid, not something the public binder page needs) or to
  `sync_queue` (unlike condition/printing, which get snapshotted onto a
  sold ticket because they factor into pricing, rarity plays no role in
  pricing or sync bookkeeping) — see the migration file for the reasoning.
  **Requires running `phase7_rarity_column.sql` in the Supabase SQL Editor**
  before this code can save/read Rarity — no code-side default masks a
  missing column here, so skipping the migration would surface as a real
  save error, not a silent no-op.
- **Catalog tab gained Rarity/Condition/Printing filters, shown only once
  a single game is selected** — an explicit ask, since these three are
  specific enough to one game's own vocabulary (a Pokemon rarity means
  nothing for Magic) that a combined-games list would just be noise.
  Options come from that game's *actual* catalog values (`Array.from(new
  Set(...))`, same pattern the existing Game/Location filters already use)
  rather than the curated `RARITY_OPTIONS_BY_GAME`/`CONDITION_OPTIONS`/
  `PRINTING_OPTIONS_BY_GAME` suggestion lists used for data entry — a
  curated value nothing in the catalog has yet would just be a dead-end
  filter, and this way any custom value staff typed through those
  pickers' free-text escape hatch (e.g. a specific Poke Ball/Master Ball
  pattern) shows up as a real, usable filter option too. A filter for any
  of the three simply doesn't render if that game has zero items with a
  value for it yet (rather than showing an empty, useless dropdown). All
  three reset to blank whenever the Game filter itself changes (including
  back to "all games") — a stale value from one game would otherwise
  either mean nothing for the new game or, worse, silently zero out every
  result with no visible explanation why.
- **`SelectWithCustom`'s "+ Add new…" option gets a distinct `#f2f2f2`
  background** (`.select-add-new-option` in `index.css`) to set it apart
  from the real, selectable values above it — applies everywhere the
  component is used (Rarity/Condition/Printing/Location). Native `<option>`
  background styling has patchy cross-browser support (some OS-native
  dropdown renderers ignore it), but it's a harmless, no-cost attempt
  where it does work.

## Per-game feature parity (Magic + Yugioh + One Piece + Lorcana + SWU + Riftbound + Gundam done)

A new multi-sprint initiative, one sprint per game, bringing every other
supported game up to the same depth of feature support Pokemon already has
(curated Rarity/Printing vocab, collector-number disambiguation, search
reliability hardening, scanner prompt tuning) — confirmed with the user as
**full parity**, not just "add the dropdowns." Order: Magic first, then
Yugioh, then One Piece, then Lorcana, then SWU, then Riftbound, then
Gundam (all done below) — completing the initiative (Sports Singles is
excluded — it has no card database to integrate against at all, a
documented drawback, not an oversight).

- **Magic (Sprint 1) — done.** Real research first (Scryfall's own API,
  confirmed via its type definitions/blog posts, not guessed), then wired
  through the same places Pokemon already uses:
  - `RARITY_OPTIONS_BY_GAME.Magic` (`cardUtils.js`): the six real Scryfall
    `rarity` values — `Common`/`Uncommon`/`Rare`/`Mythic Rare`/`Special`/
    `Bonus`. Special (timeshifted cards) and Bonus (bonus-sheet cards like
    Vintage Masters' Power Nine) are real, current values, not legacy-only
    — rare enough in practice that an exact pick still beats forcing free
    text every time one shows up.
  - `PRINTING_OPTIONS_BY_GAME.Magic`: the four real Scryfall `finishes`
    values — `Nonfoil`/`Foil`/`Etched`/`Glossy`. Deliberately excludes
    frame/border TREATMENTS (Showcase, Extended Art, Borderless, Full
    Art — Scryfall's separate `frame_effects` field) and marketing-only
    finish names (Secret Lair's "Rainbow Foil"/"Surge Foil") — same
    modeling trap as Pokemon's "Shadowless" exclusion: a treatment is a
    different attribute of the same finish, not a finish itself, and
    TCGPlayer doesn't list these as finish-dropdown values either.
  - **`searchScryfall` (`cardSearch.js`) gained `setHint`/`numberHint`
    params**, matching `searchPokemon`'s `(name, setHint, rarityHint,
    numberHint)` shape (previously only took `name, rarityHint` — `set`
    was never even passed through for Magic before this). An explicit or
    name-embedded (`"Card (1234)"`, the existing import convention)
    collector number is now tried FIRST, before the plain name search —
    same "number is the strongest disambiguator" priority Pokemon uses,
    and a real change from the old behavior (which tried the plain name
    first, falling back to a parsed number only as a last resort).
    **`setHint` is deliberately accepted but never turned into a `set:`
    filter** — Scryfall's `set:`/`s:`/`e:`/`edition:` operators only match
    a 3-4 letter set CODE (confirmed via its own syntax docs/examples,
    e.g. `e:ktk` not `e:Khans of Tarkir`), and this app's Set field holds
    whatever free text staff typed or the scanner read, essentially always
    a full name, not a code, with no lookup in this app from one to the
    other. Guessing a filter here risks silently zeroing out a correct
    match on a mismatch the code can't detect — same "don't guess an
    external platform's exact capability" call as everywhere else in this
    file. Accepted as a no-op parameter anyway so every game in
    `searchCardImage`'s dispatch table shares one `(name, setHint,
    rarityHint, numberHint)` shape.
  - **Reliability**: `scryfallQuery` now retries once on a genuine 5xx
    (Scryfall has no confirmed flakiness report the way pokemontcg.io
    does, so this is a lighter 1-retry safety net, not a copy of Pokemon's
    aggressive 4-attempt backoff) and throws on a persistent failure
    instead of silently returning `[]` — except a 404, which Scryfall's
    `/cards/search` uses as its real, confirmed "zero results" response,
    not an error, so it's mapped to `[]` without retrying or throwing.
    `searchScryfall`'s own tiers isolate a failure the same way
    `searchPokemon`'s do: a persistent failure on the number-hint tier
    falls through to the broad name tier instead of aborting the whole
    search; only the last tier's failure actually propagates.
  - **Pricing**: `scryfallPrice` now falls back through `usd` → `usd_foil`
    → `usd_etched` → `usd_glossy` (Scryfall's real four USD price fields,
    confirmed via its API blog post announcing them) instead of only ever
    reading `usd` — a foil-only or etched-only print (most often a Secret
    Lair drop) can have a null `usd` while still carrying a real price
    under one of the others, same reasoning as Pokemon's
    `POKEMON_PRICE_VARIANTS` fallback.
  - Scryfall's mapped candidate objects now also carry structured `set`/
    `number` fields (previously only baked into the label) — lets a
    confirmed pick back-fill the item's own Set/Number/Rarity fields for
    Magic too, the same Sprint-1-era backfill Pokemon already had.
  - **`scan-binder-page`'s rarity guidance now branches by game** — added a
    Magic-specific block (both in the tool schema's field description and
    `PROMPT_TEXT`) telling the model to read the small expansion symbol's
    COLOR on the type line, not overall visual style the way Pokemon
    works: black/white = Common (also basic lands, which print no
    symbol), silver = Uncommon, gold = Rare, red-orange = Mythic Rare
    (doesn't exist pre-2008), purple = Special (Time Spiral timeshifted
    only), glowing/prismatic = Bonus. A new catch-all line covers every
    other game: leave rarity blank unless an exact tier name is legibly
    printed, since the visual-guessing rules are only verified for Magic
    and Pokemon. **Requires redeploying `scan-binder-page`**
    (`supabase functions deploy scan-binder-page`) — schema/prompt changes
    are server-side.
  - `EditModal`/`ScannerPanel` needed no changes beyond a placeholder-text
    tweak (the Number field's example was Pokemon's "280/217" format only
    — now reads "150, or 280/217") — both already passed `number`/`rarity`
    generically to every game via `searchCardImage`, and already rendered
    `RARITY_OPTIONS_BY_GAME`/`PRINTING_OPTIONS_BY_GAME` per the selected
    game, so adding Magic's entries to `cardUtils.js` was enough to light
    up the same dropdowns Pokemon already had.
- **Yugioh (Sprint 2) — done.** Real research first (YGOPRODeck's own API
  guide/a live response sample, plus community rarity guides for tiers a
  single sample didn't happen to include), then wired through the same
  places Pokemon/Magic already use:
  - **Structural finding that shaped everything else below**: unlike
    Scryfall/pokemontcg.io, a Yu-Gi-Oh card is ONE database entry covering
    every printing — a reprint doesn't get its own card object, it's just
    another entry in that one card's own `card_sets` array (each with its
    own `set_name`/`set_code`/`set_rarity`/`set_price`). So there's no
    "wrong print returned" problem to fix the way Magic/Pokemon have (a
    fuzzy name search already finds the right card); the real
    disambiguation need is picking WHICH of that one confirmed card's
    `card_sets` entries to surface a price/rarity/set from, not which card.
    This meaningfully narrowed this sprint's scope versus Magic's.
  - `RARITY_OPTIONS_BY_GAME.Yugioh` (`cardUtils.js`): thirteen real, common
    tiers (Common through Quarter Century Secret Rare) confirmed against a
    real `card_sets[].set_rarity` sample ("Secret Rare"/"Ultra Rare" as
    exact Title Case strings) plus community rarity guides for the higher
    tiers. Deliberately excludes Parallel Rare variants (Duel
    Terminal-exclusive) and region-specific OCG-only tiers — same
    "ever-expanding niche vocabulary belongs in the free-text escape hatch"
    call as Pokemon's Poke Ball pattern exclusion.
  - `PRINTING_OPTIONS_BY_GAME.Yugioh`: `1st Edition`/`Unlimited Edition`/
    `Limited Edition` — confirmed via Yugipedia's edition pages and
    TCGPlayer's own price-guide edition options. Unlike Magic/Pokemon,
    rarity already implies a Yu-Gi-Oh print's foil treatment (an Ultra Rare
    is always name+art foil, full stop) — there's no independent foil/
    nonfoil axis to capture here. Edition is the real, separate printing
    distinction instead, and it's an evergreen 3-value list, not a
    per-set-expanding one, so no exclusion-list caveat is needed.
  - **`searchYugioh`/`ygoQuery` (`cardSearch.js`) gained `setHint`/
    `rarityHint`/`numberHint` params** (previously took only `name`).
    `numberHint` maps to the printed set code (e.g. `LOB-005`, visible
    bottom-left on every real card) — a near-global unique key, so it's
    tried first; `setHint`/`rarityHint` are softer fallbacks. All three are
    soft, local, best-effort matches against the card's own already-
    returned `card_sets` array (`pickYugiohSetEntry`) — never a server-side
    filter — so a wrong/mismatched hint can never zero out a real result,
    same discipline as `preferRarity`. A confirmed pick's `set`/`rarity` now
    also back-fill the item's own fields, same Sprint-1-era backfill
    Magic/Pokemon already had (no `number` backfill — Yu-Gi-Oh's set code
    is tied to one specific printing, not a stable "the item's own number"
    the way Magic/Pokemon's collector number is).
  - **Deliberately stayed off `tcgplayer_data=yes`** — that mode
    additionally unlocks `set_edition`/`set_url` (which would otherwise
    backfill Printing and provide a listingUrl), but YGOPRODeck's own docs
    warn TCGplayer's Set Name/Rarity data under that mode "have occasionally
    made up Rarity names in the past and don't always conform to correct
    Card Set Names." Since accurate Set/Rarity backfill matters more than
    an extra listing link, this sticks with the default (reliable) internal
    data — no listingUrl for Yugioh today; the existing game-agnostic
    manual TCGPlayer search link already covers that gap the same way it
    does for every other provider that lacks one.
  - **Reliability**: `ygoQuery` now retries once on a genuine 5xx (same
    lighter 1-retry pattern as Scryfall — no confirmed flakiness report for
    this API either). Unlike Scryfall's confirmed-404 or pokemontcg.io's
    live-tested behavior, this API's exact "no results" status code isn't
    confirmed — rather than guess, a persistent non-5xx failure still
    returns `[]` (the original behavior) instead of throwing, so as not to
    misreport a real "no matches" as an error on unconfirmed information.
  - **`scan-binder-page`'s number/rarity guidance now branches for Yu-Gi-Oh
    too** — the printed set code's location/format (e.g. `LOB-005`, a
    global unique key, unlike a bare number), and rarity guidance based on
    WHERE the foil treatment sits (name-only/art-only/both/embossed/
    diagonal-rainbow/gold/ghostly, for Common through Ghost Rare) rather
    than overall art style. The five rarest tiers (Platinum Secret Rare
    through Quarter Century Secret Rare) are explicitly called out as
    visually similar enough to each other that the model should leave
    rarity blank rather than guess between them without a very clear photo.
    **Requires redeploying `scan-binder-page`** — schema/prompt changes are
    server-side.
- **One Piece (Sprint 3) — done.** Real research first (Bandai's own
  card-list site plus cross-referenced community rarity guides, since
  Egman's deckbuilder API itself has no public docs to research against —
  the shape of its response was already confirmed in an earlier sprint),
  then wired through the same places Pokemon/Magic/Yugioh already use:
  - **Structural finding**: a One Piece card's full printed code
    (`<set letters>-<number>`, e.g. `OP01-001` or `ST01-001` for a starter
    deck) is printed as ONE unit in the card's bottom-RIGHT corner, right
    next to a short rarity letter code (e.g. `OP01-121 SEC`) — a different
    layout from every other game done so far (Magic/Yu-Gi-Oh both use the
    bottom-LEFT corner). An expansion NAME is rarely printed on the card
    itself, unlike Magic/Pokemon, so the Set field's real content for this
    game is the set-code prefix (`OP01`), not a human-readable name — matches
    Egman's own `card_code`/`set_code` fields, which are codes, not names.
  - `RARITY_OPTIONS_BY_GAME["One Piece"]` (`cardUtils.js`): nine real,
    confirmed rarity codes/tiers — `Common`/`Uncommon`/`Rare`/`Super Rare`/
    `Secret Rare`/`Leader`/`Special Rare`/`Treasure Rare`/`Manga Rare`.
    Treasure Rare (`TR`) is English/Chinese/French-only, debuting OP-06
    booster sets onward (Japanese releases get a different chase mechanic
    instead); Manga Rare (`MR`) is technically always also a Secret Rare
    under the hood, but carries its own distinct printed code and Oda-manga-
    panel artwork, so it gets its own list entry rather than folding into
    plain Secret Rare — same "give a nested-but-distinct tier its own
    entry" call as several of Pokemon's tiers.
  - **Deliberately excludes "Parallel"/"Alternate Art" from the rarity
    list** — research confirmed these are the SAME thing (collectors and
    TCGPlayer use both names interchangeably for a card marked with a small
    star above its rarity code), and it's an overlay applied on top of ANY
    of the tiers above (a Common, an SR, even a Leader can get one),
    changing only the artwork/foil pattern, never the card's stats or the
    base rarity itself — a genuinely separate axis, not a rarity tier, same
    rarity-vs-finish split Yu-Gi-Oh's edition field already established
    (just the opposite direction: Yu-Gi-Oh's separate axis is edition,
    One Piece's is this alt-art overlay).
  - `PRINTING_OPTIONS_BY_GAME["One Piece"]`: `["Normal", "Alternate Art"]`.
    Like Yu-Gi-Oh, a One Piece print's base RARITY already implies its
    default foil treatment (Common/Uncommon non-foil, Rare gets an accent
    foil, Super Rare and above are full holo — confirmed via research), so
    there's no independent foil/nonfoil toggle to offer; the one real
    separate axis is the star-marked alt-art overlay described above,
    picking one name ("Alternate Art") to avoid offering duplicate options
    for what's confirmed to be a single real value.
  - **`searchOnePiece` (`cardSearch.js`) gained a `numberHint` param**
    (previously only `name, setHint, rarityHint`), matching the
    `(name, setHint, rarityHint, numberHint)` shape every other game's
    search function already uses. Threaded through `proxyQuery` (a new
    `numberHint` field in the `card-lookup-proxy` invoke body) and
    `card-lookup-proxy`'s `Deno.serve` handler down into `egmanQuery`, which
    now accepts a `numberHint` and matches it against the confirmed real
    `card_code` field's suffix after the last dash — accepting either a
    bare number (`"001"`, what the scanner reports) or the full code
    (`"OP01-001"`, what a staff member might type by hand) rather than
    forcing a guess about which form the caller supplies. Tried before
    setHint/rarityHint, same "number is the strongest disambiguator"
    priority used for Pokemon/Magic/Yu-Gi-Oh — narrows the match set first
    if it helps, and every later hint still only narrows further, never
    resets to zero. **Riftbound/Gundam don't pass a `numberHint` yet**
    (their own parity sprints haven't happened) — since `egmanQuery`
    treats a missing hint as a no-op, this is a purely additive, inert
    change for those two games today.
  - **Reliability**: `egmanQuery`'s two `fetch` calls (cards + prices) now
    retry once on a genuine 5xx via a new shared `fetchWithRetry` helper —
    the same lighter 1-retry pattern already used for Scryfall/Yu-Gi-Oh (no
    confirmed flakiness report for Egman's deckbuilder specifically, so
    this is a safety net, not an aggressive backoff). Applies to all three
    Egman-backed games (One Piece/Riftbound/Gundam) since it's a shared
    function — safe for the other two since it only improves reliability on
    a genuine server error, with zero behavior change on a normal response.
  - **`scan-binder-page`'s number/set/rarity guidance now branches for One
    Piece too** — told to read the full printed code in the card's
    bottom-right corner directly (not guess from visual style, unlike
    Magic/Pokemon): the number portion after the dash goes in the `number`
    field, the set-letters prefix goes in the `set` field (there's usually
    no expansion name to read instead), and the short rarity letter code
    next to it maps exactly to the nine values above (`C`→Common,
    `UC`→Uncommon, `R`→Rare, `SR`→Super Rare, `SEC`→Secret Rare, `L`→Leader,
    `SP`→Special Rare, `TR`→Treasure Rare, `MR`→Manga Rare). A star above
    the rarity code is called out as meaning "this print is also a
    parallel/alternate-art version" without changing which rarity value to
    report — there's no schema field yet to record that separately, same
    "UI-only Printing dropdown, no new scan-side detection field" scope
    limit Magic/Yu-Gi-Oh's printing/edition additions already accepted.
    **Requires redeploying `scan-binder-page`** — schema/prompt changes are
    server-side.
  - `EditModal`/`ScannerPanel` needed no changes at all — both already
    passed `number`/`rarity` generically to every game via `searchCardImage`,
    which already forwarded `numberHint` through to `searchOnePiece` once
    that function accepted it; adding One Piece's entries to `cardUtils.js`
    was enough to light up the same curated dropdowns Pokemon/Magic/Yugioh
    already had.
- **Lorcana (Sprint 4) — done.** Real research first (community rarity
  guides for the visual symbol system, plus a real Lorcast API card sample
  fetched via a GitHub-hosted archive of raw API snapshots, since
  Lorcast's own docs site is unreachable from this sandbox — same
  "triangulate a real sample instead of guessing" discipline as everywhere
  else in this doc), then wired through the same places Pokemon/Magic/
  Yugioh/One Piece already use:
  - **Structural finding**: unlike Yu-Gi-Oh/One Piece, Lorcana's rarity and
    finish (foil/nonfoil) ARE genuinely independent axes — confirmed via
    research that every card at Common through Legendary exists in both a
    foil and non-foil printing (the real sample's `prices.usd` vs.
    `prices.usd_foil` fields both existing on the same card object
    confirms both prints exist), with Enchanted being the one rarity
    that's foil-only. This puts Lorcana in the same rarity-vs-finish
    bucket as Magic/Pokemon, not Yu-Gi-Oh/One Piece.
  - `RARITY_OPTIONS_BY_GAME.Lorcana` (`cardUtils.js`): the six official
    tiers, each with its own distinct printed symbol shape (Common = gray/
    white circle, Uncommon = a book icon — the one exception to the
    "more sides = rarer" pattern, Rare = triangle, Super Rare = diamond,
    Legendary = pentagon, Enchanted = rainbow/holographic hexagon), plus a
    seventh real value, `Promo`, confirmed via the real sample: an entire
    promotional set's cards all reported `"rarity": "Promo"` rather than
    one of the six numbered-set tiers.
  - **Real data quirk found and normalized, not guessed around**: the
    same real sample's Super Rare cards report `"rarity": "Super_rare"` —
    an underscored, oddly-cased outlier next to every other tier's normal
    Title Case string (`Common`/`Uncommon`/`Rare`/`Legendary`). No code
    change was needed to handle it — `preferRarity`'s existing
    `normalizeRarityForMatch` (added for Pokemon's own `MEGA_ATTACK_RARE`
    quirk) already lowercases and turns underscores into spaces before
    comparing, so it transparently absorbs this one too.
  - `PRINTING_OPTIONS_BY_GAME.Lorcana`: `["Normal", "Foil"]` — the two
    real, evergreen finish values (see the structural finding above).
    Enchanted's foil-only-ness is already captured by picking "Enchanted"
    in Rarity, so no third option is needed here.
  - **`searchLorcana` (`cardSearch.js`) rewritten for full parity** —
    previously took only `name`; now `(name, setHint, rarityHint,
    numberHint)`, matching every other game's shape. Lorcast's own query
    syntax ("heavily influenced by Scryfall," confirmed via its docs) uses
    `s:`/`set:` for the set and `cn:`/`number:` for the collector number —
    and unlike Magic's setHint (which Scryfall's `set:` operator can't use
    because it wants a letter code this app doesn't store), Lorcana's is
    genuinely safe to wire up as a real server-side filter: Lorcana sets
    have no letter code at all, only a plain NUMBER (confirmed via
    research — e.g. `s:6` for Azurite Sea), which is exactly what this
    app's Set field holds for this game (see the scan-binder-page note
    below) and exactly what the operator expects. A tiered fallback tries
    name+set+number, then name+number, then name+set, then a broad
    name-only search, isolating each tier the same way Pokemon/Magic do —
    a narrower tier finding nothing falls through to a broader one rather
    than giving up. `rarityHint` stays a soft, client-side `preferRarity`
    reorder rather than a hard `rarity:` filter — that operator exists too,
    but its exact multi-word tokenization (given the real `"Super_rare"`
    formatting quirk above) isn't confirmed enough to risk as a hard
    filter that could zero out a real match on a mismatch this app can't
    detect.
  - **Real `listingUrl` added** — Lorcast's card object carries a real
    `purchase_uris.tcgplayer` field (confirmed via the same real sample),
    now mapped through same as Scryfall's/pokemontcg.io's/Egman's. This
    closes a gap the "Pricing section: manual listing-link fallback"
    section above previously documented as a real, undeliberate miss for
    this game specifically — Lorcana no longer needs that fallback in
    practice (Yugioh/SWU still do).
  - **Pricing**: new `lorcastPrice` falls back `usd` → `usd_foil` (the two
    real USD fields Lorcana's data carries — no etched/glossy equivalent
    the way Magic has), same nonfoil-first reasoning as `scryfallPrice`.
  - **Reliability**: `lorcastQuery` now retries once on a genuine 5xx (same
    lighter 1-retry pattern as Scryfall/Yu-Gi-Oh — no confirmed flakiness
    report for this endpoint either) and, since Lorcast's exact "zero
    results" status code isn't independently confirmed the way Scryfall's
    404 is, a persistent non-5xx failure still returns `[]` instead of
    throwing — same unconfirmed-status-code call already made for
    Yu-Gi-Oh, so a real "no matches" doesn't get misreported as an error
    on information this app doesn't actually have.
  - Candidates now carry structured `set`/`number`/`rarity` fields
    (previously only baked into the label) for the same Sprint-1-era
    backfill-on-pick every other game already has.
  - **`scan-binder-page`'s number/set/rarity guidance now branches for
    Lorcana too** — the collector number prints in the same bottom-left
    number/total-in-set format Pokemon uses (e.g. `154/204`); no expansion
    name is ever printed, only a bare set number in that same area
    (confirmed via research — matches exactly what Lorcast's `s:` operator
    expects, see above); and rarity is read from the small symbol's SHAPE
    next to the collector number (circle/book/triangle/diamond/pentagon/
    hexagon), with an unnumbered promotional card reported as `'Promo'`
    regardless of shape. **Requires redeploying `scan-binder-page`**
    (`supabase functions deploy scan-binder-page`) — schema/prompt changes
    are server-side.
  - `EditModal`/`ScannerPanel` needed no changes at all — both already
    passed `set`/`rarity`/`number` generically to every game via
    `searchCardImage`, which already forwarded all three through once
    `searchLorcana` accepted them; adding Lorcana's entries to
    `cardUtils.js` was enough to light up the same curated dropdowns every
    other parity-complete game already had.
- **SWU (Sprint 5) — done.** Real research first (community rarity/variant
  guides, plus a concrete real card listing on swu-db.com showing a Rare
  card's own Rarity vs. Variants fields — since api.swu-db.com itself is
  unreachable from this sandbox for a direct sample, same as Lorcast, so
  this was triangulated across several independent sources rather than
  taken from any single one), then wired through the same places
  Pokemon/Magic/Yugioh/One Piece/Lorcana already use:
  - **Structural finding, and a real contradiction resolved**: some
    community sources describe SWU's premium foil/art treatments
    (Hyperspace, Showcase, Prestige) as "separate rarities alongside the
    standard pull structure," while others describe them as a layer on
    top of a base rarity. A concrete, specific real example (swu-db.com's
    own "Hyperspace Disaster" card page: `Rarity: Rare`, with separate
    `variants` Original/Hyperspace/Foil/Hyperspace Foil) settled it in
    favor of the independent-axis model — the same rarity-vs-finish split
    Lorcana/Magic/Pokemon already use, not Yu-Gi-Oh/One Piece's model.
    Trusted the concrete real-card example over the vaguer blog claim it
    contradicted, per this doc's "get a real sample" discipline.
  - `RARITY_OPTIONS_BY_GAME.SWU` (`cardUtils.js`): the four real
    pull-structure tiers, each with its own gemstone symbol/color at the
    bottom of the card (grey/clear=Common, green=Uncommon, blue=Rare) —
    except Legendary, whose symbol is a gold/yellow STAR rather than a
    gemstone, the one shape break in that pattern. Plus a real fifth
    value, `Special` — confirmed via a direct quote of the swuapi.com
    docs describing the actual API's own `rarity` field as accepting it,
    independently corroborated by community sources describing a
    distinct Special rarity slot (including on some Leader cards).
    `Special` deliberately gets NO scan-detection visual guidance below —
    no confirmed distinguishing symbol/color was found for it the way the
    other four have one, so guessing at a visual tell would be worse than
    leaving it for staff to set by hand.
  - `PRINTING_OPTIONS_BY_GAME.SWU`: the six real, evergreen treatment
    names — `Normal`/`Foil`/`Hyperspace`/`Hyperspace Foil`/`Showcase`/
    `Prestige`. Deliberately excludes the promo/distribution-specific
    variant names also found in research (Serialized, Weekly Play Promo/
    Foil, Prerelease Promo, Convention Exclusive, Judge Promo) — same
    "ever-expanding, event-tied vocabulary belongs in the free-text
    escape hatch" call as Pokemon's Poke Ball pattern and Yu-Gi-Oh's
    Parallel Rare exclusion.
  - **`searchSwu`/the `swu` provider in `card-lookup-proxy` gained
    `rarityHint`/`numberHint`** (previously only `name, setHint`, and
    setHint itself was never actually used). Research confirmed the
    API's own query syntax DOES support `set:`/`rarity:` filter keywords
    server-side — but not whether they can safely combine with a plain
    fuzzy-text name search in the same query string, and this app's Set
    field for SWU holds whatever free text staff typed/the scanner read
    (almost always a full expansion name, not the short code those
    operators expect) — same mismatch risk that already keeps Magic's
    setHint unused. Rather than guess at that combination, setHint/
    rarityHint are instead applied as a soft, narrow-if-it-helps filter
    against the ALREADY-fetched name-matched results' own `Set`/`Rarity`
    fields — the same `egmanQuery`-style narrowing the three Egman-backed
    games use, just without a server-side query-string filter.
    `numberHint` is accepted for a consistent dispatch shape but stays a
    deliberate no-op — no confirmed collector-number field name to narrow
    by, and this app has never guessed a field name outright anywhere
    else in this file either.
  - **Reliability**: the `swu` provider's fetch now goes through the same
    shared `fetchWithRetry` helper added for One Piece/Riftbound/Gundam —
    a genuine, safe reliability improvement since it only changes
    behavior on an actual 5xx.
  - Candidates now carry structured `set`/`rarity` fields (previously
    only baked into the label) for the same backfill-on-pick every other
    parity-complete game already has. No `listingUrl` — still no
    confirmed purchase/listing URL field for this provider (unchanged
    from the original Sprint 4-era finding); the game-agnostic manual
    TCGPlayer search link continues to cover this gap, same as Yugioh.
  - **`scan-binder-page`'s rarity guidance now branches for SWU too** —
    reads the gemstone/star symbol's color/shape near the collector
    number, mapping to the four confirmed tiers, explicitly leaving
    `Special` and any premium-treatment card's underlying rarity
    unaffected by the treatment itself. **Requires redeploying
    `scan-binder-page`** — schema/prompt changes are server-side.
  - `EditModal`/`ScannerPanel` needed no changes at all — both already
    passed `rarity`/`number` generically to every game via
    `searchCardImage`, which already forwarded both through once
    `searchSwu` accepted them; adding SWU's entries to `cardUtils.js` was
    enough to light up the same curated dropdowns every other
    parity-complete game already had.
- **Riftbound (Sprint 6) — done.** Real research first (community rarity
  guides for the frame-style/gem-shape system, since Egman's deckbuilder
  API itself has no public docs to research against — the shape of its
  response was already confirmed in an earlier sprint, same as One
  Piece), then wired through the same places Pokemon/Magic/Yugioh/One
  Piece/Lorcana/SWU already use:
  - **Structural finding**: Riftbound's collector code is a THREE-part
    combo printed at the bottom of the card — set-code, number, and total
    — e.g. `OGN-310/298` (Origins, card 310, out of 298) — closer to a
    hybrid of One Piece's set-code-plus-number format and Pokemon's
    number-plus-total format than either alone. No expansion name is ever
    printed, matching One Piece/Lorcana's convention, so the Set field's
    real content is the short set-letters code (`OGN`), not a name.
  - **A genuine rarity-model contradiction found and resolved, same
    discipline as SWU's sprint**: some sources describe Riftbound's
    Alternate Art/Overnumbered/Signature collector versions as their own
    categories; research confirmed all three are actually sub-flavors
    that still report `Showcase` as their real `rarity` value, distinguished
    from each other only by their collector-number notation (an "a"
    suffix, an unmarked number above the set's total, or an asterisk) —
    not a separate rarity, and not an independent finish axis either
    (unlike SWU/Lorcana/Magic). This puts Riftbound in the same
    rarity-implies-treatment bucket as Yu-Gi-Oh/One Piece, just with the
    "treatment" being which Showcase print style rather than a foil
    detail.
  - `RARITY_OPTIONS_BY_GAME.Riftbound` (`cardUtils.js`): six real,
    confirmed values — the four functional/pull-structure tiers `Common`/
    `Uncommon`/`Rare`/`Epic` (each with its own frame style AND gem
    shape), plus `Showcase` (the chase rarity above Epic, foil-only, no
    colored frame — full art) and `Promo`.
  - `PRINTING_OPTIONS_BY_GAME.Riftbound`: `["Normal", "Alternate Art",
    "Overnumbered", "Signature"]` — per the structural finding above,
    these three real Showcase-rarity print styles are the genuinely
    separate axis for this game (not a foil/nonfoil toggle, which rarity
    already implies), plus the plain `Normal` default every non-Showcase
    card gets.
  - **`searchRiftbound` (`cardSearch.js`) gained a `numberHint` param**
    (previously only `name, setHint, rarityHint`) — the shared `egmanQuery`/
    `card-lookup-proxy` infrastructure already supported numberHint
    end-to-end since the One Piece sprint (it was already a documented,
    inert no-op for Riftbound specifically), so this sprint's wiring work
    was just passing it through the one missing link: `searchRiftbound`
    itself. Matches `card_code`'s suffix after the last dash, e.g. `310`
    from `OGN-310`, same convention as One Piece.
  - No changes needed to `card-lookup-proxy`, `egmanQuery`, or the
    `fetchWithRetry` reliability helper — all three were already shared,
    generic infrastructure covering Riftbound since the One Piece sprint;
    this game's own sprint only needed the client-side wiring plus the
    curated vocab and scan-binder-page prompt work below. A narrower scope
    than One Piece's own sprint, same "structural differences narrow later
    games' scope" pattern as Yu-Gi-Oh's sprint being narrower than Magic's.
  - **`scan-binder-page`'s number/set/rarity guidance now branches for
    Riftbound too** — reads the three-part bottom code directly (number
    portion only, set-letters prefix separately, no expansion name to
    fall back to), and rarity from BOTH the frame style and gem shape
    (bronze+round=Common, silver+triangular=Uncommon, gold full-art
    foil+square=Rare, minimal gold foil+pentagonal=Epic, no frame at
    all/full-bleed foil=Showcase, explicitly noting a Showcase card's
    Alternate Art/Overnumbered/Signature sub-flavor doesn't change the
    rarity value to report). **Requires redeploying `scan-binder-page`**
    — schema/prompt changes are server-side.
  - `EditModal`/`ScannerPanel` needed no changes at all — both already
    passed `number`/`rarity` generically to every game via
    `searchCardImage`, which already forwarded `numberHint` through to
    `searchRiftbound` once that function accepted it; adding Riftbound's
    entries to `cardUtils.js` was enough to light up the same curated
    dropdowns every other parity-complete game already had.
- **Gundam (Sprint 7) — done. Completes this initiative.** Real research
  first (community rarity guides for the letter-code system, cross-
  referenced for consistency, since Egman's deckbuilder API itself has no
  public docs — the shape of its response was already confirmed in the
  One Piece sprint), then wired through the same places every other
  parity-complete game already uses:
  - **Structural finding, same discipline as Riftbound's sprint**: Gundam
    prints an actual letter code (not a visual style to guess from) next
    to the collector number — confirmed via multiple sources as C/U/R/LR/
    SP/P — but the code's LOCATION is near the top-right of the card,
    unlike every other game in this doc so far, which print theirs near
    the bottom. The collector code itself follows the same
    `<set letters>-<number>` format as One Piece/Riftbound (e.g.
    `GD01-001`), so `egmanQuery`'s existing numberHint matching (suffix
    after the last dash) needed no changes to work for this game too.
  - `RARITY_OPTIONS_BY_GAME.Gundam` (`cardUtils.js`): six real, confirmed
    rarity codes mapped to full names — `Common`/`Uncommon`/`Rare`/
    `Legend Rare`/`Special`/`Promo`. `Special` (`SP`) is confirmed to be
    its own top-level rarity code (grouped with C/U/R/LR/P as one of the
    game's "official rarity abbreviations" by research), not a printing
    overlay — despite the name inviting confusion with other games'
    "Special" values, this one specifically means a premium alt-art
    REPRINT of an existing card that keeps that card's original number.
  - **Deliberately excludes the `+`/`++` alt-art suffix system** (e.g.
    `C+`, `LR++`) from rarity — confirmed via research to be an overlay
    applied on TOP of any of the six rarities above (an alt-art `LR+`
    still plays as, and shares its card number with, the base `LR` — only
    the art/foil differs), the exact same rarity-vs-finish split as One
    Piece's star-marked Parallel/Alternate Art overlay.
  - `PRINTING_OPTIONS_BY_GAME.Gundam`: `["Normal", "Alternate Art",
    "Alternate Art (Case Hit)"]`. Unlike some other exclusions in this
    doc (Pokemon's Poke Ball patterns, SWU's Serialized/promo variants),
    both alt-art tiers here are kept as their own curated entries rather
    than collapsed or excluded — research confirmed `+` and `++` are a
    real, stable, non-expanding pair present in every set (not a
    per-set-growing vocabulary), and `++` is confirmed to use a visually
    distinct GOLD foil treatment rather than just being a rarer copy of
    the same `+` look, the same "real, confirmed, evergreen distinction
    earns its own entry" bar Pokemon's Hyper Rare/SWU's Prestige tiers
    already cleared.
  - **`searchGundam` (`cardSearch.js`) gained a `numberHint` param**
    (previously only `name, setHint, rarityHint`) — same story as
    Riftbound's own sprint: the shared `egmanQuery`/`card-lookup-proxy`
    infrastructure (numberHint matching, retry-on-5xx, structured fields)
    already supported this generically since the One Piece sprint, so
    completing this initiative only needed the one missing client-side
    link plus the curated vocab and scan-binder-page prompt work — no
    changes to `card-lookup-proxy`, `egmanQuery`, or `fetchWithRetry`
    were needed at all.
  - **`scan-binder-page`'s number/set/rarity guidance now branches for
    Gundam too** — reads the letter code directly (same "exact printed
    code, not a visual guess" treatment as One Piece), explicitly noting
    the code's unusual top-right location for this game, and explicitly
    noting that a `+`/`++` suffix doesn't change which of the six rarity
    values to report. **Requires redeploying `scan-binder-page`** —
    schema/prompt changes are server-side.
  - `EditModal`/`ScannerPanel` needed no changes at all — both already
    passed `number`/`rarity` generically to every game via
    `searchCardImage`, which already forwarded `numberHint` through to
    `searchGundam` once that function accepted it; adding Gundam's
    entries to `cardUtils.js` was enough to light up the same curated
    dropdowns every other parity-complete game already had.
- **Every supported game with a real card database now has full parity**
  — Magic, Pokemon, Yugioh, Lorcana, One Piece, SWU, Riftbound, and
  Gundam. Only Sports Singles remains without curated Rarity/Printing
  vocab, and that's permanent by design (no card database exists for it
  to research against), not a remaining sprint.
- **`Promo` rarity — audited per game first, then added everywhere anyway
  per an explicit staff request.** Every game has promotional reprints,
  but that doesn't mean "Promo" is how each one's real `rarity` field
  models it — the audit found only Pokemon (and Lorcana/Riftbound/Gundam,
  already confirmed real in their own parity sprints) actually use it as
  a genuine rarity value:
  - **Pokemon** — confirmed real. pokemontcg.io's own `/rarities` endpoint
    lists `Promo` alongside every other real value, and a real card (Mew
    09/53, a WOTC Black Star Promo) reports exactly `"rarity": "Promo"`.
  - **Magic** — NOT a real rarity value. Scryfall's confirmed `rarity`
    field only ever takes the six values already listed
    (`RARITY_OPTIONS_BY_GAME.Magic`); a promo printing keeps its ORIGINAL
    rarity (a promo Rare stays `rarity: "rare"`). Promo-ness lives in a
    completely separate boolean (`is:promo`) and dedicated promo Sets.
  - **Yu-Gi-Oh** — NOT a real rarity value, same reasoning. A print's
    `set_rarity` (one entry per `card_sets[]`) is confirmed to always be a
    real functional tier (`"Ultra Rare"`, `"Secret Rare"`, etc.) even for
    printings from a promotional set — the promo-ness is which SET the
    printing belongs to, not a distinct rarity string.
  - **One Piece** — NOT a real rarity value, already confirmed correctly
    excluded when this game's own parity sprint ran. Research is explicit:
    "promos use a P-### serial prefix rather than a rarity tier — a promo
    card still carries a normal rarity underneath."
  - **SWU** — only weak evidence found (a third-party marketplace listing
    tag, not the actual API's own documented `rarity` field), short of the
    direct API-field confirmation every other addition in this doc
    otherwise requires.
  Despite that, the user explicitly asked for `Promo` to be added to
  Magic/Yugioh/One Piece/SWU's curated lists too, reasoning that floor
  staff naturally describe a card as "the promo version" regardless of
  what any API's rarity field says, and having it selectable makes that
  kind of item easier to find later via the Catalog's Rarity filter — a
  real, deliberate trade-off (findability over strict data-fidelity),
  not a research gap. Each of those four entries in `cardUtils.js` carries
  a comment explaining it's there by explicit request despite not
  matching that game's own confirmed rarity data, so a future pass doesn't
  mistake it for an oversight and "fix" it back out. `scan-binder-page`'s
  Pokemon rarity guidance also gained a one-line fallback: a
  black-star-symbol or otherwise standalone promotional card reports
  `Promo` regardless of its other visual traits — scoped to Pokemon only,
  since that's the one game where a promo card actually has a confirmed,
  detectable visual tell; the other four games' new `Promo` option is
  manual-select only, with no scanner-side auto-detection added, to avoid
  the AI guessing a value that could feed a bogus rarityHint into search.
  **Requires redeploying `scan-binder-page`** for the Pokemon prompt
  change to take effect.

## Scanner: merging duplicate physical copies into a quantity

Real-phone testing on a binder page with several identical promo copies
found the Scanner leaving each detected pocket as its own qty-1 review row
even when multiple pockets were unambiguously the same physical print —
staff then had to notice and manually consolidate them (delete the extras,
bump qty by hand) after every scan, "a case that's very common as
distributions tend to vary."

- **`mergeScanDuplicates` (`cardUtils.js`)** runs once, right after
  `handleScan` builds one row per detected pocket (crops included) and
  before the post-scan image/price auto-fill kicks off — so the auto-fill
  batch below only ever searches each distinct print once, not once per
  physical copy, as a free efficiency win. Two rows merge into one qty-N
  row only when **both** their Name and their Number match exactly (case/
  whitespace-insensitive on the name; leading zeros ignored on the number,
  so "0451" and "451" count as the same print) — **deliberately not Name
  alone**. Confirmed against a real photo showing why: three visually
  near-identical serialized "The One Ring" cards on the same page each
  carried a genuinely different collector number (each is its own
  one-of-one print, not three copies of anything), sitting next to three
  real physical copies of a promo that all shared one number — the same
  "a different Number usually means a genuinely different print" signal
  this doc already leans on everywhere else for disambiguation. A row with
  no Number captured at all (the scan's OCR on a small, blurry corner
  number frequently comes up empty) is left un-merged rather than guessed
  into a group on name alone — losing a real second copy of a distinct
  print to an incorrect merge is worse than leaving two rows that staff
  can merge themselves. Scoped to `game` too, defensively, so a
  same-name/same-number coincidence across two different games' cards on
  a mixed binder page can't merge them. When rows do merge, the kept row's
  `position` becomes a comma-joined list of every contributing pocket
  (e.g. "row2-col1, row2-col3, row3-col1"), and its `confidence` becomes
  the *lowest* of the merged copies' — one blurrily-detected copy among
  several still deserves a second look, and shouldn't get hidden behind a
  more-confident sibling that scanned first. Only every OTHER field (name/
  game/set/rarity/photo crop/etc.) is kept from whichever row was scanned
  first; the later duplicates' own crops are discarded since they're
  supposed to be the same print anyway. Purely a within-this-scan review-
  queue behavior — has nothing to do with matching a freshly scanned card
  against something already saved in the catalog (a separate feature,
  not built).
- **`ScanRow` gained a Qty number input** (`ScannerPanel.jsx`) — the row
  data model already had a `qty` field (used verbatim by `handleConfirm`),
  but there was previously no way to see or edit it in the UI at all; every
  scanned row silently saved as qty 1 regardless. Needed for the merge
  feature above to actually be visible/correctable, and as a side effect
  now also lets staff manually bump qty on a row added via "+ Add missed
  card" without a merge ever being involved. (Originally landed tucked into
  the second field row next to Price — see the layout pass right below for
  where it actually ended up.)

## Scanner review row layout pass

A follow-up UX pass on `ScanRow` (`ScannerPanel.jsx`) — regrouped the
fields into a clearer order and gave mobile its own dedicated one-field-
per-line layout instead of a wrap-when-it-fits row.

- **Two rows, deliberately regrouped**: row 1 is now Qty/Card name/Game/
  Set/Number (Qty moved next to the thumbnail, first in the row, instead
  of buried in the middle of row 2 next to Price where it was easy to miss
  after the qty-merge feature above started auto-filling it); row 2 is
  Rarity/Printing/Condition/Price, with the confidence badge and Remove
  button kept together at the end. Reads roughly as "what card is this"
  (row 1) then "what specific copy/condition is this" (row 2).
- **`.scan-field`**: each field is now a label+input pair (`.scan-field` /
  `.scan-field-label`), mirroring EditModal's `.field-group` — but the
  label stays hidden on desktop (`display: none`) where this queue is
  deliberately dense and a placeholder already identifies a blank field.
  It only renders on mobile, under the existing shared 640px breakpoint.
  `.sf`/`.sf-wide`/`.sf-auto` (the old flex-basis classes, applied straight
  to each input/select) are replaced by `.sf`/`.sf-wide`/`.sf-qty` applied
  to the new `.scan-field` wrapper instead, so the label can live alongside
  the input it describes.
  - **`.scan-row-meta`**: the confidence badge + Remove button are grouped
    into their own wrapper, explicitly kept OUT of the one-field-per-line
    treatment below — they're row-level metadata/actions, not something
    staff type into, so stacking them the same way as a text field would
    just add scroll height for no clarity benefit.
- **Mobile: one field per line, not wrap-when-it-fits.** The previous
  mobile behavior (`.scan-row-line { flex-wrap: wrap }`, each field
  `flex: 1 1 120px`) could still pack 2-3 narrow fields onto the same
  visual line if they happened to fit — real feedback found this cramped
  and uncomfortable to type into, especially once a field had real text in
  it rather than empty placeholder space to judge by. `.scan-row-line`
  becomes `flex-direction: column` on mobile instead, every `.scan-field`
  goes full-width, and its label becomes visible (`display: block`) so a
  long vertical stack of otherwise-identical-looking inputs stays
  identifiable — the same reasoning EditModal's always-visible field
  labels already rely on.
- **Verification**: this queue only ever renders after a real scan (a live
  Anthropic API call this sandbox has no network path to — see the
  existing "Manual QA note"), so it was checked the same throwaway-harness
  way documented elsewhere in this file: a temporary `devtest.html`/
  `src/devtest.jsx` rendering `ScanRow` directly with mock row data (a
  brief `export` added to `ScanRow` to reach it, reverted immediately
  after) under `UIProvider`, screenshotted via Playwright at a desktop and
  a mobile (390px) viewport, then deleted before committing — confirmed
  the new row grouping, spacing, and the mobile label/one-per-line
  behavior all render as intended.

## Pricing section: manual listing-link fallback

Real report: no clickable TCGPlayer link ever appeared for a Yugioh card
even once a Market Value was already showing. Confirmed as a real,
fixable gap, not (only) a data limitation — three providers currently
never return a `listingUrl`/`sourceUrl` at all:

- **Yugioh** — deliberate (see the per-game parity section above): enabling
  YGOPRODeck's `tcgplayer_data=yes` mode would unlock a listing URL, but
  its own docs warn that mode's Set Name/Rarity data can be inaccurate,
  and accurate Set/Rarity backfill mattered more than the extra link.
- **Lorcana** — at the time this was written, Lorcast's response was never
  read for one; not a deliberate omission, just never wired up. **Fixed in
  the Lorcana parity sprint below** — Lorcast's card object does carry a
  real `purchase_uris.tcgplayer` field (confirmed via a real sample), now
  mapped to `listingUrl` in `searchLorcana`. Lorcana no longer needs this
  fallback in practice, though the fallback itself stays in place as the
  general safety net for any provider that doesn't have one.
- **SWU** — the real API sample confirmed `Name`/`FrontArt`/`Set`/
  `MarketPrice`/`LowPrice`; no listing/product URL field was present to
  wire up.
(Magic/Pokemon/Lorcana/One Piece/Riftbound/Gundam all do have a real one
today — only Yugioh/SWU still rely on the manual-search fallback below.)

The actual bug wasn't the missing link itself (that's an accepted,
documented gap for those three) — it's that **EditModal's and
ScannerPanel's Pricing sections had no fallback for it**. Once
`basePrice`/`form.basePrice` is set, the old code only ever rendered the
"Check live TCGPlayer listing ↗" line `if (sourceUrl)` — with nothing in
its place when there wasn't one. The $25+ high-value warning right below
it made this worse: it told staff "worth checking the real current
listing" but gave them no way to actually do that. Fixed by falling back
to the same game-agnostic `tcgplayerSearchUrl` manual-search link already
used elsewhere (image-search-failed, price-search-found-no-price) instead
of leaving that line blank — the Pricing section's listing line now always
renders something clickable once a Market Value exists, real link or
manual-search fallback. The now-redundant "worth checking…" sentence in
the high-value warning was removed since the link right above it already
covers that.

## eBay as a second price reference

Explicit ask: add eBay alongside TCGPlayer as a second, independent price
check — evaluated two different versions of this before building anything,
since they have very different feasibility:

- **A real, automatically-pulled eBay price** (like `basePrice`/Market
  Value) — evaluated and **not viable today**. eBay's old Finding API
  (which used to support querying sold/completed prices) is deprecated;
  the replacement, the Marketplace Insights API, is "Limited Release" —
  gated behind a special business-level approval, not obtainable via a
  normal free developer account, the same "no credential exists yet"
  situation this doc already treats as parked for TCGPlayer's own frozen
  Pricing API. eBay's freely available API (Browse/Buy) only exposes
  ACTIVE listing prices (asking prices), not sold prices — a materially
  weaker signal, same caveat already documented for TCGPlayer's own
  low/high active-listing fallback. Scraping eBay's sold-listings pages
  directly breaks its ToS, and this project already evaluated and
  rejected exactly that once before (see "Known constraints" above).
- **A manual "check on eBay" search link, as its own standalone button —
  not a fallback tucked onto the TCGPlayer line.** Built as
  `ebaySoldSearchUrl` in `cardSearch.js`, using eBay's own documented URL
  filter for sold+completed listings specifically (`LH_Sold=1&
  LH_Complete=1`), not just any active listing — confirmed live, not
  guessed. First cut rendered it appended to whichever TCGPlayer link was
  showing, gated on a Market Value already existing (`form.basePrice != null`) —
  reworked after real feedback: eBay is a genuinely independent reference,
  not something staff only want to see once "Find market price" has
  already run or failed. It's now a real `<button>`-styled `<a>` ("Check
  eBay sold listings ↗") sitting right next to "Find market price" in
  `EditModal`'s Quantity & pricing section, and next to "Find another
  image"/"Find market price" in `ScannerPanel`'s `ScanRow` thumbnail
  column — both render unconditionally off the row/form's own name+set,
  independent of `basePrice`/`pendingPrice`/search state, so staff can
  jump straight to eBay without running (or waiting on) a market-price
  search first.
  - **Real caveat found while researching, not while building**: as of
    2026-07-22, eBay put its sold/completed listings behind a login wall
    — a signed-out browser gets redirected to `signin.ebay.com` instead of
    seeing results. Not worked around (there's no way to from a plain
    link) — just something to know if staff report the link "not
    working": it still does, it just needs an eBay account signed in
    first, unlike the TCGPlayer link, which assumes nothing about login.
    eBay has not said whether this is permanent.

## Quote tab — trade-in/buylist quoting

A new top-level tab, the reverse workflow of everything else in Ledger:
Catalog/Scanner/Import are about the shop's own *outbound* stock; this is
about *buying cards in* from a walk-in customer. Ported from a manual Excel
sheet the shop was already using (reverse-engineered from a real uploaded
copy, not guessed): a header block (customer info, date, employee, time
taken), a line-item grid, an auto-computed total and three offer tiers
(percentages of that total), and a final decision (Offer Status: Accepted
Cash / Accepted Store Credit / Rejected Offer, a Payout Amount, an
independent Paid Out checkbox).

- **One `quotes` row is both a "collection" and, once decided, the
  finalized transaction — no separate collection entity.** A "collection"
  (e.g. "Jake binder proposal") is just a quote row before its
  `offer_status` is set: staff can create it, add cards to it over time,
  and come back to it. Once `offer_status` becomes one of the two Accepted
  values or `'rejected'`, it's done — it stops showing up as a resumable
  collection. This was an explicit design call (confirmed with the user)
  over inventing a second table, since a quote row already models "staged,
  then decided" with nothing else needing to reference a collection
  independently of its eventual quote.
- **Line items live in a single `items` jsonb array on the `quotes` row**
  (`phase8_quotes.sql`), not a `quote_items` child table — matches this
  app's existing preference for denormalized snapshots over relational
  child tables (e.g. `sync_queue` tickets already snapshot fields rather
  than joining back to `catalog`), and line items are never queried
  independently of their parent quote. Each item: `{ id, name, game, set,
  number, rarity, printing, condition, basePrice, price, qty, notes }`.
  `quote_number` (a `bigserial`) is a human-friendly display id ("Quote
  #14") — the uuid primary key isn't something staff should ever need to
  read or type.
- **Condition is deliberately never defaulted** — not even to Near Mint,
  unlike every other Condition picker in the app. Staff make a real,
  on-the-spot physical assessment of a card they're about to pay for, and a
  silent default would stand in for that judgment call instead of forcing
  it. The field starts on its real placeholder (`SelectWithCustom`'s
  existing escape-hatch pattern, just with no pre-selected value) and
  `marketValueForCondition` already returns `null` for a blank condition —
  no code change was needed there, only in never pre-filling the value.
- **Offer tiers are a store-configurable setting, not a hardcoded
  constant** (unlike the source sheet, which hardcoded 50/60/70%
  everywhere) — a new `quote_settings` singleton row
  (`tier1_pct`/`tier2_pct`/`tier3_pct`, defaulting 50/60/70), same
  `id=1`/`maybeSingle()`/fallback-to-defaults pattern as `store_settings`'s
  condition multipliers (`dbLoadQuoteSettings`/`dbSaveQuoteSettings` in
  `db.js`). Kept as its own settings row rather than added to
  `store_settings` — condition multipliers are a Catalog pricing concern,
  tier percentages are a quoting concern. Editable via a small dedicated
  "Quote settings" modal in the Quote tab itself, not the existing Pricing
  Settings modal.
- **Two ways into a quote, then three ways to add cards to it** — an
  explicit design decision after real back-and-forth about UX (see the
  section below). "+ New Quote" offers **Create from collection** (resume
  an in-progress one, `offer_status IS NULL`) or **Create from scratch**
  (name it, create a blank quote). Inside a quote's detail view
  (`QuoteDetail.jsx`, one scrollable page matching the source sheet's own
  single-page feel), staff can add cards via:
  - **Manual entry** (`QuoteLineItemRow.jsx`) — same field set as
    `EditModal` (Game/Set/Number/Rarity/Printing/Condition) so an accepted
    item arrives in Catalog with good data. The Name field is a new
    **`CatalogItemPicker.jsx`** — a lightweight, client-side-only typeahead
    over the shop's own already-loaded `catalog` array (no network call at
    all) — picking a match backfills game/set/rarity/printing/basePrice;
    typing a name with no match is just as valid, staff fill in the rest by
    hand. This was an explicit, deliberate choice over reusing the live
    external card search (Scryfall/pokemontcg.io/etc.) that Scanner/
    EditModal use — the user's own words: "we work based on already
    established data not a hub with a search toolset like Scan or Import."
  - **Scan** — the existing `ScannerPanel` mounted as-is inside a modal,
    with its `onImport` callback redirected to append to this quote's items
    instead of writing to Catalog. `ScannerPanel` never touched `db.js`
    directly to begin with (its confirm flow already just calls whatever
    `onImport(cards, mode)` callback it's given — the same one `App.jsx`
    normally wires to the catalog-writing handler), so embedding it here
    needed no refactor — only a new, purely cosmetic `destinationLabel`
    prop (default `'catalog'`) so its button/description text can say
    "quote" instead when embedded, with zero change to the real Scanner
    tab's own wording.
  - **Import** — required one real extraction: the original
    `ImportExportPanel.jsx` bundled the CSV/XLSX import flow together with
    Export/Binder-QR/Reset-all-data in one file, none of which belong in a
    Quote context. Split into `ImportPanel.jsx` (the file-drop → sheet-pick
    → column-mapping → confirm flow, self-contained already, now takes an
    `embedded` prop that hides the "Replace entire catalog" import-mode
    option — destructive and catalog-only, meaningless for a quote's item
    list) and `ExportPanel.jsx` (Export/QR/Reset). `ImportExportPanel.jsx`
    is now a thin composer of both, so the real Import/Export tab's
    behavior is byte-for-byte unchanged.
  - Both Scan and Import route through a shared `quoteUtils.itemsFromCatalogRows(cards)`
    adapter — both already produce fully-formed `normalizeCard(...)`-shaped
    objects before calling `onImport`, so this just reshapes each one into
    a quote item, dropping the generated `sku` (quote items don't need
    one) and giving each a fresh client-side id. **`number` (collector
    number) is left blank by this adapter** — it was never part of
    `normalizeCard`'s saved shape to begin with (Scanner/Import already
    discard it as a transient, never-saved search-only hint before calling
    `onImport`, same as when they write straight to Catalog), so there's
    nothing to carry over; staff can still type it in by hand.
  - All three methods are freely mixable on the same quote — e.g. scan a
    binder page, then manually add a couple more cards — since they all
    just append to the same local `items` array before Save.
- **`GAMES` finally hoisted into `cardUtils.js` as a real export** —
  previously duplicated verbatim in `EditModal.jsx` and `ScannerPanel.jsx`
  with no single source of truth; a third consumer needing the identical
  list (`QuoteLineItemRow.jsx`) was the trigger to stop tripling it.
- **Accepted quotes auto-create Catalog rows** — the moment `offer_status`
  becomes `'accepted_cash'` or `'accepted_store_credit'` and the quote
  isn't already `converted_to_catalog`, `App.jsx`'s `handleSaveQuote`
  builds new catalog rows via `quoteUtils.buildCatalogItemsFromQuoteItems`
  (the exact same `normalizeCard(...)` shape `EditModal`/`ScannerPanel`
  already build, `basePrice` carried over so Market Value keeps working on
  the new row) and writes them with the same `dbUpsertCards` bulk-upsert
  ScannerPanel's own confirm flow already uses — no new catalog-write
  primitive needed. `converted_to_catalog` (set `true` right after) guards
  against creating duplicate Catalog rows if an already-accepted quote is
  edited and saved again.
- **Quote collections are never visible from Catalog** — an explicit user
  requirement. Every quote has its own dedicated view inside the Quote tab
  ("Quote #14 — Jake binder proposal"); Catalog only ever sees the cards
  that come out the other end, once Accepted.
- **No tracked "bounce"/counter-offer state** — confirmed with the user
  that a rejected-then-re-offered negotiation happens verbally and is never
  recorded; only the final Accepted/Rejected outcome and Payout Amount
  matter.
- **Realtime**: `quotes` extends the existing single `'ledger-realtime'`
  channel in `useRealtimeSync.js` (one more `.on('postgres_changes', ...)`
  registration, keyed by `id`) rather than a second channel — same
  reasoning as every other table already on it. Like `catalog`/
  `sync_queue` when they were first set up, `quotes` needs a one-time
  manual add to Supabase's `supabase_realtime` publication (Database →
  Replication) — not something any migration file in this repo does.
- **The "how should staff add cards" UX question went through two rounds**,
  worth recording since the first answer was reversed: the initial plan
  ruled out reusing Scanner/Import entirely (to avoid Quote becoming a
  second Scanner) in favor of manual-entry-plus-catalog-typeahead only.
  After the user described the full intended flow — cards get staged into
  a named collection first, then a quote is built from either an existing
  collection or from scratch, with staff choosing however they want to
  add cards — Scanner and Import were explicitly brought back in as two of
  three add-card methods, confirmed feasible with no deep refactor once
  actually checked (both already took an `onImport` callback prop rather
  than writing to `db.js` internally). The lesson wasn't "reuse
  everything" or "reuse nothing" — it was that the right amount of reuse
  depends on the actual intended workflow, which only became clear once
  the user walked through it end to end.

**Requires running `phase8_quotes.sql`** in the Supabase SQL Editor before
this code can save/read quotes (creates both `quotes` and
`quote_settings`), plus the manual Realtime-publication step above.

## Quote tab: real-usage fixes after first hands-on test

A first real test pass against a live Supabase project (not just the mock
harness) surfaced several real issues, fixed in one pass:

- **A new quote is no longer persisted the instant "Create" is clicked.**
  The original flow called `dbUpsertQuote` immediately, before the detail
  view even opened — so clicking "+ New Quote" → "Create" → Cancel still
  left a permanent blank row behind, and consumed a real `quote_number`
  from the sequence for a quote that was never actually used. `QuotesTab`
  now builds a client-only draft object (`id: null`) and only calls
  `onSaveQuote` on the first real Save inside `QuoteDetail` — matching how
  `EditModal` already treats a new catalog item (nothing exists until
  Save). `QuoteDetail`'s title reads "New quote — &lt;name&gt;" before that
  first save and "Quote #N — &lt;name&gt;" after; its Delete button only
  renders once `quote.id` is real, since there's nothing to delete before
  that.
  - **This also fixes what looked like a documentation bug but wasn't**:
    an earlier manual test checklist claimed "resuming a draft opens it
    with everything you'd already entered intact" after Cancel — that was
    simply wrong. Cancel has always discarded unsaved edits, matching
    every other modal's explicit-button-only-close convention in this
    app; the checklist description was corrected, not the behavior.
  - **`quote_number` gaps are still normal and expected** even with this
    fix (a genuinely abandoned mid-edit quote that reaches one real Save
    still consumes a number) — same as invoice/ticket numbers everywhere;
    a `bigserial` doesn't roll back on its own. Not treated as a bug.
- **`QuoteDetail`'s modal was too narrow for its own content.** It used
  `.modal.wide` (560px, tuned for `EditModal`'s image+form layout) for a
  line-item grid with *more* fields per row than `EditModal` has — real
  testing showed this as visibly cramped/truncated fields. New `.modal.xwide`
  (1040px) is used for `QuoteDetail`'s main modal and its embedded Scan/
  Import sub-modals instead — `.modal.wide` itself is untouched, still used
  by `EditModal` alone.
- **Employee field placeholder no longer shows a real staff name** — was
  `"e.g. Noah, or Noah / Richard"` (actual example names from earlier
  testing), now generic `"e.g. John Doe"`.
- **Quote line items now carry an image**, same dual-image model
  (`imageUrl`/`imageData`/`photoUrl`/`photoData`/`activeImage`) a catalog
  row already has, rendered via the same `activeImageSrc` helper — added
  to `normalizeQuoteItem`/`itemsFromCatalogRows`/
  `buildCatalogItemsFromQuoteItems` in `quoteUtils.js` so a picked catalog
  reference, a scanned crop, or a live "Find image" result all carry
  through to the row's thumbnail and, on Accept, onto the new Catalog row.
- **Live external card search is back on quote rows — "Find image"/
  "Find price" buttons, reusing `searchCardImage`** (Scryfall/pokemontcg.io/
  etc., the exact same function `EditModal`/`ScannerPanel` call) — plus the
  manual TCGPlayer/eBay fallback links, matching `ScanRow`'s own thumb-col
  layout. **This reverses this doc's own earlier "no live external card
  search for Quote" decision** — the catalog-only typeahead's real
  limitation is that a genuinely new trade-in card has no catalog history
  to reference at all, and real use found the live search "the most
  important time saver" once available elsewhere in the app. Search state
  (`candidates`/`candidateMode`/`activeSearch`) is scoped locally per
  `QuoteLineItemRow`, mirroring `EditModal`'s own local search state rather
  than lifting it into `QuoteDetail` — each row searches independently.
- **`QuotesTab`'s list gained status color-coding, a status filter, a
  search box, and sortable columns** — real feedback that a growing quote
  list needed to be scannable/filterable, not just chronological. Rows are
  tinted by outcome using the same semantic tokens as everywhere else in
  this app (`--amber-soft` in progress, `--green-soft` accepted,
  `--rust-soft` rejected — applied to `td`, not `tr`, so it isn't fought by
  the existing global `tbody tr:hover` rule). Status filter is a row of
  quick toggle buttons (All/In progress/Accepted Cash/Accepted Store
  Credit/Rejected), not a dropdown — matches "quick filter" as asked, not a
  slower two-click pick. Search matches collection name + customer name.
  Sortable column headers reuse the exact `.sortable`/click-to-toggle-
  direction pattern `CatalogTable` already established, with a small local
  `QUOTE_SORT_COLUMNS` key map (not exported/shared — Quote's column set is
  different enough from Catalog's own `SORT_COLUMNS` that a shared export
  wasn't worth it for five columns).
- **Clarified, not changed**: what the catalog typeahead actually does when
  picking a reference card — it only copies field *values* (game/set/
  rarity/printing/basePrice/image) onto the new quote line item; it never
  links to, modifies, or flags the original catalog row in any way. The
  shop's Catalog is a read-only reference for this picker, same as a live
  external search would be — building or editing a quote can never change
  anything already in Catalog.

## Quote tab: intake/release form, printing, and dropping the # from the list

Another round of real-usage feedback — quote numbers jumping unpredictably
in the list, and two new print features requested to replace a paper
process the shop was still doing by hand.

- **The quote list no longer shows `quote_number` at all** — a real
  `bigserial`, so gaps (e.g. #1 then #4) are normal and expected (an
  abandoned-but-saved quote still consumes one, same as invoice/ticket
  numbers anywhere), but showing a visibly gapped, non-meaningful number as
  the primary way to tell rows apart just read as broken. Collection name
  is the real identifier now — dropped from `QuotesTab`'s table columns,
  the sortable-columns list, and the "Resume a collection" picker inside
  "+ New Quote". Default sort changed from `quoteNumber` to `dateQuoted`
  (most recent first) to match. **Not removed everywhere** — `QuoteDetail`'s
  own title still reads "Quote #14 — &lt;name&gt;" once saved, since a
  stable short reference is still genuinely useful when staff are looking
  at (or printing) one specific quote, just not as a list column full of
  gaps.
- **New Release Form / intake fields** (`phase9_quote_intake_release.sql`):
  `customer_email`, `has_expected_price` (tri-state boolean — `null` means
  "not asked yet", never coerced to `false`), `expected_price_amount`
  (free text, not numeric — matches the paper form's own free-text blank,
  e.g. "$150" or "around 200"), and `intake_notes`. These map directly onto
  the shop's real paper "Quote Release Form" (a physical form signed when a
  customer drops cards off, before any pricing happens) — captured on the
  same `quotes` row rather than a separate intake entity, since an
  in-progress quote already represents exactly what the release form is
  about: cards currently in the shop's custody being evaluated. Surfaced in
  `QuoteDetail` as a new "Release form info" section — a Yes/No toggle pair
  for the price-expectation question (clicking the already-selected option
  again resets to unanswered) plus a conditional amount field, and a
  Description-of-product textarea.
- **Print Quote / Print Release Form** — two buttons in `QuoteDetail` that
  print off `draft` (whatever's on screen right now, saved or not — staff
  need the Release Form the moment cards arrive, often before there's any
  reason to have saved the quote yet). Implementation is deliberately the
  simplest thing that works: no PDF library, no new dependency — a
  `.print-sheet` element (`src/components/quotes/QuotePrintViews.jsx`,
  `QuotePrintSheet`/`ReleaseFormPrintSheet`) stays in the DOM at
  `display:none`, and a new `@media print` block in `index.css` hides
  everything else on the page (`visibility:hidden` on `body *`) and shows
  only the sheet, positioned `absolute` so it prints cleanly regardless of
  where it happens to sit in the component tree (nested inside an open
  modal, in this case). `printMode` state + a short `setTimeout` calls
  `window.print()` once the sheet has actually rendered; a window
  `afterprint` listener resets `printMode` back to `null` once the print
  dialog closes.
  - `ReleaseFormPrintSheet` reproduces the shop's real paper form verbatim
    (wording confirmed against an uploaded photo of the actual form, not
    paraphrased) — the Yes/No question is rendered as both words with the
    answered one bolded+underlined (both plain if `hasExpectedPrice` is
    still `null`), and **Signature is left as a blank underline on
    purpose** — this prints and gets physically signed with a pen, same as
    the original paper form; it's not a digital-signature feature.
  - `QuotePrintSheet` is a plainer internal record: header fields, every
    line item, the computed total/tier amounts, and the offer
    status/payout/paid-out decision — reuses `computeQuoteTotals`/
    `computeOfferTiers` from `quoteUtils.js` rather than duplicating that
    math.
  - Verified with a Vitest/RTL component test
    (`QuotePrintViews.test.jsx`) rather than e2e — asserting `window.print()`
    actually opens/closes a dialog isn't meaningfully testable in a headless
    browser, and the real risk here (wrong or missing pre-filled text) is
    exactly what a plain component render-and-assert test catches.

**Requires running `phase9_quote_intake_release.sql`** in the Supabase SQL
Editor before this code can save/read the new intake fields.

## Quote tab: field layout, print pagination fix, collapsible sections

A fourth round of real-usage feedback, this time from a screenshot of an
actual printed Quote for a large card list that cut off partway through.

- **Email field restyled to match Employee's** — was a bare `type="email"`
  input with no placeholder, visually inconsistent with every other text
  field in the section (Employee's `placeholder="e.g. John Doe"` was the
  template every other field in this section already follows). Now
  `type="text" placeholder="e.g. jane@email.com"` — a plain text input like
  the rest, not relying on the browser's native email-format validation
  UI, which this app doesn't use anywhere else either.
- **"Quote details" fields reordered**: Date quoted moves to its own
  full-width field-group at the end of the section (was paired with
  Employee); Time taken to quote takes over that now-vacant slot next to
  Employee instead. Purely a field-ordering change — no field
  added/removed/renamed.
- **Print Quote was silently truncating long quotes** — traced to
  `.print-sheet` (the hidden-until-`@media print` element `QuotePrintSheet`/
  `ReleaseFormPrintSheet` render into) being a DOM *descendant* of
  `.overlay show`, whose CSS is `position: fixed; inset: 0; overflow-y:
  auto` to bound the on-screen modal to the viewport. Overflow clipping on
  a fixed-position ancestor applies to everything painted within that
  subtree regardless of a descendant's own `position: absolute` — so a
  print sheet taller than the overlay's own on-screen scrollable box was
  getting cut off at print time exactly where the overlay's own bounds
  ended, which is what a screenshot of a long quote's printed output
  showed as "looks incomplete." Fixed by moving both print-sheet renders
  in `QuoteDetail.jsx` to be top-level siblings of the `.overlay` div
  (wrapping the component's whole return in a Fragment) instead of nested
  inside it — the sheet is invisible on screen either way (only `@media
  print` ever shows it), so this has zero visible effect outside of print,
  and print output now paginates normally regardless of quote length.
- **Collapsible sections**: `QuoteDetail`'s four `.form-section` blocks
  (Quote details / Release form info / Cards / Total & offer) can now each
  be independently collapsed via a click on their header — new local
  `openSections` state (`{details, release, cards, total}`, all default
  expanded so nothing changes for existing muscle memory) plus a small new
  `SectionHeader` component (a rotating `▶` chevron + click handler,
  replacing the previously-inert `.section-label` divider). Lets staff
  jump straight to, say, Total & offer on a long card-heavy quote without
  scrolling past the whole Cards list first — the actual ask, once a real
  quote's card list got long enough that "quickly move between" sections
  stopped being quick. No section is ever forced closed automatically
  (e.g. based on item count) — purely a manual toggle, so a section
  staff want open while editing (Cards, most of the time) just stays that
  way.
- Covered by a new e2e test (`e2e/quotes.spec.js`) asserting a section's
  fields actually disappear/reappear on toggle and that two sections
  collapse independently of each other. The print-pagination fix itself
  isn't independently e2e-tested — same reasoning already established for
  `QuotePrintViews.test.jsx`: asserting real paginated print output isn't
  meaningfully testable in a headless browser — it was verified by tracing
  the CSS root cause (`.overlay`'s `overflow-y: auto` clipping a nested
  absolutely-positioned descendant) rather than by a repro screenshot
  alone, and the DOM-nesting fix is a straightforward, low-risk structural
  change with no new runtime logic to test.

## Sorting stage + Bulk item type (supersedes the accept-time destination modal)

Real staff feedback, just one round after the accept-time destination
modal shipped (PR #40): *"They need to be individual. Cards from the same
quote could go to several different places. Bulk also needs to be one of
those options and should not hold an inventory. but it should be after
they are accepted. not during the quote."* — a genuinely different
requirement, not a refinement of the same idea. **PR #40 was closed
unmerged** rather than iterated on, since its whole mechanism (one
location+channels decision for the entire quote, made at accept time) is
exactly what this replaces.

- **Accepting a quote now moves its items into a new "needs to process"
  stage instead of writing Catalog rows directly.** `sorting_queue`
  (`phase10_sorting_bulk.sql`) is a new table, one row per quote line item
  (its own qty carries over as one unit of work — a stack of 3 identical
  copies almost always gets sorted together, not one row per physical
  card). `App.jsx`'s `handleSaveQuote` calls
  `buildSortingItemsFromQuoteItems(items, quoteId, collectionName)`
  (`quoteUtils.js`) instead of `buildCatalogItemsFromQuoteItems` at
  accept time — the same guard field that used to gate the catalog
  conversion (`converted_to_catalog` in the DB, kept as-is rather than
  migrated — see below) now gates this move instead, renamed
  `movedToSorting` at the JS boundary so its current meaning is honest.
  Applies to **either** Accepted status (cash or credit) — this was never
  cash-only.
- **A sorted row is deleted from `sorting_queue` once resolved** — the
  resulting Catalog row (or the incremented Bulk row) is the durable
  record from then on, not this table, matching this app's general
  preference for "the current record is the source of truth" over parallel
  history. An explicit, deliberate choice over `sync_queue`'s
  keep-and-mark-complete pattern, since sorting has no equivalent
  multi-platform-stamp reason to keep a completed row visible.
- **New top-level "Sorting" tab** (`src/components/sorting/SortingTab.jsx`),
  same tier as Catalog/Sync Queue/Import-Export/Scan Binder/Quote — a flat
  list of everything still waiting, each row showing its thumbnail (same
  `activeImageSrc` dual-image model a quote item already carries),
  name/game/set/rarity/condition, which quote it came from
  (`quoteCollectionName`, snapshotted so the row still reads sensibly if
  that quote is later deleted — `sorting_queue.quote_id` uses `on delete
  set null`), and a Sort button. Count badge on the tab itself, same
  pattern as Sync Queue's pending count.
- **`src/components/sorting/SortItemModal.jsx`** — one card's placement
  decision, asked individually, reusing the same `LocationPicker` +
  channel-checkbox UI `EditModal`/the old `AcceptQuoteModal` used, now
  with an explicit mode toggle:
  - **"Place individually"** (default) — a real binder/case + the usual
    POS/TCG Player/Collectr checkboxes, same "follow the majority of this
    location's existing items until manually touched" default
    (`channelDefaultsForLocation`) as everywhere else. Becomes a real
    Catalog row (`itemType: 'single'`) via `buildCatalogItemsFromQuoteItems`
    — that function kept its `(items, destination)` shape from PR #40,
    just called with a single-item array from the Sorting flow instead of
    a whole quote's items at once.
  - **"Add to Bulk"** — only a binder/case, no channels at all (a pile of
    loose bulk cards isn't a sellable SKU on its own). Confirm is disabled
    until a location is picked; individual mode additionally requires at
    least one channel checked, same gate as PR #40's modal had.
  - The confirm button is always labeled "Confirm" (not "Sort"/"Add to
    Bulk") — an earlier draft echoed the mode-toggle button's own label,
    which made the two indistinguishable both visually and to
    `getByRole('button', {name})` in tests.
- **Bulk is a THIRD `catalog.item_type` value (`'single' | 'slab' |
  'bulk'`), not a separate table.** A Bulk "item" is a normal catalog row
  scoped to one **(location, game)** pair (confirmed with the user —
  not per-location-only, and not per-set/per-card), with `qty` as its
  running count — sorting a card into Bulk finds the existing
  `(location, game)` row and increments its `qty`, or creates one if this
  is the first card sorted there (`findBulkRow`/`buildBulkCatalogItem` in
  `cardUtils.js`). Deliberately reuses every bit of existing Catalog
  infrastructure (`CatalogTable`, export, realtime sync, selling it back
  down via the normal qty-decrement flow) instead of inventing a parallel
  `bulk_counts` table — a Bulk row genuinely IS a catalog row, just one
  representing a pile instead of a single print. Carries no per-print
  identity (no set/rarity/condition/price) and **never** has any channel
  enabled (`posChannel`/`tcgplayerChannel`/`collectrChannel` all
  explicitly `false` — the one place in this app a new item's channels
  don't default to "everywhere").
  - `normalizeCard`'s `itemType` coercion (`normalizeItemType` in
    `cardUtils.js`) now recognizes `'bulk'` alongside the existing `'slab'`
    substring check, falling back to `'single'` for anything else — same
    lenient-substring-match discipline as the original slab-only version,
    so a stray case/whitespace variant still lands correctly.
  - `CatalogToolbar`'s type filter gained a "Bulk only" option (plain
    string equality already worked automatically for the status filter —
    `CatalogPanel`'s `typeFilter !== c.itemType` check needed no change).
  - `CatalogTable`'s `deriveRow` gives a Bulk row with no set/condition/
    printing a subtitle of "Bulk lot — not tracked individually" instead
    of an empty string, and both the desktop table and mobile card views
    gained a `.badge.bulk` (amber, matching `.badge.slab`'s purple)
    alongside the existing Slab badge.
  - **Excluded from `catalog_public_view`** (`item_type <> 'bulk'` added
    to the view's `where` clause in `phase10_sorting_bulk.sql`) — a Bulk
    lot isn't a specific card a customer browses/buys off the public
    binder page, just an internal holding count.
  - **Deliberately NOT wired into `EditModal`** beyond not crashing — a
    Bulk row falls through the existing "not slab" path, showing normal
    single-item fields (Set/Rarity/Condition etc.) blank and technically
    editable. Accepted as a known v1 limitation rather than adding a
    third `isSlab`-style form-type toggle right away: Bulk rows are
    created/incremented via the Sorting flow, not manually via "+ Add
    item," so this only matters if staff go hand-editing a Bulk row's qty
    directly in Catalog instead of through Sorting — still works, just
    shows some irrelevant blank fields alongside it.
- **`converted_to_catalog` (the DB column) is unchanged** — renaming it
  would mean an extra migration on a column already run against the real
  project for arguably cosmetic reasons. Its real meaning today is "moved
  to Sorting," not "in Catalog," so the JS-side field is renamed
  `movedToSorting` in `db.js`'s `rowToQuote`/`quoteToRow`, with a comment
  at both mapping points explaining the DB/JS name mismatch is
  deliberate.
- Covered by `cardUtils.test.js` (`findBulkRow`/`buildBulkCatalogItem`,
  including the increment-vs-create branch and game canonicalization),
  `quoteUtils.test.js` (`buildSortingItemsFromQuoteItems`, and
  `buildCatalogItemsFromQuoteItems`'s per-item `destination` param), and a
  new `e2e/sorting.spec.js`: accepting moves items to Sorting (not
  Catalog) regardless of viewport, individual placement creates a real
  Catalog row at the chosen location, two Bulk sorts into the same
  binder+game increment one row rather than creating two, and cancelling
  the sort modal leaves the item untouched in the queue. `e2e/quotes.spec.js`'s
  own accept-flow test was updated to assert items land in **Sorting**
  now, not Catalog — its old assertion was checking behavior this PR
  intentionally replaces.
- **`phase10_sorting_bulk.sql` needs to be run** in the Supabase SQL
  Editor (creates `sorting_queue`, recreates `catalog_public_view` with
  the Bulk exclusion) before this code can move quote items to Sorting —
  no code-side default masks a missing table here. `sorting_queue` also
  needs the same one-time manual add to Supabase's `supabase_realtime`
  publication (Database → Publications) that `quotes` needed.

## Testing

Sprint 3 turned into a real automated test suite (superseding the earlier,
informal "manual regression pass" plan) so mobile changes can be verified
without a physical phone every time.

- **Unit/component — Vitest + `@testing-library/react`** (`vitest.config.js`,
  jsdom environment). `npm test` (once) / `npm run test:watch`. Covers
  `src/lib/*.js`'s business logic (`cardUtils`, `db`, `cardSearch`,
  `importParse` — 96 tests across those four files) plus interactive
  component behavior for `SellModal`/`CatalogTable`/`EditModal` (mobile vs.
  desktop switch via a mocked `useIsMobile`, image-candidate selection,
  per-location channel defaults) — 111 tests total.
  - **`jsdom@30` requires Node ^22.22.2/^24.15.0/>=26** (its own
    `package.json` `engines` field) — CI's `test.yml` pins `node-version:
    22` for this reason. Node 20 fails with a cryptic `webidl.util.
    markAsUncloneable is not a function` deep in jsdom's bundled `undici`,
    and since this dev sandbox happens to run Node 22 already, that gap
    only showed up once the workflow actually ran in CI — worth remembering
    before dropping the pin back down.
  - `src/test/setup.js` stubs `window.matchMedia` (jsdom doesn't implement
    it) and explicitly wires up `@testing-library/react`'s `cleanup()` in an
    `afterEach` — that auto-cleanup only self-registers under Vitest's
    `globals: true`, which this project doesn't use (tests import
    `describe`/`it`/`expect` explicitly), so without this every test's
    rendered DOM would leak into the next test in the same file.
  - Not covered: `loadXlsxSheet`/`loadBinderPageFormat`/`readWorkbook` in
    `importParse.js` (need a real workbook fixture — exercised by manual
    testing only, per the existing "Manual QA note" above).
- **End-to-end — Playwright** (`playwright.config.js`, `e2e/*.spec.js`).
  `npm run test:e2e`. Runs the *real* app (`main.jsx`/`App.jsx`/
  `Login.jsx`/`BinderView.jsx`, completely unmodified) in a real Chromium
  browser at both a desktop and a mobile (`Pixel 7`) viewport — this is what
  actually verifies mobile CSS/layout, which jsdom component tests
  structurally cannot (no real layout engine, no `matchMedia`-driven
  reflow).
  - **The mock-data harness**: `src/test/harness/mockSupabaseClient.js` is a
    permanent, committed stand-in for `src/lib/supabase.js` — an in-memory
    `.from(table)` query builder plus `auth`/`channel`/`functions.invoke`
    stubs, keyed off `window.__HARNESS_SIGNED_IN__`/`window.__HARNESS_SEED__`
    (set via Playwright's `page.addInitScript`, see `e2e/fixtures.js`).
    `vite.config.js` only swaps it in under `vite --mode harness` — a mode
    only `playwright.config.js`'s `webServer` ever passes — via exact-string
    aliases (`./supabase.js`, `./lib/supabase.js`, `../lib/supabase.js`; one
    entry per relative form actually used in the codebase, since
    `@rollup/plugin-alias` matches the literal import specifier, not a
    resolved path). A normal `npm run dev`/`npm run build` never sets that
    mode, so production always gets the real Supabase client — confirmed by
    grepping the built `dist/` bundle for the harness's marker string.
    Deliberately *not* live-Supabase E2E, per an explicit decision: this
    sandbox has no network path to the real project, and pointing CI at a
    real backend would make the suite flaky/order-dependent and require
    shared-login credentials in a CI secret.
  - Covers: Catalog desktop-table vs. mobile-stacked-cards, add-item and
    sell (single-copy confirmation) flows, the public `BinderView` page
    (populated + empty states), and `Login` (form render, wrong-password
    error, successful sign-in) — all against the mocked backend, so they're
    deterministic and need no real credentials.
  - **Local Chromium path caveat**: this dev sandbox ships one pre-installed
    Chromium revision at a fixed path instead of one matching whatever
    `@playwright/test` version is in `package.json` — `playwright.config.js`
    only points `launchOptions.executablePath` at it when
    `PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers'` is set, which a real
    CI runner won't have, so CI downloads its own browser as normal via
    `npx playwright install --with-deps chromium`.
- **CI** (`.github/workflows/test.yml`): runs on every PR and push to
  `main` — a `unit` job (`npm test` + `npm run build`) and a separate `e2e`
  job (installs Chromium, `npm run test:e2e`), with the Playwright HTML
  report uploaded as an artifact on failure.

## Workflow conventions

- Feature/bugfix work goes through a PR; trivial single-line fixes may go
  straight to `main`.
- After every merge: sync the feature branch with `main`
  (`git fetch origin main && git merge origin/main`), rebuild to confirm,
  then continue — skipping this once caused a squash-merge to silently
  revert a file (see git history around PR #3).
- Never guess an external platform's exact file format/API capability when
  wrong-ness risk is high — get a real sample or do the research first
  (this burned us once on TCG Player/Collectr bulk-upload assumptions).
- **Verification cadence while iterating on an open PR**: run `npm test`
  (unit) and `npm run build` on every push — they're fast. Only run the
  full `npm run test:e2e` suite (~3 min) right before actually merging, not
  on every intermediate push — run just the specific `e2e/*.spec.js` file(s)
  that cover the area touched, if one exists, otherwise skip e2e for that
  push. Do the full e2e run as the last step before merge regardless.
