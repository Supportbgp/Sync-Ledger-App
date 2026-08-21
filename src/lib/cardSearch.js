import { supabaseClient } from './supabase.js';

// Repeatedly strips a trailing "(...)" group. Used only to get down to the
// literal card name for the base query — Scryfall's `name` field doesn't
// include print-treatment text like "(Borderless)", even though that text is
// real and meaningful (see parseTrailingCollectorNumber below for where it
// actually needs to go).
function stripTrailingParens(name) {
  let s = name;
  let next = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
  while (next !== s) {
    s = next;
    next = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
  }
  return s;
}

// A trailing "(1234)" on an imported name is a collector number, not junk —
// it's often the ONLY thing distinguishing multiple prints that otherwise
// share a name and treatment (e.g. three different "Bruce Banner
// (Borderless)" cards in the same set, numbered differently). Scryfall
// exposes collector number as its own searchable field (`number:`), so pull
// it out and use it to find the exact print instead of discarding it.
function parseTrailingCollectorNumber(name) {
  const m = name.match(/\((\d+)\)\s*$/);
  if (!m) return { name, collectorNumber: null };
  return { name: name.slice(0, m.index).trim(), collectorNumber: m[1] };
}

// Scryfall's own pricing model (confirmed via its API blog post announcing
// the finishes field, 2021-09-02): a print's `prices` object carries up to
// four independent USD fields — usd (nonfoil), usd_foil, usd_etched, and
// usd_glossy — not one flat price. A foil-only or etched-only print (a
// Secret Lair drop, most often) can have a null `usd` while still carrying
// a real price under one of the others. Falls back through them in
// nonfoil-first order — same "most-common baseline first" reasoning as
// Pokemon's POKEMON_PRICE_VARIANTS fallback — so a real print isn't
// reported as "no price data" just because it never had a plain nonfoil
// version.
function scryfallPrice(c) {
  const p = c.prices;
  if (!p) return null;
  if (p.usd != null) return Number(p.usd);
  if (p.usd_foil != null) return Number(p.usd_foil);
  if (p.usd_etched != null) return Number(p.usd_etched);
  if (p.usd_glossy != null) return Number(p.usd_glossy);
  return null;
}

// Confirmed live (not guessed): Scryfall's /cards/search returns HTTP 404
// with an error object specifically to mean "zero cards matched this
// query" — its normal, expected response for a query that's simply too
// narrow, not a failure. Treating it as an error (like every other non-ok
// status) would make every legitimately-empty search tier below look like
// "the database is down," which it isn't. A real 5xx gets a short retry —
// Scryfall's public API has no confirmed flakiness report the way
// pokemontcg.io's does (see that function's own retry comment), so this is
// deliberately a lighter, 1-retry safety net rather that copying Pokemon's
// aggressive 4-attempt backoff wholesale — and still throws (rather than
// silently returning []) if it doesn't recover, so a real outage surfaces
// as an honest "couldn't reach the database" instead of a misleading "no
// matches."
const SCRYFALL_RETRY_DELAYS_MS = [500];
async function scryfallQuery(q, attempt = 0) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
  if (res.status === 404) return [];
  if (!res.ok) {
    if (res.status >= 500 && attempt < SCRYFALL_RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, SCRYFALL_RETRY_DELAYS_MS[attempt]));
      return scryfallQuery(q, attempt + 1);
    }
    throw new Error(`Scryfall returned ${res.status}`);
  }
  const data = await res.json();
  return (data.data || []).slice(0, 6).map(c => ({
    url: (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal),
    label: `${c.name} (${c.set_name}) #${c.collector_number}`,
    // NM (near-mint, nonfoil-first) market price in USD — this exact
    // print's price, not a generic name-based lookup, since it's the same
    // card object the image came from. Used as the Market Value feature's
    // reference price.
    price: scryfallPrice(c),
    // A direct link to this exact print's real TCGPlayer listing — the
    // NM-price-times-multiplier estimate can be badly wrong for high-value
    // outliers (a flat percentage is a population average, not this card's
    // real going rate), so staff need a one-click way to check the actual
    // current per-condition listings before pricing anything expensive.
    listingUrl: c.purchase_uris && c.purchase_uris.tcgplayer,
    rarity: c.rarity || '',
    // Structured (not just baked into the label), same as Pokemon's
    // candidates — lets a confirmed pick back-fill the item's own Set/
    // Number fields (see selectCandidate in EditModal.jsx).
    set: c.set_name || '',
    number: c.collector_number || '',
  })).filter(r => r.url);
}

// pokemontcg.io doesn't always use its own Title-Case convention — a real
// sample from the Mega Evolution era (Ascended Heroes) returned
// "MEGA_ATTACK_RARE" for one rarity while every other value in the same set
// was normal Title Case ("Special Illustration Rare", etc.). Normalizing
// underscores/hyphens to spaces before comparing means the model's (Title
// Case) guess still matches that inconsistency instead of silently missing it.
function normalizeRarityForMatch(s) {
  return s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Soft preference, not a hard filter — moves results whose own reported
// rarity loosely matches the hint to the front, but never drops anything.
// A hard filter risks silently zeroing out results over a vocabulary
// mismatch (the binder scanner's rarity guess is free text, not guaranteed
// to match a given API's exact rarity strings); this can only ever help.
function preferRarity(results, rarityHint) {
  if (!rarityHint || !results.length) return results;
  const needle = normalizeRarityForMatch(rarityHint);
  if (!needle) return results;
  const matched = [], rest = [];
  for (const r of results) {
    if (r.rarity && normalizeRarityForMatch(r.rarity).includes(needle)) matched.push(r);
    else rest.push(r);
  }
  return matched.length ? [...matched, ...rest] : results;
}

// A printed Magic collector number is occasionally typed with a leading "#"
// or (staff muscle memory from Pokemon's "280/217" style) a trailing
// "/<set total>" — neither of which Scryfall's number: operator expects.
function sanitizeMagicNumber(s) {
  return String(s).trim().replace(/^#/, '').split('/')[0].trim();
}

export async function searchScryfall(name, setHint, rarityHint, numberHint) {
  const trimmed = name.trim();
  const { name: withoutNumber, collectorNumber: parsedNumber } = parseTrailingCollectorNumber(trimmed);
  const cleanName = stripTrailingParens(withoutNumber);
  // setHint is deliberately unused here. Scryfall's set:/s:/e:/edition:
  // operators only match a print's 3-4 letter SET CODE, not its full set
  // name (confirmed via Scryfall's own syntax docs/examples — "e:ktk", not
  // "e:Khans of Tarkir") — and this app's Set field holds whatever free
  // text staff typed or the scanner read off the card, almost always a full
  // name, not a code. There's no lookup in this app from set name to set
  // code, so turning setHint into a set: filter would risk silently zeroing
  // out a correct match on a mismatch it can't detect — the same
  // "don't guess an external platform's exact capability" call made
  // elsewhere in this file (see setHint's own use for the Egman-backed
  // games, where it's safe specifically because those responses carry a
  // real card_code field to match against). Accepted as a parameter anyway
  // so every entry in searchCardImage's dispatch table has the same
  // (name, setHint, rarityHint, numberHint) shape.
  const collectorNumber = (numberHint ? sanitizeMagicNumber(numberHint) : '') || parsedNumber;

  // An explicit or name-embedded collector number is the strongest
  // disambiguator a Magic print has — same-name reprints (extended art,
  // showcase, borderless, judge promos…) are common, and unlike Pokemon's
  // scanner-guessed set/number, a Number staff actually typed in is
  // trustworthy enough to try first rather than as a last resort.
  if (collectorNumber) {
    const base = cleanName || trimmed;
    try {
      let results = await scryfallQuery(`!"${base}" number:${collectorNumber}`);
      if (results.length) return preferRarity(results, rarityHint);
      const unpadded = collectorNumber.replace(/^0+/, '') || collectorNumber;
      if (unpadded !== collectorNumber) {
        results = await scryfallQuery(`!"${base}" number:${unpadded}`);
        if (results.length) return preferRarity(results, rarityHint);
      }
    } catch {
      // A persistent failure on this one narrow query shouldn't abort the
      // whole search — fall through to the broader tiers below, same
      // per-tier isolation searchPokemon uses for the identical reason.
    }
  }

  const hasBroaderTier = cleanName && cleanName !== trimmed;
  let results = [];
  try {
    results = await scryfallQuery(trimmed);
    if (results.length) return preferRarity(results, rarityHint);
  } catch (err) {
    if (!hasBroaderTier) throw err;
    results = [];
  }

  if (hasBroaderTier) {
    // No exact print match — surface every print of the base card (there may
    // be several, which is exactly the case that got us here) so staff can
    // pick the right one visually from the candidate grid. This really is
    // the last tier now, so its failure is allowed to propagate — a
    // genuinely unreachable API still reports as an error rather than a
    // misleading "no matches."
    results = await scryfallQuery(cleanName);
  }
  return preferRarity(results, rarityHint);
}

// pokemontcg.io's `q=` is a Lucene-like query string, not plain text — these
// characters are operators there. Escaping them with a backslash is the
// textbook-correct approach, but their backend doesn't reliably parse that
// escape sequence (observed 500s on an escaped hyphen next to a promo/set
// code, e.g. "V \- SWSH204") — so instead of trusting their parser to honor
// an escape, just replace the special character with a space. It's a fuzzy
// image lookup, not an exact-match field, so losing the literal punctuation
// costs nothing. General-purpose use (e.g. sanitizing a setHint, where a
// possessive apostrophe essentially never occurs) — see the two variants
// below for the name field itself, where it does.
function sanitizeForPokemonQuery(s) {
  return s.replace(/[+\-!(){}[\]^"~*?:\\/'’]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Possessive apostrophes ("Lillie's", "Cynthia's") are genuinely ambiguous
// without being able to inspect pokemontcg.io's live index (this app has no
// network path to it from a dev sandbox): one real possibility is that their
// search runs on an Elasticsearch/Lucene English analyzer, which applies a
// possessive filter that strips a trailing 's from a token during indexing —
// under that theory the real card is indexed as ["lillie","clefairy","ex"],
// and replacing the apostrophe with a space (as an earlier fix here did)
// inserts a spurious extra "s" token that breaks the exact-phrase tier's
// adjacency match. That was real-world tested and found to help sometimes
// but not reliably on its own — so instead of committing to one theory,
// searchPokemon below tries both representations of the name at every
// precision tier: this one (the 's stripped outright, no replacement
// character) and sanitizeKeepingApostrophe below (the apostrophe left in
// place, on the theory the index actually needs it). For a name with no
// apostrophe at all, the two functions produce an identical string, so this
// costs nothing extra in the overwhelmingly common case.
function sanitizeStrippingPossessive(s) {
  return s.replace(/['’]s\b/gi, '').replace(/[+\-!(){}[\]^"~*?:\\/'’]/g, ' ').replace(/\s+/g, ' ').trim();
}

// The other theory (see sanitizeStrippingPossessive above): the apostrophe
// needs to stay in the query literally for it to match the index. A literal
// apostrophe isn't itself a Lucene special character, so this only strips
// every OTHER special character, same as sanitizeForPokemonQuery.
function sanitizeKeepingApostrophe(s) {
  return s.replace(/[+\-!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

// A printed number is usually shown as "280/217" (this print's number over
// the set's total card count) — pokemontcg.io's `number` field only stores
// the first part, so the denominator has to be dropped rather than passed
// through sanitizeForPokemonQuery (which would turn the slash into a space
// and search for "280 217" as if that were the number).
function sanitizePokemonNumber(s) {
  return s.split('/')[0].trim();
}

// TCGPlayer prices on a pokemontcg.io card are keyed by print variant
// (normal/holofoil/reverseHolofoil/1st-edition combos), not one flat field —
// take the first variant that's actually present, in roughly most-to-least
// common order, rather than guessing every card has the same one.
//
// Within a variant, the four sub-fields aren't interchangeable: per
// TCGPlayer's own pricing docs, `market` is an aggregate of *sold* listings
// over the previous week, while `mid`/`low`/`high` are drawn from *current*
// listings. A real, expensive, low-volume chase card (a Mega ex was the
// real-world report) can easily have zero completed sales in a given week —
// `market` (and often `mid`, the median of those same sales) comes back
// null — while still having real active TCGPlayer listings, which is
// exactly what `low`/`high` reflect. Only bailing out at market/mid meant
// reporting "no price data" for a card that visibly has real listings.
// Falling back further, in the same most-reliable-first order, surfaces a
// real listing-based estimate instead.
const POKEMON_PRICE_VARIANTS = ["normal", "holofoil", "reverseHolofoil", "1stEditionNormal", "1stEditionHolofoil"];
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

// Live-tested (real browser requests against api.pokemontcg.io, 2026-08-21):
// a single query needed anywhere from 3 to 12 consecutive 5xx responses
// before finally succeeding — the public, key-less tier is currently far
// flakier than the "occasional transient 5xx" the original one-retry fix
// assumed. That single retry wasn't nearly enough margin: a query that
// would have succeeded on its 4th attempt was instead marked "empty" after
// its 1 retry, and searchPokemon's fallback ladder moved on to a broader
// (and often wrong-print) tier instead — direct real-world testing traced
// this as the dominant cause of "no results"/wrong-card reports, more so
// than the apostrophe/hint tuning done elsewhere in this file (which
// remains a real, valid fix for genuine tokenization ambiguity — it just
// wasn't the main driver of what was actually being seen). A 4xx (bad
// query) still isn't retried — it won't succeed a second time.
const POKEMON_QUERY_RETRY_DELAYS_MS = [400, 1000, 2200]; // 1 initial + 3 retries = 4 attempts total
async function pokemonQueryUncached(q, attempt = 0) {
  // Generous cap, not the API default — Pokemon reprints the same name
  // across dozens of sets/rarities (see searchPokemon below), and a small
  // cap just cuts off whichever prints happen to sort last.
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20`);
  if (!res.ok) {
    if (res.status >= 500 && attempt < POKEMON_QUERY_RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, POKEMON_QUERY_RETRY_DELAYS_MS[attempt]));
      return pokemonQueryUncached(q, attempt + 1);
    }
    throw new Error(`pokemontcg.io returned ${res.status}`);
  }
  const data = await res.json();
  return (data.data || []).map(c => ({
    url: (c.images && (c.images.large || c.images.small)),
    // Collector number included — without it, two different prints of the
    // same name+set (e.g. a regular and a secret-rare numbering) look
    // identical in the candidate grid with no way to tell them apart.
    label: `${c.name} (${(c.set && c.set.name) || ""}) #${c.number || ''}`,
    price: pokemonTcgplayerPrice(c),
    // See searchScryfall's listingUrl for why this matters — a direct link
    // to this card's real TCGPlayer listing, for verifying actual current
    // per-condition prices before trusting the NM-based estimate.
    listingUrl: c.tcgplayer && c.tcgplayer.url,
    rarity: c.rarity || '',
    // Structured (not just baked into the label) so a confirmed pick can
    // back-fill the item's own Set/Number fields — once staff visually
    // confirm a candidate, this real database value is more trustworthy
    // than the scan's own guess for these two frequently-wrong fields.
    set: (c.set && c.set.name) || '',
    number: c.number || '',
  })).filter(r => r.url);
}

// A binder page commonly has several copies of the same card (bulk commons
// especially), and a scan's per-row auto-fill searches each copy
// independently — without this, N identical copies would fire N identical
// requests. Keyed on the exact query string, this collapses duplicates
// (including ones still in flight, not just already-resolved ones) onto a
// single real request for the rest of the session. Cleared on failure so a
// transient error doesn't get stuck cached — a successful result is safe to
// reuse indefinitely, since a print's card data doesn't change while
// browsing a single session.
const pokemonQueryCache = new Map();
async function pokemonQuery(q) {
  if (pokemonQueryCache.has(q)) return pokemonQueryCache.get(q);
  const promise = pokemonQueryUncached(q);
  pokemonQueryCache.set(q, promise);
  promise.catch(() => pokemonQueryCache.delete(q));
  return promise;
}

// Test-only — clears the cache above so tests stay isolated from each other
// regardless of whether two of them happen to reuse the same query string.
// No real app code path ever needs to call this; a browser tab's session
// living for hours is exactly the case the cache is meant to help.
export function __resetPokemonQueryCacheForTests() {
  pokemonQueryCache.clear();
}

export async function searchPokemon(name, setHint, rarityHint, numberHint) {
  // Exact phrase first (most precise), then a broader unquoted token match,
  // then just the first word — set/promo codes like "XY83" typed after the
  // name aren't part of the API's name field, so trailing words can sink an
  // otherwise-good search unless we fall back to something broader.
  const safeSet = setHint ? sanitizeForPokemonQuery(setHint) : '';
  const safeNumber = numberHint ? sanitizePokemonNumber(String(numberHint)) : '';

  // Two representations of the name, tried at every precision tier below —
  // see sanitizeStrippingPossessive's comment for why a possessive name is
  // ambiguous enough to warrant hedging both ways instead of one guess.
  // Identical strings (any name without an apostrophe — the overwhelming
  // majority) collapse to one variant, so this doesn't add extra requests
  // for the common case.
  const stripped = sanitizeStrippingPossessive(name);
  const kept = sanitizeKeepingApostrophe(name);
  const nameVariants = stripped === kept ? [stripped] : [stripped, kept];

  // Narrowest first, broadest last. Set+number together is about as close
  // to a unique key as a print has (a name alone can match 8+ reprints —
  // alt arts, "ex"/"V"/"VMAX" variants, etc.) — but the scan's own set/
  // number guesses are frequently wrong in practice, so number-alone comes
  // before set-alone (number is the more reliable of the two signals). Both
  // name variants are tried at each of these precision levels before ever
  // falling through to the next, broader level — so whichever
  // representation actually matches the index, it's found at the highest
  // precision it can be, instead of only being tried once everything else
  // has already failed.
  const tiers = [];
  for (const safe of nameVariants) {
    if (safeSet && safeNumber) tiers.push(`name:"${safe}" set.name:"${safeSet}" number:"${safeNumber}"`);
    if (safeNumber) tiers.push(`name:"${safe}" number:"${safeNumber}"`);
    if (safeSet) tiers.push(`name:"${safe}" set.name:"${safeSet}"`);
    tiers.push(`name:"${safe}"`);
    tiers.push('name:' + safe);
  }
  const firstWord = stripped.split(/\s+/)[0];
  if (firstWord && !(nameVariants.length === 1 && firstWord === nameVariants[0])) {
    tiers.push('name:' + firstWord + '*');
  }

  let results = [];
  for (let i = 0; i < tiers.length; i++) {
    try {
      results = await pokemonQuery(tiers[i]);
    } catch (err) {
      // A tier that throws (e.g. a persistent 5xx specific to that exact
      // combined query — observed for real cards where name+set+number
      // failed outright but a plain name search on the same card
      // succeeded) is treated the same as an empty result and falls
      // through to the next, broader tier, rather than aborting the whole
      // search. Only the last tier's failure is allowed to propagate, so a
      // genuinely unreachable API still reports as an error instead of a
      // misleading "no matches."
      if (i === tiers.length - 1) throw err;
      results = [];
    }
    if (results.length) return preferRarity(results, rarityHint);
  }
  return preferRarity(results, rarityHint);
}

async function ygoQuery(param, value) {
  const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${param}=${encodeURIComponent(value)}`);
  if (!res.ok) return [];
  const data = await res.json();
  const cards = data.data || [];
  return cards.slice(0, 4).flatMap(c => {
    const price = c.card_prices && c.card_prices[0] && c.card_prices[0].tcgplayer_price
      ? Number(c.card_prices[0].tcgplayer_price) : null;
    return (c.card_images || []).slice(0, 2).map(img => ({
      url: img.image_url, label: c.name, price,
    }));
  });
}

export async function searchYugioh(name) {
  // fname is already a fuzzy/substring match server-side; the fallback here
  // is for names with an extra trailing word (misremembered subtitle, etc.)
  // that keeps the full string from matching anything.
  let results = await ygoQuery('fname', name);
  if (results.length) return results;
  const words = name.split(/\s+/);
  if (words.length > 1) {
    results = await ygoQuery('fname', words.slice(0, -1).join(' '));
  }
  return results;
}

// One Piece, Riftbound, Gundam, and SWU's card databases either block direct
// browser calls with no CORS headers (One Piece, SWU — confirmed by
// live-testing fetch() from this app) or aren't a documented public API at
// all (Riftbound, Gundam — via Egman's deckbuilder, used with his explicit
// go-ahead). Routed through card-lookup-proxy (a Supabase Edge Function)
// instead, which fetches server-side where CORS doesn't apply.
async function proxyQuery(provider, query, setHint, rarityHint) {
  const { data, error } = await supabaseClient.functions.invoke('card-lookup-proxy', {
    body: { provider, query, setHint: setHint || '', rarityHint: rarityHint || '' },
  });
  if (error) return [];
  return data?.results || [];
}

// setHint is the item's own `set` field — for these games it also ends up
// holding whatever printed set/card code the binder scanner read off the
// card (e.g. "EXBP-008"), which is exactly what disambiguates prints that
// otherwise share an identical name (Gundam's base-set generics, alt art,
// promos). See card-lookup-proxy for how it's used. rarityHint is the same
// idea, narrowed server-side there against a confirmed real `rarity` field
// for these three games specifically (see card-lookup-proxy's egmanQuery) —
// SWU has no confirmed rarity field, so it doesn't get one here either.
export async function searchOnePiece(name, setHint, rarityHint) {
  return await proxyQuery('onepiece', name.trim(), setHint, rarityHint);
}

export async function searchRiftbound(name, setHint, rarityHint) {
  return await proxyQuery('riftbound', name.trim(), setHint, rarityHint);
}

export async function searchGundam(name, setHint, rarityHint) {
  return await proxyQuery('gundam', name.trim(), setHint, rarityHint);
}

export async function searchSwu(name, setHint) {
  return await proxyQuery('swu', name.trim(), setHint);
}

// Lorcast (api.lorcast.com) — a free, no-key, Scryfall-modeled API for Disney
// Lorcana. Confirmed CORS-safe for direct browser calls (unlike several other
// small TCG APIs checked for this feature — see CLAUDE.md).
async function lorcastQuery(q) {
  const res = await fetch(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).slice(0, 6).map(c => ({
    url: c.image_uris && c.image_uris.digital && (c.image_uris.digital.normal || c.image_uris.digital.small),
    label: `${c.name}${c.version ? ' - ' + c.version : ''} (${(c.set && c.set.name) || ''})`,
    price: c.prices && c.prices.usd ? Number(c.prices.usd) : null,
  })).filter(r => r.url);
}

export async function searchLorcana(name) {
  return await lorcastQuery(name.trim());
}

// A manual fallback for when the automated search above fails outright
// (exhausted every retry) or found a card but no price data for it — rather
// than leave staff stuck with nothing, a link straight to TCGPlayer's own
// search with the name/set already typed in gets them most of the way to
// finding the real listing themselves. Verified live (2026-08-21) rather
// than guessed: `https://www.tcgplayer.com/search/all/product?q=<query>`
// is TCGPlayer's real, working general search results URL. Deliberately
// uses the game-agnostic "all" category rather than a per-game category
// path (e.g. `/search/pokemon/product`) — this app supports 8 different
// games, and confirming each one's exact category slug without a real
// sample for every single one risks shipping a wrong/broken slug for at
// least one of them, whereas "all" is already confirmed to work correctly
// for any game.
export function tcgplayerSearchUrl(name, set) {
  const q = [name, set].filter(Boolean).join(' ').trim();
  return `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(q)}&view=grid`;
}

// Single dispatch table for "search a card image by game" — shared by every
// entry point that needs it (EditModal's Find image/Find market price,
// ScannerPanel's auto-fill, CSV/XLSX import's auto-fill) so adding a new
// game's search function only means editing this one list, not three
// near-identical copies of the same if-chain. numberHint (the printed
// collector number) is Pokemon-only for now — every other game's search
// function simply ignores the extra argument.
export async function searchCardImage(game, name, setHint, rarityHint, numberHint) {
  if (!name) return [];
  if (game === "Magic") return await searchScryfall(name, setHint, rarityHint, numberHint);
  if (game === "Pokemon") return await searchPokemon(name, setHint, rarityHint, numberHint);
  if (game === "Yugioh") return await searchYugioh(name);
  if (game === "Lorcana") return await searchLorcana(name);
  if (game === "One Piece") return await searchOnePiece(name, setHint, rarityHint);
  if (game === "Riftbound") return await searchRiftbound(name, setHint, rarityHint);
  if (game === "Gundam") return await searchGundam(name, setHint, rarityHint);
  if (game === "SWU") return await searchSwu(name, setHint);
  return null; // null (not []) signals "not set up for this game" vs. a real empty result
}
