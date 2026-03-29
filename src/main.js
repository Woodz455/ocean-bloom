import './managers/UIManager.js';
import IntroScene from './scenes/IntroScene.js';
import MainScene from './scenes/MainScene.js';
import ChaseScene from './scenes/ChaseScene.js';

// --- CONFIGURATION PHASER ---
window.initPhaserGame = function () {
    if (window.gameInstance) return;

    const config = {
        type: Phaser.WEBGL, 
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container',
        pixelArt: true,
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: [IntroScene, MainScene, ChaseScene], 
        backgroundColor: '#000000'
    };

    window.gameInstance = new Phaser.Game(config);
};
