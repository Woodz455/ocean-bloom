# Ocean Bloom 🌊 (L'Éclat de l'Océan)
*Read this in [English](#english) | Lisez ceci en [Français](#francais)*

<a name="francais"></a>
## 🇫🇷 Français

**Ocean Bloom** est un jeu d'action sous-marin pour PC, développé par **SafeHill Technologies**. Le Grand Récif est plongé dans le noir. Mimi n'a que sa lumière : elle éclaire ce qu'elle traverse, elle s'épuise, et elle est la seule chose qui puisse rallumer les balises.

### 🎮 Le principe

Le jeu tient dans une tension : **la lumière est à la fois ce qui te fait voir et ce qui s'épuise.** Elle décroît sans cesse, les perles la rechargent, et son niveau décide du rayon éclairé autour de Mimi. S'enfoncer dans le noir pour chercher une balise, ou revenir vers une zone déjà acquise — c'est la seule décision, et elle se repose à chaque seconde.

Allumer une balise rend une grande partie de la réserve, dévoile un fragment du récit, et une balise sur deux rend un cœur.

### ✨ Ce qu'il y a dedans

*   **Le voile** — l'obscurité est une couche écran percée par chaque source de lumière : Mimi, les balises allumées, l'onde de choc. Ce qui éclaire se dessine sous le voile, ce qui doit rester visible dans le noir se dessine au-dessus.
*   **Génération procédurale** — chaque niveau est tiré au sort ; taille et densité sont dérivées du champ de vision réel, pas d'une constante.
*   **Boutique d'améliorations** — les perles achètent la vitesse de nage et la portée de la lumière, et survivent à la mort.
*   **Combats de boss** — Monstre de Vase, Amalgame de Plastique, Geôlier de Pétrole.
*   **Courses-poursuites** — deux niveaux en scrolling horizontal avec parallaxe.
*   **Magie et invocations** — ondes de choc, dauphins électriques, Malik le triton en renfort, et le Trident de la Princesse Nana.
*   **Pixel art procédural** — tous les graphismes sont générés par code sur une grille commune, sans aucun fichier image.

### 🛠️ Stack technique

*   **Moteur :** [Phaser 3](https://phaser.io/) (v3.55.2), servi localement — rien ne vient d'un CDN.
*   **Langages :** HTML5, CSS3, JavaScript vanilla (modules ES6).
*   **Pilotage :** clavier (ZQSD / WASD / flèches, 1-5 et Espace) et manette, via `src/managers/DesktopInput.js`. Le retour haptique passe par la vibration de la manette.
*   **Cible :** PC uniquement. Les builds Android et iOS, le service worker et le manifeste PWA ont été retirés.

### 🚀 Lancer le jeu

Aucune dépendance à installer : il suffit d'un serveur statique sur `www/`.

```bash
cd www
python -m http.server 8080
# ou : npx serve www
```

Puis ouvrez `http://localhost:8080`.

---

<a name="english"></a>
## 🇬🇧 English

**Ocean Bloom** is an underwater action game for PC, developed by **SafeHill Technologies**. The Great Reef has gone dark. Mimi has only her light: it reveals whatever she swims through, it drains, and it is the one thing that can relight the beacons.

### 🎮 The idea

The game rests on a single tension: **light is both what lets you see and what runs out.** It drains continuously, pearls recharge it, and its level sets the lit radius around Mimi. Push deeper into the dark to find a beacon, or fall back to ground you already hold — that is the only decision, and it comes up every second.

Lighting a beacon returns a large share of the reserve, reveals a fragment of the story, and every second beacon restores a heart.

### ✨ What's in it

*   **The veil** — darkness is a screen-space layer punched through by every light source: Mimi, lit beacons, the shockwave. What lights the world draws under the veil; what must stay visible in the dark draws above it.
*   **Procedural generation** — every level is rolled fresh; size and density derive from the actual field of view, not a constant.
*   **Upgrade shop** — pearls buy swim speed and light reach, and survive death.
*   **Boss fights** — Sludge Monster, Plastic Amalgam, Oil Jailer.
*   **Chase levels** — two side-scrolling pursuits with parallax.
*   **Magic and summons** — shockwaves, electric dolphins, Malik the merman as backup, and Princess Nana's Trident.
*   **Procedural pixel art** — every graphic is generated in code on a shared grid; there are no image files.

### 🛠️ Tech stack

*   **Engine:** [Phaser 3](https://phaser.io/) (v3.55.2), served locally — nothing comes from a CDN.
*   **Languages:** HTML5, CSS3, vanilla JavaScript (ES6 modules).
*   **Input:** keyboard (WASD / ZQSD / arrows, 1-5 and Space) and gamepad, via `src/managers/DesktopInput.js`. Haptic feedback runs through gamepad rumble.
*   **Target:** PC only. The Android and iOS builds, the service worker and the PWA manifest have been removed.

### 🚀 Running the game

There is nothing to install — any static server over `www/` will do.

```bash
cd www
python -m http.server 8080
# or: npx serve www
```

Then open `http://localhost:8080`.
