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
    return { tex: sc.fond.texture.key, type: sc.fond.type, loin: !!sc.fondLoin, proche: !!sc.fondProche,
             teinte: sc.fond.tintTopLeft };
  });
  noter(`niveau ${niveau} : le dégradé est celui du biome ${biome}`,
    etat.tex === 'fond_degrade_' + biome && etat.type === 'Image', `${etat.type} ${etat.tex}`);
  noter(`niveau ${niveau} : deux couches de colonnes`, etat.loin && etat.proche);
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

    // Les colonnes défilent moins vite que le décor : parallaxe.
    const para = await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      const c = sc.cameras.main;
      return { sx: c.scrollX, loin: sc.fondLoin.tilePositionX, proche: sc.fondProche.tilePositionX };
    });
    noter('les colonnes sont en parallaxe', para.sx > 50
      && Math.abs(para.loin - para.sx * 0.25) < 2 && Math.abs(para.proche - para.sx * 0.5) < 2,
      `scroll ${Math.round(para.sx)} → loin ${Math.round(para.loin)}, proche ${Math.round(para.proche)}`);

    // Froid au départ ; une balise allumée le réchauffe.
    noter('le fond naît froid', etat.teinte === 0x7a88a0, '0x' + etat.teinte.toString(16));
    await p.evaluate(() => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      sc.player.invincibleJusqua = sc.time.now + 600000;
      const bal = sc.beacons.find(x => !x.isLit && (!x.garde || x.garde.ouverte));
      sc.player.body.reset(bal.beaconX, bal.beaconY);
    });
    const chaud = await quand(p, () => {
      const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
      return ((sc.fond.tintTopLeft >> 16) & 0xff) > 0x7a + 8;
    });
    const t = await p.evaluate(() => window.gameInstance.scene.getScene('MainScene').fond.tintTopLeft);
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
    return { w: sc.scale.width, h: sc.scale.height, fw: sc.fond.displayWidth, fh: sc.fond.displayHeight,
             lw: sc.fondLoin.width, lh: sc.fondLoin.height };
  });
  noter('redimensionné, le fond suit l\'écran', r.fw === r.w && r.fh === r.h && r.lw === r.w && r.lh === r.h,
    JSON.stringify(r));
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
  const tex = vu ? await p.evaluate(() => window.gameInstance.scene.getScene('IntroScene').fond.texture.key) : null;
  noter('prologue : le fond du lagon', tex === 'fond_degrade_lagoon', tex);
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
