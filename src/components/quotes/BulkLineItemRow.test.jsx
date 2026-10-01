import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkLineItemRow from './BulkLineItemRow.jsx';
import { normalizeQuoteItem } from '../../lib/quoteUtils.js';

describe('BulkLineItemRow', () => {
  it('renders game/qty/price and patches the item on change', () => {
    const onChange = vi.fn();
    const item = normalizeQuoteItem({ game: 'Pokemon', qty: 50, price: 0.1, isBulk: true });
    render(<BulkLineItemRow item={item} onChange={onChange} onRemove={vi.fn()} />);

    expect(screen.getByDisplayValue('Pokemon')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.1')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Pokemon'), { target: { value: 'Magic' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ game: 'Magic' }));

    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ qty: 25 }));

    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '0.25' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: 0.25 }));
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    const item = normalizeQuoteItem({ game: 'Pokemon', isBulk: true });
    render(<BulkLineItemRow item={item} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalled();
  });
});
