import { useEffect, useState } from 'react';

const ADD_NEW = '__add_new__';

// A dropdown of known options plus an explicit "add new" escape hatch —
// instead of a plain text input with a browser datalist, which silently
// keeps filtering as soon as the field already holds a non-matching value
// (the exact behavior that made LocationPicker move off a datalist first;
// see its git history). Shared here so Rarity/Condition/Foil pickers all
// get the same select-plus-escape-hatch behavior instead of three
// near-identical copies of it.
export default function SelectWithCustom({
  options, value, onChange, ariaLabel, title,
  selectPlaceholder = '— Select —',
  addNewLabel = '+ Add new…',
  customPlaceholder = '',
  backLabel = '← Choose from the list instead',
}) {
  // With nothing to pick from, skip straight to free text instead of
  // forcing a "+ Add new" click just to reach an otherwise-empty select —
  // the common case for most games here, which have no curated options at
  // all (see RARITY_OPTIONS_BY_GAME's Pokemon-only rollout).
  const [adding, setAdding] = useState(options.length === 0 || (value !== '' && !options.includes(value)));

  // `options` can change out from under an already-mounted picker — e.g.
  // Rarity's options depend on the Game field, which staff can change after
  // this component has already rendered in select mode. If that leaves
  // nothing to pick from, force the escape hatch open rather than stranding
  // staff on a select with no real options in it.
  useEffect(() => {
    if (options.length === 0 && !adding) setAdding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  if (adding) {
    return (
      <div>
        <input
          type="text"
          autoFocus
          aria-label={ariaLabel}
          title={title}
          placeholder={customPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {options.length > 0 && (
          <button
            type="button"
            className="btn ghost small"
            style={{ marginTop: '6px' }}
            onClick={() => { setAdding(false); onChange(''); }}
          >
            {backLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={options.includes(value) ? value : ''}
      aria-label={ariaLabel}
      title={title}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) { setAdding(true); onChange(''); }
        else onChange(e.target.value);
      }}
    >
      <option value="">{selectPlaceholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={ADD_NEW} className="select-add-new-option">{addNewLabel}</option>
    </select>
  );
}
