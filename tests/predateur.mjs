// CONTRÔLE DE LA BAUDROIE — chaque comportement vérifié par son EFFET.
//
// Elle doit voir ce qui brille et ignorer ce qui ne brille pas, être attirée par les
// éclairs, mordre, et céder à chaque pouvoir de la façon promise. Les attentes portent sur
// un résultat (un état atteint, un cœur perdu), jamais sur une durée — voir README.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';

const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };

async function partie(niveau) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(600);
  await boot(p);
  await p.evaluate(async () => {
    window.__gs = (await import('./src/managers/GameState.js')).GameState;
    window.__pl = await import('./src/entities/Player.js');
    window.__veil = await import('./src/managers/Veil.js');
    window.__sc = () => window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    // Place la baudroie à `d` px de Mimi, dans l'axe horizontal, et la remet en errance.
    window.__placer = (d, etat = 'errance') => {
      const sc = window.__sc(), bd = sc.baudroie, pl = sc.player;
      bd.body.reset(pl.x + d, pl.y);
      bd.etat = etat; bd.cible = null; bd.horsPorteeDepuis = 0;
    };
  });
  return { ctx, p, errs };
}
const quand = async (p, fn, arg, plafond = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < plafond) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(120); }
  return false;
};
const attendreScene = (p, ms) => p.evaluate(ms => new Promise(r => {
  const sc = window.__sc(), t0 = sc.time.now;
  const tic = () => (sc.time.now - t0 >= ms ? r() : setTimeout(tic, 30)); tic();
}), ms);
const etat = () => window.__sc().baudroie && window.__sc().baudroie.etat;

// --- Où elle apparaît ---
console.log('\n--- Apparition ---');
for (const n of [1, 2]) {
  const { ctx, p } = await partie(n);
  noter(`niveau ${n} : pas de baudroie`, !(await p.evaluate(() => !!window.__sc().baudroie)));
  await ctx.close();
}
{
  const { ctx, p, errs } = await partie(3);
  const r = await p.evaluate(() => { const sc = window.__sc(), bd = sc.baudroie;
    return bd && { loin: Math.round(Math.hypot(bd.foyer.x - sc.player.x, bd.foyer.y - sc.player.y)),
      lanterne: bd.lanterne.depth, pv: bd.pv }; });
  noter('niveau 3 : une baudroie, née à plus de 900 px de Mimi', !!r && r.loin > 900, JSON.stringify(r));
  noter('sa lanterne se voit dans le noir (au-dessus du voile)', !!r && r.lanterne === 29);

  // --- Ce qu'elle voit ---
  console.log('\n--- Détection ---');
  await p.evaluate(() => { window.__gs.light = 100; window.__placer(500); });
  noter('à 500 px, réserve pleine : elle traque', await quand(p, () => window.__sc().baudroie.etat === 'traque', null, 8000));
  const rouge = await p.evaluate(async () => (await import('./src/managers/Veil.js')).LUEUR.danger === window.__sc().baudroie.lanterne.tintTopLeft);
  noter('en chasse, la lanterne vire au rouge', rouge);

  await p.evaluate(() => { window.__gs.light = 10; window.__placer(500); });
  await attendreScene(p, 1500);
  noter('à 500 px, réserve à 10 : elle ne voit rien', (await p.evaluate(etat)) !== 'traque',
    `état : ${await p.evaluate(etat)}`);

  // --- Ce qui l'attire ---
  console.log('\n--- Éclairs ---');
  const cible = await p.evaluate(() => {
    const sc = window.__sc(), pl = sc.player;
    window.__gs.light = 0;                      // Mimi invisible : seul l'éclair compte
    window.__placer(1500);
    const bd = sc.baudroie, x = bd.x - 700, y = bd.y;
    window.__veil.flareLight(sc, x, y, 300, 3000);
    return { x: Math.round(x), y: Math.round(y) };
  });
  const attiree = await quand(p, () => window.__sc().baudroie.etat === 'attiree', null, 8000);
  const vers = await p.evaluate(() => window.__sc().baudroie.cible);
  noter('un éclair à 700 px l\'attire vers lui', attiree && vers && Math.abs(vers.x - cible.x) < 5,
    `état ${await p.evaluate(etat)}, cible ${JSON.stringify(vers)}`);
  if (errs.length) noter('apparition et détection sans erreur', false, errs[0]);
  await ctx.close();
}

// --- La morsure, et le Bouclier ---
console.log('\n--- Morsure ---');
for (const bouclier of [false, true]) {
  const { ctx, p, errs } = await partie(3);
  const hp0 = await p.evaluate(b => {
    if (b) { window.__gs.light = 100; window.__pl.castPearlShield(window.__sc()); }
    window.__placer(0, 'traque');
    return window.playerHp;
  }, bouclier);
  await quand(p, () => window.__sc().baudroie.etat === 'recul', null, 8000);
  const r = await p.evaluate(() => ({ hp: window.playerHp, etat: window.__sc().baudroie.etat, charges: window.__sc().player.boucliers }));
  if (bouclier) noter('avec le Bouclier : morsure encaissée, elle recule', r.hp === hp0 && r.charges === 0 && r.etat === 'recul',
    `cœurs ${hp0}→${r.hp}, charges ${r.charges}, état ${r.etat}`);
  else noter('morsure : un cœur, puis elle recule', r.hp === hp0 - 1 && r.etat === 'recul', `cœurs ${hp0}→${r.hp}, état ${r.etat}`);
  if (errs.length) noter(`morsure (bouclier=${bouclier}) sans erreur`, false, errs[0]);
  await ctx.close();
}

// --- Les pouvoirs ---
console.log('\n--- Pouvoirs ---');
{
  const { ctx, p, errs } = await partie(3);
  // Onde : un coup, et elle recule.
  await p.evaluate(() => { window.__gs.light = 100; window.__placer(300, 'traque'); window.__pl.castMagicShockwave(window.__sc()); });
  const onde = await p.evaluate(() => ({ pv: window.__sc().baudroie.pv, etat: window.__sc().baudroie.etat }));
  noter('Onde : un coup, et elle recule', onde.pv === 2 && onde.etat === 'recul', JSON.stringify(onde));

  // Rayon : un coup, et elle est aveuglée.
  await p.evaluate(() => {
    const sc = window.__sc(); window.__gs.light = 100; sc.player.setFlipX(true);
    window.__placer(300, 'traque');
    window.__pl.firePurifyingRay(sc, sc.time.now);
  });
  const rayon = await p.evaluate(() => ({ pv: window.__sc().baudroie.pv, etat: window.__sc().baudroie.etat }));
  noter('Rayon : un coup, et elle est aveuglée', rayon.pv === 1 && rayon.etat === 'aveuglee', JSON.stringify(rayon));

  // Aveuglée, elle ne voit pas Mimi même tout près, réserve pleine.
  await p.evaluate(() => { window.__gs.light = 100; window.__placer(250, 'aveuglee'); window.__sc().baudroie.jusqua = window.__sc().time.now + 4000; });
  await attendreScene(p, 800);
  noter('aveuglée, elle ne voit pas Mimi', (await p.evaluate(etat)) === 'aveuglee');

  // Troisième coup : dissipée, +8 perles, +25 de lumière.
  const avant = await p.evaluate(() => { window.__gs.light = 50; window.__placer(300, 'traque');
    return { perles: window.__gs.pearls }; });
  await p.evaluate(() => { window.__gs.light = 62; window.__pl.castMagicShockwave(window.__sc()); });   // 62 − 12 = 50
  const apres = await p.evaluate(() => ({ active: !!(window.__sc().baudroie && window.__sc().baudroie.active),
    perles: window.__gs.pearls, lumiere: Math.round(window.__gs.light) }));
  noter('trois coups : dissipée, +8 perles, +25 de lumière',
    !apres.active && apres.perles === avant.perles + 8 && apres.lumiere >= 74 && apres.lumiere <= 75,
    `perles ${avant.perles}→${apres.perles}, lumière 50→${apres.lumiere}`);
  if (errs.length) noter('pouvoirs sans erreur', false, errs[0]);
  await ctx.close();
}

// --- Le boss ---
console.log('\n--- Boss ---');
{
  const { ctx, p, errs } = await partie(3);
  await p.evaluate(async () => { (await import('./src/entities/Enemies.js')).spawnBoss(window.__sc()); });
  const partie_ = await quand(p, () => !window.__sc().baudroie.active, null, 40000);
  noter('à l\'arrivée du boss, elle se retire', partie_);
  if (errs.length) noter('boss sans erreur', false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== BAUDROIE : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
