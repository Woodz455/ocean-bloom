import { GameState } from '../managers/GameState.js';
import { bloomBeacon, flareLight, fragmentRecit } from '../managers/Veil.js';
import { summonAnais } from './Allies.js';

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
    scene.player.hasPearlShield = false;

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
    if (scene.player.hasPearlShield && scene.pearlShieldGfx) {
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

    GameState.spendMagic(GameState.COSTS.shockwave);
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
    let enemiesDestroyed = 0;
    for (let i = scene.enemies.length - 1; i >= 0; i--) {
        let enemy = scene.enemies[i];
        if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, enemy.x, enemy.y) < shockRadius) {

            let keys = ['fish_orange', 'fish_blue'];
            let fishType = keys[Math.floor(Math.random() * keys.length)];
            let freedFish = scene.add.sprite(enemy.x, enemy.y, fishType);
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

            enemy.destroy();
            scene.enemies.splice(i, 1);
            enemiesDestroyed++;
        }
    }

    // L'ONDE ÉCLAIRE. Elle ne frotte plus rien : elle repousse le voile sur toute sa
    // portée pendant quelques secondes. C'est le bon usage à un moment précis — quand on
    // est perdu et qu'il faut repérer la prochaine balise — plutôt qu'un bouton à
    // marteler.
    GameState.spendLight(GameState.LIGHT_COST_ABILITY);
    flareLight(scene, scene.player.x, scene.player.y, shockRadius, 3200);
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
    if (!GameState.canCast(GameState.COSTS.shield) || scene.isGameFinished || scene.player.hasPearlShield) return;

    GameState.spendMagic(GameState.COSTS.shield);
    scene.player.hasPearlShield = true;

    if (window.playPowerupSound) window.playPowerupSound();
    if (window.Haptics) window.Haptics.impact({ style: 'MEDIUM' }).catch(() => { });

    scene.pearlShieldGfx = scene.add.graphics();
    scene.pearlShieldGfx.lineStyle(5, 0x00ffff, 0.9);
    scene.pearlShieldGfx.fillStyle(0x00ccff, 0.12);
    scene.pearlShieldGfx.fillCircle(0, 0, 70);
    scene.pearlShieldGfx.strokeCircle(0, 0, 70);
    scene.pearlShieldGfx.setDepth(19);
    scene.pearlShieldGfx.setBlendMode(Phaser.BlendModes.ADD);
    scene.pearlShieldGfx.setPosition(scene.player.x, scene.player.y);

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
    scene.lastRayTime = time + 3000;

    if (window.playLaserSound) window.playLaserSound(); 
    if (window.Haptics) window.Haptics.impact({ style: 'MEDIUM' }).catch(() => { });

    let isRight = scene.player.flipX;
    let rayLength = 600;
    let rayHeightHalf = 60;
    let startX = scene.player.x + (isRight ? 20 : -20);
    let endX = startX + (isRight ? rayLength : -rayLength);
    let topY = scene.player.y - rayHeightHalf;
    let bottomY = scene.player.y + rayHeightHalf;

    let rayGfx = scene.add.graphics();
    rayGfx.fillStyle(0x00ffff, 0.8);
    rayGfx.lineStyle(4, 0xffdd00, 1);
    rayGfx.fillRect(isRight ? startX : endX, topY, rayLength, rayHeightHalf * 2);
    rayGfx.strokeRect(isRight ? startX : endX, topY, rayLength, rayHeightHalf * 2);
    rayGfx.setDepth(20);

    scene.cameras.main.flash(200, 0, 255, 255);

    scene.tweens.add({
        targets: rayGfx, alpha: 0, scaleY: 0.1, y: scene.player.y,
        duration: 500, ease: 'Power2', onComplete: () => rayGfx.destroy()
    });

    // LE RAYON PERCE LE VOILE en ligne droite : trois foyers échelonnés le long du trait
    // ouvrent un couloir de vision là où le rayon est passé. C'est la capacité du
    // Trident, elle doit donner une portée que rien d'autre ne donne.
    const centerX = startX + (isRight ? rayLength / 2 : -rayLength / 2);
    for (let k = 0; k <= 2; k++) {
        const fx = startX + (isRight ? 1 : -1) * (rayLength * (0.2 + k * 0.35));
        flareLight(scene, fx, scene.player.y, rayHeightHalf * 2.2, 2400);
    }

    const floatText = scene.add.text(centerX, scene.player.y - 80, window.getStr('castPurified'),
        { fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#00ffff' }).setOrigin(0.5).setDepth(40);
    scene.tweens.add({ targets: floatText, y: floatText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatText.destroy() });
}
