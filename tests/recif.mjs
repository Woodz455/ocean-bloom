// CONTRÔLE DU RÉCIF QUI REPREND SES COULEURS — par l'effet.
//
// Le décor naît éteint (copie décolorée), et une balise qui fleurit rend ses couleurs à
// ce qui l'entoure — et seulement à cela. On attend le résultat (la texture a changé),
// jamais une durée : la vague est cadencée par l'horloge de la scène.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';

const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };
const quand = async (p, fn, arg, plafond = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < plafond) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
};

for (const niveau of [2, 7]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(600);
  await boot(p);

  const depart = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const d = sc.decorRecif || [];
    return { n: d.length, eteints: d.filter(x => x.texture.key.endsWith('_gris')).length };
  });
  noter(`niveau ${niveau} : le décor naît éteint`, depart.n > 20 && depart.eteints === depart.n,
    `${depart.eteints}/${depart.n} éteints`);

  // Allumer une balise OUVERTE, par le chemin du joueur.
  const balise = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    sc.player.invincibleJusqua = sc.time.now + 600000;
    const bal = sc.beacons.find(x => !x.isLit && (!x.garde || x.garde.ouverte));
    sc.player.body.reset(bal.beaconX, bal.beaconY);
    return { x: bal.beaconX, y: bal.beaconY, r: sc.beaconRadius };
  });
  const proches = await quand(p, bal => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const autour = sc.decorRecif.filter(x => x.active && Math.hypot(x.x - bal.x, x.y - bal.y) < bal.r - 10);
    return autour.length > 0 && autour.every(x => !x.texture.key.endsWith('_gris'));
  }, balise);
  const bilan = await p.evaluate(bal => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const allumees = sc.beacons.filter(x => x.isLit);
    const loinDeTout = sc.decorRecif.filter(x => x.active
      && allumees.every(l => Math.hypot(x.x - l.beaconX, x.y - l.beaconY) > sc.beaconRadius + 50));
    const autour = sc.decorRecif.filter(x => x.active && Math.hypot(x.x - bal.x, x.y - bal.y) < bal.r - 10);
    return { autour: autour.length, rallumes: autour.filter(x => !x.texture.key.endsWith('_gris')).length,
             loin: loinDeTout.length, loinEteints: loinDeTout.filter(x => x.texture.key.endsWith('_gris')).length };
  }, balise);
  noter(`niveau ${niveau} : la floraison rallume le récif autour`, proches,
    `${bilan.rallumes}/${bilan.autour} coraux rallumés dans le rayon`);
  noter(`niveau ${niveau} : le reste reste éteint`, bilan.loin > 0 && bilan.loinEteints === bilan.loin,
    `${bilan.loinEteints}/${bilan.loin} encore éteints au loin`);
  if (errs.length) noter(`niveau ${niveau} sans erreur`, false, errs[0]);
  await ctx.close();
}

// Le prologue : son récif de la floraison naît éteint lui aussi.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.waitForTimeout(4200);
  await p.click('#startup-screen', { force: true }).catch(() => {});
  const vu = await quand(p, () => {
    const sc = window.gameInstance && window.gameInstance.scene.getScene('IntroScene');
    return !!(sc && sc.recif && sc.recif.length);
  }, null, 30000);
  const r = await p.evaluate(() => {
    const sc = window.gameInstance.scene.getScene('IntroScene');
    return sc && sc.recif ? { n: sc.recif.length, eteints: sc.recif.filter(x => x.texture.key.endsWith('_gris')).length } : null;
  });
  noter('prologue : le récif de la floraison naît éteint', vu && r && r.eteints === r.n, JSON.stringify(r));
  if (errs.length) noter('prologue sans erreur', false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== RÉCIF : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
