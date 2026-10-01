import { GAMES } from '../../lib/cardUtils.js';

// A real card destined straight for Bulk — staff already know it's not
// getting its own per-print identity, so this skips Set/Rarity/Printing/
// Condition and the catalog typeahead entirely: just Game (needed later to
// find/create the right (location, game) Bulk row), Qty, and Price. Unlike
// AddOnLineItemRow, this item DOES count toward the normal tier math and
// DOES flow through to Sorting on accept — the only thing this flag/row
// changes is how little you have to fill in at quote time; the actual
// Bulk placement still happens at Sorting time, one item at a time, same
// as the Sorting tab's existing "Add to Bulk" option already works for
// any item.
export default function BulkLineItemRow({ item, onChange, onRemove }) {
  function patch(p) {
    onChange({ ...item, ...p });
  }

  return (
    <div className="scan-row">
      <div className="scan-row-fields">
        <div className="scan-row-line">
          <div className="scan-field sf">
            <label className="scan-field-label">Game</label>
            <select value={item.game} onChange={(e) => patch({ game: e.target.value })}>
              <option value="">— Game —</option>
              {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="scan-field sf-qty">
            <label className="scan-field-label">Qty</label>
            <input
              type="number" min="1" placeholder="Qty" value={item.qty}
              onChange={(e) => patch({ qty: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Price (per card)</label>
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
          Counts toward the tier offers below like a normal card. Goes to Sorting on accept, same as any item — place it into Bulk there.
        </div>
      </div>
    </div>
  );
}
