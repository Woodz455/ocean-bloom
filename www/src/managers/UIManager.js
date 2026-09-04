import { GameState } from './GameState.js';

// --- RETOUR HAPTIQUE ---
//
// Le jeu appelle `window.Haptics` à huit endroits (dégâts, balise allumée, onde de
// choc, défaite...). Ces appels visaient le moteur de vibration d'un téléphone via
// Capacitor. Sur PC ce moteur n'existe pas, mais une MANETTE en a un : plutôt que de
// retirer huit appels et de perdre le retour physique, on garde EXACTEMENT la même
// interface (`vibrate()`, `impact({ style })`, promesses) et on change le support.
//
// Au clavier, `vibrationActuator` est absent : chaque appel retombe sur une promesse
// résolue et ne fait rien. Aucun site d'appel n'a besoin de le savoir.
window.Haptics = (function () {
    // Durée et force par style, calquées sur ce que rendait Capacitor.
    const STYLES = {
        LIGHT: { duration: 40, weak: 0.25, strong: 0.0 },
        MEDIUM: { duration: 90, weak: 0.6, strong: 0.25 },
        HEAVY: { duration: 160, weak: 0.9, strong: 0.7 }
    };

    function jouer(p) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = Array.prototype.find.call(pads, m => m && m.vibrationActuator);
        if (!pad) return Promise.resolve();
        return pad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: p.duration,
            weakMagnitude: p.weak,
            strongMagnitude: p.strong
        }).catch(() => { });
    }

    return {
        impact: (o) => jouer(STYLES[(o && o.style) || 'MEDIUM'] || STYLES.MEDIUM),
        vibrate: () => jouer(STYLES.HEAVY)
    };
})();

// --- VARIABLES GLOBALES UI ET PROGRESSION ---

// Les textures des personnages sont générées directement sur la grille commune
// (PIXEL px écran par pixel d'art), donc plus aucun facteur d'affichage.
window.charScale = 1;
window.currentLevel = 1;
window.totalPearls = 0;
window.sessionPearls = 0;
window.speedLevel = 1;
window.brushLevel = 1;
window.magicCharges = 0;
window.pearlsSinceLastCharge = 0;
window.gameReady = false;

// --- GESTION DE LA PROGRESSION (LOCALSTORAGE) ---
window.loadProgress = function() {
    window.currentLevel = parseInt(localStorage.getItem('oceanBloomLevel')) || 1;
    window.totalPearls = parseInt(localStorage.getItem('oceanBloomPearls')) || 0;
    window.speedLevel = parseInt(localStorage.getItem('oceanBloomSpeed')) || 1;
    window.brushLevel = parseInt(localStorage.getItem('oceanBloomBrush')) || 1;
    window.hasTrident = localStorage.getItem('oceanBloomTrident') === 'true';
    // L'ouverture jouable ne se joue qu'une fois. Sans ce témoin PERSISTÉ, un simple
    // rechargement de page pendant le niveau 1 la rejouait en entier — et le prologue
    // est justement ce qu'on ne veut jamais imposer deux fois.
    window.prologueVu = localStorage.getItem('oceanBloomPrologue') === 'true';
}

window.saveProgress = function() {
    localStorage.setItem('oceanBloomLevel', window.currentLevel);
    localStorage.setItem('oceanBloomPearls', window.totalPearls);
    localStorage.setItem('oceanBloomSpeed', window.speedLevel);
    localStorage.setItem('oceanBloomBrush', window.brushLevel);
    localStorage.setItem('oceanBloomPrologue', window.prologueVu ? 'true' : 'false');
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

    window.saveProgress();
    window.updateShopUI();
};

window.updateShopUI = function() {
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
};

// Rendre disponible au lancement
window.updateGameUI = function () {
    const lvlTxt = document.getElementById('current-level-text');
    const pearlTxt = document.getElementById('session-pearls');
    const magicTxt = document.getElementById('magic-charges');
    const magicBtn = document.getElementById('magic-action-btn');
    const dolphinBtn = document.getElementById('dolphin-action-btn');
    const malikBtn = document.getElementById('malik-action-btn');
    const anaisBtn = document.getElementById('anais-action-btn');
    const shieldBtn = document.getElementById('shield-action-btn');

    if (lvlTxt) lvlTxt.innerText = window.currentLevel;
    if (pearlTxt) pearlTxt.innerText = window.sessionPearls;
    if (magicTxt) magicTxt.innerText = window.magicCharges;

    // Cœurs : pleins puis vides, pour qu'on lise d'un coup d'œil ce qu'il reste.
    const hpTxt = document.getElementById('hp-hearts');
    if (hpTxt) {
        const hp = window.playerHp !== undefined ? window.playerHp : GameState.maxHp;
        const max = window.playerMaxHp || GameState.maxHp;
        hpTxt.innerText = '❤️'.repeat(hp) + '🖤'.repeat(Math.max(0, max - hp));
    }

    const C = GameState.COSTS;

    // Afficher ou cacher le bouton magie (seuil piloté par le coût réel)
    if (magicBtn) {
        if (window.magicCharges >= C.shockwave && window.gameReady && !window.isGameFinishedGlobally) {
            magicBtn.style.display = 'block';
        } else {
            magicBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher le bouton ultime (uniquement contre le boss, et avec >= 2 charges)
    if (dolphinBtn) {
        if (window.magicCharges >= C.dolphins && window.gameReady && !window.isGameFinishedGlobally && window.isBossActiveGlobally) {
            dolphinBtn.style.display = 'block';
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

    // Afficher ou cacher Malik (Coût = 4)
    if (malikBtn) {
        if (window.magicCharges >= C.malik && window.gameReady && !window.isGameFinishedGlobally && !window.isBossActiveGlobally) {
            malikBtn.style.display = 'block';
            if (magicBtn) magicBtn.style.display = 'none';
        } else {
            malikBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher Anaïs (Coût = 3)
    if (anaisBtn) {
        if (window.magicCharges >= C.anais && window.gameReady && !window.isGameFinishedGlobally && !window.isBossActiveGlobally) {
            anaisBtn.style.display = 'block';
        } else {
            anaisBtn.style.display = 'none';
        }
    }

    // Afficher ou cacher le Bouclier de Perle (Coût = 2)
    if (shieldBtn) {
        if (window.magicCharges >= C.shield && window.gameReady && !window.isGameFinishedGlobally && !window.isBossActiveGlobally) {
            shieldBtn.style.display = 'block';
        } else {
            shieldBtn.style.display = 'none';
        }
    }
};

// Charge la progression au démarrage du script
window.loadProgress();
window.updateShopUI();
