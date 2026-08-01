// Each export format takes the already-scoped catalog rows (or, for the
// queue-based ones, the full sync queue) and returns plain objects ready for
// downloadCsv. None of these are verified bulk-upload templates for the
// external platform — TCG Player and Collectr don't expose a way to
// bulk-create brand-new listings/entries to anyone (see PR notes) — so these
// are deliberately just clean, well-labeled reference lists that make manual
// entry on each platform faster, not one-click importable files.

export const EXPORT_FORMATS = [
  { key: 'fullCatalog', label: 'Full catalog CSV (Ledger format)', scoped: true },
  { key: 'tcgplayer', label: 'TCG Player — manual entry list', scoped: true },
  { key: 'collectr', label: 'Collectr — manual entry list', scoped: true },
  { key: 'pendingPos', label: 'Pending → POS CSV (unsynced sales)', scoped: false },
  { key: 'syncHistory', label: 'Sync history CSV', scoped: false },
];

export function buildFullCatalogRows(items) {
  return items.map(c => ({
    SKU: c.sku, Name: c.name, Set: c.set, Game: c.game, Condition: c.condition, Printing: c.printing,
    Type: c.itemType, Grader: c.grader, Grade: c.grade, CertNumber: c.certNumber,
    Qty: c.qty, Price: c.price, Notes: c.notes, Sold: c.sold, ImageURL: c.imageUrl, SourceURL: c.sourceUrl, Location: c.location,
    LastUpdated: new Date(c.lastUpdated).toISOString(),
  }));
}

export function buildTcgPlayerEntryRows(items) {
  return items.map(c => ({
    "Product Name": c.name,
    "Set Name": c.set,
    Game: c.game,
    Condition: c.condition,
    Printing: c.printing,
    Quantity: c.qty,
    Price: c.price,
  }));
}

export function buildCollectrEntryRows(items) {
  return items.map(c => ({
    "Card Name": c.name,
    Set: c.set,
    Game: c.game,
    Variant: c.printing,
    Quantity: c.qty,
  }));
}

export function buildPendingPosRows(queue) {
  return queue.filter(t => !t.posDone).map(t => ({ Barcode: t.sku, QtySold: t.qtySold, Name: t.name }));
}

export function buildSyncHistoryRows(queue) {
  return queue.map(t => ({
    Time: new Date(t.timestamp).toISOString(), SKU: t.sku, Name: t.name, QtySold: t.qtySold,
    POSDone: t.posDone, TCGPlayerDone: t.tcgplayerDone, CollectrDone: t.collectrDone,
  }));
}
