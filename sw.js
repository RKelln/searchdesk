// Search Desk service worker (DESIGN 14). Small on purpose.
// tools/build.py replaces the VERSION line below with Desk.version, so every new build is a new worker with a new
// cache. Strategy: NETWORK FIRST for the page. A person who is online always gets the newest page on their next
// load (stale-while-revalidate would show the old page once more and the new one only on the load after that), and
// a person who is offline gets the last copy that loaded. Icons and the manifest come from the cache first.
// Only same-origin GET requests are handled. The Togather events host is another origin, so it never reaches here
// (net.js keeps its own cache).
var VERSION = 'dev';
var PREFIX = 'searchdesk-';
var CACHE = PREFIX + VERSION;
var FILES = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
var WAIT_MS = 4000; // a slow network must not hold the page when a saved copy exists

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function page(request) {
  var key = self.registration.scope; // every way of opening the page is the same file
  var net = fetch(request).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(key, copy); }); }
    return res;
  });
  var saved = caches.open(CACHE).then(function (c) { return c.match(key); });
  var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, WAIT_MS); });
  return Promise.race([net.catch(function () { return null; }), timeout.then(function () { return saved; })])
    .then(function (res) { return res || saved.then(function (s) { return s || net; }); });
}

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(page(r)); return; }
  if (FILES.some(function (f) { return new URL(f, self.registration.scope).href === url.href; })) {
    e.respondWith(caches.match(r).then(function (hit) { return hit || fetch(r); }));
  }
});
