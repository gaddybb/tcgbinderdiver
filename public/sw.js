// Binder Diver's service worker: keeps the app itself on the device so a loaded plan and store dive keep working with no
// signal. It only handles this site's own files. Lists and card data are kept by the app in the browser's own storage, and
// pictures and live card lookups from other sites are left alone, so offline those show their "unavailable" states.
//
// - Pages: the network first (so a new version arrives), and the saved page when there is no network.
// - /assets/* and the hashed card data files never change under the same name: the saved copy first.
// - Everything else of ours (the data manifest, icons): the network first, the saved copy as a fallback.
var CACHE = 'binder-diver-v1';
var SHELL = '/index.html';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) { return caches.delete(key); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function saveCopy(key, response) {
  if (!response || !response.ok) return response;
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) { return cache.put(key, copy); });
  return response;
}

function networkFirst(request, key) {
  return fetch(request).then(function (response) { return saveCopy(key, response); }).catch(function () {
    return caches.match(key).then(function (saved) { return saved || Response.error(); });
  });
}

function savedFirst(request) {
  return caches.match(request).then(function (saved) {
    return saved || fetch(request).then(function (response) { return saveCopy(request, response); });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }
  var hashed = url.pathname.indexOf('/assets/') === 0 || /^\/data\/(cards|prices)\./.test(url.pathname);
  event.respondWith(hashed ? savedFirst(request) : networkFirst(request, request));
});
