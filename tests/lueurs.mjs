// CONTRÔLE DU LANGAGE DES LUEURS — une couleur par catégorie, et une seule.
//
// Toute lueur posée au-dessus du voile doit prendre sa couleur dans LUEUR (Veil.js). Ce
// contrôle échoue si une lueur porte une couleur hors de la table, si le plancton
// reprend l'or ou le rose, ou si une lueur utilise encore une texture colorée — sur
// `bloomGlow` (cyan), une teinte rouge tournait au mauve et l'or au vert.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';

const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };

for (const [niveau, trident] of [[2, false], [5, false], [7, true], [10, true]]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('oceanBloomTrident', 'true'); }, trident);
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(600);
  await boot(p);
  const r = await p.evaluate(async () => {
    const { LUEUR } = await import('./src/managers/Veil.js');
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    const permises = new Set(Object.values(LUEUR).flat());
    const dessus = sc.children.list.filter(o => o.texture && o.depth === 29 && o.active);
    const lueurs = dessus.filter(o => o.texture.key === 'glintGlow');
    const horsTable = [...new Set(lueurs.filter(o => !permises.has(o.tintTopLeft))
      .map(o => '0x' + o.tintTopLeft.toString(16)))];
    // Au repos — aucune balise allumée — aucune lueur colorée ne doit traîner au-dessus.
    const colorees = dessus.filter(o => o.texture.key === 'bloomGlow').length;
    const plancton = [].concat(sc.veilMotes.tint.propertyValue);
    const planctonHors = plancton.filter(t => !LUEUR.plancton.includes(t)).map(t => '0x' + t.toString(16));
    const appels = sc.beacons.map(bal => bal.hint.tintTopLeft === LUEUR.balise);
    return { lueurs: lueurs.length, horsTable, colorees, planctonHors, appelsOr: appels.every(Boolean) };
  });
  noter(`niveau ${niveau} : toutes les lueurs dans la table (${r.lueurs})`, r.horsTable.length === 0,
    r.horsTable.length ? 'hors table : ' + r.horsTable.join(', ') : '');
  noter(`niveau ${niveau} : aucune lueur sur texture colorée`, r.colorees === 0, `${r.colorees} sur bloomGlow`);
  noter(`niveau ${niveau} : plancton froid seulement`, r.planctonHors.length === 0, r.planctonHors.join(', '));
  noter(`niveau ${niveau} : l'appel des balises est or`, r.appelsOr);
  if (errs.length) noter(`niveau ${niveau} sans erreur`, false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== LUEURS : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
