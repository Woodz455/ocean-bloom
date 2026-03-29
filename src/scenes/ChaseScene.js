// --- NOUVELLE SCÈNE POUR LA COURSE (PHASE 6) ---
export default class ChaseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ChaseScene' });
    }

    create() {
        // FIX STATE MANAGEMENT: Réinitialiser les perles de session en entrant en course
        window.sessionPearls = 0;

        // Interface minimale (on cache la barre de boss et pollution)
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('boss-ui-container').style.display = 'none';

        let titleStr = window.getStr ? window.getStr('chaseTitle') : "VOLEUR EN FUITE !";
        let descStr = window.getStr ? window.getStr('chaseDesc') : "Poursuis-le !";

        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;
        const screenH = this.game.config.height;
        const screenW = this.game.config.width;

        // Musique agressive pour la poursuite
        if (typeof window.startBossMusic === 'function') window.startBossMusic();

        // Le monde est un très très long couloir horizontal
        const trackLength = 99000;
        this.physics.world.setBounds(0, 0, trackLength, screenH);
        this.cameras.main.setBounds(0, 0, trackLength, screenH);

        // --- A. FOND OCÉANIQUE TROPICAL ---
        this.cameras.main.setBackgroundColor('#006688');
        this.add.tileSprite(trackLength / 2, screenH / 2, trackLength, screenH, 'chase_ocean_bg').setDepth(0);

        // --- B. RAYONS DE SOLEIL ---
        this.sunRays = [];
        for (let i = 0; i < 8; i++) {
            let ray = this.add.image(screenW * 0.1 + i * (screenW / 5), -20, 'sun_ray');
            ray.setScrollFactor(0.1 + Math.random() * 0.15);
            ray.setDepth(1);
            ray.setAlpha(0.15 + Math.random() * 0.15);
            ray.setScale(1 + Math.random() * 2, 1.5 + Math.random());
            ray.setAngle(-15 - Math.random() * 15);
            ray.setBlendMode(Phaser.BlendModes.ADD);
            this.sunRays.push(ray);
        }

        // --- C. ROCHERS PARALLAXE ---
        for (let x = 0; x < 50000; x += 600 + Math.random() * 400) {
            let topRock = this.add.image(x, -5, 'rock_top');
            topRock.setOrigin(0, 0).setScrollFactor(0.4 + Math.random() * 0.2);
            topRock.setDepth(2).setAlpha(0.4).setScale(1.5 + Math.random());
            topRock.setFlipX(Math.random() > 0.5);

            let botRock = this.add.image(x + 300, screenH + 5, 'rock_bottom');
            botRock.setOrigin(0, 1).setScrollFactor(0.4 + Math.random() * 0.2);
            botRock.setDepth(2).setAlpha(0.4).setScale(1.5 + Math.random());
            botRock.setFlipX(Math.random() > 0.5);
        }

        for (let x = 200; x < 50000; x += 800 + Math.random() * 600) {
            let topR = this.add.image(x, -5, 'rock_top');
            topR.setOrigin(0, 0).setScrollFactor(0.7 + Math.random() * 0.15);
            topR.setDepth(5).setAlpha(0.7).setScale(1 + Math.random() * 0.5);
            topR.setFlipX(Math.random() > 0.5);

            let botR = this.add.image(x + 400, screenH + 5, 'rock_bottom');
            botR.setOrigin(0, 1).setScrollFactor(0.7 + Math.random() * 0.15);
            botR.setDepth(5).setAlpha(0.7).setScale(1 + Math.random() * 0.5);
            botR.setFlipX(Math.random() > 0.5);
        }

        // --- D. ALGUES ---
        for (let x = 0; x < 50000; x += 150 + Math.random() * 200) {
            let kelp = this.add.image(x, screenH - 10, 'chase_kelp');
            kelp.setOrigin(0.5, 1).setScrollFactor(0.5 + Math.random() * 0.3);
            kelp.setDepth(3).setAlpha(0.5 + Math.random() * 0.3);
            kelp.setScale(0.8 + Math.random() * 1.2);
            kelp.setTint(Math.random() > 0.5 ? 0x00ff88 : 0x00cc66);
            this.tweens.add({
                targets: kelp, angle: { from: -8, to: 8 },
                duration: 1500 + Math.random() * 1500,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        }

        // --- E. POISSONS DÉCORATIFS ---
        this.chaseFish = [];
        for (let i = 0; i < 30; i++) {
            let keys = ['fish_orange', 'fish_blue'];
            let fish = this.add.sprite(
                Math.random() * screenW * 3,
                Math.random() * (screenH - 100) + 50,
                keys[Math.floor(Math.random() * keys.length)]
            );
            fish.setScrollFactor(0.3 + Math.random() * 0.4);
            fish.setDepth(4).setAlpha(0.3 + Math.random() * 0.4);
            fish.setScale(0.5 + Math.random() * 0.8);
            fish.customSpeed = 1 + Math.random() * 2;
            if (Math.random() > 0.3) {
                fish.customSpeed *= -1;
            } else {
                fish.setFlipX(true);
            }
            this.chaseFish.push(fish);
        }

        // --- F. VAGUES PARALLAXE ---
        this.currentH = screenH;
        this.parallaxWaves = [];
        const waveColors = [0x00ccaa, 0x00aacc, 0x0088aa];
        for (let i = 0; i < 3; i++) {
            let pWave = this.add.graphics();
            pWave.setScrollFactor(0.2 + (i * 0.3));
            pWave.setDepth(6 + i);
            pWave.alpha = 0.25 - (i * 0.05);
            this.parallaxWaves.push({
                gfx: pWave, offset: i * 1000, speed: 0.5 + i * 0.5,
                color: waveColors[i]
            });
        }

        // --- G. PARTICULES ATMOSPHÉRIQUES ---
        if (!this.textures.exists('plankton')) {
            const planktonGfx = this.make.graphics({ x: 0, y: 0, add: false });
            planktonGfx.fillStyle(0xaaffcc, 1);
            planktonGfx.fillCircle(2, 2, 2);
            planktonGfx.generateTexture('plankton', 4, 4);
            planktonGfx.destroy();
        }

        this.add.particles('plankton').createEmitter({
            x: { min: 0, max: screenW },
            y: { min: 0, max: screenH },
            speedX: { min: -30, max: -80 },
            speedY: { min: -10, max: 10 },
            scale: { min: 0.3, max: 1 },
            alpha: { start: 0.4, end: 0 },
            lifespan: 5000,
            frequency: 200,
            blendMode: 'ADD'
        }).setScrollFactor(0);

        this.bubbleEmitter = this.add.particles('bubble').createEmitter({
            x: { min: screenW, max: screenW + 200 },
            y: { min: 0, max: screenH },
            speedX: { min: -100, max: -300 },
            speedY: { min: -20, max: 20 },
            scale: { min: 0.1, max: 0.8 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 4000, frequency: 100
        });
        this.bubbleEmitter.setScrollFactor(0);

        // --- H. SILLAGE DU JOUEUR (Speed trail) ---
        this.playerTrail = this.add.particles('sparkle').createEmitter({
            speed: { min: 5, max: 20 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 400, frequency: 30,
            blendMode: 'ADD', tint: 0x00ffcc, on: true
        });

        // Textes d'instruction
        let info = this.add.text(cx, cy, titleStr + "\n" + descStr, {
            fontFamily: '"Press Start 2P"', fontSize: '14px', fill: '#ff5555', align: 'center', backgroundColor: 'rgba(0,0,0,0.5)'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.tweens.add({ targets: info, alpha: 0, delay: 3000, duration: 1000 });

        // Joueur
        this.player = this.physics.add.sprite(200, cy, 'mermaid1');
        this.player.setScale(window.charScale);
        this.player.setFlipX(true);
        this.player.setDepth(20).setCollideWorldBounds(true);
        this.player.baseSpeed = 400 + ((window.speedLevel - 1) * 40);
        this.player.currentSpeed = this.player.baseSpeed;
        this.player.isStunned = false;

        // Progression
        this.thievesCaught = 0;
        this.thievesToCatch = 4;
        this.targetHit = false;

        let scoreStr = window.getStr && window.getStr('chaseScore') ? window.getStr('chaseScore') : "VOLEURS : ";
        this.scoreText = this.add.text(20, 20, scoreStr + "0/" + this.thievesToCatch, {
            fontFamily: '"Press Start 2P"', fontSize: '18px', fill: '#ffff00', backgroundColor: 'rgba(0,0,0,0.5)'
        }).setOrigin(0).setScrollFactor(0).setDepth(100);

        this.scrollSpeed = 4 + (window.currentLevel * 0.5);
        this.spawnNextThief();

        // Obstacles
        this.mines = this.physics.add.group();
        this.pearls = this.physics.add.group();

        for (let x = 1000; x < 50000; x += (400 - window.currentLevel * 5)) {
            let y = Math.random() * (screenH - 100) + 50;
            if (Math.random() > 0.6) {
                let p = this.pearls.create(x, y, 'pearl').setDepth(15);
                this.tweens.add({ targets: p, scale: 1.5, yoyo: true, repeat: -1, duration: 500 });
            } else {
                let m = this.mines.create(x, y + Math.random() * 100 - 50, 'mine').setDepth(15).setTint(0xff5555);
                this.tweens.add({ targets: m, y: m.y + (Math.random() > 0.5 ? 50 : -50), yoyo: true, repeat: -1, duration: 1500 });
            }
        }

        this.joystickData = window.joystickData;

        // Collisions
        this.physics.add.overlap(this.player, this.mines, (p, m) => {
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                this.cameras.main.shake(200, 0.02);
                if (window.playHurtSound) window.playHurtSound();
                this.player.x -= 150;
                this.time.delayedCall(1500, () => {
                    this.player.clearTint();
                    this.player.isStunned = false;
                });
            }
        });

        this.physics.add.overlap(this.player, this.pearls, (p, pearl) => {
            pearl.destroy();
            if (window.playPowerupSound) window.playPowerupSound();
            this.player.x += 100;
            this.cameras.main.flash(200, 255, 255, 0);
            window.sessionPearls++;
            document.getElementById('session-pearls').innerText = window.sessionPearls;
        });

    }

    spawnNextThief() {
        if (this.targetHit) return;
        let camRight = this.cameras.main.scrollX + this.game.config.width;
        this.target = this.physics.add.sprite(camRight + 150, this.game.config.height / 2, 'thief');
        this.target.setDepth(20).setCollideWorldBounds(false);
        this.target.isActiveTarget = true;
        this.target.baseY = Math.random() * (this.game.config.height - 150) + 75;
    }

    update(time, delta) {
        if (this.targetHit) return;

        let camLeft = this.cameras.main.scrollX;
        let camRight = camLeft + this.game.config.width;

        this.cameras.main.scrollX += this.scrollSpeed;

        this.parallaxWaves.forEach((w, index) => {
            w.gfx.clear();
            w.gfx.fillStyle(w.color, 1);
            w.gfx.beginPath();
            w.gfx.moveTo(-2000 + camLeft, this.currentH);
            for (let x = -2000 + camLeft; x < camRight + 2000; x += 100) {
                let y = (this.currentH / 2) + Math.sin((x + time * w.speed + w.offset) / 300) * (50 + index * 20) + (index * 80);
                w.gfx.lineTo(x, y);
            }
            w.gfx.lineTo(camRight + 2000, this.currentH);
            w.gfx.closePath();
            w.gfx.fillPath();
        });

        if (this.chaseFish) {
            this.chaseFish.forEach(fish => {
                fish.x += fish.customSpeed;
                let fishScreenX = fish.x - camLeft * fish.scrollFactorX;
                if (fishScreenX < -100) fish.x += this.game.config.width + 200;
                if (fishScreenX > this.game.config.width + 100) fish.x -= this.game.config.width + 200;
            });
        }

        if (this.playerTrail) {
            this.playerTrail.setPosition(this.player.x - 20, this.player.y);
        }

        if (this.sunRays) {
            this.sunRays.forEach((ray, i) => {
                ray.setAlpha(0.1 + Math.sin(time / 2000 + i) * 0.08);
            });
        }

        if (this.target && this.target.isActiveTarget) {
            this.target.x += this.scrollSpeed * 0.90;
            this.target.y = this.target.baseY + Math.sin(time / 200) * 150;
            if (this.target.x > camRight - 80) this.target.x = camRight - 80;

            let dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
            if (dist < 80) { 
                this.target.isActiveTarget = false;
                this.target.destroy();

                this.thievesCaught++;
                let scoreStr = window.getStr && window.getStr('chaseScore') ? window.getStr('chaseScore') : "VOLEURS : ";
                this.scoreText.setText(scoreStr + this.thievesCaught + "/" + this.thievesToCatch);

                this.cameras.main.flash(500, 255, 255, 0);
                if (window.playEnemyDefeatSound) window.playEnemyDefeatSound();

                if (this.thievesCaught >= this.thievesToCatch) {
                    this.targetHit = true;
                    this.winChase();
                } else {
                    this.time.delayedCall(1500, () => {
                        if (!this.targetHit) this.spawnNextThief();
                    });
                }
            }
            else if (this.target.x < camLeft - 50) {
                this.target.isActiveTarget = false;
                this.target.destroy();
                this.cameras.main.flash(200, 255, 0, 0); 
                this.time.delayedCall(1000, () => {
                    if (!this.targetHit) this.spawnNextThief();
                });
            }
        }

        this.mines.children.each((mine) => {
            if (mine.active && mine.x < camLeft - 200) mine.destroy();
        });

        this.pearls.children.each((pearl) => {
            if (pearl.active && pearl.x < camLeft - 200) pearl.destroy();
        });

        if (!this.player.isStunned) {
            if (this.joystickData && this.joystickData.active) {
                this.player.anims.play('swim', true);
                this.player.setVelocityX(this.joystickData.x * this.player.currentSpeed);
                this.player.setVelocityY(this.joystickData.y * this.player.currentSpeed);
                
                let targetRotation = this.joystickData.y * 0.4;
                if (this.player.flipX) targetRotation *= -1; 
                let swimWobble = Math.sin(time / 80) * 0.15;
                this.player.rotation = Phaser.Math.Linear(this.player.rotation, targetRotation + swimWobble, 0.2);
                let stretchPulse = Math.sin(time / 100) * 0.05;
                this.player.setScale(window.charScale * (1.05 + stretchPulse), window.charScale * (0.95 - stretchPulse));
            } else {
                this.player.anims.stop();
                this.player.setTexture('mermaid1');

                this.player.setVelocityX(0); 
                this.player.setVelocityY(Math.sin(time / 300) * 20); 
                this.player.rotation = Phaser.Math.Linear(this.player.rotation, 0, 0.1);
                this.player.setScale(window.charScale);
            }
        }

        if (this.player.x < camLeft + 20) {
            this.player.x = camLeft + 20;
            this.cameras.main.shake(100, 0.01);
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                if (window.playHurtSound) window.playHurtSound();
                this.time.delayedCall(1000, () => { this.player.clearTint(); this.player.isStunned = false; });
            }
        }

        if (this.player.x > camRight - 20) {
            this.player.x = camRight - 20;
        }
    }

    winChase() {
        this.player.setVelocity(0);
        this.cameras.main.flash(1500, 255, 255, 255);
        if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();

        if (window.Haptics) {
            window.Haptics.vibrate().catch(() => { });
        }

        this.target.destroy();

        let winText = this.add.text(this.cameras.main.scrollX + this.game.config.width / 2, this.game.config.height / 2, window.getStr && window.getStr("chaseWin") ? window.getStr("chaseWin") : "GAGNÉ !", {
            fontFamily: '"Press Start 2P"', fontSize: '20px', fill: '#00ffff'
        }).setOrigin(0.5).setDepth(100);

        this.time.delayedCall(3000, () => {
            document.getElementById('progress-container').style.display = 'block'; 

            window.isGameFinishedGlobally = true;
            window.updateGameUI(); 

            let bonus = window.currentLevel * 10; 
            window.totalPearls += window.sessionPearls + bonus;
            window.currentLevel += 1; 
            window.saveProgress();

            document.getElementById('victory-pearls').innerText = window.sessionPearls;
            document.getElementById('victory-bonus').innerText = bonus;

            document.getElementById('big-love-modal').classList.add('active');
        });
    }
}
