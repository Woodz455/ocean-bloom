// --- LA BAUDROIE — ce qui chasse ta lumière ---
//
// La lumière n'était qu'une RESSOURCE : on la dépense, on la recharge. Elle devient aussi
// un RISQUE. La baudroie rôde dans le noir, sa propre lanterne au bout d'une tige, et
// chasse ce qui brille : plus la réserve est pleine, plus Mimi se voit de loin, et chaque
// éclair — une Onde, une balise qui fleurit — l'attire.
//
// Dans le noir on ne voit que sa lanterne, vert-jaune, voisine de l'or des balises
// (LUEUR, Veil.js). Une lueur qui approche… balise, ou baudroie ? Les balises ne bougent
// pas. La lanterne vire au rouge quand elle chasse.
//
// Vitesses, portée, durées et nombre de coups sont des PARIS, à juger en jouant.
import { GameState } from '../managers/GameState.js';
import { LUEUR, DEPTH_BIOLUM } from '../managers/Veil.js';
import { subirDegats } from './Player.js';

const NIVEAU_MIN = 3;
const NAISSANCE_MIN = 900;      // px de Mimi
const VITESSE_ERRANCE = 60;
const VITESSE_ATTIREE = 150;
const VITESSE_RECUL = 220;
const ECLAIR_MIN = 150;         // rayon d'une zone de lumière qui compte comme éclair
const ECLAIR_PORTEE = 900;
const PERTE_MS = 2500;
const RECUL_MS = 4000;
const AVEUGLE_MS = 6000;
const PV = 3;

// La lanterne au bout de la tige, en pixels écran depuis le centre du sprite (art de
// 34×24 à 3 px, lanterne en (27,4), tournée vers la droite).
const LANTERNE_DX = 31, LANTERNE_DY = -22;

// La DÉTECTION est calée sur la RÉSERVE, pas sur le halo : le halo ne bouge plus
// au-dessus de 45 % (LIGHT_RADIUS_SEUIL), et briller doit toujours se payer. Ça crée
// une inversion voulue : lancer un pouvoir baisse la réserve, donc rend Mimi MOINS
// visible ensuite — mais l'éclair du pouvoir, lui, l'attire.
export const porteeDetection = () => 180 + 4.2 * GameState.light;

export function creerBaudroie(scene) {
    const lvl = window.currentLevel || 1;
    if (lvl < NIVEAU_MIN || !scene.player) return null;

    const pos = lieuDeNaissance(scene);
    const b = scene.physics.add.sprite(pos.x, pos.y, 'baudroie');
    b.setDepth(16);
    b.setCollideWorldBounds(true);
    b.body.setSize(66, 48);
    b.etat = 'errance';
    b.pv = PV;
    b.vitesseTraque = 250 + (lvl - NIVEAU_MIN) * 7;   // 250 au niveau 3, ~300 au 10
    b.foyer = { x: pos.x, y: pos.y };
    b.cible = null;
    b.vues = new WeakSet();          // éclairs déjà pris en compte
    b.jusqua = 0;
    b.horsPorteeDepuis = 0;

    b.lanterne = scene.add.image(pos.x, pos.y, 'glintGlow');
    b.lanterne.setDepth(DEPTH_BIOLUM);
    b.lanterne.setBlendMode(Phaser.BlendModes.ADD);
    b.lanterne.setScale(0.24);
    b.lanterne.setTint(LUEUR.baudroie);

    scene.anims.exists('baudroie_gueule') || scene.anims.create({
        key: 'baudroie_gueule', frames: [{ key: 'baudroie' }, { key: 'baudroie2' }],
        frameRate: 5, repeat: -1
    });

    scene.physics.add.overlap(scene.player, b, () => morsure(scene, b));
    scene.baudroie = b;
    return b;
}

// Loin de Mimi, et hors des clairières des balises gardées : une baudroie qui naît dans
// un anneau d'oursins serait un piège gratuit.
function lieuDeNaissance(scene) {
    const { width: W, height: H } = scene.physics.world.bounds;
    const pl = scene.player;
    const libre = (x, y) => Phaser.Math.Distance.Between(x, y, pl.x, pl.y) > NAISSANCE_MIN
        && !(scene.gardiens || []).some(g =>
            Phaser.Math.Distance.Between(x, y, g.balise.beaconX, g.balise.beaconY) < g.rayon + 160);
    for (let i = 0; i < 40; i++) {
        const x = 200 + Math.random() * (W - 400), y = 200 + Math.random() * (H - 400);
        if (libre(x, y)) return { x, y };
    }
    // Repli : le coin le plus éloigné de Mimi.
    return { x: pl.x < W / 2 ? W - 200 : 200, y: pl.y < H / 2 ? H - 200 : 200 };
}

// --- À CHAQUE IMAGE ---
export function updateBaudroie(scene, time) {
    const b = scene.baudroie;
    if (!b || !b.active) return;

    // Le boss a sa propre tension : la baudroie se retire quand il arrive.
    if (scene.bossActive || GameState.isBossActive) { retirer(scene, b); return; }

    const pl = scene.player;
    const d = Phaser.Math.Distance.Between(b.x, b.y, pl.x, pl.y);
    const portee = porteeDetection();

    // LES ÉCLAIRS. Toute lumière vive passe par scene.litZones (Onde, Rayon, balise qui
    // fleurit) : la baudroie les lit directement, sans que Veil.js ait à la connaître.
    for (const z of scene.litZones || []) {
        if (b.vues.has(z) || z.radius < ECLAIR_MIN) continue;
        b.vues.add(z);
        if ((b.etat === 'errance' || b.etat === 'attiree')
            && Phaser.Math.Distance.Between(z.x, z.y, b.x, b.y) < ECLAIR_PORTEE) {
            b.etat = 'attiree';
            b.cible = { x: z.x, y: z.y };
        }
    }

    // Fin des états temporisés.
    if ((b.etat === 'recul' || b.etat === 'aveuglee') && time > b.jusqua) {
        b.etat = 'errance'; b.cible = null;
    }

    // Repérée : Mimi est dans sa portée.
    if ((b.etat === 'errance' || b.etat === 'attiree') && d < portee) commencerTraque(scene, b);

    if (b.etat === 'traque') {
        if (d > portee + 150) {
            if (!b.horsPorteeDepuis) b.horsPorteeDepuis = time;
            if (time - b.horsPorteeDepuis > PERTE_MS) { b.etat = 'errance'; b.cible = null; }
        } else b.horsPorteeDepuis = 0;
    }

    // Mouvement.
    let vx = 0, vy = 0;
    const vers = (x, y, v) => {
        const a = Phaser.Math.Angle.Between(b.x, b.y, x, y);
        vx = Math.cos(a) * v; vy = Math.sin(a) * v;
    };
    if (b.etat === 'traque') vers(pl.x, pl.y, b.vitesseTraque);
    else if (b.etat === 'recul') { vers(pl.x, pl.y, VITESSE_RECUL); vx = -vx; vy = -vy; }
    else if (b.etat === 'attiree') {
        vers(b.cible.x, b.cible.y, VITESSE_ATTIREE);
        if (Phaser.Math.Distance.Between(b.x, b.y, b.cible.x, b.cible.y) < 80) { b.etat = 'errance'; b.cible = null; }
    } else {
        // Errance, et aveuglée : dérive lente autour d'un foyer.
        if (!b.cible || Phaser.Math.Distance.Between(b.x, b.y, b.cible.x, b.cible.y) < 40) {
            b.cible = { x: b.foyer.x + (Math.random() - 0.5) * 900, y: b.foyer.y + (Math.random() - 0.5) * 900 };
        }
        vers(b.cible.x, b.cible.y, b.etat === 'aveuglee' ? 30 : VITESSE_ERRANCE);
    }
    b.setVelocity(vx, vy);
    if (Math.abs(vx) > 5) b.setFlipX(vx < 0);

    // Gueule : elle s'ouvre en chasse, se ferme sinon.
    if (b.etat === 'traque') { if (!b.anims.isPlaying) b.anims.play('baudroie_gueule'); }
    else if (b.anims.isPlaying) { b.anims.stop(); b.setTexture('baudroie'); }

    // La lanterne suit le bout de la tige, et dit l'état de la bête par sa couleur.
    const sens = b.flipX ? -1 : 1;
    b.lanterne.setPosition(b.x + LANTERNE_DX * sens, b.y + LANTERNE_DY);
    b.lanterne.setTint(b.etat === 'traque' ? LUEUR.danger : LUEUR.baudroie);
    b.lanterne.setAlpha(b.etat === 'aveuglee' ? 0.25 : 0.55 + Math.sin(time / 260) * 0.2);

    // La lanterne éclaire un peu le monde, comme une vraie : on voit la gueule approcher
    // dans sa propre lueur. Publiée sur la scène, que Veil.collectSources lit — comme
    // Malik et Anaïs, sans que Veil.js ait à connaître ce module.
    scene.lumiereBaudroie = b.etat === 'aveuglee' ? null : { x: b.lanterne.x, y: b.lanterne.y, radius: 46 };
}

function commencerTraque(scene, b) {
    b.etat = 'traque';
    b.horsPorteeDepuis = 0;
    if (window.playGrondement) window.playGrondement();
    // Une ligne de récit, la toute première fois seulement.
    try {
        if (localStorage.getItem('oceanBloomBaudroie') !== 'vue') {
            localStorage.setItem('oceanBloomBaudroie', 'vue');
            const pl = scene.player;
            const t = scene.add.text(pl.x, pl.y - 120, window.getStr('predateurRecit') || '', {
                fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#d8ff8a',
                stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(41);
            scene.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 2800, duration: 1400, onComplete: () => t.destroy() });
        }
    } catch (e) { /* stockage indisponible */ }
}

function morsure(scene, b) {
    if (!b.active || b.etat === 'recul') return;
    // Par subirDegats, comme toute source : le Bouclier l'encaisse sans une ligne de plus.
    subirDegats(scene, {
        source: b, degats: 1,
        ralenti: 0.4, sourdine: 1500, grace: 1000,
        secousse: [300, 0.03]
    });
    // Elle recule APRÈS chaque contact, morsure ou parade : sinon elle resterait collée et
    // mordrait à la fin de chaque grâce — la spirale déjà corrigée pour les ennemis.
    reculer(scene, b);
}

function reculer(scene, b) {
    b.etat = 'recul';
    b.jusqua = scene.time.now + RECUL_MS;
}

// --- CE QUE LES POUVOIRS LUI FONT ---

// L'Onde : un coup, et elle recule.
export function ondeSurBaudroie(scene, x, y, portee) {
    const b = scene.baudroie;
    if (!b || !b.active || Phaser.Math.Distance.Between(b.x, b.y, x, y) > portee) return false;
    if (!frapper(scene, b)) reculer(scene, b);
    return true;
}

// Le Rayon : un coup, et elle est aveuglée — elle perd la trace.
export function rayonSurBaudroie(scene, dansLeTrait) {
    const b = scene.baudroie;
    if (!b || !b.active || !dansLeTrait(b, b.displayWidth / 2, b.displayHeight / 2)) return false;
    if (!frapper(scene, b)) { b.etat = 'aveuglee'; b.jusqua = scene.time.now + AVEUGLE_MS; }
    return true;
}

// Le Bouclier II : la bulle la repousse, sans la blesser.
export function bulleSurBaudroie(scene, x, y, portee) {
    const b = scene.baudroie;
    if (b && b.active && Phaser.Math.Distance.Between(b.x, b.y, x, y) < portee) reculer(scene, b);
}

// Renvoie true si le coup l'a dissipée.
function frapper(scene, b) {
    b.pv--;
    b.setTintFill(0xffffff);
    scene.time.delayedCall(140, () => { if (b.active) b.clearTint(); });
    if (b.pv > 0) return false;
    dissiper(scene, b);
    return true;
}

// Trois coups : elle se dissout en lumière. Une chasse optionnelle, et payante — de quoi
// financer les paliers. Les perles sont créditées directement : passer par addPearl
// ajouterait aussi 9 de lumière par perle, soit 72 en plus des 25 prévus.
function dissiper(scene, b) {
    const x = b.x, y = b.y;
    const part = scene.add.particles('sparkle');
    part.setDepth(30);
    part.createEmitter({
        x, y, speed: { min: 60, max: 260 }, scale: { start: 1.8, end: 0 },
        alpha: { start: 1, end: 0 }, tint: [LUEUR.baudroie, 0xffffff], lifespan: 900, on: false
    }).explode(60);
    scene.time.delayedCall(1200, () => part.destroy());

    GameState.pearls += 8;
    GameState.addLight(25);
    const t = scene.add.text(x, y - 50, '+8', {
        fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#fff0c0', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(41);
    scene.tweens.add({ targets: t, y: y - 100, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
    if (window.playPowerupSound) window.playPowerupSound();

    scene.lumiereBaudroie = null;
    b.lanterne.destroy();
    b.destroy();
}

function retirer(scene, b) {
    if (b.seRetire) return;
    b.seRetire = true;
    scene.lumiereBaudroie = null;
    b.body.enable = false;
    scene.tweens.add({ targets: [b, b.lanterne], alpha: 0, duration: 1200,
        onComplete: () => { b.lanterne.destroy(); b.destroy(); } });
}
