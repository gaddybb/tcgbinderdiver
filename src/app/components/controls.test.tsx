import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, Chip, ColorFilter, Input, Radio, Select, Stepper, Switch } from './index';
import type { ColorCategory } from './index';
import { copy } from '../copy/en';

describe('Button', () => {
  it('is a plain button unless told otherwise, so it never submits a form by accident', () => {
    render(<Button>Plan my dive</Button>);
    expect(screen.getByRole('button', { name: 'Plan my dive' }).getAttribute('type')).toBe('button');
  });

  it('can be a submit button', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
  });

  it('runs onClick, but not when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'secondary', 'text', 'danger'] as const)('renders the %s variant', variant => {
    render(<Button variant={variant}>Label</Button>);
    expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy();
  });

  it('an icon button is named by its aria-label', () => {
    render(<Button variant="icon" aria-label="Previous">‹</Button>);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeTruthy();
  });

  it('passes menu attributes through', () => {
    render(<Button variant="icon" aria-label="More" aria-haspopup="menu" aria-expanded={false}>⋯</Button>);
    const button = screen.getByRole('button', { name: 'More' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not leak its own props onto the page element', () => {
    render(<Button size="lg" fullWidth>Wide</Button>);
    const button = screen.getByRole('button', { name: 'Wide' });
    expect(button.hasAttribute('size')).toBe(false);
    expect(button.hasAttribute('fullwidth')).toBe(false);
  });
});

describe('Input', () => {
  it('connects the label to the field', () => {
    render(<Input label="Deck name" defaultValue="Lifegain" />);
    expect((screen.getByLabelText('Deck name') as HTMLInputElement).value).toBe('Lifegain');
  });

  it('passes type and placeholder through', () => {
    render(<Input label="Search" type="search" placeholder="Card name" />);
    const field = screen.getByLabelText('Search');
    expect(field.getAttribute('type')).toBe('search');
    expect(field.getAttribute('placeholder')).toBe('Card name');
  });

  it('shows a problem in words, marks the field invalid and links the two', () => {
    render(<Input label="Your decklist" multiline error="The box is empty." />);
    const field = screen.getByLabelText('Your decklist');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('The box is empty.');
    expect(field.getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('shows a hint without marking the field invalid', () => {
    render(<Input label="Name" hint="Up to 40 letters" />);
    const field = screen.getByLabelText('Name');
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByText('Up to 40 letters').id).toBe(field.getAttribute('aria-describedby'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no description link when there is nothing to describe', () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText('Name').hasAttribute('aria-describedby')).toBe(false);
  });

  it('reports typing', () => {
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Elves' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('gives each field its own id', () => {
    render(<><Input label="One" /><Input label="Two" /></>);
    expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
  });
});

describe('Select', () => {
  it('connects the label and reports the choice', () => {
    const onChange = vi.fn();
    render(<Select label="Pull order" defaultValue="Balanced" onChange={onChange}><option>Balanced</option><option>Most cards</option></Select>);
    const select = screen.getByLabelText('Pull order') as HTMLSelectElement;
    expect(select.value).toBe('Balanced');
    fireEvent.change(select, { target: { value: 'Most cards' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(select.value).toBe('Most cards');
  });
});

describe('Stepper', () => {
  it('steps up and down', () => {
    const onChange = vi.fn();
    render(<Stepper value={3} onChange={onChange} label="Quantity" />);
    fireEvent.click(screen.getByRole('button', { name: copy.common.more }));
    fireEvent.click(screen.getByRole('button', { name: copy.common.fewer }));
    expect(onChange.mock.calls).toEqual([[4], [2]]);
  });

  it('shows the value and names the group', () => {
    render(<Stepper value={3} onChange={() => {}} label="Quantity" />);
    expect(screen.getByRole('group', { name: 'Quantity' }).textContent).toContain('3');
  });

  it('stops at the minimum and the maximum', () => {
    const { rerender } = render(<Stepper value={0} onChange={() => {}} min={0} max={9} />);
    expect((screen.getByRole('button', { name: copy.common.fewer }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Stepper value={9} onChange={() => {}} min={0} max={9} />);
    expect((screen.getByRole('button', { name: copy.common.more }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses custom button names', () => {
    render(<Stepper value={1} onChange={() => {}} fewerLabel="Remove one" moreLabel="Add one" />);
    expect(screen.getByRole('button', { name: 'Add one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove one' })).toBeTruthy();
  });
});

describe('Switch', () => {
  it('is a switch that shows its state', () => {
    render(<Switch label="In next dive" checked onChange={() => {}} />);
    expect((screen.getByRole('switch', { name: 'In next dive' }) as HTMLInputElement).checked).toBe(true);
  });

  it('reports the new state when clicked', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="In next dive" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'In next dive' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch label="In next dive" checked onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'In next dive' }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('can be named by aria-label when it has no visible words', () => {
    render(<Switch aria-label="Include Elves in next dive" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Include Elves in next dive' })).toBeTruthy();
  });
});

describe('Chip', () => {
  it('is a toggle that reports whether it is pressed', () => {
    const onPress = vi.fn();
    const { rerender } = render(<Chip pressed={false} onPress={onPress}>Lifegain · 5</Chip>);
    const chip = screen.getByRole('button', { name: 'Lifegain · 5' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<Chip pressed onPress={onPress}>Lifegain · 5</Chip>);
    expect(screen.getByRole('button', { name: 'Lifegain · 5' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('can be a removable tag with its own remove button', () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove} removeLabel="Remove Commander Masters">Commander Masters</Chip>);
    expect(screen.getByText('Commander Masters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Commander Masters' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('names the remove button by default', () => {
    render(<Chip onRemove={() => {}}>Tag</Chip>);
    expect(screen.getByRole('button', { name: copy.common.remove })).toBeTruthy();
  });
});

describe('ColorFilter', () => {
  it('has one button per category, named in full and showing one letter', () => {
    render(<ColorFilter selected={[]} onToggle={() => {}} />);
    const group = screen.getByRole('group', { name: copy.colors.groupLabel });
    expect(group.querySelectorAll('button')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Blue' }).textContent).toBe('U');
    expect(screen.getByRole('button', { name: 'Multicolor' }).textContent).toBe('M');
    expect(screen.getByRole('button', { name: 'Land' }).textContent).toBe('L');
  });

  it('shows which are selected', () => {
    render(<ColorFilter selected={['Red', 'Green']} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Red' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'White' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the category that was clicked', () => {
    const onToggle = vi.fn<(c: ColorCategory) => void>();
    render(<ColorFilter selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));
    expect(onToggle).toHaveBeenCalledWith('Black');
  });
});

describe('Checkbox and Radio', () => {
  it('are labelled controls', () => {
    render(<><Checkbox label="Checkbox" defaultChecked /><Radio label="Radio" name="r" defaultChecked /></>);
    expect((screen.getByLabelText('Checkbox') as HTMLInputElement).type).toBe('checkbox');
    expect((screen.getByLabelText('Checkbox') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Radio') as HTMLInputElement).type).toBe('radio');
  });

  it('toggle when clicked through the label', () => {
    render(<Checkbox label="Include basics" />);
    const box = screen.getByLabelText('Include basics') as HTMLInputElement;
    fireEvent.click(screen.getByText('Include basics'));
    expect(box.checked).toBe(true);
  });
});
