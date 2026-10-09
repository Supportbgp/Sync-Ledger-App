// Feature B (price tracking + spike alerts), PR 1 — see CLAUDE.md's "Price
// tracking & spike alerts" section. Triggered on a schedule by
// .github/workflows/price-check.yml (GitHub Actions cron), never by the
// browser — unlike scan-binder-page/card-lookup-proxy, this has no CORS
// allowlist at all, since a browser is never the caller.
//
// Unlike every other Edge Function in this repo, this one reads/writes
// Postgres directly (catalog, price_history, price_alerts,
// price_tracking_settings) using the service-role client Supabase injects
// into every Edge Function automatically (SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY env vars — no `supabase secrets set` needed for
// those two). The HTTP call itself still needs a valid Authorization bearer
// to pass Supabase's default per-function JWT check — the calling GitHub
// Actions workflow authenticates with the same service-role key, stored as
// a GitHub repository secret (SUPABASE_SERVICE_ROLE_KEY). See CLAUDE.md for
// the exact setup steps.
//
// Deploy from the repo root with:
//   supabase functions deploy price-check
//
// Per-provider price lookups below are a deliberately simpler, single-shot
// version of cardSearch.js's own interactive multi-tier fallback ladders —
// this runs unattended against the whole tracked catalog on a schedule, so
// request budget across many items matters more than getting any one item
// exactly right on the first try the way an interactive staff search does.
// A wrong/no match for one item just means no price_history row for it
// today, not a blocking failure — it'll be tried again on the next
// scheduled run. Field names/endpoints below mirror cardSearch.js's own
// already-confirmed shapes exactly (same real APIs, same response fields),
// not re-guessed from scratch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Light 1-retry-on-5xx safety net, same reasoning already used throughout
// cardSearch.js/card-lookup-proxy — none of these providers have a
// confirmed flakiness report severe enough to warrant pokemontcg.io's own
// aggressive 4-attempt backoff.
async function fetchWithRetry(url, delayMs = 500) {
  let res = await fetch(url);
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, delayMs));
    res = await fetch(url);
  }
  return res;
}

// pokemontcg.io's own key-less public tier is documented elsewhere in this
// app (cardSearch.js's pokemonQueryUncached) as needing anywhere from 3 to
// 12 *consecutive* 5xx retries in real live testing before succeeding — a
// single retry (fetchWithRetry above) is nowhere near enough. A real run of
// this checker against a catalog that's ~80% Pokemon by count confirmed
// this isn't theoretical: most of a 156/200 failure count traced back to
// this exact gap. Same 4-attempt backoff (400ms/1.0s/2.2s) already proven
// out for the interactive search, ported here since Edge Functions can't
// import from the client bundle.
const POKEMON_RETRY_DELAYS_MS = [400, 1000, 2200];
async function fetchWithPokemonRetry(url) {
  let res = await fetch(url);
  let attempt = 0;
  while (!res.ok && res.status >= 500 && attempt < POKEMON_RETRY_DELAYS_MS.length) {
    await new Promise((r) => setTimeout(r, POKEMON_RETRY_DELAYS_MS[attempt]));
    res = await fetch(url);
    attempt++;
  }
  return res;
}

async function runWithConcurrency(items, limit, worker) {
  let i = 0;
  async function next() {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

// A real run's sampleFailures (see the Deno.serve handler's own diagnostics)
// showed the dominant cause wasn't retries or API flakiness at all — it was
// that catalog.name frequently has extra text typed straight into it that
// isn't part of a card's actual indexed name: a collector number ("Charizard
// 4/102", "Snorlax - 051", "Vaporeon ex - 149/131"), a rarity/variant note
// ("Dialga EX (122 Secret Rare)", "Pongo - Determined Father (Enchanted)"),
// or several of these stacked ("Vampiric Tutor (JP Alternate Art) (Silver
// Scroll Foil)"). None of this is surprising once named — catalog.number was
// never a real column (see the Deno.serve handler's own comment on that),
// so staff had nowhere else to put a collector number but Name itself. Two
// real, separate problems this one cleanup step fixes: (1) an exact/
// near-exact name search on pokemontcg.io/Scryfall/etc. simply won't match a
// real card's name against this extra text, which is "no_match", not a
// retry-able failure; (2) Scryfall's own query syntax treats literal
// parentheses as search-grouping syntax, not text, so a parenthetical-heavy
// name can come back as a request failure rather than a real search
// attempt — plausibly explaining Magic's own disproportionate share of
// "fetch_failed" results, all of which were parenthetical-heavy names in
// the same real sample.
//
// Deliberately does NOT strip a bare " - <Words>" suffix with no trailing
// number — several real official card names use exactly that format (SWU's
// "Cad Bane - He Who Needs No Introduction", Lorcana's "Pongo - Determined
// Father" once its own "(Enchanted)" suffix is removed). See
// dashFallbackNames below for how those are handled instead — as a second,
// narrower fallback tier, not by stripping the dash outright.
//
// A follow-up real run (checked climbed from 58 to 133 once this function
// existed, but still had real failures) showed two more real gaps:
// (1) a bracketed annotation ("Misty's Psyduck [W Stamped]") survived
// untouched — this only ever stripped parenthetical groups, never
// square-bracket ones; (2) a *mid-string* parenthetical group
// ("Sheoldred, the Apocalypse (Textured Foil) - Dominaria United (DMU)")
// survived too, because the original regex only matched a run of groups
// anchored to the very end of the string — the non-paren " - Dominaria
// United" text between the two groups broke that anchor, leaving
// "(Textured Foil)" in place to trip Scryfall's own literal-parens-as-
// grouping-syntax problem again (a "fetch_failed", not a clean no-match).
// Every parenthetical/bracketed group seen across every real sample
// collected in this whole debugging arc has been an extraneous staff
// annotation (rarity/variant/printing note, grading stamp, set code) —
// never part of a card's actual name — so stripping every such group
// anywhere in the string, not just a trailing run of them, is a safe
// generalization of the same already-verified assumption, not a new guess.
function cleanCardName(name) {
  let n = String(name || "").trim();
  n = n.replace(/\([^)]*\)/g, " ");
  n = n.replace(/\[[^\]]*\]/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  n = n.replace(/\s*-?\s*\d+(\/\d+)?$/, "").trim();
  return n || String(name || "").trim();
}

// A real dash-subtitle card name (SWU's "Cad Bane - He Who Needs No
// Introduction", Lorcana's "Pongo - Determined Father") has now failed
// "no_match" for three consecutive real runs even after every cleanup
// above — the full name is correct, so this isn't noise to strip, but
// something about the full phrase isn't matching either provider's search
// as a single query. Rather than guess at either API's exact matching
// behavior (the thing this file's own header explicitly says not to do),
// this adds a second, narrower fallback tier — the same "narrower tier
// fails, fall through to a broader one" ladder discipline already used
// throughout cardSearch.js's interactive search — tried only once the full
// name has already come back empty, so it can only help, never override a
// query that already succeeds.
function dashFallbackNames(name) {
  const cleaned = cleanCardName(name);
  const names = [cleaned];
  const dashIdx = cleaned.indexOf(" - ");
  if (dashIdx > 0) {
    const prefix = cleaned.slice(0, dashIdx).trim();
    if (prefix && prefix !== cleaned) names.push(prefix);
  }
  return names;
}

// Tries each candidate name in order, stopping as soon as one actually
// finds something (a real price, or a real card with no usable price field
// — "no_price" is a confirmed match, not a reason to keep guessing at a
// different, possibly-wrong card). Only "no_match"/"fetch_failed" fall
// through to the next, broader candidate.
async function withNameFallback(item, queryOnce) {
  const names = dashFallbackNames(item.name);
  let result = { price: null, reason: "no_match" };
  for (const name of names) {
    result = await queryOnce(name);
    if (result.price != null || result.reason === "no_price") return result;
  }
  return result;
}

// pokemontcg.io's `q=` is a Lucene-like query string, not plain text —
// cardSearch.js's own interactive search (sanitizeStrippingPossessive) has
// already confirmed, via extensive real live testing, that an unescaped
// apostrophe/bracket/etc. in a `name:"..."` field can break the query
// outright, and that stripping a trailing possessive 's (mirroring the
// index's own English-analyzer possessive filter) is the correct general
// fix. Ported directly rather than re-guessed — this file's own header
// already says every provider's field shapes mirror cardSearch.js's
// already-confirmed ones instead of being rebuilt from scratch.
function sanitizeForPokemonQuery(s) {
  return String(s || "")
    .replace(/['’]s\b/gi, "")
    .replace(/[+\-!(){}[\]^"~*?:\\/'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Per-game price lookups -------------------------------------------
// Each takes the catalog row (name/set/rarity/number already on it) and
// returns { price, reason } — price is null when nothing usable was found,
// and reason explains which of three distinct failure modes it was:
// "fetch_failed" (the request itself never succeeded, even after retry),
// "no_match" (a real response came back with zero results for this name),
// or "no_price" (a card was found, but it carries no usable price field).
// Added after a real run's aggregate failedByGame count (99 Pokemon
// failures even with the 4-attempt retry budget) didn't say which of these
// three was actually happening — this is what lets the next run's response
// say that directly instead of requiring another guess-and-redeploy cycle.

function scryfallPrice(c) {
  const p = c.prices;
  if (!p) return null;
  if (p.usd != null) return Number(p.usd);
  if (p.usd_foil != null) return Number(p.usd_foil);
  if (p.usd_etched != null) return Number(p.usd_etched);
  if (p.usd_glossy != null) return Number(p.usd_glossy);
  return null;
}

async function magicPrice(item) {
  return withNameFallback(item, async (name) => {
    const res = await fetchWithRetry(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`);
    if (!res.ok) return { price: null, reason: "fetch_failed" };
    const data = await res.json();
    const card = (data.data || [])[0];
    if (!card) return { price: null, reason: "no_match" };
    const price = scryfallPrice(card);
    return { price, reason: price == null ? "no_price" : null };
  });
}

// Same fallback priority as cardSearch.js's pokemonTcgplayerPrice: a card
// commonly has no recent *sale* (market/mid) while still having real
// *listings* (low/high) — see CLAUDE.md's "no image candidate was ever
// showing a Market Value price" section for the full reasoning.
const POKEMON_PRICE_VARIANTS = ["normal", "holofoil", "reverseHolofoil", "1stEditionHolofoil", "1stEditionNormal"];
function pokemonTcgplayerPrice(c) {
  const prices = c.tcgplayer && c.tcgplayer.prices;
  if (!prices) return null;
  for (const variant of POKEMON_PRICE_VARIANTS) {
    const p = prices[variant];
    if (!p) continue;
    if (p.market != null) return p.market;
    if (p.mid != null) return p.mid;
    if (p.low != null && p.high != null) return (p.low + p.high) / 2;
    if (p.low != null) return p.low;
    if (p.high != null) return p.high;
  }
  return null;
}

async function pokemonPrice(item) {
  // No numberHint here — unlike cardSearch.js's interactive search, this
  // only has what catalog itself persists, and the collector number was
  // never one of those columns (it's a transient, never-saved search hint
  // everywhere else in this app too — see CLAUDE.md). Name-only, same as
  // every other provider below.
  return withNameFallback(item, async (name) => {
    const q = `name:"${sanitizeForPokemonQuery(name)}"`;
    const res = await fetchWithPokemonRetry(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`);
    if (!res.ok) return { price: null, reason: "fetch_failed" };
    const data = await res.json();
    const card = (data.data || [])[0];
    if (!card) return { price: null, reason: "no_match" };
    const price = pokemonTcgplayerPrice(card);
    return { price, reason: price == null ? "no_price" : null };
  });
}

async function yugiohPrice(item) {
  return withNameFallback(item, async (name) => {
    const res = await fetchWithRetry(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(name)}`);
    if (!res.ok) return { price: null, reason: "fetch_failed" };
    const data = await res.json();
    const card = (data.data || [])[0];
    if (!card) return { price: null, reason: "no_match" };
    const price = (card.card_prices && card.card_prices[0] && Number(card.card_prices[0].tcgplayer_price)) || null;
    return { price, reason: price == null ? "no_price" : null };
  });
}

function lorcastPrice(c) {
  const p = c.prices;
  if (!p) return null;
  if (p.usd != null) return Number(p.usd);
  if (p.usd_foil != null) return Number(p.usd_foil);
  return null;
}

async function lorcanaPrice(item) {
  return withNameFallback(item, async (name) => {
    const res = await fetchWithRetry(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(name)}`);
    if (!res.ok) return { price: null, reason: "fetch_failed" };
    const data = await res.json();
    const card = (data.results || [])[0];
    if (!card) return { price: null, reason: "no_match" };
    const price = lorcastPrice(card);
    return { price, reason: price == null ? "no_price" : null };
  });
}

// One Piece / Riftbound / Gundam — Egman's deckbuilder, same two-endpoint
// (full card list + full price list, joined by card_code) shape
// card-lookup-proxy's own egmanQuery already uses. No numberHint narrowing
// here (unlike egmanQuery's own interactive version) — catalog never
// persists a collector number (see pokemonPrice's own comment above for
// why), so this is name-match only, taking the first result.
async function egmanPrice(gameSlug, item) {
  const [cardsRes, pricesRes] = await Promise.all([
    fetchWithRetry(`https://deckbuilder.egmanevents.com/api/cards/${gameSlug}`),
    fetchWithRetry(`https://deckbuilder.egmanevents.com/api/prices/${gameSlug}`),
  ]);
  if (!cardsRes.ok) return { price: null, reason: "fetch_failed" };
  const cards = await cardsRes.json();
  const prices = pricesRes.ok ? await pricesRes.json() : [];
  const priceByCode = new Map((Array.isArray(prices) ? prices : []).map((p) => [p.card_code, p]));

  return withNameFallback(item, (name) => {
    const nameNeedle = name.toLowerCase();
    const matches = (Array.isArray(cards) ? cards : [])
      .filter((c) => (c.name || "").toLowerCase().includes(nameNeedle));

    const match = matches[0];
    if (!match) return { price: null, reason: "no_match" };
    const priceEntry = priceByCode.get(match.card_code);
    const price = priceEntry ? priceEntry.market_price : null;
    return { price, reason: price == null ? "no_price" : null };
  });
}

async function swuPrice(item) {
  return withNameFallback(item, async (name) => {
    const res = await fetchWithRetry(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(name)}&pretty=true`);
    if (!res.ok) return { price: null, reason: "fetch_failed" };
    const data = await res.json();
    const card = (Array.isArray(data.data) ? data.data : [])[0];
    if (!card) return { price: null, reason: "no_match" };
    const price = card.MarketPrice ? Number(card.MarketPrice) : null;
    return { price, reason: price == null ? "no_price" : null };
  });
}

// Sports Singles has no card database to look up against at all (a
// documented, accepted drawback elsewhere in this app) — simply absent
// here, same as every other provider dispatch table in this codebase, so
// it's silently skipped rather than erroring.
const PRICE_LOOKUPS = {
  Magic: magicPrice,
  Pokemon: pokemonPrice,
  Yugioh: yugiohPrice,
  Lorcana: lorcanaPrice,
  "One Piece": (item) => egmanPrice("optcg", item),
  Riftbound: (item) => egmanPrice("riftbound", item),
  Gundam: (item) => egmanPrice("gundam", item),
  SWU: swuPrice,
};

async function lookupPrice(item) {
  const fn = PRICE_LOOKUPS[item.game];
  if (!fn) return { price: null, reason: "no_lookup" };
  try {
    return await fn(item);
  } catch {
    return { price: null, reason: "exception" };
  }
}

// A defensive cap on how many items one invocation will check — Edge
// Functions have a real execution time limit, and a shop whose tracked
// (above-floor) catalog grows past this will need a different approach
// (e.g. splitting across more frequent runs) rather than silently timing
// out partway through an unbounded batch. Ordered by price descending so
// the most valuable (and highest spike-risk) items are checked first if a
// run ever does have to truncate.
const MAX_ITEMS_PER_RUN = 200;
const CONCURRENCY = 3;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: settingsRow } = await admin
    .from("price_tracking_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const floor = (settingsRow && settingsRow.floor_price) ?? 25;
  const spikePct = (settingsRow && settingsRow.spike_pct) ?? 20;

  // Bulk lots have no per-print identity to look up at all (see CLAUDE.md's
  // "Sorting stage + Bulk item type" section) — excluded the same way
  // catalog_public_view excludes them. No `number` column — collector
  // number has never been a persisted catalog column anywhere in this app
  // (confirmed against every `alter table catalog add column` migration —
  // only base_price and rarity were ever added), only a transient,
  // never-saved search-hint field elsewhere in the UI. The first real
  // manual trigger run of this function failed with exactly this mistake
  // ("column catalog.number does not exist") — caught by the user's own
  // manual test, not by review, so each per-game lookup above was also
  // stripped of its now-impossible numberHint narrowing.
  //
  // Compares against `price` ("Our Price"), not `base_price` — a second
  // real finding from manual testing. `base_price` is only ever populated
  // when staff run "Find stock image"/"Find market price" and pick a
  // candidate (Sprint 5's Market Value feature); confirmed via a real query
  // against the live project that 0 of 599 real catalog items had
  // base_price set, so the floor/comparison never matched anything at all.
  // `price` is what every real item actually has — confirmed with the user
  // that comparing a fresh market price against what's currently charged is
  // the right comparison anyway (the goal is "notice our listed price is
  // now stale relative to the market," which `price` answers more directly
  // than a possibly-never-captured reference price would). This never
  // writes back to `price` — same "never silently overwrite a manual
  // entry" rule already documented below.
  //
  // `.in("game", ...)` — a third real finding from the first full-volume
  // test run: a shop catalog of 241 above-floor items broke down as 166
  // Pokemon / 36 Magic / 12 "Other" / 10 One Piece / 9 SWU / 8 Lorcana (a
  // real query against the live project, not guessed) — "Other" is a real,
  // legitimate GAMES value (canonicalizeGame's own fallback for an
  // unrecognized game string, e.g. some Quote-tab-originated items), but
  // PRICE_LOOKUPS has no entry for it at all, so those items could never
  // succeed and were just burning slots in the 200-item cap for no reason.
  // Filtering to only games this file actually knows how to look up keeps
  // every checked slot meaningful; Sports Singles is excluded the same way
  // (no card database exists for it, a documented drawback elsewhere in
  // this app) without needing its own special case.
  const { data: items, error } = await admin
    .from("catalog")
    .select("sku, name, game, price")
    .neq("item_type", "bulk")
    .not("price", "is", null)
    .gte("price", floor)
    .in("game", Object.keys(PRICE_LOOKUPS))
    .order("price", { ascending: false })
    .limit(MAX_ITEMS_PER_RUN);

  if (error) {
    return json({ error: error.message }, 500);
  }

  let checked = 0, spikes = 0, failed = 0;
  const failedByGame = {};
  const failedByReason = {};
  // Finer-grained than either tally alone — this round's diagnosis needed to
  // cross-reference failedByGame against sampleFailures by hand to see that
  // Magic's failures were disproportionately fetch_failed while Pokemon's
  // were disproportionately no_match; this gives that cross-tabulation
  // directly in the response instead.
  const failedDetail = {};
  const sampleFailures = [];
  const MAX_SAMPLE_FAILURES = 15;

  await runWithConcurrency(items || [], CONCURRENCY, async (item) => {
    const { price, reason } = await lookupPrice(item);
    if (price == null) {
      failed++;
      failedByGame[item.game] = (failedByGame[item.game] || 0) + 1;
      failedByReason[reason] = (failedByReason[reason] || 0) + 1;
      failedDetail[item.game] = failedDetail[item.game] || {};
      failedDetail[item.game][reason] = (failedDetail[item.game][reason] || 0) + 1;
      // Capped sample of real failing names so a high-failure run can be
      // inspected directly from the response instead of needing yet
      // another round-trip to a SQL query to find real examples — this is
      // exactly how the "Other"/Pokemon-retry issues above were diagnosed,
      // just made available without re-querying every time.
      if (sampleFailures.length < MAX_SAMPLE_FAILURES) {
        sampleFailures.push({ sku: item.sku, name: item.name, game: item.game, reason });
      }
      return;
    }
    checked++;

    await admin.from("price_history").insert({
      sku: item.sku, name: item.name, game: item.game, price,
    });

    const pctChange = item.price > 0 ? ((price - item.price) / item.price) * 100 : 0;
    if (pctChange >= spikePct) {
      // Don't pile up a fresh alert every single day a sustained spike
      // persists — one unacknowledged alert per sku is enough to drive the
      // in-app badge; staff dismiss it (or update the price) once, not once
      // per day it stays elevated.
      const { data: existing } = await admin
        .from("price_alerts")
        .select("id")
        .eq("sku", item.sku)
        .eq("acknowledged", false)
        .limit(1);
      if (!existing || existing.length === 0) {
        spikes++;
        await admin.from("price_alerts").insert({
          sku: item.sku, name: item.name, game: item.game,
          previous_price: item.price, new_price: price, pct_change: pctChange,
        });
      }
    }
  });

  // failedByGame/failedByReason/failedDetail/sampleFailures are included so
  // a future high-failure run can be diagnosed from the response alone, the
  // same real-usage-driven approach that found the "Other" and
  // Pokemon-retry issues above in the first place — no need to go back to a
  // SQL query every time.
  return json({ total: (items || []).length, checked, spikes, failed, failedByGame, failedByReason, failedDetail, sampleFailures }, 200);
});

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
