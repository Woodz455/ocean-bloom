// COMPOSE LES BANDES DE DÉCOR des cavernes, du volcan et des ruines, à partir des
// packs gratuits d'ansimuz (CC0, OpenGameArt). Le jeu attend, par biome, quelques
// bandes horizontales qui se RACCORDENT à l'horizontale, fond marin en bas (Fond.js).
//
//   node tests/composer-decors.mjs <dossier « Super Grotto Escape Files »> \
//        <dossier « Sideview Fantasy Patreon Collection »>
//
// Écrit www/assets/{caves,volcanic,ruins}/*.png. Les archives d'origine :
//   https://opengameart.org/content/warped-super-grotto-escape-pack
//   https://opengameart.org/content/sideview-fantasy-patreon-collection
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [grotte, collection] = process.argv.slice(2);
if (!grotte || !collection) { console.error('usage : composer-decors.mjs <grotte> <collection>'); process.exit(1); }
const WWW = new URL('../www/assets/', import.meta.url).pathname;
const png = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');

const G = join(grotte, 'Layers');
const L = join(collection, 'Environments/lava-background/PNG');
const S = join(collection, 'Environments/ships-graveyard/PNG');

const b = await chromium.launch();
const p = await b.newPage();

// Compose une bande dans la page : `pieces` = [{ src, x, y, repeter }]. `repeter` pave
// la pièce à l'horizontale sur toute la largeur — d'où des largeurs de bande choisies
// multiples de chaque tuile, sans quoi le raccord se verrait.
const composer = (largeur, hauteur, pieces) => p.evaluate(async ({ largeur, hauteur, pieces }) => {
  const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (const pc of pieces) {
    const img = new Image(); img.src = pc.src; await img.decode();
    if (pc.repeter) for (let x = 0; x < largeur; x += img.width) g.drawImage(img, x, pc.y);
    else g.drawImage(img, pc.x, pc.y);
  }
  return c.toDataURL('image/png');
}, { largeur, hauteur, pieces });

// Retrouve la position d'une pièce dans la maquette de l'auteur, au pixel près : on
// replace les épaves exactement où il les avait posées.
const trouver = (maquette, piece) => p.evaluate(async ({ maquette, piece }) => {
  const lire = async src => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
  };
  const M = await lire(maquette), P = await lire(piece);
  const opaques = [];
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.d[(y * P.w + x) * 4 + 3] > 200) opaques.push([x, y]);
  for (let oy = 0; oy <= M.h - P.h; oy++) for (let ox = 0; ox <= M.w - P.w; ox++) {
    let ok = true;
    for (const [x, y] of opaques) {
      const i = ((oy + y) * M.w + ox + x) * 4, j = (y * P.w + x) * 4;
      if (M.d[i] !== P.d[j] || M.d[i + 1] !== P.d[j + 1] || M.d[i + 2] !== P.d[j + 2]) { ok = false; break; }
    }
    if (ok) return [ox, oy];
  }
  return null;
}, { maquette, piece });

const ecrire = (dossier, nom, dataUrl) => {
  mkdirSync(join(WWW, dossier), { recursive: true });
  writeFileSync(join(WWW, dossier, nom), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('écrit', join(dossier, nom));
};

// --- CAVERNES : Super Grotto Escape, trois couches telles quelles. ---
mkdirSync(join(WWW, 'caves'), { recursive: true });
for (const [src, nom] of [['back.png', 'loin.png'], ['far.png', 'milieu.png'], ['middle.png', 'proche.png']]) {
  writeFileSync(join(WWW, 'caves', nom), readFileSync(join(G, src)), { flag: 'w' });
  console.log('copié', 'caves/' + nom);
}

// --- VOLCAN : le fond de lave ; le pilier seul en couche du milieu (à la place qu'il
// occupe dans l'aperçu de l'auteur) ; la coulée de lave pavée en couche proche. ---
mkdirSync(join(WWW, 'volcanic'), { recursive: true });
writeFileSync(join(WWW, 'volcanic', 'loin.png'), readFileSync(join(L, 'background.png')));
console.log('copié volcanic/loin.png');
const pilier = await trouver(png(join(L, 'lava-background-preview.png')), png(join(L, 'middle-rocks.png')));
ecrire('volcanic', 'milieu.png', await composer(432, 240, [{ src: png(join(L, 'middle-rocks.png')), x: pilier ? pilier[0] : 118, y: pilier ? pilier[1] : 0 }]));
ecrire('volcanic', 'proche.png', await composer(432, 240, [{ src: png(join(L, 'lava-tile.png')), repeter: true, y: 240 - 60 }]));

// --- RUINES : le cimetière de navires, livré en pièces. Largeur 576 = 18 × 32 (sable
// lointain) = 9 × 64 (sable du milieu) = 4 × 144 (sable proche) : chaque pavage tombe
// juste. Une épave par couche et par bande, à la position de la maquette. ---
mkdirSync(join(WWW, 'ruins'), { recursive: true });
const M = n => png(join(S, 'mockup', n)), C = n => png(join(S, 'layers', n));
const posLoin = await trouver(M('back.png'), C('boat-far.png'));
const posMilieu = await trouver(M('middle.png'), C('boat-middle.png'));
const posProche = await trouver(M('front.png'), C('boat-front.png'));
console.log('épaves trouvées :', posLoin, posMilieu, posProche);
// L'eau : la maquette de fond de l'auteur (rayons compris), pavée deux fois.
ecrire('ruins', 'eau.png', await composer(576, 256, [{ src: M('background.png'), repeter: true, y: 0 }]));
ecrire('ruins', 'loin.png', await composer(576, 256, [{ src: C('back-sand.png'), repeter: true, y: 256 - 112 },
  ...(posLoin ? [{ src: C('boat-far.png'), x: posLoin[0], y: posLoin[1] }] : [])]));
ecrire('ruins', 'milieu.png', await composer(576, 256, [{ src: C('middle-sand.png'), repeter: true, y: 256 - 112 },
  ...(posMilieu ? [{ src: C('boat-middle.png'), x: posMilieu[0] + 288, y: posMilieu[1] }] : [])]));
ecrire('ruins', 'proche.png', await composer(576, 256, [{ src: C('front.png'), repeter: true, y: 256 - 80 },
  ...(posProche ? [{ src: C('boat-front.png'), x: posProche[0], y: posProche[1] }] : [])]));

await b.close();
