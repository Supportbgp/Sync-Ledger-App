import { useState } from 'react';
import { computeQuoteTotals } from '../../lib/quoteUtils.js';
import QuoteDetail from './QuoteDetail.jsx';

const STATUS_LABELS = {
  accepted_cash: 'Accepted Cash',
  accepted_store_credit: 'Accepted Store Credit',
  rejected: 'Rejected Offer',
};

function statusLabel(quote) {
  return quote.offerStatus ? STATUS_LABELS[quote.offerStatus] : 'In progress';
}

// Landing view for the Quote tab (trade-in/buylist quoting) — a list of
// quotes, a "+ New Quote" button offering the two confirmed entry points
// (resume an in-progress collection, or start a brand-new one), and the
// single-quote detail view (QuoteDetail) for whichever quote is open.
export default function QuotesTab({ quotes, catalog, locations, multipliers, tierSettings, onSaveQuote, onDeleteQuote, onSaveTierSettings }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const inProgress = quotes.filter(q => !q.offerStatus);
  const selected = selectedId ? quotes.find(q => q.id === selectedId) : null;

  async function handleCreateFromScratch() {
    const collectionName = newName.trim();
    if (!collectionName) return;
    setCreating(true);
    const saved = await onSaveQuote({
      collectionName,
      customerName: '', customerId: '', phone: '', employee: '', timeTaken: '',
      items: [], offerStatus: null, payoutAmount: null, paidOut: false, convertedToCatalog: false,
    });
    setCreating(false);
    if (saved) {
      setShowNewFlow(false);
      setNewName('');
      setSelectedId(saved.id);
    }
  }

  function resumeCollection(id) {
    setShowNewFlow(false);
    setSelectedId(id);
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Quotes</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn secondary small" onClick={() => setShowSettings(true)}>Quote settings</button>
            <button className="btn" onClick={() => setShowNewFlow(true)}>+ New Quote</button>
          </div>
        </div>
        {quotes.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--ink-faint)' }}>No quotes yet — start one with "+ New Quote."</div>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Collection</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Paid out</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => {
                const { total } = computeQuoteTotals(q.items);
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(q.id)}>
                    <td>#{q.quoteNumber}</td>
                    <td>{q.collectionName}</td>
                    <td>{q.customerName || '—'}</td>
                    <td>{q.dateQuoted}</td>
                    <td>${total.toFixed(2)}</td>
                    <td>{statusLabel(q)}</td>
                    <td>{q.paidOut ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showNewFlow && (
        <div className="overlay show">
          <div className="modal">
            <div className="modal-head">
              <div className="name">New quote</div>
              <div className="meta">Resume an in-progress collection, or start a new one</div>
            </div>
            <div className="modal-body">
              {inProgress.length > 0 && (
                <>
                  <div className="section-label">Resume a collection</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {inProgress.map(q => (
                      <button
                        key={q.id} type="button" className="btn secondary small"
                        style={{ textAlign: 'left' }}
                        onClick={() => resumeCollection(q.id)}
                      >
                        #{q.quoteNumber} — {q.collectionName}{q.customerName ? ` (${q.customerName})` : ''}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="section-label">Start a new collection</div>
              <div className="field-group">
                <label>Collection name</label>
                <input
                  type="text" placeholder="e.g. Jake binder proposal" value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn secondary" onClick={() => setShowNewFlow(false)}>Cancel</button>
              <button className="btn" disabled={!newName.trim() || creating} onClick={handleCreateFromScratch}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <QuoteDetail
          key={selected.id}
          quote={selected}
          catalog={catalog}
          locations={locations}
          multipliers={multipliers}
          tierSettings={tierSettings}
          onSave={onSaveQuote}
          onDelete={onDeleteQuote}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showSettings && (
        <QuoteSettingsModal
          tierSettings={tierSettings}
          onSave={onSaveTierSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// Small, dedicated settings modal for the three offer-tier percentages —
// deliberately separate from the existing Pricing Settings modal
// (condition multipliers are a Catalog pricing concern; these are a
// quoting concern).
function QuoteSettingsModal({ tierSettings, onSave, onClose }) {
  const [form, setForm] = useState({ ...tierSettings });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">Quote settings</div>
          <div className="meta">The three offer tiers shown as a % of a quote's total value</div>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label>Tier 1 (%)</label>
            <input type="number" min="0" max="100" value={form.tier1} onChange={(e) => setForm(f => ({ ...f, tier1: Number(e.target.value) || 0 }))} />
          </div>
          <div className="field-group">
            <label>Tier 2 (%)</label>
            <input type="number" min="0" max="100" value={form.tier2} onChange={(e) => setForm(f => ({ ...f, tier2: Number(e.target.value) || 0 }))} />
          </div>
          <div className="field-group">
            <label>Tier 3 (%)</label>
            <input type="number" min="0" max="100" value={form.tier3} onChange={(e) => setForm(f => ({ ...f, tier3: Number(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
