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
    offerStatus: null, payoutAmount: null, paidOut: false, convertedToCatalog: false,
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
