import { damageBoss } from './Enemies.js';
import { GameState } from '../managers/GameState.js';

// --- GESTION DES ALLIÉS (Malik, Anaïs, Poissons) ---
//
// Malik et Anaïs ONT CESSÉ D'ÊTRE DES POUVOIRS. Avec les Dauphins, ils formaient trois
// boutons pour une seule idée : appuyer, et regarder quelqu'un d'autre se battre à sa
// place. Dans un jeu d'action qui doit tenir en une heure, chaque minute doit être
// JOUÉE, et ces trois-là retiraient la manette des mains.
//
// Ils ne disparaissent pas pour autant : ils reviennent d'eux-mêmes, aux moments où le
// récit les appelle. Malik arrive quand le boss se pose, Anaïs quand une balise rend un
// cœur. Ni l'un ni l'autre ne coûte quoi que ce soit, et aucun ne s'invoque.
//
// Les Dauphins, eux, sont partis pour de bon : ils n'existaient que pendant les combats
// de boss et infligeaient 20 % des PV du boss par bête, soit une pression sur un bouton
// qui remplaçait le combat.
export function updateHelperFishes(scene) {
    for (let i = scene.helperFishes.length - 1; i >= 0; i--) {
        let fish = scene.helperFishes[i];
        // Les poissons ne frottent plus la saleté : ils NAGENT VERS LA BALISE ÉTEINTE la
        // plus proche. Un banc qui file dans le noir dans une direction précise est une
        // indication de chemin qu'aucune interface ne remplace.
        let targetSpot = null;
        let minDist = 1200;

        if (scene.beacons) {
            for (let j = 0; j < scene.beacons.length; j++) {
                const b = scene.beacons[j];
                if (b.isLit) continue;
                const d = Phaser.Math.Distance.Between(fish.x, fish.y, b.beaconX, b.beaconY);
                if (d < minDist) { minDist = d; targetSpot = { x: b.beaconX, y: b.beaconY }; }
            }
        }

        if (targetSpot && minDist > 60) {
            let angle = Phaser.Math.Angle.Between(fish.x, fish.y, targetSpot.x, targetSpot.y);
            fish.x += Math.cos(angle) * 3;
            fish.y += Math.sin(angle) * 3;
            fish.rotation = angle + Math.PI / 2;
        } else {
            fish.x += 2;
            fish.y -= 1;
            fish.rotation = 0;
            
            let camX = scene.cameras.main.scrollX;
            if (fish.x > camX + scene.game.config.width + 200 || fish.x > scene.physics.world.bounds.width) {
                fish.destroy();
                scene.helperFishes.splice(i, 1);
            }
        }
    }
}

// Appelé par spawnBoss quand le boss touche le fond, jamais par le joueur. Malik reste
// tant que le combat dure : c'est le seul moment du jeu où Mimi n'est pas seule, et une
// minuterie de 10 s aurait fait de lui un passant.
export function summonMalik(scene) {
    if (scene.isGameFinished || scene.malikActive) return;

    scene.malikActive = true;

    if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

    // 'malik_swim' était joué sans jamais avoir été créé : Phaser émettait un
    // avertissement et Malik restait figé. Même cycle que Mimi, sur sa propre palette.
    if (!scene.anims.exists('malik_swim')) {
        scene.anims.create({
            key: 'malik_swim',
            frames: [{ key: 'malik' }, { key: 'malik2' }, { key: 'malik' }, { key: 'malik3' }],
            frameRate: 8,
            repeat: -1
        });
    }

    scene.malik = scene.physics.add.sprite(scene.player.x - 100, scene.player.y, 'malik');
    scene.malik.setDepth(21);
    scene.malik.setScale(0);
    scene.malik.anims.play('malik_swim', true);

    scene.malik.history = [];
    scene.malikTrail = scene.add.graphics();
    scene.malikTrail.setDepth(20);
    scene.malikTrail.setBlendMode(Phaser.BlendModes.ADD);

    scene.tweens.add({ targets: scene.malik, scale: window.charScale, duration: 800, ease: 'Elastic.easeOut' });

    const sparkleManager = scene.add.particles('sparkle');
    const explosion = sparkleManager.createEmitter({
        x: scene.player.x - 100, y: scene.player.y,
        speed: { min: 100, max: 200 }, scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 }, lifespan: 1000, tint: 0x00ff88, blendMode: 'ADD'
    });
    explosion.explode(50);
    scene.time.delayedCall(1500, () => sparkleManager.destroy());

    let malikTitle = scene.add.text(scene.player.x, scene.player.y - 120, window.getStr('castMalik'), {
        fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#00ff88', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    scene.tweens.add({ targets: malikTitle, y: scene.player.y - 180, alpha: 0, duration: 3000, onComplete: () => malikTitle.destroy() });
}

export function updateMalik(scene, time, delta) {
    if (scene.malikActive && scene.malik && scene.malik.active) {
        // Il repart quand le combat se termine — victoire comme défaite.
        const combatFini = !scene.bossActive || !scene.boss || !scene.boss.active;

        if (combatFini) {
            scene.malikActive = false;
            if (scene.malikTrail) scene.malikTrail.destroy(); 
            scene.tweens.add({
                targets: scene.malik,
                x: scene.malik.x + (scene.malik.flipX ? 1500 : -1500),
                alpha: 0, duration: 1500, ease: 'Power2',
                onComplete: () => { scene.malik.destroy(); }
            });
        } else {
            // Malik n'existe plus que pendant un combat de boss : il n'a qu'une cible.
            // La recherche de balise éteinte qui vivait ici servait aux dix secondes où
            // on pouvait l'invoquer en exploration — elles n'existent plus.
            const targetX = scene.boss.x;
            const targetY = scene.boss.y;

            let angle = Phaser.Math.Angle.Between(scene.malik.x, scene.malik.y, targetX, targetY);
            scene.malik.x += Math.cos(angle) * 7; 
            scene.malik.y += Math.sin(angle) * 7 + Math.sin(time / 120) * 15;
            if (Math.cos(angle) < 0) scene.malik.setFlipX(false); else scene.malik.setFlipX(true);

            scene.malik.history.push({ x: scene.malik.x, y: scene.malik.y });
            if (scene.malik.history.length > 20) scene.malik.history.shift();
            scene.malikTrail.clear();
            for (let i = 0; i < scene.malik.history.length - 1; i++) {
                let p1 = scene.malik.history[i]; let p2 = scene.malik.history[i + 1]; let alpha = i / 20;
                scene.malikTrail.lineStyle(20 * alpha, 0x00ff88, alpha * 0.9);
                scene.malikTrail.beginPath(); scene.malikTrail.moveTo(p1.x, p1.y); scene.malikTrail.lineTo(p2.x, p2.y); scene.malikTrail.strokePath();
            }

            // 2. Comportement OFFENSIF si le boss est là
            if (GameState.isBossActive && scene.boss && scene.boss.active && Phaser.Math.Distance.Between(scene.malik.x, scene.malik.y, scene.boss.x, scene.boss.y) < 180) {
                if (time % 800 < 50) { 
                    if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();
                    damageBoss(scene, null, 50); 
                }
            }
        }
    }
}

// Appelée par Player.js quand une balise rend un cœur, jamais par le joueur.
//
// Anaïs ne soigne pas EN PLUS : elle EST le soin. Le « +1 ❤️ » flottant qui sortait de
// nulle part à une balise sur deux avait un effet mais pas de cause ; maintenant il a un
// visage. Le montant reste celui qui a été mesuré (un cœur), pour ne pas rejouer un
// équilibrage acquis en changeant qui le porte.
export function summonAnais(scene) {
    if (scene.isGameFinished || (scene.anais && scene.anais.active)) return;

    if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

    let annonce = scene.add.text(scene.player.x, scene.player.y - 120, window.getStr('castAnais'), {
        fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#ffe08a', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    scene.tweens.add({ targets: annonce, y: annonce.y - 60, alpha: 0, duration: 3000, onComplete: () => annonce.destroy() });

    // 'anais_sheet' était référencé ici mais n'a JAMAIS été chargé nulle part :
    // Anaïs s'affichait en rectangle de texture manquante. On la branche sur les
    // textures procédurales (palette dorée), et le jeu redevient 100 % généré par code.
    // NB : elle reste visuellement identique à la princesse Nana — il lui faudra sa
    // propre silhouette, comme on vient de le faire pour Malik.
    if (!scene.anims.exists('anais_swim')) {
        scene.anims.create({
            key: 'anais_swim',
            frames: [{ key: 'anais' }, { key: 'anais2' }, { key: 'anais' }, { key: 'anais3' }],
            frameRate: 8,
            repeat: -1
        });
    }

    scene.anais = scene.physics.add.sprite(scene.player.x, scene.player.y - 100, 'anais');
    scene.anais.setDepth(22);
    scene.anais.setScale(0);
    scene.anais.anims.play('anais_swim', true);
    scene.anais.endTime = scene.time.now + 12000;

    // setBodySize(200,200) et scale 0.15 étaient calibrés pour la grande planche PNG ;
    // la texture procédurale fait 60×60 et suit l'échelle des autres personnages.
    scene.tweens.add({ targets: scene.anais, scale: window.charScale, duration: 800, ease: 'Elastic.easeOut' });

    scene.anaisAura = scene.add.graphics();
    scene.anaisAura.lineStyle(4, 0xffff00, 0.6);
    scene.anaisAura.fillStyle(0xffff00, 0.1);
    scene.anaisAura.fillCircle(0, 0, 200);
    scene.anaisAura.strokeCircle(0, 0, 200);
    scene.anaisAura.setDepth(21);
}

export function updateAnais(scene, time) {
    if (scene.anais && scene.anais.active) {
        if (time > scene.anais.endTime) {
            scene.tweens.add({
                targets: scene.anais, scale: 0, alpha: 0, duration: 500,
                onComplete: () => { scene.anais.destroy(); scene.anaisAura.destroy(); }
            });
            scene.anais.active = false;
        } else {
            // Suivre Mimi
            scene.anais.x = Phaser.Math.Linear(scene.anais.x, scene.player.x + 50, 0.05);
            scene.anais.y = Phaser.Math.Linear(scene.anais.y, scene.player.y - 50, 0.05);
            scene.anais.setFlipX(scene.player.x > scene.anais.x);
            
            // Aura visuelle
            scene.anaisAura.setPosition(scene.anais.x, scene.anais.y);
            scene.anaisAura.rotation += 0.02;

            // Elle ne porte plus QUE sa lumière (déclarée dans Veil.collectSources).
            //
            // Le ralentissement de la fonte et le bonus de vitesse de 1,5× ont été
            // retirés : ils payaient un coût de 3 charges de magie qui n'existe plus.
            // Anaïs venant maintenant gratuitement deux ou trois fois par niveau, les
            // garder aurait rejoué en douce un équilibrage obtenu en neuf parties.
        }
    }
}
