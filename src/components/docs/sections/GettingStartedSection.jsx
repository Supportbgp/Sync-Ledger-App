import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function GettingStartedSection() {
  return (
    <DocsSection id="getting-started" title="Getting started">
      <p>
        Ledger is shared by everyone on staff — there's one login for the
        whole shop, not individual accounts. If you don't have the shared
        password, ask a manager.
      </p>
      <DocsCallout kind="note">
        This documentation page itself doesn't need you to be signed in —
        that's on purpose, so you can pull it up on your phone, bookmark it,
        or print it, even before you've logged into Ledger for the day.
      </DocsCallout>

      <h3>The topbar</h3>
      <p>
        Once signed in, the bar across the top shows the "Ledger" logo and a{' '}
        <strong>pending sync</strong> badge — the number of sales that still
        need to be marked as updated on an external platform (see{' '}
        <a href="#sync-queue">Sync Queue</a> below). It turns grey once
        there's nothing outstanding.
      </p>

      <h3>The four tabs</h3>
      <ul>
        <li><strong>Catalog</strong> — everything currently in stock (or sold), search and edit from here.</li>
        <li><strong>Sync Queue</strong> — sales waiting to be marked updated on POS/TCG Player/Collectr.</li>
        <li><strong>Import / Export</strong> — bulk-load a spreadsheet, export reference lists, print a binder QR code.</li>
        <li><strong>Scan Binder</strong> — photograph a binder page and let Ledger identify the cards for you.</li>
      </ul>
      <p>
        Switching tabs never loses your work in another tab — each tab keeps
        whatever you were doing (a half-finished import, a scan in progress)
        until you actually submit it or navigate away from Ledger entirely.
      </p>
    </DocsSection>
  );
}
