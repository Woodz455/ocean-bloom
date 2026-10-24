// --- LE VOILE ---
//
// L'obscurité qui cache le monde, et que la lumière de Mimi révèle.
//
// ARCHITECTURE — pourquoi un calque à la taille de l'ÉCRAN et non du niveau.
// L'ancienne couche de pollution était une RenderTexture aux dimensions du niveau, et
// `erase()` relie puis redessine la texture entière : un commentaire du code d'origine
// la désignait comme le poste de coût le plus lourd du jeu, d'où un seuil de 6 px avant
// de redessiner. À 4000x4000 elle pesait en plus 64 Mo de VRAM, ce qui imposait le
// plafond de taille de niveau.
//
// Une lumière qui SUIT le joueur ne peut pas passer par là. Le voile est donc un calque
// fixé à la caméra, de la taille de la fenêtre : le coût devient proportionnel à l'écran
// et non au niveau, et plusieurs sources de lumière deviennent triviales.
//
// DIRECTION ARTISTIQUE — le voile n'est JAMAIS noir. Un noir pur est plat et laid ; il
// donne un jeu terne. C'est une eau profonde teintée, propre à chaque biome, et le noir
// n'est là que pour faire éclater la couleur de ce qu'on éclaire. Trois couches
// travaillent ensemble :
//   1. les CAUSTIQUES, sous le voile : visibles seulement là où on a percé, elles font
//      de la zone éclairée de l'eau et non un rond de couleur. Elles sont, comme le
//      voile, à la taille de l'écran — voir createVeil pour les 61 Mo que coûtait la
//      version aux dimensions du niveau ;
//   2. le HALO CHAUD, en fusion additive sous le voile : lumière chaude contre eau
//      froide, le contraste le plus fiable qui soit ;
//   3. le VOILE, teinté par biome, percé par les sources ;
//   4. les POUSSIÈRES, par-dessus tout : la pénombre reste habitée.

import { majFond, redimFond } from './Fond.js';

export const LIGHT_MAX = 100;

// PROFONDEURS — la règle qui décide de tout ici.
// Le voile passe AU-DESSUS du jeu (le joueur est à 20), sinon il ne cache rien, mais
// SOUS les cinématiques (30 et plus) et sous la boussole (50). Il s'ensuit une règle
// simple, et l'oublier a coûté une première série de rendus complètement plate :
//   · ce qui ÉCLAIRE le monde se dessine SOUS le voile (caustiques, halo chaud) ;
//   · ce qui doit RESTER VISIBLE DANS LE NOIR se dessine AU-DESSUS (lueur d'une balise
//     éteinte, onde de floraison, plancton).
// Une balise dont la lueur d'appel était sous le voile n'appelait personne : dans le
// noir on ne voyait rien du tout, et l'instant de floraison passait invisible.
export const DEPTH_CAUSTICS = 6;
export const DEPTH_GLOW = 8;      // sous le voile : éclaire
export const DEPTH_VEIL = 28;
export const DEPTH_BIOLUM = 29;   // au-dessus du voile : se voit dans le noir
export const DEPTH_BLOOM = 30;

// LE LANGAGE DES LUEURS — une couleur par CATÉGORIE, et une seule.
//
// Dans le noir on ne voit que des lueurs. Sans règle, elles tournent à la guirlande de
// Noël : le plancton mêlait l'or des balises et le rose des méduses, les déchets
// brillaient en kaki doré à deux pas de l'or. Le joueur doit pouvoir dire CE QUE C'EST
// avant de savoir où c'est. Toute lueur au-dessus du voile prend sa couleur ICI.
export const LUEUR = {
    balise: 0xffd08a,     // or : ce qu'on cherche
    perle: 0xfff0c0,      // blanc nacré : ce qui recharge
    danger: 0xff4d6d,     // rouge : ce qui blesse (ennemis, mines, baudroie qui traque)
    baudroie: 0xd8ff8a,   // vert-jaune : voisin de l'or EXPRÈS — balise, ou baudroie ?
    gene: 0x8a9a7a,       // gris-vert éteint : ce qui gêne sans blesser (déchets)
    oursins: 0xc9a2ff,    // les gardiens : une couleur par pouvoir qui les ouvre
    meduses: 0xff86c8,
    sceau: 0xffe6c8,
    ancre: 0x7cffd6,      // cyan : ce que Mimi pose elle-même (ancre de l'Onde III)
    plancton: [0x8fdcff, 0x7cffd6, 0x5ab8ff]   // ambiance : froid seulement
};

// Le voile est rendu au TIERS de la résolution de l'écran, puis agrandi ×3 au plus
// proche voisin (pixelArt). Chaque bord de lumière tombe ainsi sur la même grille de
// 3 px que tout le pixel art du jeu, quel que soit le rayon de la source — un halo lisse
// sur un monde en gros pixels, c'étaient deux styles qui se battaient. Et il y a neuf
// fois moins de pixels à remplir et à percer à chaque image.
//
// La BOÎTE D'AFFICHAGE ne change pas (w × h à l'origine, fixée à la caméra) : le zoom
// de caméra continue de s'y appliquer exactement comme avant. Seules les coordonnées de
// perçage sont divisées par 3 dans drawVeil.
export const ECHELLE_VOILE = 3;

export function createVeil(scene, levelW, levelH, tint) {
    const w = scene.scale.width, h = scene.scale.height;

    // Le voile lui-même : dessiné en coordonnées écran, donc jamais plus grand que la
    // fenêtre quelle que soit la taille du niveau.
    scene.veil = scene.make.renderTexture({
        x: 0, y: 0, width: Math.ceil(w / ECHELLE_VOILE), height: Math.ceil(h / ECHELLE_VOILE)
    }, true);
    scene.veil.setOrigin(0, 0);
    scene.veil.setScale(ECHELLE_VOILE);
    scene.veil.setScrollFactor(0);
    scene.veil.setDepth(DEPTH_VEIL);
    scene.veilTint = tint;
    scene.veilAlpha = 0.94;

    // Le masque de perçage : dégradé continu généré dans assets.js. 256 px de large,
    // d'où la division par 256 au moment de le mettre à l'échelle.
    scene.lightMask = scene.make.image({ key: 'lightMask', add: false });

    // CAUSTIQUES — à la taille de l'ÉCRAN, comme le voile, et pour la même raison.
    //
    // Premier jet : une TileSprite aux dimensions du NIVEAU, avec en commentaire « un
    // seul quad, donc son coût ne dépend pas de la taille du niveau ». C'était faux, et
    // la mesure l'a montré : Phaser lui alloue une source de texture à ses dimensions
    // déclarées, soit 4000x4000x4 = 61 Mo au niveau 10. Autrement dit, la nappe
    // remettait exactement le poids que le voile écran venait de supprimer.
    //
    // Fixée à la caméra, elle ne pèse plus que la fenêtre (~1 à 4 Mo). Pour qu'elle
    // paraisse quand même accrochée au monde et non collée à l'écran, on fait défiler
    // son motif avec la caméra dans drawVeil.
    scene.caustics = scene.add.tileSprite(0, 0, w, h, 'caustics');
    scene.caustics.setOrigin(0, 0);
    scene.caustics.setScrollFactor(0);
    scene.caustics.setDepth(DEPTH_CAUSTICS);
    scene.caustics.setBlendMode(Phaser.BlendModes.ADD);
    scene.caustics.setAlpha(0.55);

    // Zones acquises : de simples sources de lumière permanentes. Elles ne vivent pas
    // dans une texture de la taille du niveau — une liste suffit, et le même code de
    // perçage les traite, ce qui évite un second mécanisme à maintenir.
    scene.litZones = [];

    // PLANCTON BIOLUMINESCENT — le point qui décide si un jeu sombre est beau ou vide.
    // Dans le noir on ne voit pas RIEN, on voit des points de lumière. Sans eux, la
    // première série de rendus montrait une étendue morte hors du halo ; avec eux, la
    // pénombre devient un espace habité qu'on a envie de traverser.
    //
    // Trois teintes qui ne sont PAS celles de l'eau (ambre, magenta, vert d'eau) : sur
    // un fond bleu sourd, une couleur saturée éclate bien plus fort qu'en pleine
    // lumière. C'est la contrainte retournée en esthétique.
    const moteManager = scene.add.particles('sparkle');
    moteManager.setDepth(DEPTH_BIOLUM);
    moteManager.setScrollFactor(0);
    scene.veilMotes = moteManager.createEmitter({
        x: { min: -20, max: w + 20 }, y: { min: -20, max: h + 20 },
        lifespan: { min: 3500, max: 8000 },
        speedX: { min: -8, max: 8 }, speedY: { min: -16, max: -4 },
        scale: { min: 0.35, max: 1.1 },
        // Extinction lente plutôt que linéaire : le point de lumière s'attarde, ce qui
        // donne une eau qui respire au lieu d'un clignotement.
        alpha: { start: 0.85, end: 0, ease: 'Quad.easeIn' },
        quantity: 2, frequency: 90,
        blendMode: 'ADD',
        tint: LUEUR.plancton
    });

    return scene.veil;
}

// Redessine le voile : on remplit, puis on perce à l'emplacement de chaque source de
// lumière. Tout est en coordonnées écran — d'où la soustraction du défilement caméra.
export function drawVeil(scene, sources, time) {
    if (!scene.veil) return;
    const cam = scene.cameras.main;
    const w = scene.scale.width, h = scene.scale.height;

    scene.veil.clear();
    scene.veil.fill(scene.veilTint, scene.veilAlpha);

    // LE ZOOM S'APPLIQUAIT DEUX FOIS. Le voile est fixé à l'écran (scrollFactor 0), mais
    // la caméra l'agrandit QUAND MÊME de son zoom autour du centre de l'écran — comme
    // tout objet. L'ancien code multipliait en plus positions et rayons par le zoom.
    // À 1280×720 (zoom 1) rien ne se voyait ; à 1920×1080 (zoom 2), la résolution la plus
    // courante sur Steam, mesuré : une zone posée à +200 px du centre apparaissait à
    // +748 au lieu de +400, et trop grande. Toute lumière autre que Mimi éclairait À CÔTÉ
    // de ce qui l'émettait — une balise allumée, l'éclair de l'Onde — et le halo de Mimi,
    // centré par chance, était deux fois trop grand par rapport au monde.
    //
    // On applique donc la transformation INVERSE de l'affichage : un point du voile en u
    // s'affiche en centre + (u − centre) × zoom. Pour qu'il tombe sous la source, il
    // faut u = centre + (position écran − centre) / zoom, soit l'écart au centre de la
    // caméra en pixels du MONDE. Et le rayon reste en pixels du monde : le zoom de
    // l'affichage s'en charge.
    const cx = w / 2, cy = h / 2;
    const mx = cam.midPoint.x, my = cam.midPoint.y;
    const visibleW = w / cam.zoom, visibleH = h / cam.zoom;
    for (const s of sources) {
        if (!s || s.radius <= 0) continue;
        const dx = s.x - mx, dy = s.y - my;
        if (Math.abs(dx) > visibleW / 2 + s.radius || Math.abs(dy) > visibleH / 2 + s.radius) continue;
        // Coordonnées du voile, trois fois plus petit (ECHELLE_VOILE).
        scene.lightMask.setScale((s.radius * 2) / 256 / ECHELLE_VOILE);
        scene.veil.erase(scene.lightMask, (cx + dx) / ECHELLE_VOILE, (cy + dy) / ECHELLE_VOILE);
    }

    // Les lueurs attachées à des objets mobiles suivent leur cible.
    if (scene.glints) {
        for (let i = 0; i < scene.glints.length; i++) {
            const e = scene.glints[i];
            e.g.x = e.target.x;
            e.g.y = e.target.y + e.dy;
        }
    }

    // Les caustiques suivent le DÉFILEMENT DE LA CAMÉRA : la nappe est fixée à l'écran,
    // mais son motif se décale à l'inverse, si bien qu'elle paraît accrochée au fond
    // marin. Sans ce report, elle glisserait avec le joueur comme une vitre sale.
    // S'y ajoute une dérive lente propre, à deux vitesses légèrement différentes pour
    // que le motif ne semble pas se déplacer d'un bloc.
    if (scene.caustics) {
        const t = time || 0;
        scene.caustics.tilePositionX = cam.scrollX + t * 0.006;
        scene.caustics.tilePositionY = cam.scrollY + t * 0.0035;
    }
    // Le fond : parallaxe des colonnes, neige qui suit la vue, chaleur (Fond.js).
    majFond(scene);
}

// --- BALISES ---
//
// Elles réutilisent les coraux déjà dessinés : éteintes elles sont noyées dans la teinte
// du voile, allumées elles reprennent leur pleine couleur et dissipent l'obscurité pour
// de bon. La frontière entre les deux EST la barre de progression.

export function createBeacon(scene, x, y, key) {
    const spr = scene.add.sprite(x, y, key);
    spr.setDepth(12);
    // Éteinte : la balise n'est pas invisible, elle est sourde. Une pulsation faible la
    // signale au joueur qui s'en approche sans la lui offrir.
    spr.setTint(0x30506a);
    spr.isLit = false;
    spr.beaconX = x; spr.beaconY = y;

    // Le battement : c'est ce qu'on aperçoit au bord du halo et qui donne envie d'aller
    // voir. Sur l'alpha et non sur l'échelle — la grille de pixels reste intacte.
    spr.pulse = scene.tweens.add({
        targets: spr, alpha: { from: 0.55, to: 1 },
        duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // L'APPEL. Une lueur qui traverse le voile — donc AU-DESSUS de lui — visible de très
    // loin dans le noir. C'est le seul repère que le joueur a pour s'orienter, et c'est
    // ce qui rend l'obscurité navigable au lieu d'être une punition.
    spr.hint = scene.add.image(x, y, 'glintGlow');
    spr.hint.setTint(LUEUR.balise);
    spr.hint.setDepth(DEPTH_BIOLUM);
    spr.hint.setBlendMode(Phaser.BlendModes.ADD);
    spr.hint.setScale(0.55);
    spr.hint.setAlpha(0.3);
    scene.tweens.add({
        targets: spr.hint, alpha: { from: 0.16, to: 0.44 }, scale: { from: 0.5, to: 0.72 },
        duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // La lueur qui restera SOUS le voile une fois la balise allumée : c'est elle qui
    // baigne le récif de couleur, alors que `hint` ne fait que signaler un point.
    spr.bath = scene.add.image(x, y, 'bloomGlow');
    spr.bath.setDepth(DEPTH_GLOW);
    spr.bath.setBlendMode(Phaser.BlendModes.ADD);
    spr.bath.setAlpha(0);

    return spr;
}

// LA FLORAISON. Le moment que le jeu doit à son titre : une onde de couleur part de la
// balise, le récif surgit du noir, et la zone reste acquise.
// Pose un décor dans sa version éteinte (cf. genererRecifEteint dans assets.js) et le
// confie à rallumerRecif. Sans texture grise, il reste en couleur : rien ne casse.
export function decorEteint(scene, spr, cle) {
    if (!scene.textures.exists(cle + '_gris')) return spr;
    spr.setTexture(cle + '_gris');
    spr.cleCouleur = cle;
    (scene.decorRecif = scene.decorRecif || []).push(spr);
    return spr;
}

// LE RÉCIF REPREND SES COULEURS, en vague qui part de la balise, au rythme de l'anneau
// de floraison (450 px en 900 ms). Pour de bon : un corail rallumé ne s'éteint plus.
export function rallumerRecif(scene, x, y, radius) {
    if (!scene.decorRecif) return;
    for (const d of scene.decorRecif) {
        if (d.colore || !d.active) continue;
        const dist = Phaser.Math.Distance.Between(d.x, d.y, x, y);
        if (dist > radius) continue;
        d.colore = true;
        scene.time.delayedCall(dist * 1.6, () => {
            if (!d.active) return;
            d.setTexture(d.cleCouleur);
            d.setAlpha(0.35);
            scene.tweens.add({ targets: d, alpha: 1, duration: 500, ease: 'Sine.easeOut' });
        });
    }
}

export function bloomBeacon(scene, beacon, radius) {
    if (beacon.isLit) return;
    beacon.isLit = true;

    if (beacon.pulse) beacon.pulse.stop();
    beacon.setAlpha(1);
    beacon.clearTint();

    // L'onde : un anneau de lumière qui se propage à la vitesse du regard.
    const ring = scene.add.image(beacon.beaconX, beacon.beaconY, 'bloomGlow');
    ring.setDepth(DEPTH_BLOOM);   // au-dessus du voile : sous lui, l'onde était invisible
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(0.2);
    ring.setAlpha(0.95);
    scene.tweens.add({
        targets: ring, scale: (radius * 2) / 256 * 1.25, alpha: 0,
        duration: 900, ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy()
    });

    // La lueur permanente qui reste sur place, SOUS le voile : c'est elle qui fait que
    // la zone acquise est en pleine couleur et pas seulement « non cachée ».
    scene.tweens.add({
        targets: beacon.bath, alpha: 0.7, scale: (radius * 2) / 256 * 0.9,
        duration: 900, ease: 'Cubic.easeOut'
    });
    // L'appel n'a plus lieu d'être une fois la balise atteinte : il se resserre en une
    // simple étoile, pour que le joueur voie d'un coup d'œil ce qu'il a déjà acquis.
    scene.tweens.add({ targets: beacon.hint, alpha: 0.5, scale: 0.35, duration: 900, ease: 'Cubic.easeOut' });

    // Le voile se retire de la zone, définitivement. On l'ouvre en douceur plutôt que
    // d'un coup : le monde se révèle, il n'apparaît pas.
    const zone = { x: beacon.beaconX, y: beacon.beaconY, radius: 0 };
    scene.litZones.push(zone);
    scene.tweens.add({ targets: zone, radius: radius, duration: 900, ease: 'Cubic.easeOut' });

    // Et le récif autour reprend ses couleurs.
    rallumerRecif(scene, beacon.beaconX, beacon.beaconY, radius);

    // Étincelles : la floraison proprement dite.
    const burst = scene.add.particles('sparkle');
    burst.setDepth(DEPTH_BLOOM);
    const em = burst.createEmitter({
        x: beacon.beaconX, y: beacon.beaconY,
        speed: { min: 60, max: 320 }, angle: { min: 0, max: 360 },
        scale: { start: 2.2, end: 0 }, alpha: { start: 1, end: 0 },
        lifespan: 1400, blendMode: 'ADD', tint: [0xffffff, 0x7cffd6, 0x40e0d0]
    });
    em.explode(60);
    scene.time.delayedCall(1800, () => burst.destroy());

    scene.cameras.main.flash(260, 120, 255, 214);
    if (window.Haptics) window.Haptics.impact({ style: 'MEDIUM' }).catch(() => { });
}

// LE RÉCIT, PAR FRAGMENTS.
//
// Les quatre lignes du prologue étaient jetées au joueur avant qu'il ait touché à quoi
// que ce soit — le pire endroit pour raconter, puisque personne n'a encore de raison
// d'écouter. Elles reviennent ici, une par balise allumée : à ce moment-là le joueur a
// traversé le noir pour arriver jusque-là, il regarde le récif refleurir, et une phrase
// courte trouve enfin sa place.
//
// Au-delà de quatre balises on n'affiche plus rien : mieux vaut le silence qu'une
// répétition en boucle.
export function fragmentRecit(scene, x, y, index) {
    const cle = 'intro' + (index + 1);
    const texte = (window.getStr && window.getStr(cle)) || '';
    if (!texte) return null;

    // Corps de police et décalage vertical calculés depuis l'écran DIVISÉ PAR LE ZOOM.
    // Exprimés en pixels du monde, ils envoyaient le texte hors cadre dès que le zoom
    // valait 2 — l'erreur a déjà été faite et corrigée pour le titre de l'ouverture.
    const cam = scene.cameras.main;
    const zoom = cam.zoom || 1;
    const largeurUtile = scene.scale.width / zoom;
    const corps = Math.round(Phaser.Math.Clamp(largeurUtile / 30, 8, 14));

    const t = scene.add.text(0, 0, texte, {
        fontFamily: '"Press Start 2P"', fontSize: corps + 'px',
        fill: '#ffeccd', align: 'center', lineSpacing: Math.round(corps * 0.8),
        stroke: '#04141f', strokeThickness: 4,
        wordWrap: { width: largeurUtile * 0.82, useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(DEPTH_BLOOM).setAlpha(0).setScrollFactor(0);

    // FIXÉ À L'ÉCRAN, et positionné à la main.
    //
    // Deux tentatives ont échoué avant celle-ci. Ancré sur la balise, le texte sortait du
    // cadre dès que la balise était près d'un bord ; recadré une fois dans la vue, il en
    // ressortait aussitôt, parce que la caméra continue de suivre Mimi et que le texte,
    // lui, restait planté dans le monde.
    //
    // Un objet en scrollFactor 0 ne défile pas, mais il subit QUAND MÊME le zoom, autour
    // du centre de la caméra. Pour qu'il tombe à la position écran voulue il faut donc
    // inverser cette transformation — sans quoi le texte atterrit deux fois trop haut,
    // ce qui s'était déjà produit avec le mot « Bouge » de l'ouverture.
    const versEcran = (voulu, taille) => (voulu - taille / 2) / zoom + taille / 2;
    t.x = versEcran(scene.scale.width * 0.5, scene.scale.width);
    t.y = versEcran(scene.scale.height * 0.24, scene.scale.height);

    // Il entre après l'éclat de la floraison — posé sur le cœur presque blanc de l'onde,
    // il serait illisible — et s'efface tout seul.
    scene.tweens.add({
        targets: t, alpha: 1, y: t.y - 14,
        delay: 700, duration: 900, ease: 'Sine.easeOut'
    });
    scene.tweens.add({
        targets: t, alpha: 0,
        delay: 5200, duration: 900,
        onComplete: () => t.destroy()
    });
    return t;
}

// LE SCINTILLEMENT D'UNE PERLE. Attaché à un objet, au-dessus du voile : une perle
// posée dans le noir doit se voir de loin, sinon la recharge de lumière relève du hasard
// et la ressource devient une punition. C'est aussi, littéralement, ce qui peuple
// l'obscurité de promesses.
export function addGlint(scene, target, tint, size, opts) {
    const o = opts || {};
    const g = scene.add.image(target.x, target.y, 'glintGlow');
    g.setDepth(DEPTH_BIOLUM);
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setTint(tint);
    g.setScale(size);
    g.setAlpha(0.3);
    scene.tweens.add({
        targets: g, alpha: { from: o.min !== undefined ? o.min : 0.18, to: o.max !== undefined ? o.max : 0.5 },
        duration: 900 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    // La lueur ne doit pas survivre à l'objet ramassé : sans ça, chaque perle laissait
    // un halo orphelin qui finissait par éclairer tout le niveau.
    target.once('destroy', () => {
        g.destroy();
        if (scene.glints) {
            const i = scene.glints.findIndex(e => e.g === g);
            if (i >= 0) scene.glints.splice(i, 1);
        }
    });
    // Une lueur attachée à quelque chose qui BOUGE doit suivre. Les ennemis se déplacent
    // par tween et les déchets flottent : sans ce suivi, leur œil restait planté au point
    // d'apparition, ce qui est pire que pas de lueur du tout.
    if (o.follow) {
        if (!scene.glints) scene.glints = [];
        scene.glints.push({ g, target, dy: o.dy || 0 });
    }
    return g;
}

// FUSÉE ÉCLAIRANTE — une source temporaire. C'est ce que produisent désormais les
// capacités : au lieu de frotter la saleté, elles achètent un instant de vision large.
// Voir loin quelques secondes est exactement ce dont on a besoin pour repérer la
// prochaine balise, donc la capacité sert la boucle au lieu de la court-circuiter.
export function flareLight(scene, x, y, radius, duration) {
    const zone = { x, y, radius: 0 };
    scene.litZones.push(zone);
    scene.tweens.add({
        targets: zone, radius: radius, duration: 260, ease: 'Cubic.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: zone, radius: 0, duration: duration, ease: 'Sine.easeIn',
                onComplete: () => {
                    const i = scene.litZones.indexOf(zone);
                    if (i >= 0) scene.litZones.splice(i, 1);
                }
            });
        }
    });
    return zone;
}

// Les zones acquises sont simplement des sources de lumière permanentes : même code de
// perçage que la lumière de Mimi.
export function collectSources(scene, player, lightRadius) {
    const sources = [{ x: player.x, y: player.y, radius: lightRadius }];
    for (const z of scene.litZones) sources.push(z);
    // Alliés porteurs de lumière : Malik et Anaïs éclairent aussi, ce qui rend leur
    // invocation lisible d'un coup d'œil.
    if (scene.malik && scene.malik.active) sources.push({ x: scene.malik.x, y: scene.malik.y, radius: 220 });
    if (scene.anais && scene.anais.active) sources.push({ x: scene.anais.x, y: scene.anais.y, radius: 180 });
    // La lanterne de la baudroie (Predateur.js).
    if (scene.lumiereBaudroie) sources.push(scene.lumiereBaudroie);
    return sources;
}

// Le voile se redimensionne avec la fenêtre : c'est le prix d'un calque en coordonnées
// écran, et c'est deux lignes.
export function resizeVeil(scene) {
    if (!scene.veil) return;
    const w = scene.scale.width, h = scene.scale.height;
    scene.veil.setSize(Math.ceil(w / ECHELLE_VOILE), Math.ceil(h / ECHELLE_VOILE));
    // La nappe de caustiques est elle aussi en coordonnées écran : sans ce
    // redimensionnement, une rotation de téléphone laisserait une bande sans lumière.
    if (scene.caustics) scene.caustics.setSize(w, h);
    redimFond(scene);
    if (scene.veilMotes) {
        scene.veilMotes.setPosition({ min: 0, max: w }, { min: 0, max: h });
    }
}
