import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('./supabase.js', () => ({
  supabaseClient: { functions: { invoke: (...args) => invokeMock(...args) } },
}));

const {
  searchScryfall, searchPokemon, searchYugioh, searchLorcana,
  searchOnePiece, searchRiftbound, searchGundam, searchSwu, searchCardImage,
  tcgplayerSearchUrl,
  __resetPokemonQueryCacheForTests,
} = await import('./cardSearch.js');

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  global.fetch = vi.fn();
  invokeMock.mockReset();
  // Pokemon queries are cached across calls (see cardSearch.js) so a real
  // session doesn't refetch an identical query twice — reset it here so
  // tests stay isolated from each other regardless of whether two of them
  // happen to build the same query string.
  __resetPokemonQueryCacheForTests();
});

describe('searchScryfall', () => {
  it('returns the exact-name result on the first try without falling back', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Sol Ring', set_name: 'Commander', collector_number: '1', image_uris: { normal: 'https://x/sol.jpg' }, prices: { usd: '3.00' }, purchase_uris: { tcgplayer: 'https://tcg/sol' } }],
    }));
    const results = await searchScryfall('Sol Ring');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{
      url: 'https://x/sol.jpg', label: 'Sol Ring (Commander) #1', price: 3, listingUrl: 'https://tcg/sol', rarity: '',
      set: 'Commander', number: '1',
    }]);
  });

  it('finds a card via a trailing "(1234)" collector-number search, tried before the literal parenthetical text — number is the strongest disambiguator, so its tier now runs first', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '1234', image_uris: { normal: 'https://x/bb.jpg' } }] }));
    const results = await searchScryfall('Bruce Banner (1234)');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('number%3A1234');
    expect(results[0].url).toBe('https://x/bb.jpg');
  });

  it('retries with the number unpadded if the padded version finds nothing', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // padded number, empty
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Card', set_name: 'SET', collector_number: '7', image_uris: { normal: 'https://x/c.jpg' } }] })); // unpadded, matches
    const results = await searchScryfall('Card (007)');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('number%3A7');
    expect(results[0].url).toBe('https://x/c.jpg');
  });

  it('falls back to a broad stripped-name search for a parenthetical with no number', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // exact phrase with "(Borderless)", empty
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '2', image_uris: { normal: 'https://x/bb2.jpg' } }] }));
    const results = await searchScryfall('Bruce Banner (Borderless)');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(global.fetch.mock.calls[1][0])).toContain('Bruce Banner');
    expect(results[0].url).toBe('https://x/bb2.jpg');
  });

  it('returns an empty array rather than throwing when nothing matches at all', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
    const results = await searchScryfall('Totally Made Up Card');
    expect(results).toEqual([]);
  });

  it('returns an empty array (not an error) on a plain 404 — Scryfall\'s real "zero results" response, not a failure', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ details: 'no cards found' }) });
    const results = await searchScryfall('Totally Made Up Card');
    expect(results).toEqual([]);
  });

  it('tries an explicit numberHint before the broad name search, same "number is the strongest disambiguator" priority as Pokemon', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Bruce Banner', set_name: 'Secret Lair Drop', collector_number: '42', image_uris: { normal: 'https://x/bb42.jpg' } }],
    }));
    const results = await searchScryfall('Bruce Banner', '', '', '42');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain('number:42');
    expect(results[0].url).toBe('https://x/bb42.jpg');
  });

  it('falls back to a loose (non-exact) name match still scoped by Number when the exact-name tier finds nothing — real report: the scan OCR\'d "Sauron, Dark Lord" for the actual "Sauron, the Dark Lord", so an exact-name requirement silently lost the Number constraint entirely and landed on the wrong (common) print', async () => {
    // Number has no leading zero here so there's exactly one exact-match
    // attempt (no separate padded/unpadded sub-tier) before falling to the
    // loose tier — keeps this test isolated to the exact-vs-loose behavior
    // it's actually checking, not the unrelated padding logic.
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // exact name + number: no card is literally named "Sauron, Dark Lord"
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Sauron, the Dark Lord', set_name: 'Tales of Middle-earth', collector_number: '744', image_uris: { normal: 'https://x/sauron-alt.jpg' } }] })); // loose name + number
    const results = await searchScryfall('Sauron, Dark Lord', '', '', '744');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondQuery = decodeURIComponent(global.fetch.mock.calls[1][0]);
    expect(secondQuery).not.toContain('!"'); // not an exact-match query this time
    expect(secondQuery).toContain('number:744');
    expect(results[0].url).toBe('https://x/sauron-alt.jpg');
  });

  it('only drops the Number constraint entirely (the fully unscoped broad-name tier) once BOTH the exact-name and loose-name number-scoped tiers find nothing', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // exact name + number
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // loose name + number
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '2', image_uris: { normal: 'https://x/bb.jpg' } }] })); // broad, unscoped tier
    const results = await searchScryfall('Bruce Banner', '', '', '999');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(results[0].url).toBe('https://x/bb.jpg');
  });

  it('never turns setHint into a set: filter — Scryfall\'s set:/s:/e: operators only match a short set CODE, not the full set name this app actually stores', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Sol Ring', set_name: 'Commander', collector_number: '1', image_uris: { normal: 'https://x/sol.jpg' } }] }));
    await searchScryfall('Sol Ring', 'Commander Legends');
    const q = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(q).not.toContain('set:');
    expect(q).not.toContain('e:');
    expect(q).not.toContain('Commander Legends');
  });

  it('retries once on a transient 5xx, then succeeds', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Sol Ring', set_name: 'Commander', collector_number: '1', image_uris: { normal: 'https://x/sol.jpg' } }] }));

      const promise = searchScryfall('Sol Ring');
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results[0].url).toBe('https://x/sol.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws once the retry is exhausted on the last tier, instead of reporting "no matches"', async () => {
    vi.useFakeTimers();
    try {
      global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
      const promise = searchScryfall('Totally Made Up Card');
      const assertion = expect(promise).rejects.toThrow('502');
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('isolates a persistent 5xx on the numberHint tier — falls through to the broad name tier instead of aborting the whole search', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) }) // number tier, 1st attempt
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) }) // number tier retry — budget exhausted
        .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '2', image_uris: { normal: 'https://x/bb.jpg' } }] })); // broad tier succeeds

      const promise = searchScryfall('Bruce Banner', '', '', '999');
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(results[0].url).toBe('https://x/bb.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back through usd -> usd_foil -> usd_etched -> usd_glossy when the nonfoil price is missing', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Foil-Only Card', set_name: 'SLD', collector_number: '1', image_uris: { normal: 'https://x/f.jpg' }, prices: { usd: null, usd_foil: '19.99', usd_etched: null } }],
    }));
    const results = await searchScryfall('Foil-Only Card');
    expect(results[0].price).toBe(19.99);
  });

  it('prefers a plain usd price over foil/etched/glossy when it is present', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Sol Ring', set_name: 'Commander', collector_number: '1', image_uris: { normal: 'https://x/sol.jpg' }, prices: { usd: '3.00', usd_foil: '9.00' } }],
    }));
    const results = await searchScryfall('Sol Ring');
    expect(results[0].price).toBe(3);
  });
});

describe('searchPokemon', () => {
  it('narrows by set first when a setHint is given, and stops there if it finds something', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Charizard', set: { name: 'Base Set' }, number: '4', images: { large: 'https://x/char.jpg' }, tcgplayer: { url: 'https://tcg/char', prices: { holofoil: { market: 300 } } } }],
    }));
    const results = await searchPokemon('Charizard', 'Base Set');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain('set.name:"Base Set"');
    expect(results[0]).toMatchObject({ url: 'https://x/char.jpg', price: 300, listingUrl: 'https://tcg/char' });
  });

  it('reuses an identical in-flight query instead of firing a duplicate request — same card, multiple copies on a page', async () => {
    let resolveFetch;
    global.fetch.mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));
    const first = searchPokemon('Charizard', 'Base Set');
    const second = searchPokemon('Charizard', 'Base Set'); // e.g. two copies scanned off the same page
    resolveFetch(jsonResponse({
      data: [{ name: 'Charizard', set: { name: 'Base Set' }, number: '4', images: { large: 'https://x/char.jpg' } }],
    }));
    const [r1, r2] = await Promise.all([first, second]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(r1[0].url).toBe('https://x/char.jpg');
    expect(r2[0].url).toBe('https://x/char.jpg');
  });

  it('reuses an already-resolved query on a later call too, not just ones still in flight', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Charizard', set: { name: 'Base Set' }, number: '4', images: { large: 'https://x/char.jpg' } }],
    }));
    await searchPokemon('Charizard', 'Base Set');
    global.fetch.mockClear();
    const results = await searchPokemon('Charizard', 'Base Set');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(results[0].url).toBe('https://x/char.jpg');
  });

  it('falls through exact phrase -> unquoted -> first-word prefix when nothing narrower matches', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // exact phrase
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // unquoted
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Pikachu VMAX', set: { name: 'Vivid Voltage' }, number: '44', images: { large: 'https://x/pika.jpg' } }] }));
    const results = await searchPokemon('Pikachu VMAX');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(results[0].url).toBe('https://x/pika.jpg');
  });

  it('sanitizes Lucene special characters out of the query instead of escaping them', async () => {
    // No setHint and every query comes back empty here — searchPokemon will
    // fall through all of its fallback queries, so every call needs a
    // response, not just the first.
    global.fetch.mockResolvedValue(jsonResponse({ data: [] }));
    await searchPokemon('V - SWSH204');
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).not.toContain('\\-');
  });

  it('strips apostrophes out of the query — real-world testing found every search for "Lillie\'s Clefairy ex" failing regardless of which hints were passed', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ data: [] }));
    await searchPokemon("Lillie's Clefairy ex");
    const q = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(q).not.toContain("'");
    expect(q).not.toContain('’');
  });

  it('strips a possessive "\'s" outright rather than replacing it with a space — a spurious "s" token broke the exact-phrase tier\'s match against the real (possessive-stripped) index, and fell through to the broad prefix tier where it picked up unrelated cards like the "Lillie" Trainer/Supporter card', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ data: [] }));
    await searchPokemon("Lillie's Clefairy ex");
    const q = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(q).toContain('name:"Lillie Clefairy ex"');
    expect(q).not.toContain('Lillie s');

    global.fetch.mockClear();
    await searchPokemon("Cynthia's Garchomp ex");
    const q2 = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(q2).toContain('name:"Cynthia Garchomp ex"');
    expect(q2).not.toContain('Cynthia s');
  });

  it('falls back to keeping the apostrophe literally when the possessive-stripped variant finds nothing — we can\'t inspect pokemontcg.io\'s live index to know which representation it actually indexes on, so both are tried before giving up', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // stripped exact phrase: name:"Lillie Clefairy ex" — empty
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // stripped unquoted — empty
      .mockResolvedValueOnce(jsonResponse({
        data: [{ name: "Lillie's Clefairy ex", set: { name: 'Ascended Heroes' }, number: '280', images: { large: 'https://x/clefairy.jpg' } }],
      })); // apostrophe-kept exact phrase: name:"Lillie's Clefairy ex" — matches
    const results = await searchPokemon("Lillie's Clefairy ex");
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const thirdQuery = decodeURIComponent(global.fetch.mock.calls[2][0]);
    expect(thirdQuery).toContain(`name:"Lillie's Clefairy ex"`);
    expect(results[0].url).toBe('https://x/clefairy.jpg');
  });

  it('tries set+number together first when both hints are given, stripping a "/total" denominator', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: "Lillie's Clefairy ex", set: { name: 'Ascended Heroes' }, number: '280', images: { large: 'https://x/clefairy.jpg' } }],
    }));
    const results = await searchPokemon("Lillie's Clefairy ex", 'Ascended Heroes', '', '280/217');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const q = decodeURIComponent(global.fetch.mock.calls[0][0]);
    expect(q).toContain('set.name:"Ascended Heroes"');
    expect(q).toContain('number:"280"');
    expect(q).not.toContain('217');
    expect(results[0].url).toBe('https://x/clefairy.jpg');
  });

  it('falls back to number alone (no set) before trying set alone, since the scan\'s set guess is the less reliable signal', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // set+number, empty (wrong set guess)
      .mockResolvedValueOnce(jsonResponse({
        data: [{ name: "Lillie's Clefairy ex", set: { name: 'Ascended Heroes' }, number: '280', images: { large: 'https://x/clefairy.jpg' } }],
      })); // number alone finds it
    const results = await searchPokemon("Lillie's Clefairy ex", 'Scarlet & Violet', '', '280');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondQuery = decodeURIComponent(global.fetch.mock.calls[1][0]);
    expect(secondQuery).toContain('number:"280"');
    expect(secondQuery).not.toContain('set.name');
    expect(results[0].url).toBe('https://x/clefairy.jpg');
  });

  it('retries once after a transient 5xx, then succeeds', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // transient 5xx, first attempt
        .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Charizard', set: { name: 'Base Set' }, images: { large: 'https://x/char.jpg' } }] }));

      const promise = searchPokemon('Charizard');
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results[0].url).toBe('https://x/char.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up and throws once every retry attempt is exhausted, instead of reporting "no matches"', async () => {
    vi.useFakeTimers();
    try {
      global.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
      const promise = searchPokemon('Charizard');
      // Attach a rejection handler immediately so the unresolved promise
      // doesn't trip an unhandled-rejection warning while timers advance.
      const assertion = expect(promise).rejects.toThrow('502');
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls through to a broader tier only once an earlier, narrower tier has exhausted its full retry budget (4 attempts), instead of aborting the whole search', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // number-alone tier, 1st attempt
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // retry 1 — still fails
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // retry 2 — still fails
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }) // retry 3 — budget exhausted
        .mockResolvedValueOnce(jsonResponse({
          data: [{ name: 'Charizard', set: { name: 'Base Set' }, images: { large: 'https://x/char.jpg' } }],
        })); // next (broader) tier succeeds on its first attempt

      const promise = searchPokemon('Charizard', '', '', '999'); // numberHint, no setHint
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(5);
      expect(results[0].url).toBe('https://x/char.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries through more than one consecutive 5xx on the same tier — live testing found failure streaks longer than the original single-retry budget could survive', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
        .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Charizard', set: { name: 'Base Set' }, images: { large: 'https://x/char.jpg' } }] }));

      const promise = searchPokemon('Charizard');
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(results[0].url).toBe('https://x/char.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('matches a rarity hint against pokemontcg.io\'s real (inconsistently-formatted) value — "MEGA_ATTACK_RARE" for a Mega Evolution-era card', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [
        { name: 'Mega Froslass ex', number: '1', rarity: 'Common', images: { large: 'https://x/common.jpg' } },
        { name: 'Mega Froslass ex', number: '265', rarity: 'MEGA_ATTACK_RARE', images: { large: 'https://x/mar.jpg' } },
      ],
    }));
    const results = await searchPokemon('Mega Froslass ex', '', 'Mega Attack Rare');
    expect(results[0].url).toBe('https://x/mar.jpg');
  });

  it('falls back to a listing-based (low/high) price when a low-volume card has no sold-listing (market/mid) data yet — real report: a Mega ex with real active listings still showing no price', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        name: 'Mega Gengar ex', number: '1', images: { large: 'https://x/gengar.jpg' },
        tcgplayer: { url: 'https://tcg/gengar', prices: { holofoil: { market: null, mid: null, low: 40, high: 120 } } },
      }],
    }));
    const results = await searchPokemon('Mega Gengar ex');
    expect(results[0].price).toBe(80); // average of low/high
  });

  it('prefers mid over a low/high average, and market over mid, when more than one is present', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        name: 'Mega Gengar ex', number: '1', images: { large: 'https://x/gengar.jpg' },
        tcgplayer: { url: 'https://tcg/gengar', prices: { holofoil: { market: null, mid: 95, low: 40, high: 120 } } },
      }],
    }));
    const results = await searchPokemon('Mega Gengar ex');
    expect(results[0].price).toBe(95);
  });
});

describe('tcgplayerSearchUrl', () => {
  it('builds a real, game-agnostic TCGPlayer search URL from name + set', () => {
    expect(tcgplayerSearchUrl('Mega Gengar ex', 'Ascended Heroes'))
      .toBe('https://www.tcgplayer.com/search/all/product?q=Mega%20Gengar%20ex%20Ascended%20Heroes&view=grid');
  });

  it('omits the set when blank rather than leaving a trailing space in the query', () => {
    expect(tcgplayerSearchUrl('Charizard', '')).toBe('https://www.tcgplayer.com/search/all/product?q=Charizard&view=grid');
  });
});

describe('searchYugioh', () => {
  it('uses the full name first', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Blue-Eyes White Dragon', card_images: [{ image_url: 'https://x/bewd.jpg' }], card_prices: [{ tcgplayer_price: '12.00' }] }],
    }));
    const results = await searchYugioh('Blue-Eyes White Dragon');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results[0]).toMatchObject({ url: 'https://x/bewd.jpg', label: 'Blue-Eyes White Dragon', price: 12 });
  });

  it('drops the last word and retries if the full name finds nothing', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Blue-Eyes White Dragon', card_images: [{ image_url: 'https://x/bewd.jpg' }] }] }));
    const results = await searchYugioh('Blue-Eyes White Dragon Alternate');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(global.fetch.mock.calls[1][0])).toContain('Blue-Eyes White Dragon');
    expect(results[0].url).toBe('https://x/bewd.jpg');
  });

  it('reports a real card_sets rarity/set label instead of leaving them blank', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        name: 'Tornado Dragon',
        card_images: [{ image_url: 'https://x/tornado.jpg' }],
        card_sets: [{ set_name: 'Battles of Legend: Relentless Revenge', set_code: 'BLRR-EN084', set_rarity: 'Secret Rare', set_price: '4.08' }],
      }],
    }));
    const results = await searchYugioh('Tornado Dragon');
    expect(results[0]).toMatchObject({ rarity: 'Secret Rare', set: 'Battles of Legend: Relentless Revenge', price: 4.08 });
  });

  it('picks the card_sets entry matching numberHint (the printed set code) over the first one, since it is the strongest signal', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        name: 'Tornado Dragon',
        card_images: [{ image_url: 'https://x/tornado.jpg' }],
        card_sets: [
          { set_name: 'Battles of Legend: Relentless Revenge', set_code: 'BLRR-EN084', set_rarity: 'Secret Rare', set_price: '4.08' },
          { set_name: 'Duel Devastator', set_code: 'DUDE-EN019', set_rarity: 'Ultra Rare', set_price: '1.4' },
        ],
      }],
    }));
    const results = await searchYugioh('Tornado Dragon', '', '', 'DUDE-EN019');
    expect(results[0]).toMatchObject({ rarity: 'Ultra Rare', set: 'Duel Devastator', price: 1.4 });
  });

  it('falls back to setHint, then rarityHint, then the first entry, when numberHint does not match anything', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{
        name: 'Tornado Dragon',
        card_images: [{ image_url: 'https://x/tornado.jpg' }],
        card_sets: [
          { set_name: 'Battles of Legend: Relentless Revenge', set_code: 'BLRR-EN084', set_rarity: 'Secret Rare', set_price: '4.08' },
          { set_name: 'Duel Devastator', set_code: 'DUDE-EN019', set_rarity: 'Ultra Rare', set_price: '1.4' },
        ],
      }],
    }));
    const results = await searchYugioh('Tornado Dragon', 'Duel Devastator', '', '');
    expect(results[0]).toMatchObject({ rarity: 'Ultra Rare', set: 'Duel Devastator' });
  });

  it('retries once on a transient 5xx, then succeeds', async () => {
    vi.useFakeTimers();
    try {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Blue-Eyes White Dragon', card_images: [{ image_url: 'https://x/bewd.jpg' }] }] }));

      const promise = searchYugioh('Blue-Eyes White Dragon');
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results[0].url).toBe('https://x/bewd.jpg');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns an empty array (not a throw) on a persistent non-5xx failure — this API\'s "no results" signal is not confirmed, so it is not treated as an error', async () => {
    // A single-word name so there's no "drop the last word" fallback tier
    // to also account for — isolates this test to the one query's status
    // handling.
    global.fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
    const results = await searchYugioh('Nonexistentcardxyz');
    expect(results).toEqual([]);
  });
});

describe('searchLorcana', () => {
  it('maps Lorcast results including the version/set label', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      results: [{ name: 'Mickey Mouse', version: 'Brave Little Tailor', set: { name: 'The First Chapter' }, image_uris: { digital: { normal: 'https://x/mickey.jpg' } }, prices: { usd: '25.00' } }],
    }));
    const results = await searchLorcana('Mickey Mouse');
    expect(results).toEqual([{ url: 'https://x/mickey.jpg', label: 'Mickey Mouse - Brave Little Tailor (The First Chapter)', price: 25 }]);
  });
});

describe('proxy-backed searches (One Piece / Riftbound / Gundam / SWU)', () => {
  it('calls card-lookup-proxy with the right provider name and forwards the query/setHint', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [{ url: 'https://x/op.jpg', label: 'Luffy' }] }, error: null });
    const results = await searchOnePiece('Luffy', 'OP01');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '', numberHint: '' } });
    expect(results).toEqual([{ url: 'https://x/op.jpg', label: 'Luffy' }]);
  });

  it('forwards a numberHint for One Piece', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchOnePiece('Luffy', 'OP01', '', '001');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '', numberHint: '001' } });
  });

  it.each([
    ['riftbound', searchRiftbound],
    ['gundam', searchGundam],
    ['swu', searchSwu],
  ])('%s dispatches with the matching provider name', async (provider, fn) => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await fn('Some Card');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider, query: 'Some Card', setHint: '', rarityHint: '', numberHint: '' } });
  });

  it('returns an empty array (not an error) when the proxy call fails', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: 'network' } });
    const results = await searchOnePiece('Luffy');
    expect(results).toEqual([]);
  });
});

describe('searchCardImage dispatcher', () => {
  it('returns null for a game with no search implementation, without touching the network', async () => {
    const results = await searchCardImage('Sports Singles', 'Some Card');
    expect(results).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns [] immediately for a blank name, without touching the network', async () => {
    const results = await searchCardImage('Magic', '');
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('dispatches Magic to Scryfall', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await searchCardImage('Magic', 'Sol Ring');
    expect(global.fetch.mock.calls[0][0]).toContain('api.scryfall.com');
  });

  it('forwards a numberHint through to Scryfall for Magic, same as Pokemon', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '42', image_uris: { normal: 'https://x/bb.jpg' } }] }));
    await searchCardImage('Magic', 'Bruce Banner', '', '', '42');
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain('number:42');
  });

  it('dispatches One Piece to the proxy with the "onepiece" provider', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchCardImage('One Piece', 'Luffy', 'OP01');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '', numberHint: '' } });
  });

  it('forwards a numberHint through to the proxy for One Piece, same as Magic/Pokemon', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchCardImage('One Piece', 'Luffy', 'OP01', '', '001');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '', numberHint: '001' } });
  });
});
