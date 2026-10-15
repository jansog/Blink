// Blink service worker.
// The app is stored on the phone at first launch and then always starts from that local copy,
// so it keeps working offline and even if the website it was installed from is down,
// password protected or deleted. New versions are fetched quietly in the background.
const CACHE = 'blink-v4';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function refreshPage(req) {
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (!res.ok || res.redirected) return null;
    const text = await res.clone().text();
    // Only accept the real app, never a login page or an error page from the host.
    if (!text.includes('<title>Blink</title>')) return null;
    const c = await caches.open(CACHE);
    await c.put('./index.html', new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
    return res;
  } catch (_) { return null; }
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await caches.match('./index.html');
      if (hit) { e.waitUntil(refreshPage(req)); return hit; }
      const res = await refreshPage(req);
      return res || new Response('Blink er ikke lastet ned ennå. Åpne appen én gang med nettforbindelse.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
