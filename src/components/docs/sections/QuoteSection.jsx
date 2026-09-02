import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function QuoteSection() {
  return (
    <DocsSection id="quote" title="Quote">
      <p>
        The Quote tab is for <strong>buying cards</strong> — the reverse of
        everything else in Ledger. Catalog, Scanner, and Import are about
        the shop's own stock going <em>out</em>; Quote is about cards
        coming <em>in</em>, from a customer who wants to sell or trade them
        to the shop.
      </p>

      <h3>Starting a quote</h3>
      <p>
        <strong>+ New Quote</strong> offers two ways in: <strong>Resume a
        collection</strong> (an in-progress quote you already started —
        e.g. "Jake binder proposal" — that hasn't been Accepted or Rejected
        yet), or start a brand-new one by typing a{' '}
        <strong>Collection name</strong>. Nothing is saved to the database
        until you actually hit <strong>Save</strong> the first time — closing
        out of a just-created quote with Cancel leaves no trace behind.
      </p>

      <h3>Adding cards to a quote</h3>
      <p>
        Three ways, freely mixable on the same quote — scan a binder page,
        then add a couple more by hand, for example:
      </p>
      <ul>
        <li>
          <strong>+ Add card manually</strong> — type a name; if it matches
          something already in this shop's own Catalog, picking it backfills
          Game/Set/Rarity/Printing/Market Value automatically. No match?
          Just fill the fields in by hand — a brand-new trade-in card has no
          catalog history to reference yet, which is expected.
        </li>
        <li>
          <strong>+ Add cards by scanning</strong> — the same Scanner used
          in <a href="#scan-binder">Scan Binder</a>, embedded here; detected
          cards get added to this quote instead of straight to Catalog.
        </li>
        <li>
          <strong>+ Add cards by import</strong> — the same spreadsheet
          import used in <a href="#import-export">Import / Export</a>, minus
          the "Replace entire catalog" option (meaningless for a quote).
        </li>
      </ul>
      <DocsCallout kind="note">
        Each card row also has its own <strong>Find image</strong>/
        <strong>Find price</strong> buttons and manual TCGPlayer/eBay
        sold-listings/PriceCharting reference links, same as Catalog's Edit
        modal — the live search is available per card, not just when
        scanning/importing a batch.
      </DocsCallout>

      <h3>Condition is never pre-filled</h3>
      <p>
        Unlike every other Condition field in Ledger, a quote line item's
        Condition always starts blank — it's a real, on-the-spot physical
        assessment of a card you're about to pay for, not something to
        default and possibly forget to actually check.
      </p>

      <h3>Total, tiers, and the offer decision</h3>
      <p>
        The total quoted value and three offer amounts (defaulting
        50%/60%/70%, adjustable via the <strong>Quote settings</strong> link
        next to "+ New Quote") update live as you add/price cards. "Use"
        next to any tier fills that amount straight into{' '}
        <strong>Payout amount</strong>. Set <strong>Offer status</strong> to{' '}
        <strong>Accepted Cash</strong>, <strong>Accepted Store
        Credit</strong>, or <strong>Rejected Offer</strong> once a decision
        is made, and check <strong>Paid out</strong> once the payout is
        actually handed over.
      </p>
      <DocsCallout kind="warn">
        Saving a quote as Accepted (either Cash or Store Credit) moves every
        card on it into the <a href="#sorting">Sorting</a> queue — it does{' '}
        <strong>not</strong> go straight into Catalog. Cards from the same
        quote can end up in different binders or as Bulk, so that decision
        happens afterward, one card at a time.
      </DocsCallout>

      <h3>Release form info</h3>
      <p>
        A separate section for the shop's real paper intake form — whether
        the customer already has a price in mind, what number if so, and a
        free-text description of what's actually being left with the shop.
        <strong> Print Release Form</strong> lives at the top of this section
        and prints a physical copy of the intake form matching the shop's
        paper original — meant to be signed with a pen on the spot, not a
        digital signature feature.
        <strong> Print Quote</strong>, an internal record of the whole quote,
        lives the same way at the top of the Total &amp; offer section below
        instead.
      </p>

      <h3>Collapsible sections</h3>
      <p>
        A quote's four sections — Quote details, Release form info, Cards,
        Total &amp; offer — each collapse independently by clicking their
        header, so you can jump straight to, say, Total &amp; offer on a
        long card-heavy quote without scrolling past everything else.
      </p>

      <h3>Finding a quote later</h3>
      <p>
        The Quote list is searchable by collection/customer name, filterable
        by status (quick toggle buttons — All/In progress/Accepted Cash/
        Accepted Store Credit/Rejected), sortable by column, and
        color-tinted by outcome. Quotes are never shown or referenced from
        Catalog — every quote lives only in its own view here.
      </p>
    </DocsSection>
  );
}
