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

async function scryfallQuery(q) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).slice(0, 6).map(c => ({
    url: (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal),
    label: `${c.name} (${c.set_name}) #${c.collector_number}`,
    // NM (near-mint) market price in USD — this exact print's price, not a
    // generic name-based lookup, since it's the same card object the image
    // came from. Used as the Market Value feature's reference price.
    price: c.prices && c.prices.usd ? Number(c.prices.usd) : null,
  })).filter(r => r.url);
}

export async function searchScryfall(name) {
  const trimmed = name.trim();
  let results = await scryfallQuery(trimmed);
  if (results.length) return results;

  const { name: withoutNumber, collectorNumber } = parseTrailingCollectorNumber(trimmed);
  const cleanName = stripTrailingParens(withoutNumber);
  if (!cleanName) return results;

  if (collectorNumber) {
    // Try the number as printed, then with leading zeros stripped — Scryfall
    // stores it either way depending on the set.
    results = await scryfallQuery(`!"${cleanName}" number:${collectorNumber}`);
    if (results.length) return results;
    const unpadded = collectorNumber.replace(/^0+/, '') || collectorNumber;
    if (unpadded !== collectorNumber) {
      results = await scryfallQuery(`!"${cleanName}" number:${unpadded}`);
      if (results.length) return results;
    }
  }
  if (cleanName !== trimmed) {
    // No exact print match — surface every print of the base card (there may
    // be several, which is exactly the case that got us here) so staff can
    // pick the right one visually from the candidate grid.
    results = await scryfallQuery(cleanName);
  }
  return results;
}

// pokemontcg.io's `q=` is a Lucene-like query string, not plain text — these
// characters are operators there. Escaping them with a backslash is the
// textbook-correct approach, but their backend doesn't reliably parse that
// escape sequence (observed 500s on an escaped hyphen next to a promo/set
// code, e.g. "V \- SWSH204") — so instead of trusting their parser to honor
// an escape, just replace the special character with a space. It's a fuzzy
// image lookup, not an exact-match field, so losing the literal punctuation
// costs nothing.
function sanitizeForPokemonQuery(s) {
  return s.replace(/[+\-!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

// TCGPlayer prices on a pokemontcg.io card are keyed by print variant
// (normal/holofoil/reverseHolofoil/1st-edition combos), not one flat field —
// take the first variant that's actually present, in roughly most-to-least
// common order, rather than guessing every card has the same one.
const POKEMON_PRICE_VARIANTS = ["normal", "holofoil", "reverseHolofoil", "1stEditionNormal", "1stEditionHolofoil"];
function pokemonTcgplayerPrice(c) {
  const prices = c.tcgplayer && c.tcgplayer.prices;
  if (!prices) return null;
  for (const variant of POKEMON_PRICE_VARIANTS) {
    const p = prices[variant];
    if (p && (p.market != null || p.mid != null)) return p.market ?? p.mid;
  }
  return null;
}

async function pokemonQuery(q) {
  // Generous cap, not the API default — Pokemon reprints the same name
  // across dozens of sets/rarities (see searchPokemon below), and a small
  // cap just cuts off whichever prints happen to sort last.
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=20`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map(c => ({
    url: (c.images && (c.images.large || c.images.small)),
    // Collector number included — without it, two different prints of the
    // same name+set (e.g. a regular and a secret-rare numbering) look
    // identical in the candidate grid with no way to tell them apart.
    label: `${c.name} (${(c.set && c.set.name) || ""}) #${c.number || ''}`,
    price: pokemonTcgplayerPrice(c),
  })).filter(r => r.url);
}

export async function searchPokemon(name, setHint) {
  // Exact phrase first (most precise), then a broader unquoted token match,
  // then just the first word — set/promo codes like "XY83" typed after the
  // name aren't part of the API's name field, so trailing words can sink an
  // otherwise-good search unless we fall back to something broader.
  const safe = sanitizeForPokemonQuery(name);
  const safeSet = setHint ? sanitizeForPokemonQuery(setHint) : '';

  // A card with many reprints (Charizard, etc.) can easily have more prints
  // than fit in one page — narrowing by the item's own recorded set first
  // is what actually finds the right one instead of an arbitrary handful.
  if (safeSet) {
    let results = await pokemonQuery(`name:"${safe}" set.name:"${safeSet}"`);
    if (results.length) return results;
  }
  let results = await pokemonQuery('name:"' + safe + '"');
  if (results.length) return results;
  results = await pokemonQuery('name:' + safe);
  if (results.length) return results;
  const firstWord = safe.split(/\s+/)[0];
  if (firstWord && firstWord !== safe) {
    results = await pokemonQuery('name:' + firstWord + '*');
  }
  return results;
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
async function proxyQuery(provider, query, setHint) {
  const { data, error } = await supabaseClient.functions.invoke('card-lookup-proxy', {
    body: { provider, query, setHint: setHint || '' },
  });
  if (error) return [];
  return data?.results || [];
}

// setHint is the item's own `set` field — for these games it also ends up
// holding whatever printed set/card code the binder scanner read off the
// card (e.g. "EXBP-008"), which is exactly what disambiguates prints that
// otherwise share an identical name (Gundam's base-set generics, alt art,
// promos). See card-lookup-proxy for how it's used.
export async function searchOnePiece(name, setHint) {
  return await proxyQuery('onepiece', name.trim(), setHint);
}

export async function searchRiftbound(name, setHint) {
  return await proxyQuery('riftbound', name.trim(), setHint);
}

export async function searchGundam(name, setHint) {
  return await proxyQuery('gundam', name.trim(), setHint);
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
