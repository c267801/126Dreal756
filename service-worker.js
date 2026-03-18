// ============================================================
// SERVICE WORKER – ERP/PWA
// Versione: 1.0
// Strategia: Cache-first per risorse statiche,
//            Network-first per Google Fonts
// ============================================================

const CACHE_NAME = 'erp-pwa-v2';
const CACHE_FONT = 'erp-fonts-v1';

// Risorse da mettere in cache al primo avvio
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
];

// ---- Install: pre-carica le risorse statiche ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Attiva subito senza aspettare che le vecchie tab si chiudano
      return self.skipWaiting();
    })
  );
});

// ---- Activate: pulisci cache vecchie ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_FONT)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      // Prendi controllo di tutte le tab aperte
      return self.clients.claim();
    })
  );
});

// ---- Fetch: strategia intelligente per tipo di risorsa ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts → Network-first, fallback cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(networkFirstFont(event.request));
    return;
  }

  // Risorse statiche locali → Cache-first, fallback network
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Tutto il resto (CDN, API esterne) → Network-only
  event.respondWith(fetch(event.request));
});

// Cache-first: prova cache, poi rete, aggiorna cache
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline e non in cache: restituisce pagina principale se disponibile
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Offline — riconnettiti per aggiornare.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Network-first per font: prova rete, fallback cache
async function networkFirstFont(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_FONT);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503 });
  }
}

// ---- Messaggio per forzare aggiornamento dalla UI ----
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
