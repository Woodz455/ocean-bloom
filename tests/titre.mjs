// CONTRÔLE DE L'ÉCRAN-TITRE VIVANT.
//
// Le moteur tourne derrière le titre et la boutique : la scène d'ambiance est active,
// on la voit à travers l'accueil, une balise y fleurit d'elle-même — et « Plonger »
// la remplace par le jeu sans rien laisser tourner derrière.
import { chromium } from 'playwright';
import { attach } from './lib.mjs';

const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };
const quand = async (p, fn, arg, plafond = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < plafond) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(200); }
  return false;
};

const b = await chromium.launch();
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('oceanBloomPrologue', 'true'); localStorage.setItem('oceanBloomLevel', '3'); });
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.waitForTimeout(4200);
  await p.click('#startup-screen', { force: true }).catch(() => {});
  await p.waitForSelector('#t-btnStart', { state: 'visible', timeout: 25000 });

  const active = await quand(p, () => {
    const g = window.gameInstance;
    return !!(g && g.scene.isActive('TitreScene'));
  });
  noter(`${w} : la scène d'ambiance tourne derrière le titre`, active);

  // L'accueil laisse voir la scène : son fond n'est plus un aplat opaque.
  const fond = await p.evaluate(() => getComputedStyle(document.getElementById('landing-page')).backgroundImage);
  noter(`${w} : l'accueil est transparent au centre`, /rgba\([^)]*,\s*0?\.\d+\)/.test(fond) && !/rgb\(0, 30, 54\)/.test(fond),
    fond.slice(0, 80));

  // Sans GPU, le navigateur de test tourne à quelques images par seconde et la physique
  // avance d'autant moins : Mimi mettrait des minutes à rejoindre la balise. On la pose
  // donc à 120 px ; c'est le pilote de la scène qui fait la fin du trajet et la floraison.
  await p.evaluate(() => {
    const sc = window.gameInstance.scene.getScene('TitreScene');
    const b = sc.balises[0];
    sc.player.body.reset(b.beaconX - 120, b.beaconY);
  });
  const fleurie = await quand(p, () => {
    const sc = window.gameInstance.scene.getScene('TitreScene');
    return !!(sc && sc.balises && sc.balises.some(x => x.isLit));
  }, null, 40000);
  let couleur = 0;
  if (fleurie) {
    await quand(p, () => window.gameInstance.scene.getScene('TitreScene').decorRecif
      .some(d => d.active && !d.texture.key.endsWith('_gris')), null, 20000);
    couleur = await p.evaluate(() => window.gameInstance.scene.getScene('TitreScene').decorRecif
      .filter(d => d.active && !d.texture.key.endsWith('_gris')).length);
  }
  noter(`${w} : une balise fleurit d'elle-même et rallume le récif`, fleurie && couleur > 0, `${couleur} coraux rallumés`);

  if (w === 1280) await p.screenshot({ path: new URL('./sortie/titre.png', import.meta.url).pathname });

  await p.evaluate(() => window.startGameFlow());
  const jeu = await quand(p, () => {
    const g = window.gameInstance;
    return g.scene.isActive('MainScene') && !g.scene.isActive('TitreScene');
  });
  noter(`${w} : « Plonger » remplace l'ambiance par le jeu`, jeu);
  if (errs.length) noter(`${w} sans erreur`, false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== TITRE : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
