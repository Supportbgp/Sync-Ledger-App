import { useState } from 'react';

const ADD_NEW = '__add_new__';

// A binder/case/collection picker: a real dropdown of what already exists,
// plus an explicit "add new" path — instead of a plain text input with a
// browser datalist, which is easy to mistype and silently break exact-match
// lookups elsewhere (e.g. per-location channel defaults).
export default function LocationPicker({ locations, value, onChange, placeholder, ariaLabel }) {
  const [adding, setAdding] = useState(value !== '' && !locations.includes(value));

  if (adding) {
    return (
      <div>
        <input
          type="text"
          autoFocus
          aria-label={ariaLabel}
          placeholder={placeholder || "e.g. Black and red toploader binder (Pokemon)"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {locations.length > 0 && (
          <button
            type="button"
            className="btn ghost small"
            style={{ marginTop: '6px' }}
            onClick={() => { setAdding(false); onChange(''); }}
          >
            ← Choose an existing one instead
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={locations.includes(value) ? value : ''}
      aria-label={ariaLabel}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) { setAdding(true); onChange(''); }
        else onChange(e.target.value);
      }}
    >
      <option value="">— Select a binder / case —</option>
      {locations.map(l => <option key={l} value={l}>{l}</option>)}
      <option value={ADD_NEW}>+ Add new collection…</option>
    </select>
  );
}
