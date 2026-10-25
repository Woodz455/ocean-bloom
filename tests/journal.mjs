// CONTRÔLE DU JOURNAL D'ESSAI.
//
// Le journal doit dire, après une vraie partie, ce que le joueur a fait : coups et leur
// cause, parades, pouvoirs, balises, lumière au plus bas, issue du niveau — et marquer
// un niveau quitté en route comme abandonné. Il doit survivre à « Réinitialiser », et
// se lire et se copier depuis les réglages.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';

const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };
const journal = p => p.evaluate(() => JSON.parse(localStorage.getItem('oceanBloomJournal') || 'null'));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const p = await ctx.newPage(); const errs = []; attach(p, errs);
p.on('dialog', d => d.accept());

await p.goto('http://127.0.0.1:8099/index.html');
await p.evaluate(() => localStorage.clear());
await p.waitForTimeout(600);
await p.evaluate(() => window.testLevel(2));
await p.waitForTimeout(600);
await boot(p);

let j = await journal(p);
const n0 = j && j.niveaux[j.niveaux.length - 1];
noter('le niveau commence au journal', n0 && n0.niveau === 2 && !n0.issue && n0.totalBalises > 0, JSON.stringify(n0));

// Un coup d'ennemi, une parade, un pouvoir, une balise : par les vrais chemins du jeu.
await p.evaluate(async () => {
  const P = await import('./src/entities/Player.js');
  const sc = window.gameInstance.scene.getScene('MainScene');
  sc.player.invincibleJusqua = 0;
  P.subirDegats(sc, { source: { x: sc.player.x + 30, y: sc.player.y }, degats: 1, cause: 'ennemi' });
  window.triggerMagicShockwave();
  sc.player.boucliers = 1;
  P.subirDegats(sc, { source: { x: sc.player.x + 30, y: sc.player.y }, degats: 1, cause: 'mine' });
  const bal = sc.beacons.find(x => !x.isLit && (!x.garde || x.garde.ouverte));
  sc.player.invincibleJusqua = sc.time.now + 600000;
  sc.player.body.reset(bal.beaconX, bal.beaconY);
});
for (let i = 0; i < 60; i++) {
  j = await journal(p);
  if (j.niveaux[j.niveaux.length - 1].balises >= 1) break;
  await p.waitForTimeout(250);
}
const n1 = j.niveaux[j.niveaux.length - 1];
noter('un coup est noté avec sa cause', n1.coups.ennemi === 1 && !n1.coups.mine, JSON.stringify(n1.coups));
noter('la parade du bouclier est notée', n1.parades === 1, String(n1.parades));
noter("l'Onde est notée", n1.pouvoirs.onde === 1, JSON.stringify(n1.pouvoirs));
noter('la balise allumée est notée', n1.balises === 1, `${n1.balises}/${n1.totalBalises}`);
noter('la lumière au plus bas est notée', n1.lumiereMin < 100, n1.lumiereMin + ' %');

// La défaite clôt le niveau, avec la cause du dernier coup.
await p.evaluate(async () => {
  const P = await import('./src/entities/Player.js');
  P.defeatPlayer(window.gameInstance.scene.getScene('MainScene'));
});
j = await journal(p);
const n2 = j.niveaux[j.niveaux.length - 1];
noter('la défaite est notée, avec sa cause', n2.issue === 'perdu' && n2.cause === 'ennemi' && n2.duree >= 0, JSON.stringify({ issue: n2.issue, cause: n2.cause, duree: n2.duree }));

// Replonger, puis quitter en pleine partie : le niveau est abandonné.
await p.evaluate(() => location.reload());
await p.waitForTimeout(800);
await boot(p);
await p.goto('about:blank');
await p.goto('http://127.0.0.1:8099/index.html');
await p.waitForTimeout(800);
j = await journal(p);
const issues = j.niveaux.map(n => n.issue);
noter('quitter en route : niveau abandonné', issues.length >= 2 && issues[issues.length - 1] === 'abandonné', JSON.stringify(issues));

// Réinitialiser efface la progression, pas le journal.
const avant = j.niveaux.length;
await p.evaluate(() => window.resetProgress());
await p.waitForTimeout(1500);
j = await journal(p);
noter('le journal survit à « Réinitialiser »', j && j.niveaux.length === avant
  && await p.evaluate(() => localStorage.getItem('oceanBloomLevel') === null), `${j && j.niveaux.length}/${avant}`);

// Les réglages : le texte se lit et se copie.
await p.waitForTimeout(3500);
await p.click('#startup-screen', { force: true }).catch(() => {});
await p.waitForTimeout(1500);
await p.evaluate(() => window.openSettings());
await p.click('#btn-journal');
const texte = await p.inputValue('#journal-texte');
noter('le journal se lit dans les réglages', /Niveau 2 — perdu/.test(texte) && /tuée par : ennemi/.test(texte)
  && /abandonné/.test(texte) && /onde ×1/.test(texte), texte.split('\n').slice(0, 3).join(' / '));
await p.click('#btn-copier-journal');
await p.waitForTimeout(400);
const etiquette = await p.textContent('#btn-copier-journal');
noter('le bouton Copier répond', /COPIÉ|CTRL\+C/.test(etiquette), etiquette);

if (errs.length) noter('sans erreur', false, errs[0]);
await ctx.close();
const ko = res.filter(r => !r.ok);
console.log(`\n=== JOURNAL : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
