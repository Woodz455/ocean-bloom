// CONTRÔLE DES BALISES GARDÉES — chaque gardien vérifié par son EFFET.
//
// Un gardien doit fermer, et s'ouvrir par SON pouvoir et pas par un autre. On le vérifie
// comme un joueur le vivrait : Mimi nage vers la balise et n'y arrive pas ; elle lance
// le bon pouvoir ; elle y arrive. Les attentes portent sur un RÉSULTAT (balise allumée,
// cœur perdu, perle apparue), jamais sur une durée — voir tests/README.md.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';

const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };

async function partie(niveau, { trident = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = []; attach(p, errs);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(t => { localStorage.clear(); if (t) localStorage.setItem('oceanBloomTrident', 'true'); }, trident);
  await p.waitForTimeout(800);
  await p.evaluate(n => window.testLevel(n), niveau);
  await p.waitForTimeout(600);
  await boot(p);
  await p.evaluate(async () => {
    window.__gs = (await import('./src/managers/GameState.js')).GameState;
    window.__pl = await import('./src/entities/Player.js');
    window.__sc = () => window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    window.__garde = type => window.__sc().gardiens.find(g => g.type === type);
  });
  return { ctx, p, errs };
}
const quand = async (p, fn, arg, plafond = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < plafond) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
};
// Pose Mimi à `d` px de la balise gardée, du côté `angle`, regard tourné vers elle.
const devant = (p, type, d, angle = Math.PI) => p.evaluate(([type, d, angle]) => {
  const sc = window.__sc(), g = window.__garde(type), bal = g.balise;
  sc.player.body.reset(bal.beaconX + Math.cos(angle) * d, bal.beaconY + Math.sin(angle) * d);
  sc.player.setFlipX(Math.cos(angle) < 0);   // flipX = regarde à droite
}, [type, d, angle]);
// Nage vers la balise gardée par le même canal que le clavier.
const nager = (p, type) => p.evaluate(type => {
  const sc = window.__sc(), bal = window.__garde(type).balise;
  const a = Math.atan2(bal.beaconY - sc.player.y, bal.beaconX - sc.player.x);
  window.joystickData.active = true; window.joystickData.x = Math.cos(a); window.joystickData.y = Math.sin(a);
}, type);
const arreter = p => p.evaluate(() => { window.joystickData.active = false; window.joystickData.x = 0; window.joystickData.y = 0; });
const allumee = type => window.__garde(type).balise.isLit;

// --- NIVEAU 1 : aucun gardien ---
console.log('\n--- Niveau 1 ---');
{
  const { ctx, p, errs } = await partie(1);
  const n = await p.evaluate(() => window.__sc().gardiens.length);
  noter('niveau 1 : aucun gardien', n === 0 && errs.length === 0, `gardiens : ${n}`);
  await ctx.close();
}

// --- OURSINS : l'anneau ferme, l'Onde l'ouvre ---
console.log('\n--- Oursins ---');
{
  const { ctx, p, errs } = await partie(2);
  const g = await p.evaluate(() => { const g = window.__garde('oursins');
    return g && { pieces: g.pieces.length, ouverte: g.ouverte }; });
  noter('niveau 2 : un anneau d\'oursins, fermé', !!g && g.pieces >= 10 && !g.ouverte, JSON.stringify(g));

  // Lueurs au-dessus du voile, sur l'anneau lui-même.
  const lueurs = await p.evaluate(() => {
    const sc = window.__sc(), g = window.__garde('oursins'), bal = g.balise;
    return sc.children.list.filter(o => o.texture && o.texture.key === 'glintGlow' && o.depth === 29
      && Math.abs(Math.hypot(o.x - bal.beaconX, o.y - bal.beaconY) - g.rayon) < 15).length;
  });
  noter('l\'anneau se voit dans le noir (lueurs au-dessus du voile)', lueurs >= 5, `${lueurs} lueurs sur l'anneau`);

  // Première rencontre : l'indice de touche.
  await devant(p, 'oursins', 230);
  const indice = await quand(p, () => window.__sc().children.list.some(o => o.type === 'Text'
    && /oursins|urchins/i.test(o.text)), null, 15000);
  noter('première rencontre : la touche du pouvoir s\'affiche', indice);

  // Mimi nage droit dessus : l'anneau tient.
  await devant(p, 'oursins', 200);
  await nager(p, 'oursins');
  await p.waitForTimeout(2500);
  await arreter(p);
  const bloquee = await p.evaluate(() => { const sc = window.__sc(), bal = window.__garde('oursins').balise;
    return { allumee: bal.isLit, distance: Math.round(Math.hypot(sc.player.x - bal.beaconX, sc.player.y - bal.beaconY)) }; });
  noter('l\'anneau arrête Mimi', !bloquee.allumee && bloquee.distance > 90, `distance à la balise : ${bloquee.distance} px`);

  // Filet de sécurité : posée DANS l'anneau, la balise reste fermée.
  await p.evaluate(() => { const sc = window.__sc(), bal = window.__garde('oursins').balise;
    sc.player.body.reset(bal.beaconX, bal.beaconY); });
  await p.waitForTimeout(800);
  noter('même posée dedans, la balise fermée ne s\'allume pas', !(await p.evaluate(allumee, 'oursins')));

  // Le Bouclier et le Rayon n'y font rien.
  await devant(p, 'oursins', 200);
  await p.evaluate(() => { window.__gs.light = 100; window.__gs.rayLevel = 3;
    window.__pl.castPearlShield(window.__sc()); window.__pl.firePurifyingRay(window.__sc(), window.__sc().time.now); });
  await p.waitForTimeout(600);
  const intacte = await p.evaluate(() => !window.__garde('oursins').ouverte);
  noter('ni le Bouclier ni le Rayon ne l\'ouvrent', intacte);

  // L'Onde, oui.
  await p.evaluate(() => { window.__gs.light = 100; window.__pl.castMagicShockwave(window.__sc()); });
  const ouvert = await p.evaluate(() => { const g = window.__garde('oursins');
    return { ouverte: g.ouverte, restantes: g.pieces.filter(x => x.active).length,
             memorise: JSON.parse(localStorage.getItem('oceanBloomGardes') || '[]') }; });
  noter('l\'Onde brise l\'anneau', ouvert.ouverte && ouvert.restantes === 0 && ouvert.memorise.includes('oursins'),
    JSON.stringify(ouvert));
  await nager(p, 'oursins');
  const ok = await quand(p, allumee, 'oursins', 20000);
  await arreter(p);
  noter('…et Mimi allume la balise', ok);
  if (errs.length) noter('oursins sans erreur', false, errs[0]);
  await ctx.close();
}

// --- PERLE-FONTAINE : jamais de blocage ---
console.log('\n--- Perle-fontaine ---');
{
  const { ctx, p, errs } = await partie(2);
  await p.evaluate(() => {
    const sc = window.__sc();
    sc.pearls.getChildren().slice().forEach(x => x.destroy());   // plus une seule perle
    window.__gs.light = 0;
    window.__garde('oursins').prochaineFontaine = 0;
  });
  const vue = await quand(p, () => {
    const sc = window.__sc(), g = window.__garde('oursins'), bal = g.balise;
    return sc.pearls.getChildren().some(x => x.active && x.fontaine
      && Math.hypot(x.x - bal.beaconX, x.y - bal.beaconY) > g.rayon + 20);
  }, null, 20000);
  noter('à sec, une perle renaît HORS de l\'anneau', vue);
  if (errs.length) noter('fontaine sans erreur', false, errs[0]);
  await ctx.close();
}

// --- MÉDUSES : elles piquent, le Bouclier encaisse ---
console.log('\n--- Méduses ---');
for (const bouclier of [false, true]) {
  const { ctx, p, errs } = await partie(5);
  const g = await p.evaluate(() => { const g = window.__garde('meduses');
    return g && { n: g.pieces.length, ouverte: g.ouverte }; });
  if (!bouclier) noter('niveau 5 : un essaim de méduses, qui ne ferme pas la balise', !!g && g.n === 6 && g.ouverte, JSON.stringify(g));

  const hp0 = await p.evaluate(b => {
    const sc = window.__sc();
    if (b) { window.__gs.light = 100; window.__pl.castPearlShield(sc); }
    const j = window.__garde('meduses').pieces.find(x => x.active);
    sc.player.body.reset(j.x, j.y);
    return window.playerHp;
  }, bouclier);
  // Avec le Bouclier : on attend la charge consommée ; sans : le cœur perdu.
  if (bouclier) {
    // La charge doit être CONSOMMÉE : sans ce contrôle, une piqûre qui n'a jamais eu lieu
    // donnerait aussi « 5→5 », et le test passerait sans rien prouver.
    const parade = await quand(p, () => window.__sc().player.boucliers === 0, null, 10000);
    const hp1 = await p.evaluate(() => window.playerHp);
    noter('avec le Bouclier, la piqûre est encaissée', parade && hp1 === hp0,
      `charge consommée : ${parade}, cœurs ${hp0}→${hp1}`);
  } else {
    const pique = await quand(p, h => window.playerHp < h, hp0, 10000);
    const hp1 = await p.evaluate(() => window.playerHp);
    noter('sans Bouclier, une piqûre coûte un cœur', pique && hp1 === hp0 - 1, `cœurs ${hp0}→${hp1}`);

    // Allumer la balise disperse l'essaim.
    await p.evaluate(() => { const sc = window.__sc(), bal = window.__garde('meduses').balise;
      sc.player.invincibleJusqua = sc.time.now + 60000;   // on teste la dispersion, pas les piqûres
      sc.player.body.reset(bal.beaconX, bal.beaconY); });
    const disperse = await quand(p, () => { const g = window.__garde('meduses');
      return g.balise.isLit && g.pieces.every(x => !x.active); }, null, 40000);
    const etatEssaim = await p.evaluate(() => { const g = window.__garde('meduses'), sc = window.__sc();
      return { allumee: g.balise.isLit, dispersee: !!g.dispersee, restantes: g.pieces.filter(x => x.active).length,
               distance: Math.round(Math.hypot(sc.player.x - g.balise.beaconX, sc.player.y - g.balise.beaconY)) }; });
    noter('balise allumée : l\'essaim se disperse', disperse, JSON.stringify(etatEssaim));
  }
  if (errs.length) noter(`méduses (bouclier=${bouclier}) sans erreur`, false, errs[0]);
  await ctx.close();
}

// --- SCEAU DE CORAIL : seul le Rayon y fait une brèche ---
console.log('\n--- Sceau de corail ---');
{
  const sans = await partie(7, { trident: false });
  const types = await sans.p.evaluate(() => window.__sc().gardiens.map(g => g.type));
  noter('sans Trident, aucun sceau', !types.includes('sceau'), JSON.stringify(types));
  await sans.ctx.close();

  const { ctx, p, errs } = await partie(7, { trident: true });
  const g = await p.evaluate(() => { const g = window.__garde('sceau');
    return g && { pieces: g.pieces.length, ouverte: g.ouverte }; });
  noter('avec le Trident, un sceau fermé au niveau 7', !!g && g.pieces >= 8 && !g.ouverte, JSON.stringify(g));

  await devant(p, 'sceau', 200);       // à gauche de la balise, tournée vers elle
  await p.evaluate(() => { window.__gs.light = 100; window.__pl.castMagicShockwave(window.__sc()); });
  await p.waitForTimeout(500);
  noter('l\'Onde n\'ouvre pas le sceau', await p.evaluate(() => !window.__garde('sceau').ouverte));

  await nager(p, 'sceau');
  await p.waitForTimeout(2500);
  await arreter(p);
  noter('le sceau arrête Mimi', !(await p.evaluate(allumee, 'sceau')));

  await devant(p, 'sceau', 200);
  await p.evaluate(() => { window.__gs.light = 100; window.__pl.firePurifyingRay(window.__sc(), window.__sc().time.now); });
  const breche = await p.evaluate(() => { const g = window.__garde('sceau');
    return { ouverte: g.ouverte, brulees: g.pieces.filter(x => !x.active).length, total: g.pieces.length }; });
  noter('le Rayon y brûle une brèche', breche.ouverte && breche.brulees >= 1 && breche.brulees < breche.total,
    `${breche.brulees}/${breche.total} pièces brûlées`);
  await nager(p, 'sceau');
  const ok = await quand(p, allumee, 'sceau', 20000);
  await arreter(p);
  noter('…et Mimi passe par la brèche jusqu\'à la balise', ok);
  if (errs.length) noter('sceau sans erreur', false, errs[0]);
  await ctx.close();
}

const ko = res.filter(r => !r.ok);
console.log(`\n=== GARDIENS : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
