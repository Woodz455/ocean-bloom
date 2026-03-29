// --- GESTIONNAIRE DE NIVEAU PROCÉDURAL ---
export function generateEnvironment(scene, levelW, levelH) {
    scene.add.tileSprite(levelW / 2, levelH / 2, levelW, levelH, 'ocean_bg').setDepth(0);

    let lvl = window.currentLevel || 1;
    let biomeType = 'lagoon';
    let bgTint = 0xffffff;
    let pollTint = 0x000000;
    
    if (lvl >= 10) { biomeType = 'ruins'; bgTint = 0x5555aa; pollTint = 0x110022; }
    else if (lvl >= 7) { biomeType = 'volcanic'; bgTint = 0xffaaaa; pollTint = 0x330000; }
    else if (lvl >= 4) { biomeType = 'caves'; bgTint = 0x55aaff; pollTint = 0x001122; }

    scene.cameras.main.setBackgroundColor(bgTint);

    let obstacleKeys = [];
    if (biomeType === 'lagoon') obstacleKeys = ['coral_red', 'weed_green', 'weed_green', 'weed_purple'];
    if (biomeType === 'caves') obstacleKeys = ['crystal_blue', 'crystal_blue', 'weed_purple'];
    if (biomeType === 'volcanic') obstacleKeys = ['coral_red', 'volcanic_vent', 'weed_purple'];
    if (biomeType === 'ruins') obstacleKeys = ['sunken_pillar', 'weed_green', 'weed_purple'];

    scene.obstacles = scene.physics.add.staticGroup();
    scene.hazards = scene.physics.add.group(); // Geysers & Mines
    
    for (let i = 0; i < 140; i++) {
        let x = Math.random() * levelW;
        let y = Math.random() * levelH;
        let key = obstacleKeys[Math.floor(Math.random() * obstacleKeys.length)];
        let spr;

        if (key === 'coral_red' || key === 'crystal_blue' || key === 'sunken_pillar') {
            spr = scene.obstacles.create(x, y, key);
            let sc = Math.random() * 0.5 + 0.8;
            spr.setScale(sc);
            spr.body.setCircle(15 * sc);
            spr.body.setOffset(20, 20);
            spr.setAngle(Math.random() * 20 - 10);
            if (biomeType !== 'lagoon') spr.setTint(bgTint);
        } else if (key === 'volcanic_vent') {
            let vent = scene.hazards.create(x, y, 'volcanic_vent');
            vent.hazardType = 'vent';
            vent.setDepth(5);
            vent.setImmovable(true);
            vent.body.setCircle(15);
            scene.tweens.add({ targets: vent, scaleY: 1.1, duration: 800, yoyo: true, repeat: -1});
        }
        else {
            spr = scene.add.image(x, y, key);
            spr.setScale(Math.random() * 0.5 + 0.8);
            spr.setAngle(Math.random() * 20 - 10);
            scene.tweens.add({ targets: spr, angle: { from: -15, to: 15 }, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1 });
            if (biomeType !== 'lagoon') spr.setTint(bgTint);
        }
    }

    // Poissons Décoratifs
    scene.backgroundFish = [];
    scene.helperFishes = []; 
    for (let i = 0; i < 60; i++) {
        let keys = ['fish_orange', 'fish_blue'];
        let f = scene.add.sprite(Math.random() * levelW, Math.random() * levelH, keys[Math.floor(Math.random() * keys.length)]);
        f.customSpeed = (Math.random() * 2 + 1);
        if (biomeType === 'caves' || biomeType === 'ruins') f.setTint(0x88ffff);
        if (biomeType === 'volcanic') f.setTint(0xff8888);
        scene.backgroundFish.push(f);
    }

    // Couche de pollution (RenderTexture)
    scene.pollutedLayer = scene.make.renderTexture({ x: 0, y: 0, width: levelW, height: levelH }, true);
    scene.pollutedLayer.fill(pollTint, 0.9);
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

    let trashChance = 0.4 + (lvl * 0.05); 
    let enemyChance = 0.1 + (lvl * 0.02); 
    
    let numClusters = 20 + lvl * 5;
    
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
                if (Math.random() < trashChance) {
                    let trash = scene.trashes.create(px, py, 'trash');
                    trash.setDepth(15);
                    scene.tweens.add({ targets: trash, y: trash.y - 15, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1 });
                }
                
                if (Math.random() < enemyChance) {
                    let enemy = scene.enemyGroup.create(px, py, 'enemy');
                    enemy.setDepth(16);
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
                scene.tweens.add({ targets: mine, scale: 1.1, duration: 500, yoyo: true, repeat: -1 });
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
            scene.tweens.add({ targets: pearl, scaleX: 1.5, scaleY: 1.5, alpha: 0.9, duration: 800, yoyo: true, repeat: -1 });
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
