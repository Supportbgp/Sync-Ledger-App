// Repeatedly strips a trailing "(...)" group — collector numbers, frame
// treatments ("Borderless", "Extended Art"), and similar print metadata that
// import data sometimes appends to the name but isn't part of it.
function stripTrailingParens(name) {
  let s = name;
  let next = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
  while (next !== s) {
    s = next;
    next = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
  }
  return s;
}

async function scryfallQuery(q) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).slice(0, 6).map(c => ({
    url: (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal),
    label: `${c.name} (${c.set_name})`
  })).filter(r => r.url);
}

export async function searchScryfall(name) {
  const trimmed = name.trim();
  let results = await scryfallQuery(trimmed);
  if (results.length) return results;
  const stripped = stripTrailingParens(trimmed);
  if (stripped && stripped !== trimmed) {
    results = await scryfallQuery(stripped);
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
