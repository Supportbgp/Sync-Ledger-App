import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditModal from './EditModal.jsx';

const { searchCardImageMock } = vi.hoisted(() => ({ searchCardImageMock: vi.fn() }));
vi.mock('../../lib/cardSearch.js', () => ({ searchCardImage: (...args) => searchCardImageMock(...args) }));

vi.mock('../../context/UIContext.jsx', () => ({
  useUI: () => ({ showConfirm: vi.fn(async () => true), openLightbox: vi.fn() }),
}));

function baseCard(overrides = {}) {
  return {
    sku: 'sku-1', name: 'Charizard', game: 'Pokemon', set: 'Base Set', condition: 'NM', printing: 'Holo',
    qty: 1, price: 45, notes: '', itemType: 'single', grader: '', grade: '', certNumber: '', sold: false,
    sourceUrl: '', location: '', lastUpdated: Date.now(),
    posChannel: true, tcgplayerChannel: true, collectrChannel: true,
    imageUrl: '', imageData: '', photoUrl: '', photoData: '', activeImage: 'photo', basePrice: null,
    ...overrides,
  };
}

beforeEach(() => {
  searchCardImageMock.mockReset();
});

describe('EditModal — image candidate selection', () => {
  it('picking a "Find stock image" candidate sets the preview, base price, and source URL', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      { url: 'https://x/candidate.jpg', label: 'Charizard (Base Set)', price: 12, listingUrl: 'https://tcg/charizard' },
    ]);
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find stock image'));
    const candidate = await screen.findByTitle('Charizard (Base Set)');
    fireEvent.click(candidate);

    expect(document.querySelector('img.img-preview').src).toBe('https://x/candidate.jpg');
    expect(screen.getAllByText('$12.00').length).toBeGreaterThan(0); // NM reference (basePrice)
  });

  it('picking a "Find market price" candidate backfills price without touching the image', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      { url: 'https://x/candidate.jpg', label: 'Charizard (Base Set)', price: 12, listingUrl: 'https://tcg/charizard' },
    ]);
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find market price'));
    const candidate = await screen.findByTitle('Charizard (Base Set)');
    fireEvent.click(candidate);

    // The card had no stock/photo image to begin with, and this path must
    // never populate one — the preview should still show "No image".
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(screen.getAllByText('$12.00').length).toBeGreaterThan(0);
  });

  it('picking a confirmed candidate backfills Set/Number/Rarity from that print\'s real data', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      {
        url: 'https://x/clefairy.jpg', label: "Lillie's Clefairy ex (Ascended Heroes) #280", price: 12,
        listingUrl: 'https://tcg/x', set: 'Ascended Heroes', number: '280/217', rarity: 'Special Illustration Rare',
      },
    ]);
    // The scan's own (wrong) guess — should be overwritten by the confirmed pick.
    render(<EditModal card={baseCard({ set: 'Scarlet & Violet' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find stock image'));
    const candidate = await screen.findByTitle("Lillie's Clefairy ex (Ascended Heroes) #280");
    fireEvent.click(candidate);

    expect(screen.getByDisplayValue('Ascended Heroes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('280/217')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Special Illustration Rare')).toBeInTheDocument();
  });

  it('leaves Set/Number/Rarity alone when a candidate carries none of that data (e.g. every non-Pokemon game today)', async () => {
    searchCardImageMock.mockResolvedValueOnce([
      { url: 'https://x/luffy.jpg', label: 'Luffy', price: 5, listingUrl: '' },
    ]);
    render(<EditModal card={baseCard({ game: 'One Piece', set: 'OP01' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find stock image'));
    const candidate = await screen.findByTitle('Luffy');
    fireEvent.click(candidate);

    expect(screen.getByDisplayValue('OP01')).toBeInTheDocument();
  });
});

describe('EditModal — per-location channel defaults', () => {
  const catalog = [
    { location: 'Binder A', posChannel: true, tcgplayerChannel: false, collectrChannel: true },
    { location: 'Binder A', posChannel: true, tcgplayerChannel: false, collectrChannel: true },
    { location: 'Binder A', posChannel: true, tcgplayerChannel: true, collectrChannel: true },
  ];

  function locationSelect() {
    return screen.getByLabelText('Binder / case / collection');
  }

  it('follows the majority channel usage of the chosen location for a brand-new item', () => {
    render(<EditModal card={null} catalog={catalog} locations={['Binder A']} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(locationSelect(), { target: { value: 'Binder A' } });

    expect(screen.getByLabelText('In-store / POS')).toBeChecked();
    expect(screen.getByLabelText('TCG Player')).not.toBeChecked(); // minority (1/3)
    expect(screen.getByLabelText('Collectr')).toBeChecked();
  });

  it('stops following location defaults once staff manually touch a channel checkbox', () => {
    const catalogAllTcg = [
      { location: 'Binder B', posChannel: true, tcgplayerChannel: true, collectrChannel: true },
    ];
    render(<EditModal card={null} catalog={[...catalog, ...catalogAllTcg]} locations={['Binder A', 'Binder B']} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.change(locationSelect(), { target: { value: 'Binder A' } });
    expect(screen.getByLabelText('TCG Player')).not.toBeChecked();

    // Staff explicitly re-checks TCG Player themselves.
    fireEvent.click(screen.getByLabelText('TCG Player'));
    expect(screen.getByLabelText('TCG Player')).toBeChecked();

    // Switching location again must not silently override that manual choice.
    fireEvent.change(locationSelect(), { target: { value: 'Binder B' } });
    expect(screen.getByLabelText('TCG Player')).toBeChecked();
  });
});
