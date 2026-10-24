// --- L'ÉCRAN-TITRE VIVANT ---
//
// L'écran-titre était une page web : un dégradé bleu uni, des boutons orange. Le seul
// endroit du jeu où l'on ne voyait pas le jeu — et c'est celui que regardent la
// capture d'écran d'une page Steam et chaque joueur qui revient.
//
// Le moteur tourne maintenant DERRIÈRE le titre et la boutique : un récif éteint, Mimi
// dans son halo qui nage d'une balise à l'autre, et chaque balise qui fleurit en
// rendant ses couleurs au récif. Le titre ne dit plus ce qu'est le jeu, il le montre.
//
// Tout vient du jeu lui-même — voile, fond, balise, floraison, récif éteint, nage — et
// rien n'est dupliqué : l'écran-titre ne peut pas dériver du jeu réel. Mimi est menée
// par un joystick simulé, exactement comme le joueur la mène.
import { configurePlayer, updatePlayerMovement } from '../entities/Player.js';
import { createVeil, drawVeil, collectSources, createBeacon, bloomBeacon, resizeVeil, decorEteint } from '../managers/Veil.js';
import { creerFond } from '../managers/Fond.js';
import { GameState } from '../managers/GameState.js';

const MONDE_W = 2400, MONDE_H = 1200;
// Les balises du parcours, en fractions du monde : une ligne qui ondule, de gauche à
// droite, pour que la caméra glisse au lieu de sauter.
const BALISES = [[0.24, 0.46], [0.52, 0.60], [0.80, 0.44]];
// Vitesse de nage : un tiers de celle du jeu. C'est une promenade, pas une course.
const ALLURE = 0.32;
const RAYON_FLORAISON = 420;

export default class TitreScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitreScene' });
    }

    create() {
        // `restart` relance create() sur la MÊME instance : la liste du récif garderait
        // les sprites détruits du cycle précédent.
        this.decorRecif = [];
        this.physics.world.setBounds(0, 0, MONDE_W, MONDE_H);
        this.cameras.main.setBackgroundColor(0x02121f);
        creerFond(this, 'lagoon');

        this.balises = BALISES.map(([fx, fy]) => {
            const x = MONDE_W * fx, y = MONDE_H * fy;
            this.recifAutour(x, y);
            return createBeacon(this, x, y, 'coral_red');
        });

        createVeil(this, MONDE_W, MONDE_H, 0x081c30);

        // La réserve est figée : sur l'écran-titre, rien ne s'épuise.
        GameState.init();
        GameState.light = 72;
        configurePlayer(this, MONDE_W, MONDE_H);
        if (this.compassSprite) this.compassSprite.setVisible(false);
        this.player.setPosition(MONDE_W * 0.06, MONDE_H * 0.52);
        this.cameras.main.centerOn(this.player.x, this.player.y);
        this.cameras.main.setBounds(0, 0, MONDE_W, MONDE_H);
        // Une caméra plus lente que celle du jeu : on contemple, on ne pilote pas.
        this.cameras.main.startFollow(this.player, true, 0.03, 0.03);

        this.cible = 0;
        this.pause = 0;
        this.fini = false;

        this.scale.on('resize', () => resizeVeil(this), this);
        this.events.once('shutdown', () => this.scale.off('resize', undefined, this));
        this.cameras.main.fadeIn(1200, 0, 0, 0);
        drawVeil(this, collectSources(this, this.player, GameState.lightRadius()), 0);
    }

    // Un récif dense et éteint autour de chaque balise : c'est lui que la floraison
    // rallume, et c'est l'image que l'écran-titre doit montrer.
    recifAutour(cx, cy) {
        const cles = ['coral_red', 'coral_red_b', 'coral_red_c', 'weed_green',
            'weed_green_b', 'weed_purple', 'weed_purple_b', 'crystal_blue'];
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 300;
            const k = cles[Math.floor(Math.random() * cles.length)];
            if (!this.textures.exists(k)) continue;
            const s = this.add.image(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, k).setDepth(4);
            decorEteint(this, s, k);
            s.setFlipX(Math.random() > 0.5);
            this.tweens.add({
                targets: s, angle: { from: -10, to: 10 },
                duration: 2200 + Math.random() * 1200, yoyo: true, repeat: -1
            });
        }
    }

    update(time, delta) {
        if (!this.player) return;
        GameState.light = 72;

        let joy = { active: false, x: 0, y: 0 };
        const b = this.balises[this.cible];
        if (b && time > this.pause) {
            const dx = b.beaconX - this.player.x, dy = b.beaconY - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < 40) {
                bloomBeacon(this, b, RAYON_FLORAISON);
                this.cible++;
                // Un temps d'arrêt après chaque floraison : on la regarde.
                this.pause = time + 2600;
            } else {
                joy = { active: true, x: dx / d * ALLURE, y: dy / d * ALLURE };
            }
        } else if (!b && !this.fini) {
            // Tout le récif a refleuri : fondu au noir, et le cycle recommence.
            this.fini = true;
            this.time.delayedCall(3500, () => {
                this.cameras.main.fadeOut(1400, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
            });
        }

        updatePlayerMovement(this, time, joy);
        drawVeil(this, collectSources(this, this.player, GameState.lightRadius()), time);
    }
}
