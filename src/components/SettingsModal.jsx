import { useState } from 'react';
import { CONDITION_TIERS } from '../lib/cardUtils.js';

// NM is always 100% by definition, not editable — only the four non-NM
// tiers are store-configurable. Labels come from the same CONDITION_TIERS
// list the Condition field's dropdown uses, so the two can't drift apart.
const FIELDS = CONDITION_TIERS.filter(t => t.key !== 'NM').map(t => ({ key: t.key, label: t.name }));

export default function SettingsModal({ multipliers, onClose, onSave }) {
  const [form, setForm] = useState(multipliers);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">Pricing settings</div>
          <div className="meta">
            Market Value is estimated as this percentage of a card's NM price. Doesn't affect Our Price —
            that's always yours to set.
          </div>
        </div>
        <div className="modal-body">
          <div className="field-row2">
            <div className="field-group">
              <label>Near Mint (NM)</label>
              <input type="number" value={100} disabled />
            </div>
          </div>
          {FIELDS.map(f => (
            <div className="field-row2" key={f.key}>
              <div className="field-group">
                <label>{f.label} ({f.key})</label>
                <input
                  type="number" min="0" max="100" step="1"
                  value={form[f.key]}
                  onChange={(e) => setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
