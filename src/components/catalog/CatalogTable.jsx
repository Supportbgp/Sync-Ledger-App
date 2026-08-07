import { useUI } from '../../context/UIContext.jsx';
import { timeAgo, activeImageSrc } from '../../lib/cardUtils.js';

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

function Thumb({ card, onZoom }) {
  const src = activeImageSrc(card);
  if (!src) return <div className="thumb-placeholder">—</div>;
  return (
    <div className="img-frame" onClick={(e) => { e.stopPropagation(); onZoom(src); }}>
      <img className="thumb" src={src} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
}

export default function CatalogTable({
  catalogEmpty, rows, sortState, onSort,
  selectedSkus, onToggleSelected, onToggleSelectAll,
  onEdit, onSell, onTogglePlatformStatus,
}) {
  const { openLightbox } = useUI();

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

  return (
    <>
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
            const qtyClass = c.qty <= 0 ? "qty-zero" : (c.qty <= 2 ? "qty-low" : "");
            const isSold = c.sold || c.qty <= 0;
            const sub = [c.set, c.condition, c.printing].filter(Boolean).join(" · ") +
              (c.itemType === "slab" && (c.grader || c.grade) ? (` · ${c.grader || ""} ${c.grade || ""}`).trim() : "");
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
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon-btn" title="Edit" onClick={() => onEdit(c.sku)}>Edit</button>
                  <button className="btn small" disabled={c.qty <= 0 || isSold} onClick={() => onSell(c.sku)}>Sell</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 400 && (
        <div style={{ padding: '10px', fontSize: '12px', color: 'var(--ink-soft)' }}>
          Showing first 400 of {rows.length} matches — narrow your search to see more.
        </div>
      )}
    </>
  );
}
