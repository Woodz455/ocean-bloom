import { damageBoss } from './Enemies.js';
import { GameState } from '../managers/GameState.js';

// --- GESTION DES ALLIÉS (Malik, Dauphins, Poissons) ---
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

export function summonMalik(scene) {
    if (!GameState.canCast(GameState.COSTS.malik) || scene.isGameFinished || scene.malikActive) return;

    GameState.spendMagic(GameState.COSTS.malik);
    scene.malikActive = true;
    scene.malikTimeLeft = 10000;

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
        scene.malikTimeLeft -= delta;

        if (scene.malikTimeLeft <= 0) {
            scene.malikActive = false;
            if (scene.malikTrail) scene.malikTrail.destroy(); 
            scene.tweens.add({
                targets: scene.malik,
                x: scene.malik.x + (scene.malik.flipX ? 1500 : -1500),
                alpha: 0, duration: 1500, ease: 'Power2',
                onComplete: () => { scene.malik.destroy(); }
            });
        } else {
            let targetX = scene.malik.x + (scene.malik.flipX ? 200 : -200);
            let targetY = scene.malik.y + Math.sin(time / 200) * 100;

            if (GameState.isBossActive && scene.boss && scene.boss.active) {
                targetX = scene.boss.x; targetY = scene.boss.y;
            } else if (scene.beacons) {
                // Malik ouvre la voie : il file vers la balise éteinte la plus proche,
                // et sa propre lumière (déclarée dans Veil.collectSources) éclaire le
                // chemin devant Mimi.
                for (let i = 0; i < scene.beacons.length; i++) {
                    const b = scene.beacons[i];
                    if (b.isLit) continue;
                    if (Phaser.Math.Distance.Between(scene.malik.x, scene.malik.y, b.beaconX, b.beaconY) < 1800) {
                        targetX = b.beaconX; targetY = b.beaconY;
                        break;
                    }
                }
            }

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

export function castDolphinUltimate(scene) {
    if (!scene.bossActive || !GameState.canCast(GameState.COSTS.dolphins) || scene.isGameFinished || !scene.boss) return;

    GameState.spendMagic(GameState.COSTS.dolphins);

    if (typeof window.playDolphinSound === 'function') window.playDolphinSound();

    scene.cameras.main.flash(300, 0, 200, 255); 
    scene.cameras.main.shake(800, 0.04); 

    let numDolphins = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numDolphins; i++) {
        scene.time.delayedCall(i * 150, () => {
            if (!scene.bossActive) return; 

            let camView = scene.cameras.main.worldView;
            let startX = camView.x - 100 - (Math.random() * 100);
            let startY = camView.y + (Math.random() * camView.height);

            let dolphin = scene.add.sprite(startX, startY, 'electric_dolphin');
            dolphin.setDepth(30); // taille portée par l'art, plus par un setScale
            
            const angleToBoss = Phaser.Math.Angle.Between(startX, startY, scene.boss.x, scene.boss.y);
            dolphin.rotation = angleToBoss;

            const sparkleManager = scene.add.particles('sparkle');
            const trail = sparkleManager.createEmitter({
                speed: 0, scale: { start: 1.5, end: 0 }, alpha: { start: 0.8, end: 0 },
                lifespan: 400, frequency: 10, follow: dolphin, blendMode: 'ADD'
            });

            scene.tweens.add({
                targets: dolphin, x: scene.boss.x, y: scene.boss.y, duration: 400, ease: 'Power2',
                onComplete: () => {
                    let hugeDmg = scene.boss.maxHp * 0.20;
                    damageBoss(scene, null, hugeDmg);
                    scene.tweens.add({
                        targets: dolphin, x: scene.boss.x + Math.cos(angleToBoss) * 800, y: scene.boss.y + Math.sin(angleToBoss) * 800,
                        duration: 400, ease: 'Sine.easeIn', onComplete: () => { dolphin.destroy(); trail.stop(); sparkleManager.destroy(); }
                    });
                }
            });
        });
    }
}

export function summonAnais(scene) {
    if (!GameState.canCast(GameState.COSTS.anais) || scene.isGameFinished || (scene.anais && scene.anais.active)) return;

    GameState.spendMagic(GameState.COSTS.anais);
    if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

    // Anaïs est le personnage « SOIN » (c'est ce que dit le commentaire de son bouton
    // dans index.html) mais elle ne soignait rien : elle nettoyait et donnait de la
    // vitesse. Maintenant que Mimi a des PV, son rôle a enfin un sens.
    if (GameState.heal(2)) {
        let healTxt = scene.add.text(scene.player.x, scene.player.y - 90, "+2 ❤️", {
            fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#ff5e8a', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(41);
        scene.tweens.add({ targets: healTxt, y: healTxt.y - 60, alpha: 0, duration: 2000, onComplete: () => healTxt.destroy() });
    }

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

            // Anaïs ne nettoie plus : elle porte sa propre lumière (déclarée dans
            // Veil.collectSources) et ralentit la fonte de la réserve tant qu'elle est
            // là. Une seconde source qui suit Mimi, c'est de la marge de manœuvre.
            GameState.addLight(GameState.LIGHT_DRAIN_PER_SEC * 0.012);

            // Buff de vitesse (Rayon: 250)
            if (Phaser.Math.Distance.Between(scene.anais.x, scene.anais.y, scene.player.x, scene.player.y) < 250) {
                scene.player.currentSpeed = scene.player.baseSpeed * 1.5;
                if (!scene.player.hasAnaisBuff) {
                    scene.player.hasAnaisBuff = true;
                    scene.player.setTint(0xffff00);
                }
            } else if (scene.player.hasAnaisBuff) {
                scene.player.hasAnaisBuff = false;
                if (!scene.player.isStunned) scene.player.clearTint();
                scene.player.currentSpeed = scene.player.baseSpeed;
            }
        }
    } else if (scene.player.hasAnaisBuff) {
        scene.player.hasAnaisBuff = false;
        if (!scene.player.isStunned) scene.player.clearTint();
        scene.player.currentSpeed = scene.player.baseSpeed;
    }
}
