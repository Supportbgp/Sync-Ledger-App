import DocsSection from '../DocsSection.jsx';

export default function SellingItemSection() {
  return (
    <DocsSection id="selling-an-item" title="Selling an item">
      <p>Opens from a Catalog row's Sell button.</p>
      <ul>
        <li>
          If there's only <strong>1 in stock</strong>, it's a plain "Mark
          this item as sold?" yes/no — no quantity to type.
        </li>
        <li>
          If there are <strong>more than 1</strong>, a stepper lets you pick
          exactly how many of this stack sold. Selling all of them marks the
          item sold; selling some just reduces the remaining quantity.
        </li>
      </ul>
      <p>
        Either way, confirming automatically creates a new ticket in the{' '}
        <a href="#sync-queue">Sync Queue</a> for that sale, and resets the
        platform status chips (see <a href="#catalog">Catalog</a>) since
        whatever's listed elsewhere no longer matches what's actually left
        in stock.
      </p>
    </DocsSection>
  );
}
