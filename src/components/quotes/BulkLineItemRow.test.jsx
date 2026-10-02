import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkLineItemRow from './BulkLineItemRow.jsx';
import { normalizeQuoteItem } from '../../lib/quoteUtils.js';

describe('BulkLineItemRow', () => {
  it('renders qty/game/name/description/price and patches the item on change', () => {
    const onChange = vi.fn();
    const item = normalizeQuoteItem({
      game: 'Pokemon', name: 'Pokemon surge bulk', notes: 'all Pikachus in different conditions',
      qty: 20, price: 5, isBulk: true,
    });
    render(<BulkLineItemRow item={item} onChange={onChange} onRemove={vi.fn()} />);

    expect(screen.getByPlaceholderText('Qty')).toHaveValue(20);
    expect(screen.getByDisplayValue('Pokemon')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pokemon surge bulk')).toBeInTheDocument();
    expect(screen.getByDisplayValue('all Pikachus in different conditions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ qty: 25 }));

    fireEvent.change(screen.getByDisplayValue('Pokemon'), { target: { value: 'Magic' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ game: 'Magic' }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Pokemon surge bulk'), { target: { value: 'Magic commons lot' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Magic commons lot' }));

    fireEvent.change(screen.getByPlaceholderText('e.g. all Pikachus in different conditions'), { target: { value: 'mixed conditions' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'mixed conditions' }));

    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '7.50' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: 7.5 }));
  });

  it('never multiplies qty into price when qty changes — the price field is left untouched', () => {
    const onChange = vi.fn();
    const item = normalizeQuoteItem({ game: 'Pokemon', qty: 20, price: 5, isBulk: true });
    render(<BulkLineItemRow item={item} onChange={onChange} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '40' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ qty: 40, price: 5 }));
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    const item = normalizeQuoteItem({ game: 'Pokemon', isBulk: true });
    render(<BulkLineItemRow item={item} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('flags itself as excluded from the tier math, matching computeQuoteTotals', () => {
    const item = normalizeQuoteItem({ game: 'Pokemon', price: 5, isBulk: true });
    render(<BulkLineItemRow item={item} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/Excluded from the tier % offers/)).toBeInTheDocument();
  });
});
