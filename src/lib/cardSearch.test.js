import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('./supabase.js', () => ({
  supabaseClient: { functions: { invoke: (...args) => invokeMock(...args) } },
}));

const {
  searchScryfall, searchPokemon, searchYugioh, searchLorcana,
  searchOnePiece, searchRiftbound, searchGundam, searchSwu, searchCardImage,
} = await import('./cardSearch.js');

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  global.fetch = vi.fn();
  invokeMock.mockReset();
});

describe('searchScryfall', () => {
  it('returns the exact-name result on the first try without falling back', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({
      data: [{ name: 'Sol Ring', set_name: 'Commander', collector_number: '1', image_uris: { normal: 'https://x/sol.jpg' }, prices: { usd: '3.00' }, purchase_uris: { tcgplayer: 'https://tcg/sol' } }],
    }));
    const results = await searchScryfall('Sol Ring');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results).toEqual([{ url: 'https://x/sol.jpg', label: 'Sol Ring (Commander) #1', price: 3, listingUrl: 'https://tcg/sol', rarity: '' }]);
  });

  it('falls back to a collector-number search when a trailing "(1234)" gets no exact match', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // exact phrase, empty
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Bruce Banner', set_name: 'SLD', collector_number: '1234', image_uris: { normal: 'https://x/bb.jpg' } }] }));
    const results = await searchScryfall('Bruce Banner (1234)');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][0]).toContain('number%3A1234');
    expect(results[0].url).toBe('https://x/bb.jpg');
  });

  it('retries with the number unpadded if the padded version finds nothing', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ data: [] })) // padded number, empty
      .mockResolvedValueOnce(jsonResponse({ data: [{ name: 'Card', set_name: 'SET', collector_number: '7', image_uris: { normal: 'https://x/c.jpg' } }] }));
    const results = await searchScryfall('Card (007)');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[2][0]).toContain('number%3A7');
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

  it('gives up and throws after a second consecutive 5xx, instead of reporting "no matches"', async () => {
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
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '' } });
    expect(results).toEqual([{ url: 'https://x/op.jpg', label: 'Luffy' }]);
  });

  it.each([
    ['riftbound', searchRiftbound],
    ['gundam', searchGundam],
    ['swu', searchSwu],
  ])('%s dispatches with the matching provider name', async (provider, fn) => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await fn('Some Card');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider, query: 'Some Card', setHint: '', rarityHint: '' } });
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

  it('dispatches One Piece to the proxy with the "onepiece" provider', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchCardImage('One Piece', 'Luffy', 'OP01');
    expect(invokeMock).toHaveBeenCalledWith('card-lookup-proxy', { body: { provider: 'onepiece', query: 'Luffy', setHint: 'OP01', rarityHint: '' } });
  });
});
