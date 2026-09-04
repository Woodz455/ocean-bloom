// --- L'OUVERTURE JOUABLE ---
//
// Ce qu'il y avait avant : un splash de 3,5 s, puis quatre panneaux narratifs à environ
// 8,25 s chacun (fondu entrant 1 s, machine à écrire ~2,75 s, attente 4 s, fondu sortant
// 0,5 s), plus les fondus de transition — une quarantaine de secondes d'écrans NON
// INTERACTIFS, sous forme de mur de récit, avant que le joueur ait touché à quoi que ce
// soit. C'est le pire endroit possible pour raconter : personne n'a encore de raison
// d'écouter.
//
// Ce qu'il y a maintenant : le verbe du jeu ENSEIGNÉ EN LE FAISANT FAIRE. Comme le verbe
// est « éclairer dans le noir », l'ouverture s'écrit d'elle-même — et le texte tient en
// un mot.
//
//   1. Le jeu s'ouvre dans le noir presque total. Une lueur faible : Mimi. Le joueur a
//      la main immédiatement, dès la première image.
//   2. S'il ne fait rien pendant deux secondes, un seul mot apparaît : « Bouge. »
//   3. Il bouge ; au passage de la lumière, un poisson s'allume, un corail répond.
//      « La lumière révèle » est appris sans une ligne de texte.
//   4. La lueur faiblit. La pression se RESSENT, elle ne s'explique pas.
//   5. Une perle scintille à portée ; la ramasser recharge. « La lumière se nourrit ».
//   6. Au loin, une pulsation : la première balise. L'atteindre déclenche la floraison —
//      la couleur envahit l'écran et le titre du jeu apparaît DANS le monde, révélé par
//      la lumière au lieu d'être plaqué par-dessus.
//
// Le titre devient une récompense au lieu d'un péage, et l'écran de titre (boutique,
// réglages) passe après la floraison, quand le joueur sait enfin ce qu'il achète.
import { configurePlayer, updatePlayerMovement } from '../entities/Player.js';
import { createVeil, drawVeil, collectSources, createBeacon, bloomBeacon, addGlint, resizeVeil } from '../managers/Veil.js';
import { GameState } from '../managers/GameState.js';

const MONDE_W = 1600, MONDE_H = 1200;

export default class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntroScene' });
    }

    preload() {
        if (typeof window.loadGameAssets === 'function') {
            window.loadGameAssets(this);
        }
    }

    create() {
        // Le prologue ne se joue qu'une fois, à la première partie.
        if (window.currentLevel !== 1 || window.prologueVu) {
            this.scene.start('MainScene');
            return;
        }

        if (typeof window.applyMotionPreferences === 'function') window.applyMotionPreferences(this);

        // Le HUD n'a rien à dire ici : il n'y a ni objectif, ni score, ni menace. Un
        // écran d'ouverture couvert de jauges dilue le seul geste qu'on veut enseigner.
        this.setHudVisible(false);
        if (window.startIntroMusic) window.startIntroMusic();

        this.physics.world.setBounds(0, 0, MONDE_W, MONDE_H);
        this.cameras.main.setBackgroundColor(0x02121f);

        // Un décor placé à la main, et non tiré au hasard : c'est une mise en scène, et
        // chaque élément est là pour enseigner quelque chose de précis.
        this.add.tileSprite(MONDE_W / 2, MONDE_H / 2, MONDE_W, MONDE_H, 'ocean_bg')
            .setDepth(0).setTint(0x6f8aa8);

        this.decorerAlentours();

        // Le voile, la lumière et la balise sont EXACTEMENT ceux du jeu : aucun code
        // d'ouverture en double, donc rien qui puisse dériver du jeu réel.
        createVeil(this, MONDE_W, MONDE_H, 0x081c30);

        GameState.init();
        GameState.light = 78;   // pas au maximum : la baisse doit se voir arriver
        configurePlayer(this, MONDE_W, MONDE_H);
        this.player.setPosition(MONDE_W * 0.22, MONDE_H * 0.62);
        this.cameras.main.centerOn(this.player.x, this.player.y);

        // La boussole du jeu n'a pas de sens dans un décor scénarisé où il n'y a qu'une
        // seule direction possible.
        if (this.compassSprite) this.compassSprite.setVisible(false);

        this.etape = 'attente';
        this.aBouge = false;
        this.tempsDebut = this.time.now;

        // « Bouge. » — le seul texte de toute l'ouverture, et il n'apparaît que si le
        // joueur ne trouve pas de lui-même. S'il bouge avant, il ne le verra jamais :
        // c'est le but.
        //
        // Il est posé DANS LE MONDE, juste au-dessus de Mimi, et non fixé à l'écran.
        // Fixé à l'écran (scrollFactor 0), il subissait quand même le zoom de la caméra
        // — 2 sur un téléphone : le mot atterrissait tout en haut, à moitié coupé, par
        // dessus le bouton de réglages. Dans le monde, il est là où le joueur regarde,
        // et sa taille suit la grille comme le reste.
        this.motUnique = this.add.text(0, 0, this.str('proMove'), {
            fontFamily: '"Press Start 2P"', fontSize: '12px', fill: '#ffe9c0',
            stroke: '#00121f', strokeThickness: 4
        }).setOrigin(0.5).setDepth(40).setAlpha(0);

        this.time.delayedCall(2200, () => {
            if (this.aBouge || !this.scene.isActive()) return;
            this.tweens.add({ targets: this.motUnique, alpha: 1, duration: 700 });
        });

        this.scale.on('resize', () => resizeVeil(this), this);

        drawVeil(this, collectSources(this, this.player, GameState.lightRadius()), 0);
    }

    str(key) {
        return (window.getStr && window.getStr(key)) || '';
    }

    // Le HUD est en DOM, hors du canvas : Phaser ne peut pas le masquer lui-même.
    setHudVisible(visible) {
        const el = document.getElementById('ui-layer');
        if (!el) return;
        el.style.opacity = visible ? '1' : '0';
        el.style.pointerEvents = visible ? '' : 'none';
    }

    // Le décor de l'ouverture. Trois groupes, chacun avec un rôle :
    //   · autour du départ, de quoi voir la lumière révéler quelque chose ;
    //   · à mi-chemin, la perle qui recharge ;
    //   · au bout, la balise et le récif qui va fleurir.
    decorerAlentours() {
        const corail = [
            [0.30, 0.55], [0.33, 0.70], [0.26, 0.74], [0.38, 0.60]
        ];
        for (const [fx, fy] of corail) {
            const k = ['coral_red', 'coral_red_b', 'weed_green', 'weed_green_b'][Math.floor(Math.random() * 4)];
            const s = this.add.image(MONDE_W * fx, MONDE_H * fy, k).setDepth(4);
            s.setFlipX(Math.random() > 0.5);
            this.tweens.add({
                targets: s, angle: { from: -12, to: 12 },
                duration: 2200 + Math.random() * 900, yoyo: true, repeat: -1
            });
        }

        // Le poisson qui s'allume au passage de la lumière. Il nage sur place, tout
        // près : c'est la première chose que le joueur découvrira par lui-même.
        this.poisson = this.add.sprite(MONDE_W * 0.34, MONDE_H * 0.58, 'fish_orange').setDepth(14);
        this.poisson.anims.play(window.ensureAnim(this, 'fish_orange_swim',
            ['fish_orange', 'fish_orange2', 'fish_orange', 'fish_orange3'], 6), true);
        this.tweens.add({
            targets: this.poisson, x: this.poisson.x + 70,
            duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });

        // LE RÉCIF DE LA FLORAISON. Il est dense — c'est lui qui doit surgir du noir au
        // dernier moment, et l'image doit valoir le trajet.
        this.recif = [];
        for (let i = 0; i < 26; i++) {
            const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 300;
            const k = ['coral_red', 'coral_red_b', 'coral_red_c', 'weed_green',
                'weed_green_b', 'weed_purple', 'weed_purple_b'][Math.floor(Math.random() * 7)];
            const s = this.add.image(
                MONDE_W * 0.76 + Math.cos(a) * r,
                MONDE_H * 0.40 + Math.sin(a) * r * 0.75, k).setDepth(4);
            s.setFlipX(Math.random() > 0.5);
            this.tweens.add({
                targets: s, angle: { from: -12, to: 12 },
                duration: 2000 + Math.random() * 1200, yoyo: true, repeat: -1
            });
            this.recif.push(s);
        }
    }

    update(time, delta) {
        if (!this.player || this.termine) return;

        // Pendant le plan de fin, l'entrée est ignorée : sans ça, la main du joueur
        // resterait posée sur le joystick et le ferait repartir aussitôt.
        const joy = this.plansFige ? { active: false, x: 0, y: 0 }
            : (window.joystickData || { active: false, x: 0, y: 0 });

        if (joy.active && !this.aBouge) {
            this.aBouge = true;
            // Le mot disparaît dès le premier geste : il a fait son travail.
            this.tweens.add({ targets: this.motUnique, alpha: 0, duration: 400 });
        }

        // La réserve ne fond qu'à partir du moment où le joueur a la main : voir sa
        // lumière baisser sans avoir encore bougé serait une punition gratuite.
        //
        // Plus d'accélération ici. Le prologue faisait fondre la réserve 1,35 fois plus
        // vite pour que la leçon « la lumière s'épuise » arrive assez tôt, à l'époque où
        // le jeu ne fondait qu'à 2,2/s. Depuis le réglage à 3,2/s, la vitesse réelle
        // suffit — et il vaut mieux apprendre le rythme du jeu que celui du tutoriel.
        if (this.aBouge) GameState.drainLight(delta);

        updatePlayerMovement(this, time, joy);

        // Le mot suit Mimi tant qu'il est affiché.
        if (this.motUnique && this.motUnique.alpha > 0) {
            this.motUnique.setPosition(this.player.x, this.player.y - 82);
        }

        this.enchainer();
        drawVeil(this, collectSources(this, this.player, this.playerLightRadius || GameState.lightRadius()), time);
    }

    // La progression n'est pas une minuterie : chaque étape attend un GESTE du joueur.
    // C'est ce qui distingue une leçon jouée d'une cinématique déguisée.
    enchainer() {
        if (this.etape === 'attente' && this.aBouge) {
            this.etape = 'revelation';
            // Le poisson découvert lâche quelques étincelles : la découverte est
            // récompensée à l'instant même, sinon le joueur ne fait pas le lien.
            this.premiereRencontre = false;
        }

        if (this.etape === 'revelation') {
            if (!this.premiereRencontre &&
                Phaser.Math.Distance.Between(this.player.x, this.player.y, this.poisson.x, this.poisson.y) < 150) {
                this.premiereRencontre = true;
                this.eclat(this.poisson.x, this.poisson.y, 0xffd08a, 18);
                if (window.playPowerupSound) window.playPowerupSound();
            }
            // On passe à la suite quand la réserve a visiblement baissé : le joueur a
            // vu son halo se resserrer, la question « comment recharger ? » se pose.
            if (GameState.light < 46) {
                this.etape = 'perle';
                this.poserPerle();
            }
        }

        if (this.etape === 'perle' && this.perle && !this.perle.ramassee) {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.perle.x, this.perle.y) < 60) {
                this.perle.ramassee = true;
                GameState.addLight(48);
                this.eclat(this.perle.x, this.perle.y, 0xfff0c0, 26);
                if (window.playPowerupSound) window.playPowerupSound();
                this.perle.destroy();
                this.etape = 'balise';
                this.poserBalise();
            }
        }

        if (this.etape === 'balise' && this.balise && !this.balise.isLit) {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.balise.beaconX, this.balise.beaconY) < 80) {
                this.floraison();
            }
        }
    }

    // Petit éclat de découverte, réutilisé à chaque « ah, ça réagit ».
    eclat(x, y, teinte, n) {
        const m = this.add.particles('sparkle');
        m.setDepth(30);
        m.createEmitter({
            x, y, speed: { min: 40, max: 200 }, angle: { min: 0, max: 360 },
            scale: { start: 1.8, end: 0 }, alpha: { start: 1, end: 0 },
            lifespan: 900, blendMode: 'ADD', tint: teinte
        }).explode(n);
        this.time.delayedCall(1400, () => m.destroy());
    }

    // La perle apparaît DEVANT le joueur, dans la direction où il va : on ne veut pas
    // qu'il revienne en arrière, on veut qu'il continue et trouve la solution en route.
    poserPerle() {
        const px = Math.min(MONDE_W - 120, this.player.x + 300);
        const py = Phaser.Math.Clamp(this.player.y - 90, 120, MONDE_H - 120);
        this.perle = this.add.sprite(px, py, 'pearl').setDepth(15);
        this.perle.anims.play(window.ensureAnim(this, 'pearl_glint',
            ['pearl', 'pearl2', 'pearl3', 'pearl2'], 4), true);
        addGlint(this, this.perle, 0xfff0c0, 0.34);
    }

    poserBalise() {
        this.balise = createBeacon(this, MONDE_W * 0.76, MONDE_H * 0.40, 'coral_red');
        // Elle appelle de plus loin que dans le jeu : c'est une leçon, pas une chasse.
        this.balise.hint.setScale(0.9);
    }

    floraison() {
        this.etape = 'fini';
        bloomBeacon(this, this.balise, 720);
        GameState.addLight(GameState.maxLight);
        if (window.playMagicChargeSound) window.playMagicChargeSound();

        // LE TITRE, RÉVÉLÉ PAR LA LUMIÈRE. Il est posé dans le monde, au cœur du récif
        // qui vient de fleurir, et non plaqué par-dessus l'image : c'est la différence
        // entre une récompense et un panneau.
        // La caméra se cale sur la balise et cesse de suivre Mimi. C'est le seul plan
        // composé de tout le jeu, et il le mérite : sans ça, le titre apparaissait
        // pendant que la caméra courait encore après le joueur, hors du cadre.
        const cam = this.cameras.main;
        cam.stopFollow();
        cam.pan(this.balise.beaconX, this.balise.beaconY, 900, 'Sine.easeInOut');

        // La caméra cesse de suivre Mimi le temps du plan : si le joueur continue de
        // nager, il sort du cadre et regarde un écran sans lui pendant trois secondes.
        // On lui retire la main, comme le fait déjà la cinématique du Trident.
        window.joystickData.active = false;
        window.joystickData.x = 0; window.joystickData.y = 0;
        this.player.setVelocity(0);
        this.plansFige = true;

        // Le corps du titre se calcule depuis la largeur d'écran DIVISÉE PAR LE ZOOM :
        // à 34 px fixes et zoom 2, « L'Éclat de l'Océan » faisait 400 px de large sur un
        // téléphone de 390 px et sortait des deux côtés. Même raison pour le décalage
        // vertical : exprimé en pixels du monde, il envoyait le titre hors de l'écran
        // dès que le zoom valait 2.
        const zoom = cam.zoom || 1;
        const corps = Math.round(Phaser.Math.Clamp((this.scale.width / zoom) / 11, 16, 40));
        const hauteur = (this.scale.height / zoom) * 0.22;
        const titre = this.add.text(this.balise.beaconX, this.balise.beaconY - hauteur,
            this.str('title').replace(/<br\s*\/?>/gi, '\n'), {
            fontFamily: '"Cinzel Decorative", serif', fontSize: corps + 'px',
            fill: '#fffaf0', align: 'center', lineSpacing: Math.round(corps / 4),
            // Le titre se posait en clair sur le cœur de la floraison, qui est presque
            // blanc : il devenait illisible au moment même où il compte. Il lui faut donc
            // un fond, mais un contour de corps/4 DOUBLÉ d'une ombre portée sur le
            // contour transformait les lettres en pavé noir — l'excès inverse. Contour
            // fin, ombre sur le remplissage seul, et l'entrée attend que l'éclat initial
            // soit retombé.
            stroke: '#062033', strokeThickness: Math.max(3, Math.round(corps / 9))
        }).setOrigin(0.5).setDepth(31).setAlpha(0);
        titre.setShadow(0, 2, 'rgba(2,18,31,0.8)', 7, true, false);
        this.tweens.add({
            targets: titre, alpha: 1, y: titre.y - 26,
            delay: 650, duration: 1500, ease: 'Sine.easeOut'
        });

        // On laisse le joueur regarder : c'est le seul moment de l'ouverture où il n'y a
        // rien à faire, et il l'a mérité.
        this.time.delayedCall(3400, () => this.terminer());
    }

    // Le joueur peut aussi passer l'ouverture — mais il n'y a plus quarante secondes à
    // passer, et le bouton n'apparaît qu'après un moment pour ne pas suggérer l'ennui
    // avant qu'il ne s'installe.
    terminer() {
        if (this.termine) return;
        this.termine = true;
        window.prologueVu = true;
        // Écrit tout de suite : le joueur qui recharge la page juste après l'ouverture
        // ne doit pas la revoir. `resetProgress()` fait un localStorage.clear(), donc
        // une réinitialisation la rejouera — c'est bien le comportement voulu.
        if (typeof window.saveProgress === 'function') window.saveProgress();

        if (window.stopIntroMusic) window.stopIntroMusic();
        this.cameras.main.fade(900, 0, 0, 0);
        this.time.delayedCall(950, () => {
            this.scale.off('resize', undefined, this);
            // L'écran de titre — boutique, réglages, réinitialisation — vient MAINTENANT,
            // quand le joueur sait ce qu'est la lumière et donc ce que « rayon de
            // lumière » veut dire dans la boutique.
            if (typeof window.showTitleScreen === 'function') window.showTitleScreen();
            this.scene.stop();
        });
    }
}
