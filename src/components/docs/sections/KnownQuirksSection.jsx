import DocsSection from '../DocsSection.jsx';

export default function KnownQuirksSection() {
  return (
    <DocsSection id="known-quirks" title="Known quirks">
      <p>
        A few things that are expected behavior, not something broken —
        worth knowing before they cause a "wait, is this working right?"
        moment.
      </p>
      <ul>
        <li>
          <strong>Signing out reloads the page.</strong> If you have an
          unsaved modal open somewhere, it's gone after signing out — save
          first.
        </li>
        <li>
          <strong>Editing/selling an item resets its P/T/C status
          chips.</strong> Intentional — see{' '}
          <a href="#catalog">Catalog</a>.
        </li>
        <li>
          <strong>Catalog only shows the first 400 matching rows.</strong>{' '}
          Narrow your search if you're not seeing everything you expect.
        </li>
        <li>
          <strong>Market Value is an estimate, not real per-condition
          pricing.</strong> Especially on higher-value cards, it can be off
          by real money — check the live listing link before trusting it on
          anything expensive.
        </li>
        <li>
          <strong>On mobile, choosing a multi-sheet .xlsx file for Import
          sometimes skips straight to the first sheet</strong> instead of
          showing the sheet picker (desktop shows it correctly). If you
          need a specific sheet from a multi-sheet file, it's currently
          more reliable to do that import from a desktop/laptop.
        </li>
        <li>
          <strong>Reset all data affects everyone</strong> sharing this
          login, not just your own session, and can't be undone.
        </li>
      </ul>
    </DocsSection>
  );
}
