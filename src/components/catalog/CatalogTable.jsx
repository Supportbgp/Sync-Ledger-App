import { useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { timeAgo, activeImageSrc, GAME_TAG_CLASS } from '../../lib/cardUtils.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

const COLUMNS = [
  { key: 'name', label: 'Item' },
  { key: 'sku', label: 'SKU' },
  { key: 'qty', label: 'Qty' },
  { key: 'price', label: 'Price' },
  { key: 'updated', label: 'Updated' },
];

const PLATFORM_CHIPS = [
  { field: 'posSynced', channel: 'posChannel', label: 'P', title: 'POS' },
  { field: 'tcgplayerSynced', channel: 'tcgplayerChannel', label: 'T', title: 'TCG Player' },
  { field: 'collectrSynced', channel: 'collectrChannel', label: 'C', title: 'Collectr' },
];

function PlatformStatus({ card, onToggle }) {
  const applicable = PLATFORM_CHIPS.filter(chip => card[chip.channel]);
  if (!applicable.length) {
    return <span className="platform-status-none">In-store only</span>;
  }
  return (
    <div className="platform-status">
      {applicable.map(chip => (
        <span
          key={chip.field}
          className={`platform-chip${card[chip.field] ? ' done' : ''}`}
          title={`${chip.title} — ${card[chip.field] ? 'up to date' : 'needs updating'}`}
          onClick={(e) => { e.stopPropagation(); onToggle(card.sku, chip.field); }}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function Thumb({ card, onZoom, size }) {
  const src = activeImageSrc(card);
  const sizeClass = size === 'sm' ? ' thumb-sm' : '';
  if (!src) return <div className={`thumb-placeholder${sizeClass}`}>—</div>;
  return (
    <div className="img-frame" onClick={(e) => { e.stopPropagation(); onZoom(src); }}>
      <img className={`thumb${sizeClass}`} src={src} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
}

// Derived display fields shared by the desktop table and the mobile card
// list, so the two layouts can never quietly disagree on what "sold" or the
// subtitle line means.
function deriveRow(c) {
  // Built as a list of only-truthy parts and joined once, rather than
  // string-concatenating a separator onto whatever the first join produced —
  // that concatenation left a stray leading " · " whenever set/condition/
  // printing were ALL blank on a slab that only had grader/grade filled in.
  const subParts = [c.set, c.condition, c.printing].filter(Boolean);
  if (c.itemType === "slab") {
    const gradeText = [c.grader, c.grade].filter(Boolean).join(" ");
    if (gradeText) subParts.push(gradeText);
  }
  return {
    qtyClass: c.qty <= 0 ? "qty-zero" : (c.qty <= 2 ? "qty-low" : ""),
    isSold: c.sold || c.qty <= 0,
    sub: subParts.join(" · "),
    tagClass: GAME_TAG_CLASS[c.game] || "tag-neutral",
  };
}

function RowActions({ card, isSold, onEdit, onSell }) {
  return (
    <div className="row-actions">
      <button className="btn secondary small" onClick={() => onEdit(card.sku)}>Edit</button>
      <button className="btn small" disabled={card.qty <= 0 || isSold} onClick={() => onSell(card.sku)}>Sell</button>
    </div>
  );
}

export default function CatalogTable({
  catalogEmpty, rows, sortState, onSort,
  selectedSkus, onToggleSelected, onToggleSelectAll,
  onEdit, onSell, onTogglePlatformStatus,
}) {
  const { openLightbox } = useUI();
  const isMobile = useIsMobile();
  const [expandedSkus, setExpandedSkus] = useState(() => new Set());

  if (catalogEmpty) {
    return (
      <div className="empty">
        <span className="mark">No catalog yet</span>
        Import your Sheets CSV/XLSX or click "+ Add item" to get started.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="empty">
        <span className="mark">No matches</span>
        Try a different search or filter.
      </div>
    );
  }

  const visibleSkus = rows.map(r => r.sku);
  const allVisibleSelected = visibleSkus.length > 0 && visibleSkus.every(s => selectedSkus.has(s));
  const visibleRows = rows.slice(0, 400);

  function toggleExpanded(sku) {
    setExpandedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }

  if (isMobile) {
    return (
      <>
        <div className="catalog-cards-selectall">
          <label className="checkbox-row" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(e) => onToggleSelectAll(visibleSkus, e.target.checked)}
            />
            <span style={{ fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Select all visible</span>
          </label>
        </div>
        <div className="catalog-cards">
          {visibleRows.map(c => {
            const { qtyClass, isSold, sub, tagClass } = deriveRow(c);
            const isChecked = selectedSkus.has(c.sku);
            const isExpanded = expandedSkus.has(c.sku);
            return (
              <div key={c.sku} className={`catalog-card${isSold ? ' sold-row' : ''}${isChecked ? ' row-selected' : ''}`}>
                <div className="catalog-card-head" onClick={() => toggleExpanded(c.sku)}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleSelected(c.sku, e.target.checked)}
                  />
                  <Thumb card={c} onZoom={openLightbox} size="sm" />
                  <div className="catalog-card-main">
                    <div className="n-name">
                      {c.name}
                      {isSold && <span className="badge sold">Sold</span>}
                    </div>
                    <div className="catalog-card-row2">
                      <span className={`badge ${tagClass}`}>{c.game}</span>
                      <span className={`mono ${qtyClass}`}>Qty {c.qty}</span>
                      <span className="mono">{c.price !== null ? "$" + Number(c.price).toFixed(2) : "—"}</span>
                    </div>
                  </div>
                  <span className="catalog-card-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div className="catalog-card-details">
                    <div className="n-sub">{sub || '—'}</div>
                    <div className="catalog-card-row2" style={{ marginTop: '6px' }}>
                      {c.itemType === "slab" && <span className="badge slab">Slab</span>}
                      {c.location && <span className="badge location" title="Binder / case">{c.location}</span>}
                      {c.sourceUrl && (
                        <a href={c.sourceUrl} target="_blank" rel="noopener" className="notes-pin" title="Open source link">link</a>
                      )}
                      {c.notes && <span className="notes-pin" title={c.notes}>note</span>}
                    </div>
                    <div className="catalog-card-row2" style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--ink-soft)' }}>
                      <span className="mono">{c.sku || "no SKU"}</span>
                      <span>Updated {timeAgo(c.lastUpdated)}</span>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <PlatformStatus card={c} onToggle={onTogglePlatformStatus} />
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <RowActions card={c} isSold={isSold} onEdit={onEdit} onSell={onSell} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {rows.length > 400 && (
          <div style={{ padding: '10px', fontSize: '12px', color: 'var(--ink-soft)' }}>
            Showing first 400 of {rows.length} matches — narrow your search to see more.
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => onToggleSelectAll(visibleSkus, e.target.checked)}
                />
              </th>
              <th></th>
              {COLUMNS.map(col => (
                <th key={col.key} className="sortable" onClick={() => onSort(col.key)}>
                  {col.label}
                  {sortState.col === col.key ? (sortState.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th title="POS / TCG Player / Collectr — reminders to update each platform's listing">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(c => {
              const { qtyClass, isSold, sub, tagClass } = deriveRow(c);
              const isChecked = selectedSkus.has(c.sku);
              return (
                <tr key={c.sku} className={`${isSold ? 'sold-row' : ''} ${isChecked ? 'row-selected' : ''}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onToggleSelected(c.sku, e.target.checked)}
                    />
                  </td>
                  <td><Thumb card={c} onZoom={openLightbox} /></td>
                  <td className="name-cell">
                    <div className="n-name">
                      {c.name}
                      <span className={`badge ${tagClass}`}>{c.game}</span>
                      {c.itemType === "slab" && <span className="badge slab">Slab</span>}
                      {isSold && <span className="badge sold">Sold</span>}
                      {c.notes && <span className="notes-pin" title={c.notes}>note</span>}
                      {c.sourceUrl && (
                        <a href={c.sourceUrl} target="_blank" rel="noopener" className="notes-pin" title="Open source link" onClick={(e) => e.stopPropagation()}>link</a>
                      )}
                      {c.location && <span className="badge location" title="Binder / case">{c.location}</span>}
                    </div>
                    <div className="n-sub">{sub}</div>
                  </td>
                  <td className="mono">{c.sku || ""}</td>
                  <td className={`mono ${qtyClass}`}>{c.qty}</td>
                  <td className="mono">{c.price !== null ? "$" + Number(c.price).toFixed(2) : "—"}</td>
                  <td className="mono" style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>{timeAgo(c.lastUpdated)}</td>
                  <td><PlatformStatus card={c} onToggle={onTogglePlatformStatus} /></td>
                  <td><RowActions card={c} isSold={isSold} onEdit={onEdit} onSell={onSell} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 400 && (
        <div style={{ padding: '10px', fontSize: '12px', color: 'var(--ink-soft)' }}>
          Showing first 400 of {rows.length} matches — narrow your search to see more.
        </div>
      )}
    </>
  );
}
