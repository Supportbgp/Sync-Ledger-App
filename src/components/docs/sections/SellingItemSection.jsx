import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function SellingItemSection() {
  return (
    <DocsSection id="selling-an-item" title="Selling an item">
      <p>
        Select one or more rows in <a href="#catalog">Catalog</a> — click
        anywhere on a row (desktop table) or check its box — to reveal the
        batch action bar, then click <strong>Mark sold</strong>. This works
        the same for one item or several at once.
      </p>
      <DocsCallout kind="warn">
        Marking an item sold sells its <strong>entire remaining
        quantity</strong> at once — there's no partial-quantity stepper
        anymore. If you only sold some of a stack (e.g. 2 of 5 copies),
        reduce the <strong>Quantity</strong> field directly in{' '}
        <a href="#editing-an-item">Edit</a> and save instead — just note that
        doesn't create a Sync Queue ticket the way Mark sold does (below).
      </DocsCallout>
      <p>
        Confirming automatically creates a new ticket in the{' '}
        <a href="#sync-queue">Sync Queue</a> for each item sold, and resets
        its platform status chips (see <a href="#catalog">Catalog</a>) since
        whatever's listed elsewhere no longer matches what's actually left
        in stock.
      </p>
    </DocsSection>
  );
}
