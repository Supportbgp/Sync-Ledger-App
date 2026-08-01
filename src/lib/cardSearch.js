export async function searchScryfall(name) {
  const res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(name)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).slice(0, 6).map(c => ({
    url: (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0] && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal),
    label: `${c.name} (${c.set_name})`
  })).filter(r => r.url);
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
  let results = await pokemonQuery('name:"' + name + '"');
  if (results.length) return results;
  results = await pokemonQuery('name:' + name);
  if (results.length) return results;
  const firstWord = name.split(/\s+/)[0];
  if (firstWord && firstWord !== name) {
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
