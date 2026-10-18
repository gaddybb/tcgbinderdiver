// A small hand-rolled router: the current path, navigate(), and a Link that does not reload the page.
// The host serves index.html for every path (Cloudflare single-page-application fallback).
import { useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

const CHANGE = 'binderdiver:navigate';

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(CHANGE, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(CHANGE, callback);
  };
}

export function currentPath(): string {
  return window.location.pathname || '/';
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => '/');
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === window.location.pathname + window.location.search + window.location.hash) return;
  if (options.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(CHANGE));
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; children: ReactNode };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    // Let the browser handle new-tab clicks, modified clicks and external targets.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    event.preventDefault();
    navigate(to);
  };
  return <a {...rest} href={to} onClick={handleClick}>{children}</a>;
}
