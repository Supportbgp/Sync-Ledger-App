import { useState } from 'react';
import { activeImageSrc } from '../../lib/cardUtils.js';
import { useUI } from '../../context/UIContext.jsx';
import SortItemModal from './SortItemModal.jsx';

// "Needs to process" queue — every accepted quote's line items land here
// (see App.jsx's handleSaveQuote/buildSortingItemsFromQuoteItems) before
// staff decide, one card at a time, where it actually goes: a real
// binder/case, or Bulk. A sorted row disappears from this list the moment
// it's placed — the resulting Catalog row is the durable record from
// then on, not this queue (see CLAUDE.md's "Sorting stage" section for
// why history isn't kept here).
export default function SortingTab({ sorting, catalog, locations, onSortItem }) {
  const { openLightbox } = useUI();
  const [sortingId, setSortingId] = useState(null);
  const activeItem = sorting.find(s => s.id === sortingId) || null;

  async function handleConfirm(destination) {
    if (!activeItem) return;
    await onSortItem(activeItem, destination);
    setSortingId(null);
  }

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontSize: '13px', color: 'var(--ink-soft)', maxWidth: '560px' }}>
          Cards from accepted quotes land here first — sort each one to a real binder/case, or add it to Bulk, before it becomes a Catalog item.
        </div>
      </div>
      {sorting.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorting.map(item => {
            const displaySrc = activeImageSrc(item);
            return (
              <div className="scan-row" key={item.id}>
                <div className="scan-row-thumb-col">
                  <div
                    className="scan-row-thumb"
                    onClick={() => { if (displaySrc) openLightbox(displaySrc); }}
                    style={{ cursor: displaySrc ? 'pointer' : 'default' }}
                    title={displaySrc ? 'Click to zoom' : ''}
                  >
                    {displaySrc ? <img src={displaySrc} /> : <span style={{ fontSize: '9px', color: 'var(--ink-faint)', textAlign: 'center' }}>{item.game || 'No image'}</span>}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}{item.qty > 1 ? ` × ${item.qty}` : ''}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                    {[item.game, item.set, item.rarity, item.condition].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-faint)' }}>
                    From {item.quoteCollectionName || 'a quote'}{item.price != null ? ` · $${Number(item.price).toFixed(2)}` : ''}
                  </div>
                </div>
                <button className="btn small" onClick={() => setSortingId(item.id)}>Sort</button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty"><span className="mark">Nothing waiting</span>Cards from accepted quotes will show up here to be sorted.</div>
      )}
      {activeItem && (
        <SortItemModal
          item={activeItem}
          catalog={catalog}
          locations={locations}
          onConfirm={handleConfirm}
          onCancel={() => setSortingId(null)}
        />
      )}
    </div>
  );
}
