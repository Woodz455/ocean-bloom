// --- GESTIONNAIRE DE NIVEAU PROCÉDURAL ---
export function generateEnvironment(scene, levelW, levelH) {
    scene.add.tileSprite(levelW / 2, levelH / 2, levelW, levelH, 'ocean_bg').setDepth(0);

    let lvl = window.currentLevel || 1;
    let biomeType = 'lagoon';
    let bgTint = 0xffffff;   // multiplicateur de teinte des sprites de décor (0xffffff = neutre)
    let camBg = 0x02243d;    // couleur hors-limites : eau profonde, surtout jamais blanc
    let pollTint = 0x2b3a1f; // vase brun-vert : on doit deviner le monde sous la pollution

    if (lvl >= 10) { biomeType = 'ruins'; bgTint = 0x5555aa; camBg = 0x0b0620; pollTint = 0x241a3a; }
    else if (lvl >= 7) { biomeType = 'volcanic'; bgTint = 0xffaaaa; camBg = 0x200806; pollTint = 0x3d1a0a; }
    else if (lvl >= 4) { biomeType = 'caves'; bgTint = 0x55aaff; camBg = 0x03182b; pollTint = 0x123043; }

    scene.cameras.main.setBackgroundColor(camBg);

    // Chaque famille de décor existe en trois formes ('', '_b', '_c'), dessinées aux
    // mêmes dimensions. C'est ce qui remplace la mise à l'échelle aléatoire supprimée
    // avec l'unification de la grille : la variété redevient un choix de dessin.
    const shapes = key => [key, key + '_b', key + '_c'];

    let obstacleKeys = [];
    if (biomeType === 'lagoon') obstacleKeys = [...shapes('coral_red'), ...shapes('weed_green'), ...shapes('weed_green'), ...shapes('weed_purple')];
    if (biomeType === 'caves') obstacleKeys = [...shapes('crystal_blue'), ...shapes('crystal_blue'), ...shapes('weed_purple')];
    if (biomeType === 'volcanic') obstacleKeys = [...shapes('coral_red'), 'volcanic_vent', 'volcanic_vent', 'volcanic_vent', ...shapes('weed_purple')];
    if (biomeType === 'ruins') obstacleKeys = [...shapes('sunken_pillar'), ...shapes('weed_green'), ...shapes('weed_purple')];

    scene.obstacles = scene.physics.add.staticGroup();
    scene.hazards = scene.physics.add.group(); // Geysers & Mines
    
    for (let i = 0; i < 140; i++) {
        let x = Math.random() * levelW;
        let y = Math.random() * levelH;
        let key = obstacleKeys[Math.floor(Math.random() * obstacleKeys.length)];
        let spr;

        // Test par PRÉFIXE et non par égalité : avec l'égalité stricte, 'coral_red_b'
        // tombait dans la branche du décor sans corps physique et le corail devenait
        // traversable. Le suffixe de variante ne doit rien changer au comportement.
        const isObstacle = ['coral_red', 'crystal_blue', 'sunken_pillar'].some(fam => key.startsWith(fam));

        if (isObstacle) {
            spr = scene.obstacles.create(x, y, key);
            // La taille et l'angle étaient tirés au hasard à CHAQUE instance : un même
            // corail apparaissait avec des pixels de 2,4 à 3,9 px selon le tirage, et
            // penché de quelques degrés — une rotation sur du pixel art déchire les
            // contours autant qu'un changement d'échelle. La variété passe désormais
            // par le miroir et la teinte, qui ne coûtent pas un pixel.
            spr.setFlipX(Math.random() > 0.5);
            spr.body.setCircle(15);
            spr.body.setOffset(20, 20);
            if (biomeType !== 'lagoon') spr.setTint(bgTint);
        } else if (key === 'volcanic_vent') {
            let vent = scene.hazards.create(x, y, 'volcanic_vent');
            vent.hazardType = 'vent';
            vent.setDepth(5);
            vent.setImmovable(true);
            vent.body.setCircle(15);
            vent.anims.play(window.ensureAnim(scene, 'vent_glow',
                ['volcanic_vent', 'volcanic_vent2', 'volcanic_vent', 'volcanic_vent3'], 4), true);
            vent.anims.setProgress(Math.random());
        }
        else {
            spr = scene.add.image(x, y, key);
            spr.setFlipX(Math.random() > 0.5);
            // Le balancement est conservé : c'est une animation, et le mouvement absorbe
            // l'aliasing de la rotation. Seul l'angle FIXE tiré au hasard disparaît —
            // lui laissait un contour déchiré en permanence.
            scene.tweens.add({ targets: spr, angle: { from: -15, to: 15 }, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1 });
            if (biomeType !== 'lagoon') spr.setTint(bgTint);
        }
    }

    // Poissons Décoratifs
    scene.backgroundFish = [];
    scene.helperFishes = []; 
    for (let i = 0; i < 60; i++) {
        let keys = ['fish_orange', 'fish_blue'];
        let fishKey = keys[Math.floor(Math.random() * keys.length)];
        let f = scene.add.sprite(Math.random() * levelW, Math.random() * levelH, fishKey);
        // Soixante poissons par niveau, tous parfaitement rigides : la faune d'ambiance
        // ne coûtait rien à animer et c'est elle qui remplit l'écran.
        f.anims.play(window.ensureAnim(scene, fishKey + '_swim',
            [fishKey, fishKey + '2', fishKey, fishKey + '3'], 6), true);
        f.anims.setProgress(Math.random()); // sinon les 60 battent de la queue à l'unisson
        f.customSpeed = (Math.random() * 2 + 1);
        if (biomeType === 'caves' || biomeType === 'ruins') f.setTint(0x88ffff);
        if (biomeType === 'volcanic') f.setTint(0xff8888);
        scene.backgroundFish.push(f);
    }

    // Couche de pollution (RenderTexture)
    scene.pollutedLayer = scene.make.renderTexture({ x: 0, y: 0, width: levelW, height: levelH }, true);
    scene.pollutedLayer.fill(pollTint, 0.72);
    scene.pollutedLayer.setDepth(10);

    // Brosses (Gérées via graphics)
    let brushFish = scene.make.graphics({ x: 0, y: 0, add: false });
    brushFish.fillStyle(0xffffff, 1);
    brushFish.fillCircle(15, 15, 15);
    brushFish.generateTexture('fishBrush', 30, 30);
    brushFish.destroy();

    let brushMalik = scene.make.graphics({ x: 0, y: 0, add: false });
    brushMalik.fillStyle(0xffffff, 1);
    brushMalik.fillCircle(150, 150, 150);
    brushMalik.generateTexture('malikBrush', 300, 300);
    brushMalik.destroy();

    // Groupes dynamiques
    scene.trashes = scene.physics.add.group();
    scene.pearls = scene.physics.add.group();
    scene.enemyGroup = scene.physics.add.group();
    scene.enemies = [];
    
    scene.pollutionSpots = [];
    scene.totalPollution = 0;
    scene.cleanedPollution = 0;

    // PLAFONDS D'ENTITÉS.
    // Sans eux, le niveau 10 produisait ~600 déchets et ~200 ennemis, chacun avec un
    // corps physique ET un tween en boucle infinie : près de 920 tweens itérés à chaque
    // frame par le moteur, plus ~800 corps dans le solveur. Injouable sur téléphone.
    // La difficulté continue de monter via les probabilités, mais bute sur un plafond.
    const MAX_TRASH = 180;
    const MAX_ENEMIES = 60;
    let trashCount = 0, enemyCount = 0;

    let trashChance = 0.4 + (lvl * 0.05);
    let enemyChance = 0.1 + (lvl * 0.02);

    let numClusters = Math.min(20 + lvl * 5, 45);

    for (let i=0; i < numClusters; i++) {
        let cx = 100 + Math.random() * (levelW - 200);
        let cy = 100 + Math.random() * (levelH - 200);
        
        let spotsInCluster = 5 + Math.floor(Math.random() * 10);
        for(let s=0; s<spotsInCluster; s++) {
            let px = Math.max(0, Math.min(levelW, cx + (Math.random() - 0.5) * 200));
            let py = Math.max(0, Math.min(levelH, cy + (Math.random() - 0.5) * 200));
            
            scene.pollutionSpots.push({ x: px, y: py, cleaned: false });
            scene.totalPollution++;
            
            let distToCenter = Phaser.Math.Distance.Between(px, py, levelW / 2, levelH / 2);
            if (distToCenter > 300) {
                if (trashCount < MAX_TRASH && Math.random() < trashChance) {
                    trashCount++;
                    let trash = scene.trashes.create(px, py, 'trash');
                    trash.setDepth(15);
                    scene.tweens.add({ targets: trash, y: trash.y - 15, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1 });
                }

                if (enemyCount < MAX_ENEMIES && Math.random() < enemyChance) {
                    enemyCount++;
                    let enemy = scene.enemyGroup.create(px, py, 'enemy');
                    enemy.setDepth(16);
                    enemy.anims.play(window.ensureAnim(scene, 'enemy_idle',
                        ['enemy', 'enemy2', 'enemy', 'enemy3'], 5), true);
                    enemy.anims.setProgress(Math.random());
                    if (biomeType === 'caves') enemy.setTint(0x88ffff);
                    if (biomeType === 'volcanic') enemy.setTint(0xff5555);
                    scene.enemies.push(enemy);

                    let enemyDur = Math.max(1000, 3000 + Math.random() * 2000 - (lvl * 150));
                    scene.tweens.add({
                        targets: enemy,
                        x: enemy.x + (Math.random() > 0.5 ? 50 : -50),
                        y: enemy.y + (Math.random() > 0.5 ? 50 : -50),
                        duration: enemyDur,
                        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                    });
                }
            }
        }
    }
    
    // Mines (Hazards)
    if (biomeType === 'ruins' || biomeType === 'volcanic') {
        let numMines = lvl * 3;
        for (let m=0; m<numMines; m++) {
            let mx = 300 + Math.random() * (levelW - 600);
            let my = 300 + Math.random() * (levelH - 600);
            let dist = Phaser.Math.Distance.Between(mx, my, levelW / 2, levelH / 2);
            if (dist > 400) {
                let mine = scene.hazards.create(mx, my, 'mine');
                mine.hazardType = 'mine';
                mine.setDepth(14);
                mine.setTint(0xff5555);
                // Le tween scale: 1.1 était la dernière entorse à la grille unifiée —
                // il affichait des pixels de 3,3 px. C'est la diode qui clignote
                // maintenant, pas le sprite qui enfle.
                mine.anims.play(window.ensureAnim(scene, 'mine_blink', ['mine', 'mine2'], 3), true);
                mine.anims.setProgress(Math.random());
            }
        }
    }

    // Zones Secrètes (Big Stashes)
    let numSecrets = 1 + Math.floor(Math.random() * 2);
    for (let s=0; s<numSecrets; s++) {
        let sx = Math.random() > 0.5 ? 200 + Math.random()*200 : levelW - 200 - Math.random()*200;
        let sy = Math.random() > 0.5 ? 200 + Math.random()*200 : levelH - 200 - Math.random()*200;
        
        let glow = scene.add.particles('sparkle').createEmitter({
            x: sx, y: sy, speed: 20, scale: { start: 1.5, end: 0 }, tint: 0xffff00, blendMode: 'ADD', lifespan: 2000
        });
        
        for(let a=0; a<Math.PI*2; a+=0.6) {
            let px = sx + Math.cos(a) * 60;
            let py = sy + Math.sin(a) * 60;
            let pearl = scene.pearls.create(px, py, 'pearl');
            pearl.setDepth(15);
            // L'oscillation d'alpha reste : elle ne touche pas à la taille du pixel.
            // Seul le gonflement de 50 % disparaît, remplacé par le reflet qui glisse.
            pearl.anims.play(window.ensureAnim(scene, 'pearl_glint',
                ['pearl', 'pearl2', 'pearl3', 'pearl2'], 4), true);
            pearl.anims.setProgress(Math.random());
            scene.tweens.add({ targets: pearl, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
        }
    }
}

export function updateBackgroundFishes(scene, time) {
    let boundsW = scene.physics.world.bounds.width;
    let boundsH = scene.physics.world.bounds.height;
    scene.backgroundFish.forEach(fish => {
        fish.x += fish.customSpeed;
        if (fish.x > boundsW + 50) {
            fish.x = -50;
            fish.y = Math.random() * boundsH;
        }
        fish.y += Math.sin(time / 500 + fish.x) * 0.5;
    });
}
