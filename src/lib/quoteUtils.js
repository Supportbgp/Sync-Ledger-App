import { normalizeCard, parseMoney } from './cardUtils.js';

// The source spreadsheet hardcoded 50/60/70% everywhere — these are just
// the fallback before quote_settings loads (see db.js's dbLoadQuoteSettings),
// same "store-configurable, not hardcoded" pattern as
// DEFAULT_CONDITION_MULTIPLIERS in cardUtils.js.
export const DEFAULT_QUOTE_TIER_PCTS = { tier1: 50, tier2: 60, tier3: 70 };

// A quote line item — mirrors normalizeCard's defaulting discipline, with
// one deliberate difference: `condition` is NEVER defaulted (not even to
// "Near Mint"). Staff make a real, on-the-spot physical assessment of a
// card they're buying, and a silent default would stand in for that
// judgment call instead of forcing it.
export function normalizeQuoteItem(item) {
  const src = item || {};
  return {
    id: src.id || `qi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: src.name || '',
    game: src.game || '',
    set: src.set || '',
    number: src.number || '',
    rarity: src.rarity || '',
    printing: src.printing || '',
    condition: src.condition || '',
    basePrice: parseMoney(src.basePrice),
    price: parseMoney(src.price),
    qty: src.qty === '' || src.qty == null ? 1 : (Number(src.qty) || 1),
    notes: src.notes || '',
    // Same dual-image model as a catalog row (see cardUtils.js's
    // resolveActiveImage/activeImageSrc, reused as-is for a quote item's
    // thumbnail) — a picked catalog reference or a scan/import carries its
    // image straight over; a manually-typed row with no match just has none.
    imageUrl: src.imageUrl || '',
    imageData: src.imageData || '',
    photoUrl: src.photoUrl || '',
    photoData: src.photoData || '',
    activeImage: src.activeImage === 'stock' ? 'stock' : 'photo',
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Total quoted value across every line item — same rule as the sheet's own
// line-total formula (price × qty, or just price with qty treated as 1),
// just applied to already-normalized items where qty is never blank.
// A blank price excludes that row from the total entirely, same as the
// sheet leaving that row's own line-total cell blank.
export function computeQuoteTotals(items) {
  let qty = 0;
  let total = 0;
  for (const item of (items || [])) {
    const price = parseMoney(item.price);
    const q = Number(item.qty) || 1;
    qty += q;
    if (price != null) total += price * q;
  }
  return { qty, total: round2(total) };
}

// The three offer amounts shown alongside the total, computed from whatever
// tier percentages the store has configured (quote_settings), falling back
// to DEFAULT_QUOTE_TIER_PCTS before that loads.
export function computeOfferTiers(total, tierSettings) {
  const s = tierSettings || DEFAULT_QUOTE_TIER_PCTS;
  return {
    tier1: round2(total * (s.tier1 ?? DEFAULT_QUOTE_TIER_PCTS.tier1) / 100),
    tier2: round2(total * (s.tier2 ?? DEFAULT_QUOTE_TIER_PCTS.tier2) / 100),
    tier3: round2(total * (s.tier3 ?? DEFAULT_QUOTE_TIER_PCTS.tier3) / 100),
  };
}

// Adapter for the Scan/Import add-card methods: both ScannerPanel and
// ImportPanel already produce fully-formed normalizeCard(...)-shaped
// objects before calling their onImport callback (the same objects they'd
// otherwise write straight to Catalog) — this reshapes each one into a
// quote item instead, dropping the generated `sku` (quote items don't need
// one) and giving each a fresh client-side id.
//
// `number` (collector number) is left blank here — it isn't part of
// normalizeCard's saved shape at all (Scanner/Import already discard it as
// a transient, never-saved search-only hint before calling onImport, the
// same as when they write straight to Catalog), so there's nothing to
// carry over. Staff can still type it in by hand afterward.
export function itemsFromCatalogRows(cards) {
  return (cards || []).map(c => normalizeQuoteItem({
    name: c.name,
    game: c.game,
    set: c.set,
    rarity: c.rarity,
    printing: c.printing,
    condition: c.condition,
    basePrice: c.basePrice,
    price: c.price,
    qty: c.qty,
    notes: c.notes,
    imageUrl: c.imageUrl,
    imageData: c.imageData,
    photoUrl: c.photoUrl,
    photoData: c.photoData,
    activeImage: c.activeImage,
  }));
}

// Sort-time conversion: turns one or more sorting-queue items (see
// phase10_sorting_bulk.sql) into new Catalog rows via the exact same
// normalizeCard(...) shape EditModal/ScannerPanel already build before
// calling dbUpsertCard(s) — no new catalog-write primitive needed.
// basePrice carries over so Market Value keeps working on each new row
// going forward; price/condition/qty/notes carry over as entered on the
// quote. Called from App.jsx's handleSortItems — every item passed shares
// this one destination decision (a single sorting-queue row via the per-row
// "Sort" button, or several batch-selected rows headed to the same binder/
// case at once — see the Sorting stage in CLAUDE.md).
//
// `destination` — { location, posChannel, tcgplayerChannel, collectrChannel }
// — is staff's answer to "where are these cards going?".
// Omitting it (e.g. existing callers/tests) falls back to normalizeCard's
// own defaults — blank location, channels defaulting to "everywhere".
export function buildCatalogItemsFromQuoteItems(items, destination) {
  const dest = destination || {};
  return (items || []).map((item, i) => normalizeCard({
    sku: `quote-${Date.now()}-${i}`,
    name: item.name,
    game: item.game,
    set: item.set,
    condition: item.condition,
    printing: item.printing,
    rarity: item.rarity,
    qty: item.qty,
    price: item.price,
    basePrice: item.basePrice,
    notes: item.notes,
    imageUrl: item.imageUrl,
    imageData: item.imageData,
    photoUrl: item.photoUrl,
    photoData: item.photoData,
    activeImage: item.activeImage,
    location: dest.location || '',
    posChannel: dest.posChannel,
    tcgplayerChannel: dest.tcgplayerChannel,
    collectrChannel: dest.collectrChannel,
  }));
}

// Accept-time move: turns every line item of a newly-accepted quote into a
// sorting_queue row instead of a Catalog row — accepting no longer asks
// "where are these going" itself; that question moves entirely to the
// Sorting tab, one card at a time (see CLAUDE.md's "Sorting stage"
// section). quoteId/quoteCollectionName are snapshotted onto every row so
// the Sorting tab can show which quote a pending item came from without a
// join, and so the row still reads sensibly if the quote is later deleted.
export function buildSortingItemsFromQuoteItems(items, quoteId, quoteCollectionName) {
  return (items || []).map(item => ({
    quoteId,
    quoteCollectionName: quoteCollectionName || '',
    name: item.name,
    game: item.game,
    set: item.set,
    number: item.number,
    rarity: item.rarity,
    printing: item.printing,
    condition: item.condition,
    price: item.price,
    basePrice: item.basePrice,
    qty: item.qty,
    notes: item.notes,
    imageUrl: item.imageUrl,
    imageData: item.imageData,
    photoUrl: item.photoUrl,
    photoData: item.photoData,
    activeImage: item.activeImage,
  }));
}
