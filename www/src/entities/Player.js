import { GameState } from '../managers/GameState.js';
import { bloomBeacon, flareLight, fragmentRecit, DEPTH_BIOLUM } from '../managers/Veil.js';
import { summonAnais } from './Allies.js';
// Import circulaire assumé (Enemies.js importe déjà d'ici) : damageBoss n'est appelé
// qu'à l'exécution, jamais à l'évaluation du module.
import { damageBoss } from './Enemies.js';

// Cycle sinusoïdal complet : neutre → droite → neutre → gauche.
// L'ancien ordre (1,2,3,2) passait de droite à gauche sans repasser par le neutre,
// ce qui saccadait l'ondulation.
// Exporté car ChaseScene en a besoin aussi : aux niveaux 4 et 8, MainScene.create()
// bifurque avant configurePlayer(), donc l'animation n'y était jamais créée.
export function ensureSwimAnim(scene) {
    if (scene.anims.exists('swim')) return;
    scene.anims.create({
        key: 'swim',
        frames: [{ key: 'mermaid1' }, { key: 'mermaid2' }, { key: 'mermaid1' }, { key: 'mermaid3' }],
        frameRate: 8,
        repeat: -1
    });
}

// --- GESTIONNAIRE DU JOUEUR ---
export function configurePlayer(scene, levelW, levelH) {
    ensureSwimAnim(scene);

    scene.player = scene.physics.add.sprite(levelW / 2, levelH / 2, 'mermaid1');
    scene.player.setScale(window.charScale);
    scene.player.setDepth(20);
    scene.player.setCollideWorldBounds(true);
    scene.player.setDrag(200);
    scene.player.baseSpeed = 350 + ((window.speedLevel - 1) * 40);
    scene.player.currentSpeed = scene.player.baseSpeed;
    scene.player.setMaxVelocity(800);
    scene.player.isStunned = false;
    scene.player.boucliers = 0;

    // RIBBON TRAIL
    scene.player.history = [];
    scene.playerTrail = scene.add.graphics();
    scene.playerTrail.setDepth(18);
    scene.playerTrail.setBlendMode(Phaser.BlendModes.ADD);

    // BUBBLES
    const bubbleParticles = scene.add.particles('bubble');
    bubbleParticles.setDepth(19);
    scene.player.bubbleEmitter = bubbleParticles.createEmitter({
        speedX: { min: -15, max: 15 },
        speedY: { min: -50, max: -20 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 1500, frequency: 80, on: false,
        follow: scene.player, followOffset: { x: 0, y: 15 }
    });

    // SPARKLES
    const sparkleParticles = scene.add.particles('sparkle');
    sparkleParticles.setDepth(21);
    scene.player.sparkleEmitter = sparkleParticles.createEmitter({
        speed: { min: 40, max: 80 }, angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
        lifespan: 600, frequency: 30, on: false,
        follow: scene.player, blendMode: 'ADD'
    });

    // LA LUMIÈRE DE MIMI
    // Ce n'était qu'un ornement ; c'est désormais la source qui perce le voile. Le halo
    // chaud est dessiné SOUS le voile en fusion additive — lumière chaude contre eau
    // froide — et son rayon est piloté par la réserve, plus le tween d'échelle fixe qui
    // l'empêcherait de refléter l'état du joueur.
    scene.player.lightGlow = scene.add.image(scene.player.x, scene.player.y, 'warmGlow');
    scene.player.lightGlow.setDepth(8);
    scene.player.lightGlow.setBlendMode(Phaser.BlendModes.ADD);
    scene.player.lightGlow.setAlpha(0.9);

    // COMPASS
    let compassGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    compassGfx.lineStyle(2, 0x00ffaa, 1);
    compassGfx.fillStyle(0x00ccff, 1);
    compassGfx.moveTo(-15, -15);
    compassGfx.lineTo(25, 0);
    compassGfx.lineTo(-15, 15);
    compassGfx.lineTo(-5, 0);
    compassGfx.closePath();
    compassGfx.fillPath();
    compassGfx.strokePath();
    compassGfx.generateTexture('compassArrow', 50, 50);

    scene.compassSprite = scene.add.sprite(scene.player.x, scene.player.y, 'compassArrow');
    scene.compassSprite.setDepth(50);
    scene.compassSprite.setVisible(false);
    scene.compassSprite.setAlpha(0.8);

    scene.cameras.main.startFollow(scene.player, true, 0.08, 0.08);
    applyViewportZoom(scene);
}

// --- ENCAISSER UN COUP ---
//
// Mesuré sur treize parties jouées à l'aveugle : la médiane était de quatre à cinq
// cœurs perdus sur cinq, et la moitié des parties finissaient en défaite, alors que la
// réserve de lumière, elle, ne descendait qu'à 31 %. Le point de rupture du jeu n'était
// pas l'obscurité mais le dégât au contact.
//
// La cause n'était pas la difficulté, c'était une SPIRALE. À l'impact, Mimi était
// ralentie à 20-50 % de sa vitesse pendant une à deux secondes, sans être repoussée —
// donc immobilisée CONTRE la chose qui venait de la toucher. À la fin du ralentissement
// le chevauchement était toujours là, le coup repartait aussitôt, et les cinq cœurs
// tombaient en quelques secondes sans que le joueur puisse rien y faire.
//
// D'où deux ajouts, et un seul mécanisme partagé au lieu de quatre copies presque
// identiques (déchets, ennemis, mines, boss) :
//   · un RECUL, qui met fin au chevauchement au lieu de compter sur le joueur ralenti ;
//   · une GRÂCE après le ralentissement, pendant laquelle Mimi clignote et ne peut pas
//     être touchée — le temps de s'écarter pour de bon.
// L'immunité totale vaut donc `sourdine + grace`, soit 2,4 s après un ennemi.
const RECUL = 380;          // px/s, amorti par le frottement déjà en place
const RECUL_MS = 220;       // durée pendant laquelle le recul l'emporte sur le joystick
const GRACE_DEFAUT = 900;   // ms d'invincibilité clignotante après le ralentissement

export function peutEtreTouche(scene) {
    const p = scene.player;
    if (!p || p.isStunned) return false;
    return scene.time.now >= (p.invincibleJusqua || 0);
}

// Renvoie true si le coup était fatal, comme GameState.damage, pour que l'appelant
// s'arrête là.
export function subirDegats(scene, o) {
    const p = scene.player;

    // LE BOUCLIER ABSORBE ICI, ET NULLE PART AILLEURS.
    //
    // Il n'était testé que dans playerTakeDamage, le chemin des projectiles du boss. Or
    // déchet, ennemi et mine appellent subirDegats directement (MainScene) : le bouclier
    // laissait donc passer TOUT ce qu'on croise en nageant, soit une vingtaine de
    // croisements par niveau, et ne servait que contre un boss. On le payait en lumière
    // pour rien.
    //
    // Il passe AVANT le test d'invincibilité : c'est une parade, pas un encaissement, et
    // il doit tenir même pendant la grâce clignotante. Un coup sans dégât (le déchet,
    // qui gêne sans blesser) ne consomme pas de charge.
    if (p.boucliers > 0 && o.degats) {
        consommerBouclier(scene, o);
        return false;
    }

    if (!peutEtreTouche(scene)) return false;

    const sourdine = o.sourdine || 1200;
    const grace = o.grace === undefined ? GRACE_DEFAUT : o.grace;

    p.isStunned = true;
    p.invincibleJusqua = scene.time.now + sourdine + grace;
    p.setTint(0xff0000);
    p.currentSpeed = p.baseSpeed * (o.ralenti || 0.5);

    // LE RECUL. Sans lui, tout le reste ne sert à rien : le chevauchement persiste et le
    // coup suivant part dès la fin de l'invincibilité.
    if (o.source) {
        const a = Phaser.Math.Angle.Between(o.source.x, o.source.y, p.x, p.y);
        p.setVelocity(Math.cos(a) * RECUL, Math.sin(a) * RECUL);
        // …et il doit TENIR. updatePlayerMovement réécrit la vitesse depuis le joystick
        // à chaque frame : sans ce laissez-passer, l'impulsion serait effacée à l'image
        // suivante et le recul n'existerait que sur le papier.
        p.reculJusqua = scene.time.now + RECUL_MS;
    }

    if (o.secousse) scene.cameras.main.shake(o.secousse[0], o.secousse[1]);
    if (window.playHurtSound) window.playHurtSound();

    // `damagePlayer` appartient à MainScene (elle affiche aussi le « -N❤️ » flottant).
    // Le repli sur GameState garde la fonction utilisable depuis n'importe quelle scène.
    const fatal = !o.degats ? false
        : (typeof scene.damagePlayer === 'function' ? scene.damagePlayer(o.degats)
            : GameState.damage(o.degats));
    if (fatal) return true;

    scene.time.delayedCall(sourdine, () => {
        if (!scene.scene.isActive() || GameState.isDefeated) return;
        p.clearTint();
        p.isStunned = false;
        p.currentSpeed = p.baseSpeed;
        if (window.playRecoverSound) window.playRecoverSound();

        // Le clignotement rend la grâce LISIBLE : sans lui, le joueur ne sait pas qu'il
        // est encore protégé et n'ose pas repartir.
        if (grace > 0) {
            p.clignote = scene.tweens.add({
                targets: p, alpha: 0.35,
                duration: 110, yoyo: true, repeat: Math.floor(grace / 220),
                onComplete: () => { p.alpha = 1; p.clignote = null; }
            });
        }
    });
    return false;
}

// --- LE BOUCLIER : CHARGES, ABSORPTION, RENVOI ---

// Le trait s'épaissit avec les charges restantes : au palier III, on doit LIRE qu'il en
// reste une après le premier coup, sans compteur ni texte.
function dessinerBouclier(scene) {
    const n = scene.player.boucliers;
    if (scene.pearlShieldGfx) { scene.pearlShieldGfx.destroy(); scene.pearlShieldGfx = null; }
    if (n <= 0) return;
    const g = scene.add.graphics();
    g.lineStyle(n >= 2 ? 8 : 5, 0x00ffff, 0.9);
    g.fillStyle(0x00ccff, n >= 2 ? 0.2 : 0.12);
    g.fillCircle(0, 0, 70);
    g.strokeCircle(0, 0, 70);
    if (n >= 2) { g.lineStyle(2, 0xffffff, 0.7); g.strokeCircle(0, 0, 80); }
    g.setDepth(19);
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setPosition(scene.player.x, scene.player.y);
    scene.pearlShieldGfx = g;
}

// Les ennemis patrouillent par TWEENS sur x/y, pas par vitesse : une poussée physique
// serait écrasée dès la frame suivante. Le renvoi coupe donc la patrouille, déplace
// l'ennemi par un tween à son tour, puis relance une patrouille là où il atterrit.
function repousserEnnemi(scene, ennemi, depuis) {
    if (!ennemi || !ennemi.active || !scene.enemies || !scene.enemies.includes(ennemi)) return;
    const a = Phaser.Math.Angle.Between(depuis.x, depuis.y, ennemi.x, ennemi.y);
    scene.tweens.killTweensOf(ennemi);
    scene.tweens.add({
        targets: ennemi,
        x: ennemi.x + Math.cos(a) * 190,
        y: ennemi.y + Math.sin(a) * 190,
        duration: 320, ease: 'Cubic.easeOut',
        onComplete: () => {
            if (!ennemi.active) return;
            scene.tweens.add({
                targets: ennemi,
                x: ennemi.x + (Math.random() > 0.5 ? 50 : -50),
                y: ennemi.y + (Math.random() > 0.5 ? 50 : -50),
                duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        }
    });
}

function consommerBouclier(scene, o) {
    const p = scene.player;
    p.boucliers--;
    dessinerBouclier(scene);

    // Une courte grâce après la parade, sinon le même ennemi, toujours au contact,
    // frappe à nouveau dans la frame suivante et le bouclier n'a rien acheté.
    p.invincibleJusqua = Math.max(p.invincibleJusqua || 0, scene.time.now + 700);

    if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();
    if (window.Haptics) window.Haptics.impact({ style: 'LIGHT' }).catch(() => { });

    const particules = scene.add.particles('sparkle');
    particules.createEmitter({
        x: p.x, y: p.y, speed: 200, scale: { start: 2, end: 0 }, tint: 0x00ffff, lifespan: 500
    }).explode(30);
    scene.time.delayedCall(1000, () => particules.destroy());

    // PALIER II : la bulle ÉCLATE et repousse tout ce qu'elle touche. On ne se contente
    // plus d'encaisser, on dégage le passage — le bouclier devient un outil pour
    // traverser un banc d'ennemis.
    //
    // Pas seulement l'agresseur : mesuré sur cinq essais, dès que deux ennemis touchaient
    // Mimi dans la même image, l'un était renvoyé à 170 px et l'autre restait collé à
    // 8 px, pour frapper à la fin de la courte grâce. Or les ennemis se regroupent. La
    // portée dépasse un peu la bulle dessinée (70 px) : une parade doit se sentir large.
    if (GameState.shieldLevel >= 2) {
        scene.enemies.slice().forEach(e => {
            if (e.active && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < 110) repousserEnnemi(scene, e, p);
        });
    }

    // Contre le boss, la parade lui renvoie un tir — ce que faisait l'ancien chemin des
    // projectiles, conservé tel quel.
    if (scene.bossActive && scene.boss && scene.boss.active && scene.mimiProjectiles) {
        const renvoi = scene.mimiProjectiles.create(p.x, p.y, 'mimi_shot');
        renvoi.setDepth(19);
        renvoi.setTint(0x00ffff);
        scene.physics.moveToObject(renvoi, scene.boss, 800);
    }
}

// Sur un écran d'ordinateur, Mimi occupait 96 px de haut sur 1080 — 5 % de la hauteur,
// contre 12 % sur un téléphone. Le personnage devenait un détail perdu dans un champ
// vide, et le joueur voyait une portion de niveau bien plus large que prévu.
//
// Le zoom est volontairement un ENTIER : à 2, un pixel d'art occupe 6 pixels écran au
// lieu de 3, uniformément. Un zoom fractionnaire rendrait des pixels de tailles
// inégales et ruinerait la grille unifiée.
export function applyViewportZoom(scene) {
    const w = scene.scale.width, h = scene.scale.height;
    // Le repère est la hauteur : c'est elle qui décide de la taille apparente du
    // personnage, et elle ne dépend pas du rapport d'aspect.
    const zoom = Math.max(1, Math.min(3, Math.floor(h / 420)));
    scene.cameras.main.setZoom(zoom);
    return zoom;
}

export function updatePlayerMovement(scene, time, joy) {
    // Pendant le recul, le joueur n'a pas la main : c'est ce qui le sort du
    // chevauchement avec ce qui vient de le toucher.
    const enRecul = scene.time.now < (scene.player.reculJusqua || 0);
    if (enRecul) {
        scene.player.anims.play('swim', true);
        scene.player.setScale(window.charScale);
    } else if (joy.active) {
        scene.player.setVelocityX(joy.x * scene.player.currentSpeed);
        scene.player.setVelocityY(joy.y * scene.player.currentSpeed);
        if (joy.x < 0) scene.player.setFlipX(false);
        else if (joy.x > 0) scene.player.setFlipX(true);
        
        scene.player.anims.play('swim', true);
        scene.player.rotation = 0;
        scene.player.setScale(window.charScale);
        scene.player.bubbleEmitter.on = true;
        scene.player.sparkleEmitter.on = true;
    } else {
        scene.player.anims.stop();
        scene.player.setTexture('mermaid1');
        scene.player.setVelocityX(0);
        scene.player.setVelocityY(Math.sin(time / 300) * 20); 
        scene.player.rotation = Phaser.Math.Linear(scene.player.rotation, 0, 0.1);
        scene.player.setScale(window.charScale);
        scene.player.bubbleEmitter.on = false;
        scene.player.sparkleEmitter.on = false;
    }

    // RIBBON TRAIL MIMI
    scene.player.history.push({ x: scene.player.x, y: scene.player.y });
    if (scene.player.history.length > 20) scene.player.history.shift();

    scene.playerTrail.clear();
    for (let i = 0; i < scene.player.history.length - 1; i++) {
        let p1 = scene.player.history[i];
        let p2 = scene.player.history[i + 1];
        // Un à-coup de frame (onglet ralenti, chargement) laissait deux points distants
        // de plusieurs centaines de pixels : le sillage traçait alors un trait net en
        // travers de l'écran, très visible depuis que le fond est sombre. Un segment
        // plus long que ce qu'un déplacement d'une frame permet est un artefact.
        if (Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y) > 40) continue;
        let alpha = i / 20;
        // Le sillage était cyan : dans une eau froide, il se confondait avec elle et il
        // contredisait la lumière chaude de Mimi. Il prend la température du halo.
        scene.playerTrail.lineStyle(12 * alpha, window.hasTrident ? 0xffff00 : 0xffc978, alpha * 0.7);
        scene.playerTrail.beginPath();
        scene.playerTrail.moveTo(p1.x, p1.y);
        scene.playerTrail.lineTo(p2.x, p2.y);
        scene.playerTrail.strokePath();
    }

    // LA LUMIÈRE. Le halo chaud suit Mimi et respire au rythme de la réserve : plus elle
    // est basse, plus il est petit ET plus il bat vite. La tension se voit avant de se
    // lire dans une jauge.
    if (scene.player.lightGlow) {
        const ratio = GameState.light / GameState.maxLight;
        const radius = GameState.lightRadius();
        const beat = 1 + Math.sin(time / (260 + ratio * 700)) * (0.03 + (1 - ratio) * 0.06);
        scene.player.lightGlow.x = scene.player.x;
        scene.player.lightGlow.y = scene.player.y;
        scene.player.lightGlow.setScale((radius * 2 * beat) / 256);
        scene.player.lightGlow.setAlpha(0.55 + ratio * 0.4);
        scene.playerLightRadius = radius * beat;
    }

    // BOUCLIER DE PERLE (suit Mimi et pulse doucement)
    if (scene.player.boucliers > 0 && scene.pearlShieldGfx) {
        scene.pearlShieldGfx.setPosition(scene.player.x, scene.player.y);
        scene.pearlShieldGfx.setScale(1 + Math.sin(time / 250) * 0.08);
    }

    // ALLUMAGE DES BALISES. Il suffit d'atteindre la balise — le geste est de la
    // TROUVER, pas de la frotter. Toute la difficulté est dans le trajet à l'aveugle.
    if (scene.beacons) {
        for (let i = 0; i < scene.beacons.length; i++) {
            const b = scene.beacons[i];
            if (b.isLit) continue;
            if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, b.beaconX, b.beaconY) < 70) {
                bloomBeacon(scene, b, scene.beaconRadius);
                scene.beaconsLit++;
                // La floraison rend de la lumière — assez pour repartir aussitôt vers la
                // balise suivante, pas assez pour effacer la ressource. La valeur est
                // centralisée dans GameState avec les deux autres : c'est leur rapport
                // qui décide, pas chacune prise à part.
                GameState.addLight(GameState.LIGHT_PER_BEACON);
                if (window.playPowerupSound) window.playPowerupSound();

                // UNE BALISE ALLUMÉE REND UN CŒUR.
                //
                // Mesuré sur douze parties jouées à l'aveugle, pilote corrigé et deux
                // écrans concordants : 4 morts sur 6 de chaque côté et une médiane de
                // CINQ cœurs perdus sur cinq, alors que la réserve de lumière ne
                // descendait qu'à 56 %. Briser la spirale de dégâts n'avait pas suffi —
                // ce qui restait n'était plus un enchaînement mais un VOLUME : un
                // niveau demande ~11 000 px de nage à ~2 ennemis pour 1000 px, soit une
                // vingtaine de croisements, dont cinq finissaient par toucher malgré
                // l'esquive. Il n'y avait aucun moyen de réparer ce qu'on avait perdu.
                //
                // Le soin est attaché à la BALISE plutôt qu'aux perles ou à un compteur
                // plus généreux : il récompense le verbe du jeu, il donne un rythme —
                // plus on ouvre le récif, mieux on tient — et il fait de la progression
                // la réponse au danger, au lieu d'un simple relèvement de seuil.
                // UNE BALISE SUR DEUX, et non chacune. Première mesure avec un soin à
                // chaque balise : 12 parties sur 12 terminées, ZÉRO mort, 0,5 cœur perdu
                // en médiane. Cinq balises pour cinq cœurs remboursaient exactement toute
                // la barre — les coups continuaient de porter mais ne coûtaient plus
                // rien, et l'obscurité redevenait décorative. Une balise sur deux rend
                // deux cœurs par niveau : de quoi réparer, pas de quoi ignorer.
                if (scene.beaconsLit % 2 === 0 && GameState.heal(1)) {
                    // ANAÏS EST CE SOIN. Le cœur rendu tombait de nulle part : il avait
                    // un effet et aucune cause. Elle ne soigne rien EN PLUS — le montant
                    // reste celui qui a été mesuré — elle lui donne un visage.
                    summonAnais(scene);
                    const soin = scene.add.text(b.beaconX, b.beaconY - 40, '+1❤️', {
                        fontFamily: '"Press Start 2P"', fontSize: '10px',
                        fill: '#ff9ec4', stroke: '#2a0a18', strokeThickness: 3
                    }).setOrigin(0.5).setDepth(41);
                    scene.tweens.add({
                        targets: soin, y: soin.y - 46, alpha: 0,
                        delay: 350, duration: 1400, onComplete: () => soin.destroy()
                    });
                }

                // Un fragment de récit par balise, dans l'ordre. Au-delà de quatre, le
                // texte s'arrête plutôt que de tourner en boucle.
                if (scene.beaconsLit <= 4) fragmentRecit(scene, b.beaconX, b.beaconY, scene.beaconsLit - 1);
                if (scene.onBeaconLit) scene.onBeaconLit(scene.beaconsLit, scene.beacons.length);
            }
        }
    }

    // BOUSSOLE — elle désigne la balise éteinte la plus proche, et seulement quand le
    // joueur est en difficulté (réserve basse) ou près du but. Toujours affichée, elle
    // supprimerait l'exploration qui EST le jeu.
    const beaconsLeft = scene.beacons ? scene.beacons.filter(b => !b.isLit) : [];
    const lightLow = GameState.light / GameState.maxLight < 0.3;
    const nearlyDone = scene.beacons && scene.beacons.length > 0 && beaconsLeft.length <= 1;
    if (scene.compassSprite && beaconsLeft.length > 0 && (lightLow || nearlyDone)) {
        let nearest = null, minDist = Infinity;
        for (const b of beaconsLeft) {
            const d = Math.abs(b.beaconX - scene.player.x) + Math.abs(b.beaconY - scene.player.y);
            if (d < minDist) { minDist = d; nearest = b; }
        }
        scene.compassSprite.setVisible(true);
        const angle = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, nearest.beaconX, nearest.beaconY);
        scene.compassSprite.x = scene.player.x + Math.cos(angle) * 120;
        scene.compassSprite.y = scene.player.y + Math.sin(angle) * 120;
        scene.compassSprite.rotation = angle;
        scene.compassSprite.setScale(1 + Math.sin(time / 200) * 0.2);
    } else if (scene.compassSprite) {
        scene.compassSprite.setVisible(false);
    }
}

export function castMagicShockwave(scene) {
    if (!GameState.canCast(GameState.COSTS.shockwave) || scene.isGameFinished) return;

    // Le coût est prélevé ICI, avant l'effet, et non plus en deux fois : l'Onde payait
    // 2 charges de magie au début et 10 de lumière à la fin, deux monnaies pour un seul
    // geste. Elle ne paie plus qu'en lumière, et c'est le plus cher des trois pouvoirs.
    GameState.spendLight(GameState.COSTS.shockwave);
    if (window.playEnemyDefeatSound) window.playEnemyDefeatSound();

    const shockRadius = window.hasTrident ? 1200 : 600;
    let ringBaseColor = window.hasTrident ? 0xffffff : 0x00ffaa;
    let ring = scene.add.circle(scene.player.x, scene.player.y, 10, ringBaseColor, 0.8);
    
    if (window.hasTrident) {
        ring.setStrokeStyle(15, 0xff00ff);
        scene.tweens.add({
            targets: ring, strokeColor: 0x00ffff, duration: 200, yoyo: true, repeat: -1
        });
    } else {
        ring.setStrokeStyle(4, 0xffffff);
    }
    ring.setDepth(25);

    scene.tweens.add({
        targets: ring, radius: shockRadius, alpha: 0,
        duration: window.hasTrident ? 400 : 300,
        ease: 'Cubic.easeOut', onComplete: () => ring.destroy()
    });

    let ptOptions = {
        x: scene.player.x, y: scene.player.y,
        speed: { min: window.hasTrident ? 500 : 300, max: window.hasTrident ? 1000 : 600 },
        angle: { min: 0, max: 360 },
        scale: { start: window.hasTrident ? 4 : 2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: window.hasTrident ? 600 : 450,
        blendMode: 'ADD'
    };
    if (window.hasTrident) {
        ptOptions.tint = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    }

    const particleManager = scene.add.particles('sparkle');
    particleManager.setDepth(25);
    const explosion = particleManager.createEmitter(ptOptions);
    explosion.explode(window.hasTrident ? 300 : 80);
    scene.time.delayedCall(1500, () => particleManager.destroy());
    scene.cameras.main.shake(500, 0.03);

    // Monstres -> Poissons
    for (let i = scene.enemies.length - 1; i >= 0; i--) {
        const enemy = scene.enemies[i];
        if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, enemy.x, enemy.y) < shockRadius) {
            libererEnnemi(scene, enemy);
        }
    }

    // L'ONDE ÉCLAIRE. Elle ne frotte plus rien : elle repousse le voile sur toute sa
    // portée pendant quelques secondes. C'est le bon usage à un moment précis — quand on
    // est perdu et qu'il faut repérer la prochaine balise — plutôt qu'un bouton à
    // marteler. Et c'est là que le coût en lumière devient un vrai marché : on s'éclaire
    // loin quelques secondes en échange d'un halo plus petit pour la suite.
    const ox = scene.player.x, oy = scene.player.y;
    flareLight(scene, ox, oy, shockRadius, 3200);

    // PALIER II : la zone RESTE éclairée. Plus petite que l'éclair, mais elle tient
    // 20 s : on s'ouvre un palier de repos dans le noir, où revenir reprendre son souffle.
    // PALIER III : elle tient 45 s, et une ANCRE luit au-dessus du voile pour qu'on la
    // retrouve de loin. L'Onde cesse d'être un coup ponctuel pour devenir une façon de
    // baliser soi-même le niveau.
    if (GameState.waveLevel >= 2) {
        const duree = GameState.waveLevel >= 3 ? 45000 : 20000;
        flareLight(scene, ox, oy, 260, duree);
        if (GameState.waveLevel >= 3) poserAncre(scene, ox, oy, duree);
    }
}

// L'ancre de l'Onde III : une lueur posée AU-DESSUS du voile (DEPTH_BIOLUM), donc
// visible de loin dans le noir — c'est tout son intérêt — et qui s'éteint avec la zone.
function poserAncre(scene, x, y, duree) {
    const g = scene.add.image(x, y, 'bloomGlow');
    g.setDepth(DEPTH_BIOLUM);
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setTint(0x7cffd6);
    g.setScale(0.5);
    g.setAlpha(0.85);
    const pulse = scene.tweens.add({
        targets: g, scale: 0.62, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    scene.tweens.add({
        targets: g, alpha: 0, delay: duree * 0.7, duration: duree * 0.3,
        onComplete: () => { pulse.stop(); g.destroy(); }
    });
}

// Un ennemi touché par l'Onde ou le Rayon redevient poisson. Les quinze premiers
// rejoignent le banc qui file vers la balise éteinte la plus proche (Allies.js).
function libererEnnemi(scene, enemy) {
    const keys = ['fish_orange', 'fish_blue'];
    const freedFish = scene.add.sprite(enemy.x, enemy.y, keys[Math.floor(Math.random() * keys.length)]);
    freedFish.setDepth(17);
    freedFish.customSpeed = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);

    scene.tweens.add({
        targets: freedFish,
        scaleX: { from: 0.1, to: 1.5 }, scaleY: { from: 0.1, to: 1.5 },
        angle: { from: -180, to: 0 },
        duration: 600, ease: 'Back.easeOut',
        onComplete: () => { scene.tweens.add({ targets: freedFish, scaleX: 1, scaleY: 1, duration: 200 }); }
    });

    if (scene.helperFishes.length < 15) {
        scene.helperFishes.push(freedFish);
        freedFish.setTint(0x00ffaa);
    } else {
        scene.backgroundFish.push(freedFish);
    }

    const i = scene.enemies.indexOf(enemy);
    if (i >= 0) scene.enemies.splice(i, 1);
    enemy.destroy();
}

// Défaite : Mimi coule doucement plutôt qu'un écran de mort brutal — le jeu doit
// rester tendre. La progression (niveau, perles totales, améliorations) est conservée ;
// seules les perles de la session en cours sont perdues.
export function defeatPlayer(scene) {
    if (GameState.isDefeated) return;
    GameState.defeat();

    // Le clignotement de la grâce est un tween sur l'alpha : s'il tourne encore, il se
    // battrait avec le fondu de la chute juste en dessous.
    if (scene.player.clignote) { scene.player.clignote.stop(); scene.player.clignote = null; }
    scene.player.alpha = 1;
    scene.player.reculJusqua = 0;

    scene.isGameFinished = true; // arrête la boucle update() de la scène
    scene.player.setVelocity(0);
    scene.player.isStunned = true;
    scene.player.anims.stop();
    scene.player.setTint(0x8899aa);

    if (window.playHurtSound) window.playHurtSound();
    if (window.Haptics) window.Haptics.vibrate().catch(() => { });
    scene.cameras.main.shake(600, 0.03);

    scene.tweens.add({
        targets: scene.player,
        y: scene.player.y + 120,
        angle: 90,
        alpha: 0.35,
        duration: 1800,
        ease: 'Sine.easeIn'
    });

    scene.time.delayedCall(1600, () => {
        if (typeof window.showGameOver === 'function') window.showGameOver();
    });
}

export function castPearlShield(scene) {
    // PALIER III : deux charges au lieu d'une. On ne relance pas un bouclier encore
    // plein — ce serait payer de la lumière pour rien.
    const charges = GameState.shieldLevel >= 3 ? 2 : 1;
    if (!GameState.canCast(GameState.COSTS.shield) || scene.isGameFinished
        || scene.player.boucliers >= charges) return;

    GameState.spendLight(GameState.COSTS.shield);
    scene.player.boucliers = charges;

    if (window.playPowerupSound) window.playPowerupSound();
    if (window.Haptics) window.Haptics.impact({ style: 'MEDIUM' }).catch(() => { });

    dessinerBouclier(scene);

    const sparkleManager = scene.add.particles('sparkle');
    const burst = sparkleManager.createEmitter({
        x: scene.player.x, y: scene.player.y,
        speed: { min: 100, max: 220 }, scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0 }, tint: 0x00ffff,
        lifespan: 700, blendMode: 'ADD'
    });
    burst.explode(40);
    scene.time.delayedCall(1200, () => sparkleManager.destroy());

    let shieldTitle = scene.add.text(scene.player.x, scene.player.y - 100, window.getStr('castShield'), {
        fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#00ffff', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    scene.tweens.add({ targets: shieldTitle, y: scene.player.y - 150, alpha: 0, duration: 2500, onComplete: () => shieldTitle.destroy() });
}

export function firePurifyingRay(scene, time) {
    // Le Rayon était le seul pouvoir gratuit : porté par une recharge de 3 s et rien
    // d'autre, il n'y avait aucune raison de ne pas le tirer dès qu'il revenait. Il coûte
    // maintenant de la lumière comme les deux autres — peu, parce qu'on le tire souvent —
    // et la recharge reste, qui règle la CADENCE là où le coût règle la DÉPENSE.
    if (!GameState.canCast(GameState.COSTS.ray)) return;
    GameState.spendLight(GameState.COSTS.ray);

    scene.lastRayTime = time + 3000;

    if (window.playLaserSound) window.playLaserSound();
    if (window.Haptics) window.Haptics.impact({ style: 'MEDIUM' }).catch(() => { });
    scene.cameras.main.flash(200, 0, 255, 255);

    const versDroite = scene.player.flipX;
    let touches = tirerTrait(scene, versDroite);
    // PALIER III : le trait part DES DEUX CÔTÉS. On ne choisit plus son orientation avant
    // de tirer — ça change le placement, pas la puissance.
    if (GameState.rayLevel >= 3) touches += tirerTrait(scene, !versDroite);

    // « PURIFIÉ ! » s'affichait à chaque tir, même dans le vide : le Rayon ne touchait
    // alors rien du tout. Il ne s'affiche plus que s'il a réellement purifié quelque chose.
    if (touches > 0) {
        const floatText = scene.add.text(scene.player.x, scene.player.y - 80, window.getStr('castPurified'),
            { fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#00ffff' }).setOrigin(0.5).setDepth(40);
        scene.tweens.add({ targets: floatText, y: floatText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatText.destroy() });
    }
}

// Un trait de Rayon dans une direction. Renvoie le nombre de cibles touchées.
//
// LE RAYON NE TOUCHAIT RIEN. Il ouvrait trois foyers de lumière dans le voile et
// affichait « PURIFIÉ ! », mais aucun ennemi, aucun boss n'était jamais testé contre son
// tracé. Pour le pouvoir qui répond à « je vise », c'était le même défaut que le
// Bouclier : il ne faisait pas ce qu'il annonçait.
function tirerTrait(scene, versDroite) {
    const p = scene.player;
    const longueur = 600, demi = 60;
    const startX = p.x + (versDroite ? 20 : -20);
    const endX = startX + (versDroite ? longueur : -longueur);
    const x0 = Math.min(startX, endX), x1 = Math.max(startX, endX);
    const dansLeTrait = (o, mx, my) =>
        o.x >= x0 - mx && o.x <= x1 + mx && Math.abs(o.y - p.y) < demi + my;

    const rayGfx = scene.add.graphics();
    rayGfx.fillStyle(0x00ffff, 0.8);
    rayGfx.lineStyle(4, 0xffdd00, 1);
    rayGfx.fillRect(x0, p.y - demi, longueur, demi * 2);
    rayGfx.strokeRect(x0, p.y - demi, longueur, demi * 2);
    rayGfx.setDepth(20);
    scene.tweens.add({
        targets: rayGfx, alpha: 0, scaleY: 0.1, y: p.y,
        duration: 500, ease: 'Power2', onComplete: () => rayGfx.destroy()
    });

    // LE RAYON PERCE LE VOILE en ligne droite : trois foyers échelonnés le long du trait
    // ouvrent un couloir de vision là où il est passé.
    for (let k = 0; k <= 2; k++) {
        const fx = startX + (versDroite ? 1 : -1) * (longueur * (0.2 + k * 0.35));
        flareLight(scene, fx, p.y, demi * 2.2, 2400);
    }

    let touches = 0;

    // Les ennemis sur le tracé redeviennent poissons, comme sous l'Onde.
    for (let i = scene.enemies.length - 1; i >= 0; i--) {
        const e = scene.enemies[i];
        if (e.active && dansLeTrait(e, 20, 20)) { libererEnnemi(scene, e); touches++; }
    }

    // Le boss : dix tirs automatiques d'un coup. Viser le boss au Rayon doit valoir ses
    // 4 de lumière, sinon le tir auto suffit et le pouvoir n'a pas de raison d'être.
    const b = scene.boss;
    if (scene.bossActive && b && b.active && dansLeTrait(b, b.displayWidth / 2, b.displayHeight / 2)) {
        damageBoss(scene, null, 10 * (15 + GameState.brushLevel * 5));
        touches++;
    }

    // PALIER II : le trait ATTIRE les perles qu'il traverse. L'arme devient une récolte,
    // et le seul pouvoir sans lien avec la ressource centrale en trouve un : tirer peut
    // rembourser ce qu'il a coûté. Les perles rejoignent Mimi par le chemin normal du
    // ramassage (overlap dans MainScene) — rien n'est crédité en douce.
    if (GameState.rayLevel >= 2 && scene.pearls) {
        scene.pearls.getChildren().forEach(perle => {
            if (!perle.active || !dansLeTrait(perle, 0, 30)) return;
            scene.tweens.add({
                targets: perle, x: p.x, y: p.y, duration: 380, ease: 'Cubic.easeIn',
                onComplete: () => { if (perle.active) perle.setPosition(p.x, p.y); }
            });
        });
    }

    return touches;
}
