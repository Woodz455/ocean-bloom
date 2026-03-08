// --- GESTION DES ASSETS ---

// Outil pour créer les images depuis le texte
function generatePixelTexture(scene, key, art, palette, scale) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = art[0].length * scale;
    canvas.height = art.length * scale;
    for (let y = 0; y < art.length; y++) {
        for (let x = 0; x < art[y].length; x++) {
            const char = art[y][x];
            if (palette[char]) { ctx.fillStyle = palette[char]; ctx.fillRect(x * scale, y * scale, scale, scale); }
        }
    }
    scene.textures.addCanvas(key, canvas);
}

function loadGameAssets(scene) {
    // PALETTE DE COULEURS 16-BIT
    const p = {
        _: null,
        k: '#000000', w: '#ffffff', g: '#cccccc', // Contours et blancs
        R: '#ff0055', r: '#880022', // Cheveux sirène (clair/foncé)
        S: '#ffccaa', s: '#cc8866', // Peau sirène
        P: '#aa00ff', p: '#550088', // Haut (Violet)
        G: '#00ffaa', d: '#008855', D: '#004422', // Queue sirène & algues
        O: '#ffaa00', o: '#cc5500', Y: '#ffff00', // Poissons et perles
        B: '#00ccff', b: '#0066aa', // Variantes bleues
        X: '#885522', x: '#442200', // Déchets (Brun)
        c: '#ff4444', C: '#aa0000'  // Corail
    };

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 1 : Nage fluide)
    const m1 = [
        "_______kRkk_________",
        "______kRrRkkk_______",
        "_____kRRRrRRRk______",
        "____kRrrrrRrrRk_____",
        "___kRrrSSSSrrRRk____",
        "___kRrSkskSksRRk____",
        "___kRrrSSSSsrrRk____",
        "___kkkSSSSSSkkk_____",
        "____kkPPssPPkk______",
        "____kpPppppPpkk_____",
        "____kRRssssRkk______",
        "___kRrRGddGRrRk_____",
        "___kRkGGddGGkk______",
        "___kkkdddDDdk_______",
        "____kDDddDDDDk______",
        "____kDDDddDDDk______",
        "_____kDDDDDDk_______",
        "_____kGDDDDGk_______",
        "____kGGkDDkGGk______",
        "___kGGk____kGGk_____"
    ];
    generatePixelTexture(scene, 'mermaid1', m1, p, 3);

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 2 : Ondulation)
    const m2 = [
        "_______kRkk_________",
        "______kRrRkkk_______",
        "_____kRRRrRRRk______",
        "____kRrrrrRrrRk_____",
        "___kRrrSSSSrrRRk____",
        "___kRrSkskSksRRk____",
        "___kRrrSSSSsrrRk____",
        "___kkkSSSSSSkkk_____",
        "____kkPPssPPkk______",
        "____kpPppppPpkk_____",
        "____kRRssssRkk______",
        "___kRrRGddGRrRk_____",
        "___kRkkGGddGGk______",
        "___kk_kdddDDdk______",
        "______kDDddDDDDk____",
        "_______kDDDddDDDk___",
        "______kDDDDDDkk_____",
        "_____kGDDDDGk_______",
        "____kGGkDDkGGk______",
        "___kGGk____kGGk_____"
    ];
    generatePixelTexture(scene, 'mermaid2', m2, p, 3);

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 3 : Transition bas)
    const m3 = [
        "________kkk_________",
        "______kkRRRk________",
        "_____kRRRrRRRk______",
        "____kRrrrrRrrRk_____",
        "___kRrrSSSSrrRRk____",
        "___kRrSkskSksRRk____",
        "___kRrrSSSSsrrRk____",
        "___kkkSSSSSSkkk_____",
        "____kkPPssPPkk______",
        "____kpPppppPpkk_____",
        "____kRRssssRkk______",
        "___kRrRGddGRrRk_____",
        "__kkRkGGddGGkk______",
        "____kdddDDdkk_______",
        "_____kDDddDDDDk_____",
        "______kDDDddDDDk____",
        "_______kDDDDDDk_____",
        "________kGDDDDGk____",
        "_______kGGkDDkGGk___",
        "______kGGk____kGGk__"
    ];
    generatePixelTexture(scene, 'mermaid3', m3, p, 3);

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 4 : Remontée de queue)
    const m4 = [
        "_______kRkk_________",
        "______kRrRkkk_______",
        "_____kRRRrRRRk______",
        "____kRrrrrRrrRk_____",
        "___kRrrSSSSrrRRk____",
        "___kRrSkskSksRRk____",
        "___kRrrSSSSsrrRk____",
        "___kkkSSSSSSkkk_____",
        "____kkPPssPPkk______",
        "____kpPppppPpkk_____",
        "____kRRssssRkk______",
        "____kRrGddGRrRk_____",
        "___kkkGGddGGRRk_____",
        "______kdddDDdk______",
        "_____kDDddDDDDk_____",
        "____kDDDddDDDk______",
        "___kDDDDDDkk________",
        "____kGDDDDGk________",
        "___kGGkDDkGGk_______",
        "__kGGk____kGGk______"
    ];
    generatePixelTexture(scene, 'mermaid4', m4, p, 3);

    // CORAIL & ALGUES 16-BIT
    const coral = [
        "______kk________",
        "____kkcckk______",
        "___kccccCckk____",
        "_kkCcccccccCkk__",
        "kccCccccccccCck_",
        "kCCcCccccccCcck_",
        "_kkkccccCcCkkk__",
        "___kCCCcccCck___",
        "____kkkkkkkk____"
    ];
    generatePixelTexture(scene, 'coral_red', coral, p, 4);

    const weed = [
        "_______kk_______",
        "______kGGk______",
        "_____kGGddk_____",
        "______kGGk______",
        "_______kk_______",
        "______kGGk______",
        "_____kGGddk_____",
        "______kddk______",
        "_______kk_______"
    ];
    generatePixelTexture(scene, 'weed_green', weed, p, 4);
    generatePixelTexture(scene, 'weed_purple', weed, { ...p, G: '#aa44ff', d: '#550088' }, 4);

    // POISSON 16-BIT
    const fish_o = [
        "__________kk____",
        "________kkOOkk__",
        "______kkOOOOOkk_",
        "_____kOOkOwwOOk_",
        "___kkkOOOOoooOk_",
        "___kOOkkOOoooOkk",
        "___kOOOkkkOOOkk_",
        "____kOkk__kkOOk_",
        "_____k______kk__"
    ];
    generatePixelTexture(scene, 'fish_orange', fish_o, p, 3);
    generatePixelTexture(scene, 'fish_blue', fish_o, { ...p, O: '#00ccff', o: '#0066aa' }, 3);

    // TRASH (Déchets toxiques)
    const trashDesc = [
        "____kkkkk_______",
        "___kxxxxxk______",
        "__kxxxxxxxk_kk__",
        "_kXXxxXXxxxkkXk_",
        "_kxxxxxxxxxkxxk_",
        "_kxxXXXxxxxxxxk_",
        "__kxxxxxxxxxxk__",
        "___kkxxxxxxkk___",
        "_____kkkkkk_____"
    ];
    generatePixelTexture(scene, 'trash', trashDesc, p, 4);

    // PEARL (Bonus de vitesse)
    const pearlDesc = [
        "_____kkkk_______",
        "___kkYYYYkk_____",
        "__kYYwwYYYYk____",
        "_kYYwwYYYYYYk___",
        "_kYYYYYYYYYYk___",
        "_kYYYYYYYYYYk___",
        "__kYYYYYYYYk____",
        "___kkYYYYkk_____",
        "_____kkkk_______"
    ];
    generatePixelTexture(scene, 'pearl', pearlDesc, p, 3);

    // ENNEMI (Monstre de pollution 16-bit)
    const enemyDesc = [
        "_____kkkkkk_____",
        "___kkxxxxxxkk___",
        "__kxxkxxxxkxxk__",
        "_kxxxxRRxxxxxxk_",
        "_kxxkxxxxkxxxxk_",
        "_kxxxxxxxxxxxxk_",
        "__kxxXXXXXXxxk__",
        "___kxXXXXXXxk___",
        "____kkkkkkkk____"
    ];
    generatePixelTexture(scene, 'enemy', enemyDesc, p, 4);

    // --- ASSETS PHASE 6 : COURSE (CHASE) ---

    // VOLEUR FURTIF (Rapide, sombre avec des yeux jaunes)
    const thiefDesc = [
        "_______kk_______",
        "______kxxk______",
        "_____kxYYxk_____",
        "____kxxxxxxk____",
        "___kxxxxxxxxk___",
        "__kxXXXxxXXXxk__",
        "__kxxXXXXXXxxk__",
        "___kkxxxxxxkk___",
        "_____kkkkkk_____"
    ];
    generatePixelTexture(scene, 'thief', thiefDesc, p, 4);

    // MINE TOXIQUE (Obstacle statique dangereux)
    const mineDesc = [
        "____k__k__k_____",
        "____k__k__k_____",
        "___kkkkkkkkk____",
        "__kxxxxxxxxxk___",
        "k_kxxkkkxxk_k_k_",
        "_kkxkkxxkxkkkk__",
        "k_kxxRxxRxk_k_k_",
        "__kxxkkkxxk_____",
        "__kxxxxxxxxxk___",
        "___kkkkkkkkk____",
        "____k__k__k_____",
        "____k__k__k_____"
    ];
    generatePixelTexture(scene, 'mine', mineDesc, p, 4);

    // --- NOUVEAUX ASSETS PHASE 3 & 4 ---

    // BOSS NIVEAUX 1-2 (Monstre de Vase, rond et mou)
    const bossVaseDesc = [
        "______kkkkk_____",
        "_____kxxxxxk____",
        "___kkkxxxxkkk___",
        "__kxxxxkkxxxxk__",
        "__kxxkkRkRkkxxk_",
        "_kxxxxRRRRxxxxk_",
        "_kxxxxxxxxxxxxk_",
        "_kxxXXXXXXXXxxk_",
        "__kxxXXXXXXxxk__",
        "___kkxxxxxxkk___",
        "_____kkkkkk_____"
    ];
    generatePixelTexture(scene, 'boss_vase', bossVaseDesc, p, 5); // Taille moyenne

    // BOSS NIVEAUX 3-4 (Amalgame de Plastique, pointu)
    const bossPlastiqueDesc = [
        "_____k____k_____",
        "____kXk__kXk____",
        "__k_kXxkkxXk_k__",
        "_kXk_kxxxxk_kXk_",
        "kXXk__kxxk__kXXk",
        "_kxxkkkRkRkkkxxk",
        "__kxxxxRRxxxxk__",
        "___kxxxxxxxxk___",
        "___kxxXXXXxxk___",
        "_kkk_kxxxxk_kkk_",
        "kXk___kkkk___kXk",
        "_k____________k_"
    ];
    // Teinté en gris/cyan toxique pour le plastique
    const pPlastique = { ...p, x: '#557788', X: '#2244aa', R: '#ffaa00' };
    generatePixelTexture(scene, 'boss_plastique', bossPlastiqueDesc, pPlastique, 6);

    // BOSS NIVEAU 5 (Le terrible Geôlier de Pétrole)
    const bossPetroleDesc = [
        "________kkkkkkkk________",
        "______kkkxxxxxxkkk______",
        "_____kxxxxxxxxxxxxk_____",
        "____kxxxxxkkkkxxxxxk____",
        "___kxxxxkkRkkRkkxxxxk___",
        "__kxxxxxkRRRRRRkxxxxxk__",
        "__kxxXXXXXXXXXXXXXXxxk__",
        "_kxxXXXXXXXXXXXXXXXXxk__",
        "_kXXXXXXXXXXXXXXXXXXXXk_",
        "__kXXxXXxXXXXXXxXXxXXk__",
        "___kxXXkxxxXXxxxkXXxk___",
        "____kkxxkkkxxkkkxxkk____",
        "______kk___kk___kk______"
    ];
    // Pétrole = très sombre
    const pPetrole = { ...p, x: '#111111', X: '#000000', R: '#ff0000' };
    generatePixelTexture(scene, 'boss_petrole', bossPetroleDesc, pPetrole, 8); // Gigantesque !

    // PRINCESSE NANA (Teintes or et blanc)
    const nanaDesc = [
        "_______kYkk_________",
        "______kYwYkkk_______",
        "_____kYYYwYYYk______",
        "____kYwwwwYwwYk_____",
        "___kYwwSSSSwwYYk____",
        "___kYwSkskSksYYk____",
        "___kYwwSSSSswwYk____",
        "___kkkSSSSSSkkk_____",
        "____kkYYssYYkk______",
        "____kwYwwwwYwkk_____",
        "____kYYssssYkk______",
        "___kYwYWwwWwYwYk____",
        "___kYkWWwwWWkk______",
        "___kkkwwwWWwk_______",
        "____kWWwwWWWWk______",
        "____kWWWwwWWWk______",
        "_____kWWWWWWk_______",
        "_____kWWWWWWk_______",
        "____kWWkWWkWWk______",
        "___kWWk____kWWk_____"
    ];
    // Palette de Nana avec des écailles nacrées blanches (W)
    const pNana = { ...p, W: '#eeeeff', w: '#ffffff', Y: '#ffdd00' };
    generatePixelTexture(scene, 'nana', nanaDesc, pNana, 5); // Un peu plus grande

    // MALIK (Allié Sirène Mâle - Armure et queue émeraude)
    const malikDesc = [
        "_______kEkk_________",
        "______kEaEkkk_______",
        "_____kEEEaEEEk______",
        "____kEaaaaEaaEk_____",
        "___kEaaAAAAaaEEk____",
        "___kEaSkskSksEk_____",
        "___kEaaAAAAaaEk_____",
        "___kkkAAAAAAkkk_____",
        "____kkEEaaEEkk______",
        "____kaEaaaaEakk_____",
        "____kEEaaaaEkk______",
        "___kEaEAaAaEaEak____",
        "___kEkEEaaEEkk______",
        "___kkkaaaEEak_______",
        "____kEEaaEEEEk______",
        "____kEEEaaEEEk______",
        "_____kEEEEEEk_______",
        "_____kEEEEEEk_______",
        "____kEEkEEkEEk______",
        "___kEEk____kEEk_____"
    ];
    // E=Emeraude sombre, e=Emeraude clair, A=Armure sombre, a=Armure claire
    const pMalik = { ...p, E: '#008855', e: '#00cc77', A: '#888888', a: '#cccccc' };
    generatePixelTexture(scene, 'malik', malikDesc, pMalik, 5);


    // TRIDENT MAGIQUE
    const pTrident = { ...p, W: '#00ffff', Y: '#ffdd00' }; // W = Cyan brillant, Y = Or
    const tridentDesc = [
        "W_W_W",
        "W_W_W",
        "WYWYW",
        "_YYY_",
        "__Y__",
        "__Y__",
        "__Y__",
        "__Y__",
        "__Y__",
        "__Y__",
        "__Y__"
    ];
    generatePixelTexture(scene, 'trident', tridentDesc, pTrident, 5);

    // DAUPHIN (Le sauveur classique)
    const dolphinDesc = [
        "__________________kkk_________",
        "_______________kkkBBBkkk______",
        "____________kkkBBBBBBBBBkk____",
        "__________kkBBBbbbbbbbbbBBkk__",
        "________kkBBBbbbbbbbbbbbbbBBk_",
        "______kkBBBbbbbbbbbkkbbbBkwBk_",
        "_____kBBBbbbbbbbbbbkkbbbwwwBk_",
        "____k_kBBBbbbbbbbbbbbbwwwwBBk_",
        "___k___kBBBbbbbbbbbbwwwwwBBk__",
        "___kk___kkBBBbbbbwwwwBBBBkk___",
        "_________kkBBBBwwwwwBBkk______",
        "___________kkkk___kkk_________"
    ];
    generatePixelTexture(scene, 'dolphin', dolphinDesc, p, 4);

    // DAUPHIN ELECTRIQUE (Super pouvoir divin avec traînée)
    const electricDolphinDesc = [
        "__________________www_________",
        "Y______________wwwYYYwww______",
        "wY__________wwwYYYYYYYYYww____",
        "_wY_______wwYYYBBBBBBBBBYYww__",
        "__wY____wwYYYBBBBBBBBBBBBBYYw_",
        "___w__wwYYYBBBBBBBBBkkBBBYkwYw",
        "w_w_wwYYYBBBBBBBBBBBkkBBBwwwYw",
        "Yw_w_wYYYBBBBBBBBBBBBwwwwYYw__",
        "_Yw___wYYYBBBBBBBBBwwwwwYYw___",
        "___ww__wwYYYBBBBwwwwYYYYww____",
        "_________wwYYYYwwwwwYYww______",
        "___________wwww___www_________"
    ];
    generatePixelTexture(scene, 'electric_dolphin', electricDolphinDesc, p, 4);

    // PROJECTILES
    // Tir Magique de Mimi
    const mimiShot = [
        "_kYk_",
        "kYYYk",
        "_kYk_"
    ];
    generatePixelTexture(scene, 'mimi_shot', mimiShot, p, 4);

    // Tir Toxique du Boss
    const bossShot = [
        "_kxk_",
        "kxxxk",
        "_kxk_"
    ];
    generatePixelTexture(scene, 'boss_shot', bossShot, p, 5);

    // --------------------------------

    // BROSSE DE NETTOYAGE (Un rond flou blanc avec un noyau intense)
    // La taille de base est de 160, et augmente de 20 (originalement 30) par niveau d'amélioration
    let brushLevel = parseInt(localStorage.getItem('oceanBloomBrush')) || 1;
    const brushSize = 160 + ((brushLevel - 1) * 30);
    const brush = scene.make.graphics({ x: 0, y: 0, add: false });

    // Dégradé radial pour un effet de lumière douce (Glow)
    brush.fillStyle(0xffffff, 0.1);
    brush.fillCircle(brushSize / 2, brushSize / 2, brushSize / 2);
    brush.fillStyle(0xffffff, 0.3);
    brush.fillCircle(brushSize / 2, brushSize / 2, brushSize / 2.5);
    brush.fillStyle(0xffffff, 0.6);
    brush.fillCircle(brushSize / 2, brushSize / 2, brushSize / 4);
    brush.fillStyle(0xffffff, 1);
    brush.fillCircle(brushSize / 2, brushSize / 2, brushSize / 8); // Cœur

    brush.generateTexture('eraserBrush', brushSize, brushSize);

    // BULLE (Particules d'eau)
    const bubbleBrush = scene.make.graphics({ x: 0, y: 0, add: false });
    bubbleBrush.fillStyle(0xffffff, 0.6);
    bubbleBrush.fillCircle(4, 4, 4);
    bubbleBrush.generateTexture('bubble', 8, 8);

    // ETINCELLES (Particules de magie nettoyante)
    const sparkleBrush = scene.make.graphics({ x: 0, y: 0, add: false });
    sparkleBrush.fillStyle(0x00ffaa, 1); // Vert d'eau brillant
    sparkleBrush.fillRect(0, 2, 6, 2);
    sparkleBrush.fillRect(2, 0, 2, 6);
    sparkleBrush.generateTexture('sparkle', 6, 6);

    // FOND (Couleurs changeantes selon le niveau)
    const bgGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
    const tileSize = 64;

    // Définir la palette du biome selon le level
    let lvl = window.currentLevel || 1;
    let color1, color2;

    if (lvl % 4 === 1) {
        // Niveau 1, 5, 9... : Bleu classique
        color1 = 0x004488; color2 = 0x005599;
    } else if (lvl % 4 === 2) {
        // Niveau 2, 6, 10... : Cyan tropical
        color1 = 0x0088aa; color2 = 0x0099bb;
    } else if (lvl % 4 === 3) {
        // Niveau 3, 7, 11... : Vert lagon
        color1 = 0x006655; color2 = 0x007766;
    } else {
        // Niveau 4, 8, 12... : Violet abysses
        color1 = 0x330066; color2 = 0x440077;
    }

    for (let y = 0; y < tileSize; y += 8) {
        for (let x = 0; x < tileSize; x += 8) {
            let color = (Math.random() > 0.5) ? color1 : color2;
            bgGraphics.fillStyle(color);
            bgGraphics.fillRect(x, y, 8, 8);
        }
    }
    bgGraphics.generateTexture('ocean_bg', tileSize, tileSize);
}
