// --- GESTION DES ENNEMIS ET DU BOSS ---
export function spawnBoss(scene) {
    scene.bossActive = false; 
    window.isBossActiveGlobally = true;

    scene.enemies.forEach(e => e.destroy());
    scene.enemies = [];
    scene.trashes.clear(true, true);
    scene.totalPollution = 1; 

    if (typeof window.startBossMusic === 'function') window.startBossMusic();

    scene.cameras.main.flash(500, 255, 0, 0); 
    scene.pollutedLayer.fill(0x330000, 0.95); 
    scene.pollutedLayer.setDepth(5);
    scene.pollutedLayer.alpha = 1;

    let cx = scene.physics.world.bounds.width / 2;
    let cy = scene.physics.world.bounds.height / 2;

    let bossAsset = 'boss_vase';
    let bossName = window.getStr ? window.getStr('uiBossVase') : 'MONSTRE DE VASE';
    let bossScaleHP = 1.0;

    let lvl = window.currentLevel || 1;
    if (lvl >= 5) {
        bossAsset = 'boss_petrole';
        bossName = window.getStr ? window.getStr('uiBossPetrole') : 'GEÔLIER DE PÉTROLE';
        bossScaleHP = 3.5; 
    } else if (lvl >= 3) {
        bossAsset = 'boss_plastique';
        bossName = window.getStr ? window.getStr('uiBossPlastique') : 'AMALGAMME DE PLASTIQUE';
        bossScaleHP = 2.0;
    }

    const elBossName = document.getElementById('boss-name');
    if (elBossName) elBossName.innerText = bossName;

    scene.boss = scene.physics.add.sprite(cx, cy - 600, bossAsset);
    scene.boss.setDepth(20);
    scene.boss.setCollideWorldBounds(true);

    scene.boss.maxHp = 3000 + (lvl * 1000 * bossScaleHP);
    scene.boss.hp = scene.boss.maxHp;

    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) progressContainer.style.display = 'none';

    const uiBossContainer = document.getElementById('boss-ui-container');
    if (uiBossContainer) uiBossContainer.style.display = 'block';

    window.updateGameUI(); 

    scene.tweens.add({
        targets: scene.boss,
        y: cy,
        duration: 2500,
        ease: 'Bounce.easeOut',
        onComplete: () => {
            scene.bossActive = true;
            updateBossUI(scene);

            scene.tweens.add({
                targets: scene.boss,
                y: '-=30',
                duration: 1200,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        }
    });

    scene.physics.add.overlap(scene.player, scene.boss, (p, b) => {
        playerTakeDamage(scene, null, true);
    });

    scene.physics.add.overlap(scene.player, scene.bossProjectiles, (p, proj) => {
        playerTakeDamage(scene, proj, false);
    });

    scene.physics.add.overlap(scene.boss, scene.mimiProjectiles, (b, proj) => {
        let isCrit = Math.random() < 0.2;
        let baseDmg = 15 + (window.brushLevel * 5);
        let finalDmg = isCrit ? baseDmg * 2 : baseDmg;
        damageBoss(scene, proj, finalDmg, isCrit);
    });
}

export function updateBossAI(scene, time) {
    if (!scene.bossActive || !scene.boss) return;

    let lvl = window.currentLevel || 1;
    scene.physics.moveToObject(scene.boss, scene.player, 80 + (lvl * 10));

    // Boss shoot
    if (time > scene.lastBossShot) {
        if (typeof window.playBossShootSound === 'function') window.playBossShootSound();
        let proj = scene.bossProjectiles.create(scene.boss.x, scene.boss.y, 'boss_shot');
        proj.setDepth(19);
        scene.physics.moveToObject(proj, scene.player, 250 + (lvl * 20));

        let angle = Phaser.Math.Angle.Between(scene.boss.x, scene.boss.y, scene.player.x, scene.player.y);
        proj.rotation = angle;

        scene.time.delayedCall(4000, () => { if (proj && proj.active) proj.destroy(); });
        scene.lastBossShot = time + Math.max(800, 2000 - (lvl * 100)); 
    }

    // Mimi Auto Shoot
    if (time > scene.lastMimiShot && !scene.player.isStunned) {
        if (typeof window.playShootSound === 'function') window.playShootSound();
        let mProj = scene.mimiProjectiles.create(scene.player.x, scene.player.y, 'mimi_shot');
        mProj.setDepth(19);
        scene.physics.moveToObject(mProj, scene.boss, 600);

        mProj.rotation = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, scene.boss.x, scene.boss.y);
        scene.time.delayedCall(3000, () => { if (mProj && mProj.active) mProj.destroy(); });

        let speedBuff = Math.max(0, (window.speedLevel - 1) * 30);
        scene.lastMimiShot = time + Math.max(200, 500 - speedBuff); 
    }
}

export function playerTakeDamage(scene, proj, severe) {
    if (proj) proj.destroy();
    if (scene.player.isStunned || !scene.bossActive) return;

    scene.player.isStunned = true;
    scene.player.setTint(0xff0000);
    scene.cameras.main.shake(severe ? 800 : 300, severe ? 0.05 : 0.02);
    if (typeof window.playHurtSound === 'function') window.playHurtSound();
    
    if (typeof scene.addToxicity === 'function') {
        scene.addToxicity(severe ? 40 : 25);
    }

    const impactBubbles = scene.add.particles('bubble').createEmitter({
        x: scene.player.x, y: scene.player.y,
        speed: { min: 100, max: 250 },
        scale: { start: 1, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 500
    });
    impactBubbles.explode(20);

    if (window.magicCharges > 0 && (severe || Math.random() > 0.7)) {
        window.magicCharges--;
        window.updateGameUI();

        let floatingText = scene.add.text(scene.player.x, scene.player.y - 30, "-1🌟", { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffff00' })
        scene.tweens.add({ targets: floatingText, y: floatingText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatingText.destroy() });
    }

    scene.time.delayedCall(1500, () => {
        scene.player.clearTint();
        scene.player.isStunned = false;
    });
}

export function damageBoss(scene, proj, amount, isCrit = false) {
    if (proj) {
        let impactX = proj.x;
        let impactY = proj.y;
        proj.destroy();

        let color = isCrit ? 0xffff00 : 0x00ffff;
        let particleAmount = isCrit ? 30 : 10;
        const impactParticles = scene.add.particles('sparkle').createEmitter({
            x: impactX, y: impactY,
            speed: { min: 100, max: isCrit ? 300 : 200 },
            scale: { start: isCrit ? 1.5 : 1, end: 0 },
            tint: color,
            blendMode: 'ADD',
            lifespan: 300
        });
        impactParticles.explode(particleAmount);

        if (isCrit) {
            if (typeof window.playCritSound === 'function') window.playCritSound();
            let floatText = scene.add.text(impactX, impactY - 20, "CRIT!", {
                fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#ffff00', stroke: '#ff0000', strokeThickness: 3
            }).setOrigin(0.5).setDepth(40);
            scene.tweens.add({
                targets: floatText, y: floatText.y - 60, scale: 1.5, alpha: 0,
                duration: 1000, ease: 'Power2',
                onComplete: () => floatText.destroy()
            });
            scene.cameras.main.shake(150, 0.01);
        } else {
            if (typeof window.playHitSound === 'function') window.playHitSound();
        }

        if (scene.bossActive && Math.random() > 0.6) {
            let px = scene.boss.x + (Math.random() * 100 - 50);
            let py = scene.boss.y + (Math.random() * 100 - 50);
            let pearl = scene.pearls.create(px, py, 'pearl');
            pearl.setDepth(15);
            scene.tweens.add({ targets: pearl, scaleX: 1.5, scaleY: 1.5, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
            pearl.setVelocityY(80 + Math.random() * 50);
            pearl.setVelocityX((Math.random() - 0.5) * 100);

            scene.time.delayedCall(8000, () => {
                if (pearl && pearl.active) pearl.destroy();
            });
        }
    }

    if (!scene.boss || scene.boss.hp <= 0) return;

    scene.boss.hp -= amount;
    scene.boss.setTint(isCrit ? 0xffff00 : 0xffffff);
    scene.time.delayedCall(80, () => {
        if (scene.boss) scene.boss.clearTint();
    });

    if (scene.boss.hp <= 0 && scene.bossActive) {
        defeatBoss(scene);
    } else {
        updateBossUI(scene);
    }
}

export function updateBossUI(scene) {
    if (!scene.boss) return;
    let pct = (scene.boss.hp / scene.boss.maxHp) * 100;
    if (pct < 0) pct = 0;
    const fill = document.getElementById('boss-hp-fill');
    if (fill) fill.style.width = pct + '%';
}

function defeatBoss(scene) {
    scene.bossActive = false;
    window.isBossActiveGlobally = false;

    const uiBossContainer = document.getElementById('boss-ui-container');
    if (uiBossContainer) uiBossContainer.style.display = 'none';

    const explosion = scene.add.particles('sparkle').createEmitter({
        x: scene.boss.x, y: scene.boss.y,
        speed: { min: 400, max: 1200 }, scale: { start: 4, end: 0 },
        lifespan: 3000, blendMode: 'ADD'
    });
    explosion.explode(200);

    if (typeof window.playEnemyDefeatSound === 'function') {
        window.playEnemyDefeatSound();
        setTimeout(() => window.playEnemyDefeatSound(), 500); 
    }

    scene.cameras.main.flash(1500, 255, 255, 255);
    scene.cameras.main.shake(2000, 0.05);

    for (let i = 0; i < 40; i++) {
        let px = scene.boss.x + (Math.random() * 500 - 250);
        let py = scene.boss.y + (Math.random() * 500 - 250);
        let pearl = scene.pearls.create(px, py, 'pearl');
        pearl.setDepth(15);
        scene.tweens.add({ targets: pearl, scaleX: 2, scaleY: 2, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
    }

    scene.boss.destroy();
    scene.bossProjectiles.clear(true, true);

    scene.time.delayedCall(4500, () => {
        scene.winGame();
    });
}
