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
- `game` values are canonicalized on read (`canonicalizeGame`/
  `GAME_ALIASES` in `cardUtils.js`) so imported data like "MTG" normalizes to
  "Magic" — several features (image search, scanner) do exact string checks
  against the canonical game names in the `GAMES` array (kept in sync across
  `EditModal.jsx` and `ScannerPanel.jsx`).
- `catalog_public_view` (SQL, not in the app code) is the only thing the
  public binder page reads — a restricted view exposing browsing-safe
  columns only, for unsold/in-stock rows. It relies on view-ownership
  bypassing the base table's RLS, so `anon` never touches `catalog` directly.

## Known constraints / accepted risks

- `xlsx@0.18.5` (used for XLSX export) has two known unpatched
  vulnerabilities (prototype pollution, ReDoS). The fix is only distributed
  via SheetJS's own CDN (`cdn.sheetjs.com`), not npm — upgrade from an
  unrestricted network with `npm install https://cdn.sheetjs.com/xlsx-<latest>/xlsx-<latest>.tgz`.
- TCG Player and Collectr have no bulk-upload/bulk-create API available to
  this app (confirmed by research, not assumed) — the Export modal produces
  manual-entry-aid lists, not files either platform can ingest directly.
- Card image/price search (`cardSearch.js`) covers Magic, Pokemon, Yu-Gi-Oh,
  and (Sprint 4) Lorcana via Lorcast (`api.lorcast.com`, free/no-key,
  confirmed CORS-safe for direct browser calls). One Piece, SWU, Riftbound,
  and Sports Singles still have no lookup — findings from Sprint 4
  investigation, live-tested from the browser console (not just docs
  research, since CORS can't be verified any other way):
  - **One Piece** (`optcgapi.com`) — real API, but confirmed **CORS-blocked**
    (no `Access-Control-Allow-Origin` header). Needs a server-side proxy
    (Edge Function, same pattern as the binder scanner) to use at all — a
    real architecture decision, not just more integration work.
  - **SWU** — real API at `www.swu-db.com/api` (the `www.` matters, a bare
    `swu-db.com` doesn't resolve). CORS status not yet live-tested.
  - **Riftbound** — no free, no-key, CORS-safe API found. The only
    candidates (JustTCG, apitcg.com) require a server-side-only key by their
    own docs, which a pure static SPA can't hold safely. Parked pending
    either a public API appearing or committing to a proxy. Community
    databases exist (Piltover Archive, RiftMana, Egman's deck builder) but
    aren't confirmed to expose a usable underlying API yet.
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

## Noted for later iterations

- CSV/XLSX import (`ImportExportPanel.jsx`) has no "where does this live?"
  channel picker — unlike the Edit modal and the Scanner's batch flow, an
  import currently always defaults every row's item to all three channels.
  Should get the same per-batch channel checkboxes those two already have.
- CSV/XLSX import does no image search — it only detects a direct image URL
  already present in the file (`isLikelyImageUrl` in `importParse.js`). Could
  follow the Scanner's pattern (`findImageCandidates`) to auto-search each
  imported row's card image via `cardSearch.js`.

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
