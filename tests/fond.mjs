// CONTRÔLE DU FOND — dégradé par biome, colonnes en parallaxe, neige marine, chaleur.
//
// Et la leçon des 61 Mo : aucune TileSprite plus grande que l'écran, dans aucune scène
// (une TileSprite reçoit une texture à SES DIMENSIONS DÉCLARÉES). Le prologue et la
// course-poursuite en avaient chacun une à la taille de leur monde.
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
// Les TileSprites de la scène plus grandes que l'écran (marge d'un pixel d'arrondi).
const tropGrandes = (p, cle) => p.evaluate(cle => {
  const sc = window.gameInstance.scene.getScene(cle);
  const w = sc.scale.width, h = sc.scale.height;
  return sc.children.list.filter(o => o.type === 'TileSprite' && (o.width > w + 1 || o.height > h + 1))
    .map(o => `${o.texture.key} ${Math.round(o.width)}×${Math.round(o.height)}`);
}, cle);

const BIOMES = { 2: 'lagoon', 5: 'caves', 7: 'volcanic', 10: 'ruins' };

for (const [niveau, biome] of Object.entries(BIOMES)) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), Number(niveau));
  await p.waitForTimeout(600);
  await boot(p);

  const etat = await p.evaluate(() => {
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    return { tex: sc.fond.texture && sc.fond.texture.key, type: sc.fond.type, loin: !!sc.fondLoin, proche: !!sc.fondProche,
             teinte: sc.fondDecor ? sc.fondDecor[0].spr.tintTopLeft : sc.fond.tintTopLeft,
             decor: sc.fondDecor ? sc.fondDecor.map(c => [c.cle, c.spr.tileScaleX]) : null,
             avant: !!sc.fondAvant };
  });
  if (biome === 'lagoon') {
    // Le lagon a le décor d'ansimuz : trois couches, à la grille ×3 du jeu.
    noter(`niveau ${niveau} : le décor d'ansimuz, trois couches à la grille ×3`,
      etat.decor && etat.decor.length === 3 && etat.decor.every(([, k]) => k === 3), JSON.stringify(etat.decor));
    // Les algues sombres de premier plan doublaient le kelp du décor : retirées ici.
    noter(`niveau ${niveau} : pas d'algues de premier plan sur le décor`, !etat.avant);
  } else {
    noter(`niveau ${niveau} : le dégradé est celui du biome ${biome}`,
      etat.tex === 'fond_degrade_' + biome && etat.type === 'Image', `${etat.type} ${etat.tex}`);
    noter(`niveau ${niveau} : deux couches de colonnes`, etat.loin && etat.proche);
    noter(`niveau ${niveau} : le premier plan reste hors du lagon`, etat.avant);
  }
  const grandes = await tropGrandes(p, 'MainScene');
  noter(`niveau ${niveau} : aucune TileSprite plus grande que l'écran`, grandes.length === 0, grandes.join(', '));

  if (niveau === '2') {
    // La neige naît dans la vue de la caméra, en coordonnées du monde.
    const neige = await quand(p, () => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      return sc.fondNeige.getAliveParticleCount() > 10;
    });
    const dansLaVue = await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      const v = sc.cameras.main.worldView, parts = sc.fondNeige.alive;
      return parts.filter(q => q.x > v.x - 200 && q.x < v.right + 200 && q.y > v.y - 200 && q.y < v.bottom + 400).length / parts.length;
    });
    noter('la neige marine tombe', neige);
    noter('la neige naît autour de la vue', dansLaVue > 0.9, `${Math.round(dansLaVue * 100)} % dans la vue`);

    // Les couches du décor défilent moins vite que le jeu, la plus lointaine le moins :
    // parallaxe (le décalage est en pixels du décor, d'où la division par 3).
    const para = await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      const sx = sc.cameras.main.scrollX;
      return { sx, couches: sc.fondDecor.map(c => [c.parallaxe, c.spr.tilePositionX]) };
    });
    noter('les couches du décor sont en parallaxe', para.sx > 50
      && para.couches.every(([f, tp]) => Math.abs(tp - para.sx * f / 3) < 1)
      && para.couches[0][1] < para.couches[2][1],
      `scroll ${Math.round(para.sx)} → ` + para.couches.map(([f, tp]) => `${f}: ${tp.toFixed(1)}`).join(', '));

    // Froid au départ ; une balise allumée le réchauffe.
    noter('le fond naît froid', etat.teinte === 0x3cb48c, '0x' + etat.teinte.toString(16));
    await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      sc.player.invincibleJusqua = sc.time.now + 600000;
      const bal = sc.beacons.find(x => !x.isLit && (!x.garde || x.garde.ouverte));
      sc.player.body.reset(bal.beaconX, bal.beaconY);
    });
    const chaud = await quand(p, () => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      return ((sc.fondDecor[0].spr.tintTopLeft >> 16) & 0xff) > 0x3c + 8;
    });
    const t = await p.evaluate(() => window.gameInstance.scene.getScene('MainScene').fondDecor[0].spr.tintTopLeft);
    noter('une balise allumée réchauffe le fond', chaud, '0x' + t.toString(16));
  }
  if (errs.length) noter(`niveau ${niveau} sans erreur`, false, errs[0]);
  await ctx.close();
}

// À 1920×1080 aussi (zoom différent), et après un redimensionnement.
{
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await boot(p, { fresh: true });
  await p.setViewportSize({ width: 1600, height: 900 });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const sc = window.gameInstance.scene.getScene('MainScene');
    const z = sc.cameras.main.zoom, d = sc.fondDecor[0].spr;
    // Fixée à l'écran, la bande est quand même agrandie du zoom autour du centre : en
    // unités du jeu elle fait l'écran divisé par le zoom, et son bas tombe au bas de
    // l'écran.
    return { w: sc.scale.width, h: sc.scale.height, z, largeur: d.width, eau: Math.round(sc.fond.displayWidth),
             bas: Math.round(sc.scale.height / 2 + (d.y - sc.scale.height / 2) * z), pixel: d.tileScaleX * z };
  });
  noter('redimensionné, le décor suit l\'écran à pixels entiers',
    Math.abs(r.largeur - r.w / r.z) < 1 && Math.abs(r.eau - r.w / r.z) < 1 && Math.abs(r.bas - r.h) <= 1
    && Number.isInteger(r.pixel), JSON.stringify(r));
  if (errs.length) noter('1920 sans erreur', false, errs[0]);
  await ctx.close();
}

// Le prologue : même fond, écran-fixe.
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
    return !!(sc && sc.scene.isActive() && sc.fond);
  });
  const n = vu ? await p.evaluate(() => (window.gameInstance.scene.getScene('IntroScene').fondDecor || []).length) : 0;
  noter('prologue : le décor du lagon', n === 3, `${n} couches`);
  const grandes = vu ? await tropGrandes(p, 'IntroScene') : ['scène absente'];
  noter('prologue : aucune TileSprite plus grande que l\'écran', grandes.length === 0, grandes.join(', '));
  if (errs.length) noter('prologue sans erreur', false, errs[0]);
  await ctx.close();
}

// La course-poursuite (niveau 4) : son fond était large de 99 000 px.
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800);
  await p.evaluate(() => window.testLevel(4));
  await p.waitForTimeout(600);
  await boot(p).catch(() => {});
  const vu = await quand(p, () => {
    const sc = window.gameInstance && window.gameInstance.scene.getScene('ChaseScene');
    return !!(sc && sc.scene.isActive() && sc.fondCourse);
  });
  const grandes = vu ? await tropGrandes(p, 'ChaseScene') : ['scène absente'];
  noter('course : aucune TileSprite plus grande que l\'écran', vu && grandes.length === 0, grandes.join(', '));
  if (vu) {
    const suit = await quand(p, () => {
      const sc = window.gameInstance.scene.getScene('ChaseScene');
      return sc.cameras.main.scrollX > 100 && Math.abs(sc.fondCourse.tilePositionX - sc.cameras.main.scrollX) < 20;
    }, null, 15000);
    noter('course : le fond défile avec la caméra', suit);
  }
  if (errs.length) noter('course sans erreur', false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== FOND : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
