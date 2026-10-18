import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { MemoryStorage } from '../storage';
import { copy } from './copy/en';

const goTo = (path: string) => window.history.replaceState(null, '', path);
beforeEach(() => goTo('/'));
afterEach(() => goTo('/'));

describe('App routes', () => {
  it('shows Home at /', () => {
    render(<App storage={new MemoryStorage()} />);
    expect(screen.getByRole('heading', { level: 1, name: copy.homePage.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: copy.footerLinks.kit })).toBeTruthy();
  });

  it('shows the kit at /kit', () => {
    goTo('/kit');
    render(<App storage={new MemoryStorage()} />);
    expect(screen.getByRole('heading', { level: 1, name: copy.kit.title })).toBeTruthy();
  });

  it('shows "not found" for any other path, with a way back', () => {
    goTo('/nope');
    render(<App storage={new MemoryStorage()} />);
    expect(screen.getByRole('heading', { name: copy.notFound.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: copy.notFound.back }));
    expect(screen.getByRole('heading', { level: 1, name: copy.homePage.title })).toBeTruthy();
  });

  it('moves between pages without a reload', () => {
    render(<App storage={new MemoryStorage()} />);
    fireEvent.click(screen.getByRole('link', { name: copy.footerLinks.kit }));
    expect(window.location.pathname).toBe('/kit');
    expect(screen.getByRole('heading', { level: 1, name: copy.kit.title })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: copy.kit.backHome }));
    expect(window.location.pathname).toBe('/');
  });

  it.each(['/', '/kit', '/nope'])('has the Fan Content disclaimer and the Scryfall credit on %s', path => {
    goTo(path);
    render(<App storage={new MemoryStorage()} />);
    expect(screen.getByTestId('fan-content-disclaimer').textContent).toBe(copy.footer.fanContentDisclaimer);
    expect(screen.getByRole('link', { name: copy.footer.scryfallCredit })).toBeTruthy();
  });

  it('follows the back button', () => {
    render(<App storage={new MemoryStorage()} />);
    fireEvent.click(screen.getByRole('link', { name: copy.footerLinks.kit }));
    act(() => { goTo('/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByRole('heading', { level: 1, name: copy.homePage.title })).toBeTruthy();
  });
});

describe('Kit gallery', () => {
  const renderKit = () => { goTo('/kit'); return render(<App storage={new MemoryStorage()} />); };

  it('has a section for every part of board 8', () => {
    renderKit();
    for (const title of Object.values(copy.kit.sections)) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
    }
    expect(Object.keys(copy.kit.sections)).toHaveLength(13);
  });

  it('shows every status, every verdict and every odds level', () => {
    renderKit();
    for (const text of Object.values(copy.status)) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const text of Object.values(copy.verdict)) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const text of Object.values(copy.odds)) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it('shows the card tile in each of its states', () => {
    renderKit();
    expect(screen.getAllByRole('button', { name: copy.cardTile.found }).length).toBeGreaterThan(0);   // to find
    expect(screen.getByRole('button', { name: copy.cardTile.foundUndo })).toBeTruthy();               // found
    expect(screen.getByRole('button', { name: copy.cardTile.foundPlusOne })).toBeTruthy();            // several copies, in progress
    expect(screen.getByText(copy.cardTile.allFound(4))).toBeTruthy();                                 // all found
    expect(screen.getByText(copy.cardTile.imageUnavailable)).toBeTruthy();                            // image unavailable
  });

  it('tiles respond: Found +1 moves progress along', () => {
    renderKit();
    const bar = () => screen.getByRole('progressbar', { name: copy.progress.copiesLabel(copy.kit.sample.cardName3) });
    expect(bar().getAttribute('aria-valuenow')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: copy.cardTile.foundPlusOne }));
    expect(bar().getAttribute('aria-valuenow')).toBe('2');
  });

  it('shows all three kinds of banner, and a toast', () => {
    renderKit();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText(copy.kit.sample.bannerWarningTitle)).toBeTruthy();
    expect(screen.getAllByText(copy.kit.sample.toastMessage).length).toBeGreaterThan(0);
  });

  it('the live toast button shows a toast', () => {
    renderKit();
    const before = screen.getAllByText(copy.kit.sample.toastMessage).length;
    fireEvent.click(screen.getByRole('button', { name: copy.kit.sample.toastLive }));
    expect(screen.getAllByText(copy.kit.sample.toastMessage).length).toBe(before + 1);
  });

  it('opens the real sheet and the real dialog', () => {
    renderKit();
    fireEvent.click(screen.getByRole('button', { name: copy.kit.sample.sheetOpen }));
    expect(screen.getByRole('dialog', { name: copy.kit.sample.sheetTitle })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: copy.kit.sample.dialogOpen }));
    const dialog = screen.getByRole('dialog', { name: copy.kit.sample.dialogTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: copy.kit.sample.dialogKeep }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the list card menu opens', () => {
    renderKit();
    fireEvent.click(screen.getByRole('button', { name: copy.common.moreFor(copy.kit.sample.listTitle) }));
    // The gallery also shows a static menu, so look inside the one the button opened.
    const menu = screen.getByRole('menu', { name: copy.common.moreFor(copy.kit.sample.listTitle) });
    expect(within(menu).getByRole('menuitem', { name: copy.kit.sample.menuItems[0] })).toBeTruthy();
  });

  it('every control the board lists is there', () => {
    renderKit();
    expect(screen.getAllByRole('switch').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('group', { name: copy.colors.groupLabel })).toBeTruthy();
    expect(screen.getByRole('list', { name: copy.kit.sample.importStepsLabel })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: copy.tabs.label })).toBeTruthy();
    expect(screen.getByLabelText(copy.kit.sample.pickerLabel)).toBeTruthy();
    expect(screen.getByRole('img', { name: copy.kit.sample.anchorLabel })).toBeTruthy();
    expect(screen.getByLabelText(copy.kit.sample.decklist).getAttribute('aria-invalid')).toBe('true');
  });

  it('every button and input has a name for screen readers', () => {
    const { container } = renderKit();
    for (const button of container.querySelectorAll('button')) {
      expect((button.textContent ?? '').trim() || button.getAttribute('aria-label'), button.outerHTML).toBeTruthy();
    }
    for (const field of container.querySelectorAll('input, select, textarea')) {
      const named = (field as HTMLInputElement).labels?.length || field.getAttribute('aria-label');
      expect(named, field.outerHTML).toBeTruthy();
    }
  });

  it('shows the My lists pieces: header, next dive bar, empty state, a list card being renamed and the menu as a phone sheet', () => {
    renderKit();
    const k = copy.kit.sample;
    expect(screen.getByRole('heading', { level: 3, name: k.pageTitle })).toBeTruthy();
    expect(screen.getByText(k.summaryTitle)).toBeTruthy();
    expect(screen.getByRole('heading', { name: k.emptyTitle })).toBeTruthy();
    expect(screen.getByDisplayValue(k.renameValue)).toBeTruthy();
    expect(screen.getByText(k.menuHints[1])).toBeTruthy();
  });

  it('has exactly one h1', () => {
    renderKit();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('the kit gallery shows the selection components', () => {
  it('has the selection bar, the phone select header and a selectable row', () => {
    goTo('/kit');
    render(<App storage={new MemoryStorage()} />);
    expect(screen.getAllByRole('region', { name: copy.bulk.selectedCards(3) }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.bulk.selectedShort(3)).length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: copy.bulk.selectCard(copy.kit.sample.cardName1) })).toBeTruthy();
  });
});
