const CACHE_NAME = 'ocean-bloom-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './assets.js',
  './audio.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.min.js',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];

// Installation : on met les fichiers en cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Forcer l'activation immédiate du nouveau Service Worker
  self.skipWaiting();
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  // Prendre le contrôle de toutes les pages ouvertes sans attendre un rechargement
  self.clients.claim();
});

// Interception des requêtes : Stale-While-Revalidate
// Sert depuis le cache pour la rapidité, puis met à jour le cache en arrière-plan
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Mettre à jour le cache avec la nouvelle version
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Si le réseau échoue, on a déjà le cache (mode hors-ligne)
          return cachedResponse;
        });

        // Retourner le cache immédiatement, ou attendre le réseau si pas en cache
        return cachedResponse || fetchPromise;
      });
    })
  );
});
