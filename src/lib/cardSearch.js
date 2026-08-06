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
    label: `${c.name} (${c.set_name}) #${c.collector_number}`
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

async function pokemonQuery(q) {
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map(c => ({
    url: (c.images && (c.images.large || c.images.small)),
    label: `${c.name} (${(c.set && c.set.name) || ""})`
  })).filter(r => r.url);
}

export async function searchPokemon(name) {
  // Exact phrase first (most precise), then a broader unquoted token match,
  // then just the first word — set/promo codes like "XY83" typed after the
  // name aren't part of the API's name field, so trailing words can sink an
  // otherwise-good search unless we fall back to something broader.
  const safe = sanitizeForPokemonQuery(name);
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
  return cards.slice(0, 4).flatMap(c => (c.card_images || []).slice(0, 2).map(img => ({
    url: img.image_url, label: c.name
  })));
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

// Both One Piece and SWU's card databases block direct browser calls with no
// CORS headers (confirmed by live-testing fetch() from this app before
// building this) — routed through card-lookup-proxy (a Supabase Edge
// Function) instead, which fetches server-side where CORS doesn't apply.
// Not yet wired into the Edit modal/Scanner UI: the proxy's field-name
// mapping for each provider is still an unconfirmed best guess pending a
// real response sample, so exposing it now would silently show "no results"
// for cards that actually exist rather than the honest "not set up yet".
async function proxyQuery(provider, query) {
  const { data, error } = await supabaseClient.functions.invoke('card-lookup-proxy', {
    body: { provider, query },
  });
  if (error) return [];
  return data?.results || [];
}

export async function searchSwu(name) {
  return await proxyQuery('swu', name.trim());
}

export async function searchOnePiece(name) {
  return await proxyQuery('onepiece', name.trim());
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
  })).filter(r => r.url);
}

export async function searchLorcana(name) {
  return await lorcastQuery(name.trim());
}
