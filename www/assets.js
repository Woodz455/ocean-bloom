// --- GESTION DES ASSETS ---

// --- GRILLE DE PIXELS UNIFIÉE ---
//
// Un pixel d'art valait 3 px écran pour les personnages, 4 pour les déchets et les
// projectiles, 5 pour le monstre de vase, 6 pour les dauphins et les fumerolles,
// 7 pour les boss — et, pour le décor du monde, une valeur TIRÉE AU HASARD entre
// 2,4 et 3,9 à chaque instance. Face à Mimi, un boss avait donc des pixels
// 2,3 fois plus gros que les siens : côte à côte pendant un combat, l'un paraissait
// fin et l'autre taillé à la hache. C'est le défaut qui trahissait le plus le
// « fait maison » de l'ensemble.
//
// Règle unique : PIXEL pixels écran par pixel d'art, partout, sans redimensionnement
// au runtime. Les rares exceptions sont commentées là où elles se trouvent.
const PIXEL = 3;

// Remonte une grille d'art sur la grille fine, puis repose un contour de 1 px.
//
// L'agrandissement seul ne changerait rien à l'écran : c'est la même image sur une
// grille plus serrée. Ce qui affine réellement, c'est le contour reposé — il passe
// de 5, 6 ou 7 px d'épaisseur à 3, et c'est ce liseré épais qui criait « gros
// pixels » avant même la forme.
//
// À noter : cela n'invente aucun détail. Un boss dessiné en 35x15 reste un dessin de
// 35x15, simplement exprimé sur une grille commune et reconturé. Pour lui donner de
// la finesse il faudrait le redessiner.
function regridArt(art, factor, contour) {
    const src = art.map(r => r.split(''));
    const sh = src.length, sw = src[0].length;
    const h = Math.round(sh * factor), w = Math.round(sw * factor);

    // 1. Plus proche voisin vers la grille fine.
    const g = [];
    for (let y = 0; y < h; y++) {
        const sy = Math.min(sh - 1, Math.floor(y * sh / h));
        const row = [];
        for (let x = 0; x < w; x++) row.push(src[sy][Math.min(sw - 1, Math.floor(x * sw / w))]);
        g.push(row);
    }
    if (!contour) return g.map(r => r.join(''));

    const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const N8 = N4.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

    // 2. Remplissage du vide depuis les bords. Ce qui n'est pas atteint est intérieur :
    //    la bouche du boss et les yeux des dauphins sont peints avec la couleur du
    //    contour, et les retoucher effaçait purement et simplement les visages.
    const outside = g.map(r => r.map(() => false));
    const stack = [];
    for (let y = 0; y < h; y++) { stack.push([y, 0], [y, w - 1]); }
    for (let x = 0; x < w; x++) { stack.push([0, x], [h - 1, x]); }
    while (stack.length) {
        const [y, x] = stack.pop();
        if (y < 0 || y >= h || x < 0 || x >= w || outside[y][x] || g[y][x] !== '_') continue;
        outside[y][x] = true;
        for (const [dy, dx] of N4) stack.push([y + dy, x + dx]);
    }
    const touchesOutside = (y, x) => N8.some(([dy, dx]) => {
        const ny = y + dy, nx = x + dx;
        return ny < 0 || ny >= h || nx < 0 || nx >= w || outside[ny][nx];
    });

    const outer = [];
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            if (g[y][x] === contour && touchesOutside(y, x)) outer.push([y, x]);

    // 3. L'ancien contour extérieur est remplacé par la couleur intérieure dominante.
    for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        for (const [y, x] of outer) {
            if (g[y][x] !== contour) continue;
            const votes = {};
            let best = null, bestN = 0;
            for (const [dy, dx] of N8) {
                const ny = y + dy, nx = x + dx;
                if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
                const c = g[ny][nx];
                if (c === contour || c === '_') continue;
                votes[c] = (votes[c] || 0) + 1;
                if (votes[c] > bestN) { bestN = votes[c]; best = c; }
            }
            if (best) { g[y][x] = best; changed = true; }
        }
        if (!changed) break;
    }
    for (const [y, x] of outer) if (g[y][x] === contour) g[y][x] = '_';

    // 4. Nouveau contour de 1 px sur la silhouette obtenue.
    const body = g.map(r => r.map(c => c !== '_'));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!body[y][x]) continue;
            const edge = N4.some(([dy, dx]) => {
                const ny = y + dy, nx = x + dx;
                return ny < 0 || ny >= h || nx < 0 || nx >= w || !body[ny][nx];
            });
            if (edge) g[y][x] = contour;
        }
    }
    return g.map(r => r.join(''));
}

// --- DÉRIVATION DES FRAMES D'ANIMATION ---
//
// Les frames ne sont pas dessinées : elles sont dérivées de la pose au repos par une
// déformation appliquée DANS la grille. C'est la méthode déjà employée pour le cycle
// de nage des sirènes, et c'est la seule compatible avec la grille unifiée — animer
// par `setScale` afficherait des pixels de 3,3 px là où tout le reste en fait 3.
//
// `curve` associe un indice de rangée (ou de colonne) à un décalage en pixels. Les
// amplitudes doivent être calibrées pour qu'aucun pixel ne sorte de la grille.

// Décalage HORIZONTAL, rangée par rangée. Pour un sujet vertical : une sirène qui
// ondule, une masse molle qui ballotte.
function swayRows(art, curve, dir) {
    return art.map((row, y) => {
        const dx = (curve[y] || 0) * dir;
        if (dx === 0) return row;
        return dx > 0
            ? '_'.repeat(dx) + row.slice(0, row.length - dx)
            : row.slice(-dx) + '_'.repeat(-dx);
    });
}

// Décalage VERTICAL, colonne par colonne — la transposée de la précédente. Pour un
// sujet horizontal : la nageoire caudale d'un poisson, les ailes d'une raie, dont le
// mouvement se fait de haut en bas et non de gauche à droite.
function swayCols(art, curve, dir) {
    const h = art.length, w = art[0].length;
    const out = [];
    for (let y = 0; y < h; y++) out.push(new Array(w).fill('_'));
    for (let x = 0; x < w; x++) {
        const dy = (curve[x] || 0) * dir;
        for (let y = 0; y < h; y++) {
            const sy = y - dy;
            if (sy >= 0 && sy < h) out[y][x] = art[sy][x] || '_';
        }
    }
    return out.map(r => r.join(''));
}

// Remplace un caractère par un autre dans une fenêtre rectangulaire. Sert à fermer un
// œil ou à éteindre une diode le temps d'une frame : un sujet qui cligne est vivant,
// même immobile.
function repaint(art, { x0, y0, x1, y1 }, from, to) {
    return art.map((row, y) => {
        if (y < y0 || y > y1) return row;
        let out = '';
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            out += (x >= x0 && x <= x1 && from.includes(c)) ? to : c;
        }
        return out;
    });
}

// Construit une courbe : décalage nul avant `start`, puis croissant jusqu'à `max`.
// Évite de recopier à la main des tables d'indices pour chaque créature.
function taperCurve(start, end, max) {
    const curve = {};
    const span = Math.max(1, end - start);
    for (let i = start; i <= end; i++) {
        curve[i] = Math.round(((i - start) / span) * max);
    }
    return curve;
}

// Déclare une animation A-B-A-C si elle n'existe pas déjà.
//
// Le gestionnaire d'animations est GLOBAL au jeu, pas propre à la scène : sans cette
// garde, chaque retour au menu redéclarait les mêmes clés et Phaser avertissait à
// chaque fois. Le cycle A-B-A-C plutôt que A-B-C donne un va-et-vient au lieu d'un
// aller-retour saccadé — c'est ce qui distingue une respiration d'un clignotement.
window.ensureAnim = function (scene, key, frames, frameRate) {
    if (scene.anims.exists(key)) return key;
    scene.anims.create({
        key,
        frames: frames.map(f => ({ key: f })),
        frameRate: frameRate || 8,
        repeat: -1
    });
    return key;
};

// Outil pour créer les images depuis le texte
function generatePixelTexture(scene, key, art, palette, scale) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = art[0].length * scale;
    canvas.height = art.length * scale;
    for (let y = 0; y < art.length; y++) {
        for (let x = 0; x < art[y].length; x++) {
            const char = art[y][x];
            if (palette[char]) { ctx.fillStyle = palette[char]; ctx.fillRect(x * scale, y * scale, scale, scale); }
        }
    }
    scene.textures.addCanvas(key, canvas);
}

// --- MASQUES DE LUMIÈRE ---
//
// `eraserBrush` est fait de quatre cercles pleins d'opacités différentes : en pinceau de
// nettoyage cela ne se voyait pas, mais en masque de lumière chaque marche devient un
// anneau net à l'écran. Un halo à quatre anneaux concentriques est exactement l'image
// terne qu'il faut éviter ici. On génère donc un vrai dégradé continu.
//
// `stops` est une liste [position, couleur] passée telle quelle à createRadialGradient.
// `paliers` : nombre de bandes nettes. Le halo était un dégradé LISSE posé sur un monde en
// pixels de 3 — les deux styles se battaient. Postérisé, il devient une suite d'anneaux
// francs, comme la lumière des jeux en pixel art qui assument leur grille.
//
// Chaque pixel prend la valeur du MILIEU de sa bande de rayon, et non de son bord
// intérieur : l'énergie totale de la lumière reste celle du dégradé lisse, et les
// réglages de visibilité mesurés avant ne bougent pas.
function generateGradientTexture(scene, key, size, stops, paliers) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    for (const [pos, color] of stops) grad.addColorStop(pos, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    if (paliers) {
        const img = ctx.getImageData(0, 0, size, size), px = img.data;
        // Table radiale lue sur la demi-ligne horizontale du centre.
        const lut = [];
        for (let i = 0; i < r; i++) {
            const o = (Math.floor(r) * size + Math.floor(r) + i) * 4;
            lut.push([px[o], px[o + 1], px[o + 2], px[o + 3]]);
        }
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
                const o = (y * size + x) * 4;
                if (d >= 1) { px[o + 3] = 0; continue; }
                const bande = Math.floor(d * paliers);
                const c = lut[Math.min(r - 1, Math.floor(((bande + 0.5) / paliers) * r))];
                px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
            }
        }
        ctx.putImageData(img, 0, 0);
    }
    scene.textures.addCanvas(key, canvas);
}

// LE RÉCIF ÉTEINT. Le sous-titre dit « Rallume le récif », mais une balise allumée ne
// faisait qu'éclairer : on ne VOYAIT pas le récif revivre. Chaque décor existe donc en
// deux versions — la vraie, et une copie décolorée, froide et plus sombre, qui est
// celle qu'on pose. Une balise qui fleurit rend leurs couleurs aux coraux autour d'elle
// (Veil.rallumerRecif), et en fin de niveau le récif a visiblement changé.
//
// Vraie désaturation pixel par pixel, sur canvas : Phaser 3.55 n'a pas de postFX, et
// une teinte multiplie les couleurs sans jamais les retirer.
const FAMILLES_RECIF = ['coral_red', 'weed_green', 'weed_purple', 'crystal_blue', 'sunken_pillar'];
function genererRecifEteint(scene) {
    for (const fam of FAMILLES_RECIF) {
        for (const cle of [fam, fam + '_b', fam + '_c']) {
            if (!scene.textures.exists(cle) || scene.textures.exists(cle + '_gris')) continue;
            const src = scene.textures.get(cle).getSourceImage();
            const c = document.createElement('canvas');
            c.width = src.width; c.height = src.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(src, 0, 0);
            const img = ctx.getImageData(0, 0, c.width, c.height), px = img.data;
            for (let i = 0; i < px.length; i += 4) {
                const l = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
                // Gris FROID et assombri : un récif mort sous l'eau, pas une photo noir
                // et blanc.
                px[i] = l * 0.58; px[i + 1] = l * 0.66; px[i + 2] = l * 0.80;
            }
            ctx.putImageData(img, 0, 0);
            scene.textures.addCanvas(cle + '_gris', c);
        }
    }
}

function generateLightTextures(scene) {
    // MASQUE DE PERÇAGE — blanc opaque au centre, transparent au bord. C'est lui qui
    // décide de la FORME de la zone visible. La chute est volontairement lente sur la
    // moitié extérieure : c'est ce qui donne une pénombre où l'on devine des silhouettes
    // plutôt qu'un disque découpé aux ciseaux.
    // Le cœur ne monte pas à 1 : il reste 4 % de voile même au point le plus éclairé.
    // Sans ce reste, la zone révélée repassait au bleu vif du fond et la lumière chaude
    // n'avait plus rien de sombre sur quoi se détacher.
    generateGradientTexture(scene, 'lightMask', 256, [
        [0.00, 'rgba(255,255,255,0.96)'],
        [0.40, 'rgba(255,255,255,0.94)'],
        [0.58, 'rgba(255,255,255,0.84)'],
        [0.72, 'rgba(255,255,255,0.52)'],
        [0.85, 'rgba(255,255,255,0.23)'],
        [0.94, 'rgba(255,255,255,0.07)'],
        [1.00, 'rgba(255,255,255,0)']
    ], 5);

    // HALO CHAUD — dessiné en fusion additive PAR-DESSUS le monde, sous le voile.
    // Lumière chaude contre eau froide : c'est le contraste qui porte toute la
    // direction artistique. Le noyau tire vers l'ambre, la couronne vers le turquoise,
    // de sorte que la transition vers l'eau sombre reste colorée et non grisâtre.
    // Premier jet : le turquoise prenait la main dès 40 % du rayon, donc sur 84 % de la
    // SURFACE du disque. Résultat, un halo entièrement bleu dans une eau bleue — aucun
    // contraste, l'image la plus terne qu'on puisse produire. Le chaud doit tenir
    // jusqu'aux deux tiers du rayon pour se voir.
    // Premier jet : le turquoise prenait la main dès 40 % du rayon, donc sur 84 % de la
    // SURFACE du disque — un halo entièrement bleu dans une eau bleue. Second écueil,
    // plus subtil : en fusion additive, une couleur ne montre sa teinte que si elle NE
    // SATURE PAS. À 0,95 d'alpha le cœur partait au blanc pur. Le chaud tient donc
    // jusqu'aux deux tiers du rayon, mais à des opacités modérées.
    generateGradientTexture(scene, 'warmGlow', 256, [
        [0.00, 'rgba(255,222,168,0.82)'],
        [0.26, 'rgba(255,192,120,0.70)'],
        [0.50, 'rgba(252,158,98,0.50)'],
        [0.70, 'rgba(224,132,110,0.30)'],
        [0.86, 'rgba(130,168,200,0.11)'],
        [0.95, 'rgba(54,120,190,0.03)'],
        [1.00, 'rgba(0,0,0,0)']
    ], 5);

    // HALO DE BALISE — la couleur de la floraison. Vert-turquoise saturé virant au blanc
    // au cœur : sur fond sombre, une couleur saturée éclate bien plus qu'en pleine
    // lumière. C'est la récompense, elle a le droit d'être franche.
    generateGradientTexture(scene, 'bloomGlow', 256, [
        [0.00, 'rgba(240,255,250,0.9)'],
        [0.15, 'rgba(130,255,214,0.6)'],
        [0.38, 'rgba(64,224,208,0.3)'],
        [0.62, 'rgba(90,140,255,0.14)'],
        [0.85, 'rgba(70,90,200,0.04)'],
        [1.00, 'rgba(0,0,0,0)']
    ], 5);

    // LUEUR NEUTRE — blanche, pour toutes les lueurs qui traversent le voile (appel des
    // balises, yeux, perles, gardiens). Elles utilisaient `bloomGlow`, qui est CYAN : or
    // une teinte se MULTIPLIE avec la texture, et sur du cyan le rouge des ennemis
    // tournait au mauve terne, l'or des balises au vert. Aucune règle de couleurs ne
    // pouvait tenir. Sur du blanc, une teinte donne exactement sa couleur.
    generateGradientTexture(scene, 'glintGlow', 256, [
        [0.00, 'rgba(255,255,255,0.95)'],
        [0.15, 'rgba(255,255,255,0.62)'],
        [0.38, 'rgba(255,255,255,0.30)'],
        [0.62, 'rgba(255,255,255,0.12)'],
        [0.85, 'rgba(255,255,255,0.03)'],
        [1.00, 'rgba(255,255,255,0)']
    ], 4);

    // RAYON DE LUMIÈRE des balises rallumées : une bande verticale, pleine au centre et
    // douce aux bords, qui s'éteint vers le bas. En paliers comme toute la lumière, et
    // tracée à la grille de 3 px. `sun_ray` (la course) plafonnait à 10 % d'opacité :
    // dans la zone rallumée, il ne se voyait pas.
    {
        const L = 16, H = 96, c = document.createElement('canvas');
        c.width = L * 3; c.height = H * 3;
        const g = c.getContext('2d');
        for (let y = 0; y < H; y++) {
            const chute = 1 - y / H;
            for (let x = 0; x < L; x++) {
                const bord = 1 - Math.abs((x + 0.5) / L * 2 - 1);
                const a = Math.round(Math.min(1, bord * 1.6) * chute * 4) / 4 * 0.42;
                if (a <= 0) continue;
                g.fillStyle = `rgba(255,255,255,${a})`;
                g.fillRect(x * 3, y * 3, 3, 3);
            }
        }
        scene.textures.addCanvas('rayonBalise', c);
    }

    // CAUSTIQUES — une nappe de taches douces que l'on fait dériver lentement en fusion
    // additive dans les zones éclairées. C'est peu de chose et c'est la différence entre
    // « de l'eau » et « un fond bleu ».
    const cSize = 256;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = cCanvas.height = cSize;
    const cctx = cCanvas.getContext('2d');
    // Graine fixe : les caustiques doivent être identiques d'une partie à l'autre,
    // sinon un rendu de contrôle n'est pas comparable au suivant.
    let seed = 1337;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 26; i++) {
        const x = rnd() * cSize, y = rnd() * cSize, r = 12 + rnd() * 34;
        const g = cctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(190,255,255,0.30)');
        g.addColorStop(0.5, 'rgba(120,220,255,0.10)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cctx.fillStyle = g;
        cctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    scene.textures.addCanvas('caustics', cCanvas);
}

// LES DÉCORS DE FOND, un par biome, tous de Luis Zuno (ansimuz) — voir Fond.js et
// CREDITS.md : Underwater Fantasy (lagon, CC-BY 3.0, crédit obligatoire), Super Grotto
// Escape (cavernes, CC0), lava-background et ships-graveyard (volcan et ruines, CC0).
// Les chemins sont remplacés par des données embarquées dans la page publiée.
const FOND_ANSIMUZ = {
    ansimuz_far: 'assets/ansimuz/far.png',
    ansimuz_sand: 'assets/ansimuz/sand.png',
    ansimuz_foreground: 'assets/ansimuz/foreground.png',
    decor_caves_loin: 'assets/caves/loin.png',
    decor_caves_milieu: 'assets/caves/milieu.png',
    decor_caves_proche: 'assets/caves/proche.png',
    decor_volcanic_loin: 'assets/volcanic/loin.png',
    decor_volcanic_milieu: 'assets/volcanic/milieu.png',
    decor_volcanic_proche: 'assets/volcanic/proche.png',
    decor_ruins_eau: 'assets/ruins/eau.png',
    decor_ruins_loin: 'assets/ruins/loin.png',
    decor_ruins_milieu: 'assets/ruins/milieu.png',
    decor_ruins_proche: 'assets/ruins/proche.png'
};

// Les seules images du jeu qui viennent d'un FICHIER. Pas par le chargeur de Phaser :
// la 3.55 refuse les adresses data: (« Local data URIs are not supported ») et attend
// alors indéfiniment — dans la page publiée, où les images sont embarquées, le jeu ne
// sortait plus du chargement. On les lit donc nous-mêmes, dès le chargement de ce
// script : bien avant le premier clic, elles sont prêtes.
const IMAGES_DECOR = {};
for (const [cle, chemin] of Object.entries(FOND_ANSIMUZ)) {
    const img = new Image();
    img.src = chemin;
    IMAGES_DECOR[cle] = img;
}
function ajouterImagesDecor(textures) {
    for (const [cle, img] of Object.entries(IMAGES_DECOR)) {
        if (textures.exists(cle)) continue;
        if (img.complete && img.naturalWidth) textures.addImage(cle, img);
        // Pas encore lue : le fond retombe sur le dégradé (Fond.js) jusqu'à la suivante.
        else img.addEventListener('load', () => { if (!textures.exists(cle)) textures.addImage(cle, img); }, { once: true });
    }
}

function loadGameAssets(scene) {
    ajouterImagesDecor(scene.textures);
    // Le TextureManager est global au jeu, mais IntroScene.preload ET MainScene.preload
    // appelaient tous deux cette fonction : une quarantaine de canvas régénérés pour
    // rien à chaque transition de scène, et autant d'erreurs « Texture key already in
    // use » dans la console. Un seul témoin suffit à savoir que le travail est fait.
    if (scene.textures.exists('mermaid1')) return;

    // --- PALETTE 16-BIT « ÉCOLE SQUARESOFT » (Chrono Trigger / Secret of Mana) ---
    //
    // Trois principes, qui font toute la différence avec du pixel art néon :
    //
    //  1. AUCUN CONTOUR NOIR PUR. Un indigo profond (#241a2e) au lieu de #000000.
    //     Le noir absolu découpe le sprite au ciseau ; un contour teinté l'assoit
    //     dans le décor et laisse la couleur respirer.
    //
    //  2. TROIS NUANCES PAR MATÉRIAU. Cheveux, peau et haut n'en avaient que deux,
    //     d'où l'aspect plat. La lumière vient d'en haut à gauche, comme le soleil
    //     qui descend vers le fond.
    //
    //  3. SATURATION CONTENUE (60-80 % au lieu de 100 %) ET TEINTE DÉCALÉE. Les
    //     lumières partent vers le chaud, les ombres vers le froid. Un rouge
    //     simplement assombri donne du plastique ; un rouge qui vire au prune
    //     donne de la chair. C'est ce décalage, plus que le dessin, qui produit
    //     la sensation « 16 bits ».
    const p = {
        _: null,
        // Note : les NUANCES CLAIRES sont volontairement remontées par rapport aux
        // ombres. Une passe entièrement désaturée faisait perdre 16 % de contraste à
        // Mimi à l'intérieur de son propre halo cyan — elle devenait sage mais fade.
        // On garde le modelé et le contour doux, on rend la présence.
        // Seule Mimi en profite : pMalik et pAnais redéfinissent R/P/G et doivent
        // rester en retrait par rapport à l'héroïne.
        k: '#241a2e', w: '#f4f7ff', g: '#b9c2d4', // Contour indigo, blancs cassés
        // MIMI — la première version citait de trop près une sirène de dessin animé
        // connue : cheveux roux, queue verte, haut en coquillages violet. Deux des
        // trois traits changent. Le châtain cuivré reprend la première image de
        // référence fournie ; la queue irisée reste, elle vient des trois références
        // et fait désormais l'identité du personnage.
        R: '#b3673f', r: '#83432a', // Cheveux sirène (châtain cuivré, clair/moyen)
        S: '#f7d0ad', s: '#d49a76', // Peau sirène (clair/moyen)
        P: '#3fb0c8', p: '#24708a', // Haut (bleu pétrole, plus un coquillage violet)
        G: '#6ff0c0', d: '#2f9e7a', D: '#1b5c4d', // Queue sirène & algues
        // Irisation de la queue : c'est le seul trait commun aux trois références
        // fournies — la nageoire vire au violet, l'attache au vert d'eau. À 20x20 il n'y
        // avait pas la place ; à 32x32 la dégradé tient sur la longueur de la queue.
        V: '#8a6ae0', v: '#4a2f8f', // Nageoire caudale (violet clair/sombre)
        E: '#b6f58c',              // Reflet vert d'eau à la naissance de la queue
        O: '#e8a23c', o: '#b06a28', Y: '#f2d661', // Poissons et perles
        B: '#5cc4e8', b: '#2a6f9e', // Variantes bleues
        X: '#8a6a45', x: '#4a3320', // Déchets (brun)
        c: '#e06a5c', C: '#9e3a3a'  // Corail
    };

    // PALETTE DE COULEURS 16-BIT
    const pNature = {
        '_': null,
        '0': '#1a2438', // Contour/ombre : bleu de nuit, pas de noir
        // LA PALETTE DE LA RÉFÉRENCE (l'image d'ambiance du joueur, relevée au pixel) :
        // des coraux orange, prune et violets contre une eau turquoise. Les tons étaient
        // grenat → rose poudré : des couleurs sages, qui ne « rallumaient » rien.
        'c': '#94432e', 'C': '#da774e', '1': '#f6ad80',
        '2': '#2f8250', '3': '#4fb56c', // Algue verte (vert d'eau de la référence)
        '4': '#8a5fc4', '5': '#b892e0'  // Algue violette
    };
    const coralDesc = [
        "______________00________________",
        "___00_______001100________00____",
        "__0CC0_____001CC100______0110___",
        "_01CC10____01CCCC10_____0C1C10__",
        "0C1cc1C0__01CccccC10___0C1cc1C0_",
        "0CcccC1C0_0C1ccc1C10__0C1cc1C10_",
        "0Cccc1C10_0Ccc1cccC0_0C1cc1C100_",
        "_0C1c1C00__0C1cc1C00_0Cccc1C0___",
        "__01C10_____0C1C10____01C100____",
        "___000_______0000______000______"
    ];
    // VARIANTES — la variété du décor reposait sur une échelle et un angle tirés au
    // hasard, supprimés en unifiant la grille de pixels. Elle repose désormais sur des
    // formes réellement dessinées : deux de plus par famille, aux dimensions exactes de
    // l'originale, parce que les corps physiques de LevelGenerator en dépendent.
    const coralDescB = [
        "_____00___________00____________",
        "____0110_________0110___________",
        "___01CC10_______01CC10______00__",
        "__01CCCC10_____01CCCC10____0110_",
        "_0C1ccccC10___0C1ccccC10__01CC10",
        "0C1cccc1C10__0C1cccc1C10_0C1cc1C",
        "0Ccc1ccC100__0Ccc1ccC100_0Ccc1C0",
        "_0C1cc1C0_____0C1cc1C0____01C10_",
        "__01CC10_______01CC10______000__",
        "___0000_________0000____________"
    ];

    const coralDescC = [
        "_________0000___________________",
        "_______00CCCC00_________________",
        "_____001CCCCCC100_______00______",
        "____01CCCcccCCCC10____001100____",
        "___0C1CccccccccC1C0__01CccC10___",
        "__0C1cccccccccccc1C00C1cccc1C0__",
        "_0Ccc1ccccccccc1ccC00Ccc1ccC10__",
        "_0C1cc1C0000C1cc1C0__0C1cc1C0___",
        "__01C100____001C100___01CC10____",
        "___000________000______000______"
    ];

    // Deux autres coraux, rose et violet, pour que le récif rallumé ne soit pas d'une
    // seule couleur.
    const pCorailRose = { ...pNature, 'c': '#6e2a52', 'C': '#a8448a', '1': '#d97ab4' };
    const pCorailViolet = { ...pNature, 'c': '#3b2885', 'C': '#744ace', '1': '#a98ae8' };
    generatePixelTexture(scene, 'coral_red', coralDesc, pNature, PIXEL);
    generatePixelTexture(scene, 'coral_red_b', coralDescB, pCorailRose, PIXEL);
    generatePixelTexture(scene, 'coral_red_c', coralDescC, pCorailViolet, PIXEL);

    const weedDesc = [
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______"
    ];
    const weedDescB = [
        "______00______",
        "_____0320_____",
        "_____032230___",
        "_____0320_____",
        "___032230_____",
        "_____0320_____",
        "_____032230___",
        "_____0320_____",
        "___032230_____",
        "_____0320_____",
        "_____0320_____",
        "_____0320_____",
        "______00______"
    ];

    // Cette variante était deux brins fins à feuilles d'un pixel : à 3 px écran par
    // pixel d'art, une feuille de 1 px disparaît, et il ne restait que deux bâtonnets
    // nus — indiscernables des deux autres formes, qui sont déjà des tiges. C'est la
    // SILHOUETTE qui doit changer, pas le détail : une touffe large à frondes, qui se
    // distingue des deux strandes même réduite à la taille du jeu.
    const weedDescC = [
        "___0___0___0__",
        "__030_030_030_",
        "__032_032_032_",
        "__032203220320",
        "___0322222320_",
        "___0322222320_",
        "____03222230__",
        "____03222230__",
        "_____032230___",
        "_____03220____",
        "______0330____",
        "______0220____",
        "_______00_____"
    ];

    const pWeedPurple = { ...pNature, '2': '#69327d', '3': '#9a5ccc' };
    generatePixelTexture(scene, 'weed_green', weedDesc, pNature, PIXEL);
    generatePixelTexture(scene, 'weed_green_b', weedDescB, pNature, PIXEL);
    generatePixelTexture(scene, 'weed_green_c', weedDescC, pNature, PIXEL);
    generatePixelTexture(scene, 'weed_purple', weedDesc, pWeedPurple, PIXEL);
    generatePixelTexture(scene, 'weed_purple_b', weedDescB, pWeedPurple, PIXEL);
    generatePixelTexture(scene, 'weed_purple_c', weedDescC, pWeedPurple, PIXEL);

    const crystalDesc = [
        "____00____",
        "___0320___",
        "__033220__",
        "_03322220_",
        "0333222220",
        "0333222220",
        "0322322320",
        "_00000000_"
    ];
    const crystalDescB = [
        "__0____00_",
        "_030__0320",
        "_0320_0320",
        "_0320_0320",
        "_03220320_",
        "0332222320",
        "0322223220",
        "_00000000_"
    ];

    const crystalDescC = [
        "__________",
        "___0000___",
        "__032230__",
        "_03322230_",
        "0332222230",
        "0322222220",
        "0322322220",
        "_00000000_"
    ];

    const pCrystal = { ...pNature, '2': '#5aa8d4', '3': '#dfeef7' };
    generatePixelTexture(scene, 'crystal_blue', regridArt(crystalDesc, 4 / 3, '0'), pCrystal, PIXEL);
    generatePixelTexture(scene, 'crystal_blue_b', regridArt(crystalDescB, 4 / 3, '0'), pCrystal, PIXEL);
    generatePixelTexture(scene, 'crystal_blue_c', regridArt(crystalDescC, 4 / 3, '0'), pCrystal, PIXEL);

    const ventDesc = [
        "___0000___",
        "__011110__",
        "_0CC11CC0_",
        "0Ccc11ccC0",
        "0Cc0000cC0",
        "0000000000"
    ];
    // La fumerolle « respirait » par un tween scaleY: 1.1 — de la roche qui s'étire,
    // et des pixels de 3,3 px en hauteur pour 3 en largeur. C'est la braise qui pulse
    // maintenant : même dessin, trois intensités de rouge.
    const ventFine = regridArt(ventDesc, 2, '0');
    const pVentRock = { '_': null, '0': '#1a1018', 'C': '#3d2118', 'c': '#5e3524' };
    generatePixelTexture(scene, 'volcanic_vent', ventFine, { ...pVentRock, '1': '#e07030' }, PIXEL);
    generatePixelTexture(scene, 'volcanic_vent2', ventFine, { ...pVentRock, '1': '#ffb060' }, PIXEL);
    generatePixelTexture(scene, 'volcanic_vent3', ventFine, { ...pVentRock, '1': '#9c4418' }, PIXEL);

    const pillarDesc = [
        "0000000000",
        "0222222220",
        "0232222320",
        "_02000020_",
        "_020__020_",
        "_020__020_",
        "_020__020_",
        "_020__020_",
        "0020000200",
        "0222222220",
        "0000000000"
    ];
    const pillarDescB = [
        "__0_______",
        "_030__0___",
        "_020_030__",
        "_020_020__",
        "_020_020__",
        "_020_020__",
        "_020_020__",
        "_020_020__",
        "0020000200",
        "0222222220",
        "0000000000"
    ];

    const pillarDescC = [
        "__________",
        "__________",
        "__________",
        "_00____00_",
        "_020__020_",
        "_020__020_",
        "_020__020_",
        "0020000200",
        "0222222220",
        "0233223320",
        "0000000000"
    ];

    const pPillar = { '_': null, '0': '#1a2438', '2': '#4a5a63', '3': '#6e8189' };
    generatePixelTexture(scene, 'sunken_pillar', regridArt(pillarDesc, 5 / 3, '0'), pPillar, PIXEL);
    generatePixelTexture(scene, 'sunken_pillar_b', regridArt(pillarDescB, 5 / 3, '0'), pPillar, PIXEL);
    generatePixelTexture(scene, 'sunken_pillar_c', regridArt(pillarDescC, 5 / 3, '0'), pPillar, PIXEL);

    // POISSONS HD (Faune d'ambiance — Forme réaliste avec nageoires et queue)
    const pFish = {
        '_': null,
        '0': '#2a1a20', // Contour teinté (brun-prune), pas de noir
        'B': '#e08040', // Corps principal
        'b': '#f0a868', // Corps clair
        'H': '#c05f2e', // Tête / dos foncé
        'h': '#f5c48f', // Ventre clair
        'F': '#cf7038', // Nageoires
        'f': '#e09354', // Nageoires clair
        'T': '#a04a24', // Queue
        't': '#c76338', // Queue clair
        'E': '#f4f7ff', // Oeil blanc
        'e': '#241a2e', // Pupille
        'L': '#ffe6c4'  // Lumière / reflet
    };
    const fishDesc = [
        "_________0000________________",
        "___000__0FffF0_______________",
        "__0HHH00BBBBBb000____________",
        "_0HHHBBBBBBBBBBBB000_________",
        "0THHBBBBBEeBBBBBBBBB00__00___",
        "0ttHBBBBBBBBBbbbbBBBB00_0f0__",
        "0TtHBBBBBBBBBbhhhbBBBBB0Ff0__",
        "0ttHBBBBBBBBBbbbbBBBB00_0f0__",
        "0THHBBBBBLLBBBBBBBBb00__00___",
        "_0HHHBBBBBBBBBBBB000_________",
        "__0HHH00BBBBBb000____________",
        "___000__0FffF0_______________",
        "_________0000________________"
    ];
    // BATTEMENT DE QUEUE — le poisson regarde à gauche, sa caudale est le petit amas
    // détaché des colonnes 23-28. Le corps s'arrête à la colonne 22 : décaler à partir
    // de 23 fait battre la nageoire sans déchirer le poisson.
    const FISH_TAIL = { 23: 1, 24: 1, 25: 2, 26: 2, 27: 2, 28: 2 };
    const fishUp = swayCols(fishDesc, FISH_TAIL, 1);
    const fishDown = swayCols(fishDesc, FISH_TAIL, -1);

    const pFishBlue = {
        ...pFish,
        '0': '#1a2438',                 // Contour bleu de nuit
        'B': '#3f7fc4', 'b': '#6aa6dd', // Corps
        'H': '#2a5b9e', 'h': '#9ecdf0', // Tête foncée / Ventre clair
        'F': '#3570b0', 'f': '#5090cc', // Nageoires
        'T': '#1f4a80', 't': '#3a6ba8', // Queue
        'L': '#cfe8ff'                  // Reflet
    };
    generatePixelTexture(scene, 'fish_orange2', fishUp, pFish, PIXEL);
    generatePixelTexture(scene, 'fish_orange3', fishDown, pFish, PIXEL);
    generatePixelTexture(scene, 'fish_blue2', fishUp, pFishBlue, PIXEL);
    generatePixelTexture(scene, 'fish_blue3', fishDown, pFishBlue, PIXEL);

    generatePixelTexture(scene, 'fish_orange', fishDesc, pFish, PIXEL);
    generatePixelTexture(scene, 'fish_blue', fishDesc, {
        ...pFish,
        '0': '#1a2438',                 // Contour bleu de nuit
        'B': '#3f7fc4', 'b': '#6aa6dd', // Corps
        'H': '#2a5b9e', 'h': '#9ecdf0', // Tête foncée / Ventre clair
        'F': '#3570b0', 'f': '#5090cc', // Nageoires
        'T': '#1f4a80', 't': '#3a6ba8', // Queue
        'L': '#cfe8ff'                  // Reflet
    }, PIXEL);

    // TRASH (Amas toxique, déchets pétroliers compactés)
    // Dans la palette de la référence : ardoise et bleu nuit, une pointe de rouille.
    // Il était brun vase à bidon JAUNE, en 88 px : sur les captures, l'élément le plus
    // gros et le plus contrasté de l'écran — plus que le récif qu'on vient rallumer. Un
    // déchet gêne, il ne doit pas voler la vedette : sombre, petit, éteint.
    const pTrash = {
        '_': null,
        '0': '#0a121c', // Contour
        '1': '#121d2a', // Ombre
        '2': '#1a2a3a', // Ardoise foncée
        '3': '#24394c', // Ardoise
        '4': '#30495e', // Ardoise claire
        'X': '#4e5a62', // Ferraille
        'Y': '#8a9a5a', // Reflet trouble (LUEUR.gene)
        'R': '#94432e'  // Rouille (l'orange sombre des coraux)
    };
    const trashDesc = [
        "_______0000000________",
        "_____00333333300______",
        "____0123444443210_____",
        "___012334444332110____",
        "___012334XXXX32210____",
        "__012234XXXXXY43210___",
        "__012234XXXXXY43210___",
        "__0112334XXXX332110___",
        "__01123344444332110___",
        "___012233444332110____",
        "___011223333221110____",
        "____0011222111000_____",
        "______00000000________"
    ];
    // À la grille d'origine, sans agrandissement 4/3 : 66 px au lieu de 88.
    generatePixelTexture(scene, 'trash', trashDesc, pTrash, PIXEL);

    // MINE (Style Super Metroid / Techno-Abyssal)
    const pMine = {
        '_': null,
        '0': '#000000', // Noir Outline
        '1': '#111111', // Métal sombre
        '2': '#333333', // Métal
        '3': '#555555', // Métal clair
        '4': '#777777', // Highlight
        'R': '#ff0000', // Rouge clignotant
        'O': '#ff8800'  // Ornement
    };
    const mineDesc = [
        "________00____________",
        "______003300__________",
        "_____03344330_________",
        "____0344444330________",
        "_00_0344444330_00_____",
        "0220_03444330_0220____",
        "0223000R00R0003220____",
        "023300R0000R003320____",
        "_00_03R0000R30_00_____",
        "____034R00R430________",
        "_____034RR430_________",
        "______003300__________",
        "________00____________"
    ];
    // Attention mine originelle (rouge) 
    // La mine « clignotait » par un tween scale: 1.1 — donc avec des pixels de 3,3 px
    // au lieu de 3, seule entorse restante à la grille unifiée. C'est maintenant la
    // diode qui clignote, pas le sprite qui enfle : le rouge vif passe au rouge éteint.
    const pMineDim = { ...pMine, 'R': '#5c1010' };
    generatePixelTexture(scene, 'mine', regridArt(mineDesc, 4 / 3, '0'), pMine, PIXEL);
    generatePixelTexture(scene, 'mine2', regridArt(mineDesc, 4 / 3, '0'), pMineDim, PIXEL);

    // OURSIN — gardien que l'Onde brise. Pas de regridArt : il repose un contour de
    // 1 px sur toute la silhouette, et des piquants larges d'un pixel deviendraient
    // entièrement noirs, donc invisibles dans le voile. Dessiné à sa taille finale.
    const pUrchin = {
        '_': null,
        '0': '#1a0d24', // contour
        '1': '#56307a', // corps
        '2': '#7a4fa3', // piquants
        '3': '#e6c6ff', // pointes : c'est elles que l'œil attrape dans le noir
        'W': '#d9b3ff'  // reflet
    };
    const urchinDesc = [
        "_______3___3_______",
        "_______3___3_______",
        "_______3___3_______",
        "___3___22_22___3___",
        "____3___2_2___3____",
        "_____2__000__2_____",
        "______0011100______",
        "3332__01W2110__2333",
        "___2201221111022___",
        "_____011111110_____",
        "___2201111111022___",
        "3332__0111110__2333",
        "______0011100______",
        "_____2__000__2_____",
        "____3___2_2___3____",
        "___3___22_22___3___",
        "_______3___3_______",
        "_______3___3_______",
        "_______3___3_______"
    ];
    generatePixelTexture(scene, 'urchin', urchinDesc, pUrchin, PIXEL);

    // MÉDUSE — gardien que le Bouclier encaisse. Deux palettes pour un battement,
    // comme la diode de la mine : la lumière pulse, la taille ne bouge pas, la grille
    // de pixels reste unifiée.
    const pJelly = {
        '_': null,
        '0': '#7a2266', '1': '#ff86c8', '2': '#ffd6ee', '3': '#e05aa8', '4': '#fff0fa'
    };
    const pJellyDim = { ...pJelly, '0': '#4d1640', '1': '#c4669a', '2': '#e8b4d4', '3': '#a3417a', '4': '#f0d0e4' };
    const jellyDesc = [
        "_______0_______",
        "____0000000____",
        "___002211100___",
        "__01211111110__",
        "_0012111141100_",
        "_0111114114110_",
        "_0111111111110_",
        "_0111111111110_",
        "_0000000000000_",
        "__2___2___2__2_",
        "__2___2___2_2__",
        "__3___3___3_3__",
        "___3___3__3_3__",
        "___3___3_3_3___",
        "___3___3_3_3___",
        "____3_3__3_3___",
        "____3_3_3___3__",
        "____3_3_3___3__",
        "___3_3__3___3__",
        "_____3___3_____",
        "_____3___3_____"
    ];
    generatePixelTexture(scene, 'jelly', jellyDesc, pJelly, PIXEL);
    generatePixelTexture(scene, 'jelly2', jellyDesc, pJellyDim, PIXEL);

    // SCEAU — bloc de corail blanchi, gardien que le Rayon brûle. Première version : les
    // formes de corail du décor, teintées rouge sombre. Deux défauts vus sur capture :
    // dans le volcan, le rouge sombre se fondait dans le rouge ambiant ; et la forme
    // visible n'occupait qu'une partie de son image de 93 px, alors que la collision la
    // prenait en entier — Mimi butait dans le vide entre deux coraux qui semblaient
    // laisser passer. Ce bloc-ci est PÂLE sur le rouge, et remplit son cadre : ce qui
    // arrête Mimi est exactement ce qu'on voit.
    const pSceau = {
        '_': null,
        '0': '#3a2a22', '1': '#bfa892', '2': '#e6d6c2', '3': '#8a7462',
        'P': '#ff9a6b'  // polypes : rappellent le feu du Rayon qui les ouvrira
    };
    const sceauDesc = [
        "_______________",
        "___000_0000____",
        "__0222022110___",
        "__0222221110___",
        "__2222221P110__",
        "__022P11111100_",
        "__022111111130_",
        "__022111111P330",
        "_0211111P133330",
        "_011P111133330_",
        "_011111133P00__",
        "__0011P33300___",
        "___00133330____",
        "_____00330_____",
        "_______00______"
    ];
    generatePixelTexture(scene, 'sceau', sceauDesc, pSceau, PIXEL);

    // BAUDROIE — ce qui chasse la lumière. Corps sombre des abysses, gueule à dents, et
    // une tige qui porte sa lanterne au-dessus de la tête. Deux images : gueule fermée en
    // maraude, ouverte en chasse. La tige et la lanterne n'ont pas de contour : larges
    // d'un pixel, elles deviendraient noires et disparaîtraient dans le voile.
    const pBaudroie = {
        '_': null,
        '0': '#0a0610', '1': '#2b2233', '2': '#43384f', '3': '#5a4a63',
        'T': '#e8e2d0', // dents
        'M': '#3a0d18', // gueule
        'E': '#d8f0e0', // œil pâle
        'S': '#7a6a88', // tige
        'L': '#eaffb0'  // lanterne : le seul point clair, celui que l'œil suit dans le noir
    };
    generatePixelTexture(scene, 'baudroie', [
        "__________________________________",
        "__________________________________",
        "___________________SSSSSSS________",
        "__________________SS_____SS_______",
        "__________________S________LL_____",
        "_________________SS________LL_____",
        "____________000000000_____________",
        "_________00022222222200___________",
        "0_______0111222222222220__________",
        "00_____011112222222222220_________",
        "010___0111111111111EE11110________",
        "0110_011111111111111111110________",
        "01110111111111111111111110________",
        "00111111111111111111111110________",
        "__0111111111111111111111110_______",
        "0011111111111111111111TMM0________",
        "01110111111111111MMMMMMMM0________",
        "0110_01111111111111111TMM0________",
        "010___03333333333333333330________",
        "00_____033333333333333330_________",
        "0_______0333333333333330__________",
        "_________00033333333300___________",
        "____________000000000_____________",
        "__________________________________"
    ], pBaudroie, PIXEL);
    generatePixelTexture(scene, 'baudroie2', [
        "__________________________________",
        "__________________________________",
        "___________________SSSSSSS________",
        "__________________SS_____SS_______",
        "__________________S________LL_____",
        "_________________SS________LL_____",
        "____________000000000_____________",
        "_________00022222222200___________",
        "0_______0111222222222220__________",
        "00_____011112222222222220_________",
        "010___0111111111111EE11110________",
        "0110_011111111111111111110________",
        "011101111111111111111111T0________",
        "0011111111111111111111TMM0________",
        "__0111111111111111111MMMMM0_______",
        "0011111111111111111MMMMMM0________",
        "01110111111111111MMMMMMMM0________",
        "0110_01111111111111MMMMMM0________",
        "010___033333333333333MMMM0________",
        "00_____033333333333333TM0_________",
        "0_______0333333333333330__________",
        "_________00033333333300___________",
        "____________000000000_____________",
        "__________________________________"
    ], pBaudroie, PIXEL);

    // PEARL (Bonus de vitesse)
    const pearlDesc = [
        "_____kkkk_______",
        "___kkYYYYkk_____",
        "__kYYwwYYYYk____",
        "_kYYwwYYYYYYk___",
        "_kYYYYYYYYYYk___",
        "_kYYYYYYYYYYk___",
        "__kYYYYYYYYk____",
        "___kkYYYYkk_____",
        "_____kkkk_______"
    ];
    // La perle scintillait par un tween scaleX/scaleY: 1.5 — donc en gonflant de 50 %,
    // avec des pixels de 4,5 px. C'est le reflet qui se déplace sur la nacre
    // maintenant : on efface le point blanc, puis on le repose ailleurs.
    const pearlNoGlint = repaint(pearlDesc, { x0: 0, y0: 0, x1: 15, y1: 8 }, 'w', 'Y');
    const pearlGlint = (x0, y0, x1, y1) => repaint(pearlNoGlint, { x0, y0, x1, y1 }, 'Y', 'w');
    generatePixelTexture(scene, 'pearl', pearlDesc, p, PIXEL);
    generatePixelTexture(scene, 'pearl2', pearlGlint(6, 3, 7, 4), p, PIXEL);
    generatePixelTexture(scene, 'pearl3', pearlNoGlint, p, PIXEL);

    // ENNEMI (Visage du monstre style retro -> Mutant HD)
    const pBoss = {
        '_': null,
        '0': '#1a1226', // Contour épais, indigo profond
        '1': '#2e1f42', // Violet sombre chair
        '2': '#472f63', // Violet
        '3': '#6b478f', // Violet clair (muscle)
        '4': '#9560c4', // Violet lumineux
        'R': '#e04a52', // Oeil rouge veineux
        'O': '#e8a23c', // Oeil jaune (iris)
        'V': '#7ec44a', // Bave verte toxique
        'v': '#3a6b2a'  // Bave foncée
    };

    const bossDesc = [
        "_____________000000_______________",
        "___________0011111100_____________",
        "_________00112222221100________00_",
        "________0112223333222110_____00v0_",
        "_______011223333333322110___01vV0_",
        "______01123344444443322110_01vV0__",
        "______0123344400044433221001vv0___",
        "_____0123444400O004444322111v0____",
        "_____013444440ORR04444332211v0____",
        "_____013444440RR00444433221110____",
        "_____0123444400004444332211110____",
        "_____0123344444444443332211100____",
        "______01223334444433322111100_____",
        "______011222333333222111100_______",
        "_______001111222111111000_________",
        "_________0001111111000____________",
        "___________00000000_______________"
    ];
    // Ennemi standard prend cette forme de mutant
    // BLOB — ballottement de la moitié basse et clignement de l'œil.
    // Le clignement s'applique à l'art d'ORIGINE, avant remontée sur la grille fine :
    // les coordonnées de l'œil y sont lisibles à la main, alors qu'après remontée
    // elles deviennent des fractions.
    //
    // L'ENNEMI ordinaire n'est plus un blob VIOLET de 170 px : violet comme les coraux
    // qu'on rallume, il s'y confondait, et il dominait l'écran. Il devient une bête des
    // profondeurs, bleu nuit, dans la palette de la référence, à la grille d'origine
    // (102 px) — une silhouette que trahissent son œil rouge et sa bave turquoise. Le
    // rouge, c'est le danger (LUEUR.danger) : l'œil dit ce qu'il est.
    // Palette à part : `pBoss` habille aussi les boss.
    const pEnnemi = {
        ...pBoss,
        '0': '#060e1c', '1': '#0c1a32', '2': '#132a4c', '3': '#1c3d68', '4': '#28547e',
        'R': '#ff4d6d', 'O': '#ffb070', 'V': '#2a9281', 'v': '#174f50'
    };
    const ENEMY_WOBBLE = taperCurve(9, 16, 1);
    generatePixelTexture(scene, 'enemy', bossDesc, pEnnemi, PIXEL);
    generatePixelTexture(scene, 'enemy2', swayRows(bossDesc, ENEMY_WOBBLE, 1), pEnnemi, PIXEL);
    generatePixelTexture(scene, 'enemy3',
        repaint(bossDesc, { x0: 13, y0: 7, x1: 17, y1: 9 }, 'OR', '0'), pEnnemi, PIXEL);

    // --- ASSETS PHASE 6 : COURSE (CHASE) ---

    // VOLEUR FURTIF HD (Ombre véloce)
    const pThief = {
        '_': null,
        '0': '#000000', '1': '#111122', '2': '#222244',
        'Y': '#ffff00', 'y': '#ccaa00'
    };
    const thiefDesc = [
        "__________00____________00________",
        "_________0220__________0220_______",
        "________021120________021120______",
        "_______0210012000000002100120_____",
        "______0210__012222222210__0120____",
        "_____0210____0111111110____0120___",
        "____0210_____0100000010_____0120__",
        "___0210______010YYYY010______0120_",
        "__0210_______010yyyy010_______0120",
        "_0210________0100000010________010",
        "0220__________01111110__________00",
        "000____________000000_____________"
    ];
    // BATTEMENT D'AILES — les bras du voleur partent du centre en haut et descendent
    // vers l'extérieur. Les colonnes extérieures n'ont donc de matière qu'en bas : on
    // ne les décale que VERS LE HAUT. Vers le bas, les pointes sortiraient de la
    // grille et seraient rognées.
    // Amplitude par colonne, en proportion : le bout de l'aile monte le plus, la
    // jonction avec le corps ne bouge pas. Multipliée ensuite pour obtenir une frame
    // intermédiaire et une frame extrême — à amplitude 2 partout, le battement ne se
    // voyait tout simplement pas à l'écran.
    const wingLift = amp => {
        const curve = {};
        for (let x = 0; x < 34; x++) {
            const d = Math.min(Math.abs(x - 6), Math.abs(x - 27)); // distance au bout d'aile
            if (d <= 6) curve[x] = Math.round(amp * (1 - d / 6));
        }
        return curve;
    };
    generatePixelTexture(scene, 'thief', thiefDesc, pThief, PIXEL);
    generatePixelTexture(scene, 'thief2', swayCols(thiefDesc, wingLift(2), 1), pThief, PIXEL);
    generatePixelTexture(scene, 'thief3', swayCols(thiefDesc, wingLift(4), 1), pThief, PIXEL);

    // --- NOUVEAUX ASSETS PHASE 3 & 4 ---

    // BOSS VASE (Mutant géant baveux)
    const bossVaseDesc = [
        "_______________0000000_____________",
        "____________000vvvvVvv00___________",
        "__________00vvvv11111vvv00_________",
        "_________0vvVvv1122211VvvV0________",
        "________0vVVvv112333211vvVv0_______",
        "_______0vVvvv11234443211vvvV0______",
        "_______0Vvvv1123400043211vVvV0_____",
        "______0VvVvv11340ORO043211Vvv0_____",
        "______0vvvVv11340000043211vvVv0____",
        "______0vVvvV1123444443211vvvvv0____",
        "______0Vvvvvv11233332211vvVvVv0____",
        "_______0vVvvvv11111111vvvVvvv0_____",
        "________0vvvvvvvvvvvvvvvvVvv0______",
        "_________00vVvVvvvvvvVvvvv00_______",
        "___________000000000000000_________"
    ];
    // Le pire écart de la grille : 7 px écran par pixel d'art, contre 3 pour Mimi.
    const bossFine = regridArt(bossVaseDesc, 7 / 3, '0');

    // RESPIRATION DU BOSS — il n'avait qu'un flottement vertical : une image fixe qui
    // monte et descend, donc une masse qui glisse au lieu de vivre. La moitié basse
    // ballotte maintenant d'un côté, et l'œil se ferme sur une frame. Les coordonnées
    // de l'œil (colonnes 17-19, rangée 7) se lisent sur l'art d'origine, pas sur la
    // grille remontée.
    const BOSS_WOBBLE = taperCurve(18, 34, 2);
    const bossFine2 = swayRows(bossFine, BOSS_WOBBLE, 1);
    const bossFine3 = regridArt(repaint(bossVaseDesc, { x0: 17, y0: 7, x1: 19, y1: 7 }, 'OR', '0'), 7 / 3, '0');

    generatePixelTexture(scene, 'boss_vase', bossFine, pBoss, PIXEL);
    generatePixelTexture(scene, 'boss_vase2', bossFine2, pBoss, PIXEL);
    generatePixelTexture(scene, 'boss_vase3', bossFine3, pBoss, PIXEL);

    // BOSS PLASTIQUE (Sacs et bouteilles agglomérés)
    const pBossPlastique = { ...pBoss, 'V': '#b8bcc4', 'v': '#5f646e', '3': '#e8ecf2', '4': '#7fd4e0' };
    generatePixelTexture(scene, 'boss_plastique', bossFine, pBossPlastique, PIXEL);
    generatePixelTexture(scene, 'boss_plastique2', bossFine2, pBossPlastique, PIXEL);
    generatePixelTexture(scene, 'boss_plastique3', bossFine3, pBossPlastique, PIXEL);

    // BOSS PETROLE (Masse d'hydrocarbure aux reflets irisés)
    // Un noir sur noir était illisible sur le voile rouge du combat : on garde une
    // silhouette sombre mais on remonte les valeurs et on ajoute la nacre du pétrole.
    const pPetrole = {
        ...pBoss,
        'V': '#3d3d4f', // contour extérieur, doit détacher la silhouette du fond
        'v': '#24242f',
        '1': '#4a4a5e',
        '2': '#2e2e3c',
        '3': '#7a5fa0', // reflet irisé violet
        '4': '#3fae9c', // reflet irisé turquoise
        'R': '#ff3355', // œil
        'O': '#ffcc44'
    };
    generatePixelTexture(scene, 'boss_petrole', bossFine, pPetrole, PIXEL);
    generatePixelTexture(scene, 'boss_petrole2', bossFine2, pPetrole, PIXEL);
    generatePixelTexture(scene, 'boss_petrole3', bossFine3, pPetrole, PIXEL);

    // TRIDENT MAGIQUE HD
    const pTridentBase = {
        '_': null,
        'O': '#1e1b4b', 'H': '#92400e', 'h': '#451a03',
        'S': '#d97706', 'M': '#b45309', 's': '#78350f',
        'T': '#2dd4bf', 'B': '#0d9488', 't': '#0f766e',
        'G': '#fbbf24', 'g': '#b45309', 'W': '#f8fafc',
        'w': '#94a3b8'
    };
    const pTrident = { ...pTridentBase, 'C': '#00ffff', 'c': '#0088cc', '0': '#000000', '1': '#ffffff', 'Y': '#ffff00', 'y': '#bbbb00' };
    const tridentDesc = [
        "___000___000___000___",
        "__0CCC0_0CCC0_0CCC0__",
        "__0c1c0_0c1c0_0c1c0__",
        "__0c1c0_0c1c0_0c1c0__",
        "__0ccc000ccc000ccc0__",
        "___0Yc000Yc000Yc00___",
        "____0YY00YY00YY0_____",
        "_____0YyyyyyyyY0_____",
        "______0000Y0000______",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0y0_________",
        "_________0y0_________",
        "__________0__________"
    ];
    generatePixelTexture(scene, 'trident', tridentDesc, pTrident, PIXEL);

    // DAUPHIN HD
    // Les deux dauphins ('dolphin' et 'electric_dolphin') ont été retirés avec le
    // pouvoir des Dauphins. Le premier n'était déjà référencé nulle part ; le second
    // n'existait que pour la salve qui infligeait 20 % des PV du boss par bête.

    // PROJECTILES HD
    const pShot = { '_': null, '0': '#00ffff', '1': '#ffffff', '2': '#0088ff' };
    const mimiShot = [
        "_010_",
        "01110",
        "20102",
        "_202_"
    ];
    generatePixelTexture(scene, 'mimi_shot', regridArt(mimiShot, 4 / 3, null), pShot, PIXEL);

    const pBossShot = { '_': null, '0': '#ff0000', '1': '#ffaa00', '2': '#aa0000' };
    const bossShot = [
        "_010_",
        "01110",
        "20102",
        "_202_"
    ];
    generatePixelTexture(scene, 'boss_shot', regridArt(bossShot, 4 / 3, null), pBossShot, PIXEL);

    // LES QUATRE PANNEAUX DE CINÉMATIQUE ONT ÉTÉ RETIRÉS.
    //
    // Ils illustraient le prologue narratif — quatre écrans passifs, une quarantaine de
    // secondes avant que le joueur ait la main — remplacé par l'ouverture jouable de
    // `scenes/IntroScene.js`. Générés à INTRO_PIXEL = 10, ils pesaient environ 4 Mo de
    // mémoire de texture et quatre rasterisations à CHAQUE lancement, pour des images
    // que plus aucune scène n'affichait.

    // --- RESTAURATION DES SPRITES 16-BITS ---

    // Palette des personnages : la base commune `p` augmentée de la TROISIÈME nuance
    // de chaque matériau. C'est elle qui crée le volume — sans elle, les cheveux, la
    // peau et le haut restaient des aplats. (`p` et `pElegant` étaient auparavant deux
    // objets rigoureusement identiques ; il n'y en a plus qu'un.)
    const pElegant = {
        ...p,
        q: '#52281a', // cheveux, ombre : le châtain vire à la terre brûlée
        t: '#96685f', // peau, ombre : l'ocre vire à la terre de rose
        u: '#143f52'  // haut, ombre : le pétrole vire au bleu de nuit
    };

    // SIRÈNE 16-BIT — GRILLE 32x32 (Frame 1 : pose neutre)
    //
    // Les proportions ne sont PAS redessinées : elles sont transférées de la grille
    // 20x20 précédente, qui les avait justes (tête 40 %, buste 15 %, queue 45 %). Un
    // redessin à main levée les ratait systématiquement. Le contour a ensuite été
    // ramené à 1 px et la silhouette lissée, avant de repeindre l'intérieur.
    //
    // Ce que les 2,5x pixels en plus permettent, et que 20x20 ne permettait pas :
    //  - un visage : yeux avec reflet, nez, bouche, menton dégagé (avant : deux
    //    marques sombres sur un aplat de peau) ;
    //  - des bras et des mains détachés du buste ;
    //  - une queue qui décroît vraiment puis s'ouvre en nageoire caudale horizontale.
    //    À 20x20 la caudale tenait sur 2 rangées et se lisait comme deux pieds ;
    //  - l'irisation vert d'eau -> turquoise -> violet des références.
    const m1 = [
        "____________kkkkkk______________",
        "____________kRRRRk______________",
        "__________kkRRRRrrkkk___________",
        "__________kRRRRrrrrrk___________",
        "________kkRRRRRrrrrrrkk_________",
        "_______kRRRRRrrrrrrqqqqk________",
        "_______kRRRRrrrrrrrqqqqk________",
        "_____kkRRrrrSSSSSSSSqqqqkk______",
        "_____kRRrrrSSSSSSSSSqqqqqk______",
        "_____kRRrrrSkwSSkwSSqqqqqk______",
        "_____kRRrrrSSSStSSSSqqqqqk______",
        "_____kRRrrrrSSSttSSSqqqqkk______",
        "_____kkRRrrrSSSSSSqqqqk_________",
        "_______krrSSPPPPPPSSqqk_________",
        "_______krrSSPuPPuPSSqqk_________",
        "_______krrSsPPPPPPsSqqk_________",
        "_______krrqqSSSSSSqqqqk_________",
        "_______krrqqSSssSSqqqqk_________",
        "______kqqqqkGGGGddDDkqqqqk______",
        "______kqqqqkGGGGddDDkqqqqk______",
        "_______kqqqkGGGdddDDkqqqk_______",
        "________kqqkGGdddDDDkqqk________",
        "____________kGGdddDk____________",
        "____________kGdddDDk____________",
        "_____________kGddDk_____________",
        "_____________kGddDk_____________",
        "______________kdDk______________",
        "______________kdDk______________",
        "__________kVVvvddvvVVk__________",
        "________kVVVvvvddvvvVVVk________",
        "________kVVvvvvkkvvvvVVk________",
        "_________kVVVk____kVVVk_________"
    ];

    // --- CYCLE DE NAGE ---
    // Les frames 2 et 3 étaient des copies de la frame 1 dont seule la pointe de la
    // nageoire changeait : 2,3 % des pixels, sur 2 rangées de 20. La sirène glissait
    // au lieu de nager. On dérive maintenant les frames de la pose neutre via une
    // courbe d'ondulation appliquée rangée par rangée.
    //
    // Le buste (rangées 0-17) reste fixe : c'est le point d'ancrage du regard.
    // Les hanches partent d'un côté (-1) et la queue de l'autre (jusqu'à +3) : cette
    // courbe en S contraire est ce qui distingue une nage d'une simple translation.
    // Amplitudes réétalées sur les 14 rangées de queue de la grille 32x32.
    const SWIM_CURVE = {
        18: -1, 19: -1, 20: 0, 21: 0, 22: 1, 23: 1, 24: 2,
        25: 2, 26: 2, 27: 2, 28: 3, 29: 3, 30: 3, 31: 3
    };

    // swayRows() vit désormais au niveau module : le bestiaire s'en sert aussi, et il
    // est déclaré avant l'art des ennemis.
    const m2 = swayRows(m1, SWIM_CURVE, 1);   // ondulation vers la droite
    const m3 = swayRows(m1, SWIM_CURVE, -1);  // ondulation vers la gauche

    generatePixelTexture(scene, 'mermaid1', m1, pElegant, PIXEL);
    generatePixelTexture(scene, 'mermaid2', m2, pElegant, PIXEL);
    generatePixelTexture(scene, 'mermaid3', m3, pElegant, PIXEL);

    // PALETTES DÉRIVÉES POUR MALIK ET ANAIS (Utilisent la même structure m1, m2, m3)
    // Mêmes trois nuances par matériau que Mimi, sur d'autres gammes.
    const pMalik = {
        ...pElegant,
        R: '#4a4038', r: '#332b26', q: '#1f1a18', // Afro brun très sombre
        S: '#b07a4e', s: '#8a5533', t: '#5a3220', // Peau chaude foncée
        P: '#6b7d94', p: '#455568', u: '#2a3543', // Haut gris-bleu
        G: '#5cc8f0', d: '#2f7fc8', D: '#1e4a8e', // Queue bleu océan
        V: '#6a8ae0', v: '#3a4f9f', E: '#9fe6ff'  // Caudale et reflet
    };

    // Princesse Nana : cuivre et or, le registre royal.
    const pNana = {
        ...pElegant,
        // Mimi étant passée au châtain cuivré, le cuivre de Nana n'en était plus qu'à
        // une nuance : deux personnages à la même silhouette et aux mêmes cheveux.
        // L'or pâle les sépare et convient mieux au registre royal.
        R: '#f0dcae', r: '#c4a468', q: '#8a6f3c', // Cheveux blond doré
        S: '#f7d0ad', s: '#d49a76', t: '#96685f', // Peau claire
        P: '#5fd6c4', p: '#2a9188', u: '#175c56', // Haut turquoise
        G: '#f0cf6b', d: '#c08f30', D: '#7a561d', // Queue dorée
        V: '#f2e6a8', v: '#a8781f', E: '#fff3c4'  // Caudale et reflet
    };

    // Anaïs : rose et turquoise. Elle partageait la palette ET la silhouette de Nana —
    // deux personnages distincts qu'on ne pouvait pas différencier.
    const pAnais = {
        ...pElegant,
        R: '#f0a0b8', r: '#c46a86', q: '#8a4058', // Cheveux rose poudré
        S: '#f7d0ad', s: '#d49a76', t: '#96685f', // Peau claire
        P: '#f0cf6b', p: '#c08f30', u: '#7a561d', // Haut doré
        G: '#5fd6c4', d: '#2a9188', D: '#175c56', // Queue turquoise
        V: '#f0a0b8', v: '#8a4058', E: '#c4fff0'  // Caudale et reflet
    };

    // MALIK — silhouette propre.
    // Il réutilisait exactement la matrice de Mimi : 0 pixel d'écart de silhouette,
    // soit deux personnages identiques simplement repeints. Comme ils nagent côte à
    // côte quand on l'invoque, et que le mode daltonien affaiblit la couleur comme
    // seul repère, la forme devait les distinguer.
    // Afro compact et barbe (d'après la référence fournie), épaules et bras larges,
    // torse nu avec pendentif de perle. Face à la masse de cheveux de Mimi qui descend
    // jusqu'aux hanches, la lecture est immédiate même en silhouette.
    // La queue reste celle de Mimi à partir de la rangée 18 : les amplitudes de
    // SWIM_CURVE y sont déjà validées, inutile de refaire le calcul de débordement.
    const mk1 = [
        "____________kkkkkk______________",
        "____________kRRRRk______________",
        "__________kkRRRRRRkk____________",
        "__________kRRRRrrrRk____________",
        "________kkRRRRrrrrRRk___________",
        "________kRRRrrrrrrqqk___________",
        "________kRRRrrrrrrqqk___________",
        "_______kqqSSSSSSSSqqk___________",
        "_______kSSkwSSSkwSttk___________",
        "_______kSSSSStSSSSttk___________",
        "________kSqqqqqqSttk____________",
        "________kkkkqqqqttkk____________",
        "____________kSSssk______________",
        "____kkkkkkkkSSSSsskkkkkk________",
        "____kSSSSSSSSSSSsssstttk________",
        "____kSSSssSSgSsSsssstkk_________",
        "_____kSSssssSgSsssttk___________",
        "_____kkSssssSSSsssttk___________",
        "___________kGGGGddDDk___________",
        "___________kGGGGddDDk___________",
        "___________kGGGdddDDk___________",
        "___________kGGdddDDDk___________",
        "____________kGGdddDk____________",
        "____________kGdddDDk____________",
        "_____________kGddDk_____________",
        "_____________kGddDk_____________",
        "______________kdDk______________",
        "______________kdDk______________",
        "__________kVVvvddvvVVk__________",
        "________kVVVvvvddvvvVVVk________",
        "________kVVvvvvkkvvvvVVk________",
        "_________kVVVk____kVVVk_________"
    ];
    const mk2 = swayRows(mk1, SWIM_CURVE, 1);
    const mk3 = swayRows(mk1, SWIM_CURVE, -1);

    generatePixelTexture(scene, 'malik', mk1, pMalik, PIXEL);
    generatePixelTexture(scene, 'malik2', mk2, pMalik, PIXEL);
    generatePixelTexture(scene, 'malik3', mk3, pMalik, PIXEL);

    // NANA — diadème. Rien n'indiquait qu'elle est princesse, alors que c'est elle qui
    // remet le Trident. La silhouette reste strictement celle de Mimi : seules deux
    // rangées de cheveux deviennent de l'or (bandeau + pierre centrale).
    const mn1 = m1.map((row, y) => {
        if (y === 1) return "____________kYRRYk______________"; // deux pointes de couronne
        if (y === 2) return "__________kkRRYYrrkkk___________"; // pierre au sommet
        if (y === 5) return "_______kRRROYYYYYYYOqqqk________"; // bandeau doré sur le front
        return row;
    });
    const mn2 = swayRows(mn1, SWIM_CURVE, 1);
    const mn3 = swayRows(mn1, SWIM_CURVE, -1);

    generatePixelTexture(scene, 'nana', mn1, pNana, PIXEL);
    generatePixelTexture(scene, 'nana2', mn2, pNana, PIXEL);
    generatePixelTexture(scene, 'nana3', mn3, pNana, PIXEL);

    // ANAÏS — chevelure aux épaules au lieu des longues mèches jusqu'aux hanches.
    // Comme pour Malik, c'est la forme qui doit la distinguer : la couleur seule ne
    // suffit pas, et le mode daltonien l'affaiblit encore.
    // Les mèches de Mimi descendent jusqu'aux hanches (rangées 16-21) ; celles d'Anaïs
    // s'arrêtent aux épaules. C'est la seule différence, mais elle change la silhouette
    // sur toute la moitié basse — de loin, on ne peut plus les confondre.
    const ma1 = m1.map((row, y) => {
        if (y === 16) return "___________kSSSSSSk_____________";
        if (y === 17) return "___________kSSssSSk_____________";
        if (y === 18) return "___________kGGGGddDDk___________";
        if (y === 19) return "___________kGGGGddDDk___________";
        if (y === 20) return "___________kGGGdddDDk___________";
        if (y === 21) return "___________kGGdddDDDk___________";
        return row;
    });
    const ma2 = swayRows(ma1, SWIM_CURVE, 1);
    const ma3 = swayRows(ma1, SWIM_CURVE, -1);

    generatePixelTexture(scene, 'anais', ma1, pAnais, PIXEL);
    generatePixelTexture(scene, 'anais2', ma2, pAnais, PIXEL);
    generatePixelTexture(scene, 'anais3', ma3, pAnais, PIXEL);

    // --------------------------------

    // LA BROSSE `eraserBrush` A ÉTÉ RETIRÉE.
    // C'était le pinceau qui effaçait la couche de pollution. Le nettoyage n'existe plus,
    // et le masque du voile est `lightMask` — un vrai dégradé continu, là où celui-ci
    // était fait de quatre cercles pleins qui auraient dessiné des anneaux à l'écran.

    // BULLE (Particules d'eau)
    const bubbleBrush = scene.make.graphics({ x: 0, y: 0, add: false });
    bubbleBrush.fillStyle(0xffffff, 0.6);
    bubbleBrush.fillCircle(4, 4, 4);
    bubbleBrush.generateTexture('bubble', 8, 8);

    // ETINCELLES (Particules de magie nettoyante)
    const sparkleBrush = scene.make.graphics({ x: 0, y: 0, add: false });
    sparkleBrush.fillStyle(0x00ffaa, 1); // Vert d'eau brillant
    sparkleBrush.fillRect(0, 2, 6, 2);
    sparkleBrush.fillRect(2, 0, 2, 6);
    sparkleBrush.generateTexture('sparkle', 6, 6);

    // Masques de lumière du voile (dégradés continus, cf. generateLightTextures).
    generateLightTextures(scene);

    // Le récif éteint : une copie décolorée de chaque décor (cf. genererRecifEteint).
    genererRecifEteint(scene);

    // Les icônes pixel, dessinées par icones.js (cœur des textes flottants, etc.).
    if (window.texturesIcones) window.texturesIcones(scene);

    // Le fond du jeu n'est plus une texture générée ici : dégradé, colonnes et neige
    // marine se construisent par biome dans src/managers/Fond.js. Le damier `ocean_bg`
    // suivait `niveau % 4` et non les biomes (le lagon du niveau 2 était cyan).
    const tileSize = 64;

    // --- ASSETS POUR LA COURSE TROPICALE (CHASE SCENE) ---

    // FOND OCÉAN TROPICAL (Turquoise lumineux avec dégradé vertical)
    const chaseBg = scene.make.graphics({ x: 0, y: 0, add: false });
    for (let cy = 0; cy < tileSize; cy += 8) {
        for (let cx = 0; cx < tileSize; cx += 8) {
            let ratio = cy / tileSize;
            let g = Math.floor(180 - ratio * 80);
            let b2 = Math.floor(220 - ratio * 60);
            let variation = (Math.random() > 0.5) ? 0x050505 : 0;
            let col = (0 << 16) | (g << 8) | b2;
            chaseBg.fillStyle(col + variation);
            chaseBg.fillRect(cx, cy, 8, 8);
        }
    }
    chaseBg.generateTexture('chase_ocean_bg', tileSize, tileSize);

    // ROCHER SUPÉRIEUR (Plafond rocheux)
    const pRock = {
        '_': null,
        '0': '#0a1628', '1': '#152844', '2': '#1d3a5c', '3': '#275070',
        '4': '#336688', 'M': '#1a4a3a', 'm': '#0d2e22'
    };
    const rockTopDesc = [
        "0111111111111111111111111111110_",
        "0222222222222222222222222222220_",
        "023333333333333333333333333320__",
        "02344444444444M444444444443320__",
        "0234444444MmmM_44444444443320___",
        "023444MmmM______444444433220____",
        "_023mM__________Mm44433220______",
        "__02M______________m3320________",
        "____0________________320________",
        "_____________________20_________"
    ];
    generatePixelTexture(scene, 'rock_top', rockTopDesc, pRock, PIXEL);

    // ROCHER INFÉRIEUR (Sol sableux rocheux)
    const rockBotDesc = [
        "_____________________20_________",
        "____0________________320________",
        "__02M______________m3320________",
        "_023mM__________Mm44433220______",
        "023444MmmM______444444433220____",
        "0234444444MmmM_44444444443320___",
        "02344444444444M444444444443320__",
        "023333333333333333333333333320__",
        "0222222222222222222222222222220_",
        "0111111111111111111111111111110_"
    ];
    generatePixelTexture(scene, 'rock_bottom', rockBotDesc, pRock, PIXEL);

    // ALGUE LONGUE (Kelp pour le bord bas)
    const pKelp = {
        '_': null,
        '0': '#004422', '1': '#006633', '2': '#009955', '3': '#00cc77', '4': '#33ff99'
    };
    const kelpDesc = [
        "___4___",
        "__43___",
        "_432___",
        "__321__",
        "___210_",
        "__3210_",
        "_4321__",
        "__432__",
        "___321_",
        "__4321_",
        "_432___",
        "__321__",
        "___21__",
        "____10_",
        "____0__"
    ];
    const kelpDescB = [
        "___4___",
        "___34__",
        "___432_",
        "__4321_",
        "_43210_",
        "__4321_",
        "___432_",
        "__4321_",
        "_43210_",
        "__4321_",
        "___432_",
        "__432__",
        "__321__",
        "__210__",
        "__10___"
    ];

    generatePixelTexture(scene, 'chase_kelp', kelpDesc, pKelp, PIXEL);
    generatePixelTexture(scene, 'chase_kelp_b', kelpDescB, pKelp, PIXEL);

    // RAYON DE SOLEIL (Texture verticale semi-transparente)
    const sunRay = scene.make.graphics({ x: 0, y: 0, add: false });
    sunRay.fillStyle(0xffffcc, 0.03);
    sunRay.fillRect(0, 0, 80, 400);
    sunRay.fillStyle(0xffffcc, 0.06);
    sunRay.fillRect(20, 0, 40, 400);
    sunRay.fillStyle(0xffffcc, 0.1);
    sunRay.fillRect(30, 0, 20, 400);
    sunRay.generateTexture('sun_ray', 80, 400);
}
