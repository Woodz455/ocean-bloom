# Les contrôles automatiques

Pilotés par [Playwright](https://playwright.dev/) dans Chromium. Ils jouent le jeu par
le même chemin de code que le joueur, et vérifient chaque comportement par son
**effet** — une zone qui reste éclairée, une perle ramassée, un ennemi hors de portée —
et non par l'absence d'erreur.

## Lancer

```bash
npm i -D playwright                      # une fois
cd www && python3 -m http.server 8099    # dans un terminal à part
node tests/parcours.mjs                  # non-régression : 10 niveaux, pouvoirs, boss, défaite, crédits
node tests/paliers.mjs                   # les 9 paliers, le Bouclier, la boutique
node tests/obstacles.mjs                 # les 3 gardiens : ils ferment, et s'ouvrent par LEUR pouvoir
node tests/textures.mjs                  # aucune texture manquante ni orpheline
```

Captures et pages produites : `tests/sortie/` (ignoré par git).

## Publier la version jouable

```bash
python3 tests/bundle.py                  # regroupe tout le jeu en tests/sortie/ocean-bloom.html
python3 tests/serveur-utf8.py &          # la sert sur 8097, en UTF-8
node tests/verif-bundle.mjs              # titre, clavier, pouvoir, balise, zéro requête sortante
```

La page groupée ne fait **aucune** requête réseau : Phaser et les deux polices y sont
embarqués.

## Pièges connus — ils ont tous déjà coûté une mesure fausse

- **Ne jamais attendre une durée pour un tween.** En headless, sous charge, l'horloge de
  scène et celle des tweens divergent fortement : 4,2 s de scène après une Onde, son
  éclair était encore à rayon plein. Attendre le *résultat* (`quand()` dans
  `paliers.mjs`).
- **Ne jamais téléporter Mimi au hasard sans regarder où.** Le décor est semé au
  hasard : un test qui posait Mimi dans un corail et sur une bouche volcanique l'a
  retrouvée figée, et a d'abord fait croire que la brèche du Rayon ne laissait pas
  passer. Tracer la trajectoire avant de conclure.
- **Les minuteries se mesurent en temps de scène** (`scene.time.now`), jamais en
  `waitForTimeout` : l'horloge Phaser avance bien moins vite qu'une montre en headless.
- **Les images par seconde ne se mesurent pas ici** : Chromium headless rasterise en
  logiciel. Les chiffres obtenus ne disent rien du matériel réel.
- **Aucun de ces contrôles ne dit si un pouvoir est agréable.** Ils prouvent qu'il fait
  ce qu'il annonce. Le ressenti — un coût qui punit, une ressource qui fond trop vite —
  ne s'est jamais révélé qu'en jouant.
