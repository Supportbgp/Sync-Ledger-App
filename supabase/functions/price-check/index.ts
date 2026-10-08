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

// --- Per-game price lookups -------------------------------------------
// Each takes the catalog row (name/set/rarity/number already on it) and
// returns a single best-effort price, or null if nothing usable was found.

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
  const res = await fetchWithRetry(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(item.name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = (data.data || [])[0];
  return card ? scryfallPrice(card) : null;
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
  let q = `name:"${item.name}"`;
  if (item.number) q += ` number:${item.number.split("/")[0].trim()}`;
  const res = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = (data.data || [])[0];
  return card ? pokemonTcgplayerPrice(card) : null;
}

async function yugiohPrice(item) {
  const res = await fetchWithRetry(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(item.name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = (data.data || [])[0];
  if (!card) return null;
  return (card.card_prices && card.card_prices[0] && Number(card.card_prices[0].tcgplayer_price)) || null;
}

function lorcastPrice(c) {
  const p = c.prices;
  if (!p) return null;
  if (p.usd != null) return Number(p.usd);
  if (p.usd_foil != null) return Number(p.usd_foil);
  return null;
}

async function lorcanaPrice(item) {
  const res = await fetchWithRetry(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(item.name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = (data.results || [])[0];
  return card ? lorcastPrice(card) : null;
}

// One Piece / Riftbound / Gundam — Egman's deckbuilder, same two-endpoint
// (full card list + full price list, joined by card_code) shape
// card-lookup-proxy's own egmanQuery already uses. numberHint narrows by the
// printed collector number (card_code's suffix after the last dash), same
// leading-zero-insensitive match used there.
async function egmanPrice(gameSlug, item) {
  const [cardsRes, pricesRes] = await Promise.all([
    fetchWithRetry(`https://deckbuilder.egmanevents.com/api/cards/${gameSlug}`),
    fetchWithRetry(`https://deckbuilder.egmanevents.com/api/prices/${gameSlug}`),
  ]);
  if (!cardsRes.ok) return null;
  const cards = await cardsRes.json();
  const prices = pricesRes.ok ? await pricesRes.json() : [];
  const priceByCode = new Map((Array.isArray(prices) ? prices : []).map((p) => [p.card_code, p]));

  const nameNeedle = item.name.toLowerCase();
  let matches = (Array.isArray(cards) ? cards : [])
    .filter((c) => (c.name || "").toLowerCase().includes(nameNeedle));

  if (item.number) {
    const needle = String(item.number).trim().toLowerCase();
    const numNeedle = needle.replace(/^0+/, "") || "0";
    const narrowed = matches.filter((c) => {
      const code = (c.card_code || "").toLowerCase();
      const suffix = code.includes("-") ? code.split("-").pop() : code;
      return (suffix.replace(/^0+/, "") || "0") === numNeedle;
    });
    if (narrowed.length) matches = narrowed;
  }

  const match = matches[0];
  if (!match) return null;
  const priceEntry = priceByCode.get(match.card_code);
  return priceEntry ? priceEntry.market_price : null;
}

async function swuPrice(item) {
  const res = await fetchWithRetry(`https://api.swu-db.com/cards/search?q=${encodeURIComponent(item.name)}&pretty=true`);
  if (!res.ok) return null;
  const data = await res.json();
  const card = (Array.isArray(data.data) ? data.data : [])[0];
  return card && card.MarketPrice ? Number(card.MarketPrice) : null;
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
  if (!fn) return null;
  try {
    return await fn(item);
  } catch {
    return null;
  }
}

// A defensive cap on how many items one invocation will check — Edge
// Functions have a real execution time limit, and a shop whose tracked
// (above-floor) catalog grows past this will need a different approach
// (e.g. splitting across more frequent runs) rather than silently timing
// out partway through an unbounded batch. Ordered by base_price descending
// so the most valuable (and highest spike-risk) items are checked first if
// a run ever does have to truncate.
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
  // catalog_public_view excludes them. An item with no base_price was never
  // priced via a real search result to begin with, so there's nothing to
  // compare a fresh price against yet.
  const { data: items, error } = await admin
    .from("catalog")
    .select("sku, name, game, number, base_price")
    .neq("item_type", "bulk")
    .not("base_price", "is", null)
    .gte("base_price", floor)
    .order("base_price", { ascending: false })
    .limit(MAX_ITEMS_PER_RUN);

  if (error) {
    return json({ error: error.message }, 500);
  }

  let checked = 0, spikes = 0, failed = 0;

  await runWithConcurrency(items || [], CONCURRENCY, async (item) => {
    const price = await lookupPrice(item);
    if (price == null) { failed++; return; }
    checked++;

    await admin.from("price_history").insert({
      sku: item.sku, name: item.name, game: item.game, price,
    });

    const pctChange = item.base_price > 0 ? ((price - item.base_price) / item.base_price) * 100 : 0;
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
          previous_price: item.base_price, new_price: price, pct_change: pctChange,
        });
      }
    }
  });

  return json({ total: (items || []).length, checked, spikes, failed }, 200);
});

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
