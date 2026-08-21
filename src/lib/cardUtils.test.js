import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseMoney, detectGrading, normalizeCard, GAME_TAG_CLASS,
  channelDefaultsForLocation, isTicketComplete, needsPlatformStatusReset,
  timeAgo, canonicalizeCondition, marketValueForCondition,
  resolveActiveImage, activeImageSrc, SORT_COLUMNS, DEFAULT_CONDITION_MULTIPLIERS,
  RARITY_OPTIONS_BY_GAME, CONDITION_TIERS, CONDITION_OPTIONS,
} from './cardUtils.js';

describe('parseMoney', () => {
  it('treats blank/null/undefined as no price, not zero', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });
  it('passes a real number through unchanged', () => {
    expect(parseMoney(12.5)).toBe(12.5);
    expect(parseMoney(0)).toBe(0);
  });
  it('strips $ and , from spreadsheet-style strings', () => {
    expect(parseMoney('$1,234.50')).toBe(1234.5);
    expect(parseMoney('  42  ')).toBe(42);
  });
  it('returns null for garbage rather than NaN', () => {
    expect(parseMoney('not a price')).toBeNull();
  });
});

describe('detectGrading', () => {
  it('leaves an ungraded name alone as a single', () => {
    expect(detectGrading('Charizard')).toEqual({ name: 'Charizard', itemType: 'single', grader: '', grade: '' });
  });
  it('detects a plain grade and strips it from the name', () => {
    expect(detectGrading('Charizard PSA 10')).toEqual({ name: 'Charizard', itemType: 'slab', grader: 'PSA', grade: '10' });
  });
  it('detects a qualified grade (Gem Mint, Black Label, etc.)', () => {
    expect(detectGrading('Black Lotus BGS Gem Mint 9.5')).toEqual({
      name: 'Black Lotus', itemType: 'slab', grader: 'BGS', grade: 'Gem Mint 9.5',
    });
  });
  it('normalizes "Beckett" casing', () => {
    expect(detectGrading('Card Beckett 9')).toEqual({ name: 'Card', itemType: 'slab', grader: 'Beckett', grade: '9' });
  });
  it('strips a trailing dash left over after removing the grade text', () => {
    expect(detectGrading('Card - PSA 10')).toEqual({ name: 'Card', itemType: 'slab', grader: 'PSA', grade: '10' });
  });
});

describe('normalizeCard', () => {
  it('canonicalizes known game aliases', () => {
    expect(normalizeCard({ game: 'MTG' }).game).toBe('Magic');
    expect(normalizeCard({ game: 'pokémon' }).game).toBe('Pokemon');
    expect(normalizeCard({ game: 'yu-gi-oh!' }).game).toBe('Yugioh');
  });
  it('falls back to "Other" for a blank game, and passthrough for an unrecognized one', () => {
    expect(normalizeCard({ game: '' }).game).toBe('Other');
    expect(normalizeCard({ game: 'Flesh and Blood' }).game).toBe('Flesh and Blood');
  });
  it('coerces every documented "sold" spelling to a real boolean', () => {
    expect(normalizeCard({ sold: true }).sold).toBe(true);
    expect(normalizeCard({ sold: 'true' }).sold).toBe(true);
    expect(normalizeCard({ sold: 'TRUE' }).sold).toBe(true);
    expect(normalizeCard({ sold: '1' }).sold).toBe(true);
    expect(normalizeCard({ sold: 'Sold' }).sold).toBe(true);
    expect(normalizeCard({ sold: false }).sold).toBe(false);
    expect(normalizeCard({ sold: '' }).sold).toBe(false);
    expect(normalizeCard({}).sold).toBe(false);
  });
  it('defaults every channel to true unless explicitly false', () => {
    const card = normalizeCard({});
    expect(card.posChannel).toBe(true);
    expect(card.tcgplayerChannel).toBe(true);
    expect(card.collectrChannel).toBe(true);
    expect(normalizeCard({ posChannel: false }).posChannel).toBe(false);
  });
  it('defaults itemType to "single" unless the string contains "slab"', () => {
    expect(normalizeCard({}).itemType).toBe('single');
    expect(normalizeCard({ itemType: 'Slab' }).itemType).toBe('slab');
    expect(normalizeCard({ itemType: 'single' }).itemType).toBe('single');
  });
  it('parses price and basePrice through parseMoney', () => {
    const card = normalizeCard({ price: '$5.00', basePrice: '$10.00' });
    expect(card.price).toBe(5);
    expect(card.basePrice).toBe(10);
  });
  it('defaults activeImage to "photo" unless explicitly "stock"', () => {
    expect(normalizeCard({}).activeImage).toBe('photo');
    expect(normalizeCard({ activeImage: 'stock' }).activeImage).toBe('stock');
    expect(normalizeCard({ activeImage: 'garbage' }).activeImage).toBe('photo');
  });
});

describe('GAME_TAG_CLASS', () => {
  it('only maps to real accent tokens', () => {
    const allowed = new Set([
      'tag-teal', 'tag-green', 'tag-amber', 'tag-rust', 'tag-purple', 'tag-blue',
      'tag-gundam', 'tag-riftbound', 'tag-swu', 'tag-lorcana',
    ]);
    for (const cls of Object.values(GAME_TAG_CLASS)) {
      expect(allowed.has(cls)).toBe(true);
    }
  });

  it('gives every game its own distinct tag class — no two games share a color', () => {
    const values = Object.values(GAME_TAG_CLASS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('RARITY_OPTIONS_BY_GAME', () => {
  it('lists real Pokemon rarity strings for both the modern and older eras, no duplicates', () => {
    const pokemon = RARITY_OPTIONS_BY_GAME.Pokemon;
    expect(pokemon).toContain('Illustration Rare');
    expect(pokemon).toContain('Special Illustration Rare');
    expect(pokemon).toContain('Rare Secret');
    expect(new Set(pokemon).size).toBe(pokemon.length);
  });

  it('has no entry for a game whose rarities have not been researched yet', () => {
    expect(RARITY_OPTIONS_BY_GAME.Magic).toBeUndefined();
  });
});

describe('channelDefaultsForLocation', () => {
  it('defaults to everywhere for a brand-new or blank location', () => {
    expect(channelDefaultsForLocation([], 'Binder A')).toEqual({ posChannel: true, tcgplayerChannel: true, collectrChannel: true });
    expect(channelDefaultsForLocation([{ location: 'Binder A', posChannel: false }], '')).toEqual({ posChannel: true, tcgplayerChannel: true, collectrChannel: true });
  });
  it('follows the majority of existing items in the same location', () => {
    const catalog = [
      { location: 'Binder A', posChannel: true, tcgplayerChannel: false, collectrChannel: true },
      { location: 'Binder A', posChannel: true, tcgplayerChannel: false, collectrChannel: false },
      { location: 'Binder B', posChannel: false, tcgplayerChannel: true, collectrChannel: true },
    ];
    expect(channelDefaultsForLocation(catalog, 'Binder A')).toEqual({
      posChannel: true, tcgplayerChannel: false, collectrChannel: true,
    });
  });
  it('ignores items from other locations entirely', () => {
    const catalog = [{ location: 'Binder B', posChannel: false, tcgplayerChannel: false, collectrChannel: false }];
    expect(channelDefaultsForLocation(catalog, 'Binder A')).toEqual({ posChannel: true, tcgplayerChannel: true, collectrChannel: true });
  });
});

describe('isTicketComplete', () => {
  it('is complete once every enrolled channel is done', () => {
    expect(isTicketComplete({ posChannel: true, posDone: true, tcgplayerChannel: false, collectrChannel: false })).toBe(true);
  });
  it('is incomplete if an enrolled channel is not done', () => {
    expect(isTicketComplete({ posChannel: true, posDone: false, tcgplayerChannel: false, collectrChannel: false })).toBe(false);
  });
  it('a channel the item was never enrolled in never blocks completion', () => {
    expect(isTicketComplete({ posChannel: false, posDone: false, tcgplayerChannel: false, tcgplayerDone: false, collectrChannel: false, collectrDone: false })).toBe(true);
  });
});

describe('needsPlatformStatusReset', () => {
  it('always resets for a brand-new item', () => {
    expect(needsPlatformStatusReset(null, { price: 5 })).toBe(true);
  });
  it('resets when a reset-triggering field changes', () => {
    expect(needsPlatformStatusReset({ price: 5, qty: 1, condition: 'NM', sold: false }, { price: 6, qty: 1, condition: 'NM', sold: false })).toBe(true);
    expect(needsPlatformStatusReset({ price: 5, qty: 1, condition: 'NM', sold: false }, { price: 5, qty: 2, condition: 'NM', sold: false })).toBe(true);
    expect(needsPlatformStatusReset({ price: 5, qty: 1, condition: 'NM', sold: false }, { price: 5, qty: 1, condition: 'NM', sold: true })).toBe(true);
  });
  it('does not reset when only an unrelated field changes', () => {
    expect(needsPlatformStatusReset({ price: 5, qty: 1, condition: 'NM', sold: false, notes: 'a' }, { price: 5, qty: 1, condition: 'NM', sold: false, notes: 'b' })).toBe(false);
  });
});

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers());

  it('handles a falsy timestamp', () => {
    expect(timeAgo(null)).toBe('—');
    expect(timeAgo(0)).toBe('—');
  });
  it('labels today and yesterday specially', () => {
    const now = new Date('2026-08-10T12:00:00Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(timeAgo(now - 1000)).toBe('Today');
    expect(timeAgo(now - 86400000)).toBe('Yesterday');
  });
  it('counts days for the rest of the week', () => {
    const now = new Date('2026-08-10T12:00:00Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(timeAgo(now - 3 * 86400000)).toBe('3d ago');
  });
});

describe('CONDITION_TIERS / CONDITION_OPTIONS', () => {
  it('every option round-trips through canonicalizeCondition onto its own tier key — the Condition dropdown must never offer a name the app itself can\'t recognize', () => {
    for (const { key, name } of CONDITION_TIERS) {
      expect(canonicalizeCondition(name)).toBe(key);
    }
  });

  it('CONDITION_OPTIONS is just the full names, NM-first', () => {
    expect(CONDITION_OPTIONS).toEqual(['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged']);
  });
});

describe('canonicalizeCondition', () => {
  it('maps known aliases onto the five tiers', () => {
    expect(canonicalizeCondition('nm')).toBe('NM');
    expect(canonicalizeCondition('Near Mint')).toBe('NM');
    expect(canonicalizeCondition('LP')).toBe('LP');
    expect(canonicalizeCondition('heavily played')).toBe('HP');
    expect(canonicalizeCondition('damaged')).toBe('DMG');
  });
  it('returns null for blank or unrecognized text rather than guessing', () => {
    expect(canonicalizeCondition('')).toBeNull();
    expect(canonicalizeCondition(null)).toBeNull();
    expect(canonicalizeCondition('Sealed')).toBeNull();
  });
});

describe('marketValueForCondition', () => {
  it('returns null if there is no base price to work from', () => {
    expect(marketValueForCondition(null, 'NM', DEFAULT_CONDITION_MULTIPLIERS)).toBeNull();
  });
  it('returns null for an unrecognized condition rather than assuming NM', () => {
    expect(marketValueForCondition(100, 'Sealed', DEFAULT_CONDITION_MULTIPLIERS)).toBeNull();
  });
  it('NM is always 100% regardless of the multiplier table', () => {
    expect(marketValueForCondition(100, 'NM', {})).toBe(100);
  });
  it('applies the store-configured percentage for other tiers', () => {
    expect(marketValueForCondition(100, 'LP', DEFAULT_CONDITION_MULTIPLIERS)).toBe(85);
    expect(marketValueForCondition(100, 'HP', DEFAULT_CONDITION_MULTIPLIERS)).toBe(45);
  });
  it('rounds to the cent', () => {
    expect(marketValueForCondition(33.33, 'LP', DEFAULT_CONDITION_MULTIPLIERS)).toBeCloseTo(28.33, 2);
  });
});

describe('resolveActiveImage / activeImageSrc', () => {
  const stockOnly = { imageUrl: 'https://example.com/stock.jpg', imageData: '', photoUrl: '', photoData: '', activeImage: 'photo' };
  const photoOnly = { imageUrl: '', imageData: '', photoUrl: 'local', photoData: 'data:image/jpeg;base64,abc', activeImage: 'photo' };
  const both = {
    imageUrl: 'https://example.com/stock.jpg', imageData: '',
    photoUrl: 'local', photoData: 'data:image/jpeg;base64,abc',
    activeImage: 'photo',
  };

  it('prefers photo by default, falling back to stock if photo is blank', () => {
    expect(resolveActiveImage(stockOnly)).toBe('stock');
    expect(activeImageSrc(stockOnly)).toBe('https://example.com/stock.jpg');
  });
  it('falls back to photo if stock is blank and stock was preferred', () => {
    const card = { ...photoOnly, activeImage: 'stock' };
    expect(resolveActiveImage(card)).toBe('photo');
    expect(activeImageSrc(card)).toBe('data:image/jpeg;base64,abc');
  });
  it('honors an explicit preference when both slots exist', () => {
    expect(resolveActiveImage({ ...both, activeImage: 'stock' })).toBe('stock');
    expect(resolveActiveImage({ ...both, activeImage: 'photo' })).toBe('photo');
  });
  it('returns null when neither slot has anything', () => {
    const empty = { imageUrl: '', imageData: '', photoUrl: '', photoData: '', activeImage: 'photo' };
    expect(activeImageSrc(empty)).toBeNull();
  });
  it('treats a non-http imageUrl that is not "local" as blank', () => {
    const weird = { imageUrl: 'garbage', imageData: '', photoUrl: '', photoData: '', activeImage: 'stock' };
    expect(activeImageSrc(weird)).toBeNull();
  });
});

describe('SORT_COLUMNS', () => {
  it('sorts name/sku case-insensitively', () => {
    expect(SORT_COLUMNS.name({ name: 'ZEBRA' })).toBe('zebra');
    expect(SORT_COLUMNS.sku({ sku: 'ABC' })).toBe('abc');
  });
  it('sorts a null price below every real price', () => {
    expect(SORT_COLUMNS.price({ price: null })).toBe(-Infinity);
    expect(SORT_COLUMNS.price({ price: 5 })).toBe(5);
  });
});
