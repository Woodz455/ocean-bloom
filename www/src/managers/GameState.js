export const GameState = {
    level: 1,
    pearls: 0,
    totalPearls: 0,
    speedLevel: 1,
    brushLevel: 1,
    hasTrident: false,
    isBossActive: false,
    isGameFinished: false,
    isDefeated: false,

    // --- POINTS DE VIE ---
    // Le jeu n'avait aucune condition de défaite : Mimi n'avait ni PV ni vies, et le
    // boss ne pouvait littéralement pas la tuer. Sans risque, les combats n'étaient
    // pas des affrontements mais des minuteurs, et toute la montée en difficulté des
    // boss n'avait aucun effet ressenti.
    // 5 cœurs : assez pour rester indulgent, assez peu pour que les dégâts comptent.
    maxHp: 5,
    hp: 5,

    // --- LES POUVOIRS SE PAIENT EN LUMIÈRE ---
    //
    // Ils se payaient en « charges de magie », une seconde monnaie gagnée toutes les
    // cinq perles. Deux monnaies pour un jeu dont le sujet est UNE ressource, c'était
    // une de trop : la magie n'avait aucun rapport avec le verbe du jeu, et frapper ne
    // coûtait donc rien de ce qui compte.
    //
    // Maintenant, un pouvoir mange la réserve. Et comme le rayon éclairé se calcule sur
    // `light / maxLight`, LANCER UN POUVOIR RÉTRÉCIT LE HALO DANS LA SECONDE. « Frapper
    // ou voir » cesse d'être une phrase : c'est la même jauge.
    //
    // Les perles gardent alors un rôle net et unique — recharger la lumière, et payer la
    // progression permanente en boutique.
    //
    // D'OÙ VIENNENT CES TROIS NOMBRES — et ce qu'ils ne sont pas.
    //
    // Ce sont des PARIS, pas des mesures, et il faut le dire : le pilote automatique n'a
    // jamais lancé un seul pouvoir, ni avant ni maintenant. Les neuf parties du réglage
    // de la lumière et les douze du réglage des cœurs ont toutes été jouées sans en
    // utiliser aucun. Aucune valeur de coût n'a donc jamais été mesurée dans ce projet,
    // et apprendre au pilote à les lancer reviendrait à mesurer l'idée qu'on se fait
    // d'un joueur plutôt que le jeu.
    //
    // Ce qui EST calculé, c'est le budget dans lequel ils doivent tenir. Sur un niveau
    // mesuré à ~90 s et ~16 perles :
    //     fonte 90 s à 3,0/s        −270
    //     réserve de départ         +100
    //     5 balises à 34            +170
    //     ~16 perles à 9            +144
    //     ------------------------------
    //     excédent                  ≈ +144
    // Cet excédent est ce que les pouvoirs peuvent manger. À six à dix lancers par
    // niveau, le coût moyen doit tourner autour de 15.
    //
    // CE BUDGET ÉTAIT FAUX, et la première partie humaine l'a montré. Il supposait six à
    // dix lancers ; un joueur sous pression en lance bien plus, et surtout il ressentait
    // CHAQUE lancer, parce que le halo se refermait dessus (voir LIGHT_RADIUS_SEUIL).
    // Traduits en secondes de vue à 3,0/s de fonte, les premiers coûts étaient énormes :
    // 7,3 s pour l'Onde, 5,3 s pour le Bouclier, 2,3 s par tir de Rayon. Trois Ondes
    // brûlaient 22 s sur une barre qui en contient 33.
    //
    // Ils sont donc à peu près divisés par deux — 4,0 s, 3,0 s et 1,3 s de vue. Combiné
    // au seuil, dépenser depuis une réserve saine ne se voit plus ; ça rapproche
    // seulement le moment où il faudra retrouver une balise.
    COSTS: { shockwave: 12, shield: 9, ray: 4 },

    // --- RÉSERVE DE LUMIÈRE ---
    // La ressource centrale : elle décroît sans cesse, les perles la rechargent, et son
    // niveau pilote le rayon éclairé. C'est ce qui crée la seule décision que la boucle
    // précédente n'avait pas : s'enfoncer dans le noir ou revenir vers une zone acquise.
    light: 100,
    maxLight: 100,
    // RÉGLAGE ISSU DE NEUF PARTIES JOUÉES À L'AVEUGLE, et non du papier.
    //
    // Premières valeurs : fonte 2,2/s, perle +14, balise +55. Résultat mesuré sur deux
    // écrans, réserve minimale MÉDIANE de 65 à 70 %, et UN SEUL passage sous 20 % en
    // neuf parties. La tension centrale du jeu ne se déclenchait donc jamais : la
    // ressource était généreuse tant qu'on progressait, et ne mordait que lorsqu'on
    // était déjà perdu — l'inverse de ce qu'il faut.
    //
    // Le compte expliquait pourquoi : sur une partie de 177 s, 389 points fondus contre
    // 499 disponibles, dont 275 des seules balises. La recharge des balises couvrait à
    // elle seule 71 % de la fonte, si bien qu'avancer rendait plus riche.
    //
    // Les trois valeurs bougent ensemble, car ce qui compte est leur RAPPORT. Trois
    // réglages ont été mesurés, quatre parties chacun, pilote identique :
    //
    //   fonte/perle/balise | réserve min. médiane | passages <20 % | balises | perles
    //   2,2 / 14 / 55      |         70 %         |       0        |  4/5    |   8
    //   3,2 /  9 / 32      |        51,5 %        |       0        |  3/5    |  8,5
    //   3,6 /  8 / 28      |          0 %         |       6        | 1,5/5   |  19
    //
    // Le troisième est l'échec inverse, et plus grave que le premier : la réserve devient
    // si tendue que le joueur court après les perles au lieu de chercher les balises —
    // 19 perles pour une balise et demie. Le jeu cesse d'être « trouver la lumière dans
    // le noir » pour devenir « survivre à sa propre jauge ».
    //
    // DERNIER AJUSTEMENT, et il vient d'ailleurs : corriger la spirale de dégâts (voir
    // subirDegats dans Player.js) a fait passer la durée médiane d'un niveau de 61 à
    // 109 s, simplement parce qu'on ne meurt plus à mi-parcours. Le réglage 3,4/9/30,
    // calibré sur des parties écourtées par la mort, redevenait donc trop avare sur des
    // parties complètes : réserve médiane à 0 % et 24 perles ramassées. C'est le rappel
    // que ces deux systèmes ne se règlent pas séparément.
    //
    // On desserre la fonte plutôt que d'augmenter la valeur d'une perle : rendre les
    // perles plus riches récompenserait justement le comportement qu'on veut éviter.
    // C'est la PROGRESSION qui doit payer, d'où la balise à 34.
    LIGHT_DRAIN_PER_SEC: 3.0,   // ~33 s de réserve pleine sans rien ramasser
    LIGHT_PER_PEARL: 9,
    LIGHT_PER_BEACON: 34,       // ~11 s de nage : de quoi repartir, pas de quoi se refaire

    // Rayon éclairé, en pixels du monde. Il ne tombe jamais à zéro : un joueur sans
    // lumière doit rester capable de retrouver son chemin, sinon la mécanique n'est plus
    // une tension mais une impasse.
    // Premier réglage mesuré : 300 px de rayon sur un écran de 375 px de large donnait
    // un halo de 600 px de diamètre — plus large que l'écran. L'obscurité n'existait
    // plus qu'aux quatre coins, et une zone acquise était indiscernable d'une zone
    // vierge. C'est l'échec « trop généreuse » que le plan annonçait ; le rayon doit
    // laisser au moins la moitié de l'écran dans le noir.
    LIGHT_RADIUS_MIN: 72,
    LIGHT_RADIUS_MAX: 165,

    // LE HALO NE RÉTRÉCIT QU'EN DESSOUS DE CE SEUIL.
    //
    // Corrige un défaut de conception rapporté par la PREMIÈRE partie humaine du projet :
    // « c'est comme une punition, ça se consomme vite ».
    //
    // Le rayon suivait `light / maxLight` en droite ligne, donc CHAQUE point dépensé
    // rétrécissait la vue à l'instant même. Un pouvoir se lance quand on est en
    // difficulté ; il rendait donc la difficulté pire, dans la dimension exacte où le
    // joueur était déjà en peine. Le coût et le châtiment étaient la même chose, payés
    // au même moment, et il n'existait aucune fenêtre où dépenser soit un bon calcul.
    //
    // Au-dessus du seuil, la vue ne bouge plus : dépenser coûte du TEMPS (la barre
    // s'épuisera plus tôt) et non de la VUE. En dessous, le halo se referme comme avant.
    // L'angoisse du noir qui se resserre n'est pas supprimée, elle est CONCENTRÉE là où
    // elle a du sens — et c'est précisément la zone que les neuf parties de réglage
    // visaient en comptant les passages sous 20 %.
    LIGHT_RADIUS_SEUIL: 0.45,

    lightRadius() {
        const t = Math.min(1, (this.light / this.maxLight) / this.LIGHT_RADIUS_SEUIL);
        const base = this.LIGHT_RADIUS_MIN + (this.LIGHT_RADIUS_MAX - this.LIGHT_RADIUS_MIN) * t;
        // L'amélioration de boutique s'applique ici : « rayon de brosse » devient
        // « rayon de lumière », la mécanique d'achat ne bouge pas.
        return base * (1 + (this.brushLevel - 1) * 0.12);
    },

    drainLight(deltaMs) {
        if (this.isGameFinished || this.isDefeated) return;
        const before = this.light;
        this.light = Math.max(0, this.light - this.LIGHT_DRAIN_PER_SEC * (deltaMs / 1000));
        // La jauge se rafraîchit au dixième de point : inutile de toucher au DOM 60 fois
        // par seconde pour une barre qui bouge d'un pixel toutes les dix frames.
        if (Math.floor(before * 2) !== Math.floor(this.light * 2)) this.notify();
    },

    addLight(amount) {
        this.light = Math.min(this.maxLight, this.light + amount);
        this.notify();
    },

    spendLight(amount) {
        this.light = Math.max(0, this.light - amount);
        this.notify();
    },

    init() {
        this.level = window.currentLevel || 1;
        this.totalPearls = window.totalPearls || 0;
        this.speedLevel = window.speedLevel || 1;
        this.brushLevel = window.brushLevel || 1;
        this.hasTrident = window.hasTrident || false;
    },

    notify() {
        // Sync back to globals for retrocompatibility
        window.currentLevel = this.level;
        window.sessionPearls = this.pearls;
        window.totalPearls = this.totalPearls;
        window.speedLevel = this.speedLevel;
        window.brushLevel = this.brushLevel;
        window.hasTrident = this.hasTrident;
        window.isBossActiveGlobally = this.isBossActive;
        window.isGameFinishedGlobally = this.isGameFinished;
        window.playerHp = this.hp;
        window.playerMaxHp = this.maxHp;
        window.playerLight = this.light;
        window.playerMaxLight = this.maxLight;

        if (typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    },

    addPearl() {
        this.pearls++;
        // Une perle nourrit la lumière, et c'est désormais tout ce qu'elle fait pendant
        // la partie : elle ne fabrique plus de charges de magie en parallèle.
        this.light = Math.min(this.maxLight, this.light + this.LIGHT_PER_PEARL);
        this.notify();
    },

    // Renvoie true si le coup est fatal, pour que l'appelant déclenche la défaite.
    damage(amount) {
        if (this.isDefeated || this.isGameFinished) return false;
        this.hp = Math.max(0, this.hp - amount);
        this.notify();
        return this.hp <= 0;
    },

    heal(amount) {
        if (this.hp >= this.maxHp) return false;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.notify();
        return true;
    },

    defeat() {
        this.isDefeated = true;
        this.notify();
    },

    losePearls(amount) {
        this.pearls = Math.max(0, this.pearls - amount);
        this.notify();
    },

    // Un pouvoir ne se lance que si la réserve peut le payer EN ENTIER : sans ce garde,
    // spendLight rabote à zéro et le pouvoir partirait gratuitement dans le noir total,
    // exactement au moment où il devrait être hors de portée.
    canCast(amount) {
        return this.light >= amount;
    },

    setBossActive(isActive) {
        this.isBossActive = isActive;
        this.notify();
    },

    finishGame() {
        this.isGameFinished = true;
        this.notify();
    },

    resetSession() {
        this.pearls = 0;
        this.isGameFinished = false;
        this.isBossActive = false;
        this.isDefeated = false;
        this.hp = this.maxHp; // les cœurs se rechargent à chaque niveau
        this.light = this.maxLight;
        this.notify();
    }
};
