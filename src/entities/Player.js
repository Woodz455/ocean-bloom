// --- GESTIONNAIRE DU JOUEUR ---
export function configurePlayer(scene, levelW, levelH) {
    scene.anims.create({ key: 'swim', frames: [{ key: 'mermaid1' }, { key: 'mermaid2' }, { key: 'mermaid3' }, { key: 'mermaid2' }], frameRate: 10, repeat: -1 });

    scene.player = scene.physics.add.sprite(levelW / 2, levelH / 2, 'mermaid1');
    scene.player.setScale(window.charScale);
    scene.player.setDepth(20);
    scene.player.setCollideWorldBounds(true);
    scene.player.setDrag(200);
    scene.player.baseSpeed = 350 + ((window.speedLevel - 1) * 40);
    scene.player.currentSpeed = scene.player.baseSpeed;
    scene.player.setMaxVelocity(800);
    scene.player.isStunned = false;

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

    // GLOW
    scene.player.lightGlow = scene.add.image(scene.player.x, scene.player.y, 'eraserBrush');
    scene.player.lightGlow.setDepth(18);
    scene.player.lightGlow.setTint(0x00ffaa);
    scene.player.lightGlow.setAlpha(0.5);
    scene.player.lightGlow.setBlendMode(Phaser.BlendModes.ADD);

    scene.tweens.add({
        targets: scene.player.lightGlow,
        scaleX: 1.2, scaleY: 1.2, alpha: 0.2,
        duration: 1500, yoyo: true, repeat: -1
    });

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

    scene.eraser = scene.make.image({ key: 'eraserBrush', add: false });
    scene.brushRadius = (160 + ((window.brushLevel - 1) * 30)) / 2;

    scene.cameras.main.startFollow(scene.player, true, 0.08, 0.08);
}

export function updatePlayerMovement(scene, time, joy) {
    if (joy.active) {
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
        let alpha = i / 20;
        scene.playerTrail.lineStyle(12 * alpha, window.hasTrident ? 0xffff00 : 0x00ffcc, alpha * 0.8);
        scene.playerTrail.beginPath();
        scene.playerTrail.moveTo(p1.x, p1.y);
        scene.playerTrail.lineTo(p2.x, p2.y);
        scene.playerTrail.strokePath();
    }

    if (scene.player.lightGlow) {
        scene.player.lightGlow.x = scene.player.x;
        scene.player.lightGlow.y = scene.player.y;
    }

    // EFFACEMENT DE VASE
    scene.pollutedLayer.erase(scene.eraser, scene.player.x, scene.player.y);

    let pointsCleanedThisFrame = 0;
    if (joy.active) {
        for (let i = 0; i < scene.pollutionSpots.length; i++) {
            let spot = scene.pollutionSpots[i];
            if (!spot.cleaned) {
                if (Math.abs(spot.x - scene.player.x) < scene.brushRadius &&
                    Math.abs(spot.y - scene.player.y) < scene.brushRadius) {
                    if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, spot.x, spot.y) < scene.brushRadius) {
                        spot.cleaned = true;
                        pointsCleanedThisFrame++;
                    }
                }
            }
        }
    }

    if (pointsCleanedThisFrame > 0) {
        scene.cleanedPollution += pointsCleanedThisFrame;
        scene.updateProgressUI();
        if (window.Haptics) {
            window.Haptics.impact({ style: 'LIGHT' }).catch(() => { });
        }
    }

    // BOUSSOLE
    let ratioCleaned = scene.cleanedPollution / scene.totalPollution;
    if (ratioCleaned > 0.85 && ratioCleaned < 1 && scene.pollutionSpots.length > 0) {
        let nearestSpot = null;
        let minDist = Infinity;
        for (let i = 0; i < scene.pollutionSpots.length; i++) {
            let spot = scene.pollutionSpots[i];
            if (!spot.cleaned) {
                let d = Math.abs(spot.x - scene.player.x) + Math.abs(spot.y - scene.player.y);
                if (d < minDist) { minDist = d; nearestSpot = spot; }
            }
        }

        if (nearestSpot) {
            scene.compassSprite.setVisible(true);
            let angle = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, nearestSpot.x, nearestSpot.y);
            scene.compassSprite.x = scene.player.x + Math.cos(angle) * 120;
            scene.compassSprite.y = scene.player.y + Math.sin(angle) * 120;
            scene.compassSprite.rotation = angle;
            scene.compassSprite.setScale(1 + Math.sin(time / 200) * 0.2);
        } else {
            scene.compassSprite.setVisible(false);
        }
    } else {
        if (scene.compassSprite) scene.compassSprite.setVisible(false);
    }
}

export function castMagicShockwave(scene) {
    if (window.magicCharges <= 0 || scene.isGameFinished) return;

    window.magicCharges--;
    window.updateGameUI();
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
        duration: window.hasTrident ? 1200 : 800,
        ease: 'Cubic.easeOut', onComplete: () => ring.destroy()
    });

    let ptOptions = {
        x: scene.player.x, y: scene.player.y,
        speed: { min: window.hasTrident ? 500 : 300, max: window.hasTrident ? 1000 : 600 },
        angle: { min: 0, max: 360 },
        scale: { start: window.hasTrident ? 4 : 2, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: window.hasTrident ? 1500 : 1000,
        blendMode: 'ADD'
    };
    if (window.hasTrident) {
        ptOptions.tint = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
    }

    const explosion = scene.add.particles('sparkle').createEmitter(ptOptions);
    explosion.explode(window.hasTrident ? 300 : 80);
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

    // Purifier
    let pointsCleanedByMagic = 0;
    if (!scene.textures.exists('hugeBrush')) {
        const bigBrush = scene.make.graphics({ x: 0, y: 0, add: false });
        bigBrush.fillStyle(0xffffff, 1); bigBrush.fillCircle(100, 100, 100);
        bigBrush.generateTexture('hugeBrush', 200, 200); bigBrush.destroy();
    }
    let t_brush = scene.make.image({ key: 'hugeBrush', add: false });

    for (let i = 0; i < scene.pollutionSpots.length; i++) {
        let spot = scene.pollutionSpots[i];
        if (!spot.cleaned && Phaser.Math.Distance.Between(scene.player.x, scene.player.y, spot.x, spot.y) < shockRadius) {
            spot.cleaned = true;
            pointsCleanedByMagic++;
            scene.pollutedLayer.erase(t_brush, spot.x, spot.y);
        }
    }
    t_brush.destroy();

    if (pointsCleanedByMagic > 0) {
        scene.cleanedPollution += pointsCleanedByMagic;
        let floatingText = scene.add.text(scene.player.x, scene.player.y - 50,
            (window.getStr ? window.getStr('msgEnemyDefeated') : 'Ennemis purifiés ! -') + Math.floor((pointsCleanedByMagic / scene.totalPollution) * 100) + '%',
            { fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#00ffaa' }
        ).setOrigin(0.5);

        scene.tweens.add({
            targets: floatingText, y: floatingText.y - 100, alpha: 0,
            duration: 2500, onComplete: () => floatingText.destroy()
        });
        scene.updateProgressUI();
    }
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

    let pointsCleanedByRay = 0;
    let minX = Math.min(startX, endX);
    let maxX = Math.max(startX, endX);

    for (let i = 0; i < scene.pollutionSpots.length; i++) {
        let spot = scene.pollutionSpots[i];
        if (!spot.cleaned) {
            if (spot.x >= minX && spot.x <= maxX && spot.y >= topY && spot.y <= bottomY) {
                spot.cleaned = true;
                pointsCleanedByRay++;
            }
        }
    }

    if (pointsCleanedByRay > 0) {
        scene.cleanedPollution += pointsCleanedByRay;
        scene.updateProgressUI();

        let rectBrushInfos = scene.make.graphics({ x: 0, y: 0, add: false });
        rectBrushInfos.fillStyle(0xffffff, 1);
        rectBrushInfos.fillRect(0, 0, rayLength, rayHeightHalf * 2);
        rectBrushInfos.generateTexture('rayBrush', rayLength, rayHeightHalf * 2);

        let brushSpr = scene.make.image({ key: 'rayBrush', add: false });
        let centerX = startX + (isRight ? rayLength / 2 : -rayLength / 2);
        scene.pollutedLayer.erase(brushSpr, centerX, scene.player.y);

        let floatText = scene.add.text(centerX, scene.player.y - 80, "PURIFIÉ !", { fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#00ffff' }).setOrigin(0.5);
        scene.tweens.add({ targets: floatText, y: floatText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatText.destroy() });
    }
}
