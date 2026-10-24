// --- LES BALISES GARDÉES ---
//
// Le niveau est une ARÈNE OUVERTE : un mur au milieu de nulle part se contourne. Un
// obstacle ne crée une situation que s'il GARDE quelque chose. Certaines balises sont
// donc entourées d'un gardien, et chaque gardien appelle UN pouvoir :
//
//   oursins  anneau solide, ne blesse pas     -> l'Onde les brise
//   méduses  essaim piquant, ne bloque pas    -> le Bouclier encaisse leurs piqûres
//   sceau    coque de corail serré, solide    -> le Rayon y brûle une brèche
//
// Oursins et sceau BLOQUENT sans blesser : on apprend « ça ferme » en le touchant, sans
// payer un cœur pour avoir exploré. Les méduses ne bloquent pas, elles COÛTENT : foncer
// coûte un cœur, ou 9 de lumière avec le Bouclier. Un choix, pas une porte.
//
// Les trois rayons, le nombre de méduses et le délai de la perle-fontaine sont des
// PARIS, comme l'étaient les coûts en lumière : à juger en jouant.
import { addGlint, LUEUR } from './Veil.js';

const RAYON_OURSINS = 120;
const RAYON_SCEAU = 95;
const MEDUSES = 6;
const FONTAINE_MS = 20000;

// Quels gardiens à quel niveau. Le niveau 1 n'en a aucun : on y apprend le verbe. Les
// courses (4 et 8) ne passent pas par ici. Le sceau demande le Rayon, donc le Trident
// que Nana donne au niveau 6 ; sans lui, il est remplacé par des oursins.
export function gardiensDuNiveau(lvl, aTrident) {
    if (lvl <= 1) return [];
    if (lvl <= 3) return ['oursins'];
    if (lvl <= 6) return ['oursins', 'meduses'];
    const sceau = aTrident ? 'sceau' : 'oursins';
    if (lvl <= 9) return ['meduses', sceau];
    return ['oursins', 'meduses', sceau];
}

export function preparerGardiens(scene) {
    scene.gardes = scene.physics.add.staticGroup();   // oursins et sceau : ils bloquent
    scene.meduses = scene.physics.add.group();        // méduses : elles piquent
    scene.gardiens = [];
}

export function poserGardien(scene, balise, type) {
    const garde = {
        type, balise, pieces: [],
        // Les méduses ne ferment rien : la balise reste allumable à travers elles.
        ouverte: type === 'meduses',
        rayon: type === 'sceau' ? RAYON_SCEAU : RAYON_OURSINS,
        prochaineFontaine: 0
    };
    balise.garde = garde;
    scene.gardiens.push(garde);
    clairiere(scene, balise, garde.rayon + 70);

    if (type === 'oursins') anneau(scene, garde, () => 'urchin', null, LUEUR.oursins);
    else if (type === 'sceau') anneau(scene, garde, () => 'sceau', null, LUEUR.sceau);
    else essaim(scene, garde);
}

// UNE CLAIRIÈRE AUTOUR DE CHAQUE BALISE GARDÉE.
//
// Le décor et les dangers sont semés au hasard AVANT les balises. Une trace l'a montré :
// une bouche volcanique et un corail tombaient en plein dans la brèche que le Rayon
// venait d'ouvrir, et Mimi restait coincée au moment précis où le joueur exécutait la
// solution. Rien n'empêchait non plus une mine de naître DANS un anneau d'oursins, qu'on
// aurait ouvert pour sauter dessus. Un gardien doit se lire seul, et sa solution ne doit
// jamais être déjouée par le hasard. Les ennemis restent : ils sont le combat, pas le décor.
function clairiere(scene, balise, rayon) {
    const proche = o => o.active
        && Phaser.Math.Distance.Between(o.x, o.y, balise.beaconX, balise.beaconY) < rayon;
    for (const groupe of [scene.obstacles, scene.hazards, scene.trashes]) {
        if (!groupe) continue;
        groupe.getChildren().filter(proche).forEach(o => o.destroy());
    }
}

// Un anneau de pièces solides, assez serrées pour qu'aucun interstice ne laisse passer
// Mimi. Chaque autre pièce porte une lueur AU-DESSUS du voile : comme les yeux des
// ennemis, le gardien doit se lire de loin dans le noir, sinon il punit au lieu de
// mettre en tension.
function anneau(scene, garde, cle, teinte, lueur) {
    const { beaconX: bx, beaconY: by } = garde.balise;
    const largeur = scene.textures.get(cle(0)).getSourceImage().width;
    const n = Math.ceil((2 * Math.PI * garde.rayon) / (largeur * 0.8));
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const piece = scene.gardes.create(bx + Math.cos(a) * garde.rayon, by + Math.sin(a) * garde.rayon, cle(i));
        piece.setDepth(13);
        if (teinte) piece.setTint(teinte);
        piece.garde = garde;
        if (i % 2 === 0) addGlint(scene, piece, lueur, 0.12, { min: 0.2, max: 0.5 });
        garde.pieces.push(piece);
    }
}

function essaim(scene, garde) {
    const { beaconX: bx, beaconY: by } = garde.balise;
    const sens = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < MEDUSES; i++) {
        const j = scene.meduses.create(bx, by, 'jelly');
        j.setDepth(16);
        j.anims.play(window.ensureAnim(scene, 'jelly_pulse', ['jelly', 'jelly2'], 3), true);
        j.anims.setProgress(Math.random());
        j.garde = garde;
        j.orbite = {
            a: (i / MEDUSES) * Math.PI * 2,
            r: 90 + Math.random() * 50,
            v: sens * (0.35 + Math.random() * 0.3),     // rad/s
            phase: Math.random() * Math.PI * 2,
            ecart: 0                                     // repoussée par le Bouclier II
        };
        addGlint(scene, j, LUEUR.meduses, 0.16, { follow: true, min: 0.25, max: 0.6 });
        garde.pieces.push(j);
    }
}

// --- CE QUE LES POUVOIRS FONT AUX GARDIENS ---

// L'Onde brise les oursins à sa portée. Une brèche suffit à ouvrir l'anneau.
export function briserOursins(scene, x, y, portee) {
    return detruirePieces(scene, 'oursins', p => Phaser.Math.Distance.Between(p.x, p.y, x, y) < portee, 0xe6c6ff);
}

// Le Rayon brûle les pièces de sceau sur son tracé. Il tire en ligne droite : il ouvre
// une brèche, pas tout l'anneau — d'où l'ouverture À LA PREMIÈRE BRÈCHE, sans quoi il
// faudrait trois ou quatre tirs pour un seul sceau.
export function brulerSceau(scene, dansLeTrait) {
    return detruirePieces(scene, 'sceau', p => dansLeTrait(p, p.width / 2, p.height / 2), 0xff7a4d);
}

// Le Bouclier II écarte les méduses de son orbite quelques secondes, le temps de passer.
export function ecarterMeduses(scene, x, y, portee) {
    if (!scene.meduses) return;
    scene.meduses.getChildren().forEach(j => {
        if (!j.active || Phaser.Math.Distance.Between(j.x, j.y, x, y) > portee) return;
        scene.tweens.killTweensOf(j.orbite);
        scene.tweens.add({ targets: j.orbite, ecart: 150, duration: 350, ease: 'Cubic.easeOut',
            hold: 2600, yoyo: true });
    });
}

function detruirePieces(scene, type, touchee, teinte) {
    if (!scene.gardiens) return 0;
    let n = 0;
    let particules = null, emetteur = null;
    for (const garde of scene.gardiens) {
        if (garde.type !== type) continue;
        for (const p of garde.pieces) {
            if (!p.active || !touchee(p)) continue;
            if (!particules) {
                particules = scene.add.particles('sparkle');
                particules.setDepth(25);
                emetteur = particules.createEmitter({
                    speed: { min: 80, max: 220 }, scale: { start: 1.4, end: 0 },
                    alpha: { start: 1, end: 0 }, tint: teinte, lifespan: 600, on: false
                });
            }
            emetteur.explode(10, p.x, p.y);
            p.destroy();
            n++;
            if (!garde.ouverte) ouvrir(garde);
        }
    }
    if (particules) {
        if (window.playEnemyDefeatSound) window.playEnemyDefeatSound();
        scene.time.delayedCall(900, () => particules.destroy());
    }
    return n;
}

function ouvrir(garde) {
    garde.ouverte = true;
    // Un type de gardien ouvert une fois n'a plus besoin de son indice : le joueur sait.
    try {
        const vus = JSON.parse(localStorage.getItem('oceanBloomGardes') || '[]');
        if (!vus.includes(garde.type)) {
            vus.push(garde.type);
            localStorage.setItem('oceanBloomGardes', JSON.stringify(vus));
        }
    } catch (e) { /* stockage indisponible : l'indice reviendra, rien de grave */ }
}

function dejaCompris(type) {
    try { return JSON.parse(localStorage.getItem('oceanBloomGardes') || '[]').includes(type); }
    catch (e) { return false; }
}

// --- À CHAQUE IMAGE ---
export function updateGardiens(scene, time, delta) {
    if (!scene.gardiens || !scene.player) return;
    const pl = scene.player;

    for (const garde of scene.gardiens) {
        const b = garde.balise;

        if (garde.type === 'meduses') {
            // Une balise allumée apaise son essaim : il se disperse au lieu de piquer
            // indéfiniment le joueur qui revient se reposer dans la lumière.
            if (b.isLit && !garde.dispersee) { disperser(scene, garde); continue; }
            if (garde.dispersee) continue;
            for (const j of garde.pieces) {
                if (!j.active) continue;
                const o = j.orbite;
                o.a += o.v * (delta / 1000);
                const r = o.r + o.ecart;
                j.setPosition(b.beaconX + Math.cos(o.a) * r,
                    b.beaconY + Math.sin(o.a) * r + Math.sin(time / 600 + o.phase) * 6);
            }
        } else if (!garde.ouverte && !b.isLit && time > garde.prochaineFontaine) {
            perleFontaine(scene, garde);
            garde.prochaineFontaine = time + FONTAINE_MS;
        }

        // Première rencontre : la touche du pouvoir qui répond. Un jeu Steam doit
        // apprendre sans manuel. Une fois par niveau, et plus du tout quand ce type de
        // gardien a déjà été ouvert au moins une fois.
        if (!garde.indice && !b.isLit && (garde.type === 'meduses' || !garde.ouverte)
            && Phaser.Math.Distance.Between(pl.x, pl.y, b.beaconX, b.beaconY) < garde.rayon + 170) {
            garde.indice = true;
            scene.indicesVus = scene.indicesVus || {};
            if (!scene.indicesVus[garde.type] && !dejaCompris(garde.type)) {
                scene.indicesVus[garde.type] = true;
                montrerIndice(scene, garde);
            }
        }
    }
}

// AUCUN BLOCAGE POSSIBLE. Dernière balise sous sceau, réserve à zéro, plus une perle :
// la partie serait figée. Une perle renaît donc près de chaque balise encore fermée,
// HORS de l'anneau, s'il n'y en a plus aucune d'atteignable. Le pouvoir finit toujours
// par être payable, sans que le gardien devienne gratuit.
function perleFontaine(scene, garde) {
    const b = garde.balise;
    const atteignable = scene.pearls.getChildren().some(p => {
        if (!p.active) return false;
        const d = Phaser.Math.Distance.Between(p.x, p.y, b.beaconX, b.beaconY);
        return d > garde.rayon + 20 && d < 340;
    });
    if (atteignable) return;
    const a = Math.random() * Math.PI * 2, d = garde.rayon + 90 + Math.random() * 50;
    const bounds = scene.physics.world.bounds;
    const x = Phaser.Math.Clamp(b.beaconX + Math.cos(a) * d, 40, bounds.width - 40);
    const y = Phaser.Math.Clamp(b.beaconY + Math.sin(a) * d, 40, bounds.height - 40);
    const perle = scene.pearls.create(x, y, 'pearl');
    perle.setDepth(15);
    perle.fontaine = true;
    perle.anims.play(window.ensureAnim(scene, 'pearl_glint', ['pearl', 'pearl2', 'pearl3', 'pearl2'], 4), true);
    addGlint(scene, perle, LUEUR.perle, 0.28);
}

function disperser(scene, garde) {
    garde.dispersee = true;
    for (const j of garde.pieces) {
        if (!j.active) continue;
        j.body.enable = false;
        scene.tweens.add({ targets: j, alpha: 0, y: j.y - 70, duration: 1600, ease: 'Sine.easeIn',
            onComplete: () => j.destroy() });
    }
}

function montrerIndice(scene, garde) {
    const cle = { oursins: 'hintOursins', meduses: 'hintMeduses', sceau: 'hintSceau' }[garde.type];
    const b = garde.balise;
    const t = scene.add.text(b.beaconX, b.beaconY - garde.rayon - 50, window.getStr(cle) || '', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#ffe08a',
        stroke: '#000', strokeThickness: 3, align: 'center'
    }).setOrigin(0.5).setDepth(41);
    scene.tweens.add({ targets: t, alpha: 0, delay: 4200, duration: 900, onComplete: () => t.destroy() });
}
