// CONTRÔLE DE LA LUMIÈRE — elle tombe où elle doit, à TOUS les zooms.
//
// Le voile est fixé à l'écran, mais la caméra l'agrandit quand même de son zoom autour du
// centre. Le code reportait EN PLUS le zoom dans les positions : à 1920×1080 (zoom 2),
// une lumière posée à +200 px du centre apparaissait à +748 au lieu de +400. Le défaut a
// vécu des semaines parce que tout se testait à 1280×720, où le zoom vaut 1. On mesure
// donc là où la lumière TOMBE à l'écran, aux deux résolutions.
import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';
const b = await chromium.launch();
const res = [];
const noter = (q, ok, d) => { res.push({ q, ok, d }); console.log((ok ? '  OK  ' : ' ÉCHEC') + ' | ' + q + (d ? ' — ' + d : '')); };
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); attach(p, []);
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.waitForTimeout(800); await p.evaluate(() => window.testLevel(2)); await p.waitForTimeout(600);
  await boot(p);
  const info = await p.evaluate(async () => {
    const gs = (await import('./src/managers/GameState.js')).GameState;
    const sc = window.gameInstance.scene.scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
    gs.light = 0;                                     // halo de Mimi au minimum
    sc.player.setVisible(false);
    sc.player.invincibleJusqua = sc.time.now + 600000;
    const cam = sc.cameras.main;
    sc.cameras.main.stopFollow();
    const cx = cam.midPoint.x, cy = cam.midPoint.y;
    sc.player.body.reset(cx, cy - 2000);              // Mimi hors champ : seule la zone éclaire
    sc.litZones.push({ x: cx + 200, y: cy, radius: 80 });
    // Rien d'autre que le voile : une lueur ou un poisson croisé sur la ligne
    // de mesure élargissait la zone détectée (982 px mesurés pour 840, une fois sur deux).
    // Le fond lui-même est caché : sombre exprès (Fond.js), il ne se distinguerait plus
    // du voile. Derrière le trou, on ne laisse que le blanc uni de la caméra.
    sc.children.list.forEach(o => { if (o !== sc.veil && o.setVisible) o.setVisible(false); });
    sc.cameras.main.setBackgroundColor(0xffffff);
    return { zoom: cam.zoom, voile: [sc.veil.width, sc.veil.height, sc.veil.scaleX] };
  });
  await p.waitForTimeout(1500);
  const png = await p.screenshot({ clip: { x: 0, y: Math.round(h / 2), width: w, height: 1 } });
  // Luminance le long de la ligne horizontale centrale.
  const lum = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = 1;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, 1).data, out = [];
    for (let x = 0; x < img.width; x++) out.push(d[x*4] + d[x*4+1] + d[x*4+2]);
    return out;
  }, png.toString('base64'));
  const fond = [...lum].sort((a, c) => a - c)[Math.floor(lum.length * 0.3)];
  const eclaires = lum.map((v, x) => v > fond + 60 ? x : -1).filter(x => x >= 0);
  const debut = Math.min(...eclaires), fin = Math.max(...eclaires);
  const attendu = w / 2 + 200 * info.zoom, mesure = Math.round((debut + fin) / 2);
  noter(`${w}×${h} (zoom ${info.zoom}) : la lumière tombe sous sa source`, Math.abs(mesure - attendu) <= 8,
    `centre attendu ${attendu} px, mesuré ${mesure} px`);
  noter(`${w}×${h} : voile au tiers de la résolution`,
    info.voile[0] === Math.ceil(w / 3) && info.voile[1] === Math.ceil(h / 3) && info.voile[2] === 3, JSON.stringify(info.voile));
  await ctx.close();
}
const ko = res.filter(r => !r.ok);
console.log(`\n=== LUMIÈRE : ${res.length - ko.length}/${res.length} ===`);
ko.forEach(r => console.log('  ÉCHEC : ' + r.q + (r.d ? ' — ' + r.d : '')));
await b.close();
