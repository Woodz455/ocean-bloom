import { configurePlayer, updatePlayerMovement, castMagicShockwave, firePurifyingRay, castPearlShield, defeatPlayer } from '../entities/Player.js';
import { generateEnvironment, updateBackgroundFishes } from '../managers/LevelGenerator.js';
import { spawnBoss, updateBossAI } from '../entities/Enemies.js';
import { summonMalik, updateMalik, castDolphinUltimate, updateHelperFishes, summonAnais, updateAnais } from '../entities/Allies.js';
import { GameState } from '../managers/GameState.js';
import { drawVeil, collectSources, resizeVeil } from '../managers/Veil.js';

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

        // Le voile est en coordonnées écran : il doit être redimensionné avec la
        // fenêtre, sinon une rotation de téléphone laisse une bande non couverte.
        this.scale.on('resize', () => resizeVeil(this), this);
        this.events.once('shutdown', () => this.scale.off('resize', undefined, this));

        // Une balise allumée met la jauge à jour immédiatement, et c'est aussi le point
        // où la condition d'apparition du boss est réévaluée.
        this.onBeaconLit = () => this.updateProgressUI();

        // Premier tracé avant la première frame : sans lui, le joueur voit le niveau
        // entier pendant une image avant que le noir ne tombe.
        drawVeil(this, collectSources(this, this.player, GameState.lightRadius()), 0);
        this.updateProgressUI();

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

    // La jauge ne mesure plus un pourcentage de saleté frottée mais la RÉSERVE DE
    // LUMIÈRE, qui bouge en permanence, et le compteur de balises dit où en est le
    // niveau. Un chiffre qui varie d'un instant à l'autre porte la tension ; un
    // pourcentage qui monte de 0,4 % toutes les dix secondes n'en portait aucune.
    updateProgressUI() {
        const total = this.beacons ? this.beacons.length : 0;
        const lit = this.beaconsLit || 0;
        const ratio = GameState.light / GameState.maxLight;

        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        if (fill) {
            fill.style.width = Math.round(ratio * 100) + '%';
            // La barre vire à l'ambre puis au rouge quand la réserve s'épuise : on doit
            // pouvoir lire l'urgence du coin de l'œil, sans quitter le jeu des yeux.
            fill.style.background = ratio > 0.5
                ? 'linear-gradient(90deg, #40e0d0, #b6f58c)'
                : ratio > 0.25
                    ? 'linear-gradient(90deg, #ffb454, #ffe08a)'
                    : 'linear-gradient(90deg, #ff4d6d, #ff9a54)';
        }
        if (text) {
            const label = window.getStr ? window.getStr('uiLight') : 'LUMIÈRE';
            text.innerText = label + ' ' + Math.round(ratio * 100) + '%  ·  ✦ ' + lit + '/' + total;
        }

        // L'audio suivait le taux de pollution ; il suit désormais l'obscurité, ce qui
        // revient au même signal — plus il fait noir, plus la nappe est sourde.
        if (typeof window.updateAudioPollution === 'function') {
            window.updateAudioPollution(1 - ratio);
        }

        // Toutes les balises allumées : le boss surgit. Le seuil de 90 % arbitraire
        // disparaît au profit d'une condition que le joueur voit venir.
        if (total > 0 && lit >= total && !this.isGameFinished) {
            if (!this.bossActive && !window.isBossActiveGlobally) spawnBoss(this);
        }
    }

    winGame() {
        this.isGameFinished = true;
        GameState.finishGame();

        if (window.Haptics) window.Haptics.vibrate().catch(() => { });

        this.player.setVelocity(0);
        // Victoire : le voile se lève entièrement. Le niveau qu'on a traversé à
        // l'aveugle apparaît d'un coup en pleine couleur — c'est la dernière image, et
        // c'est celle qui donne envie du niveau suivant.
        if (this.veil) this.tweens.add({ targets: this.veil, alpha: 0, duration: 1200, ease: 'Sine.easeOut' });

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
        // Zoom RELATIF au zoom de base : celui-ci vaut désormais 2 ou 3 sur un écran
        // d'ordinateur. Les valeurs absolues 1,5 puis 1 auraient dézoomé au lieu de
        // rapprocher, et laissé la scène au mauvais cadrage à la sortie.
        this.baseZoom = this.cameras.main.zoom;
        this.cameras.main.zoomTo(this.baseZoom * 1.5, 2000, 'Sine.easeInOut');

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

        const text = this.add.text(this.player.x, this.player.y - 130, window.getStr('nanaThanks'), {
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
                            this.cameras.main.zoomTo(this.baseZoom || 1, 1500, 'Sine.easeInOut');

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

        // LA RÉSERVE FOND. C'est la seule pression permanente du jeu, et elle s'arrête
        // pendant le combat de boss — celui-ci a déjà sa propre tension, en ajouter une
        // seconde ne ferait que rendre l'affrontement illisible.
        if (!this.bossActive && !window.isBossActiveGlobally) {
            GameState.drainLight(delta);
            // La jauge se rafraîchit dix fois par seconde : assez pour paraître continue,
            // pas assez pour peser sur le DOM à chaque frame.
            if (time - (this.lastGaugeUpdate || 0) > 100) {
                this.lastGaugeUpdate = time;
                this.updateProgressUI();
            }
        }

        updatePlayerMovement(this, time, joy);
        updateBackgroundFishes(this, time);
        updateHelperFishes(this);
        updateMalik(this, time, delta);
        updateAnais(this, time);
        updateBossAI(this, time);

        // LE VOILE, en dernier : il doit être redessiné après que tout ce qui porte une
        // lumière a bougé, sinon le halo traîne d'une frame derrière Mimi.
        drawVeil(this, collectSources(this, this.player, this.playerLightRadius || GameState.lightRadius()), time);
    }
}
