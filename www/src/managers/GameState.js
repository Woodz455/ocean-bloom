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
    COSTS: { shockwave: 2, dolphins: 2, shield: 2, anais: 3, malik: 4 },

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

        if (typeof window.updateGameUI === 'function') {
            window.updateGameUI();
        }
    },

    addPearl() {
        this.pearls++;
        this.pearlsSinceLastCharge++;
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
        this.notify();
    }
};
