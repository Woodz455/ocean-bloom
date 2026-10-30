// --- LE FOND — de la profondeur au lieu d'un damier ---
//
// Le fond était une tuile bleue de 64 px en damier (`ocean_bg`), qui se lisait comme une
// tuile répétée, et dont les couleurs suivaient `niveau % 4` au lieu des biomes : le
// niveau 2, au lagon, était cyan, le 3 vert. Il devient trois choses :
//   · un DÉGRADÉ vertical par biome, en bandes nettes comme la lumière ;
//   · deux couches de COLONNES DE ROCHE lointaines, en parallaxe ;
//   · de la NEIGE MARINE, sous le voile : on ne la voit que dans la lumière.
// Et il se RÉCHAUFFE à mesure que les balises s'allument.
//
// Tout est fixé à l'écran ou suit la caméra : la leçon des 61 Mo — une TileSprite reçoit
// une texture à SES DIMENSIONS DÉCLARÉES — vaut ici aussi. Jamais rien à la taille du
// niveau.

const PALETTES = {
    // Le lagon reprend l'eau de la référence (#1297b8 → #173c6c), assombrie : on ne la
    // voit que là où la lumière a percé le voile.
    lagoon:   { haut: [10, 80, 104], bas: [8, 24, 46], roche: [3, 12, 24] },
    caves:    { haut: [12, 36, 64], bas: [2, 7, 15],   roche: [1, 5, 11] },
    volcanic: { haut: [58, 20, 24], bas: [10, 2, 4],   roche: [8, 2, 3] },
    ruins:    { haut: [28, 22, 56], bas: [5, 3, 12],   roche: [4, 2, 9] }
};
const PARALLAXE_LOIN = 0.25, PARALLAXE_PROCHE = 0.5;
// Le PREMIER PLAN défile plus vite que le décor : il passe devant Mimi, comme une
// caméra placée derrière des algues. C'est ce qui donne la profondeur à l'image de
// référence — trois plans, et le plus proche, sombre, qui cadre.
const PARALLAXE_AVANT = 1.35;
const DEPTH_AVANT = 27;   // devant Mimi (20), sous le voile (28) : il ne se voit qu'éclairé
// Teinte du dégradé selon la part de balises allumées : de froid et sourd à pleine couleur.
const FROID = [0x7a, 0x88, 0xa0];

// Dégradé de 1 × 240 px en neuf bandes, étiré à l'écran au plus proche voisin : les
// bandes restent nettes, comme les paliers de la lumière.
function texDegrade(scene, biome) {
    const cle = 'fond_degrade_' + biome;
    if (scene.textures.exists(cle)) return cle;
    const pal = PALETTES[biome], bandes = 9;
    const c = document.createElement('canvas'); c.width = 1; c.height = 240;
    const g = c.getContext('2d');
    for (let y = 0; y < 240; y++) {
        const t = Math.floor((y / 240) * bandes) / (bandes - 1);
        g.fillStyle = `rgb(${pal.haut.map((v, i) => Math.round(v + (pal.bas[i] - v) * t))})`;
        g.fillRect(0, y, 1, 1);
    }
    scene.textures.addCanvas(cle, c);
    return cle;
}

// HAUTES COLONNES de roche qui traversent la tuile de haut en bas, comme les parois d'un
// canyon lointain. Première idée, des rochers posés : la tuile se répétant aussi en
// hauteur, ils flottaient en « bonhommes de neige ». Des colonnes se raccordent sans
// couture. Remplies pixel par pixel sur une grille de 256 (aucun anticrénelage), puis
// agrandies ×3 au plus proche voisin : même grille que tout le pixel art.
function texColonnes(scene, biome, couche, graine, colonnes, alpha, largeurMax, palerie = 0) {
    const cle = `fond_colonnes_${biome}_${couche}`;
    if (scene.textures.exists(cle)) return cle;
    const N = 256, pal = PALETTES[biome];
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    let s = graine;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    // PERSPECTIVE ATMOSPHÉRIQUE : plus une couche est loin, plus sa roche tire vers la
    // couleur de l'eau — pâle et bleutée, comme les ruines au fond de la référence.
    const roche = pal.roche.map((v, i) => Math.round(v + (pal.haut[i] - v) * palerie));
    g.fillStyle = `rgba(${roche},${alpha})`;
    // Somme de sinus de période N : la colonne se raccorde parfaitement d'une tuile à l'autre.
    const periodique = () => {
        const k1 = 1 + Math.floor(rnd() * 2), k2 = 2 + Math.floor(rnd() * 3), p1 = rnd() * 6.3, p2 = rnd() * 6.3;
        return y => Math.sin(2 * Math.PI * k1 * y / N + p1) * 0.6 + Math.sin(2 * Math.PI * k2 * y / N + p2) * 0.4;
    };
    const point = (x, y, l) => g.fillRect(((x % N) + N) % N, y, l, 1);
    for (let i = 0; i < colonnes; i++) {
        const x0 = rnd() * N, base = largeurMax * (0.35 + rnd() * 0.65);
        const largeur = periodique(), derive = periodique(), creneau = periodique();
        for (let y = 0; y < N; y++) {
            const w = Math.max(2, base * (0.62 + 0.38 * largeur(y)) + (creneau((y * 7) % N) > 0.55 ? 2 : 0));
            const cx = x0 + derive(y) * base * 0.5;
            for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) point(x, y, 1);
        }
    }
    // Quelques brins de varech, larges de 2 px, eux aussi périodiques.
    for (let i = 0; i < colonnes; i++) {
        const x0 = rnd() * N, ond = periodique();
        for (let y = 0; y < N; y++) point(Math.round(x0 + ond(y) * 4), y, 2);
    }
    const out = document.createElement('canvas'); out.width = out.height = N * 3;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(c, 0, 0, N * 3, N * 3);
    scene.textures.addCanvas(cle, out);
    return cle;
}

// Le premier plan : deux touffes de varech par tuile, presque noires, hautes de toute
// la tuile (raccord vertical sans couture, comme les colonnes). Clairsemées exprès :
// elles cadrent l'image, elles ne doivent jamais cacher le jeu plus d'un instant.
function texPremierPlan(scene, biome) {
    const cle = 'fond_avant_' + biome;
    if (scene.textures.exists(cle)) return cle;
    const N = 256, H = 256, pal = PALETTES[biome];
    const c = document.createElement('canvas'); c.width = N; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = `rgba(${pal.bas.map(v => Math.round(v * 0.5))},0.94)`;
    let s = biome.length * 131 + 17;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (const x0 of [N * 0.12 + rnd() * 20, N * 0.62 + rnd() * 20]) {
        for (let brin = 0; brin < 3; brin++) {
            const k = 1 + Math.floor(rnd() * 2), p = rnd() * 6.3, base = x0 + brin * 7;
            const large = 4 + Math.floor(rnd() * 4);
            for (let y = 0; y < H; y++) {
                const cx = base + Math.sin(2 * Math.PI * k * y / H + p) * 6;
                // Des feuilles : la largeur gonfle par endroits.
                const w = large + (Math.sin(2 * Math.PI * 4 * y / H + p * 2) > 0.6 ? 3 : 0);
                g.fillRect(Math.round(cx - w / 2), y, w, 1);
            }
        }
    }
    const out = document.createElement('canvas'); out.width = N * 3; out.height = H * 3;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(c, 0, 0, N * 3, H * 3);
    scene.textures.addCanvas(cle, out);
    return cle;
}

function texNeige(scene) {
    if (scene.textures.exists('neige')) return 'neige';
    const c = document.createElement('canvas'); c.width = c.height = 3;   // un pixel d'art
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 3, 3);
    scene.textures.addCanvas('neige', c);
    return 'neige';
}

// LES DÉCORS, un par biome, tous de Luis Zuno (ansimuz) : même main, même pixel art.
// Chaque couche est une bande horizontale, fond marin en bas : collée au BAS de
// l'écran, elle ne défile qu'à l'horizontale ; au-dessus, l'eau de sa propre couleur.
// Chaque pixel du décor vaut 3 pixels du monde — la grille de tout le jeu — et le zoom
// de caméra fait le reste, en entier : aucune déformation.
//   · lagon    : Underwater Fantasy (CC-BY 3.0) — ruines, statue, kelp ;
//   · cavernes : Super Grotto Escape (CC0) — cristaux rouges, temples effondrés ;
//   · volcan   : lava-background (CC0) — coulées de lave, pilier de roche ;
//   · ruines   : ships-graveyard (CC0) — cimetière de navires, rayons de surface.
// Les bandes des trois derniers sont assemblées par tests/composer-decors.mjs.
const DECORS = {
    lagoon: [
        { cle: 'ansimuz_far', parallaxe: 0.1, h: 192 },
        { cle: 'ansimuz_sand', parallaxe: 0.25, h: 192 },
        { cle: 'ansimuz_foreground', parallaxe: 0.5, h: 192 }],
    caves: [
        { cle: 'decor_caves_loin', parallaxe: 0.1, h: 240 },
        { cle: 'decor_caves_milieu', parallaxe: 0.25, h: 240 },
        { cle: 'decor_caves_proche', parallaxe: 0.5, h: 240 }],
    volcanic: [
        { cle: 'decor_volcanic_loin', parallaxe: 0.1, h: 240 },
        { cle: 'decor_volcanic_milieu', parallaxe: 0.25, h: 240 },
        { cle: 'decor_volcanic_proche', parallaxe: 0.5, h: 240 }],
    ruins: [
        { cle: 'decor_ruins_eau', parallaxe: 0.05, h: 256 },
        { cle: 'decor_ruins_loin', parallaxe: 0.15, h: 256 },
        { cle: 'decor_ruins_milieu', parallaxe: 0.3, h: 256 },
        { cle: 'decor_ruins_proche', parallaxe: 0.5, h: 256 }]
};
const PIXEL_DECOR = 3;
// La teinte multiplie, et le décor s'éclaircit à mesure que les balises s'allument.
// Lagon : bleu vif d'origine → turquoise sombre de la référence. Les autres décors ont
// déjà la couleur de leur biome : on n'y module que la lumière.
const DECOR_TEINTES = {
    lagoon: [[0x3c, 0xb4, 0x8c], [0x8c, 0xff, 0xd2]],
    autre:  [[0xa0, 0xa0, 0xb0], [0xff, 0xff, 0xff]]
};

function avecDecor(scene, b) {
    return !!DECORS[b] && DECORS[b].every(c => scene.textures.exists(c.cle));
}

// Un objet fixé à l'écran est quand même agrandi du zoom AUTOUR DU CENTRE : pour qu'il
// couvre exactement l'écran, ses coordonnées se calculent en divisant par le zoom.
function placerDecor(scene) {
    const w = scene.scale.width, h = scene.scale.height, z = scene.cameras.main.zoom || 1;
    const x0 = w / 2 - w / (2 * z), bas = h / 2 + h / (2 * z), large = w / z;
    for (const c of scene.fondDecor) {
        // Jamais plus haute que l'écran (une TileSprite reçoit une texture à SES
        // dimensions déclarées) : une bande plus haute est rognée PAR LE HAUT — le motif
        // est décalé d'autant, pour que le fond marin reste collé au bas de l'écran.
        const haut = Math.min(c.h * PIXEL_DECOR, Math.floor(h / z));
        c.spr.setPosition(x0, bas).setSize(large, haut);
        c.spr.tilePositionY = c.h - haut / PIXEL_DECOR;
    }
    scene.fond.setPosition(x0, h / 2 - h / (2 * z)).setDisplaySize(large, h / z);
}

function creerDecor(scene, b) {
    const w = scene.scale.width;
    const couches = DECORS[b];
    scene.fondTeintes = DECOR_TEINTES[b] || DECOR_TEINTES.autre;
    // L'eau au-dessus de la bande : la couleur du haut de la couche lointaine.
    const eau = scene.textures.getPixel(0, 0, couches[0].cle);
    const couleur = eau ? Phaser.Display.Color.GetColor(eau.r, eau.g, eau.b) : 0x3c6cd0;
    scene.fond = scene.add.rectangle(0, 0, w, scene.scale.height, couleur)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(0);
    scene.fondDecor = couches.map((c, i) => ({
        ...c,
        spr: scene.add.tileSprite(0, 0, w, c.h * PIXEL_DECOR, c.cle)
            .setOrigin(0, 1).setScrollFactor(0).setDepth(i + 0.5)
            .setTileScale(PIXEL_DECOR, PIXEL_DECOR)
    }));
    placerDecor(scene);
}

export function creerFond(scene, biome) {
    const w = scene.scale.width, h = scene.scale.height;
    const b = PALETTES[biome] ? biome : 'lagoon';

    if (avecDecor(scene, b)) {
        creerDecor(scene, b);
        // Pas d'algues de premier plan : elles passaient en grandes bandes sombres
        // par-dessus le décor, qui a déjà son propre kelp.
        creerNeige(scene, w, h);
        return;
    }

    scene.fond = scene.add.image(0, 0, texDegrade(scene, b))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(0).setDisplaySize(w, h);

    scene.fondLoin = scene.add.tileSprite(0, 0, w, h, texColonnes(scene, b, 'loin', 7, 3, 0.55, 46, 0.6))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(1);
    scene.fondProche = scene.add.tileSprite(0, 0, w, h, texColonnes(scene, b, 'proche', 99, 2, 0.75, 26))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(2);

    creerPremierPlan(scene, b, w, h);
    creerNeige(scene, w, h);
}

function creerPremierPlan(scene, b, w, h) {
    scene.fondAvant = scene.add.tileSprite(0, 0, w, h, texPremierPlan(scene, b))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH_AVANT)
        // Semi-transparent : opaque, une touffe qui passait devant Mimi la cachait
        // entièrement. Le premier plan cadre ; il ne doit jamais masquer le jeu.
        .setAlpha(0.55);
}

function creerNeige(scene, w, h) {
    // NEIGE MARINE — en coordonnées du MONDE, pour qu'elle reste « dans l'eau » quand la
    // caméra bouge ; c'est la zone d'émission qui suit la vue. Sous le voile (7, entre les
    // caustiques et le halo chaud) : on ne la voit que dans la lumière de Mimi.
    scene.fondZoneNeige = new Phaser.Geom.Rectangle(0, 0, w, h);
    const neige = scene.add.particles(texNeige(scene));
    neige.setDepth(7);
    scene.fondNeige = neige.createEmitter({
        emitZone: { type: 'random', source: scene.fondZoneNeige },
        lifespan: 9000, frequency: 60, quantity: 1,
        speedY: { min: 6, max: 18 }, speedX: { min: -5, max: 5 },
        alpha: { start: 0.5, end: 0 },
        tint: [0xcfe8ff, 0xaad4ff, 0xe6f2ff]
    });

    scene.fondChaleur = 0;
}

export function majFond(scene) {
    if (!scene.fond) return;
    const cam = scene.cameras.main;
    // Parallaxe : une TileSprite fixée à l'écran est agrandie du zoom comme le monde, donc
    // décaler son motif de scroll × f le fait défiler à f fois la vitesse du décor.
    if (scene.fondLoin) {
        scene.fondLoin.tilePositionX = cam.scrollX * PARALLAXE_LOIN;
        scene.fondLoin.tilePositionY = cam.scrollY * PARALLAXE_LOIN;
    }
    if (scene.fondProche) {
        scene.fondProche.tilePositionX = cam.scrollX * PARALLAXE_PROCHE;
        scene.fondProche.tilePositionY = cam.scrollY * PARALLAXE_PROCHE;
    }
    if (scene.fondAvant) {
        scene.fondAvant.tilePositionX = cam.scrollX * PARALLAXE_AVANT;
        scene.fondAvant.tilePositionY = cam.scrollY * PARALLAXE_AVANT;
    }
    if (scene.fondZoneNeige) {
        const v = cam.worldView;
        scene.fondZoneNeige.setTo(v.x - 60, v.y - 60, v.width + 120, v.height + 120);
    }
    // Le fond se réchauffe avec la part de balises allumées, en douceur.
    const total = scene.beacons ? scene.beacons.length : 0;
    const cible = total ? scene.beacons.filter(b => b.isLit).length / total : 0;
    scene.fondChaleur += (cible - scene.fondChaleur) * 0.02;
    const t = scene.fondChaleur;
    if (scene.fondDecor) {
        // Le zoom est posé APRÈS la création du fond (configurePlayer), et change avec la
        // fenêtre : on replace la bande dès qu'il bouge.
        if (scene.fondZoom !== cam.zoom) { scene.fondZoom = cam.zoom; placerDecor(scene); }
        for (const c of scene.fondDecor) c.spr.tilePositionX = cam.scrollX * c.parallaxe / PIXEL_DECOR;
        const [froid, chaud] = scene.fondTeintes;
        const [r, g, b] = froid.map((v, i) => Math.round(v + (chaud[i] - v) * t));
        const teinte = (r << 16) | (g << 8) | b;
        for (const c of scene.fondDecor) c.spr.setTint(teinte);
        // Un rectangle n'a pas de teinte : on multiplie sa couleur à la main.
        if (scene.fondEau === undefined) scene.fondEau = scene.fond.fillColor;
        const e = scene.fondEau;
        const m = (canal, k) => Math.round(((e >> canal) & 255) * k / 255);
        scene.fond.setFillStyle((m(16, r) << 16) | (m(8, g) << 8) | m(0, b));
        return;
    }
    const [r, g, b] = FROID.map(v => Math.round(v + (255 - v) * t));
    scene.fond.setTint((r << 16) | (g << 8) | b);
}

export function redimFond(scene) {
    const w = scene.scale.width, h = scene.scale.height;
    if (scene.fondDecor) {
        placerDecor(scene);
        if (scene.fondAvant) scene.fondAvant.setSize(w, h);
        return;
    }
    if (scene.fond) scene.fond.setDisplaySize(w, h);
    if (scene.fondLoin) scene.fondLoin.setSize(w, h);
    if (scene.fondProche) scene.fondProche.setSize(w, h);
    if (scene.fondAvant) scene.fondAvant.setSize(w, h);
}
