import DocsSection from '../DocsSection.jsx';

export default function SyncQueueSection() {
  return (
    <DocsSection id="sync-queue" title="Sync Queue">
      <p>
        Every sale — from the Sell modal or a batch sell in Catalog —
        automatically creates a <strong>ticket</strong> here. A ticket is a
        snapshot of what sold (name, condition, price, quantity) and which
        platforms it was actually listed on <em>at the moment of sale</em> —
        editing the item's channels afterward doesn't change what an
        already-created ticket requires.
      </p>
      <p>
        Each ticket shows a stamp for every platform it applies to —{' '}
        <strong>POS</strong>, <strong>TCG Player</strong>,{' '}
        <strong>Collectr</strong> — tap a stamp once you've gone and updated
        that system yourself. Once every applicable stamp is tapped, the
        ticket moves down into "Completed today."
      </p>
      <p>
        The pending-sync badge in the topbar counts tickets here that aren't
        fully stamped yet — that's the number it's showing you all day.
      </p>
    </DocsSection>
  );
}
