// NON-RÉGRESSION DU PARCOURS COMPLET.
//
// Le voile a touché à la génération de niveau, aux alliés, au boss, à l'interface et à
// l'ouverture. Ce script vérifie que tout ce qui n'était PAS censé bouger fonctionne
// toujours : les dix niveaux, les deux courses, les six capacités, la cinématique du
// Trident, l'écran de défaite et les crédits.
//
// Il ne nage pas les dix niveaux — en headless le rendu est logiciel et une partie
// réelle prendrait des heures. Il allume les balises par le même chemin de code que le
// joueur (`bloomBeacon` via la collision), puis vérifie l'état obtenu.
import { chromium } from 'playwright';
import { SP, attach, boot } from './lib.mjs';

const b = await chromium.launch();
const resultats = [];
const noter = (quoi, ok, detail) => {
  resultats.push({ quoi, ok, detail });
  console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + quoi + (detail ? ' — ' + detail : ''));
};

async function page(niveau) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(1000);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(700);
  await boot(p);
  return { ctx, p, errs };
}

// --- 1. LES DIX NIVEAUX SE CHARGENT ---
console.log('\n--- Chargement des dix niveaux ---');
for (let n = 1; n <= 10; n++) {
  const { ctx, p, errs } = await page(n);
  const r = await p.evaluate(() => {
    const g = window.gameInstance;
    const sc = g.scene.scenes.find(s => s.scene.isActive() && s.scene.key !== 'IntroScene');
    if (!sc) return { scene: 'aucune' };
    let horsGrille = 0;
    sc.children.list.forEach(o => {
      if (o.anims && o.anims.isPlaying && (Math.abs(o.scaleX - 1) > 0.001 || Math.abs(o.scaleY - 1) > 0.001)) horsGrille++;
    });
    return {
      scene: sc.scene.key, niveau: window.currentLevel,
      balises: sc.beacons ? sc.beacons.length : null,
      voile: !!sc.veil, horsGrille
    };
  });
  const course = (n % 4 === 0);
  const attendu = course ? 'ChaseScene' : 'MainScene';
  noter(`niveau ${n} → ${attendu}`,
    r.scene === attendu && r.horsGrille === 0 && errs.length === 0,
    `${r.scene}, balises=${r.balises}, voile=${r.voile}, horsGrille=${r.horsGrille}, err=${errs.length}` +
    (errs.length ? ' :: ' + errs[0] : ''));
  await ctx.close();
}

// --- 2. LES TROIS POUVOIRS ---
//
// Il y en avait six. Les trois invocations (Anaïs, Malik, Dauphins) ne sont plus des
// pouvoirs : les Dauphins ont disparu, et les deux autres arrivent d'eux-mêmes. On
// vérifie donc DEUX choses distinctes — que les trois pouvoirs répondent, et qu'aucun
// des anciens déclencheurs ne subsiste (une capacité fantôme jouable serait un bug).
console.log('\n--- Les trois pouvoirs ---');
{
  const { ctx, p, errs } = await page(2);
  // Onde et Bouclier se paient en lumière : on vérifie que le coût est REELLEMENT
  // prélevé. Un pouvoir dont le coût ne part pas serait invisible à l'œil, et c'est
  // précisément le genre de bug qu'une refonte d'économie laisse derrière elle.
  for (const [nom, cout] of [['triggerMagicShockwave', 'shockwave'], ['triggerPearlShield', 'shield']]) {
    const r = await p.evaluate(async ([n, k]) => {
      const mod = await import('./src/managers/GameState.js');
      mod.GameState.light = mod.GameState.maxLight;   // réserve pleine avant chaque essai
      mod.GameState.notify();
      const avant = mod.GameState.light;
      if (typeof window[n] === 'function') window[n]();
      return { existe: typeof window[n] === 'function', avant, apres: mod.GameState.light, cout: mod.GameState.COSTS[k] };
    }, [nom, cout]);
    await p.waitForTimeout(900);
    // La fonte continue pendant l'appel : on tolère qu'il soit parti UN PEU plus.
    const preleve = r.avant - r.apres;
    const ok = r.existe && preleve >= r.cout && preleve < r.cout + 5 && errs.length === 0;
    noter('pouvoir ' + nom, ok,
      `coût ${r.cout}, prélevé ${preleve.toFixed(1)}, err=${errs.length}` + (errs.length ? ' :: ' + errs[0] : ''));
  }
  {
    const r = await p.evaluate(() => ({ existe: typeof window.triggerRay === 'function' }));
    noter('pouvoir triggerRay', r.existe && errs.length === 0, 'err=' + errs.length);
  }

  // Réserve à sec : plus aucun des trois boutons ne doit s'afficher.
  const sec = await p.evaluate(async () => {
    const mod = await import('./src/managers/GameState.js');
    mod.GameState.light = 0; mod.GameState.notify();
    window.hasTrident = true; window.updateGameUI();
    return ['magic-action-btn', 'shield-action-btn', 'ray-action-btn']
      .filter(id => document.getElementById(id).style.display !== 'none');
  });
  noter('à sec, aucun pouvoir proposé', sec.length === 0, 'encore visibles=' + JSON.stringify(sec));

  const morts = await p.evaluate(() => ['triggerAnais', 'triggerMalik', 'triggerDolphinUltimate']
    .filter(n => typeof window[n] === 'function'));
  noter('aucun déclencheur fantôme', morts.length === 0, 'restants=' + JSON.stringify(morts));
  await ctx.close();
}

// --- 2b. MALIK ARRIVE AU BOSS, DE LUI-MÊME ---
console.log('\n--- Malik au boss ---');
{
  const { ctx, p, errs } = await page(2);
  await p.evaluate(async () => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const mod = await import('./src/entities/Enemies.js');
    mod.spawnBoss(sc);
  });
  // spawnBoss pose bossActive dans l'onComplete d'un tween de 2500 ms de TEMPS DE SCÈNE,
  // qui avance ~4x moins vite qu'une montre en headless : on sonde au lieu d'attendre.
  for (let k = 0; k < 250; k++) {
    const vu = await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      return !!(sc && sc.malikActive);
    });
    if (vu) break;
    await p.waitForTimeout(150);
  }
  const rb = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    return {
      boss: !!(sc.boss && sc.boss.active),
      malik: !!(sc.malik && sc.malik.active),
      voileProfondeur: sc.veil ? sc.veil.depth : null
    };
  });
  noter('boss apparaît + Malik arrive seul', rb.boss && rb.malik && errs.length === 0,
    JSON.stringify(rb) + ' err=' + errs.length + (errs.length ? ' :: ' + errs[0] : ''));
  await p.screenshot({ path: `${SP}/parcours-boss.png` });
  await ctx.close();
}

// --- 2c. ANAÏS ARRIVE À LA BALISE QUI REND UN CŒUR ---
console.log('\n--- Anaïs à la balise ---');
{
  const { ctx, p, errs } = await page(2);
  // Elle ne vient que si le soin PREND, donc il faut avoir perdu un cœur.
  await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    sc.damagePlayer(2);
  });
  await p.waitForTimeout(600);
  // Deux balises : le soin tombe sur la DEUXIÈME (une sur deux). On les allume par le
  // chemin du joueur — la collision de proximité dans updatePlayerMovement.
  for (let i = 0; i < 2; i++) {
    await p.evaluate(n => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      const b = sc.beacons.filter(x => !x.isLit)[0];
      if (b) { sc.player.x = b.beaconX; sc.player.y = b.beaconY; }
    }, i);
    await p.waitForTimeout(900);
  }
  const r = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    return { allumees: sc.beaconsLit, anais: !!(sc.anais && sc.anais.active), hp: window.playerHp };
  });
  noter('Anaïs arrive au soin', r.allumees >= 2 && r.anais && errs.length === 0,
    JSON.stringify(r) + ' err=' + errs.length + (errs.length ? ' :: ' + errs[0] : ''));
  await ctx.close();
}

// --- 3. LA DÉFAITE ---
console.log('\n--- Défaite ---');
{
  const { ctx, p, errs } = await page(2);
  await p.evaluate(async () => {
    const g = window.gameInstance;
    const sc = g.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const mod = await import('./src/managers/GameState.js');
    while (mod.GameState.hp > 0) sc.damagePlayer(1);
  });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const el = document.getElementById('gameover-screen') || document.querySelector('[id*="gameover"], [id*="defeat"]');
    return { trouve: !!el, visible: el ? getComputedStyle(el).display : null, hp: window.playerHp };
  });
  noter('écran de défaite', r.trouve && r.visible !== 'none' && errs.length === 0,
    JSON.stringify(r) + ' err=' + errs.length + (errs.length ? ' :: ' + errs[0] : ''));
  await ctx.close();
}

// --- 4. LA CINÉMATIQUE DU TRIDENT (niveau 6) ---
console.log('\n--- Cinématique du Trident ---');
{
  const { ctx, p, errs } = await page(6);
  await p.evaluate(() => window.testCinematic());
  // triggerInlineCinematic fait apparaitre Nana par un delayedCall de 2000 ms de TEMPS
  // DE SCENE. En headless l'horloge Phaser avance ~4x moins vite qu'une montre : une
  // attente de 6 s en temps reel n'en valait que 1,5 et faisait echouer le test alors
  // que la cinematique fonctionne. On sonde jusqu'a ce que Nana existe.
  for (let k = 0; k < 200; k++) {
    const vue = await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      return !!(sc && sc.nana);
    });
    if (vue) break;
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    return { nana: !!(sc && sc.nana), textes: sc ? sc.children.list.filter(o => o.type === 'Text').length : 0 };
  });
  noter('cinématique niveau 6 (Nana)', r.nana && errs.length === 0,
    JSON.stringify(r) + ' err=' + errs.length + (errs.length ? ' :: ' + errs[0] : ''));
  await p.screenshot({ path: `${SP}/parcours-trident.png` });
  await ctx.close();
}

// --- 5. LES CRÉDITS (fin du niveau 10) ---
console.log('\n--- Crédits ---');
{
  const { ctx, p, errs } = await page(10);
  await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    sc.winGame();
  });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const c = document.getElementById('credits-screen');
    return {
      visible: c ? getComputedStyle(c).display : null,
      opacite: c ? getComputedStyle(c).opacity : null,
      debordement: c ? (c.scrollWidth > c.clientWidth) : null,
      niveau: window.currentLevel
    };
  });
  noter('crédits après le niveau 10', r.visible === 'flex' && r.debordement === false && errs.length === 0,
    JSON.stringify(r) + ' err=' + errs.length + (errs.length ? ' :: ' + errs[0] : ''));
  await p.screenshot({ path: `${SP}/parcours-credits.png` });
  await ctx.close();
}

const echecs = resultats.filter(r => !r.ok);
console.log('\n=== BILAN : ' + (resultats.length - echecs.length) + '/' + resultats.length + ' ===');
if (echecs.length) echecs.forEach(e => console.log('  ÉCHEC : ' + e.quoi + ' — ' + e.detail));
await b.close();
