// CONTRÔLE DES NEUF PALIERS — et du correctif du Bouclier qui les précède.
//
// Chaque palier promet une FORME : on vérifie la forme, pas seulement que rien ne plante.
// Les paliers sont posés directement dans GameState (même instance de module que le jeu),
// et toutes les attentes liées à une durée sont mesurées en TEMPS DE SCÈNE : en headless
// l'horloge Phaser avance ~4x moins vite qu'une montre.
import { chromium } from 'playwright';
import { SP, attach, boot } from './lib.mjs';

const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };

async function partie(niveau = 2) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(600);
  await boot(p);
  // Fonctions d'appoint disponibles dans la page.
  await p.evaluate(async () => {
    window.__gs = (await import('./src/managers/GameState.js')).GameState;
    window.__pl = await import('./src/entities/Player.js');
    window.__sc = () => window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  });
  return { ctx, p, errs };
}
// Attend `ms` de temps de SCÈNE.
const attendreScene = (p, ms) => p.evaluate(ms => new Promise(r => {
  const sc = window.__sc(), t0 = sc.time.now;
  const tic = () => (sc.time.now - t0 >= ms ? r() : setTimeout(tic, 30)); tic();
}), ms);
// Attend qu'une condition devienne vraie DANS LA PAGE, plafond en temps réel.
//
// Les attentes en temps de scène ne suffisent pas pour les tweens : sous charge, en
// headless, l'horloge de scène et celle des tweens divergent fortement. Mesuré : 4,2 s
// de scène après une Onde, son éclair était encore à 600 px, rayon PLEIN. On attend
// donc le résultat lui-même (perle ramassée, éclair retiré), jamais une durée supposée.
const quand = async (p, fn, arg, plafond = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < plafond) {
    if (await p.evaluate(fn, arg)) return true;
    await p.waitForTimeout(150);
  }
  return false;
};
// Pose Mimi sur un ennemi et laisse le moteur physique constater le contact.
const surUnEnnemi = async p => {
  const info = await p.evaluate(() => {
    const sc = window.__sc(), e = sc.enemies.find(x => x.active);
    if (!e) return null;
    sc.player.body.reset(e.x, e.y);
    return { ex: e.x, ey: e.y, id: sc.enemies.indexOf(e) };
  });
  await attendreScene(p, 120);
  return info;
};

// --- LE CORRECTIF : le Bouclier arrête un ENNEMI, pas seulement un tir de boss ---
console.log('\n--- Bouclier ---');
for (const palier of [1, 2, 3]) {
  const { ctx, p, errs } = await partie();
  await p.evaluate(n => { window.__gs.shieldLevel = n; window.__gs.light = 100; window.__pl.castPearlShield(window.__sc()); }, palier);
  const avant = await p.evaluate(() => ({ hp: window.playerHp, charges: window.__sc().player.boucliers }));

  // Premier contact. Au palier II, on colle un SECOND ennemi au premier : le cas du banc,
  // qui n'arrivait qu'une fois sur cinq au hasard du niveau, devient systématique.
  const e1 = await p.evaluate(banc => {
    const sc = window.__sc(), e = sc.enemies.find(x => x.active);
    if (banc) {
      const autre = sc.enemies.find(x => x.active && x !== e);
      sc.tweens.killTweensOf(autre); sc.tweens.killTweensOf(e);
      autre.setPosition(e.x + 30, e.y);
    }
    sc.player.body.reset(e.x, e.y);
    return { e: sc.enemies.indexOf(e), x: e.x, y: e.y };
  }, palier === 2);
  await attendreScene(p, 150);
  const apres1 = await p.evaluate(i => {
    const sc = window.__sc(), e = sc.enemies[i];
    return { hp: window.playerHp, charges: sc.player.boucliers,
             dist: e ? Math.round(Math.hypot(e.x - sc.player.x, e.y - sc.player.y)) : null };
  }, e1.e);

  if (palier === 1) {
    noter('palier I : un contact d\'ENNEMI est absorbé', apres1.hp === avant.hp && avant.charges === 1 && apres1.charges === 0,
      `cœurs ${avant.hp}→${apres1.hp}, charges ${avant.charges}→${apres1.charges}`);
  }
  if (palier === 2) {
    // La bulle doit dégager TOUT ce qui touchait Mimi, pas seulement l'agresseur : un
    // premier contrôle sur le seul ennemi ciblé passait 4 fois sur 5 et masquait le cas
    // du banc. On compte donc ce qui reste à portée une fois les renvois terminés.
    await quand(p, () => { const sc = window.__sc();
      return !sc.enemies.some(e => e.active && Math.hypot(e.x - sc.player.x, e.y - sc.player.y) < 100); }, null, 15000);
    const reste = await p.evaluate(() => { const sc = window.__sc();
      return sc.enemies.filter(e => e.active).map(e => Math.round(Math.hypot(e.x - sc.player.x, e.y - sc.player.y)))
        .sort((a, c) => a - c).slice(0, 2); });
    noter('palier II : la bulle dégage tout ce qui la touche', apres1.hp === avant.hp && reste[0] >= 100,
      `deux ennemis les plus proches après la parade : ${reste.join(', ')} px`);
  }
  if (palier === 3) {
    // Deuxième contact, après la courte grâce de 700 ms qui suit une parade.
    await attendreScene(p, 800);
    await surUnEnnemi(p);
    const apres2 = await p.evaluate(() => ({ hp: window.playerHp, charges: window.__sc().player.boucliers }));
    noter('palier III : deux coups encaissés', avant.charges === 2 && apres2.hp === avant.hp && apres2.charges === 0,
      `charges ${avant.charges}→${apres1.charges}→${apres2.charges}, cœurs ${avant.hp}→${apres2.hp}`);
  }
  if (errs.length) noter(`bouclier palier ${palier} sans erreur`, false, errs[0]);
  await ctx.close();
}

// Le déchet gêne sans blesser : il ne doit pas consommer de charge.
{
  const { ctx, p, errs } = await partie();
  const r = await p.evaluate(async () => {
    const sc = window.__sc(); window.__gs.light = 100;
    // Premier essai : déchet à 129 px d'un ennemi ; le recul du déchet a projeté Mimi
    // dessus, et c'est L'ENNEMI qui a consommé la charge. On isole donc le déchet.
    sc.enemies.forEach(e => e.destroy()); sc.enemies.length = 0;
    sc.hazards.getChildren().slice().forEach(h => h.destroy());
    window.__pl.castPearlShield(sc);
    const t = sc.trashes.getChildren().find(x => x.active);
    if (!t) return null;
    sc.player.body.reset(t.x, t.y);
    return true;
  });
  await attendreScene(p, 150);
  const c = await p.evaluate(() => window.__sc().player.boucliers);
  noter('un déchet ne consomme pas de charge', r === null || c === 1, r === null ? 'aucun déchet dans ce niveau' : `charges restantes : ${c}`);
  await ctx.close();
}

// --- L'ONDE ---
console.log('\n--- Onde ---');
for (const palier of [1, 2, 3]) {
  const { ctx, p, errs } = await partie();
  await p.evaluate(n => {
    const sc = window.__sc(), avant = new Set(sc.litZones);
    window.__gs.waveLevel = n; window.__gs.light = 100;
    window.__pl.castMagicShockwave(sc);
    // Les zones créées PAR CE LANCER, dans l'ordre : l'éclair d'abord, la zone durable ensuite.
    window.__zones = sc.litZones.filter(z => !avant.has(z));
  }, palier);
  const finie = await quand(p, () => !window.__sc().litZones.includes(window.__zones[0]), null, 60000);
  const r = await p.evaluate(() => {
    const sc = window.__sc();
    const ancres = sc.children.list.filter(o => o.texture && o.texture.key === 'glintGlow' && o.tintTopLeft === 0x7cffd6).length;
    const restantes = window.__zones.filter(z => sc.litZones.includes(z));
    return { creees: window.__zones.length, restantes: restantes.length,
             rayon: restantes.map(z => Math.round(z.radius)), ancres };
  });
  r.eclairTermine = finie;
  if (palier === 1) noter('palier I : rien ne persiste après l\'éclair', finie && r.restantes === 0 && r.ancres === 0, JSON.stringify(r));
  if (palier === 2) noter('palier II : la zone reste éclairée', finie && r.restantes === 1 && r.ancres === 0, JSON.stringify(r));
  if (palier === 3) noter('palier III : zone + ancre visible', finie && r.restantes === 1 && r.ancres === 1, JSON.stringify(r));
  if (errs.length) noter(`onde palier ${palier} sans erreur`, false, errs[0]);
  await ctx.close();
}

// --- LE RAYON ---
console.log('\n--- Rayon ---');
for (const palier of [1, 2, 3]) {
  const { ctx, p, errs } = await partie();
  // Mise en scène contrôlée : un ennemi DEVANT Mimi, un DERRIÈRE, une perle devant.
  const r0 = await p.evaluate(n => {
    const sc = window.__sc(), pl = sc.player;
    window.__gs.rayLevel = n; window.__gs.light = 100;
    pl.setFlipX(true);                                  // regarde à droite
    const actifs = sc.enemies.filter(e => e.active);
    const devant = actifs[0], derriere = actifs[1];
    [devant, derriere].forEach(e => sc.tweens.killTweensOf(e));
    devant.setPosition(pl.x + 300, pl.y);
    derriere.setPosition(pl.x - 300, pl.y);
    const perle = sc.pearls.getChildren().find(x => x.active);
    perle.setPosition(pl.x + 450, pl.y + 10);
    window.__cibles = { devant, derriere, perle };
    return { perles: window.sessionPearls };
  }, palier);
  await p.evaluate(() => window.__pl.firePurifyingRay(window.__sc(), window.__sc().time.now));
  // La purification est immédiate ; la perle, elle, glisse par un tween jusqu'à Mimi.
  if (palier === 2) await quand(p, n => window.sessionPearls > n, r0.perles, 30000);
  else await attendreScene(p, 300);
  const r = await p.evaluate(() => {
    const { devant, derriere } = window.__cibles;
    return { devant: !devant.active, derriere: !derriere.active, perles: window.sessionPearls };
  });
  if (palier === 1) noter('palier I : le Rayon TOUCHE enfin (ennemi devant purifié)', r.devant && !r.derriere,
    `devant purifié : ${r.devant}, derrière purifié : ${r.derriere}`);
  if (palier === 2) noter('palier II : la perle du tracé est ramassée', r.perles > r0.perles,
    `perles ${r0.perles}→${r.perles}`);
  if (palier === 3) noter('palier III : tire des deux côtés', r.devant && r.derriere,
    `devant : ${r.devant}, derrière : ${r.derriere}`);
  if (errs.length) noter(`rayon palier ${palier} sans erreur`, false, errs[0]);
  await ctx.close();
}

// --- LA BOUTIQUE ---
console.log('\n--- Boutique ---');
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('oceanBloomPearls', '100'); localStorage.setItem('oceanBloomPrologue', 'true'); });
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.waitForTimeout(4200);
  await p.click('#startup-screen', { force: true }).catch(() => {});
  await p.waitForSelector('#t-btnStart', { state: 'visible', timeout: 25000 });

  const verrou = await p.evaluate(() => ({
    btn: document.getElementById('btn-upg-ray').innerText, desactive: document.getElementById('btn-upg-ray').disabled,
    note: document.getElementById('next-ray').innerText, suite: document.getElementById('next-wave').innerText
  }));
  noter('Rayon verrouillé sans le Trident', verrou.desactive && verrou.btn.includes('🔒'), JSON.stringify(verrou));
  noter('le palier suivant est décrit', verrou.suite.length > 5, `« ${verrou.suite} »`);

  await p.click('#btn-upg-wave');
  const apres = await p.evaluate(() => ({ niveau: window.waveLevel, perles: window.totalPearls,
    lvl: document.getElementById('lvl-wave').innerText }));
  await p.reload();
  await p.waitForTimeout(1500);
  const recharge = await p.evaluate(() => ({ niveau: parseInt(localStorage.getItem('oceanBloomWave')), perles: localStorage.getItem('oceanBloomPearls') }));
  noter('achat d\'un palier : 20 perles, et il survit au rechargement',
    apres.niveau === 2 && apres.perles === 80 && recharge.niveau === 2,
    `${apres.lvl}, perles 100→${apres.perles}, après rechargement : palier ${recharge.niveau}`);
  await p.screenshot({ path: `${SP}/boutique.png` });
  if (errs.length) noter('boutique sans erreur', false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== PALIERS : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + ' — ' + r.d));
await b.close();
