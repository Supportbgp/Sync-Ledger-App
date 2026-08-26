import ImportPanel from './ImportPanel.jsx';
import ExportPanel from './ExportPanel.jsx';

// The real Import/Export tab — a thin composer of ImportPanel + ExportPanel
// (split out so the Quote tab's "Import" add-card method can mount
// ImportPanel alone, without Export/Binder-QR/Reset-all-data). Behavior
// here is unchanged from before the split.
export default function ImportExportPanel({ catalog, queue, locations, onImport, onClearAll }) {
  return (
    <div>
      <ImportPanel catalog={catalog} locations={locations} onImport={onImport} />
      <ExportPanel catalog={catalog} queue={queue} locations={locations} onClearAll={onClearAll} />
    </div>
  );
}
