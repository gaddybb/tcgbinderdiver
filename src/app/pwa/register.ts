// Registers the service worker (public/sw.js) so the app keeps working offline. Only in the built site: during development
// a service worker would serve old files.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
