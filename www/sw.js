// À INCRÉMENTER à chaque modification de la liste ci-dessous : c'est ce changement de
// nom qui déclenche un cycle install/activate propre et purge l'ancien cache.
const CACHE_NAME = 'ocean-bloom-v4';

// Fichiers locaux indispensables. La liste précédente contenait './game.js', supprimé
// lors du découpage en modules : comme cache.addAll() rejette EN BLOC dès qu'une seule
// URL échoue, l'installation échouait à chaque fois et le cache restait vide (vérifié :
// 0 entrée). Le mode hors-ligne annoncé n'a donc jamais fonctionné.
// Elle omettait aussi tout le dossier src/, soit l'intégralité du code du jeu.
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './assets.js',
  './audio.js',
  './vendor/phaser.min.js',
  './src/main.js',
  './src/managers/GameState.js',
  './src/managers/LevelGenerator.js',
  './src/managers/UIManager.js',
  './src/entities/Player.js',
  './src/entities/Enemies.js',
  './src/entities/Allies.js',
  './src/scenes/IntroScene.js',
  './src/scenes/MainScene.js',
  './src/scenes/ChaseScene.js'
];

// Ressources tierces : au mieux, pour ne pas faire échouer toute l'installation si le
// réseau est indisponible. Phaser est désormais servi depuis www/vendor/, donc plus
// rien d'indispensable ne vit ici — il ne reste que les polices, dont l'absence
// dégrade l'affichage sans empêcher le jeu de tourner.
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
  'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&display=swap'
];

// Installation : on met les fichiers en cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(EXTERNAL_ASSETS.map(url => cache.add(url)));
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
