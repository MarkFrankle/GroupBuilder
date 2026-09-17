import { render, screen, fireEvent } from '@testing-library/react';
import { PersonCombobox } from '../PersonCombobox';

// Radix's Popover scrolls the highlighted option into view; jsdom has no such method.
Element.prototype.scrollIntoView = jest.fn();

const options = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Charlie' },
];

const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

describe('PersonCombobox', () => {
  test('shows the placeholder when nothing is selected', () => {
    render(<PersonCombobox options={options} value={null} onSelect={jest.fn()} placeholder="None" aria-label="Partner" />);
    expect(screen.getByRole('button', { name: 'Partner' })).toHaveTextContent('None');
  });

  test('shows the selected person\'s name', () => {
    render(<PersonCombobox options={options} value="p2" onSelect={jest.fn()} placeholder="None" aria-label="Partner" />);
    expect(screen.getByRole('button', { name: 'Partner' })).toHaveTextContent('Bob');
  });

  test('clicking the trigger opens a list of all options', () => {
    render(<PersonCombobox options={options} value={null} onSelect={jest.fn()} placeholder="None" aria-label="Partner" />);
    open('Partner');
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Charlie' })).toBeInTheDocument();
  });

  test('typing filters the list to matching names', () => {
    render(<PersonCombobox options={options} value={null} onSelect={jest.fn()} placeholder="None" aria-label="Partner" />);
    open('Partner');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bo' } });
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Alice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Charlie' })).not.toBeInTheDocument();
  });

  test('picking an option calls onSelect with its id and closes the list', () => {
    const onSelect = jest.fn();
    render(<PersonCombobox options={options} value={null} onSelect={onSelect} placeholder="None" aria-label="Partner" />);
    open('Partner');
    fireEvent.click(screen.getByRole('option', { name: 'Bob' }));
    expect(onSelect).toHaveBeenCalledWith('p2');
    expect(screen.queryByRole('option', { name: 'Alice' })).not.toBeInTheDocument();
  });

  test('a noneLabel renders a clearing option that calls onSelect with null', () => {
    const onSelect = jest.fn();
    render(<PersonCombobox options={options} value="p2" onSelect={onSelect} noneLabel="None" aria-label="Partner" />);
    open('Partner');
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test('a disabled combobox cannot be opened', () => {
    render(<PersonCombobox options={options} value={null} onSelect={jest.fn()} placeholder="None" aria-label="Partner" disabled />);
    expect(screen.getByRole('button', { name: 'Partner' })).toBeDisabled();
  });
});
