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
  platform-status-reset logic), `cardSearch.js` (Scryfall/pokemontcg.io/
  YGOPRODeck card+image lookup), `csv.js`/`importParse.js`/`exportFormats.js`
  (import/export), `image.js` (client-side photo resize), `scanner.js`
  (binder-scan Edge Function client), `qr.js` (QR generation), `supabase.js`
  (client init).
- `src/components/catalog/` — main catalog table, edit/sell modals, batch
  actions.
- `src/components/queue/` — the Sync Queue tab (POS/TCG Player/Collectr
  three-stamp tracking).
- `src/components/importexport/` — CSV import, the consolidated Export
  modal, and the Binder QR modal.
- `src/components/scanner/` — the binder-page scanner review queue.
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

## Next sprints

- **TCG Player draft-catalog export**: TCG Player's draft catalog accepts a
  bulk .xlsx/.csv upload for *new* products, not just updates to existing
  listings — confirmed by hands-on investigation (see Known constraints
  above), correcting the earlier "manual-entry-aid only" assumption Export
  was built around. This sprint builds an actual upload-ready export format
  for TCG Player specifically. Get the real required column layout/format
  before building — same "never guess an external platform's file format"
  discipline that's applied everywhere else in this project.
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
