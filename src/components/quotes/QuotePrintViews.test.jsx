import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuotePrintSheet, ReleaseFormPrintSheet } from './QuotePrintViews.jsx';

function baseQuote(overrides = {}) {
  return {
    id: 'q1', quoteNumber: 3, collectionName: 'Jake binder proposal',
    customerName: 'Ada Lovelace', customerId: '', phone: '(317) 555-0100', customerEmail: 'ada@example.com',
    dateQuoted: '2026-08-17', employee: 'John Doe', timeTaken: '20 min',
    hasExpectedPrice: null, expectedPriceAmount: '', intakeNotes: '',
    items: [
      { id: 'i1', name: 'Charizard', game: 'Pokemon', set: 'Base Set', rarity: 'Rare Holo', condition: 'Near Mint', qty: 1, price: 40 },
      { id: 'i2', name: 'Unlisted Promo Card', game: '', set: '', rarity: '', condition: '', qty: 2, price: 5 },
    ],
    offerStatus: null, payoutAmount: null, paidOut: false, movedToSorting: false,
    ...overrides,
  };
}

describe('QuotePrintSheet', () => {
  it('renders customer/header fields, every line item, and the computed total/tiers', () => {
    render(<QuotePrintSheet quote={baseQuote()} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText('Unlisted Promo Card')).toBeInTheDocument();
    // total = 40*1 + 5*2 = 50
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument(); // 50% tier
  });

  it('shows an add-on item\'s price in the Add-ons total row, excluded from Total quoted value', () => {
    render(<QuotePrintSheet quote={baseQuote({
      items: [
        { id: 'i1', name: 'Charizard', game: 'Pokemon', set: 'Base Set', rarity: 'Rare Holo', condition: 'Near Mint', qty: 1, price: 40 },
        { id: 'i2', name: 'Binder', game: '', set: '', rarity: '', condition: '', qty: 1, price: 5, isAddOn: true },
      ],
    })} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    expect(screen.getByText('Binder')).toBeInTheDocument();
    // Total quoted value excludes the add-on (just the $40 card); the
    // add-on's own $5 shows separately in the Add-ons total row.
    expect(screen.getByText('Total quoted value').closest('tr')).toHaveTextContent('$40.00');
    expect(screen.getByText('Add-ons total').closest('tr')).toHaveTextContent('$5.00');
  });

  it('shows a bulk lot\'s flat price in the Bulk total row, excluded from Total quoted value, and not multiplied by qty in Line total', () => {
    render(<QuotePrintSheet quote={baseQuote({
      items: [
        { id: 'i1', name: 'Charizard', game: 'Pokemon', set: 'Base Set', rarity: 'Rare Holo', condition: 'Near Mint', qty: 1, price: 40 },
        { id: 'i2', name: 'Pokemon surge bulk', game: 'Pokemon', set: '', rarity: '', condition: '', qty: 20, price: 5, isBulk: true },
      ],
    })} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    expect(screen.getByText('Pokemon surge bulk')).toBeInTheDocument();
    // Total quoted value excludes the bulk lot (just the $40 card); the
    // lot's own flat $5 shows separately in the Bulk total row, not $100
    // (5 × 20) in either place.
    expect(screen.getByText('Total quoted value').closest('tr')).toHaveTextContent('$40.00');
    expect(screen.getByText('Bulk total').closest('tr')).toHaveTextContent('$5.00');
    expect(screen.getByText('Pokemon surge bulk').closest('tr')).toHaveTextContent('$5.00');
    expect(screen.getByText('Pokemon surge bulk').closest('tr')).not.toHaveTextContent('$100.00');
  });

  it('shows an altered card\'s delta next to its price, and folds it into the tier amounts', () => {
    render(<QuotePrintSheet quote={baseQuote({
      items: [
        { id: 'i1', name: 'Charizard', game: 'Pokemon', set: 'Base Set', rarity: 'Rare Holo', condition: 'Near Mint', qty: 1, price: 100 },
        { id: 'i2', name: 'Heavily Played Lugia', game: 'Pokemon', set: '', rarity: '', condition: '', qty: 1, price: 100, pctAltered: true, pctDelta: -20 },
      ],
    })} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    expect(screen.getByText('Heavily Played Lugia')).toBeInTheDocument();
    expect(screen.getByText('Heavily Played Lugia').closest('tr')).toHaveTextContent('(-20%)');
    // tier1 = 100×50% (unaltered) + 100×30% (50-20, altered) = 50 + 30 = 80.
    expect(screen.getByText('50% offer').closest('tr')).toHaveTextContent('$80.00');
  });

  it('shows a flat add-on\'s opted-in percentage in its Line total and the Add-ons total row', () => {
    render(<QuotePrintSheet quote={baseQuote({
      items: [
        { id: 'i1', name: '5 bulk commons', game: '', set: '', rarity: '', condition: '', qty: 5, price: 10, isAddOn: true, pctEnabled: true, pctValue: 60 },
      ],
    })} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    // Price column shows the raw $10.00 entered; Line total shows the
    // computed 60% ($6.00), not $10 × qty 5 ($50) or raw $10.
    expect(screen.getByText('5 bulk commons').closest('tr')).toHaveTextContent('$6.00');
    expect(screen.getByText('Add-ons total').closest('tr')).toHaveTextContent('$6.00');
  });

  it('omits the quote number for a not-yet-saved draft', () => {
    render(<QuotePrintSheet quote={baseQuote({ id: null, quoteNumber: null })} tierSettings={{ tier1: 50, tier2: 60, tier3: 70 }} />);
    expect(screen.queryByText(/Quote #/)).not.toBeInTheDocument();
    expect(screen.getByText('Jake binder proposal')).toBeInTheDocument();
  });
});

describe('ReleaseFormPrintSheet', () => {
  it('reproduces the paper form\'s exact wording and pre-fills the known blanks', () => {
    render(<ReleaseFormPrintSheet quote={baseQuote({ intakeNotes: '38 total cards, no real tears visible' })} />);
    expect(screen.getByText('Quote Release Form')).toBeInTheDocument();
    expect(screen.getByText(/giving us permission to hold your products/)).toBeInTheDocument();
    expect(screen.getByText(/relinquishing ownership of the product/)).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('(317) 555-0100')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('38 total cards, no real tears visible')).toBeInTheDocument();
    expect(screen.getByText(/Signature:/)).toBeInTheDocument();
  });

  it('leaves Yes/No unbolded when the customer was never asked (hasExpectedPrice is null)', () => {
    render(<ReleaseFormPrintSheet quote={baseQuote({ hasExpectedPrice: null })} />);
    expect(screen.getByText('Yes')).toHaveStyle({ fontWeight: 400 });
    expect(screen.getByText('No')).toHaveStyle({ fontWeight: 400 });
  });

  it('bolds "Yes" and shows the amount when the customer does have a number in mind', () => {
    render(<ReleaseFormPrintSheet quote={baseQuote({ hasExpectedPrice: true, expectedPriceAmount: '$150' })} />);
    expect(screen.getByText('Yes')).toHaveStyle({ fontWeight: 700 });
    expect(screen.getByText('No')).toHaveStyle({ fontWeight: 400 });
    expect(screen.getByText('$150')).toBeInTheDocument();
  });
});
