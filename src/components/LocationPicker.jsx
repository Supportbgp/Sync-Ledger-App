import SelectWithCustom from './SelectWithCustom.jsx';

// A binder/case/collection picker — thin wrapper over the shared
// SelectWithCustom pattern (select of what already exists, plus an
// explicit "add new" path) with this field's own labels/placeholders.
export default function LocationPicker({ locations, value, onChange, placeholder, ariaLabel }) {
  return (
    <SelectWithCustom
      options={locations}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      selectPlaceholder="— Select a binder / case —"
      addNewLabel="+ Add new collection…"
      customPlaceholder={placeholder || "e.g. Black and red toploader binder (Pokemon)"}
      backLabel="← Choose an existing one instead"
    />
  );
}
