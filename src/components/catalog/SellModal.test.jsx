import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SellModal from './SellModal.jsx';

const singleCopyCard = { name: 'Black Lotus', set: 'Alpha', condition: 'LP', printing: 'Normal', qty: 1 };
const multiCopyCard = { name: 'Sol Ring', set: 'Commander', condition: 'NM', printing: 'Normal', qty: 8 };

describe('SellModal', () => {
  it('shows a plain confirmation, not a quantity stepper, for a single-copy item', () => {
    render(<SellModal card={singleCopyCard} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Mark this item as sold?')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('confirms a single-copy sale with quantity 1 without asking', () => {
    const onConfirm = vi.fn();
    render(<SellModal card={singleCopyCard} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Mark sold'));
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('shows the quantity stepper for a multi-copy item, defaulting to 1', () => {
    render(<SellModal card={multiCopyCard} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText('Mark this item as sold?')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
    expect(screen.getByText('8 in stock')).toBeInTheDocument();
  });

  it('increments/decrements the stepper, clamped to [1, qty]', () => {
    render(<SellModal card={multiCopyCard} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.click(screen.getByText('−')); // already at 1, stays clamped
    expect(input).toHaveValue(1);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    expect(input).toHaveValue(3);
  });

  it('does not let the stepper exceed the item\'s actual stock', () => {
    const twoInStock = { ...multiCopyCard, qty: 2 };
    render(<SellModal card={twoInStock} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    expect(input).toHaveValue(2);
  });

  it('confirms a multi-copy sale with whatever quantity was set', () => {
    const onConfirm = vi.fn();
    render(<SellModal card={multiCopyCard} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('Mark sold'));
    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SellModal card={multiCopyCard} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
