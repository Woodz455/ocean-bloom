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

    // PALETTE DE COULEURS 16-BIT
    const pNature = {
        '_': null,
        '0': '#001122', // Ombre fond marin
        'c': '#ff0055', 'C': '#ff55aa', '1': '#ff99cc', // Corail rouge/rose
        '2': '#00ff88', '3': '#55ffaa', // Algue verte
        '4': '#aa00ff', '5': '#dd55ff'  // Algue violette
    };
    const coralDesc = [
        "______________00________________",
        "___00_______001100________00____",
        "__0CC0_____001CC100______0110___",
        "_01CC10____01CCCC10_____0C1C10__",
        "0C1cc1C0__01CccccC10___0C1cc1C0_",
        "0CcccC1C0_0C1ccc1C10__0C1cc1C10_",
        "0Cccc1C10_0Ccc1cccC0_0C1cc1C100_",
        "_0C1c1C00__0C1cc1C00_0Cccc1C0___",
        "__01C10_____0C1C10____01C100____",
        "___000_______0000______000______"
    ];
    generatePixelTexture(scene, 'coral_red', coralDesc, pNature, 3);

    const weedDesc = [
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______",
        "_____0330_____",
        "____032230____",
        "_____0220_____",
        "______00______"
    ];
    generatePixelTexture(scene, 'weed_green', weedDesc, pNature, 3);
    generatePixelTexture(scene, 'weed_purple', weedDesc, { ...pNature, '2': '#aa00ff', '3': '#dd55ff' }, 3);

    // POISSONS HD (Faune d'ambiance — Forme réaliste avec nageoires et queue)
    const pFish = {
        '_': null,
        '0': '#000000', // Contour
        'B': '#ff6600', // Corps principal (vif)
        'b': '#ff9933', // Corps clair
        'H': '#ff4400', // Tête / dos foncé
        'h': '#ffbb55', // Ventre clair
        'F': '#ff5500', // Nageoires
        'f': '#ff7722', // Nageoires clair
        'T': '#cc3300', // Queue
        't': '#ff4411', // Queue clair
        'E': '#ffffff', // Oeil blanc
        'e': '#000000', // Pupille
        'L': '#ffddaa'  // Lumière / reflet
    };
    const fishDesc = [
        "_________0000________________",
        "___000__0FffF0_______________",
        "__0HHH00BBBBBb000____________",
        "_0HHHBBBBBBBBBBBB000_________",
        "0THHBBBBBEeBBBBBBBBB00__00___",
        "0ttHBBBBBBBBBbbbbBBBB00_0f0__",
        "0TtHBBBBBBBBBbhhhbBBBBB0Ff0__",
        "0ttHBBBBBBBBBbbbbBBBB00_0f0__",
        "0THHBBBBBLLBBBBBBBBb00__00___",
        "_0HHHBBBBBBBBBBBB000_________",
        "__0HHH00BBBBBb000____________",
        "___000__0FffF0_______________",
        "_________0000________________"
    ];
    generatePixelTexture(scene, 'fish_orange', fishDesc, pFish, 3);
    generatePixelTexture(scene, 'fish_blue', fishDesc, {
        ...pFish,
        'B': '#0066cc', 'b': '#0099ff', // Corps
        'H': '#003399', 'h': '#66ccff', // Tête foncée / Ventre clair
        'F': '#0044aa', 'f': '#0077cc', // Nageoires
        'T': '#002277', 't': '#0055aa', // Queue
        'L': '#aaddff'                  // Reflet
    }, 3);

    // TRASH (Amas toxique, déchets pétroliers compactés)
    const pTrash = {
        '_': null,
        '0': '#000000', // Noir profond industriel
        '1': '#1a0d00', // Pétrole abyssal
        '2': '#331a00', // Vase foncée
        '3': '#4d2600', // Vase moyenne
        '4': '#663300', // Vase claire
        'X': '#666666', // Feraille
        'Y': '#ffff00', // Reflet toxique / bidon jaune
        'R': '#ff0000'  // Clignotant ou danger
    };
    const trashDesc = [
        "_______0000000________",
        "_____00333333300______",
        "____0123444443210_____",
        "___012334444332110____",
        "___012334XXXX32210____",
        "__012234XXXXXY43210___",
        "__012234XXXXXY43210___",
        "__0112334XXXX332110___",
        "__01123344444332110___",
        "___012233444332110____",
        "___011223333221110____",
        "____0011222111000_____",
        "______00000000________"
    ];
    generatePixelTexture(scene, 'trash', trashDesc, pTrash, 4);

    // MINE (Style Super Metroid / Techno-Abyssal)
    const pMine = {
        '_': null,
        '0': '#000000', // Noir Outline
        '1': '#111111', // Métal sombre
        '2': '#333333', // Métal
        '3': '#555555', // Métal clair
        '4': '#777777', // Highlight
        'R': '#ff0000', // Rouge clignotant
        'O': '#ff8800'  // Ornement
    };
    const mineDesc = [
        "________00____________",
        "______003300__________",
        "_____03344330_________",
        "____0344444330________",
        "_00_0344444330_00_____",
        "0220_03444330_0220____",
        "0223000R00R0003220____",
        "023300R0000R003320____",
        "_00_03R0000R30_00_____",
        "____034R00R430________",
        "_____034RR430_________",
        "______003300__________",
        "________00____________"
    ];
    // Attention mine originelle (rouge) 
    generatePixelTexture(scene, 'mine', mineDesc, pMine, 4);

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

    // ENNEMI (Visage du monstre style retro -> Mutant HD)
    const pBoss = {
        '_': null,
        '0': '#000000', // Outline épaisse
        '1': '#220033', // Violet sombre chair
        '2': '#440066', // Violet
        '3': '#660099', // Violet clair (muscle)
        '4': '#aa00ff', // Violet fluo
        'R': '#ff0000', // Oeil Rouge Veineux
        'O': '#ffaa00', // Oeil Jaune (iris)
        'V': '#00ff00', // Vasque verte toxique / Bave
        'v': '#005500'  // Vasque foncée fluo
    };

    const bossDesc = [
        "_____________000000_______________",
        "___________0011111100_____________",
        "_________00112222221100________00_",
        "________0112223333222110_____00v0_",
        "_______011223333333322110___01vV0_",
        "______01123344444443322110_01vV0__",
        "______0123344400044433221001vv0___",
        "_____0123444400O004444322111v0____",
        "_____013444440ORR04444332211v0____",
        "_____013444440RR00444433221110____",
        "_____0123444400004444332211110____",
        "_____0123344444444443332211100____",
        "______01223334444433322111100_____",
        "______011222333333222111100_______",
        "_______001111222111111000_________",
        "_________0001111111000____________",
        "___________00000000_______________"
    ];
    // Ennemi standard prend cette forme de mutant
    generatePixelTexture(scene, 'enemy', bossDesc, pBoss, 5);

    // --- ASSETS PHASE 6 : COURSE (CHASE) ---

    // VOLEUR FURTIF HD (Ombre véloce)
    const pThief = {
        '_': null,
        '0': '#000000', '1': '#111122', '2': '#222244',
        'Y': '#ffff00', 'y': '#ccaa00'
    };
    const thiefDesc = [
        "__________00____________00________",
        "_________0220__________0220_______",
        "________021120________021120______",
        "_______0210012000000002100120_____",
        "______0210__012222222210__0120____",
        "_____0210____0111111110____0120___",
        "____0210_____0100000010_____0120__",
        "___0210______010YYYY010______0120_",
        "__0210_______010yyyy010_______0120",
        "_0210________0100000010________010",
        "0220__________01111110__________00",
        "000____________000000_____________"
    ];
    generatePixelTexture(scene, 'thief', thiefDesc, pThief, 3);

    // --- NOUVEAUX ASSETS PHASE 3 & 4 ---

    // BOSS VASE (Mutant géant baveux)
    const bossVaseDesc = [
        "_______________0000000_____________",
        "____________000vvvvVvv00___________",
        "__________00vvvv11111vvv00_________",
        "_________0vvVvv1122211VvvV0________",
        "________0vVVvv112333211vvVv0_______",
        "_______0vVvvv11234443211vvvV0______",
        "_______0Vvvv1123400043211vVvV0_____",
        "______0VvVvv11340ORO043211Vvv0_____",
        "______0vvvVv11340000043211vvVv0____",
        "______0vVvvV1123444443211vvvvv0____",
        "______0Vvvvvv11233332211vvVvVv0____",
        "_______0vVvvvv11111111vvvVvvv0_____",
        "________0vvvvvvvvvvvvvvvvVvv0______",
        "_________00vVvVvvvvvvVvvvv00_______",
        "___________000000000000000_________"
    ];
    generatePixelTexture(scene, 'boss_vase', bossVaseDesc, pBoss, 7);

    // BOSS PLASTIQUE (Sacs et bouteilles agglomérés)
    const pBossPlastique = { ...pBoss, 'V': '#aaaaaa', 'v': '#555555', '3': '#ffffff', '4': '#00ffff' };
    generatePixelTexture(scene, 'boss_plastique', bossVaseDesc, pBossPlastique, 7);

    // BOSS PETROLE (Ennemi noir massif)
    const pPetrole = { ...pBoss, 'V': '#111111', 'v': '#000000', '1': '#333333', '2': '#111111', '3': '#555555', '4': '#000000' };
    generatePixelTexture(scene, 'boss_petrole', bossVaseDesc, pPetrole, 8);

    // TRIDENT MAGIQUE HD
    const pTridentBase = {
        '_': null,
        'O': '#1e1b4b', 'H': '#92400e', 'h': '#451a03',
        'S': '#d97706', 'M': '#b45309', 's': '#78350f',
        'T': '#2dd4bf', 'B': '#0d9488', 't': '#0f766e',
        'G': '#fbbf24', 'g': '#b45309', 'W': '#f8fafc',
        'w': '#94a3b8'
    };
    const pTrident = { ...pTridentBase, 'C': '#00ffff', 'c': '#0088cc', '0': '#000000', '1': '#ffffff', 'Y': '#ffff00', 'y': '#bbbb00' };
    const tridentDesc = [
        "___000___000___000___",
        "__0CCC0_0CCC0_0CCC0__",
        "__0c1c0_0c1c0_0c1c0__",
        "__0c1c0_0c1c0_0c1c0__",
        "__0ccc000ccc000ccc0__",
        "___0Yc000Yc000Yc00___",
        "____0YY00YY00YY0_____",
        "_____0YyyyyyyyY0_____",
        "______0000Y0000______",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0Y0_________",
        "_________0y0_________",
        "_________0y0_________",
        "__________0__________"
    ];
    generatePixelTexture(scene, 'trident', tridentDesc, pTrident, 3);

    // DAUPHIN HD
    const pDolphin = {
        '_': null,
        '0': '#001a33', '1': '#336699', '2': '#6699cc', '3': '#99ccff',
        'W': '#ffffff', 'b': '#000000'
    };
    const dolphinDesc = [
        "________________________________",
        "____________________000_________",
        "_________________00011100_______",
        "______________0001112221100_____",
        "___________00011222333221110____",
        "_________0011223333333322110____",
        "________011233333W333ww3210_____",
        "______001233333333333wbw110_____",
        "____00112233333333333www10______",
        "___0111222233333333333w10_______",
        "___0111112222222333322100_______",
        "____0011111100022211100_________",
        "______000000___000000___________"
    ];
    generatePixelTexture(scene, 'dolphin', dolphinDesc, pDolphin, 3);

    // DAUPHIN ELECTRIQUE HD
    const electricDolphinDesc = [
        "YYY_________________________YYY_",
        "___YYY______________000____Y____",
        "Y_______YYYY_____00011100_______",
        "__YY___Y______0001112221100_____",
        "_____YY____00011222WW3221110__Y_",
        "__Y______001122WW33333322110____",
        "_Y__YY__0112W33333W333ww3210_Y__",
        "___Y__0012W3333333333wbw110_____",
        "__Y_001122W3333333333www10___Y__",
        "YY_01112222WW333333333w10__Y_Y__",
        "_Y_0111112222222WWW322100_Y___Y_",
        "Y___0011111100022211100__Y____Y_",
        "______000000___000000_____YYY___"
    ];
    generatePixelTexture(scene, 'electric_dolphin', electricDolphinDesc, { ...pDolphin, 'Y': '#ffff00' }, 3);

    // PROJECTILES HD
    const pShot = { '_': null, '0': '#00ffff', '1': '#ffffff', '2': '#0088ff' };
    const mimiShot = [
        "_010_",
        "01110",
        "20102",
        "_202_"
    ];
    generatePixelTexture(scene, 'mimi_shot', mimiShot, pShot, 4);

    const pBossShot = { '_': null, '0': '#ff0000', '1': '#ffaa00', '2': '#aa0000' };
    const bossShot = [
        "_010_",
        "01110",
        "20102",
        "_202_"
    ];
    generatePixelTexture(scene, 'boss_shot', bossShot, pBossShot, 4);

    // --- ASSETS PHASE 11 : INTRO CINÉMATIQUE SNES (STYLE SUPER METROID) ---

    // 1. CORAIL (Bleu abysse sombre et reflets néons)
    const pCoral = {
        '_': null,
        '0': '#000000', '1': '#0a1a2f', '2': '#0f384a', '3': '#1d5a6c',
        '4': '#3a8c8e', '5': '#5ce1a1', 'c': '#111111', 'r': '#2a2a2a'
    };
    const introCoral = [
        "________________________________",
        "________11111111________________",
        "_______1222222221_______rccc____",
        "___cr__1233333321_____rccc0_____",
        "__crr0_1234444321___rrcc00______",
        "__c1r0__12344321___rc00_________",
        "___c00___123321____rc0_rccc_____",
        "____rcc___1221_____00crccc0_____",
        "__rrcc0___1221____crc0000_______",
        "_rcc00____1221____c00__rccc_____",
        "_c0______122221_cc0___rccc0_____",
        "_______11222222110____cc00______",
        "______122334433221_____rcc______",
        "_____12344555544321___rc00______",
        "__rc1234555555554321_rc00_______",
        "_rcc1234455555544321cc0_________",
        "rccc0123344444433210cc__________",
        "cc00_01222333322210_00_rccc_____",
        "c0___0011122221110___0__rcc0____",
        "______00001111000____0___c00____"
    ];
    generatePixelTexture(scene, 'intro_coral', introCoral, pCoral, 4);

    // 2. USINE (Rouille, métal sombre et lumières industrielles)
    const pFactory = {
        '_': null,
        '0': '#000000', '1': '#1a0b0d', '2': '#3a161b', '3': '#691e23',
        '4': '#9e2a2a', '5': '#0d1b2a', '6': '#1b263b', '7': '#415a77', 'Y': '#fca311'
    };
    const introFactory = [
        "_________000000_________________",
        "________05566650________________",
        "_______0555666550_____00000_____",
        "00000__0555555550____0555550____",
        "05650__0000000000___05666650____",
        "05650___01122110___055555550____",
        "05650___01233210___000000000____",
        "05550___01232210____0112210_____",
        "0000000_01232210____0123210_____",
        "_012210_01233210_00_0123210_____",
        "_012210_00000000_00_01233210____",
        "_013210055666655000_000000000___",
        "_013210555677655500_05566550____",
        "_01321000000000000__05667650____",
        "_00000_0112233210_0_05667650____",
        "_0Y4Y0_012344432100_05566550____",
        "_00000_01344443210__00000000____",
        "05555500134444321000Y44444Y00___",
        "0666665013444432100Y4444444Y0___",
        "05555500000000000000000000000___"
    ];
    generatePixelTexture(scene, 'intro_factory', introFactory, pFactory, 4);

    // 3. MONSTRES (Vase organique violette/verte style mutant Metroid)
    const pMonsters = {
        '_': null,
        '0': '#000000', '1': '#190a2a', '2': '#2f1b4a', '3': '#492c73',
        '4': '#6c3b99', '5': '#8cdb39', '6': '#dcf514'
    };
    const introMonsters = [
        "_________0000000________________",
        "______0001111111000_____________",
        "____00111222222211100________000",
        "___0112223333333222110_____00110",
        "__011223344444443322110__0012210",
        "__012233444444444322110_01233210",
        "_0123344444444444332210012343200",
        "_0123440004440004432210123443210",
        "_0124405550405550442210123443210",
        "_012440565040565044221012333210_",
        "_01224400044400044321100122210__",
        "__01223444444444322110__00000___",
        "__01122333444333221110__________",
        "___011222233322221100___________",
        "__011111222222211100____________",
        "_0122111111111111111000_________",
        "012222100000000001111110________",
        "0111110__________00111110_______",
        "_00000_____________000000_______",
        "________________________________"
    ];
    generatePixelTexture(scene, 'intro_monsters', introMonsters, pMonsters, 4);

    // 4. MIMI (Aura protectrice, espoir radieux)
    const pMimi = {
        '_': null,
        '0': '#000000', '1': '#001e36', '2': '#004d80', '3': '#00ffff',
        '4': '#ffffff', '5': '#ff88aa', '6': '#bb5577', '7': '#ff99bb'
    };
    // --- RESTAURATION DES SPRITES 16-BITS ---

    // PALETTE DE COULEURS 16-BIT
    // PALETTE DE COULEURS 16-BIT ÉLÉGANTE
    const pElegant = {
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

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 2 : Battement de queue)
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
        "___kRkGGddGGkk______",
        "___kkkdddDDdk_______",
        "____kDDddDDDDk______",
        "____kDDDddDDDk______",
        "_____kDDDDDDk_______",
        "_____kGDDDDGk_______",
        "____kGGkkkGGk_______",
        "___kGGk___kGGk______"
    ];

    // SIRÈNE 16-BIT ÉLÉGANTE (Frame 3 : Queue écartée)
    const m3 = [
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
        "____kGGDDDDGGk______",
        "___kGGk_DD_kGGk_____",
        "__kGGk______kGGk____"
    ];

    generatePixelTexture(scene, 'mermaid1', m1, pElegant, 3);
    generatePixelTexture(scene, 'mermaid2', m2, pElegant, 3);
    generatePixelTexture(scene, 'mermaid3', m3, pElegant, 3);

    // PALETTES DÉRIVÉES POUR MALIK ET ANAIS (Utilisent la même structure m1, m2, m3)
    const pMalik = {
        ...pElegant,
        R: '#334155', r: '#0f172a', // Cheveux gris/noir
        S: '#78350f', s: '#280f02', // Peau foncée
        P: '#475569', p: '#1e293b', // Haut gris/bleu
        G: '#3b82f6', d: '#1d4ed8', D: '#1e1b4b'  // Queue Bleu océan
    };

    const pAnais = {
        ...pElegant,
        R: '#d97706', r: '#451a03', // Cheveux bruns/oranges
        S: '#ffccaa', s: '#b45309', // Peau claire/dorée
        P: '#2dd4bf', p: '#0f766e', // Haut turquoise
        G: '#fbbf24', d: '#b45309', D: '#451a03'  // Queue dorée
    };

    // Génération des sprites avec la matrice élégante unifiée à l'échelle 3 !
    generatePixelTexture(scene, 'malik', m1, pMalik, 3);
    generatePixelTexture(scene, 'malik2', m2, pMalik, 3);
    generatePixelTexture(scene, 'malik3', m3, pMalik, 3);

    generatePixelTexture(scene, 'nana', m1, pAnais, 3);
    generatePixelTexture(scene, 'nana2', m2, pAnais, 3);
    generatePixelTexture(scene, 'nana3', m3, pAnais, 3);

    const introMimi = [
        "________22222333322222__________",
        "______222333344443333222________",
        "_____22334444444444443322_______",
        "____2233444466666444443322______",
        "___223444446777776444443322_____",
        "__22344444677777776444444322____",
        "__23344444665555566444444332____",
        "_2234444446505050564444444322___",
        "_2334444444655555644444444332___",
        "_2344444444766666744444444432___",
        "_2344444444773337744444444432___",
        "_2334444444434443444444444332___",
        "_2234444444433333444444444322___",
        "__23344444444444444444444332____",
        "__22344444444444444444444322____",
        "___223344444444444444443322_____",
        "____2233344444444444433322______",
        "_____22223333333333332222_______",
        "_______2222222222222222_________"
    ];
    generatePixelTexture(scene, 'intro_mimi', introMimi, pMimi, 4);

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

    // --- ASSETS POUR LA COURSE TROPICALE (CHASE SCENE) ---

    // FOND OCÉAN TROPICAL (Turquoise lumineux avec dégradé vertical)
    const chaseBg = scene.make.graphics({ x: 0, y: 0, add: false });
    for (let cy = 0; cy < tileSize; cy += 8) {
        for (let cx = 0; cx < tileSize; cx += 8) {
            let ratio = cy / tileSize;
            let g = Math.floor(180 - ratio * 80);
            let b2 = Math.floor(220 - ratio * 60);
            let variation = (Math.random() > 0.5) ? 0x050505 : 0;
            let col = (0 << 16) | (g << 8) | b2;
            chaseBg.fillStyle(col + variation);
            chaseBg.fillRect(cx, cy, 8, 8);
        }
    }
    chaseBg.generateTexture('chase_ocean_bg', tileSize, tileSize);

    // ROCHER SUPÉRIEUR (Plafond rocheux)
    const pRock = {
        '_': null,
        '0': '#0a1628', '1': '#152844', '2': '#1d3a5c', '3': '#275070',
        '4': '#336688', 'M': '#1a4a3a', 'm': '#0d2e22'
    };
    const rockTopDesc = [
        "0111111111111111111111111111110_",
        "0222222222222222222222222222220_",
        "023333333333333333333333333320__",
        "02344444444444M444444444443320__",
        "0234444444MmmM_44444444443320___",
        "023444MmmM______444444433220____",
        "_023mM__________Mm44433220______",
        "__02M______________m3320________",
        "____0________________320________",
        "_____________________20_________"
    ];
    generatePixelTexture(scene, 'rock_top', rockTopDesc, pRock, 3);

    // ROCHER INFÉRIEUR (Sol sableux rocheux)
    const rockBotDesc = [
        "_____________________20_________",
        "____0________________320________",
        "__02M______________m3320________",
        "_023mM__________Mm44433220______",
        "023444MmmM______444444433220____",
        "0234444444MmmM_44444444443320___",
        "02344444444444M444444444443320__",
        "023333333333333333333333333320__",
        "0222222222222222222222222222220_",
        "0111111111111111111111111111110_"
    ];
    generatePixelTexture(scene, 'rock_bottom', rockBotDesc, pRock, 3);

    // ALGUE LONGUE (Kelp pour le bord bas)
    const pKelp = {
        '_': null,
        '0': '#004422', '1': '#006633', '2': '#009955', '3': '#00cc77', '4': '#33ff99'
    };
    const kelpDesc = [
        "___4___",
        "__43___",
        "_432___",
        "__321__",
        "___210_",
        "__3210_",
        "_4321__",
        "__432__",
        "___321_",
        "__4321_",
        "_432___",
        "__321__",
        "___21__",
        "____10_",
        "____0__"
    ];
    generatePixelTexture(scene, 'chase_kelp', kelpDesc, pKelp, 3);

    // RAYON DE SOLEIL (Texture verticale semi-transparente)
    const sunRay = scene.make.graphics({ x: 0, y: 0, add: false });
    sunRay.fillStyle(0xffffcc, 0.03);
    sunRay.fillRect(0, 0, 80, 400);
    sunRay.fillStyle(0xffffcc, 0.06);
    sunRay.fillRect(20, 0, 40, 400);
    sunRay.fillStyle(0xffffcc, 0.1);
    sunRay.fillRect(30, 0, 20, 400);
    sunRay.generateTexture('sun_ray', 80, 400);
}
