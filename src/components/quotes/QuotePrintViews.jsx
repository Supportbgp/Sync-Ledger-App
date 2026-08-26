import { computeQuoteTotals, computeOfferTiers } from '../../lib/quoteUtils.js';

// Both sheets render permanently in the DOM (display:none on screen) and
// are only made visible by the .print-sheet CSS rule under @media print —
// see index.css. That rule hides everything else on the page and shows
// only this one, positioned absolute so it doesn't matter where it sits
// in the component tree. Plain inline styles here rather than app CSS
// classes, since print typography (serif-free, black-on-white, real
// borders) is a one-off concern that doesn't belong in the shared
// stylesheet used everywhere else.

const cell = { border: '1px solid #000', padding: '4px 6px', fontSize: '11px', textAlign: 'left' };
const th = { ...cell, background: '#eee', fontWeight: 700 };

export function QuotePrintSheet({ quote, tierSettings }) {
  const { qty, total } = computeQuoteTotals(quote.items);
  const tiers = computeOfferTiers(total, tierSettings);
  return (
    <div className="print-sheet" style={{ fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
      <h1 style={{ fontSize: '18px', margin: '0 0 4px' }}>Board Game Paradise — Quote</h1>
      <div style={{ fontSize: '12px', marginBottom: '12px' }}>
        {quote.id ? `Quote #${quote.quoteNumber} — ` : ''}{quote.collectionName}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '12px' }}>
        <tbody>
          <tr><td style={th}>Customer</td><td style={cell}>{quote.customerName || '—'}</td><td style={th}>Customer ID</td><td style={cell}>{quote.customerId || '—'}</td></tr>
          <tr><td style={th}>Phone</td><td style={cell}>{quote.phone || '—'}</td><td style={th}>Email</td><td style={cell}>{quote.customerEmail || '—'}</td></tr>
          <tr><td style={th}>Date</td><td style={cell}>{quote.dateQuoted || '—'}</td><td style={th}>Employee</td><td style={cell}>{quote.employee || '—'}</td></tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '12px' }}>
        <thead>
          <tr>
            <th style={th}>Name</th><th style={th}>Game</th><th style={th}>Set</th><th style={th}>Rarity</th>
            <th style={th}>Condition</th><th style={th}>Qty</th><th style={th}>Price</th><th style={th}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map(item => (
            <tr key={item.id}>
              <td style={cell}>{item.name}</td>
              <td style={cell}>{item.game}</td>
              <td style={cell}>{item.set}</td>
              <td style={cell}>{item.rarity}</td>
              <td style={cell}>{item.condition}</td>
              <td style={cell}>{item.qty}</td>
              <td style={cell}>{item.price != null ? `$${Number(item.price).toFixed(2)}` : '—'}</td>
              <td style={cell}>{item.price != null ? `$${(Number(item.price) * Number(item.qty)).toFixed(2)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ borderCollapse: 'collapse', marginBottom: '12px' }}>
        <tbody>
          <tr><td style={th}>Total items</td><td style={cell}>{qty}</td></tr>
          <tr><td style={th}>Total quoted value</td><td style={cell}>${total.toFixed(2)}</td></tr>
          <tr><td style={th}>{tierSettings.tier1}% offer</td><td style={cell}>${tiers.tier1.toFixed(2)}</td></tr>
          <tr><td style={th}>{tierSettings.tier2}% offer</td><td style={cell}>${tiers.tier2.toFixed(2)}</td></tr>
          <tr><td style={th}>{tierSettings.tier3}% offer</td><td style={cell}>${tiers.tier3.toFixed(2)}</td></tr>
        </tbody>
      </table>

      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={th}>Offer status</td>
            <td style={cell}>{quote.offerStatus ? quote.offerStatus.replace(/_/g, ' ') : 'Still deciding'}</td>
            <td style={th}>Payout amount</td>
            <td style={cell}>{quote.payoutAmount != null ? `$${Number(quote.payoutAmount).toFixed(2)}` : '—'}</td>
            <td style={th}>Paid out</td>
            <td style={cell}>{quote.paidOut ? 'Yes' : 'No'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Verbatim reproduction of the shop's real paper "Quote Release Form" —
// same wording/order as the printed original, with the handwritten blanks
// pre-filled from this quote where known. Signature is left blank on
// purpose: this is meant to be printed and physically signed with a pen,
// same as the original, not a digital-signature feature.
export function ReleaseFormPrintSheet({ quote }) {
  const yesNo = (
    <span>
      <span style={{ fontWeight: quote.hasExpectedPrice === true ? 700 : 400, textDecoration: quote.hasExpectedPrice === true ? 'underline' : 'none' }}>Yes</span>
      {' / '}
      <span style={{ fontWeight: quote.hasExpectedPrice === false ? 700 : 400, textDecoration: quote.hasExpectedPrice === false ? 'underline' : 'none' }}>No</span>
    </span>
  );
  const blank = (text) => (
    <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '160px', paddingBottom: '1px' }}>
      {text || ' '}
    </span>
  );
  return (
    <div className="print-sheet" style={{ fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', fontSize: '13px', lineHeight: 1.5 }}>
      <h1 style={{ fontSize: '18px', textAlign: 'center', marginBottom: '16px' }}>Quote Release Form</h1>

      <p>
        You are giving us permission to hold your products long enough to generate a quote. Once a quote has been
        created we will meet with you again to give you an offer. You can choose to accept the offer or take your
        products back. There is no obligation to accept the offer.
      </p>

      <p>
        If you choose to not sell us your products please pick them up as soon as possible as we do not offer
        storage services and we are limited on space. Once you have been contacted that a quote has been created,
        if you do not pick up your products within 30 days you are relinquishing ownership of the product and
        giving ownership to Board Game Paradise.
      </p>

      <p>
        Do you have a price in mind, a perceived value, or an offer you've already been given? {yesNo}<br />
        If so, what is that number? {blank(quote.expectedPriceAmount)}
      </p>

      <p>
        Date: {blank(quote.dateQuoted)} Name: {blank(quote.customerName)}<br />
        Phone: {blank(quote.phone)} Email: {blank(quote.customerEmail)}
      </p>

      <p style={{ marginBottom: '4px' }}>
        Description of product being left: (# of cards, box or binder they are in, any condition notes, specific
        cards of value…)
      </p>
      <div style={{ border: '1px solid #000', minHeight: '140px', padding: '6px', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
        {quote.intakeNotes}
      </div>

      <p>
        You are releasing these products above, and nothing additional, to Board Game Paradise to create a quote
        and potentially buy these products from you. Only the items above will be returned. If it is not listed
        above there is no liability for us to return.
      </p>

      <p style={{ marginTop: '32px' }}>
        Signature: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '260px' }}>&nbsp;</span>
      </p>
    </div>
  );
}
