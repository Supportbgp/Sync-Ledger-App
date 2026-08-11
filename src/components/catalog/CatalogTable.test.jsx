import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CatalogTable from './CatalogTable.jsx';

const { useIsMobileMock } = vi.hoisted(() => ({ useIsMobileMock: vi.fn(() => false) }));
vi.mock('../../hooks/useIsMobile.js', () => ({ useIsMobile: useIsMobileMock }));

const { openLightboxMock } = vi.hoisted(() => ({ openLightboxMock: vi.fn() }));
vi.mock('../../context/UIContext.jsx', () => ({ useUI: () => ({ openLightbox: openLightboxMock }) }));

function makeCard(overrides = {}) {
  return {
    sku: 'sku-1', name: 'Charizard', set: 'Base Set', game: 'Pokemon', condition: 'NM', printing: 'Holo',
    itemType: 'single', grader: '', grade: '', qty: 3, price: 45, notes: '', sourceUrl: '', location: '',
    lastUpdated: Date.parse('2026-01-01T00:00:00.000Z'), sold: false,
    posSynced: true, tcgplayerSynced: false, collectrSynced: false,
    posChannel: true, tcgplayerChannel: true, collectrChannel: true,
    imageUrl: '', imageData: '', photoUrl: '', photoData: '', activeImage: 'photo',
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    catalogEmpty: false,
    rows: [makeCard()],
    sortState: { col: 'name', dir: 1 },
    onSort: vi.fn(),
    selectedSkus: new Set(),
    onToggleSelected: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onEdit: vi.fn(),
    onSell: vi.fn(),
    onTogglePlatformStatus: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  useIsMobileMock.mockReturnValue(false);
  openLightboxMock.mockClear();
});

describe('CatalogTable — empty states', () => {
  it('shows the "no catalog" message when catalogEmpty is true', () => {
    render(<CatalogTable {...baseProps({ catalogEmpty: true, rows: [] })} />);
    expect(screen.getByText('No catalog yet')).toBeInTheDocument();
  });

  it('shows the "no matches" message when there is a catalog but the filtered rows are empty', () => {
    render(<CatalogTable {...baseProps({ rows: [] })} />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });
});

describe('CatalogTable — desktop table (deriveRow)', () => {
  it('renders the subtitle line joining set/condition/printing, and the game tag', () => {
    render(<CatalogTable {...baseProps()} />);
    expect(screen.getByText('Base Set · NM · Holo')).toBeInTheDocument();
    expect(screen.getByText('Pokemon')).toBeInTheDocument();
  });

  it('appends grader/grade to the subtitle for a slab, with a real space between them', () => {
    const card = makeCard({ itemType: 'slab', grader: 'PSA', grade: '8' });
    render(<CatalogTable {...baseProps({ rows: [card] })} />);
    expect(screen.getByText('Base Set · NM · Holo · PSA 8')).toBeInTheDocument();
  });

  it('marks a sold item with the sold badge and row class, and disables its Sell button', () => {
    const card = makeCard({ sold: true });
    render(<CatalogTable {...baseProps({ rows: [card] })} />);
    expect(screen.getByText('Sold')).toBeInTheDocument();
    expect(screen.getByText('Sell').closest('tr')).toHaveClass('sold-row');
    expect(screen.getByText('Sell')).toBeDisabled();
  });

  it('disables Sell for an in-stock item once qty drops to zero', () => {
    const card = makeCard({ qty: 0 });
    render(<CatalogTable {...baseProps({ rows: [card] })} />);
    expect(screen.getByText('Sell')).toBeDisabled();
  });

  it('calls onEdit/onSell with the card sku when those buttons are clicked', () => {
    const onEdit = vi.fn();
    const onSell = vi.fn();
    render(<CatalogTable {...baseProps({ onEdit, onSell })} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Sell'));
    expect(onEdit).toHaveBeenCalledWith('sku-1');
    expect(onSell).toHaveBeenCalledWith('sku-1');
  });

  it('calls onSort with the column key when a sortable header is clicked', () => {
    const onSort = vi.fn();
    render(<CatalogTable {...baseProps({ onSort })} />);
    fireEvent.click(screen.getByText('Qty'));
    expect(onSort).toHaveBeenCalledWith('qty');
  });

  it('calls onToggleSelectAll with all visible skus when the header checkbox is toggled', () => {
    const cards = [makeCard({ sku: 'a' }), makeCard({ sku: 'b' })];
    const onToggleSelectAll = vi.fn();
    render(<CatalogTable {...baseProps({ rows: cards, onToggleSelectAll })} />);
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(headerCheckbox);
    expect(onToggleSelectAll).toHaveBeenCalledWith(['a', 'b'], true);
  });
});

describe('CatalogTable — mobile stacked cards', () => {
  beforeEach(() => useIsMobileMock.mockReturnValue(true));

  it('renders a stacked card list instead of a table', () => {
    render(<CatalogTable {...baseProps()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.getByText('Select all visible')).toBeInTheDocument();
  });

  it('only reveals the subtitle, actions, and sync status after the card head is clicked', () => {
    render(<CatalogTable {...baseProps()} />);
    expect(screen.queryByText('Base Set · NM · Holo')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Charizard'));
    expect(screen.getByText('Base Set · NM · Holo')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});
