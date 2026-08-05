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
- Card image/price search (`cardSearch.js`) only covers Magic, Pokemon, and
  Yu-Gi-Oh today. Lorcana/One Piece/SWU/Riftbound/Sports Singles have no
  lookup yet.
- No per-condition market pricing exists in any free card-data API — every
  one (Scryfall, pokemontcg.io, YGOPRODeck, Lorcast, etc.) exposes a single
  NM-level aggregate price. True per-condition pricing requires TCGPlayer's
  own partner-gated Pricing API (new applications closed since late 2024;
  existing seller API keys keep working) or a derived
  NM-price-×-condition-multiplier approach. Scraping vendor sites (eBay,
  CoolStuffInc, Star City Games, Troll and Toad) was evaluated and rejected —
  no real per-condition data gain, and most explicitly ban scraping in their
  ToS.
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
