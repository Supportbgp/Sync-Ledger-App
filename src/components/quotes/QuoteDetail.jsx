import { useEffect, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { normalizeQuoteItem, computeQuoteTotals, computeOfferTiers, itemsFromCatalogRows } from '../../lib/quoteUtils.js';
import QuoteLineItemRow from './QuoteLineItemRow.jsx';
import ScannerPanel from '../scanner/ScannerPanel.jsx';
import ImportPanel from '../importexport/ImportPanel.jsx';
import { QuotePrintSheet, ReleaseFormPrintSheet } from './QuotePrintViews.jsx';

const OFFER_STATUS_OPTIONS = [
  { value: '', label: '— Still deciding —' },
  { value: 'accepted_cash', label: 'Accepted Cash' },
  { value: 'accepted_store_credit', label: 'Accepted Store Credit' },
  { value: 'rejected', label: 'Rejected Offer' },
];

// The single-quote view ("Quote #14 — Jake binder proposal") — one
// scrollable page matching the source spreadsheet's own single-page feel,
// reached from QuotesTab for either a brand-new or a resumed collection.
// Rendered with a `key={quote.id}` by the parent so switching quotes
// remounts this fresh rather than needing a prop-sync effect.
export default function QuoteDetail({ quote, catalog, locations, multipliers, tierSettings, onSave, onDelete, onClose }) {
  const { showConfirm } = useUI();
  const [draft, setDraft] = useState(() => ({ ...quote, items: quote.items.map(normalizeQuoteItem) }));
  const [addMode, setAddMode] = useState(null); // null | 'scan' | 'import'
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(null); // null | 'quote' | 'release'

  // Printing works off `draft` (whatever's currently on screen, saved or
  // not) — staff often want the Release Form the moment a customer's cards
  // arrive, before there's any reason to have saved the quote yet.
  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => window.print(), 50);
    return () => clearTimeout(t);
  }, [printMode]);

  useEffect(() => {
    function handleAfterPrint() { setPrintMode(null); }
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  function set(field, value) {
    setDraft(d => ({ ...d, [field]: value }));
  }

  function addBlankItem() {
    setDraft(d => ({ ...d, items: [...d.items, normalizeQuoteItem({})] }));
  }

  function updateItem(id, nextItem) {
    setDraft(d => ({ ...d, items: d.items.map(it => (it.id === id ? nextItem : it)) }));
  }

  function removeItem(id) {
    setDraft(d => ({ ...d, items: d.items.filter(it => it.id !== id) }));
  }

  function appendFromCards(cards) {
    setDraft(d => ({ ...d, items: [...d.items, ...itemsFromCatalogRows(cards)] }));
    setAddMode(null);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!(await showConfirm(`Delete Quote #${quote.quoteNumber} — ${draft.collectionName}? This can't be undone.`))) return;
    await onDelete(quote.id);
    onClose();
  }

  const { qty, total } = computeQuoteTotals(draft.items);
  const tiers = computeOfferTiers(total, tierSettings);

  return (
    <div className="overlay show">
      <div className="modal xwide">
        <div className="modal-head">
          <div className="name">{quote.id ? `Quote #${quote.quoteNumber} — ${draft.collectionName}` : `New quote — ${draft.collectionName}`}</div>
          <div className="meta">
            {!quote.id ? 'Not saved yet — nothing is kept until you hit Save'
              : draft.offerStatus ? 'Finalized' : 'In progress — save any time, come back later'}
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button className="btn secondary small" onClick={() => setPrintMode('quote')}>Print Quote</button>
            <button className="btn secondary small" onClick={() => setPrintMode('release')}>Print Release Form</button>
          </div>
          <div className="section-label">Quote details</div>
          <div className="form-section">
            <div className="field-row2">
              <div className="field-group"><label>Customer name</label><input type="text" value={draft.customerName} onChange={(e) => set('customerName', e.target.value)} /></div>
              <div className="field-group"><label>Customer ID</label><input type="text" value={draft.customerId} onChange={(e) => set('customerId', e.target.value)} /></div>
            </div>
            <div className="field-row2">
              <div className="field-group"><label>Phone #</label><input type="text" value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="field-group"><label>Email</label><input type="email" value={draft.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} /></div>
            </div>
            <div className="field-row2">
              <div className="field-group"><label>Date quoted</label><input type="date" value={draft.dateQuoted || ''} onChange={(e) => set('dateQuoted', e.target.value)} /></div>
              <div className="field-group"><label>Employee</label><input type="text" placeholder="e.g. John Doe" value={draft.employee} onChange={(e) => set('employee', e.target.value)} /></div>
            </div>
            <div className="field-group"><label>Time taken to quote</label><input type="text" placeholder="e.g. 20 min" value={draft.timeTaken} onChange={(e) => set('timeTaken', e.target.value)} /></div>
          </div>

          <div className="section-label">Release form info</div>
          <div className="form-section">
            <div className="field-group">
              <label>Does the customer have a price in mind, a perceived value, or an offer they've already been given?</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button" className={`btn small${draft.hasExpectedPrice === true ? '' : ' ghost'}`}
                  onClick={() => set('hasExpectedPrice', draft.hasExpectedPrice === true ? null : true)}
                >Yes</button>
                <button
                  type="button" className={`btn small${draft.hasExpectedPrice === false ? '' : ' ghost'}`}
                  onClick={() => set('hasExpectedPrice', draft.hasExpectedPrice === false ? null : false)}
                >No</button>
              </div>
            </div>
            {draft.hasExpectedPrice === true && (
              <div className="field-group">
                <label>If so, what is that number?</label>
                <input type="text" placeholder="e.g. $150" value={draft.expectedPriceAmount} onChange={(e) => set('expectedPriceAmount', e.target.value)} />
              </div>
            )}
            <div className="field-group">
              <label>Description of product being left (# of cards, box or binder they're in, condition notes, specific cards of value…)</label>
              <textarea rows={4} value={draft.intakeNotes} onChange={(e) => set('intakeNotes', e.target.value)} />
            </div>
          </div>

          <div className="section-label">Cards ({draft.items.length})</div>
          <div className="form-section">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
              {draft.items.map(item => (
                <QuoteLineItemRow
                  key={item.id}
                  item={item}
                  catalog={catalog}
                  multipliers={multipliers}
                  onChange={(next) => updateItem(item.id, next)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn secondary small" onClick={addBlankItem}>+ Add card manually</button>
              <button className="btn secondary small" onClick={() => setAddMode('scan')}>+ Add cards by scanning</button>
              <button className="btn secondary small" onClick={() => setAddMode('import')}>+ Add cards by import</button>
            </div>
          </div>

          <div className="section-label">Total &amp; offer</div>
          <div className="form-section">
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Qty</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>{qty}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Total quoted value</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>${total.toFixed(2)}</div>
              </div>
              {[
                { key: 'tier1', pct: tierSettings.tier1, amount: tiers.tier1 },
                { key: 'tier2', pct: tierSettings.tier2, amount: tiers.tier2 },
                { key: 'tier3', pct: tierSettings.tier3, amount: tiers.tier3 },
              ].map(t => (
                <div key={t.key}>
                  <div style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>{t.pct}% offer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '14px' }}>${t.amount.toFixed(2)}</span>
                    <button type="button" className="btn ghost small" onClick={() => set('payoutAmount', t.amount)}>Use</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="field-row2">
              <div className="field-group">
                <label>Offer status</label>
                <select value={draft.offerStatus || ''} onChange={(e) => set('offerStatus', e.target.value || null)}>
                  {OFFER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label>Payout amount ($)</label>
                <input
                  type="number" step="0.01" min="0" value={draft.payoutAmount ?? ''}
                  onChange={(e) => set('payoutAmount', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="q_paidOut" checked={draft.paidOut} onChange={(e) => set('paidOut', e.target.checked)} />
              <label htmlFor="q_paidOut" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Paid out</label>
            </div>
            {(draft.offerStatus === 'accepted_cash' || draft.offerStatus === 'accepted_store_credit') && !draft.convertedToCatalog && (
              <div className="status-line ok" style={{ marginTop: '8px' }}>
                Saving with this status will add {draft.items.length} item(s) to the Catalog.
              </div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          {quote.id ? <button className="btn ghost" onClick={handleDelete}>Delete</button> : <span />}
          <div style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      {addMode === 'scan' && (
        <div className="overlay show">
          <div className="modal xwide">
            <div className="modal-head">
              <div className="name">Scan cards for this quote</div>
              <div className="meta">Detected cards are added to this quote, not the catalog</div>
            </div>
            <div className="modal-body">
              <ScannerPanel
                catalog={catalog}
                locations={locations}
                multipliers={multipliers}
                destinationLabel="quote"
                onImport={async (cards) => appendFromCards(cards)}
              />
            </div>
            <div className="modal-foot">
              <button className="btn secondary" onClick={() => setAddMode(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {addMode === 'import' && (
        <div className="overlay show">
          <div className="modal xwide">
            <div className="modal-head">
              <div className="name">Import cards for this quote</div>
              <div className="meta">Imported rows are added to this quote, not the catalog</div>
            </div>
            <div className="modal-body">
              <ImportPanel
                catalog={catalog}
                locations={locations}
                embedded
                onImport={async (cards) => appendFromCards(cards)}
              />
            </div>
            <div className="modal-foot">
              <button className="btn secondary" onClick={() => setAddMode(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Invisible on screen, shown only under @media print — see
          .print-sheet in index.css. Prints whatever's on screen right now
          (`draft`), saved or not, since staff often need the Release Form
          the moment cards arrive, before there's any reason to have saved
          the quote yet. */}
      {printMode === 'quote' && <QuotePrintSheet quote={draft} tierSettings={tierSettings} />}
      {printMode === 'release' && <ReleaseFormPrintSheet quote={draft} />}
    </div>
  );
}
