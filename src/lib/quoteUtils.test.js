import { describe, it, expect } from 'vitest';
import {
  DEFAULT_QUOTE_TIER_PCTS, normalizeQuoteItem, computeQuoteTotals, computeOfferTiers,
  itemsFromCatalogRows, buildCatalogItemsFromQuoteItems, buildSortingItemsFromQuoteItems,
} from './quoteUtils.js';

describe('normalizeQuoteItem', () => {
  it('defaults qty to 1 when blank/missing, but never defaults condition', () => {
    const item = normalizeQuoteItem({ name: 'Charizard' });
    expect(item.qty).toBe(1);
    expect(item.condition).toBe('');
  });

  it('preserves an explicit condition and never substitutes Near Mint', () => {
    const item = normalizeQuoteItem({ name: 'Charizard', condition: 'Lightly Played' });
    expect(item.condition).toBe('Lightly Played');
  });

  it('gives every item a stable id, generating one if none was provided', () => {
    const a = normalizeQuoteItem({ name: 'A' });
    const b = normalizeQuoteItem({ name: 'B' });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    const withId = normalizeQuoteItem({ id: 'keep-me', name: 'C' });
    expect(withId.id).toBe('keep-me');
  });

  it('parses price/basePrice through parseMoney (blank -> null, not 0)', () => {
    const item = normalizeQuoteItem({ name: 'X', price: '', basePrice: undefined });
    expect(item.price).toBeNull();
    expect(item.basePrice).toBeNull();
  });

  it('carries the same dual-image fields a catalog row has, defaulting activeImage to photo', () => {
    const item = normalizeQuoteItem({ name: 'X', imageUrl: 'https://x/stock.jpg', photoData: 'data:img' });
    expect(item.imageUrl).toBe('https://x/stock.jpg');
    expect(item.photoData).toBe('data:img');
    expect(item.activeImage).toBe('photo');
    expect(normalizeQuoteItem({ name: 'Y', activeImage: 'stock' }).activeImage).toBe('stock');
  });
});

describe('computeQuoteTotals', () => {
  it('sums price × qty across items', () => {
    const items = [
      normalizeQuoteItem({ name: 'A', price: 10, qty: 2 }),
      normalizeQuoteItem({ name: 'B', price: 5, qty: 1 }),
    ];
    const { qty, total } = computeQuoteTotals(items);
    expect(qty).toBe(3);
    expect(total).toBe(25);
  });

  it('treats a blank qty as 1, matching the source sheet\'s own line-total rule', () => {
    const items = [normalizeQuoteItem({ name: 'A', price: 10, qty: '' })];
    const { total } = computeQuoteTotals(items);
    expect(total).toBe(10);
  });

  it('excludes a blank-price row from the total entirely', () => {
    const items = [
      normalizeQuoteItem({ name: 'A', price: 10, qty: 1 }),
      normalizeQuoteItem({ name: 'B', price: null, qty: 5 }),
    ];
    const { total } = computeQuoteTotals(items);
    expect(total).toBe(10);
  });

  it('returns zero for an empty item list', () => {
    expect(computeQuoteTotals([])).toEqual({ qty: 0, total: 0 });
  });
});

describe('computeOfferTiers', () => {
  it('computes the three tiers from custom store settings, not just the 50/60/70 default', () => {
    const tiers = computeOfferTiers(100, { tier1: 40, tier2: 55, tier3: 75 });
    expect(tiers).toEqual({ tier1: 40, tier2: 55, tier3: 75 });
  });

  it('falls back to DEFAULT_QUOTE_TIER_PCTS when no settings are given', () => {
    const tiers = computeOfferTiers(200, null);
    expect(tiers).toEqual({
      tier1: 200 * DEFAULT_QUOTE_TIER_PCTS.tier1 / 100,
      tier2: 200 * DEFAULT_QUOTE_TIER_PCTS.tier2 / 100,
      tier3: 200 * DEFAULT_QUOTE_TIER_PCTS.tier3 / 100,
    });
  });
});

describe('itemsFromCatalogRows', () => {
  it('reshapes a normalizeCard-style object into a quote item and drops its sku', () => {
    const cards = [{
      sku: 'scan-123-0', name: 'Charizard', game: 'Pokemon', set: 'Base Set',
      rarity: 'Rare Holo', printing: 'Holo', condition: 'Near Mint',
      basePrice: 50, price: 42.5, qty: 1, notes: 'from scan',
    }];
    const items = itemsFromCatalogRows(cards);
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('sku');
    expect(items[0]).toMatchObject({
      name: 'Charizard', game: 'Pokemon', set: 'Base Set', rarity: 'Rare Holo',
      printing: 'Holo', condition: 'Near Mint', basePrice: 50, price: 42.5, qty: 1, notes: 'from scan',
    });
    expect(items[0].id).toBeTruthy();
  });

  it('leaves number blank — normalizeCard never carries a persisted collector number to adapt from', () => {
    const items = itemsFromCatalogRows([{ name: 'X', game: 'Magic' }]);
    expect(items[0].number).toBe('');
  });

  it('handles an empty/undefined card list', () => {
    expect(itemsFromCatalogRows([])).toEqual([]);
    expect(itemsFromCatalogRows(undefined)).toEqual([]);
  });

  it('carries image fields over from a scanned/picked card', () => {
    const items = itemsFromCatalogRows([{
      name: 'X', game: 'Pokemon', imageUrl: 'https://x/stock.jpg', photoData: 'data:crop', activeImage: 'stock',
    }]);
    expect(items[0].imageUrl).toBe('https://x/stock.jpg');
    expect(items[0].photoData).toBe('data:crop');
    expect(items[0].activeImage).toBe('stock');
  });
});

describe('buildCatalogItemsFromQuoteItems', () => {
  it('produces valid normalizeCard-shaped objects with a generated sku', () => {
    const items = [normalizeQuoteItem({
      name: 'Charizard', game: 'Pokemon', set: 'Base Set', condition: 'Lightly Played',
      printing: 'Holo', rarity: 'Rare Holo', qty: 2, price: 40, basePrice: 50, notes: 'from quote',
    })];
    const cards = buildCatalogItemsFromQuoteItems(items);
    expect(cards).toHaveLength(1);
    const c = cards[0];
    expect(c.sku).toBeTruthy();
    expect(c.name).toBe('Charizard');
    expect(c.game).toBe('Pokemon');
    expect(c.condition).toBe('Lightly Played');
    expect(c.qty).toBe(2);
    expect(c.price).toBe(40);
    expect(c.basePrice).toBe(50);
    expect(c.notes).toBe('from quote');
  });

  it('gives each converted item a distinct sku', () => {
    const items = [normalizeQuoteItem({ name: 'A' }), normalizeQuoteItem({ name: 'B' })];
    const cards = buildCatalogItemsFromQuoteItems(items);
    expect(cards[0].sku).not.toBe(cards[1].sku);
  });

  it('handles an empty item list', () => {
    expect(buildCatalogItemsFromQuoteItems([])).toEqual([]);
  });

  it('carries the quote item\'s image over onto the new catalog row', () => {
    const items = [normalizeQuoteItem({ name: 'A', imageUrl: 'https://x/stock.jpg', activeImage: 'stock' })];
    const cards = buildCatalogItemsFromQuoteItems(items);
    expect(cards[0].imageUrl).toBe('https://x/stock.jpg');
    expect(cards[0].activeImage).toBe('stock');
  });

  it('applies a per-item destination (location + channels) rather than a whole-quote one', () => {
    const items = [normalizeQuoteItem({ name: 'A' })];
    const cards = buildCatalogItemsFromQuoteItems(items, {
      location: 'Red binder', posChannel: true, tcgplayerChannel: false, collectrChannel: false,
    });
    expect(cards[0].location).toBe('Red binder');
    expect(cards[0].posChannel).toBe(true);
    expect(cards[0].tcgplayerChannel).toBe(false);
    expect(cards[0].collectrChannel).toBe(false);
  });

  it('falls back to normalizeCard\'s own defaults (blank location, every channel on) when no destination is given', () => {
    const items = [normalizeQuoteItem({ name: 'A' })];
    const cards = buildCatalogItemsFromQuoteItems(items);
    expect(cards[0].location).toBe('');
    expect(cards[0].posChannel).toBe(true);
    expect(cards[0].tcgplayerChannel).toBe(true);
    expect(cards[0].collectrChannel).toBe(true);
  });
});

describe('buildSortingItemsFromQuoteItems', () => {
  it('reshapes every quote item into a sorting-queue row, snapshotting the quote id + collection name', () => {
    const items = [
      normalizeQuoteItem({ name: 'Charizard', game: 'Pokemon', set: 'Base Set', condition: 'Lightly Played', qty: 2, price: 40, basePrice: 50 }),
      normalizeQuoteItem({ name: 'Unlisted Promo Card', qty: 1, price: 5 }),
    ];
    const rows = buildSortingItemsFromQuoteItems(items, 'quote-id-1', 'Jake binder proposal');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      quoteId: 'quote-id-1', quoteCollectionName: 'Jake binder proposal',
      name: 'Charizard', game: 'Pokemon', set: 'Base Set', condition: 'Lightly Played',
      qty: 2, price: 40, basePrice: 50,
    });
    expect(rows[1]).toMatchObject({ quoteId: 'quote-id-1', quoteCollectionName: 'Jake binder proposal', name: 'Unlisted Promo Card' });
  });

  it('never assigns a sku — sorting-queue rows are not yet Catalog items', () => {
    const rows = buildSortingItemsFromQuoteItems([normalizeQuoteItem({ name: 'A' })], 'q1', 'Test');
    expect(rows[0]).not.toHaveProperty('sku');
  });

  it('carries image fields over so the Sorting tab can show a thumbnail', () => {
    const items = [normalizeQuoteItem({ name: 'A', imageUrl: 'https://x/stock.jpg', activeImage: 'stock' })];
    const rows = buildSortingItemsFromQuoteItems(items, 'q1', 'Test');
    expect(rows[0].imageUrl).toBe('https://x/stock.jpg');
    expect(rows[0].activeImage).toBe('stock');
  });

  it('handles an empty item list', () => {
    expect(buildSortingItemsFromQuoteItems([], 'q1', 'Test')).toEqual([]);
  });

  it('defaults quoteCollectionName to an empty string when not given', () => {
    const rows = buildSortingItemsFromQuoteItems([normalizeQuoteItem({ name: 'A' })], 'q1');
    expect(rows[0].quoteCollectionName).toBe('');
  });
});
