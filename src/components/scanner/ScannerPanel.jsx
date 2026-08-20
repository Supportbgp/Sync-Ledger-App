import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { readBinderPagePhoto, scanBinderPage } from '../../lib/scanner.js';
import { searchCardImage } from '../../lib/cardSearch.js';
import { normalizeCard, channelDefaultsForLocation, marketValueForCondition, canonicalizeCondition, RARITY_OPTIONS_BY_GAME } from '../../lib/cardUtils.js';
import { cropImageRegion } from '../../lib/image.js';
import { runWithConcurrency } from '../../lib/importParse.js';
import LocationPicker from '../LocationPicker.jsx';

const GAMES = ["Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece", "Sports Singles", "SWU", "Riftbound", "Gundam", "Other"];
let nextRowId = 1;

// Same reasoning as EditModal's HIGH_VALUE_THRESHOLD — a flat condition
// percentage is a population average, not this specific card's real going
// rate, and the dollar error grows with the card's price. Batches make this
// worse, not better — the same misestimate repeats across every copy.
const HIGH_VALUE_THRESHOLD = 25;

function detectedToRow(card) {
  return {
    id: nextRowId++,
    position: card.position || '',
    name: card.name || '',
    game: GAMES.includes(card.game) ? card.game : 'Other',
    set: card.set || '',
    // Best-guess only — the vision model isn't always right about it, same
    // as name/game/set, which is why it's a plain editable field here too.
    // Used purely to narrow the image search (see findImageCandidates);
    // never saved to the catalog. number is the strongest of the two
    // signals (a printed collector number narrows a same-name/alt-art card
    // to essentially one exact print), currently only acted on for Pokemon
    // — see searchPokemon in cardSearch.js.
    rarity: card.rarity || '',
    number: card.number || '',
    printing: card.foil ? 'Foil' : '',
    confidence: card.confidence || 'medium',
    qty: 1,
    price: '',
    // basePrice/listingUrl are what the Pricing section actually reads —
    // stay null until "Find market price" explicitly reveals them.
    // pendingPrice/pendingListingUrl silently track whichever candidate is
    // backing imageUrl right now (auto-picked or manually chosen), so
    // "Find market price" can reveal them with no extra search — the data
    // was already fetched alongside the image.
    basePrice: null,
    listingUrl: '',
    pendingPrice: null,
    pendingListingUrl: '',
    condition: '',
    imageUrl: '',
    imageStatus: 'searching', // 'searching' | 'found' | 'none'
    imageCandidates: [],
    showCandidates: false,
    // The "real photo" slot — a crop of this exact card out of the full
    // binder-page photo, made from the vision model's bbox for this card
    // (see cropImageRegion). Stays blank for manually added rows, or if the
    // model didn't return a usable bbox.
    photoUrl: '',
    photoData: '',
    // Same stock/photo preference toggle as EditModal's dual-image model —
    // defaults to the crop (matches resolveActiveImage's default), but
    // picking a stock candidate below switches it to 'stock' so the pick is
    // actually visible instead of silently staying hidden behind the crop.
    activeImage: 'photo',
  };
}

// Full candidate list, not just the top pick — reused both for the automatic
// pre-fill right after a scan and for a manual re-search (e.g. after staff
// corrects a name/game the scan got wrong). rarityHint is best-effort only
// (see searchCardImage) — it re-sorts matches that report their own rarity,
// it never excludes anything, so a wrong/unrecognized guess can't zero out
// the results.
async function findImageCandidates(name, game, set, rarityHint, numberHint) {
  if (!name) return [];
  try {
    return (await searchCardImage(game, name, set, rarityHint, numberHint)) || [];
  } catch {
    return [];
  }
}

export default function ScannerPanel({ catalog, locations, onImport, multipliers }) {
  const { toast } = useUI();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
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
      const newRows = await Promise.all(detected.map(async (card) => {
        const row = detectedToRow(card);
        // Crop this card's own real photo out of the full page image using
        // the vision model's bounding box — no second upload needed. If the
        // model omitted a usable bbox (or the crop math fails on a bad one),
        // leave the photo slot blank; the stock image search below still
        // gives the row something to show.
        if (card.bbox) {
          try {
            row.photoData = await cropImageRegion(photo, card.bbox);
            row.photoUrl = 'local';
          } catch { /* leave photo slot blank */ }
        }
        return row;
      }));
      setRows(newRows);
      setScanning(false);
      // Pre-fill an image guess per row, independently, without blocking the
      // review queue from showing up immediately. Auto-places the image
      // (unchanged), and quietly remembers that candidate's price/listing
      // as "pending" — Market Value stays hidden until "Find market price"
      // explicitly reveals it, since that's money-relevant and shouldn't
      // come from an unconfirmed top search result.
      // Capped concurrency, not one request burst per card — a full 9-card
      // page firing unbounded parallel searches (each up to 4 fallback
      // queries for Pokemon) can hit 30+ simultaneous requests against
      // pokemontcg.io's key-less tier, which is prone to rate-limiting/5xx
      // under exactly that kind of burst (same reasoning as CSV import's
      // runWithConcurrency cap, reused here).
      runWithConcurrency(newRows, 3, async (row) => {
        const results = await findImageCandidates(row.name, row.game, row.set, row.rarity, row.number);
        setRows(prev => prev && prev.map(r => r.id === row.id
          ? {
            ...r, imageUrl: results[0]?.url || '', imageStatus: results.length ? 'found' : 'none', imageCandidates: results,
            pendingPrice: results[0]?.price ?? null, pendingListingUrl: results[0]?.listingUrl || '',
          }
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

  // Searches for alternative prints/art using whatever name/set/game staff
  // have already corrected, and shows the candidate grid so they can pick a
  // different one — image only. Picking a candidate updates the pending
  // price/listing behind the scenes (see the click handler in ScanRow) but
  // doesn't reveal it; that's "Find market price" below.
  async function findAnotherImageForRow(id) {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    updateRow(id, { imageStatus: 'searching', showCandidates: true });
    const results = await findImageCandidates(row.name, row.game, row.set, row.rarity, row.number);
    updateRow(id, {
      imageCandidates: results,
      imageUrl: results[0]?.url || row.imageUrl,
      imageStatus: results.length ? 'found' : 'none',
      pendingPrice: results[0]?.price ?? row.pendingPrice,
      pendingListingUrl: results[0]?.listingUrl || row.pendingListingUrl,
      // Otherwise the top match here would silently never show if the row
      // already had a photo crop — same reasoning as EditModal's
      // selectCandidate switching the toggle when a stock pick is made.
      activeImage: results.length ? 'stock' : row.activeImage,
    });
    if (!results.length) toast(`No matches found for "${row.name || 'this card'}" — check the name/set.`, true);
  }

  // No search — the price/listing for whatever's currently shown as the
  // image was already fetched alongside it (auto-pick or a manual pick from
  // "Find another image"). This just reveals it, on the explicit assumption
  // staff have now looked at the image and confirmed it's the right card.
  function findMarketPriceForRow(id) {
    const row = rows.find(r => r.id === id);
    if (!row) return;
    if (row.pendingPrice == null) {
      toast(`No market price available for "${row.name || 'this card'}" — this game/print may not have price data, or try Find another image first.`, true);
      return;
    }
    updateRow(id, { basePrice: row.pendingPrice, listingUrl: row.pendingListingUrl });
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
      basePrice: r.basePrice,
      sourceUrl: r.listingUrl,
      location: batchLocation,
      imageUrl: r.imageUrl,
      photoUrl: r.photoUrl,
      photoData: r.photoData,
      activeImage: r.activeImage,
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
              <span className="mark">Choose a photo of a binder page</span>
              One page at a time works best — a full 9-pocket page in even light. Or use the camera button below.
            </>
          )}
        </div>
        {/* Two separate inputs instead of one relying on the OS's default
            file-picker chooser to offer both options — that chooser's exact
            behavior (whether "Take Photo" even shows up) varies enough across
            mobile browsers/OS versions that staff on some phones only ever
            saw a plain file picker with no camera option. capture="environment"
            here guarantees a real camera launch regardless of that. */}
        <input
          type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }}
          disabled={scanning}
          onChange={(e) => handlePhotoSelected(e.target.files[0])}
        />
        <input
          type="file" ref={cameraInputRef} accept="image/*" capture="environment" style={{ display: 'none' }}
          disabled={scanning}
          onChange={(e) => handlePhotoSelected(e.target.files[0])}
        />
        <button
          type="button" className="btn secondary small" disabled={scanning}
          style={{ marginTop: '10px' }}
          onClick={() => cameraInputRef.current.click()}
        >
          Take a photo
        </button>
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
            <LocationPicker locations={locations} value={location} onChange={setLocation} ariaLabel="Binder / case / collection for this page" />
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
                multipliers={multipliers}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
                onFindAnotherImage={() => findAnotherImageForRow(row.id)}
                onFindMarketPrice={() => findMarketPriceForRow(row.id)}
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

function ScanRow({ row, multipliers, onChange, onRemove, onFindAnotherImage, onFindMarketPrice }) {
  const { openLightbox } = useUI();
  const conditionTier = canonicalizeCondition(row.condition);
  const conditionPct = conditionTier === "NM" ? 100 : (conditionTier && multipliers && multipliers[conditionTier]);
  const marketValue = marketValueForCondition(row.basePrice, row.condition, multipliers);
  // Same dual-image model as EditModal — stock candidate vs. the crop of
  // this exact copy — with the same fallback rule when only one exists.
  const stockSrc = row.imageStatus === 'found' ? row.imageUrl : null;
  const photoSrc = row.photoData || null;
  const displaySrc = row.activeImage === 'stock' ? (stockSrc || photoSrc) : (photoSrc || stockSrc);
  const canZoom = !!displaySrc;
  return (
    <div className="scan-row">
      <div className="scan-row-thumb-col">
        <div
          className="scan-row-thumb"
          onClick={() => { if (canZoom) openLightbox(displaySrc); }}
          style={{ cursor: canZoom ? 'pointer' : 'default' }}
          title={canZoom ? 'Click to zoom' : ''}
        >
          {displaySrc ? (
            <img src={displaySrc} />
          ) : row.imageStatus === 'searching' ? (
            <span style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>…</span>
          ) : (
            <span style={{ fontSize: '9px', color: 'var(--ink-faint)', textAlign: 'center' }}>{row.game}</span>
          )}
        </div>
        {stockSrc && photoSrc ? (
          <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
            <button
              type="button" className={`btn small${row.activeImage === 'photo' ? '' : ' ghost'}`}
              style={{ fontSize: '10px', padding: '2px 5px' }}
              onClick={(e) => { e.stopPropagation(); onChange({ activeImage: 'photo' }); }}
            >Photo</button>
            <button
              type="button" className={`btn small${row.activeImage === 'stock' ? '' : ' ghost'}`}
              style={{ fontSize: '10px', padding: '2px 5px' }}
              onClick={(e) => { e.stopPropagation(); onChange({ activeImage: 'stock' }); }}
            >Stock</button>
          </div>
        ) : photoSrc ? (
          <div style={{ fontSize: '9px', color: 'var(--ink-faint)', textAlign: 'center' }}>real photo</div>
        ) : null}
        <button className="btn ghost small" style={{ fontSize: '10.5px', padding: '2px 6px' }} onClick={onFindAnotherImage}>Find another image</button>
        {row.basePrice == null && (
          <button className="btn ghost small" style={{ fontSize: '10.5px', padding: '2px 6px', marginTop: '4px' }} onClick={onFindMarketPrice}>Find market price</button>
        )}
      </div>

      <div className="scan-row-fields">
        <div className="scan-row-line">
          <input type="text" placeholder="Card name" className="sf-wide" value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
          <select className="sf" value={row.game} onChange={(e) => onChange({ game: e.target.value })}>
            {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input type="text" placeholder="Set" className="sf" value={row.set} onChange={(e) => onChange({ set: e.target.value })} />
          <input
            type="text" placeholder="Number" className="sf" value={row.number}
            title="Optional — the printed collector number (e.g. 280/217). The strongest signal for telling apart same-name/alt-art prints; currently only used to narrow Pokemon search"
            onChange={(e) => onChange({ number: e.target.value })}
          />
          <input
            type="text" list={`rarity-options-${row.id}`} placeholder="Rarity" className="sf" value={row.rarity}
            title="Optional — narrows the image search, same as Set, for cards that reprint the same name/set at different rarities. Pick a suggestion or type your own."
            onChange={(e) => onChange({ rarity: e.target.value })}
          />
          {/* Per-row id — a page scans several cards at once, so a shared
              static datalist id would collide across rows. */}
          <datalist id={`rarity-options-${row.id}`}>
            {(RARITY_OPTIONS_BY_GAME[row.game] || []).map(r => <option key={r} value={r} />)}
          </datalist>
        </div>
        <div className="scan-row-line">
          <input type="text" placeholder="Condition" className="sf" value={row.condition} onChange={(e) => onChange({ condition: e.target.value })} />
          <input type="number" placeholder="Price" step="0.01" className="sf" value={row.price} onChange={(e) => onChange({ price: e.target.value })} />
          <span className={`badge confidence-${row.confidence} sf-auto`} title="How confident the scan was about this card" style={{ alignSelf: 'center' }}>
            {row.confidence}
          </span>
          <button className="icon-btn sf-auto" title="Remove" onClick={onRemove}>✕</button>
        </div>
        {row.basePrice != null && (
          <div className="scan-row-line" style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>
            NM ${Number(row.basePrice).toFixed(2)}
            {' · '}
            {conditionPct != null ? `${conditionTier} ${conditionPct}%` : 'set a condition'}
            {' · '}
            {marketValue != null ? (
              <>
                Market value ${marketValue.toFixed(2)}
                <button type="button" className="btn ghost small" style={{ marginLeft: '8px' }} onClick={() => onChange({ price: marketValue })}>Use this</button>
              </>
            ) : 'market value —'}
            {row.listingUrl && (
              <span style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 600, marginLeft: '8px' }} onClick={() => window.open(row.listingUrl, '_blank')}>
                Check live TCGPlayer listing ↗
              </span>
            )}
          </div>
        )}
        {Number(row.basePrice) >= HIGH_VALUE_THRESHOLD && (
          <div className="scan-row-line" style={{ fontSize: '11.5px', color: 'var(--rust)' }}>
            Market value above is an estimate (NM price × a flat condition %), not real per-condition sales
            data — on a ${HIGH_VALUE_THRESHOLD}+ card that gap can be real money.
            {!row.listingUrl && " Worth checking the real current listing before pricing it, especially in a batch."}
          </div>
        )}
        {row.showCandidates && row.imageCandidates.length > 0 && (
          <div className="img-candidates">
            {row.imageCandidates.map((c, i) => (
              <img
                key={i} src={c.url} title={c.label}
                onClick={() => onChange({
                  imageUrl: c.url, imageStatus: 'found', showCandidates: false,
                  pendingPrice: c.price ?? null, pendingListingUrl: c.listingUrl || '',
                  // Clear any already-revealed price — it belonged to the
                  // previous image and would be misleading attached to this
                  // one. Find market price re-reveals it for the new pick.
                  basePrice: null, listingUrl: '',
                  // See findAnotherImageForRow — otherwise this pick could
                  // silently stay invisible behind an existing photo crop.
                  activeImage: 'stock',
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
