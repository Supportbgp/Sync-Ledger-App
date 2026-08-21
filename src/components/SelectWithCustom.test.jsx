import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SelectWithCustom from './SelectWithCustom.jsx';

describe('SelectWithCustom', () => {
  it('renders a select with the given options plus an "add new" entry when options exist and the value starts blank', () => {
    render(<SelectWithCustom options={['A', 'B']} value="" onChange={vi.fn()} ariaLabel="Thing" />);
    const select = screen.getByLabelText('Thing');
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });

  it('skips straight to a free-text input when there are no options to pick from', () => {
    render(<SelectWithCustom options={[]} value="" onChange={vi.fn()} ariaLabel="Thing" />);
    expect(screen.getByLabelText('Thing').tagName).toBe('INPUT');
  });

  it('starts in free-text mode when the current value is already a custom one not in the list', () => {
    render(<SelectWithCustom options={['A', 'B']} value="Custom thing" onChange={vi.fn()} ariaLabel="Thing" />);
    expect(screen.getByLabelText('Thing').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Thing').value).toBe('Custom thing');
  });

  it('switches to free text on "+ Add new" and back to the select on the back link, clearing the value either way', () => {
    const onChange = vi.fn();
    render(<SelectWithCustom options={['A', 'B']} value="" onChange={onChange} ariaLabel="Thing" addNewLabel="+ Add new…" backLabel="← Back" />);

    fireEvent.change(screen.getByLabelText('Thing'), { target: { value: '__add_new__' } });
    expect(screen.getByLabelText('Thing').tagName).toBe('INPUT');

    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByLabelText('Thing').tagName).toBe('SELECT');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('marks the "add new" option for its own distinct background styling', () => {
    render(<SelectWithCustom options={['A', 'B']} value="" onChange={vi.fn()} ariaLabel="Thing" addNewLabel="+ Add new…" />);
    expect(screen.getByRole('option', { name: '+ Add new…' })).toHaveClass('select-add-new-option');
  });

  it('forces the free-text escape hatch open if options disappear out from under an already-mounted select (e.g. Rarity options depending on Game)', () => {
    const { rerender } = render(<SelectWithCustom options={['A', 'B']} value="" onChange={vi.fn()} ariaLabel="Thing" />);
    expect(screen.getByLabelText('Thing').tagName).toBe('SELECT');

    rerender(<SelectWithCustom options={[]} value="" onChange={vi.fn()} ariaLabel="Thing" />);
    expect(screen.getByLabelText('Thing').tagName).toBe('INPUT');
  });
});
