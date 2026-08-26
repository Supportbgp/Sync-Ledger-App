import { useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { GAMES, RARITY_OPTIONS_BY_GAME, PRINTING_OPTIONS_BY_GAME, CONDITION_OPTIONS, marketValueForCondition, activeImageSrc } from '../../lib/cardUtils.js';
import { searchCardImage, tcgplayerSearchUrl, ebaySoldSearchUrl } from '../../lib/cardSearch.js';
import CatalogItemPicker from './CatalogItemPicker.jsx';
import SelectWithCustom from '../SelectWithCustom.jsx';

// One line item in a quote's build view. Same field set as EditModal
// (Game/Set/Number/Rarity/Printing/Condition) so an accepted item arrives
// in Catalog with good data — reuses the exact same dense
// .scan-row/.scan-field layout ScannerPanel's ScanRow already uses
// (desktop: compact single-line grid; mobile: one field per line via the
// same shared breakpoint), rather than a third near-identical row layout.
//
// The catalog typeahead (CatalogItemPicker) is the fast path when a card's
// already been handled before, but a genuinely new trade-in card has no
// catalog history to reference — "Find image"/"Find market price" reuse
// the same live external search (Scryfall/pokemontcg.io/etc.) EditModal/
// Scanner already use, scoped locally to this one row (self-contained
// search state, same pattern as EditModal's own candidates/candidateMode).
export default function QuoteLineItemRow({ item, onChange, onRemove, catalog, multipliers }) {
  const { openLightbox } = useUI();
  const [candidates, setCandidates] = useState([]);
  const [candidateMode, setCandidateMode] = useState('image'); // 'image' | 'price'
  const [activeSearch, setActiveSearch] = useState(null); // null | 'image' | 'price'
  const [status, setStatus] = useState({ text: '', kind: '' });

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
      imageUrl: card.imageUrl || item.imageUrl,
      imageData: card.imageData || item.imageData,
      photoUrl: card.photoUrl || item.photoUrl,
      photoData: card.photoData || item.photoData,
      activeImage: card.activeImage || item.activeImage,
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

  async function runSearch(mode) {
    setCandidateMode(mode);
    setActiveSearch(mode);
    setStatus({ text: '', kind: '' });
    try {
      const results = await searchCardImage(item.game, item.name.trim(), item.set.trim(), item.rarity.trim(), item.number.trim());
      if (results === null) {
        setCandidates([]);
        setStatus({ text: `No lookup available for ${item.game || 'this game'} yet.`, kind: 'err' });
      } else if (!results.length) {
        setCandidates([]);
        setStatus({ text: 'No matches found.', kind: 'err' });
      } else {
        setCandidates(results);
        setStatus({ text: `${results.length} possible match(es) — pick the one that matches your card.`, kind: 'ok' });
      }
    } catch {
      setCandidates([]);
      setStatus({ text: 'Search failed — try again.', kind: 'err' });
    }
    setActiveSearch(null);
  }

  function selectCandidate(c) {
    if (candidateMode === 'price') {
      const p = { basePrice: c.price ?? item.basePrice };
      if (item.price == null && p.basePrice != null) {
        const mv = marketValueForCondition(p.basePrice, item.condition, multipliers);
        if (mv != null) p.price = mv;
      }
      patch(p);
    } else {
      patch({
        imageUrl: c.url, imageData: '', activeImage: 'stock',
        set: c.set || item.set, number: c.number || item.number, rarity: c.rarity || item.rarity,
      });
    }
    setCandidates([]);
    setStatus({ text: '', kind: '' });
  }

  const displaySrc = activeImageSrc(item);
  const searching = activeSearch !== null;

  return (
    <div className="scan-row">
      <div className="scan-row-thumb-col">
        <div
          className="scan-row-thumb"
          onClick={() => { if (displaySrc) openLightbox(displaySrc); }}
          style={{ cursor: displaySrc ? 'pointer' : 'default' }}
          title={displaySrc ? 'Click to zoom' : ''}
        >
          {displaySrc ? <img src={displaySrc} /> : <span style={{ fontSize: '9px', color: 'var(--ink-faint)', textAlign: 'center' }}>{item.game || 'No image'}</span>}
        </div>
        <button
          className="btn ghost small" style={{ fontSize: '10.5px', padding: '2px 6px', marginTop: '4px' }}
          disabled={searching} onClick={() => runSearch('image')}
        >
          {activeSearch === 'image' ? (<><span className="spinner" style={{ width: '10px', height: '10px' }} /> Searching…</>) : 'Find image'}
        </button>
        <button
          className="btn ghost small" style={{ fontSize: '10.5px', padding: '2px 6px', marginTop: '3px' }}
          disabled={searching} onClick={() => runSearch('price')}
        >
          {activeSearch === 'price' ? (<><span className="spinner" style={{ width: '10px', height: '10px' }} /> Searching…</>) : 'Find price'}
        </button>
        <a
          href={tcgplayerSearchUrl(item.name, item.set)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 600, marginTop: '3px' }}
        >TCGPlayer ↗</a>
        <a
          href={ebaySoldSearchUrl(item.name, item.set)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '10px', color: 'var(--blue)', fontWeight: 600, marginTop: '2px' }}
        >eBay sold ↗</a>
      </div>

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
        {status.text && <div className={`status-line ${status.kind}`} style={{ fontSize: '11.5px' }}>{status.text}</div>}
        {candidates.length > 0 && (
          <div className="img-candidates">
            {candidates.map((c, i) => (
              <img key={i} src={c.url} title={c.label} onClick={() => selectCandidate(c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
