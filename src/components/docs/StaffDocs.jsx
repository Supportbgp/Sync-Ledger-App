import logoIcon from '../../assets/logo-icon.png';
import GettingStartedSection from './sections/GettingStartedSection.jsx';
import CatalogSection from './sections/CatalogSection.jsx';
import EditingItemSection from './sections/EditingItemSection.jsx';
import SellingItemSection from './sections/SellingItemSection.jsx';
import SyncQueueSection from './sections/SyncQueueSection.jsx';
import ImportExportSection from './sections/ImportExportSection.jsx';
import ScannerSection from './sections/ScannerSection.jsx';
import PricingSettingsSection from './sections/PricingSettingsSection.jsx';
import PublicBinderSection from './sections/PublicBinderSection.jsx';
import GlossarySection from './sections/GlossarySection.jsx';
import KnownQuirksSection from './sections/KnownQuirksSection.jsx';

// Every entry here needs a matching `id` on that section's <DocsSection>.
const NAV = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'editing-an-item', label: 'Editing an item' },
  { id: 'selling-an-item', label: 'Selling an item' },
  { id: 'sync-queue', label: 'Sync Queue' },
  { id: 'import-export', label: 'Import / Export' },
  { id: 'scan-binder', label: 'Scan Binder' },
  { id: 'pricing-settings', label: 'Pricing settings' },
  { id: 'public-binder-page', label: 'The public binder page' },
  { id: 'glossary', label: 'Concepts & glossary' },
  { id: 'known-quirks', label: 'Known quirks' },
];

// Reached via ?help=1 (see main.jsx) — deliberately no login and no
// UIProvider, same reasoning as BinderView.jsx: staff should be able to
// pull this up on a phone before ever signing in, bookmark it, or print it.
export default function StaffDocs() {
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img src={logoIcon} alt="" className="brand-logo" />
          <span className="mark">Ledger</span>
          <span className="sub">Staff documentation</span>
        </div>
      </div>

      <div className="docs-layout">
        <nav className="docs-nav" aria-label="Sections">
          <div className="docs-nav-title">On this page</div>
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>{n.label}</a>
          ))}
        </nav>
        <div className="docs-content">
          <GettingStartedSection />
          <CatalogSection />
          <EditingItemSection />
          <SellingItemSection />
          <SyncQueueSection />
          <ImportExportSection />
          <ScannerSection />
          <PricingSettingsSection />
          <PublicBinderSection />
          <GlossarySection />
          <KnownQuirksSection />
        </div>
      </div>

      <div className="footnote">
        Ledger — Board Game Paradise · this page needs no login and can be bookmarked or printed.
      </div>
    </div>
  );
}
