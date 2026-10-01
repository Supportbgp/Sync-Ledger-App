// A flat, non-card line item — a playmat, a couple of binders the shop
// wants to offer a flat $5 for, or "$1 for 3 bulk V/ex" — deliberately
// minimal next to QuoteLineItemRow's full card form: no Game/Set/Rarity/
// Condition, no catalog typeahead, no live image/price search. Just
// enough to record what it is and what it's worth.
//
// Its price is excluded from the 50/60/70% tier math entirely (see
// computeQuoteTotals's isAddOn branch in quoteUtils.js) and never becomes
// a Sorting/Catalog row on accept (buildSortingItemsFromQuoteItems drops
// it) — confirmed with the user as a pricing-only convenience, not
// inventory. It only reaches the final offer if staff explicitly click
// "Add to payout" in the Total & offer section below.
//
// Reuses notes as "Description" — a field every quote item already has
// but that QuoteLineItemRow never surfaces in its own UI, so there's no
// conflict reusing it here.
export default function AddOnLineItemRow({ item, onChange, onRemove }) {
  function patch(p) {
    onChange({ ...item, ...p });
  }

  return (
    <div className="scan-row">
      <div className="scan-row-fields">
        <div className="scan-row-line">
          <div className="scan-field sf-wide">
            <label className="scan-field-label">Item name</label>
            <input
              type="text" placeholder="e.g. Binder, playmat, bulk V/ex lot" value={item.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>
          <div className="scan-field sf-wide">
            <label className="scan-field-label">Description</label>
            <input
              type="text" placeholder="Optional details" value={item.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Price</label>
            <input
              type="number" placeholder="Price" step="0.01" value={item.price ?? ''}
              onChange={(e) => patch({ price: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="scan-row-meta">
            <button className="icon-btn" title="Remove" onClick={onRemove}>✕</button>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
          Flat add-on — excluded from the tier % offers below; only affects Payout amount if you click "Add to payout."
        </div>
      </div>
    </div>
  );
}
