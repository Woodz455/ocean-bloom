import { configurePlayer, updatePlayerMovement, castMagicShockwave, firePurifyingRay } from '../entities/Player.js';
import { generateEnvironment, updateBackgroundFishes } from '../managers/LevelGenerator.js';
import { spawnBoss, updateBossAI } from '../entities/Enemies.js';
import { summonMalik, updateMalik, castDolphinUltimate, updateHelperFishes } from '../entities/Allies.js';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        if (typeof window.loadGameAssets === 'function') {
            window.loadGameAssets(this);
        }
        this.load.image('mimi', 'assets/sprites/mimi.png');
        this.load.image('malik', 'assets/sprites/malik.png');
        this.load.image('anais', 'assets/sprites/anais.png');
    }

    create() {
        if (window.currentLevel % 4 === 0 && window.currentLevel > 0) {
            this.scene.start('ChaseScene');
            return;
        }

        let uiLayer = document.getElementById('ui-layer');
        if (uiLayer && uiLayer.style.display === 'none') {
            uiLayer.style.display = '';
            setTimeout(() => uiLayer.style.opacity = '1', 50);
        }
        let joystickWrapper = document.getElementById('joystick-wrapper');
        if (joystickWrapper && joystickWrapper.style.display === 'none') {
            joystickWrapper.style.display = '';
            setTimeout(() => joystickWrapper.style.opacity = '1', 50);
        }

        const sizeBonus = Math.pow(window.currentLevel, 1.4) * 300;
        const levelW = 2000 + sizeBonus;
        const levelH = 2000 + sizeBonus;
        this.physics.world.setBounds(0, 0, levelW, levelH);

        window.gameReady = true;
        window.sessionPearls = 0;
        window.magicCharges = 0;
        window.playerToxicity = 0;
        const toxUI = document.getElementById('toxicity-fill');
        if (toxUI) toxUI.style.width = '0%';
        window.updateGameUI();

        // 1. GÉNÉRATION
        generateEnvironment(this, levelW, levelH);

        // 2. JOUEUR
        configurePlayer(this, levelW, levelH);

        // Collisions du joueur
        this.physics.add.collider(this.player, this.obstacles);

        this.physics.add.overlap(this.player, this.trashes, (p, trash) => {
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                this.player.currentSpeed = this.player.baseSpeed * 0.3;
                this.cameras.main.shake(200, 0.01);
                if (window.playHurtSound) window.playHurtSound();
                this.addToxicity(20);
                this.time.delayedCall(2500, () => {
                    this.player.clearTint();
                    this.player.isStunned = false;
                    this.player.currentSpeed = this.player.baseSpeed;
                    if (window.playRecoverSound) window.playRecoverSound();
                });
            }
        });

        this.physics.add.overlap(this.player, this.pearls, (p, pearl) => {
            pearl.destroy();
            this.player.setTint(0xffff00);
            this.player.currentSpeed = this.player.baseSpeed * 1.8;
            if (window.playPowerupSound) window.playPowerupSound();

            window.sessionPearls++; 
            window.pearlsSinceLastCharge++;
            if (window.pearlsSinceLastCharge >= 3) {
                window.magicCharges++;
                window.pearlsSinceLastCharge = 0;
                if (window.playMagicChargeSound) window.playMagicChargeSound();
            }
            window.updateGameUI();
            this.addToxicity(-10);

            this.time.delayedCall(3500, () => {
                if (!this.player.isStunned) {
                    this.player.clearTint();
                    this.player.currentSpeed = this.player.baseSpeed;
                    if (window.playRecoverSound) window.playRecoverSound();
                }
            });
        });

        this.physics.add.overlap(this.player, this.enemyGroup, (p, enemy) => {
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                this.player.currentSpeed = this.player.baseSpeed * 0.2;
                this.cameras.main.shake(300, 0.02);
                if (window.playHurtSound) window.playHurtSound();
                this.addToxicity(30);

                this.time.delayedCall(3000, () => {
                    this.player.clearTint();
                    this.player.isStunned = false;
                    this.player.currentSpeed = this.player.baseSpeed;
                    if (window.playRecoverSound) window.playRecoverSound();
                });
            }
        });

        this.physics.add.overlap(this.player, this.hazards, (p, hazard) => {
            if (hazard.hazardType === 'vent') {
                this.player.setVelocityY(-350);
            } else if (hazard.hazardType === 'mine') {
                if (!this.player.isStunned) {
                    hazard.destroy();
                    const expl = this.add.particles('sparkle').createEmitter({
                        x: p.x, y: p.y, speed: 300, scale: {start:3, end:0}, tint: 0xff0000, lifespan: 500
                    });
                    expl.explode(30);
                    this.cameras.main.shake(500, 0.05);

                    this.player.isStunned = true;
                    this.player.setTint(0xff0000);
                    this.player.currentSpeed = this.player.baseSpeed * 0.1;
                    if (window.playHurtSound) window.playHurtSound();
                    
                    window.sessionPearls = Math.max(0, window.sessionPearls - 10); 
                    window.updateGameUI();
                    this.addToxicity(45);

                    this.time.delayedCall(4000, () => {
                        this.player.clearTint();
                        this.player.isStunned = false;
                        this.player.currentSpeed = this.player.baseSpeed;
                        if (window.playRecoverSound) window.playRecoverSound();
                    });
                }
            }
        });

        this.mimiProjectiles = this.physics.add.group();
        this.bossProjectiles = this.physics.add.group();
        this.lastMimiShot = 0;
        this.lastBossShot = 0;
        
        this.isGameFinished = false;
        window.isGameFinishedGlobally = false;

        // BIND UI WINDOW FUNCTIONS API
        window.triggerMagicShockwave = () => castMagicShockwave(this);
        window.triggerRay = () => { window.fireRay = true; };
        window.triggerMalik = () => summonMalik(this);
        window.triggerDolphinUltimate = () => castDolphinUltimate(this);

        if (window.SplashScreen) window.SplashScreen.hide();
    }

    updateProgressUI() {
        let percentClean = Math.floor((this.cleanedPollution / this.totalPollution) * 100);
        if (percentClean > 100) percentClean = 100;
        let percentPollution = 100 - percentClean;

        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        if (fill) fill.style.width = percentClean + '%';
        if (text) text.innerText = (window.getStr ? window.getStr('uiPollution') : 'POLLUTION: ') + percentPollution + '%';

        if (typeof window.updateAudioPollution === 'function') {
            window.updateAudioPollution(percentPollution / 100);
        }

        if (percentClean >= 90 && !this.isGameFinished) {
            if (!this.bossActive && !window.isBossActiveGlobally) spawnBoss(this);
        }
    }

    addToxicity(amount) {
        if (this.isGameFinished) return;
        window.playerToxicity += amount;
        if (window.playerToxicity < 0) window.playerToxicity = 0;
        if (window.playerToxicity > 100) window.playerToxicity = 100;

        const toxUI = document.getElementById('toxicity-fill');
        if (toxUI) toxUI.style.width = window.playerToxicity + '%';

        if (window.playerToxicity >= 100) {
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.isGameFinished = true;
        this.player.isStunned = true;
        this.player.setVelocity(0);
        this.cameras.main.fade(3000, 0, 0, 0);

        let failText = this.add.text(this.player.x, this.player.y - 100, "L'OCÉAN SUCCOMBE...", {
             fontFamily: '"Press Start 2P"', fontSize: '18px', fill: '#ff0000', align: 'center', stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(100).setAlpha(0);

        this.tweens.add({ targets: failText, alpha: 1, y: failText.y - 50, duration: 2500 });
        if (window.playHurtSound) window.playHurtSound();

        this.time.delayedCall(4000, () => {
            window.playerToxicity = 0;
            this.scene.restart();
        });
    }

    winGame() {
        this.isGameFinished = true;
        window.isGameFinishedGlobally = true;
        window.updateGameUI(); 

        if (window.Haptics) window.Haptics.vibrate().catch(() => { });

        this.player.setVelocity(0);
        this.pollutedLayer.alpha = 0; 

        let bonus = window.currentLevel * 5;
        window.totalPearls += window.sessionPearls + bonus;
        window.currentLevel += 1;
        window.saveProgress();

        document.getElementById('victory-pearls').innerText = window.sessionPearls;
        document.getElementById('victory-bonus').innerText = bonus;

        if (window.currentLevel >= 11) {
            if (typeof window.playCinematicChime === 'function') window.playCinematicChime(0);
            const credits = document.getElementById('credits-screen');
            if (credits) { credits.style.display = 'flex'; setTimeout(() => { credits.style.opacity = '1'; }, 50); }
        } else if ((window.currentLevel - 1) % 4 === 0 && window.currentLevel > 1) {
            document.getElementById('big-love-modal').classList.add('active');
        } else if (window.currentLevel === 6 && !window.hasTrident) {
            this.triggerInlineCinematic();
        } else {
            document.getElementById('big-love-modal').classList.add('active');
        }
    }

    triggerInlineCinematic() {
        window.joystickData.active = false;
        this.player.setVelocity(0);
        this.player.isStunned = true; 

        this.cameras.main.stopFollow();
        this.cameras.main.pan(this.player.x, this.player.y, 2000, 'Sine.easeInOut');
        this.cameras.main.zoomTo(1.5, 2000, 'Sine.easeInOut');

        this.time.delayedCall(2000, () => {
            this.nana = this.add.sprite(this.player.x, this.player.y - 300, 'nana').setScale(window.charScale).setDepth(30);

            this.tweens.add({
                targets: this.nana,
                y: this.player.y - 80,
                duration: 3000,
                ease: 'Sine.easeOut',
                onComplete: () => this.showCinematicDialogue()
            });
        });
    }

    showCinematicDialogue() {
        const bg = this.add.graphics().setDepth(31);
        bg.fillStyle(0x001e36, 0.9);
        bg.lineStyle(2, 0x00ffff, 1);
        bg.fillRoundedRect(this.player.x - 120, this.player.y - 160, 240, 60, 10);
        bg.strokeRoundedRect(this.player.x - 120, this.player.y - 160, 240, 60, 10);
        bg.setAlpha(0);

        const text = this.add.text(this.player.x, this.player.y - 130, "Merci de m'avoir libérée !\nTa bravoure mérite ceci.", {
            fontFamily: '"Press Start 2P"', fontSize: '8px', fill: '#ffffff', align: 'center', lineSpacing: 5
        }).setOrigin(0.5).setDepth(32).setAlpha(0);

        this.tweens.add({ targets: [bg, text], alpha: 1, duration: 1000 });

        this.time.delayedCall(4000, () => {
            this.tweens.add({ targets: [bg, text], alpha: 0, duration: 500 });
            this.summonTridentInline();
        });
    }

    summonTridentInline() {
        const particles = this.add.particles('sparkle');
        particles.setDepth(35);
        const sparkleEmitter = particles.createEmitter({
            x: this.player.x, y: this.player.y - 80,
            speed: { min: 20, max: 80 }, scale: { start: 2, end: 0 },
            lifespan: 1000, frequency: 50, blendMode: 'ADD'
        });

        this.trident = this.add.sprite(this.player.x, this.player.y - 80, 'trident').setScale(0.1).setAlpha(0).setDepth(40);

        this.tweens.add({
            targets: this.trident,
            y: this.player.y - 20,
            scale: 2, alpha: 1, angle: 360,
            duration: 2500, ease: 'Cubic.easeOut',
            onComplete: () => {
                this.time.delayedCall(500, () => {
                    this.tweens.add({
                        targets: this.trident,
                        y: this.player.y, scale: 0.5, duration: 800,
                        onComplete: () => {
                            if (window.Haptics) window.Haptics.vibrate().catch(() => { });
                            if (typeof window.playPowerupSound === 'function') window.playPowerupSound();

                            this.cameras.main.flash(1000, 0, 255, 255); 
                            this.trident.destroy();
                            sparkleEmitter.stop();

                            this.tweens.add({ targets: this.nana, alpha: 0, y: this.nana.y - 100, duration: 1500 });
                            this.cameras.main.zoomTo(1, 1500, 'Sine.easeInOut');

                            this.time.delayedCall(1500, () => {
                                window.hasTrident = true;
                                localStorage.setItem('oceanBloomTrident', 'true');
                                this.player.isStunned = false;
                                document.getElementById('big-love-modal').classList.add('active'); 
                            });
                        }
                    });
                });
            }
        });
    }

    update(time, delta) {
        if (this.isGameFinished) return;

        if (window.fireRay) {
            window.fireRay = false;
            this.lastRayTime = this.lastRayTime || 0;
            if (window.hasTrident && time > this.lastRayTime && !this.player.isStunned) {
                firePurifyingRay(this, time);
            }
        }

        const joy = window.joystickData || { active: false, x: 0, y: 0 };
        updatePlayerMovement(this, time, joy);
        updateBackgroundFishes(this, time);
        updateHelperFishes(this);
        updateMalik(this, time, delta);
        updateBossAI(this, time);
    }
}
