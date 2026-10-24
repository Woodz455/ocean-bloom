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
    lagoon:   { haut: [18, 56, 90], bas: [4, 14, 28],  roche: [3, 10, 20] },
    caves:    { haut: [12, 36, 64], bas: [2, 7, 15],   roche: [1, 5, 11] },
    volcanic: { haut: [58, 20, 24], bas: [10, 2, 4],   roche: [8, 2, 3] },
    ruins:    { haut: [28, 22, 56], bas: [5, 3, 12],   roche: [4, 2, 9] }
};
const PARALLAXE_LOIN = 0.25, PARALLAXE_PROCHE = 0.5;
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
function texColonnes(scene, biome, couche, graine, colonnes, alpha, largeurMax) {
    const cle = `fond_colonnes_${biome}_${couche}`;
    if (scene.textures.exists(cle)) return cle;
    const N = 256, pal = PALETTES[biome];
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    let s = graine;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = `rgba(${pal.roche},${alpha})`;
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

function texNeige(scene) {
    if (scene.textures.exists('neige')) return 'neige';
    const c = document.createElement('canvas'); c.width = c.height = 3;   // un pixel d'art
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 3, 3);
    scene.textures.addCanvas('neige', c);
    return 'neige';
}

export function creerFond(scene, biome) {
    const w = scene.scale.width, h = scene.scale.height;
    const b = PALETTES[biome] ? biome : 'lagoon';

    scene.fond = scene.add.image(0, 0, texDegrade(scene, b))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(0).setDisplaySize(w, h);

    scene.fondLoin = scene.add.tileSprite(0, 0, w, h, texColonnes(scene, b, 'loin', 7, 3, 0.45, 46))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(1);
    scene.fondProche = scene.add.tileSprite(0, 0, w, h, texColonnes(scene, b, 'proche', 99, 2, 0.75, 26))
        .setOrigin(0, 0).setScrollFactor(0).setDepth(2);

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
    if (scene.fondZoneNeige) {
        const v = cam.worldView;
        scene.fondZoneNeige.setTo(v.x - 60, v.y - 60, v.width + 120, v.height + 120);
    }
    // Le fond se réchauffe avec la part de balises allumées, en douceur.
    const total = scene.beacons ? scene.beacons.length : 0;
    const cible = total ? scene.beacons.filter(b => b.isLit).length / total : 0;
    scene.fondChaleur += (cible - scene.fondChaleur) * 0.02;
    const t = scene.fondChaleur;
    const [r, g, b] = FROID.map(v => Math.round(v + (255 - v) * t));
    scene.fond.setTint((r << 16) | (g << 8) | b);
}

export function redimFond(scene) {
    const w = scene.scale.width, h = scene.scale.height;
    if (scene.fond) scene.fond.setDisplaySize(w, h);
    if (scene.fondLoin) scene.fondLoin.setSize(w, h);
    if (scene.fondProche) scene.fondProche.setSize(w, h);
}
