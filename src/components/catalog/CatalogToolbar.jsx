export default function CatalogToolbar({
  search, setSearch,
  gameFilter, setGameFilter,
  locationFilter, setLocationFilter,
  typeFilter, setTypeFilter,
  statusFilter, setStatusFilter,
  games, locations,
  onAddItem,
}) {
  return (
    <div className="toolbar">
      <input
        type="text" className="search-input" placeholder="Search name, set, or SKU…"
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
        <option value="">All games</option>
        {games.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
        <option value="">All locations</option>
        {locations.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
        <option value="">Singles + Slabs</option>
        <option value="single">Singles only</option>
        <option value="slab">Slabs only</option>
      </select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">All items</option>
        <option value="available">Available</option>
        <option value="sold">Sold</option>
      </select>
      <button className="btn secondary small" onClick={onAddItem}>+ Add item</button>
    </div>
  );
}
