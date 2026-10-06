import { flatItemAmount } from '../../lib/quoteUtils.js';

// A flat, non-card line item — a playmat, a couple of binders the shop
// wants to offer a flat $5 for, or "$1 for 3 bulk V/ex" — deliberately
// minimal next to QuoteLineItemRow's full card form: no Game/Set/Rarity/
// Condition, no catalog typeahead, no live image/price search. Just
// enough to record what it is, how many, and what it's worth.
//
// Its price is excluded from the 50/60/70% tier math entirely (see
// computeQuoteTotals's isAddOn branch in quoteUtils.js) and never becomes
// a Sorting/Catalog row on accept (buildSortingItemsFromQuoteItems drops
// it) — confirmed with the user as a pricing-only convenience, not
// inventory. It only reaches the final offer if staff explicitly click
// "Add to payout" in the Total & offer section below.
//
// Qty is informational record-keeping only ("this was 3 cards") — it is
// NEVER multiplied into price, so typing a flat $5 always means a full $5,
// not $5 × Qty. Reuses notes as "Description" — a field every quote item
// already has but that QuoteLineItemRow never surfaces in its own UI, so
// there's no conflict reusing it here.
//
// "Apply a %?" (pctEnabled/pctValue, via flatItemAmount in quoteUtils.js)
// lets staff enter a bundle's full assessed value and have the app work
// out what to actually offer, instead of pre-calculating "60% of $5" by
// hand — real ask: several $1-5 cards thrown into one bundle at a rate
// that isn't necessarily the quote's own tier. Not locked to the three
// configured tiers (60%, 70%, "etc." was explicit), so it's a plain
// percentage input, not a dropdown.
export default function AddOnLineItemRow({ item, onChange, onRemove }) {
  function patch(p) {
    onChange({ ...item, ...p });
  }

  const amount = flatItemAmount(item);

  return (
    <div className="scan-row">
      <div className="scan-row-fields">
        <div className="scan-row-line">
          <div className="scan-field sf-qty">
            <label className="scan-field-label">Qty</label>
            <input
              type="number" min="1" placeholder="Qty" value={item.qty}
              onChange={(e) => patch({ qty: Number(e.target.value) || 1 })}
            />
          </div>
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
        <div className="scan-row-line" style={{ alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="checkbox-row" style={{ margin: 0 }}>
            <input
              type="checkbox" id={`addon-pct-${item.id}`} checked={item.pctEnabled}
              onChange={(e) => patch({ pctEnabled: e.target.checked })}
            />
            <label htmlFor={`addon-pct-${item.id}`} style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Apply a %?</label>
          </div>
          {item.pctEnabled && (
            <>
              <input
                type="number" placeholder="e.g. 60" value={item.pctValue ?? ''}
                onChange={(e) => patch({ pctValue: e.target.value === '' ? null : Number(e.target.value) })}
                style={{ width: '70px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>%</span>
              {amount != null && (
                <span style={{ fontSize: '11.5px', fontFamily: "'IBM Plex Mono', monospace" }}>= ${amount.toFixed(2)}</span>
              )}
            </>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
          Flat add-on — Qty is a record only (never multiplies the price). Excluded from the tier % offers below; only affects Payout amount if you click "Add to payout." Check "Apply a %?" to offer only part of the entered value, instead of pre-calculating it yourself.
        </div>
      </div>
    </div>
  );
}
