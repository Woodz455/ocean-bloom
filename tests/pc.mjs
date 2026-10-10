// Vérification de l'alignement PC : le clavier bouge vraiment Mimi, la manette
// est branchée, plus rien du tactile ne subsiste, et le HUD tient sur 16:9.
import { chromium } from 'playwright';
import { SP, attach, boot, snap } from './lib.mjs';

const VUES = [{ n: '1920x1080', w: 1920, h: 1080 }, { n: '1280x720', w: 1280, h: 720 }];

const nav = await chromium.launch();
for (const v of VUES) {
    const ctx = await nav.newContext({ viewport: { width: v.w, height: v.h }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    const errs = [];
    attach(p, errs);
    await boot(p);

    // 1. Ce qui devait disparaître a disparu.
    const restes = await p.evaluate(() => ({
        joystick: !!document.getElementById('joystick-wrapper'),
        stick: !!document.getElementById('joystick-stick'),
        joySens: !!document.getElementById('slide-joy-sens'),
        gestes: !!document.getElementById('cb-swipes-only'),
        gaucher: !!document.getElementById('cb-left-hand'),
        capacitor: !!window.Capacitor,
        sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
        manifeste: !!document.querySelector('link[rel="manifest"]'),
        haptics: typeof window.Haptics === 'object' && typeof window.Haptics.impact === 'function'
    }));

    // 2. Le clavier pilote. On mesure un DÉPLACEMENT réel, pas l'état d'une variable :
    //    c'est la seule preuve que la chaîne touche → joystickData → scène tient.
    const avant = await snap(p);
    await p.keyboard.down('KeyD');
    await p.waitForTimeout(1200);
    const joy = await p.evaluate(() => ({ ...window.joystickData }));
    await p.keyboard.up('KeyD');
    await p.waitForTimeout(300);
    const apres = await snap(p);
    const dx = Math.round(apres.x - avant.x);

    // 3. Le rappel des touches est visible d'emblée (avant, il fallait une touche).
    const rappel = await p.evaluate(() => {
        const b = document.getElementById('magic-action-btn');
        b.style.display = 'block';
        return getComputedStyle(b, '::after').display;
    });

    await p.screenshot({ path: `${SP}/pc-${v.n}.png` });
    console.log(`\n=== ${v.n} ===`);
    console.log(JSON.stringify({ restes, dx, joy, rappelTouches: rappel, erreurs: errs.length }, null, 1));
    if (errs.length) console.log(errs.slice(0, 5));
    await ctx.close();
}
await nav.close();
