// --- GESTION DU DÉMARRAGE ET AUDIO ---
let audioCtx;
window.musicFilter = null;

function ensureMusicFilter() {
    if (!window.musicFilter && audioCtx) {
        window.musicFilter = audioCtx.createBiquadFilter();
        window.musicFilter.type = 'lowpass';
        // Valeur initiale très étouffée (comme si l'océan était sale)
        window.musicFilter.frequency.value = 400;
        window.musicFilter.connect(audioCtx.destination);
    }
}

window.updateAudioPollution = function (percentPolluted) {
    if (window.musicFilter && audioCtx) {
        // percentPolluted va de 1.0 (très sale) à 0.0 (complètement nettoyé)
        let minFreq = 400; // Très étouffé, grondant
        let maxFreq = 20000; // Son cristallin complètement ouvert
        // On utilise une échelle logarithmique/exponentielle pour la fréquence (plus naturel)
        let targetFreq = minFreq * Math.pow(maxFreq / minFreq, 1 - Math.max(0, Math.min(1, percentPolluted)));
        // On lisse la transition sur 0.5 secondes pour éviter les clics secs
        window.musicFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.5);
    }
};

function initAudio() {
    // Unlock audio context on tap
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Play a completely silent ping to confirm unlock
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 1;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playCinematicChime(index) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    const freqs = [329.63, 392.00, 523.25]; // E4, G4, C5 (Mysterious upward progression)
    osc.frequency.setValueAtTime(freqs[index % freqs.length], audioCtx.currentTime);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.5); // Slow attack
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 4.5); // Long decay

    const delay = audioCtx.createDelay();
    delay.delayTime.value = 0.6;
    const feedback = audioCtx.createGain();
    feedback.gain.value = 0.4;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 5.0);
}

function startAmbientSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Bourdonnement sourd (Drones sous-marins)
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, audioCtx.currentTime);

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, audioCtx.currentTime);

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(15, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Filtre pour étouffer le son
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);

    // Volume global
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);

    ensureMusicFilter();
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(window.musicFilter); // Connexion au filtre dynamique

    osc.start();
    lfo.start();

    // Bulles aléatoires
    setInterval(() => {
        if (Math.random() > 0.6) {
            const popOsc = audioCtx.createOscillator();
            popOsc.type = 'sine';
            popOsc.frequency.setValueAtTime(400, audioCtx.currentTime);
            popOsc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);

            const popGain = audioCtx.createGain();
            popGain.gain.setValueAtTime(0, audioCtx.currentTime);
            popGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
            popGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

            popOsc.connect(popGain);
            popGain.connect(audioCtx.destination);
            popOsc.start();
            popOsc.stop(audioCtx.currentTime + 0.15);
        }
    }, 2500);
}

// --- MUSIQUE GÉNÉRATIVE 16-BIT (Arpèges magiques) ---
function startProceduralMusic() {
    if (!audioCtx) return;

    // Gamme, Tempo et Instrument changent selon le niveau
    let oscType = 'square';
    let tempo = 120; // BPM de base

    // Le niveau est cyclique (modulo 4) pour toujours avoir une ambiance
    let levelTheme = (window.currentLevel || 1) % 4;

    // Do majeur pentatonique par défaut: C, D, E, G, A
    let scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

    if (levelTheme === 1) { // Thème 1 : Calme Lagon
        oscType = 'sine';
        tempo = 90;
        // Gamme plus douce et planante
        scale = [261.63, 293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46];
    } else if (levelTheme === 2) { // Thème 2 : Mystère Récif
        oscType = 'triangle';
        tempo = 140;
        // Gamme mineure pour un poil de tension
        scale = [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25];
    } else if (levelTheme === 3) { // Thème 3 : Abysses
        oscType = 'sawtooth';
        tempo = 80;
        // Gamme grave et très lente
        scale = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63];
    } else { // Thème 0 (Niveau 4, 8) : Aventure Classique
        oscType = 'square';
        tempo = 160;
    }

    // Notes de la mélodie sous forme d'index de la gamme
    const melody = [
        0, 2, 4, 5,  // Accords montants
        4, 2, 0, -1,
        1, 3, 5, 7,
        5, 3, 1, -1
    ];

    let noteIndex = 0;
    const noteDuration = (60 / tempo) / 2; // Croches

    if (window.musicInterval) clearInterval(window.musicInterval);

    window.musicInterval = setInterval(() => {
        const note = melody[noteIndex];
        noteIndex = (noteIndex + 1) % melody.length;

        if (note !== -1) {
            const osc = audioCtx.createOscillator();
            osc.type = oscType; // Son dynamique
            osc.frequency.setValueAtTime(scale[note], audioCtx.currentTime);

            const gain = audioCtx.createGain();
            // Enveloppe douce pour adoucir le côté "square" brut
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.02); // Attaque
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + noteDuration - 0.01); // Relâchement

            // Filtre passe-bas pour rendre le son moins agressif et plus sous-marin
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, audioCtx.currentTime);
            filter.Q.value = 5;

            // Echo/Delay (Effet de profondeur)
            const delay = audioCtx.createDelay();
            delay.delayTime.value = noteDuration * 1.5;
            const feedback = audioCtx.createGain();
            feedback.gain.value = 0.3;

            osc.connect(gain);
            gain.connect(filter);

            // Connexion du délai
            filter.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);

            ensureMusicFilter();
            filter.connect(window.musicFilter);
            delay.connect(window.musicFilter);

            osc.start();
            osc.stop(audioCtx.currentTime + noteDuration);
        }
    }, noteDuration * 1000);
}

function stopProceduralMusic() {
    if (window.musicInterval) {
        clearInterval(window.musicInterval);
        window.musicInterval = null;
    }
}

// --- MUSIQUE DE BOSS (Agressive et rapide) ---
function startBossMusic() {
    if (!audioCtx) return;
    stopProceduralMusic(); // Arrête la musique calme

    const scale = [130.81, 146.83, 164.81, 196.00, 220.00]; // Plus grave (C3 pentatonique)
    const melody = [0, 0, 1, 2, 0, -1, 3, 4, 3, 1]; // Riff agressif

    let noteIndex = 0;
    const tempo = 180; // BPM très rapide
    const noteDuration = (60 / tempo) / 2;

    window.musicInterval = setInterval(() => {
        const note = melody[noteIndex];
        noteIndex = (noteIndex + 1) % melody.length;

        if (note !== -1) {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth'; // Son agressif et saturé
            osc.frequency.setValueAtTime(scale[note], audioCtx.currentTime);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + noteDuration - 0.01);

            // Distorsion simple
            const distortion = audioCtx.createWaveShaper();
            function makeDistortionCurve(amount) {
                let k = typeof amount === 'number' ? amount : 50;
                let n_samples = 44100;
                let curve = new Float32Array(n_samples);
                let deg = Math.PI / 180;
                for (let i = 0; i < n_samples; ++i) {
                    let x = i * 2 / n_samples - 1;
                    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
                }
                return curve;
            }
            distortion.curve = makeDistortionCurve(400);

            ensureMusicFilter();
            osc.connect(distortion);
            distortion.connect(gain);
            gain.connect(window.musicFilter);

            osc.start();
            osc.stop(audioCtx.currentTime + noteDuration);
        }
    }, noteDuration * 1000);
}

// --- EFFETS SONORES (SFX) ---
let lastHurtTime = 0;
window.playHurtSound = function () {
    if (!audioCtx) return;

    // Cooldown anti-spam de 150ms
    const now = Date.now();
    if (now - lastHurtTime < 150) return;
    lastHurtTime = now;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth'; // Son agressif

    // Baisse de fréquence rapide (impact)
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
};

window.playPowerupSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square'; // Son brillant 8-bit classique

    // Balayage rapide vers le haut (Boost)
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
};

window.playMagicChargeSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; // Son pur magique

    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
};

window.playEnemyDefeatSound = function () {
    if (!audioCtx) return;

    // Explosion de bruit blanc
    const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // Jingle de triomphe
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    oscGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);

    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);

    noise.start();
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
};

window.playRecoverSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; // Son doux et pur

    // Accord / note douce
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.linearRampToValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
};

window.playBuySound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
};

window.playShootSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; // Magie pure
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
};

window.playLaserSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(5000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.4);
    filter.Q.value = 10;

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
};

window.playBossShootSound = function () {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle'; // Son plus lourd
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
};

window.playDolphinSound = function () {
    if (!audioCtx) return;
    // Cri aigu de dauphin entremêlé d'un zap électrique
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';

    // Squeak rapide (modulation)
    osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(2500, audioCtx.currentTime + 0.05);
    osc.frequency.linearRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(3000, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    // Bruit électrique superposé
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 5000;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    osc.start();
    noiseSource.start();
    osc.stop(audioCtx.currentTime + 0.35);
};
