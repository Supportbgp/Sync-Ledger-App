import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CatalogPanel from './CatalogPanel.jsx';

vi.mock('../../context/UIContext.jsx', () => ({
  useUI: () => ({ showConfirm: vi.fn(async () => true) }),
}));

function makeCard(overrides = {}) {
  return {
    sku: 'sku-1', name: 'Charizard', set: 'Base Set', game: 'Pokemon', condition: 'NM', printing: 'Holo',
    rarity: 'Double Rare', itemType: 'single', grader: '', grade: '', qty: 3, price: 45, notes: '',
    sourceUrl: '', location: '', lastUpdated: Date.now(), sold: false,
    posSynced: true, tcgplayerSynced: false, collectrSynced: false,
    posChannel: true, tcgplayerChannel: true, collectrChannel: true,
    imageUrl: '', imageData: '', photoUrl: '', photoData: '', activeImage: 'photo',
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    catalog: [], onSaveCard: vi.fn(), onDeleteCard: vi.fn(),
    onBatchDelete: vi.fn(), onBatchSell: vi.fn(), onTogglePlatformStatus: vi.fn(),
    multipliers: {},
    ...overrides,
  };
}

describe('CatalogPanel — Rarity/Condition/Printing filters', () => {
  it('hides the Rarity/Condition/Printing filters until a single game is selected', () => {
    const catalog = [
      makeCard({ sku: 'a', rarity: 'Double Rare' }),
      makeCard({ sku: 'b', game: 'Magic', rarity: '', condition: 'LP', printing: 'Foil' }),
    ];
    render(<CatalogPanel {...baseProps({ catalog })} />);

    expect(screen.queryByText('All rarities')).not.toBeInTheDocument();
    expect(screen.queryByText('All conditions')).not.toBeInTheDocument();
    expect(screen.queryByText('All printings')).not.toBeInTheDocument();
  });

  it('shows filters scoped to the selected game\'s own real values once a game is picked', () => {
    const catalog = [
      makeCard({ sku: 'a', rarity: 'Double Rare' }),
      makeCard({ sku: 'b', game: 'Magic', rarity: '', condition: 'LP', printing: 'Foil' }),
    ];
    render(<CatalogPanel {...baseProps({ catalog })} />);

    fireEvent.change(screen.getByDisplayValue('All games'), { target: { value: 'Pokemon' } });

    expect(screen.getByText('All rarities')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Double Rare' })).toBeInTheDocument();
    // Magic's condition/printing values must not leak into Pokemon's list.
    expect(screen.queryByRole('option', { name: 'LP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Foil' })).not.toBeInTheDocument();
  });

  it('actually filters the table rows when a rarity is picked', () => {
    const catalog = [
      makeCard({ sku: 'a', name: 'Charizard', rarity: 'Double Rare' }),
      makeCard({ sku: 'b', name: 'Pikachu', rarity: 'Illustration Rare' }),
    ];
    render(<CatalogPanel {...baseProps({ catalog })} />);

    fireEvent.change(screen.getByDisplayValue('All games'), { target: { value: 'Pokemon' } });
    fireEvent.change(screen.getByDisplayValue('All rarities'), { target: { value: 'Double Rare' } });

    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });

  it('resets the rarity/condition/printing filters when the game changes, instead of silently filtering everything out', () => {
    const catalog = [
      makeCard({ sku: 'a', name: 'Charizard', game: 'Pokemon', rarity: 'Double Rare' }),
      makeCard({ sku: 'b', name: 'Black Lotus', game: 'Magic', rarity: '' }),
    ];
    render(<CatalogPanel {...baseProps({ catalog })} />);

    fireEvent.change(screen.getByDisplayValue('All games'), { target: { value: 'Pokemon' } });
    fireEvent.change(screen.getByDisplayValue('All rarities'), { target: { value: 'Double Rare' } });
    expect(screen.getByText('Charizard')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Pokemon'), { target: { value: 'Magic' } });

    expect(screen.getByText('Black Lotus')).toBeInTheDocument();
    // Magic has no rarity values in this catalog, so the filter itself
    // shouldn't even render — not just be reset to blank.
    expect(screen.queryByText('All rarities')).not.toBeInTheDocument();
  });
});
