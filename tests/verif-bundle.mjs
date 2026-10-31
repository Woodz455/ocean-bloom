// La page groupée doit se comporter EXACTEMENT comme le jeu servi depuis www/.
// On refait donc, sur elle seule, le chemin d'un joueur : écran de titre, plongée,
// clavier, un pouvoir lancé, et une balise allumée.
import { chromium } from 'playwright';
import { SP } from './lib.mjs';

const URL = 'http://127.0.0.1:8097/ocean-bloom.html';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
// Rien ne doit sortir vers l'extérieur : la page est censée être autonome.
const externe = [];
p.on('request', r => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) externe.push(r.url()); });

await p.goto(URL);
await p.evaluate(() => localStorage.setItem('oceanBloomPrologue', 'true'));
await p.goto(URL);
await p.waitForTimeout(4200);
await p.click('#startup-screen', { force: true }).catch(() => { });
await p.waitForSelector('#t-btnStart', { state: 'visible', timeout: 25000 });

// La boutique de la page groupée : cinq achats, les paliers décrits, le Rayon verrouillé.
const boutique = await p.evaluate(() => ({
  achats: document.querySelectorAll('[id^="btn-upg-"]').length,
  palierOnde: (document.getElementById('lvl-wave') || {}).innerText,
  suiteOnde: (document.getElementById('next-wave') || {}).innerText,
  rayonVerrouille: !!(document.getElementById('btn-upg-ray') || {}).disabled
}));
const titre = await p.evaluate(() => ({
  phaser: typeof Phaser !== 'undefined' ? Phaser.VERSION : null,
  titre: document.getElementById('t-title').innerText.replace(/\n/g, ' '),
  studio: !!document.querySelector('.landing-studio')
}));
await p.screenshot({ path: `${SP}/bundle-titre.png` });

await p.evaluate(() => window.startGameFlow());
await p.waitForTimeout(2500);
for (let i = 0; i < 26; i++) {
  const v = await p.evaluate(() => getComputedStyle(document.getElementById('ui-layer')).opacity);
  if (v === '1') break;
  await p.mouse.click(187, 300);
  await p.waitForTimeout(420);
}
await p.waitForTimeout(2000);

// Le clavier bouge Mimi.
const avant = await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  return sc ? { x: sc.player.x, textures: sc.textures.list ? Object.keys(sc.textures.list).length : 0 } : null;
});
await p.keyboard.down('KeyD');
await p.waitForTimeout(1500);
await p.keyboard.up('KeyD');
await p.waitForTimeout(400);

// Un pouvoir part et coûte de la lumière.
const pouvoir = await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  const l0 = window.playerLight;
  window.triggerMagicShockwave();
  return { avant: l0, apres: window.playerLight, boutons: ['magic-action-btn', 'shield-action-btn'].map(id => document.getElementById(id).style.display) };
});

// Une balise s'allume par le chemin du joueur.
await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  const b = sc.beacons.filter(x => !x.isLit && (!x.garde || x.garde.ouverte))[0];
  if (b) { sc.player.x = b.beaconX; sc.player.y = b.beaconY; }
});
await p.waitForTimeout(1200);
const apres = await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  return { x: sc.player.x, allumees: sc.beaconsLit, voile: !!sc.veil, balises: sc.beacons.length,
           // Le décor d'ansimuz, embarqué en data: : le chargeur de Phaser les refusait et
           // la page restait bloquée au chargement. Il doit être là, en trois couches.
           decor: sc.fondDecor ? sc.fondDecor.length : 0 };
});
await p.screenshot({ path: `${SP}/bundle-jeu.png` });

console.log(JSON.stringify({
  ...titre,
  boutique,
  textures: avant.textures,
  bouge: Math.round(apres.x - avant.x) !== 0,
  pouvoir_coute: +(pouvoir.avant - pouvoir.apres).toFixed(1),
  boutons: pouvoir.boutons,
  balises: apres.balises, allumees: apres.allumees, voile: apres.voile, decor_ansimuz: apres.decor,
  requetes_externes: externe.length ? externe : 'aucune',
  erreurs: errs.length ? errs.slice(0, 4) : 0
}, null, 1));
await nav.close();
