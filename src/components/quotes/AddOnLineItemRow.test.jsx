import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddOnLineItemRow from './AddOnLineItemRow.jsx';
import { normalizeQuoteItem } from '../../lib/quoteUtils.js';

describe('AddOnLineItemRow', () => {
  it('renders name/description/price and patches the item on change', () => {
    const onChange = vi.fn();
    const item = normalizeQuoteItem({ name: 'Binder', notes: 'Two vintage binders', price: 5, isAddOn: true });
    render(<AddOnLineItemRow item={item} onChange={onChange} onRemove={vi.fn()} />);

    expect(screen.getByDisplayValue('Binder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Two vintage binders')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. Binder, playmat, bulk V/ex lot'), { target: { value: 'Playmat' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Playmat' }));

    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '7.50' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ price: 7.5 }));
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    const item = normalizeQuoteItem({ name: 'Binder', isAddOn: true });
    render(<AddOnLineItemRow item={item} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('flags itself as excluded from the tier math, matching computeQuoteTotals', () => {
    const item = normalizeQuoteItem({ name: 'Binder', price: 5, isAddOn: true });
    render(<AddOnLineItemRow item={item} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/excluded from the tier % offers/)).toBeInTheDocument();
  });
});
