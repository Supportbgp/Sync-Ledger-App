import { useRef, useState } from 'react';
import { useUI } from '../../context/UIContext.jsx';
import { downloadCsv } from '../../lib/csv.js';
import { detectGrading, normalizeCard } from '../../lib/cardUtils.js';
import {
  FIELD_TARGETS, guessHeader, parseCsvFile, readWorkbook, loadXlsxSheet,
} from '../../lib/importParse.js';

export default function ImportExportPanel({ catalog, queue, locations, onImport, onClearAll }) {
  const { toast, showConfirm } = useUI();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState({ text: "", kind: "" });

  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [showSheetPicker, setShowSheetPicker] = useState(false);

  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [locationDefault, setLocationDefault] = useState("");
  const [mapping, setMapping] = useState({});
  const [importLocation, setImportLocation] = useState("");
  const [importMode, setImportMode] = useState("merge");
  const [showMapSection, setShowMapSection] = useState(false);

  function applyParsed(newRows, newHeaders, newLocationDefault) {
    setRows(newRows);
    setHeaders(newHeaders);
    setLocationDefault(newLocationDefault);
    const initialMapping = {};
    FIELD_TARGETS.forEach(f => {
      const g = guessHeader(f.aliases, newHeaders);
      if (g) initialMapping[f.key] = g;
    });
    setMapping(initialMapping);
    setImportLocation(newLocationDefault || "");
    setShowMapSection(true);
  }

  async function loadSheet(wb, sheetName) {
    try {
      const result = await loadXlsxSheet(wb, sheetName);
      applyParsed(result.rows, result.headers, result.locationDefault);
      setStatus({ text: result.message, kind: "ok" });
      setShowSheetPicker(false);
    } catch (err) {
      setStatus({ text: err.message, kind: "err" });
    }
  }

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    setShowSheetPicker(false);
    if (ext === "xlsx" || ext === "xls") {
      setStatus({ text: "Reading Excel file…", kind: "" });
      try {
        const wb = await readWorkbook(file);
        setWorkbook(wb);
        if (wb.SheetNames.length > 1) {
          setSheetNames(wb.SheetNames);
          setSelectedSheet(wb.SheetNames[0]);
          setShowSheetPicker(true);
          setStatus({ text: `${wb.SheetNames.length} sheets found — pick one to import.`, kind: "" });
        } else {
          await loadSheet(wb, wb.SheetNames[0]);
        }
      } catch (err) {
        setStatus({ text: err.message, kind: "err" });
      }
    } else {
      setStatus({ text: "Reading file…", kind: "" });
      try {
        const { rows: r, headers: h, locationDefault: ld } = await parseCsvFile(file);
        applyParsed(r, h, ld);
        setStatus({ text: `${r.length} rows detected — match columns below.`, kind: "" });
      } catch (err) {
        setStatus({ text: err.message, kind: "err" });
      }
    }
  }

  function handleMappingChange(fieldKey, value) {
    setMapping(m => {
      const next = { ...m };
      if (value) next[fieldKey] = value; else delete next[fieldKey];
      return next;
    });
  }

  async function handleConfirmImport() {
    if (!mapping.name) {
      setStatus({ text: "Card Name must be mapped to import.", kind: "err" });
      return;
    }
    const autoGrade = !(mapping.itemType || mapping.grader || mapping.grade);
    const batchLocation = importLocation.trim();
    const newRows = rows.map((r, i) => {
      const rawName = mapping.name ? r[mapping.name] : "Unnamed";
      let detected = { name: rawName, itemType: "single", grader: "", grade: "" };
      if (autoGrade) detected = detectGrading(rawName);
      const perRowLocation = mapping.location ? (r[mapping.location] || "").trim() : "";
      return normalizeCard({
        sku: (mapping.sku ? r[mapping.sku] : "") || ("noSKU-" + i),
        name: autoGrade ? detected.name : rawName,
        set: mapping.set ? r[mapping.set] : "",
        game: mapping.game ? r[mapping.game] : "",
        condition: mapping.condition ? r[mapping.condition] : "",
        printing: mapping.printing ? r[mapping.printing] : "",
        qty: mapping.qty ? r[mapping.qty] : 1,
        price: mapping.price ? r[mapping.price] : null,
        notes: mapping.notes ? r[mapping.notes] : "",
        imageUrl: mapping.imageUrl ? r[mapping.imageUrl] : "",
        sourceUrl: mapping.sourceUrl ? r[mapping.sourceUrl] : "",
        location: perRowLocation || batchLocation,
        itemType: mapping.itemType ? r[mapping.itemType] : detected.itemType,
        grader: mapping.grader ? r[mapping.grader] : detected.grader,
        grade: mapping.grade ? r[mapping.grade] : detected.grade,
        certNumber: mapping.certNumber ? r[mapping.certNumber] : "",
        sold: mapping.sold ? r[mapping.sold] : false,
        lastUpdated: (() => {
          if (!mapping.lastUpdated) return Date.now();
          const parsed = Date.parse(r[mapping.lastUpdated]);
          return isNaN(parsed) ? Date.now() : parsed;
        })(),
      });
    });

    setStatus({ text: "Saving to database…", kind: "" });
    await onImport(newRows, importMode);
    const slabCount = newRows.filter(r => r.itemType === "slab").length;
    setStatus({
      text: `Imported ${newRows.length} rows.` + (autoGrade ? ` Auto-detected ${slabCount} slab(s) from grading text in the name.` : ""),
      kind: "ok",
    });
    setShowMapSection(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function exportFull() {
    if (!catalog.length) { toast("Catalog is empty", true); return; }
    downloadCsv("ledger_full_catalog.csv", catalog.map(c => ({
      SKU: c.sku, Name: c.name, Set: c.set, Game: c.game, Condition: c.condition, Printing: c.printing,
      Type: c.itemType, Grader: c.grader, Grade: c.grade, CertNumber: c.certNumber,
      Qty: c.qty, Price: c.price, Notes: c.notes, Sold: c.sold, ImageURL: c.imageUrl, SourceURL: c.sourceUrl, Location: c.location,
      LastUpdated: new Date(c.lastUpdated).toISOString(),
    })));
    toast("Full catalog exported");
  }

  function exportHistory() {
    if (!queue.length) { toast("No sync history yet", true); return; }
    downloadCsv("ledger_sync_history.csv", queue.map(t => ({
      Time: new Date(t.timestamp).toISOString(), SKU: t.sku, Name: t.name, QtySold: t.qtySold,
      CumulusDone: t.cumulusDone, SortSwiftDone: t.sortswiftDone,
    })));
    toast("Sync history exported");
  }

  async function handleClearAll() {
    if (!(await showConfirm("This clears the shared catalog and sync queue for everyone using this Ledger. Continue?", "Reset all data", { requirePassword: true }))) return;
    await onClearAll();
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: '16px' }}>
        <div className="section-label">Import from Google Sheets / CSV / Excel</div>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginBottom: '12px' }}>
          Prefer <strong>.xlsx</strong> over .csv when your sheet has hyperlinks (e.g. TCGplayer photo links) — Excel
          format keeps them, CSV strips them. In Google Sheets: File → Download → Microsoft Excel (.xlsx).
        </div>
        <div
          className={`drop${dragOver ? ' drag' : ''}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
        >
          <span className="mark">Drop a .csv or .xlsx file, or click to choose</span>
          Hyperlinks on cells are auto-detected as images. Section header rows (e.g. a row that just says "POKEMON") are
          auto-detected as a Game grouping.
        </div>
        <input
          type="file" ref={fileInputRef} accept=".csv,.xlsx" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />
        {showSheetPicker && (
          <div className="sheet-picker">
            <label style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>Sheet to import:</label>
            <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}>
              {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn secondary small" onClick={() => loadSheet(workbook, selectedSheet)}>Load sheet</button>
          </div>
        )}
        {showMapSection && (
          <div>
            <div className="section-label">Match your columns</div>
            <div className="map-grid">
              {FIELD_TARGETS.map(field => (
                <div className="map-row" key={field.key}>
                  <label>{field.label}</label>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                  >
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="field-group" style={{ maxWidth: '420px' }}>
              <label>Binder / case / collection for this import</label>
              <input
                type="text" list="locationDatalistImport"
                placeholder="e.g. Black and red toploader binder (Pokemon)"
                value={importLocation} onChange={(e) => setImportLocation(e.target.value)}
              />
              <datalist id="locationDatalistImport">
                {locations.map(l => <option key={l} value={l} />)}
              </datalist>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-faint)', marginTop: '4px' }}>
                Applied to every row in this import. Type a new name to create a new binder/case, or pick an existing one.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn" onClick={handleConfirmImport}>Import rows</button>
              <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                <option value="merge">Merge (update matching SKUs, add new)</option>
                <option value="replace">Replace entire catalog</option>
              </select>
            </div>
          </div>
        )}
        {status.text && <div className={`status-line ${status.kind}`}>{status.text}</div>}
      </div>
      <div className="card card-pad">
        <div className="section-label">Export</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn secondary" onClick={exportFull}>Export full catalog CSV</button>
          <button className="btn secondary" onClick={exportHistory}>Export sync history CSV</button>
          <button className="btn ghost" onClick={handleClearAll}>Reset all data</button>
        </div>
      </div>
    </div>
  );
}
