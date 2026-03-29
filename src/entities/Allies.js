import { damageBoss } from './Enemies.js';

// --- GESTION DES ALLIÉS (Malik, Dauphins, Poissons) ---
export function updateHelperFishes(scene) {
    for (let i = scene.helperFishes.length - 1; i >= 0; i--) {
        let fish = scene.helperFishes[i];
        let targetSpot = null;
        let minDist = 800; 

        for (let j = 0; j < scene.pollutionSpots.length; j++) {
            let spot = scene.pollutionSpots[j];
            if (!spot.cleaned) {
                let d = Phaser.Math.Distance.Between(fish.x, fish.y, spot.x, spot.y);
                if (d < minDist) { minDist = d; targetSpot = spot; }
            }
        }

        if (targetSpot) {
            let angle = Phaser.Math.Angle.Between(fish.x, fish.y, targetSpot.x, targetSpot.y);
            fish.x += Math.cos(angle) * 3; 
            fish.y += Math.sin(angle) * 3;
            fish.rotation = angle + Math.PI / 2; 

            if (minDist < 30) {
                targetSpot.cleaned = true;
                scene.cleanedPollution++;
                scene.updateProgressUI();

                let fg = scene.make.image({ key: 'fishBrush', add: false });
                scene.pollutedLayer.erase(fg, targetSpot.x, targetSpot.y);
            }
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
    if (window.magicCharges < 4 || scene.isGameFinished || scene.malikActive) return;

    window.magicCharges -= 4;
    window.updateGameUI();
    scene.malikActive = true;
    scene.malikTimeLeft = 10000;

    if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

    scene.malik = scene.physics.add.sprite(scene.player.x - 100, scene.player.y, 'malik');
    scene.malik.setDepth(21);
    scene.malik.setScale(0);
    scene.malik.anims.play('malik_swim', true); 

    scene.malik.history = [];
    scene.malikTrail = scene.add.graphics();
    scene.malikTrail.setDepth(20);
    scene.malikTrail.setBlendMode(Phaser.BlendModes.ADD);

    scene.tweens.add({ targets: scene.malik, scale: window.charScale, duration: 800, ease: 'Elastic.easeOut' });

    const explosion = scene.add.particles('sparkle').createEmitter({
        x: scene.player.x - 100, y: scene.player.y,
        speed: { min: 100, max: 200 }, scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 }, lifespan: 1000, tint: 0x00ff88, blendMode: 'ADD'
    });
    explosion.explode(50);

    let malikTitle = scene.add.text(scene.player.x, scene.player.y - 120, "MALIK À LA RESCOUSSE ! 🧜‍♂️", {
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

            if (window.isBossActiveGlobally && scene.boss && scene.boss.active) {
                targetX = scene.boss.x; targetY = scene.boss.y;
            } else if (scene.pollutionSpots.length > 0) {
                for (let i = 0; i < scene.pollutionSpots.length; i++) {
                    if (!scene.pollutionSpots[i].cleaned && Phaser.Math.Distance.Between(scene.malik.x, scene.malik.y, scene.pollutionSpots[i].x, scene.pollutionSpots[i].y) < 1500) {
                        targetX = scene.pollutionSpots[i].x; targetY = scene.pollutionSpots[i].y;
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

            let pointsCleanedByMalik = 0; let brushRad = 300; 
            for (let i = 0; i < scene.pollutionSpots.length; i++) {
                let spot = scene.pollutionSpots[i];
                if (!spot.cleaned && Phaser.Math.Distance.Between(scene.malik.x, scene.malik.y, spot.x, spot.y) < brushRad) {
                    spot.cleaned = true; pointsCleanedByMalik++;
                }
            }
            if (pointsCleanedByMalik > 0) {
                scene.cleanedPollution += pointsCleanedByMalik;
                scene.updateProgressUI();
                let fgMalik = scene.make.image({ key: 'malikBrush', add: false });
                scene.pollutedLayer.erase(fgMalik, scene.malik.x, scene.malik.y);
            }

            if (window.isBossActiveGlobally && scene.boss && scene.boss.active && Phaser.Math.Distance.Between(scene.malik.x, scene.malik.y, scene.boss.x, scene.boss.y) < 180) {
                if (time % 800 < 50) { 
                    if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();
                    damageBoss(scene, null, 50); 
                }
            }
        }
    }
}

export function castDolphinUltimate(scene) {
    if (!scene.bossActive || window.magicCharges < 2 || scene.isGameFinished || !scene.boss) return;

    window.magicCharges -= 2;
    window.updateGameUI();

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
            dolphin.setDepth(30); dolphin.setScale(2); 
            const angleToBoss = Phaser.Math.Angle.Between(startX, startY, scene.boss.x, scene.boss.y);
            dolphin.rotation = angleToBoss;

            const trail = scene.add.particles('sparkle').createEmitter({
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
                        duration: 400, ease: 'Sine.easeIn', onComplete: () => { dolphin.destroy(); trail.stop(); }
                    });
                }
            });
        });
    }
}
