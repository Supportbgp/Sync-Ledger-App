import { GAMES, RARITY_OPTIONS_BY_GAME, PRINTING_OPTIONS_BY_GAME, CONDITION_OPTIONS, marketValueForCondition } from '../../lib/cardUtils.js';
import CatalogItemPicker from './CatalogItemPicker.jsx';
import SelectWithCustom from '../SelectWithCustom.jsx';

// One line item in a quote's build view. Same field set as EditModal
// (Game/Set/Number/Rarity/Printing/Condition) so an accepted item arrives
// in Catalog with good data — reuses the exact same dense
// .scan-row/.scan-field layout ScannerPanel's ScanRow already uses
// (desktop: compact single-line grid; mobile: one field per line via the
// same shared breakpoint), rather than a third near-identical row layout.
export default function QuoteLineItemRow({ item, onChange, onRemove, catalog, multipliers }) {
  function patch(p) {
    onChange({ ...item, ...p });
  }

  function handleCatalogPick(card) {
    const p = {
      name: card.name || item.name,
      game: card.game || item.game,
      set: card.set || item.set,
      rarity: card.rarity || item.rarity,
      printing: card.printing || item.printing,
      basePrice: card.basePrice ?? item.basePrice,
    };
    // Only auto-fill price if staff hasn't already typed one — a picked
    // reference card is a starting point, never something that should
    // silently overwrite a value already entered.
    if (item.price == null) {
      const mv = marketValueForCondition(p.basePrice, item.condition, multipliers);
      if (mv != null) p.price = mv;
    }
    patch(p);
  }

  function handleConditionChange(condition) {
    const p = { condition };
    if (item.price == null) {
      const mv = marketValueForCondition(item.basePrice, condition, multipliers);
      if (mv != null) p.price = mv;
    }
    patch(p);
  }

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
            <label className="scan-field-label">Card name</label>
            <CatalogItemPicker
              catalog={catalog}
              value={item.name}
              onChange={(name) => patch({ name })}
              onSelectCatalogItem={handleCatalogPick}
              ariaLabel="Card name"
            />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Game</label>
            <select value={item.game} onChange={(e) => patch({ game: e.target.value })}>
              <option value="">— Game —</option>
              {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Set</label>
            <input type="text" placeholder="Set" value={item.set} onChange={(e) => patch({ set: e.target.value })} />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Number</label>
            <input type="text" placeholder="Number" value={item.number} onChange={(e) => patch({ number: e.target.value })} />
          </div>
        </div>
        <div className="scan-row-line">
          <div className="scan-field sf">
            <label className="scan-field-label">Rarity</label>
            <SelectWithCustom
              options={RARITY_OPTIONS_BY_GAME[item.game] || []}
              value={item.rarity}
              onChange={(v) => patch({ rarity: v })}
              ariaLabel="Rarity"
              selectPlaceholder="— Rarity —"
              addNewLabel="+ Enter a different rarity…"
              customPlaceholder="Rarity"
              backLabel="← Choose from the list instead"
            />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Printing / finish</label>
            <SelectWithCustom
              options={PRINTING_OPTIONS_BY_GAME[item.game] || []}
              value={item.printing}
              onChange={(v) => patch({ printing: v })}
              ariaLabel="Printing / finish"
              selectPlaceholder="— Printing —"
              addNewLabel="+ Enter a different printing…"
              customPlaceholder="Printing"
              backLabel="← Choose from the list instead"
            />
          </div>
          <div className="scan-field sf">
            <label className="scan-field-label">Condition</label>
            {/* Deliberately no default — a genuine physical assessment
                staff make when buying the card, never assumed. */}
            <SelectWithCustom
              options={CONDITION_OPTIONS}
              value={item.condition}
              onChange={(v) => handleConditionChange(v)}
              ariaLabel="Condition"
              selectPlaceholder="— Select condition —"
              addNewLabel="+ Enter a different condition…"
              customPlaceholder="Condition"
              backLabel="← Choose from the list instead"
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
      </div>
    </div>
  );
}
