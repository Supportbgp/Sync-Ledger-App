import DocsSection from '../DocsSection.jsx';

export default function GlossarySection() {
  return (
    <DocsSection id="glossary" title="Concepts & glossary">
      <dl className="docs-glossary">
        <dt>Single vs. slab</dt>
        <dd>
          A "single" is a raw, ungraded card — it has a quantity, since you
          might have several identical copies. A "slab" is a graded card in
          a professional grading company's case (PSA, BGS, CGC, etc.) —
          always unique, so it has no quantity field, but does have
          Grader/Grade/Cert fields instead.
        </dd>

        <dt>Channels</dt>
        <dd>
          Which platforms an item is actually listed on — In-store/POS, TCG
          Player, Collectr. Not every item is on every platform. Set on the
          Edit modal or Scanner; determines which status chips/stamps show
          up for that item elsewhere in the app.
        </dd>

        <dt>Sync ticket / stamp</dt>
        <dd>
          A ticket is created automatically every time something sells — see{' '}
          <a href="#sync-queue">Sync Queue</a>. A stamp is you confirming
          you've manually updated one specific platform for that sale.
        </dd>

        <dt>Active image</dt>
        <dd>
          Which of an item's two possible images (stock or real photo) is
          currently shown as the "main" one in Catalog and on the public
          binder page. Toggled in the Edit modal or Scanner review row.
        </dd>

        <dt>Market Value vs. Our Price</dt>
        <dd>
          <strong>Our Price</strong> is what you're actually charging — you
          always set it by hand, Ledger never changes it on its own.{' '}
          <strong>Market Value</strong> is a computed estimate:
          this card's Near Mint reference price × the condition percentage
          from <a href="#pricing-settings">Pricing settings</a>. It's a
          starting point for pricing, not a rule — the "Use as Our Price"
          button just fills it in, it doesn't force it.
        </dd>

        <dt>Condition tiers</dt>
        <dd>
          NM (Near Mint), LP (Lightly Played), MP (Moderately Played), HP
          (Heavily Played), DMG (Damaged) — the five tiers Market Value math
          understands. The Condition field itself is free text ("near
          mint", "lp", "heavy play" all match), but only text that
          recognizably matches one of these five gets a Market Value
          computed at all.
        </dd>
      </dl>
    </DocsSection>
  );
}
