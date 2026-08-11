import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function PublicBinderSection() {
  return (
    <DocsSection id="public-binder-page" title="The public binder page">
      <p>
        This is what a customer sees when they scan a binder's printed QR
        code (generated from <a href="#import-export">Import / Export</a>)
        — a simple grid of everything currently in stock in that one
        binder/case: image, name, set/condition/printing, quantity, and
        price. No login, nothing else in Ledger is reachable from it.
      </p>
      <DocsCallout kind="note">
        It's a live lookup, not a snapshot — as soon as an item sells or its
        price changes in Ledger, the page reflects it immediately. You can
        tell a customer confidently that what they're looking at is current.
      </DocsCallout>
    </DocsSection>
  );
}
