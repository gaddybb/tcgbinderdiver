import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

// The exact wording required by reference/policy/constraints.md. If this test fails, the copy was edited.
const VERBATIM =
  'Binder Diver is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.';

describe('Footer', () => {
  it('shows the Fan Content disclaimer verbatim', () => {
    render(<Footer />);
    expect(screen.getByTestId('fan-content-disclaimer').textContent).toBe(VERBATIM);
  });
  it('credits Scryfall with a link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /scryfall/i });
    expect(link.getAttribute('href')).toBe('https://scryfall.com');
  });
});
