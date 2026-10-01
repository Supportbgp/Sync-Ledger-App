import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuoteLineItemRow from './QuoteLineItemRow.jsx';
import { normalizeQuoteItem } from '../../lib/quoteUtils.js';

const { searchCardImageMock } = vi.hoisted(() => ({ searchCardImageMock: vi.fn() }));
vi.mock('../../lib/cardSearch.js', () => ({
  searchCardImage: (...args) => searchCardImageMock(...args),
  tcgplayerSearchUrl: (name, set) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent([name, set].filter(Boolean).join(' '))}&view=grid`,
  ebaySoldSearchUrl: (name, set) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent([name, set].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`,
  priceChartingSearchUrl: (name, set) => `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent([name, set].filter(Boolean).join(' '))}`,
}));

vi.mock('../../context/UIContext.jsx', () => ({
  useUI: () => ({ openLightbox: vi.fn() }),
}));

beforeEach(() => {
  searchCardImageMock.mockReset();
});

function renderRow(overrides = {}) {
  const item = normalizeQuoteItem({ name: 'Charizard', game: 'Pokemon', set: 'Scarlet & Violet', ...overrides });
  const onChange = vi.fn();
  render(<QuoteLineItemRow item={item} onChange={onChange} onRemove={vi.fn()} catalog={[]} multipliers={{}} />);
  return { item, onChange };
}

describe('QuoteLineItemRow — candidate selection backfill', () => {
  it('picking a "Find price" candidate backfills Set/Number/Rarity too, matching EditModal — not just price and the source link', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      {
        url: 'https://x/clefairy.jpg', label: "Lillie's Clefairy ex (Ascended Heroes) #280", price: 12,
        listingUrl: 'https://tcg/x', set: 'Ascended Heroes', number: '280/217', rarity: 'Special Illustration Rare',
      },
    ]);
    const { onChange } = renderRow();

    fireEvent.click(screen.getByText('Find price'));
    const candidate = await screen.findByTitle("Lillie's Clefairy ex (Ascended Heroes) #280");
    fireEvent.click(candidate);

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      set: 'Ascended Heroes', number: '280/217', rarity: 'Special Illustration Rare',
      basePrice: 12, sourceUrl: 'https://tcg/x',
    }));
  });

  it('picking a "Find image" candidate still backfills Set/Number/Rarity, same as before this fix', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      {
        url: 'https://x/clefairy.jpg', label: "Lillie's Clefairy ex (Ascended Heroes) #280",
        set: 'Ascended Heroes', number: '280/217', rarity: 'Special Illustration Rare',
      },
    ]);
    const { onChange } = renderRow();

    fireEvent.click(screen.getByText('Find image'));
    const candidate = await screen.findByTitle("Lillie's Clefairy ex (Ascended Heroes) #280");
    fireEvent.click(candidate);

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      set: 'Ascended Heroes', number: '280/217', rarity: 'Special Illustration Rare',
      imageUrl: 'https://x/clefairy.jpg',
    }));
  });

  it('leaves Set/Number/Rarity alone on a price-mode pick when the candidate carries none of that data', async () => {
    searchCardImageMock.mockResolvedValueOnce([{ url: 'https://x/luffy.jpg', label: 'Luffy', price: 5, listingUrl: '' }]);
    const { onChange } = renderRow({ game: 'One Piece', set: 'OP01', rarity: 'Rare' });

    fireEvent.click(screen.getByText('Find price'));
    const candidate = await screen.findByTitle('Luffy');
    fireEvent.click(candidate);

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ set: 'OP01', rarity: 'Rare', basePrice: 5 }));
  });
});
