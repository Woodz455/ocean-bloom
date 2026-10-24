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
window.waveLevel = 1;
window.shieldLevel = 1;
window.rayLevel = 1;
window.gameReady = false;

// --- GESTION DE LA PROGRESSION (LOCALSTORAGE) ---
window.loadProgress = function() {
    window.currentLevel = parseInt(localStorage.getItem('oceanBloomLevel')) || 1;
    window.totalPearls = parseInt(localStorage.getItem('oceanBloomPearls')) || 0;
    window.speedLevel = parseInt(localStorage.getItem('oceanBloomSpeed')) || 1;
    window.brushLevel = parseInt(localStorage.getItem('oceanBloomBrush')) || 1;
    window.waveLevel = parseInt(localStorage.getItem('oceanBloomWave')) || 1;
    window.shieldLevel = parseInt(localStorage.getItem('oceanBloomShield')) || 1;
    window.rayLevel = parseInt(localStorage.getItem('oceanBloomRay')) || 1;
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
    localStorage.setItem('oceanBloomWave', window.waveLevel);
    localStorage.setItem('oceanBloomShield', window.shieldLevel);
    localStorage.setItem('oceanBloomRay', window.rayLevel);
    localStorage.setItem('oceanBloomPrologue', window.prologueVu ? 'true' : 'false');
}

// Fonction appelée par le bouton Réinitialiser HTML
window.resetProgress = function () {
    if (confirm("Veux-tu vraiment effacer toute ta progression ?")) {
        localStorage.clear();
        location.reload();
    }
};

// --- LA BOUTIQUE ---
//
// Une TABLE plutôt qu'un if/else par amélioration. Il y en avait deux, codées en dur
// dans buyUpgrade ET dans updateShopUI ; les trois paliers de pouvoirs en auraient fait
// cinq, en deux exemplaires. Ajouter une ligne ici suffit désormais.
//
// Prix des paliers de pouvoirs : 20 puis 40 perles. Ce sont des PARIS, pas des mesures —
// comme l'étaient les coûts en lumière avant la première partie humaine. Les six achats
// coûtent 180 perles quand dix niveaux en rapportent ~150 à 220 : un joueur ne pourra
// pas tout prendre sans renoncer ailleurs, ce qui est voulu pour une campagne d'une heure.
const AMELIORATIONS = {
    speed:  { niveau: 'speedLevel',  max: 10, prix: n => n * 10 },
    brush:  { niveau: 'brushLevel',  max: 10, prix: n => n * 10 },
    wave:   { niveau: 'waveLevel',   max: 3,  prix: n => n * 20, palier: 'wave' },
    shield: { niveau: 'shieldLevel', max: 3,  prix: n => n * 20, palier: 'shield' },
    // Le Rayon n'existe qu'une fois le Trident reçu (Nana, niveau 6) : acheter un palier
    // pour un pouvoir qu'on n'a pas serait de l'argent jeté.
    ray:    { niveau: 'rayLevel',    max: 3,  prix: n => n * 20, palier: 'ray',
              verrou: () => !window.hasTrident }
};

window.buyUpgrade = function (type) {
    const a = AMELIORATIONS[type];
    if (!a || (a.verrou && a.verrou())) return;
    const n = window[a.niveau];
    const prix = a.prix(n);
    if (n >= a.max || window.totalPearls < prix) return;

    window.totalPearls -= prix;
    window[a.niveau] = n + 1;
    if (window.playBuySound) window.playBuySound();

    window.saveProgress();
    window.updateShopUI();
};

window.updateShopUI = function () {
    const elPearls = document.getElementById('shop-pearls');
    if (!elPearls) return;
    elPearls.innerHTML = `${window.icone('perle')} ${window.totalPearls}`;
    const str = k => (window.getStr ? window.getStr(k) : '') || '';

    for (const [clef, a] of Object.entries(AMELIORATIONS)) {
        const n = window[a.niveau];
        const lvl = document.getElementById('lvl-' + clef);
        const btn = document.getElementById('btn-upg-' + clef);
        const suite = document.getElementById('next-' + clef);
        if (!btn) continue;

        if (lvl) lvl.innerText = a.palier ? `${str('tierLabel') || 'Palier'} ${n}/${a.max}` : `Lvl ${n}`;

        const verrouille = !!(a.verrou && a.verrou());
        const prix = a.prix(n);
        btn.innerHTML = verrouille ? window.icone('cadenas')
            : n >= a.max ? 'MAX'
            : `${str('pricePrefix') || 'Prix: '}${prix} ${window.icone('perle')}`;
        btn.disabled = verrouille || n >= a.max || window.totalPearls < prix;

        // Un palier se vend par ce qu'il CHANGE : « Palier 1/3 » seul n'apprend rien.
        if (suite) {
            suite.innerText = verrouille ? str(clef + 'Locked')
                : n < a.max ? str(`${a.palier}Next${n + 1}`)
                : '';
        }
    }
};

// Rendre disponible au lancement
window.updateGameUI = function () {
    const lvlTxt = document.getElementById('current-level-text');
    const pearlTxt = document.getElementById('session-pearls');
    const magicBtn = document.getElementById('magic-action-btn');
    const shieldBtn = document.getElementById('shield-action-btn');

    if (lvlTxt) lvlTxt.innerText = window.currentLevel;
    if (pearlTxt) pearlTxt.innerText = window.sessionPearls;

    // Cœurs : pleins puis vides, pour qu'on lise d'un coup d'œil ce qu'il reste.
    const hpTxt = document.getElementById('hp-hearts');
    if (hpTxt) {
        const hp = window.playerHp !== undefined ? window.playerHp : GameState.maxHp;
        const max = window.playerMaxHp || GameState.maxHp;
        hpTxt.innerHTML = window.icone('coeur').repeat(Math.max(0, hp))
            + window.icone('coeur_vide').repeat(Math.max(0, max - hp));
    }

    const C = GameState.COSTS;

    // UN POUVOIR TROP CHER EST GRISÉ, PAS CACHÉ.
    //
    // Le seuil lit la lumière — la même jauge que le joueur regarde en haut de l'écran.
    // Les boutons disparaissaient sous ce seuil : le joueur ne découvrait son équipement
    // qu'en ayant de quoi s'en servir, et ne voyait jamais ce que le noir lui retirait.
    // Grisés, ils restent à leur place et disent d'eux-mêmes ce qu'il manque.
    const lumiere = window.playerLight !== undefined ? window.playerLight : GameState.light;
    const dispo = window.gameReady && !window.isGameFinishedGlobally;
    const poser = (btn, existe, cout) => {
        if (!btn) return;
        btn.style.display = existe && dispo ? 'block' : 'none';
        btn.classList.toggle('grise', lumiere < cout);
    };

    poser(magicBtn, true, C.shockwave);
    // Le Rayon n'existe qu'une fois le Trident reçu (Nana libérée) : sans lui, il reste
    // caché — ce n'est pas un pouvoir qui manque de lumière, c'est un pouvoir à venir.
    poser(document.getElementById('ray-action-btn'), window.hasTrident, C.ray);
    // Le Bouclier fonctionne partout, contre le boss il renvoie même un tir.
    poser(shieldBtn, true, C.shield);
};

// Charge la progression au démarrage du script
window.loadProgress();
window.updateShopUI();
