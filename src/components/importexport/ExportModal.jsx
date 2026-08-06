import { useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { downloadCsv } from '../../lib/csv.js';
import {
  EXPORT_FORMATS, buildFullCatalogRows, buildTcgPlayerEntryRows, buildCollectrEntryRows,
  buildPendingPosRows, buildSyncHistoryRows,
} from '../../lib/exportFormats.js';

const FILENAMES = {
  fullCatalog: 'ledger_full_catalog.csv',
  tcgplayer: 'tcgplayer_entry_list.csv',
  collectr: 'collectr_entry_list.csv',
  pendingPos: 'pos_pending_update.csv',
  syncHistory: 'ledger_sync_history.csv',
};

export default function ExportModal({ catalog, queue, locations, onClose }) {
  const { toast } = useUI();
  const [format, setFormat] = useState('fullCatalog');
  const [scope, setScope] = useState('full');
  const [location, setLocation] = useState(locations[0] || '');

  const formatDef = EXPORT_FORMATS.find(f => f.key === format);

  function handleExport() {
    let rows;
    if (formatDef.scoped) {
      let items = scope === 'location' ? catalog.filter(c => c.location === location) : catalog;
      // Only items actually meant to be listed on that platform — an
      // in-store-only card has no business on a TCG Player/Collectr list.
      if (format === 'tcgplayer') items = items.filter(c => c.tcgplayerChannel);
      else if (format === 'collectr') items = items.filter(c => c.collectrChannel);
      if (!items.length) { toast(scope === 'location' ? "No items in that binder/case" : "Catalog is empty", true); return; }
      if (format === 'fullCatalog') rows = buildFullCatalogRows(items);
      else if (format === 'tcgplayer') rows = buildTcgPlayerEntryRows(items);
      else rows = buildCollectrEntryRows(items);
    } else {
      if (!queue.length) { toast("No sync history yet", true); return; }
      const scopedQueue = format === 'pendingPos' ? queue.filter(t => t.posChannel) : queue;
      rows = format === 'pendingPos' ? buildPendingPosRows(scopedQueue) : buildSyncHistoryRows(scopedQueue);
      if (format === 'pendingPos' && !rows.length) { toast("Nothing pending for POS", false); return; }
    }
    downloadCsv(FILENAMES[format], rows);
    toast(`Exported ${rows.length} row(s)`);
    onClose();
  }

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">Export</div>
          <div className="meta">
            TCG Player and Collectr don't support bulk-creating new listings from a file — these are clean
            reference lists to speed up manual entry, not one-click uploads.
          </div>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {EXPORT_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          {formatDef.scoped && (
            <div className="field-group">
              <label>Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="full">Full catalog</option>
                <option value="location">One binder / case</option>
              </select>
              {scope === 'location' && (
                <select style={{ marginTop: '8px', width: '100%' }} value={location} onChange={(e) => setLocation(e.target.value)}>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" onClick={handleExport}>Export</button>
        </div>
      </div>
    </div>
  );
}
