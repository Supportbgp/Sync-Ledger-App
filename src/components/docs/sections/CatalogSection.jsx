import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function CatalogSection() {
  return (
    <DocsSection id="catalog" title="Catalog">
      <p>
        The Catalog tab is the full inventory list. On a desktop it's a
        dense table; on a phone it switches to a stack of tappable cards —
        tap a card to expand it and see SKU, last-updated time, notes, and
        the Edit/Sell buttons.
      </p>

      <h3>Finding something</h3>
      <p>
        The search box matches name, set, SKU, notes, and location all at
        once. The Game/Location/Type/Status dropdowns narrow it further —
        Type filters Singles vs. Slabs, Status filters Available vs. Sold.
      </p>
      <DocsCallout kind="note">
        The table only renders the first 400 matching rows at a time, for
        performance — a card you know is in stock but don't see is
        probably just past that cut, not missing. Click{' '}
        <strong>Load more…</strong> at the bottom to render every match at
        once (useful before a "Select all visible" that needs to reach
        everything), or narrow your search instead.
      </DocsCallout>

      <h3>Selecting and acting on multiple items</h3>
      <p>
        Check the boxes on the left of any rows (or "Select all visible" —
        it only selects what's currently filtered into view, not the whole
        catalog) to reveal a batch action bar: <strong>Mark sold</strong> or{' '}
        <strong>Delete</strong>, both of which ask you to confirm first.
        Deleting is permanent.
      </p>

      <h3>Per-row actions</h3>
      <p>
        <strong>Edit</strong> opens the full item editor (see{' '}
        <a href="#editing-an-item">Editing an item</a>). <strong>Sell</strong>{' '}
        marks it sold (see <a href="#selling-an-item">Selling an item</a>) —
        it's greyed out for items that are already sold or have zero
        quantity. Tapping the thumbnail image zooms it.
      </p>

      <h3>The platform status chips (P / T / C)</h3>
      <p>
        Each row can show up to three small chips — <strong>P</strong>{' '}
        (in-store/POS), <strong>T</strong> (TCG Player), <strong>C</strong>{' '}
        (Collectr) — one per platform this item is actually enrolled in (an
        item not sold on Collectr, say, just won't show a C chip at all).
        Tapping a chip toggles it directly, right there in the table — it's
        a manual "I've updated this on that platform myself" mark, separate
        from the Sync Queue's own tickets.
      </p>
      <DocsCallout kind="warn">
        Editing an item's price, quantity, condition, or sold status resets
        all of its chips back to unchecked automatically. That's expected —
        Ledger assumes any of those changes means whatever's listed
        elsewhere is now out of date and needs re-checking, not a bug in the
        chip itself.
      </DocsCallout>

      <h3>The two pricing warnings</h3>
      <p>
        Saving an item can trigger a small toast message — neither one blocks
        the save, they're just worth reading:
      </p>
      <ul>
        <li>
          <strong>Price ordering</strong>: this copy's price doesn't line up
          with a better/worse-condition copy of the same card in the same
          binder/case (e.g. a Lightly Played copy priced above a Near Mint
          one).
        </li>
        <li>
          <strong>Price vs. Market Value</strong>: Our Price is more than 15%
          off this card's own estimated Market Value (see{' '}
          <a href="#glossary">Market Value vs. Our Price</a>).
        </li>
      </ul>
    </DocsSection>
  );
}
