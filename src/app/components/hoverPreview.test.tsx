import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HoverPreview } from './HoverPreview';

const setWidth = (width: number) => act(() => { window.innerWidth = width; window.dispatchEvent(new Event('resize')); });
const preview = () => document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null;
const original = window.matchMedia;

afterEach(() => { setWidth(1024); window.matchMedia = original; });

describe('HoverPreview', () => {
  it('shows the larger picture while the pointer is over the thumbnail, and takes it away after', () => {
    render(<HoverPreview src="https://img.example/big.jpg"><span>thumb</span></HoverPreview>);
    expect(preview()).toBeNull();
    fireEvent.mouseEnter(screen.getByText('thumb'), { clientX: 100, clientY: 100 });
    expect(preview()!.getAttribute('src')).toBe('https://img.example/big.jpg');
    expect(preview()!.getAttribute('alt')).toBe('');
    fireEvent.mouseLeave(screen.getByText('thumb').parentElement!);
    expect(preview()).toBeNull();
  });

  it('follows the pointer, to the right of it, and flips to the left near the window edge', () => {
    render(<HoverPreview src="x.jpg"><span>thumb</span></HoverPreview>);
    const host = screen.getByText('thumb').parentElement!;
    fireEvent.mouseEnter(host, { clientX: 100, clientY: 400 });
    const rightOf = parseFloat(preview()!.style.left);
    expect(rightOf).toBeGreaterThan(100);
    fireEvent.mouseMove(host, { clientX: window.innerWidth - 10, clientY: 400 });
    expect(parseFloat(preview()!.style.left)).toBeLessThan(window.innerWidth - 10);
  });

  it('does nothing without a larger picture', () => {
    render(<HoverPreview src={null}><span>thumb</span></HoverPreview>);
    fireEvent.mouseEnter(screen.getByText('thumb'), { clientX: 1, clientY: 1 });
    expect(preview()).toBeNull();
  });

  it('does nothing on a phone', () => {
    setWidth(375);
    render(<HoverPreview src="x.jpg"><span>thumb</span></HoverPreview>);
    fireEvent.mouseEnter(screen.getByText('thumb').parentElement!, { clientX: 1, clientY: 1 });
    expect(preview()).toBeNull();
  });

  it('does nothing where there is no pointer that can hover', () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
    render(<HoverPreview src="x.jpg"><span>thumb</span></HoverPreview>);
    fireEvent.mouseEnter(screen.getByText('thumb').parentElement!, { clientX: 1, clientY: 1 });
    expect(preview()).toBeNull();
  });
});
