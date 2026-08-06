import { useEffect, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { normalizeCard, channelDefaultsForLocation } from '../../lib/cardUtils.js';
import { searchScryfall, searchPokemon, searchYugioh, searchLorcana, searchOnePiece, searchRiftbound, searchGundam, searchSwu } from '../../lib/cardSearch.js';
import { resizeImageFile } from '../../lib/image.js';
import LocationPicker from '../LocationPicker.jsx';

const GAMES = ["Magic", "Pokemon", "Yugioh", "Lorcana", "One Piece", "Sports Singles", "SWU", "Riftbound", "Gundam", "Other"];
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
    notes: card?.notes || "",
    sold: !!card?.sold,
    sourceUrl: card?.sourceUrl || "",
    posChannel: card ? card.posChannel !== false : true,
    tcgplayerChannel: card ? card.tcgplayerChannel !== false : true,
    collectrChannel: card ? card.collectrChannel !== false : true,
  };
}

export default function EditModal({ card, catalog, locations, onClose, onSave, onDelete }) {
  const { showConfirm, openLightbox } = useUI();
  const [form, setForm] = useState(() => initForm(card));
  const [channelsTouched, setChannelsTouched] = useState(false);

  // For a brand-new item, follow whatever channels the same binder/case
  // already uses as the staff types the location in — until they manually
  // touch a channel checkbox themselves, at which point their choice wins.
  useEffect(() => {
    if (card || channelsTouched) return;
    const defaults = channelDefaultsForLocation(catalog, form.location.trim());
    setForm(f => ({ ...f, ...defaults }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location]);

  const [imagePending, setImagePending] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [imageStatus, setImageStatus] = useState({ text: "", kind: "" });
  const [manualUrl, setManualUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function setChannel(key, val) {
    setChannelsTouched(true);
    set(key, val);
  }

  function previewSrc() {
    if (imagePending === "__clear__") return null;
    if (imagePending.indexOf("__local__:") === 0) return imagePending.slice("__local__:".length);
    if (imagePending) return imagePending;
    if (card && card.imageUrl && card.imageUrl.startsWith('http')) return card.imageUrl;
    if (card && card.imageUrl === 'local' && card.imageData) return card.imageData;
    return null;
  }
  const src = previewSrc();

  async function handleFindImage() {
    const name = form.name.trim();
    if (!name) { setImageStatus({ text: "Enter a card name first.", kind: "err" }); return; }
    setImageStatus({ text: "Searching…", kind: "" });
    setCandidates([]);
    setSearching(true);
    try {
      let results = [];
      const set = form.set.trim();
      if (form.game === "Magic") results = await searchScryfall(name);
      else if (form.game === "Pokemon") results = await searchPokemon(name, set);
      else if (form.game === "Yugioh") results = await searchYugioh(name);
      else if (form.game === "Lorcana") results = await searchLorcana(name);
      else if (form.game === "One Piece") results = await searchOnePiece(name, set);
      else if (form.game === "Riftbound") results = await searchRiftbound(name, set);
      else if (form.game === "Gundam") results = await searchGundam(name, set);
      else if (form.game === "SWU") results = await searchSwu(name, set);
      else {
        setImageStatus({ text: "Auto image lookup isn't set up for this game yet — upload a photo or paste a URL instead.", kind: "err" });
        setSearching(false);
        return;
      }
      if (!results.length) {
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

  function selectCandidate(url) {
    setImagePending(url);
  }

  async function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 500, 0.82);
      setImagePending("__local__:" + dataUrl);
      setImageStatus({ text: "Photo ready — click Save to store it.", kind: "ok" });
    } catch (err) {
      setImageStatus({ text: err.message, kind: "err" });
    }
  }

  function handleManualUrlChange(e) {
    const url = e.target.value.trim();
    setManualUrl(e.target.value);
    if (!url) return;
    setImagePending(url);
  }

  async function handleSave() {
    const name = form.name.trim();
    let sku = form.sku.trim();
    if (!sku) sku = "sku-" + Date.now();

    let imageUrl = (card && card.imageUrl) || "";
    let imageData = (card && card.imageData) || "";
    if (imagePending === "__clear__") {
      imageUrl = ""; imageData = "";
    } else if (imagePending.indexOf("__local__:") === 0) {
      imageData = imagePending.slice("__local__:".length);
      imageUrl = "local";
    } else if (imagePending) {
      imageUrl = imagePending; imageData = "";
    }

    const record = normalizeCard({
      sku, name,
      game: form.game,
      set: form.set.trim(),
      condition: form.condition.trim(),
      printing: form.printing.trim(),
      qty: form.qty,
      price: form.price,
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
      imageUrl, imageData,
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

  return (
    <div className="overlay show">
      <div className="modal wide">
        <div className="modal-head">
          <div className="name">{card ? "Edit item" : "Add item"}</div>
          <div className="meta">Changes save with today's date as Last Updated</div>
        </div>
        <div className="modal-body">
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
            <div className="img-actions">
              <button className="btn secondary small" disabled={searching} onClick={handleFindImage}>Find image</button>
              <button className="btn secondary small" onClick={() => document.getElementById('uploadImageInput').click()}>Upload photo</button>
              <input type="file" id="uploadImageInput" accept="image/*" style={{ display: 'none' }} onChange={handleUploadFile} />
              <input type="url" placeholder="…or paste an image URL" value={manualUrl} onChange={handleManualUrlChange} />
              <button className="btn ghost small" onClick={() => setImagePending("__clear__")}>Remove image</button>
            </div>
          </div>
          {imageStatus.text && <div className={`status-line ${imageStatus.kind}`}>{imageStatus.text}</div>}
          {candidates.length > 0 && (
            <div className="img-candidates">
              {candidates.map((r, i) => (
                <img key={i} src={r.url} title={r.label} onClick={() => selectCandidate(r.url)} />
              ))}
            </div>
          )}

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
            <div className="field-group"><label>Condition</label><input type="text" placeholder="e.g. NM, LP" value={form.condition} onChange={(e) => set('condition', e.target.value)} /></div>
          </div>
          <div className="field-row2">
            <div className="field-group"><label>Printing / finish</label><input type="text" placeholder="e.g. Foil, Normal" value={form.printing} onChange={(e) => set('printing', e.target.value)} /></div>
            <div className="field-group"><label>SKU / barcode</label><input type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)} /></div>
          </div>
          <div className="field-group">
            <label>Binder / case / collection</label>
            <LocationPicker locations={locations} value={form.location} onChange={(v) => set('location', v)} />
          </div>

          <div className="field-group">
            <label>Where does this item live?</label>
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
            <div style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginTop: '4px' }}>
              Only checked platforms show up in the Sync Queue and Status column for this item.
            </div>
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

          <div className="field-row2">
            <div className="field-group"><label>Quantity</label><input type="number" min="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} /></div>
            <div className="field-group"><label>Price ($)</label><input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
          </div>
          <div className="field-group">
            <label>Notes</label>
            <textarea rows="3" placeholder="Anything worth flagging — damage, provenance, buyer holds…" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="f_sold" checked={form.sold} onChange={(e) => set('sold', e.target.checked)} />
            <label htmlFor="f_sold" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Mark as sold</label>
          </div>
          <div className="updated-note">
            {card && card.lastUpdated ? ("Last updated: " + new Date(card.lastUpdated).toLocaleString()) : "New item — not saved yet"}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn danger small" onClick={handleDelete}>Delete</button>
          <button className="btn small" disabled={saving || nameRequired} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
