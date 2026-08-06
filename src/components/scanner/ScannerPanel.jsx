import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { readBinderPagePhoto, scanBinderPage } from '../../lib/scanner.js';
import { searchScryfall, searchPokemon, searchYugioh } from '../../lib/cardSearch.js';
import { normalizeCard, channelDefaultsForLocation } from '../../lib/cardUtils.js';
import LocationPicker from '../LocationPicker.jsx';

const GAMES = ["Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece", "Sports Singles", "SWU", "Riftbound", "Other"];
let nextRowId = 1;

function detectedToRow(card) {
  return {
    id: nextRowId++,
    position: card.position || '',
    name: card.name || '',
    game: GAMES.includes(card.game) ? card.game : 'Other',
    set: card.set || '',
    printing: card.foil ? 'Foil' : '',
    confidence: card.confidence || 'medium',
    qty: 1,
    price: '',
    condition: '',
    imageUrl: '',
    imageStatus: 'searching', // 'searching' | 'found' | 'none'
    imageCandidates: [],
    showCandidates: false,
  };
}

// Full candidate list, not just the top pick — reused both for the automatic
// pre-fill right after a scan and for a manual re-search (e.g. after staff
// corrects a name/game the scan got wrong).
async function findImageCandidates(name, game) {
  if (!name) return [];
  try {
    if (game === 'Magic') return await searchScryfall(name);
    if (game === 'Pokemon') return await searchPokemon(name);
    if (game === 'Yugioh') return await searchYugioh(name);
    return [];
  } catch {
    return [];
  }
}

export default function ScannerPanel({ catalog, locations, onImport }) {
  const { toast } = useUI();
  const fileInputRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState(null);
  const [location, setLocation] = useState(locations[0] || '');
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState({ posChannel: true, tcgplayerChannel: true, collectrChannel: true });
  const [channelsTouched, setChannelsTouched] = useState(false);

  // One scan is one binder page, i.e. one location for the whole batch — so
  // just like the Edit modal, follow whatever channels that binder/case
  // already uses until staff manually override it for this batch.
  useEffect(() => {
    if (channelsTouched) return;
    setChannels(channelDefaultsForLocation(catalog, location.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  function setChannel(key, val) {
    setChannelsTouched(true);
    setChannels(c => ({ ...c, [key]: val }));
  }

  async function handlePhotoSelected(file) {
    if (!file) return;
    try {
      const dataUrl = await readBinderPagePhoto(file);
      setPhoto(dataUrl);
      setRows(null);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function handleScan() {
    if (!photo || scanning) return; // guards a rapid double-tap firing this twice
    setScanning(true);
    try {
      const detected = await scanBinderPage(photo);
      if (!detected.length) {
        toast("No cards detected — try a clearer, more evenly-lit photo.", true);
        setRows([]);
        setScanning(false);
        return;
      }
      const newRows = detected.map(detectedToRow);
      setRows(newRows);
      setScanning(false);
      // Pre-fill an image guess per row, independently, without blocking the
      // review queue from showing up immediately.
      newRows.forEach(async (row) => {
        const results = await findImageCandidates(row.name, row.game);
        setRows(prev => prev && prev.map(r => r.id === row.id
          ? { ...r, imageUrl: results[0]?.url || '', imageStatus: results.length ? 'found' : 'none', imageCandidates: results }
          : r));
      });
    } catch (err) {
      toast("Scan failed: " + err.message, true);
      setScanning(false);
    }
  }

  function updateRow(id, patch) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  async function refreshImageForRow(id) {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    updateRow(id, { imageStatus: 'searching', showCandidates: true });
    const results = await findImageCandidates(row.name, row.game);
    updateRow(id, {
      imageCandidates: results,
      imageUrl: results[0]?.url || row.imageUrl,
      imageStatus: results.length ? 'found' : 'none',
    });
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function addBlankRow() {
    setRows(prev => [...(prev || []), { ...detectedToRow({ confidence: 'high' }), imageStatus: 'none' }]);
  }

  async function handleConfirm() {
    if (!rows || !rows.length) return;
    const batchLocation = location.trim();
    const newCards = rows.map((r, i) => normalizeCard({
      sku: 'scan-' + Date.now() + '-' + i,
      name: r.name,
      game: r.game,
      set: r.set,
      condition: r.condition,
      printing: r.printing,
      qty: r.qty,
      price: r.price,
      location: batchLocation,
      imageUrl: r.imageUrl,
      lastUpdated: Date.now(),
      posChannel: channels.posChannel,
      tcgplayerChannel: channels.tcgplayerChannel,
      collectrChannel: channels.collectrChannel,
    }));
    setSaving(true);
    await onImport(newCards, 'merge');
    setSaving(false);
    toast(`Added ${newCards.length} item(s) from this page`);
    setPhoto(null);
    setRows(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        <div className="section-label">Scan a binder page</div>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginBottom: '12px' }}>
          Take or upload a photo of one full binder page. Every card gets identified automatically —
          review and correct the results below before anything is added to the catalog. Condition and
          price aren't guessed; fill those in yourself once you have the cards in hand.
        </div>
        <div
          className="drop"
          onClick={() => { if (!scanning) fileInputRef.current.click(); }}
        >
          {photo ? (
            <img src={photo} style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '8px' }} />
          ) : (
            <>
              <span className="mark">Take or choose a photo of a binder page</span>
              One page at a time works best — a full 9-pocket page in even light.
            </>
          )}
        </div>
        <input
          type="file" ref={fileInputRef} accept="image/*" capture="environment" style={{ display: 'none' }}
          disabled={scanning}
          onChange={(e) => handlePhotoSelected(e.target.files[0])}
        />
        {photo && !rows && (
          <div style={{ marginTop: '10px' }}>
            <button className="btn" disabled={scanning} onClick={handleScan}>
              {scanning ? 'Scanning…' : 'Scan this page'}
            </button>
            {scanning && (
              <div className="status-line" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" />
                Reading the page — this can take several seconds…
              </div>
            )}
          </div>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="card card-pad">
          <div className="section-label">Review before adding ({rows.length})</div>
          <div className="field-group" style={{ maxWidth: '420px' }}>
            <label>Binder / case / collection for this page</label>
            <LocationPicker locations={locations} value={location} onChange={setLocation} />
          </div>
          <div className="field-group" style={{ maxWidth: '420px' }}>
            <label>Where do these live?</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="s_posChannel" checked={channels.posChannel} onChange={(e) => setChannel('posChannel', e.target.checked)} />
                <label htmlFor="s_posChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>In-store / POS</label>
              </div>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="s_tcgplayerChannel" checked={channels.tcgplayerChannel} onChange={(e) => setChannel('tcgplayerChannel', e.target.checked)} />
                <label htmlFor="s_tcgplayerChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>TCG Player</label>
              </div>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="s_collectrChannel" checked={channels.collectrChannel} onChange={(e) => setChannel('collectrChannel', e.target.checked)} />
                <label htmlFor="s_collectrChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Collectr</label>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginTop: '4px' }}>
              Applies to every card added from this page — edit an individual item afterward if one differs.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rows.map(row => (
              <ScanRow
                key={row.id}
                row={row}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
                onFindImage={() => refreshImageForRow(row.id)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', alignItems: 'center' }}>
            <button className="btn secondary small" onClick={addBlankRow}>+ Add missed card</button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={saving} onClick={handleConfirm}>
              {saving ? 'Adding…' : `Add ${rows.length} item(s) to catalog`}
            </button>
          </div>
        </div>
      )}
      {rows && rows.length === 0 && (
        <div className="empty"><span className="mark">Nothing detected</span>Try a clearer or better-lit photo.</div>
      )}
    </div>
  );
}

function ScanRow({ row, onChange, onRemove, onFindImage }) {
  return (
    <div className="scan-row">
      <div className="scan-row-thumb-col">
        <div className="scan-row-thumb">
          {row.imageStatus === 'searching' && <span style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>…</span>}
          {row.imageStatus === 'found' && row.imageUrl && <img src={row.imageUrl} />}
          {row.imageStatus === 'none' && <span style={{ fontSize: '9px', color: 'var(--ink-faint)', textAlign: 'center' }}>{row.game}</span>}
        </div>
        <button className="btn ghost small" style={{ fontSize: '10.5px', padding: '2px 6px' }} onClick={onFindImage}>Find image</button>
      </div>

      <div className="scan-row-fields">
        <div className="scan-row-line">
          <input type="text" placeholder="Card name" style={{ flex: 2 }} value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
          <select style={{ flex: 1 }} value={row.game} onChange={(e) => onChange({ game: e.target.value })}>
            {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input type="text" placeholder="Set" style={{ flex: 1 }} value={row.set} onChange={(e) => onChange({ set: e.target.value })} />
        </div>
        <div className="scan-row-line">
          <input type="text" placeholder="Condition" style={{ flex: 1 }} value={row.condition} onChange={(e) => onChange({ condition: e.target.value })} />
          <input type="number" placeholder="Price" step="0.01" style={{ flex: 1 }} value={row.price} onChange={(e) => onChange({ price: e.target.value })} />
          <span className={`badge confidence-${row.confidence}`} title="How confident the scan was about this card" style={{ flex: '0 0 auto', alignSelf: 'center' }}>
            {row.confidence}
          </span>
          <button className="icon-btn" title="Remove" style={{ flex: '0 0 auto' }} onClick={onRemove}>✕</button>
        </div>
        {row.showCandidates && row.imageCandidates.length > 0 && (
          <div className="img-candidates">
            {row.imageCandidates.map((c, i) => (
              <img key={i} src={c.url} title={c.label} onClick={() => onChange({ imageUrl: c.url, imageStatus: 'found', showCandidates: false })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
