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
  in CSS): a small colored badge next to each item's name showing its game,
  reusing the six existing accent tokens (some repeat — there are more
  games than tokens) chosen loosely by each game's real-world brand color
  where one exists (Magic's purple, Pokemon's yellow, One Piece's ocean
  blue, Gundam's red). Games with no obvious color default to a neutral
  gray tag rather than no tag at all, so every row still shows its game.
  Requested as part of "more vibrant/colorful" — adds a real scan-by-color
  aid on a catalog that stocks 9+ separate game lines, not just decoration.
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
  exist (same photo-first default as `resolveActiveImage`), with no
  per-row toggle — that's available in the Edit modal once the item's
  actually saved. **Requires redeploying `scan-binder-page`**
  (`supabase functions deploy scan-binder-page`) before this takes effect —
  the schema change is server-side.
  - **Crop accuracy is hit-or-miss** — real-world testing showed the model's
    bbox tends to hug the card too tightly and most often clips the *top*
    edge (the bottom of a plastic pocket is a sharp, unambiguous line; the
    top blends into the pocket/page above it). Two independent mitigations,
    not one: the prompt now tells the model to anchor on the bottom edge
    first and err toward a slightly larger box; separately, and regardless
    of how good the model's box is, `cropImageRegion` always pads the box
    outward before cropping — 10% of the box's own height on top, 2%
    bottom, 3% left/right (`DEFAULT_CROP_PADDING`) — so a slightly-short box
    still captures the whole card. Padding is relative to the detected
    box's own size, not the full page, so it scales with card size rather
    than being a fixed pixel margin.
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

- `xlsx@0.18.5` (used for XLSX export) has two known unpatched
  vulnerabilities (prototype pollution, ReDoS). The fix is only distributed
  via SheetJS's own CDN (`cdn.sheetjs.com`), not npm — upgrade from an
  unrestricted network with `npm install https://cdn.sheetjs.com/xlsx-<latest>/xlsx-<latest>.tgz`.
- TCG Player and Collectr have no bulk-upload/bulk-create API available to
  this app (confirmed by research, not assumed) — the Export modal produces
  manual-entry-aid lists, not files either platform can ingest directly.
- Card image/price search (`cardSearch.js`) covers Magic, Pokemon, Yu-Gi-Oh,
  Lorcana, One Piece, Riftbound, Gundam, and SWU. Only Sports Singles has no
  lookup (no card database exists for it). Findings from Sprint 4,
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
