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
    // Le TextureManager est global au jeu, mais IntroScene.preload ET MainScene.preload
    // appelaient tous deux cette fonction : une quarantaine de canvas régénérés pour
    // rien à chaque transition de scène, et autant d'erreurs « Texture key already in
    // use » dans la console. Un seul témoin suffit à savoir que le travail est fait.
    if (scene.textures.exists('mermaid1')) return;

    // --- PALETTE 16-BIT « ÉCOLE SQUARESOFT » (Chrono Trigger / Secret of Mana) ---
    //
    // Trois principes, qui font toute la différence avec du pixel art néon :
    //
    //  1. AUCUN CONTOUR NOIR PUR. Un indigo profond (#241a2e) au lieu de #000000.
    //     Le noir absolu découpe le sprite au ciseau ; un contour teinté l'assoit
    //     dans le décor et laisse la couleur respirer.
    //
    //  2. TROIS NUANCES PAR MATÉRIAU. Cheveux, peau et haut n'en avaient que deux,
    //     d'où l'aspect plat. La lumière vient d'en haut à gauche, comme le soleil
    //     qui descend vers le fond.
    //
    //  3. SATURATION CONTENUE (60-80 % au lieu de 100 %) ET TEINTE DÉCALÉE. Les
    //     lumières partent vers le chaud, les ombres vers le froid. Un rouge
    //     simplement assombri donne du plastique ; un rouge qui vire au prune
    //     donne de la chair. C'est ce décalage, plus que le dessin, qui produit
    //     la sensation « 16 bits ».
    const p = {
        _: null,
        // Note : les NUANCES CLAIRES sont volontairement remontées par rapport aux
        // ombres. Une passe entièrement désaturée faisait perdre 16 % de contraste à
        // Mimi à l'intérieur de son propre halo cyan — elle devenait sage mais fade.
        // On garde le modelé et le contour doux, on rend la présence.
        // Seule Mimi en profite : pMalik et pAnais redéfinissent R/P/G et doivent
        // rester en retrait par rapport à l'héroïne.
        k: '#241a2e', w: '#f4f7ff', g: '#b9c2d4', // Contour indigo, blancs cassés
        R: '#f4536f', r: '#b83a5e', // Cheveux sirène (clair/moyen)
        S: '#f7d0ad', s: '#d49a76', // Peau sirène (clair/moyen)
        P: '#b06ff0', p: '#6f3ba6', // Haut (violet)
        G: '#6ff0c0', d: '#2f9e7a', D: '#1b5c4d', // Queue sirène & algues
        O: '#e8a23c', o: '#b06a28', Y: '#f2d661', // Poissons et perles
        B: '#5cc4e8', b: '#2a6f9e', // Variantes bleues
        X: '#8a6a45', x: '#4a3320', // Déchets (brun)
        c: '#e06a5c', C: '#9e3a3a'  // Corail
    };

    // PALETTE DE COULEURS 16-BIT
    const pNature = {
        '_': null,
        '0': '#1a2438', // Contour/ombre : bleu de nuit, pas de noir
        'c': '#b8465e', 'C': '#e0708a', '1': '#f2a8b8', // Corail : grenat → rose poudré
        '2': '#3fb87a', '3': '#7ad9a0', // Algue verte
        '4': '#8a5fc4', '5': '#b892e0'  // Algue violette
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
    generatePixelTexture(scene, 'weed_purple', weedDesc, { ...pNature, '2': '#7a52b0', '3': '#a87fd4' }, 3);

    const crystalDesc = [
        "____00____",
        "___0320___",
        "__033220__",
        "_03322220_",
        "0333222220",
        "0333222220",
        "0322322320",
        "_00000000_"
    ];
    generatePixelTexture(scene, 'crystal_blue', crystalDesc, { ...pNature, '2': '#5aa8d4', '3': '#dfeef7' }, 4);

    const ventDesc = [
        "___0000___",
        "__011110__",
        "_0CC11CC0_",
        "0Ccc11ccC0",
        "0Cc0000cC0",
        "0000000000"
    ];
    generatePixelTexture(scene, 'volcanic_vent', ventDesc, { '_': null, '0': '#1a1018', '1': '#e07030', 'C': '#3d2118', 'c': '#5e3524' }, 6);

    const pillarDesc = [
        "0000000000",
        "0222222220",
        "0232222320",
        "_02000020_",
        "_020__020_",
        "_020__020_",
        "_020__020_",
        "_020__020_",
        "0020000200",
        "0222222220",
        "0000000000"
    ];
    generatePixelTexture(scene, 'sunken_pillar', pillarDesc, { '_': null, '0': '#1a2438', '2': '#4a5a63', '3': '#6e8189' }, 5);

    // POISSONS HD (Faune d'ambiance — Forme réaliste avec nageoires et queue)
    const pFish = {
        '_': null,
        '0': '#2a1a20', // Contour teinté (brun-prune), pas de noir
        'B': '#e08040', // Corps principal
        'b': '#f0a868', // Corps clair
        'H': '#c05f2e', // Tête / dos foncé
        'h': '#f5c48f', // Ventre clair
        'F': '#cf7038', // Nageoires
        'f': '#e09354', // Nageoires clair
        'T': '#a04a24', // Queue
        't': '#c76338', // Queue clair
        'E': '#f4f7ff', // Oeil blanc
        'e': '#241a2e', // Pupille
        'L': '#ffe6c4'  // Lumière / reflet
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
        '0': '#1a2438',                 // Contour bleu de nuit
        'B': '#3f7fc4', 'b': '#6aa6dd', // Corps
        'H': '#2a5b9e', 'h': '#9ecdf0', // Tête foncée / Ventre clair
        'F': '#3570b0', 'f': '#5090cc', // Nageoires
        'T': '#1f4a80', 't': '#3a6ba8', // Queue
        'L': '#cfe8ff'                  // Reflet
    }, 3);

    // TRASH (Amas toxique, déchets pétroliers compactés)
    const pTrash = {
        '_': null,
        '0': '#1c1410', // Contour : brun très sombre plutôt que noir
        '1': '#2b1d12', // Pétrole abyssal
        '2': '#3d2a19', // Vase foncée
        '3': '#523823', // Vase moyenne
        '4': '#6b4a2f', // Vase claire
        'X': '#6e6a63', // Ferraille
        'Y': '#d9c04a', // Reflet toxique / bidon jaune
        'R': '#c04434'  // Clignotant ou danger
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
        '0': '#1a1226', // Contour épais, indigo profond
        '1': '#2e1f42', // Violet sombre chair
        '2': '#472f63', // Violet
        '3': '#6b478f', // Violet clair (muscle)
        '4': '#9560c4', // Violet lumineux
        'R': '#e04a52', // Oeil rouge veineux
        'O': '#e8a23c', // Oeil jaune (iris)
        'V': '#7ec44a', // Bave verte toxique
        'v': '#3a6b2a'  // Bave foncée
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
    const pBossPlastique = { ...pBoss, 'V': '#b8bcc4', 'v': '#5f646e', '3': '#e8ecf2', '4': '#7fd4e0' };
    generatePixelTexture(scene, 'boss_plastique', bossVaseDesc, pBossPlastique, 7);

    // BOSS PETROLE (Masse d'hydrocarbure aux reflets irisés)
    // Un noir sur noir était illisible sur le voile rouge du combat : on garde une
    // silhouette sombre mais on remonte les valeurs et on ajoute la nacre du pétrole.
    const pPetrole = {
        ...pBoss,
        'V': '#3d3d4f', // contour extérieur, doit détacher la silhouette du fond
        'v': '#24242f',
        '1': '#4a4a5e',
        '2': '#2e2e3c',
        '3': '#7a5fa0', // reflet irisé violet
        '4': '#3fae9c', // reflet irisé turquoise
        'R': '#ff3355', // œil
        'O': '#ffcc44'
    };
    generatePixelTexture(scene, 'boss_petrole', bossVaseDesc, pPetrole, 7);

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

    // Palette des personnages : la base commune `p` augmentée de la TROISIÈME nuance
    // de chaque matériau. C'est elle qui crée le volume — sans elle, les cheveux, la
    // peau et le haut restaient des aplats. (`p` et `pElegant` étaient auparavant deux
    // objets rigoureusement identiques ; il n'y en a plus qu'un.)
    const pElegant = {
        ...p,
        q: '#7a2246', // cheveux, ombre : le rouge vire au prune, pas au rouge sombre
        t: '#96685f', // peau, ombre : l'ocre vire à la terre de rose
        u: '#472670'  // haut, ombre : le violet vire à l'aubergine
    };

    // SIRÈNE 16-BIT (Frame 1 : pose neutre)
    //
    // La SILHOUETTE est strictement identique à l'originale — pas un pixel plein n'a
    // été ajouté ni retiré. Seules les valeurs changent : on modèle avec les trois
    // nuances (R/r/q, S/s/t, P/p/u, G/d/D) au lieu de deux, lumière en haut à gauche.
    // C'est ce qui fait passer le sprite de l'autocollant au personnage.
    //
    // La rangée des yeux a aussi été assainie : elle comptait trois marques sombres
    // asymétriques (deux yeux + un pixel parasite), ce qui brouillait le visage.
    const m1 = [
        "_______kRkk_________",
        "______kRrRkkk_______",
        "_____kRRRrRRRk______",
        "____kRRrrrrrqqk_____",
        "___kRrrSSSsrqqqk____",
        "___kRrSkSkSstqqk____",
        "___kRrrSSsstqqqk____",
        "___kkksSSSstkkk_____",
        "____kkPPstpukk______",
        "____kpPPppuuukk_____",
        "____krqSsstqkk______",
        "___krqqGGddqqqk_____",
        "___kqkGGGddDkk______",
        "___kkkGdddDDk_______",
        "____kdGdddDDDk______",
        "____kddddDDDDk______",
        "_____kddDDDDk_______",
        "_____kGdDDdGk_______",
        "____kGdkDDkdGk______",
        "___kGGk____kGGk_____"
    ];

    // --- CYCLE DE NAGE ---
    // Les frames 2 et 3 étaient des copies de la frame 1 dont seule la pointe de la
    // nageoire changeait : 2,3 % des pixels, sur 2 rangées de 20. La sirène glissait
    // au lieu de nager. On dérive maintenant les frames de la pose neutre via une
    // courbe d'ondulation appliquée rangée par rangée.
    //
    // Le buste (rangées 0-9) reste fixe : c'est le point d'ancrage du regard.
    // Les hanches partent d'un côté (-1) et la queue de l'autre (jusqu'à +3) : cette
    // courbe en S contraire est ce qui distingue une nage d'une simple translation.
    const SWIM_CURVE = { 10: -1, 11: -1, 12: 0, 13: 1, 14: 1, 15: 2, 16: 2, 17: 3, 18: 3, 19: 3 };

    // Décale une rangée horizontalement en comblant avec du transparent.
    // Les amplitudes ci-dessus sont calibrées pour qu'aucun pixel ne sorte de la grille.
    function swayRows(art, dir) {
        return art.map((row, y) => {
            const dx = (SWIM_CURVE[y] || 0) * dir;
            if (dx === 0) return row;
            return dx > 0
                ? '_'.repeat(dx) + row.slice(0, row.length - dx)
                : row.slice(-dx) + '_'.repeat(-dx);
        });
    }

    const m2 = swayRows(m1, 1);   // ondulation vers la droite
    const m3 = swayRows(m1, -1);  // ondulation vers la gauche

    generatePixelTexture(scene, 'mermaid1', m1, pElegant, 3);
    generatePixelTexture(scene, 'mermaid2', m2, pElegant, 3);
    generatePixelTexture(scene, 'mermaid3', m3, pElegant, 3);

    // PALETTES DÉRIVÉES POUR MALIK ET ANAIS (Utilisent la même structure m1, m2, m3)
    // Mêmes trois nuances par matériau que Mimi, sur d'autres gammes.
    const pMalik = {
        ...pElegant,
        R: '#7c8aa3', r: '#4d5a72', q: '#2b3348', // Cheveux ardoise
        S: '#b07a4e', s: '#8a5533', t: '#5a3220', // Peau chaude foncée
        P: '#6b7d94', p: '#455568', u: '#2a3543', // Haut gris-bleu
        G: '#5a9fe0', d: '#2f5fb0', D: '#1e3a6e'  // Queue bleu océan
    };

    // Princesse Nana : cuivre et or, le registre royal.
    const pNana = {
        ...pElegant,
        R: '#e09a4e', r: '#a8632c', q: '#6b3a1c', // Cheveux cuivrés
        S: '#f7d0ad', s: '#d49a76', t: '#96685f', // Peau claire
        P: '#5fd6c4', p: '#2a9188', u: '#175c56', // Haut turquoise
        G: '#f0cf6b', d: '#c08f30', D: '#7a561d'  // Queue dorée
    };

    // Anaïs : rose et turquoise. Elle partageait la palette ET la silhouette de Nana —
    // deux personnages distincts qu'on ne pouvait pas différencier.
    const pAnais = {
        ...pElegant,
        R: '#f0a0b8', r: '#c46a86', q: '#8a4058', // Cheveux rose poudré
        S: '#f7d0ad', s: '#d49a76', t: '#96685f', // Peau claire
        P: '#f0cf6b', p: '#c08f30', u: '#7a561d', // Haut doré
        G: '#5fd6c4', d: '#2a9188', D: '#175c56'  // Queue turquoise
    };

    // MALIK — silhouette propre.
    // Il réutilisait exactement la matrice de Mimi : 0 pixel d'écart de silhouette,
    // soit deux personnages identiques simplement repeints. Comme ils nagent côte à
    // côte quand on l'invoque, et que le mode daltonien affaiblit la couleur comme
    // seul repère, la forme devait les distinguer.
    // Cheveux courts, épaules plus larges, torse nu (il héritait du haut de Mimi).
    // La queue reste celle de Mimi à partir de la rangée 14 : les amplitudes de
    // SWIM_CURVE y sont déjà validées, inutile de refaire le calcul de débordement.
    const mk1 = [
        "_______kRRk_________",
        "______kRRrRk________",
        "_____kRRrrRRk_______",
        "_____kRrrrrqk_______",
        "____kqSSSSSqk_______",
        "____kSSkSkStk_______",
        "_____kSSsstk________",
        "_______kSsk_________",
        "__kkSSSSSSsstkk_____",
        "__kSSsSSsSsstk______",
        "___kSssSSsstk_______",
        "____kGGGddDDk_______",
        "____kdGGdddDk_______",
        "____kkGdddDDk_______",
        "____kdGdddDDDk______",
        "____kddddDDDDk______",
        "_____kddDDDDk_______",
        "_____kGdDDdGk_______",
        "____kGdkDDkdGk______",
        "___kGGk____kGGk_____"
    ];
    const mk2 = swayRows(mk1, 1);
    const mk3 = swayRows(mk1, -1);

    generatePixelTexture(scene, 'malik', mk1, pMalik, 3);
    generatePixelTexture(scene, 'malik2', mk2, pMalik, 3);
    generatePixelTexture(scene, 'malik3', mk3, pMalik, 3);

    // NANA — diadème. Rien n'indiquait qu'elle est princesse, alors que c'est elle qui
    // remet le Trident. La silhouette reste strictement celle de Mimi : seules deux
    // rangées de cheveux deviennent de l'or (bandeau + pierre centrale).
    const mn1 = m1.map((row, y) => {
        if (y === 1) return "_____kYkRrRkYk______"; // deux pointes de couronne
        if (y === 2) return "_____kRRRYRRRk______"; // pierre au sommet
        if (y === 3) return "____kROYYYYOqqk_____"; // bandeau doré sur le front
        return row;
    });
    const mn2 = swayRows(mn1, 1);
    const mn3 = swayRows(mn1, -1);

    generatePixelTexture(scene, 'nana', mn1, pNana, 3);
    generatePixelTexture(scene, 'nana2', mn2, pNana, 3);
    generatePixelTexture(scene, 'nana3', mn3, pNana, 3);

    // ANAÏS — chevelure aux épaules au lieu des longues mèches jusqu'aux hanches.
    // Comme pour Malik, c'est la forme qui doit la distinguer : la couleur seule ne
    // suffit pas, et le mode daltonien l'affaiblit encore.
    const ma1 = m1.map((row, y) => {
        if (y === 10) return "_____kSssstk________";
        if (y === 11) return "_____kGGddDk________";
        if (y === 12) return "____kGGGddDDk_______";
        if (y === 13) return "____kkGdddDDk_______";
        return row;
    });
    const ma2 = swayRows(ma1, 1);
    const ma3 = swayRows(ma1, -1);

    generatePixelTexture(scene, 'anais', ma1, pAnais, 3);
    generatePixelTexture(scene, 'anais2', ma2, pAnais, 3);
    generatePixelTexture(scene, 'anais3', ma3, pAnais, 3);

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
