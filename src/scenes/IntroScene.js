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

        // Lancement de la musique mélancolique
        if (window.startIntroMusic) window.startIntroMusic();

        this.cameras.main.setBackgroundColor('#000000');
        const cx = this.game.config.width / 2;
        const cy = this.game.config.height / 2;

        this.steps = [
            { img: 'intro_coral', text: "Il fut un temps où le Grand Récif\nirradiait de pureté..." },
            { img: 'intro_factory', text: "Mais la cupidité de la surface\nprojeta une ombre mortelle." },
            { img: 'intro_monsters', text: "La vase consuma la vie, plongeant\nnotre royaume dans les abysses infinis." },
            { img: 'intro_mimi', text: "Seule l'Éclat de l'Océan peut encore\nrepousser les ténèbres..." }
        ];

        this.currentStep = 0;

        // Eléments d'interface avec taille réajustée pour les Assets HD Super Metroid
        this.imageSprite = this.add.sprite(cx, cy - 80, 'intro_coral').setScale(5).setAlpha(0);
        this.textDisplay = this.add.text(cx, cy + 120, "", {
            fontFamily: '"Press Start 2P"', fontSize: '10px', fill: '#ffffff', align: 'center', lineSpacing: 10
        }).setOrigin(0.5);

        const skipText = this.add.text(this.game.config.width - 10, this.game.config.height - 10, "TAP POUR PASSER", {
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
            this.scene.start('MainScene');
        });
    }
}
