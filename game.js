// --- VARIABLES GLOBALES UI ET PROGRESSION ---
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

                this.backgroundFish.push(freedFish); // Le poisson rejoint ceux de l'arrière-plan

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

    update(time, delta) {
        if (this.isGameFinished) return;

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

        // Optimisation Performance: Nettoyage mathématique de la pollution
        let pointsCleanedThisFrame = 0;
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

        if (pointsCleanedThisFrame > 0) {
            this.cleanedPollution += pointsCleanedThisFrame;
            this.updateProgressUI();
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

        this.player.setVelocity(0);
        this.pollutedLayer.alpha = 0; // On dévoile l'océan

        let bonus = window.currentLevel * 5;
        // On additionne les perles trouvées lors de la partie ! Pas en double.
        window.totalPearls += window.sessionPearls + bonus;
        window.currentLevel += 1;
        saveProgress();

        document.getElementById('victory-pearls').innerText = window.sessionPearls;
        document.getElementById('victory-bonus').innerText = bonus;

        // Si on vient de battre le boss du Niveau 5 (on est passé nv 6 au dessus) sans le Trident, on lance l'animation Phaser !
        if (window.currentLevel === 6 && !window.hasTrident) {
            this.scene.start('CinematicScene');
        } else {
            document.getElementById('big-love-modal').classList.add('active');
        }
    }
}

// --- NOUVELLE SCÈNE CINÉMATIQUE (PHASE 4) ---
class CinematicScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CinematicScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#000022'); // Bleu nuit abyssal profond

        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        // Étoiles de fond
        for (let i = 0; i < 50; i++) {
            let star = this.add.circle(Math.random() * this.game.config.width, Math.random() * this.game.config.height, Math.random() * 2, 0xffffff, Math.random());
            this.tweens.add({ targets: star, alpha: 0, duration: 1000 + Math.random() * 2000, yoyo: true, repeat: -1 });
        }

        // Mimi arrive par le bas
        this.mimi = this.add.sprite(cx, this.game.config.height + 100, 'mermaid1').setScale(3);
        this.mimi.play('swim');

        // Nana descend du haut (Taille réduite pour plus de grâce et moins de pixels bruts)
        this.nana = this.add.sprite(cx, -150, 'nana').setScale(2);

        // Halo divin autour de Nana (Plus petit aussi)
        this.halo = this.add.circle(cx, -150, 80, 0xffdd00, 0.2);
        this.tweens.add({ targets: this.halo, scale: 1.2, alpha: 0.1, duration: 2000, yoyo: true, repeat: -1 });

        // Phase 1 : Rencontre
        this.tweens.add({
            targets: [this.mimi],
            y: cy + 100,
            duration: 3000,
            ease: 'Sine.easeOut'
        });

        this.tweens.add({
            targets: [this.nana, this.halo],
            y: cy - 100, // Plus proche pour ne pas écraser l'écran
            duration: 4000,
            ease: 'Sine.easeOut',
            onComplete: () => this.showDialogue()
        });
    }

    showDialogue() {
        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        let titleStr = window.getStr ? window.getStr('nanaTitle') : "PRINCESSE NANA LIBÉRÉE !";
        let descStr = window.getStr ? window.getStr('nanaDesc') : "Merci Mimi ! Prends ce Trident Magique...";

        // Fond semi-transparent pour rendre le texte toujours lisible, même sur de petits écrans
        this.textBg = this.add.graphics();
        this.textBg.fillStyle(0x000000, 0.7);
        this.textBg.fillRoundedRect(cx - 180, cy - 200, 360, 150, 16);
        this.textBg.setAlpha(0);

        let titleText = this.add.text(cx, cy - 160, titleStr, {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            fill: '#ffccff',
            align: 'center',
            wordWrap: { width: 320 }
        }).setOrigin(0.5).setAlpha(0);

        // On retire les balises HTML qui cassaient le rendu Phaser
        descStr = descStr.replace(/<[^>]*>?/gm, '');

        let descText = this.add.text(cx, cy - 100, descStr, {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 320 }
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: [this.textBg, titleText, descText], alpha: 1, duration: 2000 });

        this.time.delayedCall(4500, () => this.summonTrident(titleText, descText, this.textBg));
    }

    summonTrident(t1, t2, bg) {
        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        // Fait disparaître le texte
        this.tweens.add({ targets: [t1, t2, bg], alpha: 0, duration: 1000 });

        // Nana lève les bras (imagé par un effet de lumière)
        this.cameras.main.flash(500, 255, 255, 200);
        if (typeof window.playRecoverSound === 'function') window.playRecoverSound();

        // Le Trident Apparaît
        this.trident = this.add.sprite(cx, cy - 150, 'trident').setScale(1).setAlpha(0);

        this.tweens.add({
            targets: this.trident,
            alpha: 1,
            scale: 3, // Trident moins gros
            y: cy - 20,
            angle: 360,
            duration: 2000,
            ease: 'Cubic.easeOut',
            onComplete: () => this.giveTridentToMimi()
        });
    }

    giveTridentToMimi() {
        // Le trident lévite vers Mimi
        this.tweens.add({
            targets: this.trident,
            y: this.mimi.y,
            scale: 2,
            duration: 1500,
            ease: 'Sine.easeIn',
            onComplete: () => this.tridentFusion()
        });
    }

    tridentFusion() {
        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        this.trident.destroy();

        if (typeof window.playDolphinSound === 'function') window.playDolphinSound();
        this.cameras.main.flash(2000, 255, 255, 255); // Flashe tout blanc
        this.cameras.main.shake(1500, 0.02);

        // Explosion Arc-en-ciel
        const explosion = this.add.particles('sparkle').createEmitter({
            x: this.mimi.x,
            y: this.mimi.y,
            speed: { min: 200, max: 800 },
            angle: { min: 0, max: 360 },
            scale: { start: 4, end: 0 },
            tint: [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3],
            lifespan: 2000,
            blendMode: 'ADD'
        });
        explosion.explode(150);

        // Mimi devient lumineuse
        this.mimi.setTint(0x00ffff);

        // Texte final de validation
        let powerText = this.add.text(cx, cy - 100, "TRIDENT ARC-EN-CIEL ACQUIS !", {
            fontFamily: '"Press Start 2P"',
            fontSize: '16px',
            fill: '#00ffff',
            align: 'center'
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: powerText, alpha: 1, duration: 1000, yoyo: true, hold: 2000 });

        // Sauvegarder et passer au niveau suivant après l'animation
        window.hasTrident = true;
        localStorage.setItem('oceanBloomTrident', 'true');

        this.time.delayedCall(4500, () => {
            // Reprendre le flux de victoire standard (Écran big-love-modal)
            document.getElementById('big-love-modal').classList.add('active');

            // Revenir à la MainScene est géré par le rechargement de location.reload() dans index.html (t_btnNext / nextLevelFlow)
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
    scene: [MainScene, CinematicScene], // Déclarer les deux scènes
    backgroundColor: '#000000'
};

const game = new Phaser.Game(config);
window.gameInstance = game;