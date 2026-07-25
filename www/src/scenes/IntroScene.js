// --- SCENE D'INTRODUCTION (SNES STYLE) ---
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
        // Seulement au niveau 1. Sinon on passe de suite à MainScene
        if (window.currentLevel !== 1) {
            this.scene.start('MainScene');
            return;
        }

        // Le HUD (vies, perles, jauge de pollution) et le joystick étaient révélés par
        // startGameFlow() avant même le prologue : le premier plan de la cinématique
        // s'ouvrait sur cinq cœurs et « POLLUTION: 100% » plaqués par-dessus. On les
        // garde masqués jusqu'à la reprise de contrôle.
        this.setHudVisible(false);

        // Lancement de la musique mélancolique
        if (window.startIntroMusic) window.startIntroMusic();

        this.cameras.main.setBackgroundColor('#000000');
        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        // Le prologue était écrit en dur en français : un joueur anglophone recevait
        // les quatre écrans d'ouverture — sa première minute de jeu — dans une langue
        // qu'il ne lit peut-être pas, alors que tout le reste de l'interface était
        // traduit. Les textes rejoignent le dictionnaire commun.
        const str = key => (window.getStr ? window.getStr(key) : '');
        this.steps = [
            { img: 'intro_coral', text: str('intro1') },
            { img: 'intro_factory', text: str('intro2') },
            { img: 'intro_monsters', text: str('intro3') },
            { img: 'intro_mimi', text: str('intro4') }
        ];

        this.currentStep = 0;

        // Eléments d'interface avec taille réajustée pour les Assets HD Super Metroid
        this.imageSprite = this.add.sprite(cx, cy - 80, 'intro_coral').setScale(5).setAlpha(0);

        // Les lignes du prologue étaient coupées manuellement par des \n calibrés sur un
        // seul écran : sur un téléphone étroit (320 px), la plus longue débordait des deux
        // côtés. Largeur de rendu bornée, retour à la ligne automatique et corps de texte
        // proportionnel à l'écran.
        const wrapWidth = Math.min(this.game.config.width - 40, 420);
        const fontPx = Math.max(8, Math.min(12, Math.round(this.game.config.width / 34)));
        this.textDisplay = this.add.text(cx, cy + 120, "", {
            fontFamily: '"Press Start 2P"', fontSize: fontPx + 'px', fill: '#ffffff', align: 'center',
            lineSpacing: 10, wordWrap: { width: wrapWidth, useAdvancedWrap: true }
        }).setOrigin(0.5);

        const skipText = this.add.text(this.game.config.width - 10, this.game.config.height - 10, str('skipBtn'), {
            fontFamily: '"Press Start 2P"', fontSize: '8px', fill: '#888888'
        }).setOrigin(1, 1);

        // Au clic, on passe à l'étape suivante, ou on passe l'intro
        this.input.on('pointerdown', () => {
            if (this.isTransitioning) return;
            if (this.typewriterEvent) {
                // Si le texte n'a pas fini de s'afficher, on l'affiche d'un coup
                this.typewriterEvent.remove();
                this.typewriterEvent = null;
                this.textDisplay.setText(this.steps[this.currentStep].text);

                // Queuer le délai automatique
                this.introTimeout = this.time.delayedCall(4000, () => {
                    this.nextStep();
                });
            } else {
                this.nextStep();
            }
        });

        this.showStep();
    }

    // Le HUD est en DOM, hors du canvas : Phaser ne peut pas le masquer lui-même.
    setHudVisible(visible) {
        ['ui-layer', 'joystick-wrapper'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.opacity = visible ? '1' : '0';
            // Sans ça le joystick, invisible mais toujours présent, avalait les taps
            // dans tout le coin inférieur droit : « TAP POUR PASSER » y est justement.
            el.style.pointerEvents = visible ? '' : 'none';
        });
    }

    showStep() {
        if (this.currentStep >= this.steps.length) {
            this.finishIntro();
            return;
        }

        const stepData = this.steps[this.currentStep];
        this.imageSprite.setTexture(stepData.img);
        this.textDisplay.setText("");

        // Fondu au noir entrant
        this.tweens.add({
            targets: this.imageSprite,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.typewriteText(stepData.text);
            }
        });
    }

    typewriteText(text) {
        let length = text.length;
        let i = 0;
        this.typewriterEvent = this.time.addEvent({
            callback: () => {
                this.textDisplay.text += text[i];
                i++;
                if (i === length) {
                    this.typewriterEvent = null;
                    // Auto passage à la suite après un délai court si pas de clic
                    this.introTimeout = this.time.delayedCall(4000, () => {
                        this.nextStep();
                    });
                }
            },
            repeat: length - 1, delay: 50
        });
    }

    nextStep() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        if (this.introTimeout) {
            this.introTimeout.remove();
            this.introTimeout = null;
        }

        // Fondu au noir sortant
        this.tweens.add({
            targets: [this.imageSprite, this.textDisplay],
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.currentStep++;
                this.textDisplay.setAlpha(1); // Reset alpha pour le text
                this.isTransitioning = false;
                this.showStep();
            }
        });
    }

    finishIntro() {
        // Redémarre l'Alpha à 0 pour éviter un clignotement
        this.imageSprite.setAlpha(0);
        this.textDisplay.setAlpha(0);

        if (window.stopIntroMusic) window.stopIntroMusic();

        // On lance la vraie musique et on passe au jeu normal
        if (typeof window.startProceduralMusic === 'function') {
            window.startProceduralMusic();
        }

        this.cameras.main.fade(1000, 0, 0, 0);
        this.time.delayedCall(1000, () => {
            this.setHudVisible(true);
            this.scene.start('MainScene');
        });
    }
}
