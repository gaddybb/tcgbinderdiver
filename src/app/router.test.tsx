import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Link, currentPath, navigate, usePath } from './router';

function PathProbe() {
  return <output data-testid="path">{usePath()}</output>;
}

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => window.history.replaceState(null, '', '/'));

describe('router', () => {
  it('reads the current path', () => {
    window.history.replaceState(null, '', '/kit');
    expect(currentPath()).toBe('/kit');
    render(<PathProbe />);
    expect(screen.getByTestId('path').textContent).toBe('/kit');
  });

  it('navigate changes the path and the components that read it', () => {
    render(<PathProbe />);
    act(() => navigate('/kit'));
    expect(window.location.pathname).toBe('/kit');
    expect(screen.getByTestId('path').textContent).toBe('/kit');
  });

  it('navigate adds a history entry, or replaces it on request', () => {
    const before = window.history.length;
    navigate('/a');
    expect(window.history.length).toBe(before + 1);
    navigate('/b', { replace: true });
    expect(window.history.length).toBe(before + 1);
    expect(window.location.pathname).toBe('/b');
  });

  it('does nothing when asked to go where it already is', () => {
    navigate('/a');
    const length = window.history.length;
    navigate('/a');
    expect(window.history.length).toBe(length);
  });

  it('follows the back button', () => {
    render(<PathProbe />);
    act(() => navigate('/kit'));
    act(() => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByTestId('path').textContent).toBe('/');
  });

  describe('Link', () => {
    it('renders a real link with the address', () => {
      render(<Link to="/kit">Kit</Link>);
      expect(screen.getByRole('link', { name: 'Kit' }).getAttribute('href')).toBe('/kit');
    });

    it('navigates without reloading on a plain click', () => {
      render(<><PathProbe /><Link to="/kit">Kit</Link></>);
      const proceeded = fireEvent.click(screen.getByRole('link', { name: 'Kit' }));
      expect(proceeded).toBe(false);   // the default (a page load) was prevented
      expect(screen.getByTestId('path').textContent).toBe('/kit');
    });

    it.each([['ctrl', { ctrlKey: true }], ['meta', { metaKey: true }], ['shift', { shiftKey: true }], ['alt', { altKey: true }], ['middle button', { button: 1 }]])(
      'leaves a %s click to the browser', (_name, init) => {
        render(<><PathProbe /><Link to="/kit">Kit</Link></>);
        const proceeded = fireEvent.click(screen.getByRole('link', { name: 'Kit' }), init);
        expect(proceeded).toBe(true);
        expect(screen.getByTestId('path').textContent).toBe('/');
      });

    it('leaves a link that opens in a new tab to the browser', () => {
      render(<Link to="/kit" target="_blank">Kit</Link>);
      expect(fireEvent.click(screen.getByRole('link', { name: 'Kit' }))).toBe(true);
    });

    it('still runs the caller\'s onClick first', () => {
      let clicked = false;
      render(<Link to="/kit" onClick={() => { clicked = true; }}>Kit</Link>);
      fireEvent.click(screen.getByRole('link', { name: 'Kit' }));
      expect(clicked).toBe(true);
    });

    it('does not navigate when the caller\'s onClick prevents the default', () => {
      render(<><PathProbe /><Link to="/kit" onClick={e => e.preventDefault()}>Kit</Link></>);
      fireEvent.click(screen.getByRole('link', { name: 'Kit' }));
      expect(screen.getByTestId('path').textContent).toBe('/');
    });
  });
});
