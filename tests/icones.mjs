// CONTRÔLE DES ICÔNES — plus un seul émoji, et un HUD qui se lit sans chiffres.
//
// Un émoji est dessiné par la police du système : autre aspect sous Windows, et jamais
// celui du pixel art. Deux contrôles :
//   · dans les SOURCES (chaînes de l'interface, textes Phaser), hors commentaires ;
//   · à l'EXÉCUTION, dans le texte du DOM et dans chaque objet Text de Phaser.
// Puis le HUD : cœurs, perles, jauge segmentée sans pourcentage, balises en icônes,
// pouvoirs grisés (et non cachés) quand la réserve ne peut pas les payer.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import { attach, boot } from './lib.mjs';

const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{2726}\u{26AA}\u{FE0F}\u{200D}]/u;

// --- 1. LES SOURCES ---
const W = new URL('../www/', import.meta.url).pathname;
const fichiers = ['index.html', 'audio.js', 'assets.js', 'icones.js'];
const parcourir = d => readdirSync(W + d, { withFileTypes: true }).forEach(e =>
  e.isDirectory() ? parcourir(d + e.name + '/') : e.name.endsWith('.js') && fichiers.push(d + e.name));
parcourir('src/');
const trouves = [];
for (const f of fichiers) {
  readFileSync(W + f, 'utf8').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('<!--')) return;
    if (EMOJI.test(l)) trouves.push(`${f}:${i + 1} ${t.slice(0, 60)}`);
  });
}
noter('aucun émoji dans les sources', trouves.length === 0, trouves.slice(0, 4).join(' | '));

// --- 2. À L'EXÉCUTION ---
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const p = await ctx.newPage(); const errs = []; attach(p, errs);
await p.goto('http://127.0.0.1:8099/index.html');
await p.evaluate(() => localStorage.clear());
await p.waitForTimeout(800);
await p.evaluate(() => window.testLevel(2));
await p.waitForTimeout(600);

// La boutique, en DOM pur, a ses icônes avant le moteur.
await p.goto('http://127.0.0.1:8099/index.html');
await p.evaluate(() => localStorage.setItem('oceanBloomPrologue', 'true'));
await p.goto('http://127.0.0.1:8099/index.html');
await p.waitForTimeout(4200);
await p.click('#startup-screen', { force: true }).catch(() => {});
await p.waitForSelector('#t-btnStart', { state: 'visible', timeout: 25000 });
const boutique = await p.evaluate(() => ({
  perle: !!document.querySelector('#shop-pearls .ico-perle'),
  css: !!document.getElementById('icones-pixel'),
  taille: (() => { const i = document.querySelector('#shop-pearls .ico'); const r = i && i.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; })()
}));
noter('boutique : la perle est une icône pixel', boutique.perle && boutique.css && boutique.taille && boutique.taille[0] > 4,
  JSON.stringify(boutique));

await boot(p);

const hud = await p.evaluate(() => {
  const coeurs = document.querySelectorAll('#hp-hearts .ico-coeur').length;
  const vides = document.querySelectorAll('#hp-hearts .ico-coeur_vide').length;
  const balises = document.querySelectorAll('#balises-display .ico').length;
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  return { coeurs, vides, balises, total: sc.beacons.length, jauge: document.getElementById('progress-container').innerText,
           segments: document.querySelectorAll('#progress-container .segment').length };
});
noter('cœurs en icônes', hud.coeurs + hud.vides >= 3 && hud.coeurs >= 1, `${hud.coeurs} pleins, ${hud.vides} vides`);
noter('une icône par balise', hud.balises === hud.total && hud.total > 0, `${hud.balises}/${hud.total}`);
noter('jauge segmentée, sans chiffre', hud.segments >= 8 && !/\d/.test(hud.jauge), `${hud.segments} segments, texte « ${hud.jauge} »`);

// Une balise allumée : son icône passe à l'or.
await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  sc.player.invincibleJusqua = sc.time.now + 600000;
  const bal = sc.beacons.find(x => !x.isLit && (!x.garde || x.garde.ouverte));
  sc.player.body.reset(bal.beaconX, bal.beaconY);
});
let allumee = false;
for (let i = 0; i < 100 && !allumee; i++) {
  allumee = await p.evaluate(() => document.querySelectorAll('#balises-display .ico-balise_allumee').length === 1);
  if (!allumee) await p.waitForTimeout(200);
}
noter('balise allumée : son icône passe à l\'or', allumee);

// À sec : les pouvoirs restent visibles, grisés, et n'agissent pas.
const sec = await p.evaluate(async () => {
  const mod = await import('./src/managers/GameState.js');
  mod.GameState.light = 0; mod.GameState.notify();
  window.hasTrident = true; window.updateGameUI();
  return ['magic-action-btn', 'shield-action-btn', 'ray-action-btn'].map(id => {
    const el = document.getElementById(id);
    return { id, visible: el.style.display !== 'none', grise: el.classList.contains('grise'), icone: !!el.querySelector('.ico') };
  });
});
noter('à sec, les trois pouvoirs grisés', sec.every(s => s.visible && s.grise && s.icone), JSON.stringify(sec));

// Les textes Phaser : un coup fait un texte flottant « -1 » suivi d'un cœur.
await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  sc.damagePlayer(1);
});
await p.waitForTimeout(300);
const textes = await p.evaluate(() => {
  const out = [];
  for (const s of window.gameInstance.scene.scenes) {
    if (!s.sys.displayList) continue;
    const fouiller = l => l.forEach(o => { if (o.type === 'Text') out.push(o.text); if (o.list) fouiller(o.list); });
    fouiller(s.sys.displayList.list);
  }
  return out;
});
const domTexte = await p.evaluate(() => document.body.innerText);
const coeurFlottant = await p.evaluate(() => {
  const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
  return sc.children.list.some(o => o.type === 'Container' && o.list.some(e => e.texture && e.texture.key === 'ico_coeur'));
});
noter('un coup affiche « -1 » et un cœur pixel', coeurFlottant && textes.includes('-1'));
noter('aucun émoji affiché (DOM et Phaser)', ![...textes, domTexte].some(t => EMOJI.test(t)),
  [...textes, domTexte].filter(t => EMOJI.test(t)).map(t => t.slice(0, 40)).join(' | '));
if (errs.length) noter('sans erreur', false, errs[0]);
await ctx.close();

const ko = res.filter(r => !r.ok);
console.log(`\n=== ICÔNES : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
