import { chromium } from 'playwright';
import { attach, boot } from './lib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const p = await ctx.newPage(); const errs=[]; attach(p, errs);
await boot(p, { fresh: true });
const r = await p.evaluate(() => {
  const t = window.gameInstance.textures.list;
  const cles = Object.keys(t).filter(k => k !== '__DEFAULT' && k !== '__MISSING' && k !== '__WHITE');
  const attendus = ['mermaid1','mermaid2','mermaid3','mermaid4','nana','malik','anais','boss_vase','boss_plastique',
    'boss_petrole','coral_red','coral_red_c','crystal_blue','sunken_pillar','weed_green','weed_purple',
    'pearl','trash','enemy','mine','sparkle','bubble','lightMask','warmGlow','bloomGlow','glintGlow','caustics',
    'urchin','jelly','jelly2','sceau','baudroie','baudroie2',
    'coral_red_gris','weed_green_b_gris','crystal_blue_c_gris','sunken_pillar_gris'];
  const orphelins = ['intro_coral','intro_factory','intro_monsters','intro_mimi','eraserBrush','fishBrush',
    'malikBrush','hugeBrush','rayBrush','dolphin','electric_dolphin'];
  return {
    total: cles.length,
    manquants: attendus.filter(k => !cles.includes(k)),
    orphelinsRestants: orphelins.filter(k => cles.includes(k))
  };
});
console.log(JSON.stringify(r));
console.log('ERREURS', errs.length ? errs.slice(0,6) : 'aucune');
await b.close();
