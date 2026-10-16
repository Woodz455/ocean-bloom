// Captures et pages groupées vont dans tests/sortie/ (ignoré par git).
import { mkdirSync } from 'node:fs';
export const SP = new URL('./sortie', import.meta.url).pathname;
mkdirSync(SP, { recursive: true });

export function attach(p, errs) {
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_CONNECTION')) errs.push('CONSOLE: ' + m.text()); });
}

// `boot` amène le jeu jusqu'à MainScene en passant par l'écran de titre.
//
// Depuis l'ouverture jouable, un joueur au niveau 1 qui n'a jamais vu le prologue est
// envoyé DIRECTEMENT dedans : l'écran de titre n'apparaît qu'après la première
// floraison, donc `#t-btnStart` n'existe jamais et l'attente expirait. On marque donc
// le prologue comme déjà vu — c'est l'état d'un joueur qui revient, et c'est ce que
// veulent tous les scripts qui testent le JEU. Passer `prologue: true` pour le jouer.
export async function boot(p, { fresh = false, prologue = false } = {}) {
  await p.goto('http://127.0.0.1:8099/index.html');
  if (fresh) { await p.evaluate(() => localStorage.clear()); await p.goto('http://127.0.0.1:8099/index.html'); }
  if (!prologue) {
    await p.evaluate(() => localStorage.setItem('oceanBloomPrologue', 'true'));
    await p.goto('http://127.0.0.1:8099/index.html');
  }
  await p.waitForTimeout(4200);
  await p.click('#startup-screen', { force: true }).catch(()=>{});
  await p.waitForSelector('#t-btnStart', { state: 'visible', timeout: 25000 });
  await p.evaluate(() => window.startGameFlow());
  await p.waitForTimeout(2200);
  for (let i = 0; i < 26; i++) {
    const vis = await p.evaluate(() => getComputedStyle(document.getElementById('ui-layer')).opacity);
    if (vis === '1') break;
    await p.mouse.click(187, 300);
    await p.waitForTimeout(420);
  }
  await p.waitForTimeout(2000);
}

export const drive = (p, x, y) => p.evaluate(([x, y]) => {
  window.joystickData.active = true; window.joystickData.x = x; window.joystickData.y = y;
}, [x, y]);

export const stop = p => p.evaluate(() => {
  window.joystickData.active = false; window.joystickData.x = 0; window.joystickData.y = 0;
});

export const snap = p => p.evaluate(() => {
  const g = window.gameInstance;
  const sc = g.scene.scenes.find(s => s.scene.isActive() && s.scene.key !== 'IntroScene');
  if (!sc) return { scene: null };
  const out = { scene: sc.scene.key, niveau: window.currentLevel, perles: window.sessionPearls, magie: window.magicCharges };
  if (sc.player) { out.x = Math.round(sc.player.x); out.y = Math.round(sc.player.y); }
  if (sc.pollutionSpots) {
    out.total = sc.pollutionSpots.length; out.nettoye = sc.cleanedPollution;
    out.pct = Math.round(100 * sc.cleanedPollution / sc.pollutionSpots.length);
  }
  if (sc.boss) { out.boss = sc.boss.texture.key; out.bossHp = Math.round(sc.boss.hp); }
  out.hp = window.playerHp;
  out.fini = !!sc.isGameFinished;
  let horsGrille = 0, animes = 0;
  sc.children.list.forEach(o => {
    if (o.anims && o.anims.isPlaying) { animes++;
      if (Math.abs(o.scaleX - 1) > 0.001 || Math.abs(o.scaleY - 1) > 0.001) horsGrille++; }
  });
  out.animes = animes; out.horsGrille = horsGrille;
  return out;
});
