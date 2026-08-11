import { useEffect, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { normalizeCard, channelDefaultsForLocation, marketValueForCondition, canonicalizeCondition } from '../../lib/cardUtils.js';
import { searchCardImage as searchByGame } from '../../lib/cardSearch.js';
import { resizeImageFile } from '../../lib/image.js';
import { backdropClose } from '../../lib/modalDismiss.js';
import LocationPicker from '../LocationPicker.jsx';

const GAMES = ["Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece", "Sports Singles", "SWU", "Riftbound", "Gundam", "Other"];

// A flat condition percentage is a population average, not this specific
// card's real going rate — the higher the NM price, the bigger the dollar
// swing a bad guess costs (a $2 common being off by 20% is nothing; a
// $130+ chase card being off by 20% is real money, especially in batches).
// Above this, nudge staff to check the actual listing instead of trusting
// the estimate blindly.
const HIGH_VALUE_THRESHOLD = 25;
const GAME_LABELS = {
  Magic: "Magic: The Gathering", Pokemon: "Pokémon", Yugioh: "Yu-Gi-Oh!", Lorcana: "Disney Lorcana",
  "One Piece": "One Piece", "Sports Singles": "Sports Singles", SWU: "Star Wars Unlimited",
  Riftbound: "Riftbound", Gundam: "Gundam Card Game", Other: "Other",
};


function initForm(card) {
  return {
    name: card?.name || "",
    game: card?.game || "Magic",
    set: card?.set || "",
    condition: card?.condition || "",
    printing: card?.printing || "",
    sku: card?.sku || "",
    location: card?.location || "",
    isSlab: card?.itemType === "slab",
    grader: card?.grader || "",
    grade: card?.grade || "",
    cert: card?.certNumber || "",
    qty: card ? card.qty : 1,
    price: (card && card.price) ?? "",
    basePrice: (card && card.basePrice) ?? null,
    notes: card?.notes || "",
    sold: !!card?.sold,
    sourceUrl: card?.sourceUrl || "",
    posChannel: card ? card.posChannel !== false : true,
    tcgplayerChannel: card ? card.tcgplayerChannel !== false : true,
    collectrChannel: card ? card.collectrChannel !== false : true,
    activeImage: card && card.activeImage === "stock" ? "stock" : "photo",
  };
}

export default function EditModal({ card, catalog, locations, multipliers, onClose, onSave, onDelete }) {
  const { showConfirm, openLightbox } = useUI();
  const [form, setForm] = useState(() => initForm(card));
  const [channelsTouched, setChannelsTouched] = useState(false);
  // Best-guess only, same as ScannerPanel's row.rarity — never saved to the
  // catalog, purely used to narrow the image/price search below (see
  // preferRarity in cardSearch.js: a soft re-sort, never a hard filter).
  const [rarity, setRarity] = useState("");

  // For a brand-new item, follow whatever channels the same binder/case
  // already uses as the staff types the location in — until they manually
  // touch a channel checkbox themselves, at which point their choice wins.
  useEffect(() => {
    if (card || channelsTouched) return;
    const defaults = channelDefaultsForLocation(catalog, form.location.trim());
    setForm(f => ({ ...f, ...defaults }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location]);

  // Two independent image slots (Sprint 6): "stock" is the clean reference
  // image from card search/manual paste (imageUrl/imageData — unchanged from
  // before); "photo" is a real-life picture of this exact copy (photoUrl/
  // photoData — scanner crop or manual upload). Each has its own pending
  // state so working on one never disturbs the other.
  const [stockPending, setStockPending] = useState("");
  const [photoPending, setPhotoPending] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [imageStatus, setImageStatus] = useState({ text: "", kind: "" });
  const [manualUrl, setManualUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  // Which action populated `candidates` — determines what clicking one does.
  // "image": sets the stock image (and price, as a bonus, same as before).
  // "price": for old cards that already have a correct image and just need
  // Market Value backfilled — leaves both images alone entirely.
  const [candidateMode, setCandidateMode] = useState("image");

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function setChannel(key, val) {
    setChannelsTouched(true);
    set(key, val);
  }

  function pendingSrc(pending, existingUrl, existingData) {
    if (pending === "__clear__") return null;
    if (pending.indexOf("__local__:") === 0) return pending.slice("__local__:".length);
    if (pending) return pending;
    if (existingUrl && existingUrl.startsWith('http')) return existingUrl;
    if (existingUrl === 'local' && existingData) return existingData;
    return null;
  }
  const stockSrc = pendingSrc(stockPending, card && card.imageUrl, card && card.imageData);
  const photoSrc = pendingSrc(photoPending, card && card.photoUrl, card && card.photoData);
  // Preview follows the toggle, but falls back to whichever slot actually
  // has something if the preferred one is blank — same rule as
  // resolveActiveImage in cardUtils.js, just pending-state aware here.
  const src = form.activeImage === 'stock' ? (stockSrc || photoSrc) : (photoSrc || stockSrc);

  async function handleFindImage() {
    const name = form.name.trim();
    if (!name) { setImageStatus({ text: "Enter a card name first.", kind: "err" }); return; }
    setImageStatus({ text: "Searching…", kind: "" });
    setCandidates([]);
    setCandidateMode("image");
    setSearching(true);
    try {
      const results = await searchByGame(form.game, name, form.set.trim(), rarity.trim());
      if (results === null) {
        setImageStatus({ text: "Auto image lookup isn't set up for this game yet — upload a photo or paste a URL instead.", kind: "err" });
      } else if (!results.length) {
        setImageStatus({ text: "No matches found — try adjusting the name, or upload a photo.", kind: "err" });
      } else {
        setImageStatus({ text: `${results.length} result(s) — click one to use it.`, kind: "ok" });
        setCandidates(results);
      }
    } catch (e) {
      setImageStatus({ text: "Couldn't reach the card image database (network/CORS). Try uploading a photo or pasting a URL instead.", kind: "err" });
    }
    setSearching(false);
  }

  // For old cards that already have a correct image (basePrice didn't exist
  // as a field when they were added) — same search as "Find image", but
  // picking a candidate below only backfills Market Value, leaving the
  // existing image and everything else untouched.
  async function handleFindMarketPrice() {
    const name = form.name.trim();
    if (!name) { setImageStatus({ text: "Enter a card name first.", kind: "err" }); return; }
    setImageStatus({ text: "Searching…", kind: "" });
    setCandidates([]);
    setCandidateMode("price");
    setSearching(true);
    try {
      const results = await searchByGame(form.game, name, form.set.trim(), rarity.trim());
      if (results === null) {
        setImageStatus({ text: "Market price lookup isn't set up for this game yet.", kind: "err" });
      } else if (!results.length) {
        setImageStatus({ text: "No matches found — try adjusting the name.", kind: "err" });
      } else if (!results.some(r => r.price != null)) {
        setImageStatus({ text: "Matches found, but none carry price data yet for this game.", kind: "err" });
        setCandidates(results);
      } else {
        setImageStatus({ text: `${results.length} result(s) found.`, kind: "ok" });
        setCandidates(results);
      }
    } catch (e) {
      setImageStatus({ text: "Couldn't reach the card price database (network/CORS).", kind: "err" });
    }
    setSearching(false);
  }

  function selectCandidate(url, price, listingUrl) {
    if (candidateMode === "price") {
      // Deliberately leaves both images alone — this path exists specifically
      // so backfilling Market Value on an old card doesn't disturb an
      // already-correct image.
      if (price != null) set('basePrice', price);
      if (listingUrl && !form.sourceUrl.trim()) set('sourceUrl', listingUrl);
      setCandidates([]);
      return;
    }
    setStockPending(url);
    // Switch the toggle to show what was just picked — otherwise, if a real
    // photo already exists and is the current preference, the newly found
    // stock image would silently not appear anywhere.
    set('activeImage', 'stock');
    // Capture the exact print's NM price as the Market Value baseline —
    // only when the search result actually carried one, since not every
    // provider has price data yet (Egman-backed games, for one).
    if (price != null) set('basePrice', price);
    // A direct link to the real listing, auto-filled only if staff haven't
    // already put something in Source URL themselves — never overwrite a
    // manual entry.
    if (listingUrl && !form.sourceUrl.trim()) set('sourceUrl', listingUrl);
  }

  async function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 500, 0.82);
      setPhotoPending("__local__:" + dataUrl);
      // Same reasoning as selectCandidate above — show the photo staff just
      // uploaded, even if the toggle was previously set to "Stock image".
      set('activeImage', 'photo');
      setImageStatus({ text: "Photo ready — click Save to store it.", kind: "ok" });
    } catch (err) {
      setImageStatus({ text: err.message, kind: "err" });
    }
  }

  function handleManualUrlChange(e) {
    const url = e.target.value.trim();
    setManualUrl(e.target.value);
    if (!url) return;
    setStockPending(url);
    set('activeImage', 'stock');
  }

  async function handleSave() {
    const name = form.name.trim();
    let sku = form.sku.trim();
    if (!sku) sku = "sku-" + Date.now();

    function resolveSlot(pending, existingUrl, existingData) {
      let url = existingUrl || "";
      let data = existingData || "";
      if (pending === "__clear__") {
        url = ""; data = "";
      } else if (pending.indexOf("__local__:") === 0) {
        data = pending.slice("__local__:".length);
        url = "local";
      } else if (pending) {
        url = pending; data = "";
      }
      return { url, data };
    }
    const stock = resolveSlot(stockPending, card && card.imageUrl, card && card.imageData);
    const photo = resolveSlot(photoPending, card && card.photoUrl, card && card.photoData);

    const record = normalizeCard({
      sku, name,
      game: form.game,
      set: form.set.trim(),
      condition: form.condition.trim(),
      printing: form.printing.trim(),
      qty: form.qty,
      price: form.price,
      basePrice: form.basePrice,
      notes: form.notes,
      itemType: form.isSlab ? "slab" : "single",
      grader: form.grader.trim(),
      grade: form.grade.trim(),
      certNumber: form.cert.trim(),
      sourceUrl: form.sourceUrl.trim(),
      location: form.location.trim(),
      sold: form.sold,
      posChannel: form.posChannel,
      tcgplayerChannel: form.tcgplayerChannel,
      collectrChannel: form.collectrChannel,
      imageUrl: stock.url, imageData: stock.data,
      photoUrl: photo.url, photoData: photo.data,
      activeImage: form.activeImage,
      lastUpdated: Date.now(),
      // Carried forward as-is; App.jsx's save handler is what decides whether
      // a relevant field actually changed and resets these to false.
      posSynced: card ? card.posSynced : false,
      tcgplayerSynced: card ? card.tcgplayerSynced : false,
      collectrSynced: card ? card.collectrSynced : false,
    });

    setSaving(true);
    await onSave(record, card ? card.sku : null);
    setSaving(false);
  }

  async function handleDelete() {
    if (!card) { onClose(); return; }
    if (!(await showConfirm("Delete this item from the catalog? This can't be undone."))) return;
    await onDelete(card.sku);
  }

  const nameRequired = !form.name.trim();
  const conditionTier = canonicalizeCondition(form.condition);
  const conditionPct = conditionTier === "NM" ? 100 : (conditionTier && multipliers && multipliers[conditionTier]);
  const marketValue = marketValueForCondition(form.basePrice, form.condition, multipliers);

  return (
    <div className="overlay show" onClick={backdropClose(onClose)}>
      <div className="modal wide">
        <div className="modal-head">
          <div className="name">{card ? "Edit item" : "Add item"}</div>
          <div className="meta">Changes save with today's date as Last Updated</div>
        </div>
        <div className="modal-body modal-body-reorder">
          <div className="img-preview-wrap">
            <div
              className="img-frame large"
              onClick={() => { if (src) openLightbox(src); }}
            >
              {src ? (
                <img className="img-preview" src={src} style={{ display: 'block' }} />
              ) : (
                <div className="img-preview-empty">No image</div>
              )}
            </div>
            {/* Toggle + Find/Upload actions share one container, on the side of
                the image, instead of each stacking as its own full-width block
                below it — real-phone testing found the old stacked layout too
                tall/scrolly, and left the action buttons hugging the left edge. */}
            <div className="img-side">
              {stockSrc && photoSrc && (
                <div className="img-toggle-row">
                  <button type="button" className={`btn small${form.activeImage === 'photo' ? '' : ' ghost'}`} onClick={(e) => { e.stopPropagation(); set('activeImage', 'photo'); }}>Real photo</button>
                  <button type="button" className={`btn small${form.activeImage === 'stock' ? '' : ' ghost'}`} onClick={(e) => { e.stopPropagation(); set('activeImage', 'stock'); }}>Stock image</button>
                </div>
              )}
              <div className="img-actions">
                <button className="btn secondary small" disabled={searching} onClick={handleFindImage}>Find stock image</button>
                <button className="btn secondary small" disabled={searching} onClick={handleFindMarketPrice}>Find market price</button>
                <button className="btn secondary small" onClick={() => document.getElementById('uploadImageInput').click()}>Upload real photo</button>
                <input type="file" id="uploadImageInput" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFile} />
                <input type="url" placeholder="…or paste a stock image URL" value={manualUrl} onChange={handleManualUrlChange} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  {stockSrc && <button className="btn ghost small" onClick={() => setStockPending("__clear__")}>Remove stock</button>}
                  {photoSrc && <button className="btn ghost small" onClick={() => setPhotoPending("__clear__")}>Remove photo</button>}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginTop: '4px' }}>
              "Find stock image" searches a clean reference picture online; "Upload real photo" attaches an actual photo of
              this exact copy. If both exist, use the toggle above the preview to pick which one shows in the catalog —
              it defaults to the real photo. "Find market price" is separate: it backfills Market Value on a card that
              already has the right image, and picking a result there never touches either photo.
            </div>
          </div>
          {imageStatus.text && <div className={`status-line ${imageStatus.kind}`}>{imageStatus.text}</div>}
          {candidateMode === 'price' && candidates.length > 0 && (
            <div className="status-line ok" style={{ fontWeight: 500 }}>
              These are possible prints matching this card's name/set — click the one that matches your physical copy
              exactly. We'll pull that specific print's real market price into the Pricing section below as this
              item's Market Value reference. Nothing else on this item changes, including the photo above.
            </div>
          )}
          {candidates.length > 0 && (
            // On desktop this renders under the form sections (order:1 below,
            // vs. the sections' default order:0) since the search-results grid
            // is secondary to the data fields staff are actively editing; on
            // mobile it stays right here, near the image it's replacing —
            // scrolling all the way past the form to find it read as broken.
            <div className="img-candidates img-candidates-reorder">
              {candidates.map((r, i) => (
                <img key={i} src={r.url} title={r.label} onClick={() => selectCandidate(r.url, r.price, r.listingUrl)} />
              ))}
            </div>
          )}

          <div className="section-label">Item details</div>
          <div className="form-section">
            <div className="field-group">
              <label>
                Source / product URL{' '}
                {form.sourceUrl && (
                  <span
                    style={{ textTransform: 'none', fontFamily: "'Inter',sans-serif", fontWeight: 600, cursor: 'pointer', color: 'var(--blue)' }}
                    onClick={() => window.open(form.sourceUrl, '_blank')}
                  >(open ↗)</span>
                )}
              </label>
              <input type="url" placeholder="e.g. TCGplayer product page link" value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} />
            </div>

            <div className="field-row2">
              <div className="field-group"><label>Card / item name</label><input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div className="field-group">
                <label>Game</label>
                <select value={form.game} onChange={(e) => set('game', e.target.value)}>
                  {GAMES.map(g => <option key={g} value={g}>{GAME_LABELS[g]}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row2">
              <div className="field-group"><label>Set</label><input type="text" value={form.set} onChange={(e) => set('set', e.target.value)} /></div>
              <div className="field-group">
                <label>Rarity</label>
                <input
                  type="text" placeholder="Optional — narrows image/price search" value={rarity}
                  title="Not saved — same as Set, just narrows the search below for cards that reprint the same name/set at different rarities"
                  onChange={(e) => setRarity(e.target.value)}
                />
              </div>
            </div>
            <div className="field-row2">
              <div className="field-group"><label>Condition</label><input type="text" placeholder="e.g. NM, LP" value={form.condition} onChange={(e) => set('condition', e.target.value)} /></div>
              <div className="field-group"><label>Printing / finish</label><input type="text" placeholder="e.g. Foil, Normal" value={form.printing} onChange={(e) => set('printing', e.target.value)} /></div>
            </div>
            <div className="field-group">
              <label>SKU / barcode</label>
              <input type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </div>
            <div className="field-group">
              <label>Binder / case / collection</label>
              <LocationPicker locations={locations} value={form.location} onChange={(v) => set('location', v)} />
            </div>

            <div className="checkbox-row">
              <input type="checkbox" id="f_isSlab" checked={form.isSlab} onChange={(e) => set('isSlab', e.target.checked)} />
              <label htmlFor="f_isSlab" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>This is a graded slab (unique item)</label>
            </div>
            {form.isSlab && (
              <div className="slab-fields">
                <div className="field-row2">
                  <div className="field-group"><label>Grader</label><input type="text" placeholder="PSA, BGS, CGC…" value={form.grader} onChange={(e) => set('grader', e.target.value)} /></div>
                  <div className="field-group"><label>Grade</label><input type="text" placeholder="10, 9.5…" value={form.grade} onChange={(e) => set('grade', e.target.value)} /></div>
                </div>
                <div className="field-group"><label>Cert / serial number</label><input type="text" value={form.cert} onChange={(e) => set('cert', e.target.value)} /></div>
              </div>
            )}
          </div>

          <div className="section-label">Channels</div>
          <div className="form-section">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="f_posChannel" checked={form.posChannel} onChange={(e) => setChannel('posChannel', e.target.checked)} />
                <label htmlFor="f_posChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>In-store / POS</label>
              </div>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="f_tcgplayerChannel" checked={form.tcgplayerChannel} onChange={(e) => setChannel('tcgplayerChannel', e.target.checked)} />
                <label htmlFor="f_tcgplayerChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>TCG Player</label>
              </div>
              <div className="checkbox-row" style={{ marginBottom: 0 }}>
                <input type="checkbox" id="f_collectrChannel" checked={form.collectrChannel} onChange={(e) => setChannel('collectrChannel', e.target.checked)} />
                <label htmlFor="f_collectrChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Collectr</label>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-faint)', margin: '4px 0 14px' }}>
              Only checked platforms show up in the Sync Queue and Status column for this item.
            </div>
          </div>

          <div className="section-label">Quantity &amp; pricing</div>
          <div className="form-section">
            <div className="field-row2">
              <div className="field-group"><label>Quantity</label><input type="number" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} /></div>
              <div className="field-group">
                <label>Our price ($)</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </div>
            </div>
            {form.basePrice != null && (
              <div className="field-group">
                <label>Pricing</label>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>NM reference</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>${Number(form.basePrice).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                      Condition %{conditionTier ? ` (${conditionTier})` : ''}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>
                      {conditionPct != null ? `${conditionPct}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Market value</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>
                        {marketValue != null ? `$${marketValue.toFixed(2)}` : '— set a condition'}
                      </span>
                      {marketValue != null && (
                        <button type="button" className="btn ghost small" onClick={() => set('price', marketValue)}>Use as Our Price</button>
                      )}
                    </div>
                  </div>
                </div>
                {form.sourceUrl && (
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '8px' }}>
                    <span style={{ textTransform: 'none', fontFamily: "'Inter',sans-serif", fontWeight: 600, cursor: 'pointer', color: 'var(--blue)' }} onClick={() => window.open(form.sourceUrl, '_blank')}>
                      Check live TCGPlayer listing ↗
                    </span>
                    {' '}— compare the real per-condition prices there against the estimate above; the % is a flat average and won't be exactly right for every card.
                  </div>
                )}
                {Number(form.basePrice) >= HIGH_VALUE_THRESHOLD && (
                  <div className="status-line err" style={{ marginTop: '8px' }}>
                    Market value above is an estimate (NM reference price × a flat condition %), not real
                    per-condition sales data — on a ${HIGH_VALUE_THRESHOLD}+ card that gap can be real money.
                    {!form.sourceUrl && " Worth checking the real current listing before pricing it."}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="section-label">Notes &amp; status</div>
          <div className="form-section">
            <div className="field-group">
              <label>Notes</label>
              <textarea rows="3" placeholder="Anything worth flagging — damage, provenance, buyer holds…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="f_sold" checked={form.sold} onChange={(e) => set('sold', e.target.checked)} />
              <label htmlFor="f_sold" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Mark as sold</label>
            </div>
          </div>
          <div className="updated-note">
            {card && card.lastUpdated ? ("Last updated: " + new Date(card.lastUpdated).toLocaleString()) : "New item — not saved yet"}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" disabled={saving || nameRequired} onClick={handleSave}>Save</button>
          <button className="btn danger small" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
