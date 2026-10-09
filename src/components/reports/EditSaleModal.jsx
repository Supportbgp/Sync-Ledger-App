import { useState } from 'react';
import { GAMES } from '../../lib/cardUtils.js';

// Local YYYY-MM-DD for the date input, in the browser's own time zone —
// matching the same local-date convention customDateRangeToBounds
// (reportUtils.js) already uses for Reports' own Custom range pickers.
function toDateInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Corrects a past sale — a typo'd Name/Condition/Qty, a wrong Price/Cost, or
// a misrecorded Sold date — from the Reports tab's own per-game drill-down.
// See db.js's dbUpdateSale for why editing a `sales` row is safe despite
// this table's own "append-only" framing elsewhere in this app: that was
// about the app never silently rewriting history on its own, not a bar on
// staff fixing a real mistake.
export default function EditSaleModal({ sale, onClose, onSave }) {
  const [form, setForm] = useState({
    name: sale.name || '',
    game: sale.game || '',
    condition: sale.condition || '',
    qtySold: String(sale.qtySold ?? 1),
    salePrice: sale.salePrice == null ? '' : String(sale.salePrice),
    cost: sale.cost == null ? '' : String(sale.cost),
    soldDate: toDateInputValue(sale.soldAt),
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    // Keeps the original time-of-day, only the calendar date moves — two
    // sales corrected to the same day shouldn't lose their original
    // relative ordering within it.
    const original = new Date(sale.soldAt);
    const [y, m, d] = form.soldDate.split('-').map(Number);
    const soldAt = new Date(
      y, m - 1, d,
      original.getHours(), original.getMinutes(), original.getSeconds(), original.getMilliseconds()
    ).getTime();
    const updated = {
      ...sale,
      name: form.name.trim(),
      game: form.game,
      condition: form.condition.trim(),
      qtySold: Number(form.qtySold) || 1,
      salePrice: form.salePrice === '' ? null : Number(form.salePrice),
      cost: form.cost === '' ? null : Number(form.cost),
      soldAt,
    };
    await onSave(updated);
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">Edit sale</div>
          <div className="meta">
            Corrects this one historical record — it never changes the catalog row it came from (which may no
            longer even exist), and it won't retroactively affect any other report.
          </div>
        </div>
        {/* Every label/input below is a real htmlFor/id pair, not just a
            visual sibling — this app found that gap the hard way once
            already (LocationPicker's own unlabeled <select>, see CLAUDE.md's
            "Rarity field gained a <datalist>..." section) and fixed it at
            the root there; this modal starts from the fixed pattern instead
            of reintroducing the same gap. */}
        <div className="modal-body">
          <div className="field-group">
            <label htmlFor="edit-sale-name">Name</label>
            <input id="edit-sale-name" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field-row2">
            <div className="field-group">
              <label htmlFor="edit-sale-game">Game</label>
              <select id="edit-sale-game" value={form.game} onChange={(e) => set('game', e.target.value)}>
                {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="edit-sale-condition">Condition</label>
              <input id="edit-sale-condition" type="text" value={form.condition} onChange={(e) => set('condition', e.target.value)} />
            </div>
          </div>
          <div className="field-row2">
            <div className="field-group">
              <label htmlFor="edit-sale-qty">Qty sold</label>
              <input id="edit-sale-qty" type="number" min="1" step="1" value={form.qtySold} onChange={(e) => set('qtySold', e.target.value)} />
            </div>
            <div className="field-group">
              <label htmlFor="edit-sale-date">Sold date</label>
              <input id="edit-sale-date" type="date" value={form.soldDate} onChange={(e) => set('soldDate', e.target.value)} />
            </div>
          </div>
          <div className="field-row2">
            <div className="field-group">
              <label htmlFor="edit-sale-price">Sale price ($)</label>
              <input
                id="edit-sale-price" type="number" min="0" step="0.01" value={form.salePrice}
                onChange={(e) => set('salePrice', e.target.value)}
                placeholder="Blank if unknown"
              />
            </div>
            <div className="field-group">
              <label htmlFor="edit-sale-cost">Cost ($)</label>
              <input
                id="edit-sale-cost" type="number" min="0" step="0.01" value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                placeholder="Blank if unknown"
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
