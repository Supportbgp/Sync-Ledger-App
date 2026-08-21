import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditModal from './EditModal.jsx';

const { searchCardImageMock } = vi.hoisted(() => ({ searchCardImageMock: vi.fn() }));
vi.mock('../../lib/cardSearch.js', () => ({
  searchCardImage: (...args) => searchCardImageMock(...args),
  tcgplayerSearchUrl: (name, set) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent([name, set].filter(Boolean).join(' '))}&view=grid`,
}));

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

  it('passes Set/Number/Rarity as hints when searching for an image', async () => {
    searchCardImageMock.mockResolvedValueOnce([{ url: 'https://x/candidate.jpg', label: 'Charizard', price: 12 }]);
    render(<EditModal card={baseCard({ set: 'Base Set' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find stock image'));
    await screen.findByTitle('Charizard');
    expect(searchCardImageMock).toHaveBeenLastCalledWith('Pokemon', 'Charizard', 'Base Set', '', '');
  });

  it('disables every search button while one search is in flight, so a double-click can\'t fire overlapping searches', async () => {
    let resolveSearch;
    searchCardImageMock.mockReturnValueOnce(new Promise((r) => { resolveSearch = r; }));
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    const findStockBtn = screen.getByRole('button', { name: 'Find stock image' });
    fireEvent.click(findStockBtn);

    expect(await screen.findByRole('button', { name: /searching/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find market price' })).toBeDisabled();

    resolveSearch([]);
    await screen.findByText('No matches found — try adjusting the name, or upload a photo.');
  });

  it('offers a manual TCGPlayer search link when the image search finds nothing', async () => {
    searchCardImageMock.mockResolvedValueOnce([]);
    render(<EditModal card={baseCard({ set: 'Base Set' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find stock image'));
    const link = await screen.findByText('Try searching TCGPlayer manually ↗');
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://www.tcgplayer.com/search/all/product?q=Charizard%20Base%20Set&view=grid',
    );
  });

  it('offers the same manual link when a price search finds a match with no price data', async () => {
    searchCardImageMock.mockResolvedValueOnce([{ url: 'https://x/candidate.jpg', label: 'Charizard', price: null }]);
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByText('Find market price'));
    await screen.findByText('Matches found, but none carry price data yet for this game.');
    expect(screen.getByText('Try searching TCGPlayer manually ↗')).toBeInTheDocument();
  });
});

describe('EditModal — Pricing section listing link', () => {
  // Yugioh/SWU searches never return a listingUrl (confirmed — see
  // CLAUDE.md) — a real report found the Pricing section going silent on a
  // clickable link entirely once basePrice was already set, with only
  // dead-end text ("worth checking the real listing") and nothing to
  // actually click.
  it('shows a direct listing link when sourceUrl is set', () => {
    render(<EditModal card={baseCard({ basePrice: 40, sourceUrl: 'https://tcg/real-listing', condition: 'NM' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Check live TCGPlayer listing ↗')).toBeInTheDocument();
    expect(screen.queryByText('Search TCGPlayer manually ↗')).not.toBeInTheDocument();
  });

  it('falls back to a manual search link when sourceUrl is blank (e.g. Yugioh/SWU today) instead of leaving nothing to click', () => {
    render(<EditModal card={baseCard({ basePrice: 40, sourceUrl: '', condition: 'NM' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const link = screen.getByText('Search TCGPlayer manually ↗');
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://www.tcgplayer.com/search/all/product?q=Charizard%20Base%20Set&view=grid',
    );
    expect(screen.queryByText('Check live TCGPlayer listing ↗')).not.toBeInTheDocument();
  });
});

describe('EditModal — Rarity picker', () => {
  it('shows Rarity as a dropdown of curated options for a game that has them (Pokemon)', () => {
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const rarity = screen.getByLabelText('Rarity');
    expect(rarity.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Special Illustration Rare' })).toBeInTheDocument();
  });

  it('falls back to a plain free-text field for a game with no curated rarity list (e.g. Gundam), instead of a select with nothing real to pick', () => {
    render(<EditModal card={baseCard({ game: 'Gundam' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText('Rarity').tagName).toBe('INPUT');
  });

  it('lets staff pick a curated rarity from the dropdown, and it narrows the next search', async () => {
    searchCardImageMock.mockResolvedValueOnce([{ url: 'https://x/candidate.jpg', label: 'Charizard', price: 12 }]);
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Rarity'), { target: { value: 'Special Illustration Rare' } });
    fireEvent.click(screen.getByText('Find stock image'));
    await screen.findByTitle('Charizard');

    expect(searchCardImageMock).toHaveBeenLastCalledWith('Pokemon', 'Charizard', 'Base Set', 'Special Illustration Rare', '');
  });
});

describe('EditModal — Condition picker', () => {
  it('shows Condition as a dropdown of the five recognized tiers for a brand-new item', () => {
    render(<EditModal card={null} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const condition = screen.getByLabelText('Condition');
    expect(condition.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Lightly Played' })).toBeInTheDocument();
  });

  it('starts in free-text mode for an existing item whose condition is a short code not in the dropdown list (e.g. "NM")', () => {
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const condition = screen.getByLabelText('Condition');
    expect(condition.tagName).toBe('INPUT');
    expect(condition.value).toBe('NM');
  });

  it('picking a condition from the dropdown feeds into the Market Value calculation', () => {
    render(
      <EditModal
        card={baseCard({ condition: '', basePrice: 100 })}
        catalog={[]} locations={[]} multipliers={{ LP: 85, MP: 65, HP: 45, DMG: 25 }}
        onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'Lightly Played' } });
    expect(screen.getByText('$85.00')).toBeInTheDocument();
  });
});

describe('EditModal — Printing/finish picker', () => {
  it('shows Printing/finish as a dropdown of curated options for a game that has them (Pokemon)', () => {
    render(<EditModal card={baseCard({ printing: '' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const printing = screen.getByLabelText('Printing / finish');
    expect(printing.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Reverse Holofoil' })).toBeInTheDocument();
  });

  it('falls back to free text for a game with no curated printing list (e.g. Gundam)', () => {
    render(<EditModal card={baseCard({ game: 'Gundam' })} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText('Printing / finish').tagName).toBe('INPUT');
  });

  it('starts in free-text mode for an existing item whose printing isn\'t one of the curated options (e.g. a legacy "Holo" value, or a Poke Ball/Master Ball pattern)', () => {
    render(<EditModal card={baseCard()} catalog={[]} locations={[]} multipliers={{}} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);
    const printing = screen.getByLabelText('Printing / finish');
    expect(printing.tagName).toBe('INPUT');
    expect(printing.value).toBe('Holo');
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
