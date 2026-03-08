// --- VARIABLES GLOBALES UI ET PROGRESSION ---
const Haptics = window.Capacitor ? window.Capacitor.Plugins.Haptics : null;
const SplashScreen = window.Capacitor ? window.Capacitor.Plugins.SplashScreen : null;

window.currentLevel = 1;
window.totalPearls = 0;
window.sessionPearls = 0;
window.speedLevel = 1;
window.brushLevel = 1;
window.magicCharges = 0;
window.pearlsSinceLastCharge = 0;
window.gameReady = false;

// --- GESTION DE LA PROGRESSION (LOCALSTORAGE) ---
function loadProgress() {
    window.currentLevel = parseInt(localStorage.getItem('oceanBloomLevel')) || 1;
    window.totalPearls = parseInt(localStorage.getItem('oceanBloomPearls')) || 0;
    window.speedLevel = parseInt(localStorage.getItem('oceanBloomSpeed')) || 1;
    window.brushLevel = parseInt(localStorage.getItem('oceanBloomBrush')) || 1;
    window.hasTrident = localStorage.getItem('oceanBloomTrident') === 'true';
}

function saveProgress() {
    localStorage.setItem('oceanBloomLevel', window.currentLevel);
    localStorage.setItem('oceanBloomPearls', window.totalPearls);
    localStorage.setItem('oceanBloomSpeed', window.speedLevel);
    localStorage.setItem('oceanBloomBrush', window.brushLevel);
}

// Fonction appelée par le bouton Réinitialiser HTML
window.resetProgress = function () {
    if (confirm("Veux-tu vraiment effacer toute ta progression ?")) {
        localStorage.clear();
        location.reload();
    }
};

// Fonction appelée par la boutique HTML
window.buyUpgrade = function (type) {
    const prices = { speed: window.speedLevel * 10, brush: window.brushLevel * 10 };
    const maxLevel = 10;

    if (type === 'speed' && window.totalPearls >= prices.speed && window.speedLevel < maxLevel) {
        window.totalPearls -= prices.speed;
        window.speedLevel++;
        if (window.playBuySound) window.playBuySound();
    } else if (type === 'brush' && window.totalPearls >= prices.brush && window.brushLevel < maxLevel) {
        window.totalPearls -= prices.brush;
        window.brushLevel++;
        if (window.playBuySound) window.playBuySound();
    }

    saveProgress();
    updateShopUI();
};

function updateShopUI() {
    const elPearls = document.getElementById('shop-pearls');
    const elSpeedLvl = document.getElementById('lvl-speed');
    const elBrushLvl = document.getElementById('lvl-brush');
    const btnSpeed = document.getElementById('btn-upg-speed');
    const btnBrush = document.getElementById('btn-upg-brush');

    if (elPearls) {
        elPearls.innerText = `⚪ ${window.totalPearls}`;
        elSpeedLvl.innerText = `Lvl ${window.speedLevel}`;
        elBrushLvl.innerText = `Lvl ${window.brushLevel}`;

        const speedPrice = window.speedLevel * 10;
        const brushPrice = window.brushLevel * 10;

        btnSpeed.innerText = window.speedLevel >= 10 ? 'MAX' : `${window.getStr ? window.getStr('pricePrefix') : 'Prix: '}${speedPrice} ⚪`;
        btnSpeed.disabled = window.speedLevel >= 10 || window.totalPearls < speedPrice;

        btnBrush.innerText = window.brushLevel >= 10 ? 'MAX' : `${window.getStr ? window.getStr('pricePrefix') : 'Prix: '}${brushPrice} ⚪`;
        btnBrush.disabled = window.brushLevel >= 10 || window.totalPearls < brushPrice;
    }
}

// Rendre disponible au lancement
window.updateGameUI = function () {
    const lvlTxt = document.getElementById('current-level-text');
    const pearlTxt = document.getElementById('session-pearls');
    const magicTxt = document.getElementById('magic-charges');
    const magicBtn = document.getElementById('magic-action-btn');
    const dolphinBtn = document.getElementById('dolphin-action-btn');

    if (lvlTxt) lvlTxt.innerText = window.currentLevel;
    if (pearlTxt) pearlTxt.innerText = window.sessionPearls;
    if (magicTxt) magicTxt.innerText = window.magicCharges;

    // Afficher ou cacher le bouton magie (uniquement si le jeu a commencé et charges > 0)
    if (magicBtn) {
        if (window.magicCharges > 0 && window.gameReady && !window.isGameFinishedGlobally) {
            magicBtn.style.display = 'block';
        } else {
            magicBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher le bouton ultime (uniquement contre le boss, et avec >= 2 charges)
    if (dolphinBtn) {
        if (window.magicCharges >= 2 && window.gameReady && !window.isGameFinishedGlobally && window.isBossActiveGlobally) {
            dolphinBtn.style.display = 'block';

            // On s'assure de cacher l'onde de choc normale pour privilégier l'ultime
            if (magicBtn) magicBtn.style.display = 'none';
        } else {
            dolphinBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher le bouton "Rayon Purificateur" (Trident)
    const rayBtn = document.getElementById('ray-action-btn');
    if (rayBtn) {
        if (window.hasTrident && window.gameReady && !window.isGameFinishedGlobally) {
            rayBtn.style.display = 'block';
        } else {
            rayBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher le bouton Malik (Coût = 4)
    const malikBtn = document.getElementById('malik-action-btn');
    if (malikBtn) {
        if (window.magicCharges >= 4 && window.gameReady && !window.isGameFinishedGlobally && !window.isBossActiveGlobally) {
            malikBtn.style.display = 'block';
            // Cacher la magie de base pour privilégier Malik
            if (magicBtn) magicBtn.style.display = 'none';
        } else {
            malikBtn.style.display = 'none';
        }
    }
};

// Charge la progression au démarrage du script
loadProgress();
updateShopUI();


// --- SCENE PRINCIPALE DU JEU (ES6) ---
class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // Chargement des assets générés de façon procédurale (depuis assets.js)
        if (typeof loadGameAssets === 'function') {
            loadGameAssets(this);
        }
    }

    create() {
        // Redirection vers le niveau de Course si c'est un multiple de 4 !
        if (window.currentLevel % 4 === 0 && window.currentLevel > 0) {
            this.scene.start('ChaseScene');
            return;
        }

        // La taille du niveau augmente maintenant beaucoup plus à chaque niveau
        // Lvl 1: 2000, Lvl 2: 2400, Lvl 3: 2900, Lvl 4: 3500, Lvl 5: 4200, etc.
        const sizeBonus = Math.pow(window.currentLevel, 1.4) * 300;
        const levelW = 2000 + sizeBonus;
        const levelH = 2000 + sizeBonus;
        this.physics.world.setBounds(0, 0, levelW, levelH);

        window.gameReady = true;
        window.sessionPearls = 0; // Remise à zéro pour la session
        window.magicCharges = 0;
        window.updateGameUI();

        // --- A. LE MONDE COLORÉ ---
        this.add.tileSprite(levelW / 2, levelH / 2, levelW, levelH, 'ocean_bg').setDepth(0);

        // Génération Procédurale du Récif
        for (let i = 0; i < 180; i++) {
            let x = Math.random() * levelW;
            let y = Math.random() * levelH;
            let keys = ['coral_red', 'weed_green', 'weed_purple'];
            let key = keys[Math.floor(Math.random() * keys.length)];
            let spr = this.add.image(x, y, key);
            spr.setScale(Math.random() * 0.5 + 0.8);
            spr.setAngle(Math.random() * 20 - 10);

            if (key.includes('weed')) {
                this.tweens.add({ targets: spr, angle: { from: -15, to: 15 }, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1 });
            }
        }

        // Poissons Décoratifs
        this.backgroundFish = [];
        this.helperFishes = []; // Tableau pour l'IA des poissons libérés
        for (let i = 0; i < 60; i++) {
            let keys = ['fish_orange', 'fish_blue'];
            let f = this.add.sprite(Math.random() * levelW, Math.random() * levelH, keys[Math.floor(Math.random() * keys.length)]);
            f.customSpeed = (Math.random() * 2 + 1);
            this.backgroundFish.push(f);
        }

        // --- B. LA COUCHE DE POLLUTION ---
        this.pollutedLayer = this.make.renderTexture({ x: 0, y: 0, width: levelW, height: levelH }, true);
        this.pollutedLayer.fill(0x000000, 0.9);
        this.pollutedLayer.setDepth(10);

        // Brosses pré-générées pour l'IA
        let brushFish = this.make.graphics({ x: 0, y: 0, add: false });
        brushFish.fillStyle(0xffffff, 1);
        brushFish.fillCircle(15, 15, 15);
        brushFish.generateTexture('fishBrush', 30, 30);

        let brushMalik = this.make.graphics({ x: 0, y: 0, add: false });
        brushMalik.fillStyle(0xffffff, 1);
        brushMalik.fillCircle(75, 75, 75);
        brushMalik.generateTexture('malikBrush', 150, 150);

        // --- C. JOUEUR ---
        this.anims.create({
            key: 'swim',
            frames: [
                { key: 'mermaid1' },
                { key: 'mermaid2' },
                { key: 'mermaid3' },
                { key: 'mermaid4' }
            ],
            frameRate: 8,
            repeat: -1
        });

        this.player = this.physics.add.sprite(levelW / 2, levelH / 2, 'mermaid1');
        this.player.setDepth(20);
        this.player.setCollideWorldBounds(true);
        this.player.setDrag(200);
        this.player.baseSpeed = 350 + ((window.speedLevel - 1) * 40);
        this.player.currentSpeed = this.player.baseSpeed;
        this.player.setMaxVelocity(800);
        this.player.isStunned = false;

        this.cameras.main.setBounds(0, 0, levelW, levelH);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        // SYSTEME DE BULLES (Sillage)
        const bubbleParticles = this.add.particles('bubble');
        bubbleParticles.setDepth(19);
        this.player.bubbleEmitter = bubbleParticles.createEmitter({
            speedX: { min: -15, max: 15 },
            speedY: { min: -50, max: -20 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 1500,
            frequency: 80,
            on: false,
            follow: this.player,
            followOffset: { x: 0, y: 15 }
        });

        // SYSTEME D'ETINCELLES (Magie)
        const sparkleParticles = this.add.particles('sparkle');
        sparkleParticles.setDepth(21);
        this.player.sparkleEmitter = sparkleParticles.createEmitter({
            speed: { min: 40, max: 80 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            frequency: 30,
            on: false,
            follow: this.player,
            blendMode: 'ADD'
        });

        this.player.lightGlow = this.add.image(this.player.x, this.player.y, 'eraserBrush');
        this.player.lightGlow.setDepth(18);
        this.player.lightGlow.setTint(0x00ffaa);
        this.player.lightGlow.setAlpha(0.5);
        this.player.lightGlow.setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
            targets: this.player.lightGlow,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.2,
            duration: 1500,
            yoyo: true,
            repeat: -1
        });

        this.eraser = this.make.image({ key: 'eraserBrush', add: false });
        this.brushRadius = (160 + ((window.brushLevel - 1) * 30)) / 2; // Rayon efficace pour le nettoyage

        // --- D. GESTION DES DÉCHETS, PERLES ET ENNEMIS ---
        this.trashes = this.physics.add.group();
        this.pearls = this.physics.add.group();
        this.enemyGroup = this.physics.add.group();
        this.enemies = []; // Pour un accès rapide

        // --- E. BOSS ET PROJECTILES ---
        this.bossActive = false;
        this.boss = null;
        this.mimiProjectiles = this.physics.add.group();
        this.bossProjectiles = this.physics.add.group();
        this.lastMimiShot = 0;
        this.lastBossShot = 0;

        // Optimisation : au lieu d'objets physiques, on a un tableau de points à nettoyer 
        this.pollutionSpots = [];
        this.totalPollution = 0;
        this.cleanedPollution = 0;

        // La difficulté et les récompenses augmentent de façon importante avec le niveau
        let lvl = window.currentLevel;
        let trashChance = 0.1 + (lvl * 0.02); // 20% max à lvl 5, 30% à lvl 10
        let enemyChance = 0.02 + (lvl * 0.01); // Plus d'ennemis, donc plus rude
        let pearlChance = 0.03 + (lvl * 0.005); // Les perles augmentent légèrement mais restent rares

        // Plus le niveau est grand, plus la grille est dense
        let gridStep = Math.max(60, 120 - (lvl * 5));

        for (let x = 100; x < levelW; x += gridStep) {
            for (let y = 100; y < levelH; y += gridStep) {
                // Ajouter un point de pollution à nettoyer (avec une chance pour éviter les carrés parfaits au HL)
                if (Math.random() > 0.1) {
                    this.pollutionSpots.push({ x: x + Math.random() * 20, y: y + Math.random() * 20, cleaned: false });
                    this.totalPollution++;
                }

                let distToCenter = Phaser.Math.Distance.Between(x, y, levelW / 2, levelH / 2);
                if (distToCenter > 300) {
                    if (Math.random() < trashChance) {
                        let trash = this.trashes.create(x + Math.random() * 50 - 25, y + Math.random() * 50 - 25, 'trash');
                        trash.setDepth(15);
                        this.tweens.add({ targets: trash, y: trash.y - 15, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1 });
                    }
                    else if (Math.random() < pearlChance) {
                        let pearl = this.pearls.create(x, y, 'pearl');
                        pearl.setDepth(15);
                        this.tweens.add({ targets: pearl, scaleX: 1.3, scaleY: 1.3, alpha: 0.7, duration: 800, yoyo: true, repeat: -1 });
                    }
                    else if (Math.random() < enemyChance) {
                        let enemy = this.enemyGroup.create(x, y, 'enemy');
                        enemy.setDepth(16);
                        enemy.setInteractive();
                        this.enemies.push(enemy);

                        // La vitesse de l'ennemi augmente aussi avec le niveau
                        let enemyDur = Math.max(1000, 3000 + Math.random() * 2000 - (lvl * 150));

                        this.tweens.add({
                            targets: enemy,
                            x: enemy.x + (Math.random() > 0.5 ? 50 : -50),
                            y: enemy.y + (Math.random() > 0.5 ? 50 : -50),
                            duration: enemyDur,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                }
            }
        }

        // --- COLLISIONS PHYSIQUES (Événements) ---
        this.physics.add.overlap(this.player, this.trashes, (p, trash) => {
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                this.player.currentSpeed = this.player.baseSpeed * 0.3;

                this.cameras.main.shake(200, 0.01);
                if (window.playHurtSound) window.playHurtSound();

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

            window.sessionPearls++; // CORRECTION DU BUG : totalPearls n'est pas incrémenté ici pour éviter de compter en double.
            window.pearlsSinceLastCharge++;

            if (window.pearlsSinceLastCharge >= 3) {
                window.magicCharges++;
                window.pearlsSinceLastCharge = 0;
                if (window.playMagicChargeSound) window.playMagicChargeSound();
            }

            window.updateGameUI();

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

                this.time.delayedCall(3000, () => {
                    this.player.clearTint();
                    this.player.isStunned = false;
                    this.player.currentSpeed = this.player.baseSpeed;
                    if (window.playRecoverSound) window.playRecoverSound();
                });
            }
        });

        // Suppression de l'utilisation de magie au clic sur ennemi pour éviter un drain involontaire avec le joystick
        this.input.on('gameobjectdown', (pointer, gameObject) => {
            // Désactivé : l'onde de choc s'utilise exclusivement via le bouton dédié maintenant
        });

        this.isGameFinished = false;
        window.isGameFinishedGlobally = false;

        // --- Cacher le Splash Screen natif de Capacitor une fois le jeu prêt ---
        if (SplashScreen) {
            SplashScreen.hide();
        }
    }

    // --- NOUVELLE MÉCANIQUE MAGIQUE (ONDE DE CHOC) ---
    castMagicShockwave() {
        if (window.magicCharges <= 0 || this.isGameFinished) return;

        window.magicCharges--;
        window.updateGameUI();

        if (window.playEnemyDefeatSound) window.playEnemyDefeatSound();

        // 1. Effet visuel géant (Plus grand si Trident)
        const shockRadius = window.hasTrident ? 1200 : 600;

        // Cercle d'explosion
        let ringBaseColor = window.hasTrident ? 0xffffff : 0x00ffaa;
        let ring = this.add.circle(this.player.x, this.player.y, 10, ringBaseColor, 0.8);
        if (window.hasTrident) {
            ring.setStrokeStyle(15, 0xff00ff); // Épais et magique
            this.tweens.add({
                targets: ring,
                strokeColor: 0x00ffff,
                duration: 200,
                yoyo: true,
                repeat: -1
            });
        } else {
            ring.setStrokeStyle(4, 0xffffff);
        }
        ring.setDepth(25);

        this.tweens.add({
            targets: ring,
            radius: shockRadius,
            alpha: 0,
            duration: window.hasTrident ? 1200 : 800,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });

        // Particules 
        let ptOptions = {
            x: this.player.x,
            y: this.player.y,
            speed: { min: window.hasTrident ? 500 : 300, max: window.hasTrident ? 1000 : 600 },
            angle: { min: 0, max: 360 },
            scale: { start: window.hasTrident ? 4 : 2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: window.hasTrident ? 1500 : 1000,
            blendMode: 'ADD'
        };
        // Aux couleurs de l'arc-en-ciel si Trident possédé !
        if (window.hasTrident) {
            ptOptions.tint = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
        }

        const explosion = this.add.particles('sparkle').createEmitter(ptOptions);
        explosion.explode(window.hasTrident ? 300 : 80);

        this.cameras.main.shake(500, 0.03);

        // 2. Transformer les monstres purifiés en poissons libres (Libération)
        let enemiesDestroyed = 0;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let enemy = this.enemies[i];
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < shockRadius) {

                // Mignon effet : Créer un poisson à la place du monstre
                let keys = ['fish_orange', 'fish_blue'];
                let fishType = keys[Math.floor(Math.random() * keys.length)];
                let freedFish = this.add.sprite(enemy.x, enemy.y, fishType);
                freedFish.setDepth(17); // Au-dessus des algues
                freedFish.customSpeed = (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1);

                // Petite animation de libération (Tourbillon rebondissant)
                this.tweens.add({
                    targets: freedFish,
                    scaleX: { from: 0.1, to: 1.5 },
                    scaleY: { from: 0.1, to: 1.5 },
                    angle: { from: -180, to: 0 },
                    duration: 600,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.tweens.add({ targets: freedFish, scaleX: 1, scaleY: 1, duration: 200 });
                    }
                });

                if (this.helperFishes.length < 15) {
                    this.helperFishes.push(freedFish);
                    freedFish.setTint(0x00ffaa); // Couleur magique pour les helpers
                } else {
                    this.backgroundFish.push(freedFish); // Le poisson rejoint ceux de l'arrière-plan
                }

                enemy.destroy(); // Suppression du déchet
                this.enemies.splice(i, 1);
                enemiesDestroyed++;
            }
        }

        // 3. Purifier la pollution dans le rayon (Onde de choc révèle le monde)
        let pointsCleanedByMagic = 0;
        for (let i = 0; i < this.pollutionSpots.length; i++) {
            let spot = this.pollutionSpots[i];
            if (!spot.cleaned && Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) < shockRadius) {
                spot.cleaned = true;
                pointsCleanedByMagic++;

                // Gommer visuellement (avec une brosse massive)
                const bigBrush = this.make.graphics({ x: 0, y: 0, add: false });
                bigBrush.fillStyle(0xffffff, 1);
                bigBrush.fillCircle(100, 100, 100);
                bigBrush.generateTexture('hugeBrush', 200, 200);
                let t_brush = this.make.image({ key: 'hugeBrush', add: false });
                this.pollutedLayer.erase(t_brush, spot.x, spot.y);
            }
        }

        if (pointsCleanedByMagic > 0) {
            this.cleanedPollution += pointsCleanedByMagic;

            // Text flottant global
            let floatingText = this.add.text(
                this.player.x,
                this.player.y - 50,
                (window.getStr ? window.getStr('msgEnemyDefeated') : 'Ennemis purifiés ! -') + Math.floor((pointsCleanedByMagic / this.totalPollution) * 100) + '%',
                {
                    fontFamily: '"Press Start 2P"',
                    fontSize: '16px',
                    color: '#00ffaa'
                }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: floatingText,
                y: floatingText.y - 100,
                alpha: 0,
                duration: 2500,
                onComplete: () => floatingText.destroy()
            });

            this.updateProgressUI();
        }
    }

    firePurifyingRay(time) {
        this.lastRayTime = time + 3000; // Cooldown de 3s

        if (window.playLaserSound) window.playLaserSound(); // Son du laser
        if (Haptics) Haptics.impact({ style: 'MEDIUM' }).catch(() => { });

        let isRight = this.player.flipX; // D'un côté ou de l'autre
        let rayLength = 600;
        let rayHeightHalf = 60;
        let startX = this.player.x + (isRight ? 20 : -20);
        let endX = startX + (isRight ? rayLength : -rayLength);
        let topY = this.player.y - rayHeightHalf;
        let bottomY = this.player.y + rayHeightHalf;

        // Effet Visuel (Un grand trait rectangulaire qui s'estompe)
        let rayGfx = this.add.graphics();
        rayGfx.fillStyle(0x00ffff, 0.8); // Cyan
        rayGfx.lineStyle(4, 0xffdd00, 1); // Or
        rayGfx.fillRect(isRight ? startX : endX, topY, rayLength, rayHeightHalf * 2);
        rayGfx.strokeRect(isRight ? startX : endX, topY, rayLength, rayHeightHalf * 2);
        rayGfx.setDepth(20);

        // Flash aveuglant ponctuel à la source
        this.cameras.main.flash(200, 0, 255, 255);

        this.tweens.add({
            targets: rayGfx,
            alpha: 0,
            scaleY: 0.1,
            y: this.player.y,
            duration: 500,
            ease: 'Power2',
            onComplete: () => rayGfx.destroy()
        });

        // Nettoyage rapide de la pollution avec AABB (Boîte Englobante Rectangulaire)
        let pointsCleanedByRay = 0;
        let minX = Math.min(startX, endX);
        let maxX = Math.max(startX, endX);

        for (let i = 0; i < this.pollutionSpots.length; i++) {
            let spot = this.pollutionSpots[i];
            if (!spot.cleaned) {
                // Vérifier si le spot est dans notre grand rectangle de tir
                if (spot.x >= minX && spot.x <= maxX && spot.y >= topY && spot.y <= bottomY) {
                    spot.cleaned = true;
                    pointsCleanedByRay++;
                }
            }
        }

        // Si on a nettoyé quelque chose, on gomme TOUT d'un coup grâce à une énorme "brosse" invisible
        if (pointsCleanedByRay > 0) {
            this.cleanedPollution += pointsCleanedByRay;
            this.updateProgressUI();

            // Création d'une brosse rectangulaire sur-mesure pour gommer d'un seul coup
            let rectBrushInfos = this.make.graphics({ x: 0, y: 0, add: false });
            rectBrushInfos.fillStyle(0xffffff, 1);
            rectBrushInfos.fillRect(0, 0, rayLength, rayHeightHalf * 2);
            rectBrushInfos.generateTexture('rayBrush', rayLength, rayHeightHalf * 2);

            let brushSpr = this.make.image({ key: 'rayBrush', add: false });
            // L'origine (0.5, 0.5) est au centre, on gomme sur le centre du rayon mathématique
            let centerX = startX + (isRight ? rayLength / 2 : -rayLength / 2);
            this.pollutedLayer.erase(brushSpr, centerX, this.player.y);

            // Animation du score
            let floatText = this.add.text(centerX, this.player.y - 80, "PURIFIÉ !", { fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#00ffff' }).setOrigin(0.5);
            this.tweens.add({ targets: floatText, y: floatText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatText.destroy() });
        }
    }

    summonMalik() {
        if (window.magicCharges < 4 || this.isGameFinished || this.malikActive) return;

        window.magicCharges -= 4;
        window.updateGameUI();
        this.malikActive = true;
        this.malikTimeLeft = 10000;

        if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

        // Apparition de Malik près de Mimi
        this.malik = this.physics.add.sprite(this.player.x - 100, this.player.y, 'malik');
        this.malik.setDepth(21); // Au-dessus du joueur
        this.malik.setScale(0);

        // Effet d'apparition
        this.tweens.add({
            targets: this.malik,
            scale: 2, // Plus grand que Mimi !
            duration: 800,
            ease: 'Elastic.easeOut'
        });

        // Particules flash
        const particles = this.add.particles('sparkle');
        particles.setDepth(35);
        const explosion = particles.createEmitter({
            x: this.player.x - 100,
            y: this.player.y,
            speed: { min: 100, max: 200 },
            scale: { start: 2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            tint: 0x00ff88,
            blendMode: 'ADD'
        });
        explosion.explode(50);

        // Titre flottant
        let malikTitle = this.add.text(this.player.x, this.player.y - 120, "MALIK À LA RESCOUSSE ! 🧜‍♂️", {
            fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#00ff88', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: malikTitle,
            y: this.player.y - 180,
            alpha: 0,
            duration: 3000,
            onComplete: () => malikTitle.destroy()
        });
    }

    update(time, delta) {
        if (this.isGameFinished) return;

        // --- TIR DU RAYON PURIFICATEUR ---
        if (window.fireRay) {
            window.fireRay = false;
            this.lastRayTime = this.lastRayTime || 0;
            if (window.hasTrident && time > this.lastRayTime && !this.player.isStunned) {
                this.firePurifyingRay(time);
            }
        }

        // LECTURE DU JOYSTICK
        const joy = window.joystickData || { active: false, x: 0, y: 0 };

        if (joy.active) {
            this.player.setVelocityX(joy.x * this.player.currentSpeed);
            this.player.setVelocityY(joy.y * this.player.currentSpeed);
            this.player.anims.play('swim', true);

            if (joy.x < 0) this.player.setFlipX(false);
            else if (joy.x > 0) this.player.setFlipX(true);
            this.player.rotation = joy.y * 0.3;
            this.player.bubbleEmitter.on = true;
            this.player.sparkleEmitter.on = true;
        } else {
            this.player.anims.stop();
            this.player.setTexture('mermaid1');
            this.player.rotation = 0;
            this.player.bubbleEmitter.on = false;
            this.player.sparkleEmitter.on = false;
            // On veut conserver un léger frottement
        }

        if (this.player.lightGlow) {
            this.player.lightGlow.x = this.player.x;
            this.player.lightGlow.y = this.player.y;
        }

        // Effacer la pollution là où on passe
        this.pollutedLayer.erase(this.eraser, this.player.x, this.player.y);

        // Optimisation Performance CPU: Nettoyage mathématique de la pollution UNIQUEMENT SI le joueur bouge
        let pointsCleanedThisFrame = 0;
        if (joy.active) {
            for (let i = 0; i < this.pollutionSpots.length; i++) {
                let spot = this.pollutionSpots[i];
                if (!spot.cleaned) {
                    // On vérifie d'abord sommairement les bounding box (AABB) pour être ultra-rapide
                    if (Math.abs(spot.x - this.player.x) < this.brushRadius &&
                        Math.abs(spot.y - this.player.y) < this.brushRadius) {
                        // Et on précise avec la distance radiale
                        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) < this.brushRadius) {
                            spot.cleaned = true;
                            pointsCleanedThisFrame++;
                        }
                    }
                }
            }
        }

        if (pointsCleanedThisFrame > 0) {
            this.cleanedPollution += pointsCleanedThisFrame;
            this.updateProgressUI();

            // VIBRATION LIGHT (Une seule fois par frame pour soulager le Native Bridge)
            if (Haptics) {
                Haptics.impact({ style: 'LIGHT' }).catch(() => { });
            }
        }

        // Poissons d'arrière plan
        this.backgroundFish.forEach(fish => {
            fish.x += fish.customSpeed;
            if (fish.x > this.physics.world.bounds.width + 50) {
                fish.x = -50;
                fish.y = Math.random() * this.physics.world.bounds.height;
            }
            fish.y += Math.sin(time / 500 + fish.x) * 0.5;
        });

        // --- IA DES POISSONS ALLIÉS (HELPER FISHES) ---
        for (let i = this.helperFishes.length - 1; i >= 0; i--) {
            let fish = this.helperFishes[i];
            let targetSpot = null;
            let minDist = 800; // Cherche dans un rayon de 800

            // Cherche un bout de pollution non nettoyé
            for (let j = 0; j < this.pollutionSpots.length; j++) {
                let spot = this.pollutionSpots[j];
                if (!spot.cleaned) {
                    let d = Phaser.Math.Distance.Between(fish.x, fish.y, spot.x, spot.y);
                    if (d < minDist) {
                        minDist = d;
                        targetSpot = spot;
                    }
                }
            }

            if (targetSpot) {
                // Déplacement vers la tâche
                let angle = Phaser.Math.Angle.Between(fish.x, fish.y, targetSpot.x, targetSpot.y);
                fish.x += Math.cos(angle) * 3; // vitesse
                fish.y += Math.sin(angle) * 3;
                fish.rotation = angle + Math.PI / 2; // Orienter le poisson

                // Nettoyer s'il est assez proche
                if (minDist < 30) {
                    targetSpot.cleaned = true;
                    this.cleanedPollution++;
                    this.updateProgressUI();

                    let fg = this.make.image({ key: 'fishBrush', add: false });
                    this.pollutedLayer.erase(fg, targetSpot.x, targetSpot.y);
                }
            } else {
                // S'il ne trouve rien, il s'en va au loin et on le vire du tableau
                fish.x += 2;
                fish.y -= 1;
                fish.rotation = 0;
            }
        }

        // --- IA DE MALIK ---
        if (this.malikActive && this.malik && this.malik.active) {
            this.malikTimeLeft -= delta;

            if (this.malikTimeLeft <= 0) {
                // Fin de l'invocation, départ rapide sur le côté
                this.malikActive = false;
                this.tweens.add({
                    targets: this.malik,
                    x: this.malik.x + (this.malik.flipX ? 1500 : -1500),
                    alpha: 0,
                    duration: 1500,
                    ease: 'Power2',
                    onComplete: () => {
                        this.malik.destroy();
                    }
                });
            } else {
                // Recherche dynamique (Pollution ou Boss)
                let targetX = this.malik.x + (this.malik.flipX ? 200 : -200); // Navigation libre
                let targetY = this.malik.y + Math.sin(time / 200) * 100;

                if (window.isBossActiveGlobally && this.boss && this.boss.active) {
                    targetX = this.boss.x;
                    targetY = this.boss.y;
                } else if (this.pollutionSpots.length > 0) {
                    // Trouver le premier point de pollution valide et proche
                    for (let i = 0; i < this.pollutionSpots.length; i++) {
                        if (!this.pollutionSpots[i].cleaned && Phaser.Math.Distance.Between(this.malik.x, this.malik.y, this.pollutionSpots[i].x, this.pollutionSpots[i].y) < 1500) {
                            targetX = this.pollutionSpots[i].x;
                            targetY = this.pollutionSpots[i].y;
                            break;
                        }
                    }
                }

                let angle = Phaser.Math.Angle.Between(this.malik.x, this.malik.y, targetX, targetY);
                this.malik.x += Math.cos(angle) * 7; // Rapide
                this.malik.y += Math.sin(angle) * 7;

                if (Math.cos(angle) < 0) this.malik.setFlipX(false);
                else this.malik.setFlipX(true);

                // Nettoyage MASSIF de Malik (Boîte Englobante Large)
                let pointsCleanedByMalik = 0;
                let brushRad = 150;
                for (let i = 0; i < this.pollutionSpots.length; i++) {
                    let spot = this.pollutionSpots[i];
                    if (!spot.cleaned && Phaser.Math.Distance.Between(this.malik.x, this.malik.y, spot.x, spot.y) < brushRad) {
                        spot.cleaned = true;
                        pointsCleanedByMalik++;
                    }
                }

                if (pointsCleanedByMalik > 0) {
                    this.cleanedPollution += pointsCleanedByMalik;
                    this.updateProgressUI();
                    // Effacer avec la grosse brosse générée en create()
                    let fgMalik = this.make.image({ key: 'malikBrush', add: false });
                    this.pollutedLayer.erase(fgMalik, this.malik.x, this.malik.y);
                }

                // Dégâts au boss par collision brutale de Malik
                if (window.isBossActiveGlobally && this.boss && this.boss.active && Phaser.Math.Distance.Between(this.malik.x, this.malik.y, this.boss.x, this.boss.y) < 180) {
                    if (time % 800 < 50) { // Un coup sévère toutes les 800ms
                        if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();
                        this.damageBoss(null, 50); // Dégâts de zone massifs
                    }
                }
            }
        }

        // --- COMPORTEMENT BOSS (IA & TIRS) ---
        if (this.bossActive && this.boss) {
            // Mouvement simple vers le joueur
            this.physics.moveToObject(this.boss, this.player, 80 + (window.currentLevel * 10));

            // Tir du boss (Boue Toxique)
            if (time > this.lastBossShot) {
                if (typeof window.playBossShootSound === 'function') window.playBossShootSound();
                let proj = this.bossProjectiles.create(this.boss.x, this.boss.y, 'boss_shot');
                proj.setDepth(19);
                this.physics.moveToObject(proj, this.player, 250 + (window.currentLevel * 20));

                // Rotation vers le joueur
                let angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
                proj.rotation = angle;

                this.lastBossShot = time + Math.max(800, 2000 - (window.currentLevel * 100)); // Plus on monte de niveau, plus le boss tire vite
            }

            // Tir Automatique de Mimi (Lumière) si elle est en vie
            if (time > this.lastMimiShot && !this.player.isStunned) {
                if (typeof window.playShootSound === 'function') window.playShootSound();
                let mProj = this.mimiProjectiles.create(this.player.x, this.player.y, 'mimi_shot');
                mProj.setDepth(19);
                this.physics.moveToObject(mProj, this.boss, 600);

                mProj.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.boss.x, this.boss.y);

                let speedBuff = Math.max(0, (window.speedLevel - 1) * 30);
                this.lastMimiShot = time + Math.max(200, 500 - speedBuff); // Plus on est rapide, plus on tire vite
            }
        }
    }

    updateProgressUI() {
        let percentClean = Math.floor((this.cleanedPollution / this.totalPollution) * 100);
        // Protection pour ne pas dépasser 100
        if (percentClean > 100) percentClean = 100;
        let percentPollution = 100 - percentClean;

        const fill = document.getElementById('progress-fill');
        const text = document.getElementById('progress-text');
        if (fill) fill.style.width = percentClean + '%';
        if (text) text.innerText = (window.getStr ? window.getStr('uiPollution') : 'POLLUTION: ') + percentPollution + '%';

        // Le boss apparaît maintenant quand la carte est nettoyée à 90% (contre 98% avant, pour éviter l'ennui)
        if (percentClean >= 90 && !this.isGameFinished) {
            if (!this.bossActive && !window.isBossActiveGlobally) {
                this.spawnBoss();
            }
        }
    }

    // --- PHASE 3 : LE BOSS ---
    spawnBoss() {
        this.bossActive = false; // Bloque les actions le temps du spawn
        window.isBossActiveGlobally = true;

        // 1. Nettoyer les déchets et ennemis restants
        this.enemies.forEach(e => e.destroy());
        this.enemies = [];
        this.trashes.clear(true, true);
        this.totalPollution = 1; // Hack pour éviter NaN dans le pourcentage

        // 2. Lancer la musique de Boss
        if (typeof window.startBossMusic === 'function') window.startBossMusic();

        // 3. Assombrir l'écran (Pollution Épaisse)
        this.cameras.main.flash(500, 255, 0, 0); // Flash rouge d'alarme
        this.pollutedLayer.fill(0x330000, 0.95); // Teinte rouge sang menaçante
        this.pollutedLayer.setDepth(5);
        this.pollutedLayer.alpha = 1;

        // Point d'apparition
        let cx = this.physics.world.bounds.width / 2;
        let cy = this.physics.world.bounds.height / 2;

        // Sélection du Boss selon le niveau
        let bossAsset = 'boss_vase';
        let bossName = window.getStr ? window.getStr('uiBossVase') : 'MONSTRE DE VASE';
        let bossScaleHP = 1.0;

        if (window.currentLevel >= 5) {
            bossAsset = 'boss_petrole';
            bossName = window.getStr ? window.getStr('uiBossPetrole') : 'GEÔLIER DE PÉTROLE';
            bossScaleHP = 3.5; // Très costaud !
        } else if (window.currentLevel >= 3) {
            bossAsset = 'boss_plastique';
            bossName = window.getStr ? window.getStr('uiBossPlastique') : 'AMALGAMME DE PLASTIQUE';
            bossScaleHP = 2.0;
        }

        const elBossName = document.getElementById('boss-name');
        if (elBossName) elBossName.innerText = bossName;

        this.boss = this.physics.add.sprite(cx, cy - 600, bossAsset);
        this.boss.setDepth(20);
        this.boss.setCollideWorldBounds(true);

        // PV du boss grandement augmentés pour donner le temps au joueur de jouer, scalés selon la difficulté
        this.boss.maxHp = 3000 + (window.currentLevel * 1000 * bossScaleHP);
        this.boss.hp = this.boss.maxHp;

        // Cacher les barres de niveaux, afficher celles du boss
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) progressContainer.style.display = 'none';

        const uiBossContainer = document.getElementById('boss-ui-container');
        if (uiBossContainer) uiBossContainer.style.display = 'block';

        window.updateGameUI(); // Met à jour le bouton Dauphin

        // Animation d'entrée
        this.tweens.add({
            targets: this.boss,
            y: cy,
            duration: 2500,
            ease: 'Bounce.easeOut',
            onComplete: () => {
                this.bossActive = true;
                this.updateBossUI();

                // Léger balancement du boss
                this.tweens.add({
                    targets: this.boss,
                    y: '-=30',
                    duration: 1200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });

        // 4. Overlaps de Combats

        // Le boss touche Mimi (dégâts lourds, et Mimi perd 1 charge magique par punition)
        this.physics.add.overlap(this.player, this.boss, (p, b) => {
            this.takeDamage(null, true);
        });

        // Tir du boss touche Mimi
        this.physics.add.overlap(this.player, this.bossProjectiles, (p, proj) => {
            this.takeDamage(proj, false);
        });

        // Tir de Mimi touche le Boss
        this.physics.add.overlap(this.boss, this.mimiProjectiles, (b, proj) => {
            this.damageBoss(proj, 15 + (window.brushLevel * 5)); // Dégâts réduits pour que le combat dure
        });
    }

    takeDamage(proj, severe) {
        if (proj) proj.destroy();
        if (this.player.isStunned || !this.bossActive) return;

        this.player.isStunned = true;
        this.player.setTint(0xff0000);
        this.cameras.main.shake(severe ? 800 : 300, severe ? 0.05 : 0.02);
        if (typeof window.playHurtSound === 'function') window.playHurtSound();

        // 30% de chance de perdre une charge magique (ou punition sévère 100% si on touche le corps)
        if (window.magicCharges > 0 && (severe || Math.random() > 0.7)) {
            window.magicCharges--;
            window.updateGameUI();

            // Text flottant "-"
            let floatingText = this.add.text(this.player.x, this.player.y - 30, "-1🌟", { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffff00' })
            this.tweens.add({ targets: floatingText, y: floatingText.y - 50, alpha: 0, duration: 1500, onComplete: () => floatingText.destroy() });
        }

        this.time.delayedCall(1500, () => {
            this.player.clearTint();
            this.player.isStunned = false;
        });
    }

    damageBoss(proj, amount) {
        if (proj) {
            proj.destroy();
            // Le boss lâche régulièrement des perles sous l'effet de l'attaque de base (40% de chance)
            // Cela permet de remplir l'Ultime pendant le combat !
            if (this.bossActive && Math.random() > 0.6) {
                let px = this.boss.x + (Math.random() * 100 - 50);
                let py = this.boss.y + (Math.random() * 100 - 50);
                let pearl = this.pearls.create(px, py, 'pearl');
                pearl.setDepth(15);
                this.tweens.add({ targets: pearl, scaleX: 1.5, scaleY: 1.5, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
                // La perle tombe doucement vers le bas pour que le joueur puisse la ramasser
                pearl.setVelocityY(80 + Math.random() * 50);
                pearl.setVelocityX((Math.random() - 0.5) * 100);

                // Disparaît au bout de 8 secondes si non ramassée pour éviter l'encombrement
                this.time.delayedCall(8000, () => {
                    if (pearl && pearl.active) pearl.destroy();
                });
            }
        }

        if (!this.boss || this.boss.hp <= 0) return;

        this.boss.hp -= amount;

        // Effet Hit Blanc
        this.boss.setTint(0xffffff);
        this.time.delayedCall(80, () => {
            if (this.boss) this.boss.clearTint();
        });

        if (this.boss.hp <= 0 && this.bossActive) {
            this.defeatBoss();
        } else {
            this.updateBossUI();
        }
    }

    updateBossUI() {
        if (!this.boss) return;
        let pct = (this.boss.hp / this.boss.maxHp) * 100;
        if (pct < 0) pct = 0;
        const fill = document.getElementById('boss-hp-fill');
        if (fill) fill.style.width = pct + '%';
    }

    // --- POUVOIR ULTIME (DAUPHINS ELECTRIQUES) ---
    castDolphinUltimate() {
        // Coûte 2 charges magiques plutôt que 3 pour être utilisé plus souvent et être plus fun !
        if (!this.bossActive || window.magicCharges < 2 || this.isGameFinished || !this.boss) return;

        window.magicCharges -= 2;
        window.updateGameUI();

        if (typeof window.playDolphinSound === 'function') window.playDolphinSound();

        this.cameras.main.flash(300, 0, 200, 255); // Flash bleuté
        this.cameras.main.shake(800, 0.04); // Lourd tremblement divin

        // Invoquer 3 à 5 dauphins
        let numDolphins = Math.floor(Math.random() * 3) + 3;

        for (let i = 0; i < numDolphins; i++) {
            this.time.delayedCall(i * 150, () => {
                if (!this.bossActive) return; // Sécurité si boss mort avant

                // Départ hors écran
                let camView = this.cameras.main.worldView;
                let startX = camView.x - 100 - (Math.random() * 100);
                let startY = camView.y + (Math.random() * camView.height);

                let dolphin = this.add.sprite(startX, startY, 'electric_dolphin');
                dolphin.setDepth(30);
                dolphin.setScale(2); // Très gros !

                const angleToBoss = Phaser.Math.Angle.Between(startX, startY, this.boss.x, this.boss.y);
                dolphin.rotation = angleToBoss;

                // Emiter électrique suivant le dauphin
                const trail = this.add.particles('sparkle').createEmitter({
                    speed: 0, scale: { start: 1.5, end: 0 }, alpha: { start: 0.8, end: 0 },
                    lifespan: 400, frequency: 10, follow: dolphin, blendMode: 'ADD'
                });

                // Le plongeon sur le boss
                this.tweens.add({
                    targets: dolphin,
                    x: this.boss.x,
                    y: this.boss.y,
                    duration: 400, // Extrêmement rapide (! Zap !)
                    ease: 'Power2',
                    onComplete: () => {
                        // Impact ! Dégats massifs (15% à 25% des pv max par dauphin)
                        let hugeDmg = this.boss.maxHp * 0.20;
                        this.damageBoss(null, hugeDmg);

                        // Continue à traverser, puis disparaît
                        this.tweens.add({
                            targets: dolphin,
                            x: this.boss.x + Math.cos(angleToBoss) * 800,
                            y: this.boss.y + Math.sin(angleToBoss) * 800,
                            duration: 400,
                            ease: 'Sine.easeIn',
                            onComplete: () => { dolphin.destroy(); trail.stop(); }
                        });
                    }
                });
            });
        }
    }

    defeatBoss() {
        this.bossActive = false;
        window.isBossActiveGlobally = false;

        const uiBossContainer = document.getElementById('boss-ui-container');
        if (uiBossContainer) uiBossContainer.style.display = 'none';

        // Explosion Suprême !
        const explosion = this.add.particles('sparkle').createEmitter({
            x: this.boss.x, y: this.boss.y,
            speed: { min: 400, max: 1200 },
            scale: { start: 4, end: 0 },
            lifespan: 3000,
            blendMode: 'ADD'
        });
        explosion.explode(200);

        if (typeof window.playEnemyDefeatSound === 'function') {
            window.playEnemyDefeatSound();
            setTimeout(() => window.playEnemyDefeatSound(), 500); // Double explosion son
        }

        this.cameras.main.flash(1500, 255, 255, 255);
        this.cameras.main.shake(2000, 0.05);

        // Pluie de perles divines
        for (let i = 0; i < 40; i++) {
            let px = this.boss.x + (Math.random() * 500 - 250);
            let py = this.boss.y + (Math.random() * 500 - 250);
            let pearl = this.pearls.create(px, py, 'pearl');
            pearl.setDepth(15);
            this.tweens.add({ targets: pearl, scaleX: 2, scaleY: 2, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
        }

        this.boss.destroy();
        this.bossProjectiles.clear(true, true);

        // Délai dramatique avant l'écran de victoire
        this.time.delayedCall(4500, () => {
            this.winGame();
        });
    }

    winGame() {
        this.isGameFinished = true;
        window.isGameFinishedGlobally = true;
        window.updateGameUI(); // Cacher le bouton de magie

        // VIBRATION FORTE POUR LA VICTOIRE
        if (Haptics) {
            Haptics.vibrate().catch(() => { });
        }

        this.player.setVelocity(0);
        this.pollutedLayer.alpha = 0; // On dévoile l'océan

        let bonus = window.currentLevel * 5;
        // On additionne les perles trouvées lors de la partie ! Pas en double.
        window.totalPearls += window.sessionPearls + bonus;
        window.currentLevel += 1;
        saveProgress();

        document.getElementById('victory-pearls').innerText = window.sessionPearls;
        document.getElementById('victory-bonus').innerText = bonus;

        // Si la victoire est un niveau 4, 8, 12... le prochain niveau sera une Course !
        if ((window.currentLevel - 1) % 4 === 0 && window.currentLevel > 1) {
            // Pas de modale, on lance la poursuite au prochain tour (location.reload d'index.html lancera le bon niveau via MainScene.create)
            document.getElementById('big-love-modal').classList.add('active');
        } else if (window.currentLevel === 6 && !window.hasTrident) {
            // APPEL DE NOTRE NOUVELLE MÉTHODE INLINE
            this.triggerInlineCinematic();
        } else {
            document.getElementById('big-love-modal').classList.add('active');
        }
    }

    triggerInlineCinematic() {
        // 1. Figer les contrôles et les interactions
        window.joystickData.active = false;
        this.player.setVelocity(0);
        this.player.isStunned = true; // Empêche de nouveaux tirs ou mouvements

        // 2. Centrer la caméra sur le joueur et zoomer doucement
        this.cameras.main.stopFollow();
        this.cameras.main.pan(this.player.x, this.player.y, 2000, 'Sine.easeInOut');
        this.cameras.main.zoomTo(1.5, 2000, 'Sine.easeInOut');

        // 3. Apparition de la Princesse Nana (descend du haut de l'écran)
        this.time.delayedCall(2000, () => {
            this.nana = this.add.sprite(this.player.x, this.player.y - 300, 'nana').setScale(2).setDepth(30);

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
        // Bulle de dialogue stylisée
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

        // Attente de lecture puis apparition du Trident
        this.time.delayedCall(4000, () => {
            this.tweens.add({ targets: [bg, text], alpha: 0, duration: 500 });
            this.summonTridentInline();
        });
    }

    summonTridentInline() {
        // Particules lumineuses autour du trident
        const particles = this.add.particles('sparkle');
        particles.setDepth(35);
        const sparkleEmitter = particles.createEmitter({
            x: this.player.x, y: this.player.y - 80,
            speed: { min: 20, max: 80 }, scale: { start: 2, end: 0 },
            lifespan: 1000, frequency: 50, blendMode: 'ADD'
        });

        // Apparition du Trident avec rotation
        this.trident = this.add.sprite(this.player.x, this.player.y - 80, 'trident').setScale(0.1).setAlpha(0).setDepth(40);

        this.tweens.add({
            targets: this.trident,
            y: this.player.y - 20,
            scale: 2,
            alpha: 1,
            angle: 360,
            duration: 2500,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.time.delayedCall(500, () => {
                    // Le trident touche le joueur
                    this.tweens.add({
                        targets: this.trident,
                        y: this.player.y,
                        scale: 0.5,
                        duration: 800,
                        onComplete: () => {
                            if (window.Capacitor && window.Capacitor.Plugins.Haptics) {
                                window.Capacitor.Plugins.Haptics.vibrate().catch(() => { });
                            }
                            if (typeof window.playPowerupSound === 'function') window.playPowerupSound();

                            this.cameras.main.flash(1000, 0, 255, 255); // Flash Cyan
                            this.trident.destroy();
                            sparkleEmitter.stop();

                            // Fin de la cinématique et retour au jeu
                            this.tweens.add({ targets: this.nana, alpha: 0, y: this.nana.y - 100, duration: 1500 });
                            this.cameras.main.zoomTo(1, 1500, 'Sine.easeInOut');

                            this.time.delayedCall(1500, () => {
                                window.hasTrident = true;
                                localStorage.setItem('oceanBloomTrident', 'true');
                                this.player.isStunned = false;
                                document.getElementById('big-love-modal').classList.add('active'); // Écran de victoire
                            });
                        }
                    });
                });
            }
        });
    }
}
// --- NOUVELLE SCÈNE POUR LA COURSE (PHASE 6) ---
class ChaseScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ChaseScene' });
    }

    create() {
        // Interface minimale (on cache la barre de boss et pollution)
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('boss-ui-container').style.display = 'none';

        let titleStr = window.getStr ? window.getStr('chaseTitle') : "VOLEUR EN FUITE !";
        let descStr = window.getStr ? window.getStr('chaseDesc') : "Poursuis-le !";

        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        // Musique agressive pour la poursuite
        if (typeof window.startBossMusic === 'function') window.startBossMusic();

        // Le monde est un très très long couloir horizontal (pour laisser le temps de capturer les 4 voleurs)
        const trackLength = 99000;
        this.physics.world.setBounds(0, 0, trackLength, this.game.config.height);

        this.cameras.main.setBounds(0, 0, trackLength, this.game.config.height);
        this.cameras.main.setBackgroundColor('#001133');

        // --- ANIMATION PARALLAXE : COURANTS LUMINESCENTS ---
        // Vagues (Graphics) qui vont onduler et défiler
        this.currentH = this.game.config.height;
        this.parallaxWaves = [];
        for (let i = 0; i < 3; i++) {
            let pWave = this.add.graphics();
            pWave.setScrollFactor(0.2 + (i * 0.3)); // Parallaxe : défile plus ou moins vite
            pWave.setDepth(1 + i);
            pWave.alpha = 0.4 - (i * 0.1); // Plus profond = moins visible
            this.parallaxWaves.push({ gfx: pWave, offset: i * 1000, speed: 1 + i, color: i % 2 === 0 ? 0x00ffff : 0x0088ff });
        }

        // Système de bulles fuyantes (Particules)
        this.bubbleEmitter = this.add.particles('bubble').createEmitter({
            x: { min: this.game.config.width, max: this.game.config.width + 200 },
            y: { min: 0, max: this.game.config.height },
            speedX: { min: -100, max: -300 }, // Elles vont vers la gauche (vitesse)
            speedY: { min: -20, max: 20 },
            scale: { min: 0.1, max: 0.8 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 4000,
            frequency: 100
        });
        // On attache l'émetteur pour qu'il suive l'écran à droite
        this.bubbleEmitter.setScrollFactor(0);

        // Textes d'instruction
        let info = this.add.text(cx, cy, titleStr + "\n" + descStr, {
            fontFamily: '"Press Start 2P"', fontSize: '14px', fill: '#ff5555', align: 'center', backgroundColor: 'rgba(0,0,0,0.5)'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.tweens.add({ targets: info, alpha: 0, delay: 3000, duration: 1000 });

        // Joueur
        this.player = this.physics.add.sprite(200, cy, 'mermaid1');
        this.player.setDepth(20).setCollideWorldBounds(true);
        this.player.baseSpeed = 400 + ((window.speedLevel - 1) * 40);
        this.player.currentSpeed = this.player.baseSpeed;
        this.player.isStunned = false;

        // Progression des Voleurs
        this.thievesCaught = 0;
        this.thievesToCatch = 4;
        this.targetHit = false;

        let scoreStr = window.getStr && window.getStr('chaseScore') ? window.getStr('chaseScore') : "VOLEURS : ";
        this.scoreText = this.add.text(20, 20, scoreStr + "0/" + this.thievesToCatch, {
            fontFamily: '"Press Start 2P"', fontSize: '18px', fill: '#ffff00', backgroundColor: 'rgba(0,0,0,0.5)'
        }).setOrigin(0).setScrollFactor(0).setDepth(100);

        // Vitesse de défilement de la caméra (elle accélère avec les niveaux)
        this.scrollSpeed = 4 + (window.currentLevel * 0.5);

        this.spawnNextThief();

        // Groupes d'obstacles
        this.mines = this.physics.add.group();
        this.pearls = this.physics.add.group();

        // Génération du parcours (on limite à 50000px max pour éviter de surcharger la mémoire)
        for (let x = 1000; x < 50000; x += (400 - window.currentLevel * 5)) {
            let y = Math.random() * (this.game.config.height - 100) + 50;

            // Perles pour booster
            if (Math.random() > 0.6) {
                let p = this.pearls.create(x, y, 'pearl').setDepth(15);
                this.tweens.add({ targets: p, scale: 1.5, yoyo: true, repeat: -1, duration: 500 });
            }
            // Mines mortelles
            else {
                let m = this.mines.create(x, y + Math.random() * 100 - 50, 'mine').setDepth(15).setTint(0xff5555);
                this.tweens.add({ targets: m, y: m.y + (Math.random() > 0.5 ? 50 : -50), yoyo: true, repeat: -1, duration: 1500 });
            }
        }

        // Joystick Data (identique à MainScene)
        this.input.keyboard.createCursorKeys(); // Si besoin
        this.joystickData = window.joystickData;

        // Collisions
        this.physics.add.overlap(this.player, this.mines, (p, m) => {
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                this.cameras.main.shake(200, 0.02);
                if (window.playHurtSound) window.playHurtSound();

                // Repousser le joueur en arrière fortement
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

            // Accélération soudaine vers l'avant (Dash)
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

        // ANIMATION JOUEUR
        if (time % 400 < 200) this.player.setTexture('mermaid1'); else this.player.setTexture('mermaid2');

        // --- DÉFILEMENT DE LA CAMÉRA (AUTO-SCROLL) ---
        this.cameras.main.scrollX += this.scrollSpeed;

        // Mise à jour de l'effet Parallaxe (Ondulation des vagues)
        this.parallaxWaves.forEach((w, index) => {
            w.gfx.clear();
            w.gfx.fillStyle(w.color, 1);
            w.gfx.beginPath();
            w.gfx.moveTo(-2000 + camLeft, this.currentH);

            // Dessiner une vague sinusoïdale sur toute la largeur de l'écran étendu
            for (let x = -2000 + camLeft; x < camRight + 2000; x += 100) {
                let y = (this.currentH / 2) + Math.sin((x + time * w.speed + w.offset) / 300) * (50 + index * 20) + (index * 80);
                w.gfx.lineTo(x, y);
            }

            w.gfx.lineTo(camRight + 2000, this.currentH);
            w.gfx.closePath();
            w.gfx.fillPath();
        });

        // GESTION DU VOLEUR CIBLE
        if (this.target && this.target.isActiveTarget) {
            if (time % 200 < 100) this.target.setTexture('thief'); else this.target.setTexture('thief');

            // Il glisse lentement vers le joueur par rapport à la caméra, forçant le joueur à dasher ou sprinter
            this.target.x += this.scrollSpeed * 0.90;
            this.target.y = this.target.baseY + Math.sin(time / 200) * 150;

            // Limiter à la droite de la caméra pour qu'il ne parte pas trop vite
            if (this.target.x > camRight - 80) this.target.x = camRight - 80;

            // Condition d'attrape (Overlap Check manuel)
            let dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
            if (dist < 80) { // Catch radius
                this.target.isActiveTarget = false;
                this.target.destroy();

                this.thievesCaught++;
                let scoreStr = window.getStr && window.getStr('chaseScore') ? window.getStr('chaseScore') : "VOLEURS : ";
                this.scoreText.setText(scoreStr + this.thievesCaught + "/" + this.thievesToCatch);

                // Gros flash blanc/jaune de capture
                this.cameras.main.flash(500, 255, 255, 0);
                if (window.playEnemyDefeatSound) window.playEnemyDefeatSound();

                if (this.thievesCaught >= this.thievesToCatch) {
                    this.targetHit = true;
                    this.winChase();
                } else {
                    // Respawn un nouveau voleur un peu plus loin devant, après un court délai
                    this.time.delayedCall(1500, () => {
                        if (!this.targetHit) this.spawnNextThief();
                    });
                }
            }

            // S'il s'échappe (sort par la gauche de l'écran), respawn un nouveau devant !
            else if (this.target.x < camLeft - 50) {
                this.target.isActiveTarget = false;
                this.target.destroy();
                this.cameras.main.flash(200, 255, 0, 0); // Flash rouge raté
                this.time.delayedCall(1000, () => {
                    if (!this.targetHit) this.spawnNextThief();
                });
            }
        }

        // --- CULLING MANUEL (GARBAGE COLLECTION MINES & PERLES) ---
        // Optimisation RAM : Détruire les objets qui sont dépassés par le bord gauche de la caméra
        this.mines.children.each((mine) => {
            if (mine.active && mine.x < camLeft - 200) {
                mine.destroy();
            }
        });

        this.pearls.children.each((pearl) => {
            if (pearl.active && pearl.x < camLeft - 200) {
                pearl.destroy();
            }
        });

        // --- DEPLACEMENT DU JOUEUR (JOYSTICK SEULEMENT) ---
        if (!this.player.isStunned) {
            if (this.joystickData && this.joystickData.active) {
                this.player.setVelocityX(this.joystickData.x * this.player.currentSpeed);
                this.player.setVelocityY(this.joystickData.y * this.player.currentSpeed);
            } else {
                this.player.setVelocity(0); // On s'arrête si on ne touche rien !
            }
        }

        // EMPÊCHER DE SORTIR PAR LA GAUCHE (Ou Mourir)
        if (this.player.x < camLeft + 20) {
            this.player.x = camLeft + 20;
            // Si le mur gauche l'écrase, elle perd la course (Game Over ou Perte de vie)
            // Pour l'instant on la pousse juste avec force.
            this.cameras.main.shake(100, 0.01);
            if (!this.player.isStunned) {
                this.player.isStunned = true;
                this.player.setTint(0xff0000);
                if (window.playHurtSound) window.playHurtSound();
                this.time.delayedCall(1000, () => { this.player.clearTint(); this.player.isStunned = false; });
            }
        }

        // Empêcher d'aller plus vite que la caméra à droite
        if (this.player.x > camRight - 20) {
            this.player.x = camRight - 20;
        }
    }

    winChase() {
        this.player.setVelocity(0);
        this.cameras.main.flash(1500, 255, 255, 255);
        if (typeof window.playEnemyDefeatSound === 'function') window.playEnemyDefeatSound();

        // VIBRATION FORTE POUR LA VICTOIRE
        if (Haptics) {
            Haptics.vibrate().catch(() => { });
        }

        this.target.destroy();

        let winText = this.add.text(this.cameras.main.scrollX + this.game.config.width / 2, this.game.config.height / 2, window.getStr("chaseWin") || "GAGNÉ !", {
            fontFamily: '"Press Start 2P"', fontSize: '20px', fill: '#00ffff'
        }).setOrigin(0.5).setDepth(100);

        this.time.delayedCall(3000, () => {
            // Reprendre le flux de victoire normal
            document.getElementById('progress-container').style.display = 'block'; // Remettre l'UI

            window.isGameFinishedGlobally = true;
            window.updateGameUI(); // Cacher le bouton magique

            let bonus = window.currentLevel * 10; // Gros bonus car c'est dur !
            window.totalPearls += window.sessionPearls + bonus;
            window.currentLevel += 1; // On passe le stade !
            saveProgress();

            document.getElementById('victory-pearls').innerText = window.sessionPearls;
            document.getElementById('victory-bonus').innerText = bonus;

            document.getElementById('big-love-modal').classList.add('active');
        });
    }
}

// --- CONFIGURATION PHASER ---
const config = {
    type: Phaser.WEBGL, // Obligatoire
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [MainScene, ChaseScene], // Déclarer les DEUX scènes
    backgroundColor: '#000000'
};

const game = new Phaser.Game(config);
window.gameInstance = game;