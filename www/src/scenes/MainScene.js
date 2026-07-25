import { configurePlayer, updatePlayerMovement, castMagicShockwave, firePurifyingRay, castPearlShield, defeatPlayer } from '../entities/Player.js';
import { generateEnvironment, updateBackgroundFishes } from '../managers/LevelGenerator.js';
import { spawnBoss, updateBossAI } from '../entities/Enemies.js';
import { summonMalik, updateMalik, castDolphinUltimate, updateHelperFishes, summonAnais, updateAnais } from '../entities/Allies.js';
import { GameState } from '../managers/GameState.js';

export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        if (typeof window.loadGameAssets === 'function') {
            window.loadGameAssets(this);
        }
        // Les trois PNG chargés ici ne servaient à rien : 'mimi' et 'anais' n'étaient
        // utilisés comme clé de sprite nulle part, et 'malik' entrait en collision avec
        // la texture procédurale du même nom (le loader la refusait en silence).
        // 418 Ko téléchargés pour rien à chaque lancement. Le jeu est 100 % procédural.
    }

    create() {
        if (window.currentLevel % 4 === 0 && window.currentLevel > 0) {
            this.scene.start('ChaseScene');
            return;
        }

        if (typeof window.applyMotionPreferences === 'function') window.applyMotionPreferences(this);

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

        // PLAFOND DE TAILLE — contrainte matérielle, pas esthétique.
        // La formule d'origine donnait 9536 px au niveau 10, soit une RenderTexture de
        // pollution de 9536² × 4 octets = 364 Mo. Deux problèmes distincts :
        //  - GL_MAX_TEXTURE_SIZE vaut 4096 px sur beaucoup d'Android d'entrée de gamme
        //    et 8192 sur la majorité du parc : au-delà, l'allocation échoue et le
        //    contexte WebGL est perdu (écran noir).
        //  - 364 Mo de VRAM pour une seule texture est hors de portée d'un téléphone.
        // 4000 px reste sous la limite la plus basse et ramène la texture à ~64 Mo.
        // Ce n'est qu'un garde-fou : le vrai correctif est de découper la couche de
        // pollution en tuiles et de n'allouer que celles proches de la caméra.
        const MAX_LEVEL_SIZE = 4000;
        const sizeBonus = Math.pow(window.currentLevel, 1.4) * 300;
        const levelW = Math.min(2000 + sizeBonus, MAX_LEVEL_SIZE);
        const levelH = Math.min(2000 + sizeBonus, MAX_LEVEL_SIZE);
        this.physics.world.setBounds(0, 0, levelW, levelH);

        window.gameReady = true;
        GameState.init();
        GameState.resetSession();

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
                this.player.currentSpeed = this.player.baseSpeed * 0.5;
                this.cameras.main.shake(100, 0.01);
                if (window.playHurtSound) window.playHurtSound();
                this.time.delayedCall(1000, () => {
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

            GameState.addPearl();

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
                this.player.currentSpeed = this.player.baseSpeed * 0.4;
                this.cameras.main.shake(150, 0.02);
                if (window.playHurtSound) window.playHurtSound();

                if (this.damagePlayer(1)) return;

                this.time.delayedCall(1500, () => {
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
                    const particleManager = this.add.particles('sparkle');
                    particleManager.setDepth(25);
                    const expl = particleManager.createEmitter({
                        x: p.x, y: p.y, speed: 300, scale: {start:3, end:0}, tint: 0xff0000, lifespan: 500
                    });
                    expl.explode(30);
                    this.time.delayedCall(1000, () => particleManager.destroy());
                    this.cameras.main.shake(500, 0.05);

                    this.player.isStunned = true;
                    this.player.setTint(0xff0000);
                    this.player.currentSpeed = this.player.baseSpeed * 0.2;
                    if (window.playHurtSound) window.playHurtSound();
                    
                    GameState.losePearls(5);
                    if (this.damagePlayer(1)) return;

                    this.time.delayedCall(2000, () => {
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
        GameState.isGameFinished = false;

        // BIND UI WINDOW FUNCTIONS API
        window.triggerMagicShockwave = () => castMagicShockwave(this);
        window.triggerRay = () => { window.fireRay = true; };
        window.triggerMalik = () => summonMalik(this);
        window.triggerDolphinUltimate = () => castDolphinUltimate(this);
        window.triggerAnais = () => summonAnais(this);
        window.triggerPearlShield = () => castPearlShield(this);

        if (window.SplashScreen) window.SplashScreen.hide();
    }

    // Applique des dégâts hors combat de boss (ennemis, mines) et affiche le retrait.
    // Renvoie true si le coup était fatal, pour que l'appelant s'arrête là.
    damagePlayer(amount) {
        const fatal = GameState.damage(amount);

        let txt = this.add.text(this.player.x, this.player.y - 40, '-' + amount + '❤️', {
            fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#ff5e8a', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(41);
        this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });

        if (fatal) defeatPlayer(this);
        return fatal;
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

    winGame() {
        this.isGameFinished = true;
        GameState.finishGame();

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
                            this.time.delayedCall(1500, () => particles.destroy());

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
        updateAnais(this, time);
        updateBossAI(this, time);
    }
}
