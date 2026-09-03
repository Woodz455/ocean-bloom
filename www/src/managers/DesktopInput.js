// --- PILOTAGE CLAVIER ET MANETTE ---
//
// Le jeu n'avait qu'une seule source de mouvement : le joystick tactile en DOM, qui
// écrit dans `window.joystickData`. Aucune touche n'était lue nulle part. Sur un écran
// d'ordinateur, cela revenait à faire glisser la souris dans un cercle de 120 px.
//
// Ce module n'ajoute pas un second chemin de pilotage : il écrit dans LE MÊME objet
// `window.joystickData` que le joystick tactile. MainScene et ChaseScene le lisent sans
// savoir d'où viennent les valeurs, et aucune scène, aucune entité n'a été modifiée.
//
// Même principe pour les capacités : les touches appellent les déclencheurs globaux
// déjà utilisés par les boutons (window.triggerMalik, etc.). Les coûts en magie, les
// conditions d'apparition et le temps de recharge du Rayon restent donc gérés à un seul
// endroit — appuyer sur une touche ne contourne rien.

(function () {
    const joy = () => (window.joystickData = window.joystickData || { active: false, x: 0, y: 0 });

    // AZERTY et QWERTY à la fois : le jeu est bilingue, et `event.code` donne la touche
    // PHYSIQUE, donc KeyW est le Z d'un clavier français. On accepte les deux familles
    // plus les flèches, ce qui couvre les deux dispositions sans détection de locale.
    const HAUT = ['KeyW', 'KeyZ', 'ArrowUp'];
    const BAS = ['KeyS', 'ArrowDown'];
    const GAUCHE = ['KeyA', 'KeyQ', 'ArrowLeft'];
    const DROITE = ['KeyD', 'ArrowRight'];

    // Une capacité = une touche = le déclencheur global du bouton correspondant.
    const CAPACITES = {
        Digit1: () => window.triggerMagicShockwave && window.triggerMagicShockwave(),
        Digit2: () => window.triggerPearlShield && window.triggerPearlShield(),
        Digit3: () => window.triggerAnais && window.triggerAnais(),
        Digit4: () => window.triggerMalik && window.triggerMalik(),
        Digit5: () => window.triggerDolphinUltimate && window.triggerDolphinUltimate(),
        Space: () => declencherRayon()
    };

    // Le Rayon a un temps de recharge de 3 s porté par la classe CSS `cooldown` du
    // bouton. La touche passe par le bouton lui-même plutôt que de poser `fireRay`
    // directement : sinon elle tirerait pendant la recharge, ce que la souris ne peut
    // pas faire.
    function declencherRayon() {
        const btn = document.getElementById('ray-action-btn');
        if (!btn || btn.style.display === 'none' || btn.classList.contains('cooldown')) return;
        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }

    const enfoncees = new Set();

    // Le mode d'entrée se DÉDUIT DE L'USAGE, pas d'une détection d'appareil : un portable
    // tactile est les deux à la fois, et un joueur peut brancher une manette en cours de
    // partie. La première touche masque le joystick, le premier contact tactile le rend.
    function modeBureau(actif) {
        document.body.classList.toggle('desktop-input', actif);
    }

    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        const c = e.code;
        const bouge = HAUT.includes(c) || BAS.includes(c) || GAUCHE.includes(c) || DROITE.includes(c);
        if (!bouge && !CAPACITES[c]) return;
        e.preventDefault();
        modeBureau(true);
        if (bouge) { enfoncees.add(c); appliquerClavier(); }
        else CAPACITES[c]();
    });

    window.addEventListener('keyup', e => {
        if (enfoncees.delete(e.code)) appliquerClavier();
    });

    // Une fenêtre qui perd le focus touche enfoncée laissait Mimi nager toute seule.
    window.addEventListener('blur', () => { enfoncees.clear(); appliquerClavier(); });

    window.addEventListener('touchstart', () => modeBureau(false), { passive: true });

    function appliquerClavier() {
        if (manetteActive) return;   // la manette a la priorité tant qu'elle est poussée
        let x = 0, y = 0;
        enfoncees.forEach(c => {
            if (HAUT.includes(c)) y -= 1;
            if (BAS.includes(c)) y += 1;
            if (GAUCHE.includes(c)) x -= 1;
            if (DROITE.includes(c)) x += 1;
        });
        poser(x, y);
    }

    // Normalisation : sans elle, une diagonale vaut une longueur de 1,41 et Mimi nage
    // 41 % plus vite en biais qu'en ligne droite.
    function poser(x, y) {
        const d = Math.hypot(x, y);
        const j = joy();
        if (d < 0.01) { j.active = false; j.x = 0; j.y = 0; return; }
        j.active = true;
        j.x = x / Math.max(1, d);
        j.y = y / Math.max(1, d);
    }

    // --- MANETTE ---
    const ZONE_MORTE = 0.25;          // les sticks dérivent au repos
    const BOUTONS = [                 // A, B, X, Y, LB, RB sur une disposition Xbox
        () => CAPACITES.Space(),
        () => CAPACITES.Digit1(),
        () => CAPACITES.Digit2(),
        () => CAPACITES.Digit3(),
        () => CAPACITES.Digit4(),
        () => CAPACITES.Digit5()
    ];
    let manetteActive = false;
    let precedents = [];

    function sonderManette() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = Array.prototype.find.call(pads, p => p);
        if (pad) {
            let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
            if (Math.abs(x) < ZONE_MORTE) x = 0;
            if (Math.abs(y) < ZONE_MORTE) y = 0;
            const pousse = x !== 0 || y !== 0;
            if (pousse) { manetteActive = true; modeBureau(true); poser(x, y); }
            else if (manetteActive) { manetteActive = false; appliquerClavier(); }

            BOUTONS.forEach((fn, i) => {
                const p = !!(pad.buttons[i] && pad.buttons[i].pressed);
                if (p && !precedents[i]) { modeBureau(true); fn(); }
                precedents[i] = p;
            });
        }
        requestAnimationFrame(sonderManette);
    }
    requestAnimationFrame(sonderManette);
})();
