export const GameState = {
    level: 1,
    pearls: 0,
    totalPearls: 0,
    magicCharges: 0,
    speedLevel: 1,
    brushLevel: 1,
    hasTrident: false,
    isBossActive: false,
    isGameFinished: false,
    isDefeated: false,
    pearlsSinceLastCharge: 0,

    // --- POINTS DE VIE ---
    // Le jeu n'avait aucune condition de défaite : Mimi n'avait ni PV ni vies, et le
    // boss ne pouvait littéralement pas la tuer. Sans risque, les combats n'étaient
    // pas des affrontements mais des minuteurs, et toute la montée en difficulté des
    // boss n'avait aucun effet ressenti.
    // 5 cœurs : assez pour rester indulgent, assez peu pour que les dégâts comptent.
    maxHp: 5,
    hp: 5,

    // --- ÉCONOMIE DE MAGIE ---
    // Auparavant : 1 perle = 1 charge (le compteur pearlsSinceLastCharge existait mais
    // son seuil était à 1, donc inopérant). Or un boss vaincu lâche 40 perles et chaque
    // zone secrète en contient ~10 : le joueur nageait en permanence dans les charges.
    PEARLS_PER_CHARGE: 5,

    // Coûts centralisés ici pour que l'UI et le gameplay ne puissent plus diverger.
    // L'onde de choc passe de 1 à 2 : elle purifie un rayon de 600 px (1200 avec le
    // Trident, soit plus de la moitié d'un niveau) ET convertit tous les ennemis.
    //
    // Il n'en reste que deux : le Rayon est porté par une recharge et non par la magie,
    // et les trois invocations (dauphins, Anaïs, Malik) ne sont plus des pouvoirs.
    COSTS: { shockwave: 2, shield: 2 },

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
    LIGHT_COST_ABILITY: 10,

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

    lightRadius() {
        const base = this.LIGHT_RADIUS_MIN +
            (this.LIGHT_RADIUS_MAX - this.LIGHT_RADIUS_MIN) * (this.light / this.maxLight);
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
        window.magicCharges = this.magicCharges;
        window.speedLevel = this.speedLevel;
        window.brushLevel = this.brushLevel;
        window.hasTrident = this.hasTrident;
        window.isBossActiveGlobally = this.isBossActive;
        window.isGameFinishedGlobally = this.isGameFinished;
        window.pearlsSinceLastCharge = this.pearlsSinceLastCharge;
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
        this.pearlsSinceLastCharge++;
        // Une perle nourrit la lumière : l'économie existait déjà, seul l'effet change.
        this.light = Math.min(this.maxLight, this.light + this.LIGHT_PER_PEARL);
        if (this.pearlsSinceLastCharge >= this.PEARLS_PER_CHARGE) {
            this.magicCharges++;
            this.pearlsSinceLastCharge = 0;
            if (typeof window.playMagicChargeSound === 'function') window.playMagicChargeSound();
        }
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

    spendMagic(amount) {
        this.magicCharges = Math.max(0, this.magicCharges - amount);
        this.notify();
    },

    canCast(amount) {
        return this.magicCharges >= amount;
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
        this.magicCharges = 0;
        this.isGameFinished = false;
        this.isBossActive = false;
        this.isDefeated = false;
        this.pearlsSinceLastCharge = 0;
        this.hp = this.maxHp; // les cœurs se rechargent à chaque niveau
        this.light = this.maxLight;
        this.notify();
    }
};
