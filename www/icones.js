// --- LES ICÔNES PIXEL ---
//
// L'interface parlait en émojis : ❤️ ⚪ 🔱 🐚 🔒 ⚙️… Un émoji est dessiné par la police
// du SYSTÈME — il n'a pas le même aspect sous Windows, macOS ou Linux, et nulle part il
// n'a celui du jeu : un cœur en dégradé vectoriel à côté de sprites en pixels de 3,
// c'est deux jeux collés. Les icônes sont maintenant dessinées comme les sprites — une
// grille, une palette —, une seule fois, et servies aux deux mondes :
//   · au DOM, en règles CSS `.ico-<nom>` (une image data: par icône) : il suffit de
//     poser `<i class="ico ico-perle"></i>` ;
//   · à Phaser, en textures `ico_<nom>` agrandies ×3, la grille de tout le pixel art.
//
// Script classique, chargé dans la tête : la boutique et l'écran-titre, en DOM pur,
// ont leurs icônes avant même que le moteur ne démarre. Tout tient dans une IIFE —
// les scripts classiques partagent une seule portée globale.
(function () {
    // `_` : transparent ; un chiffre : une couleur de la palette de l'icône.
    const GRILLES = {
        coeur: [
            '_00___00_',
            '0110_0110',
            '011101110',
            '011111110',
            '_0111110_',
            '__01110__',
            '___010___',
            '____0____'],
        coeur_vide: [
            '_00___00_',
            '0__0_0__0',
            '0___0___0',
            '0_______0',
            '_0_____0_',
            '__0___0__',
            '___0_0___',
            '____0____'],
        perle: [
            '__000__',
            '_02110_',
            '0211110',
            '0111110',
            '0111130',
            '_01130_',
            '__000__'],
        onde: [
            '___22222___',
            '__22___22__',
            '_2__111__2_',
            '22_1___1_22',
            '2_1__1__1_2',
            '2_1_111_1_2',
            '2_1__1__1_2',
            '22_1___1_22',
            '_2__111__2_',
            '__22___22__',
            '___22222___'],
        bouclier: [
            '____000____',
            '__0011100__',
            '_011212110_',
            '_012121210_',
            '01212121210',
            '01212121210',
            '_012121210_',
            '__0121210__',
            '___01110___',
            '____000____'],
        rayon: [
            '1___1___1',
            '1___1___1',
            '1___1___1',
            '11__1__11',
            '_1111111_',
            '____1____',
            '____1____',
            '____1____',
            '____1____',
            '____1____',
            '____1____'],
        cadenas: [
            '__00000__',
            '_0_____0_',
            '_0_____0_',
            '000000000',
            '011111110',
            '011121110',
            '011121110',
            '011111110',
            '011111110',
            '000000000'],
        reglages: [
            '_____1_____',
            '__1__1__1__',
            '_11_111_11_',
            '___11111___',
            '__11___11__',
            '1111___1111',
            '__11___11__',
            '___11111___',
            '_11_111_11_',
            '__1__1__1__',
            '_____1_____'],
        balise: [
            '____0____',
            '___010___',
            '__01210__',
            '_0122210_',
            '012232210',
            '_0122210_',
            '__01210__',
            '___010___',
            '____0____']
    };
    // La balise allumée est la même forme, dans l'or des balises (LUEUR.balise).
    GRILLES.balise_allumee = GRILLES.balise;

    const PALETTES = {
        coeur: { 0: '#4a0a1e', 1: '#ff5e7e' },
        coeur_vide: { 0: '#7a4a5a' },
        perle: { 0: '#6a6050', 1: '#fff0c0', 2: '#ffffff', 3: '#d8c8a0' },
        onde: { 1: '#9ff5dc', 2: '#4fcfae' },
        bouclier: { 0: '#2a3a5a', 1: '#d6f2ff', 2: '#8fc8ef' },
        rayon: { 1: '#ffd36b' },
        cadenas: { 0: '#3a3a4a', 1: '#9aa0b0', 2: '#3a3a4a' },
        reglages: { 1: '#c8d0dc' },
        balise: { 0: '#1a2a3a', 1: '#3a5068', 2: '#4a6480', 3: '#5a7898' },
        balise_allumee: { 0: '#5a3a10', 1: '#c8902a', 2: '#ffd08a', 3: '#fff4d8' }
    };

    // Remplie pixel par pixel : aucun anticrénelage, jamais.
    function dessiner(nom, echelle) {
        const g = GRILLES[nom], pal = PALETTES[nom];
        const c = document.createElement('canvas');
        c.width = g[0].length * echelle; c.height = g.length * echelle;
        const ctx = c.getContext('2d');
        g.forEach((ligne, y) => [...ligne].forEach((ch, x) => {
            if (ch === '_' || !pal[ch]) return;
            ctx.fillStyle = pal[ch];
            ctx.fillRect(x * echelle, y * echelle, echelle, echelle);
        }));
        return c;
    }

    window.ICONES = Object.keys(GRILLES);

    // Le HTML d'une icône, pour les chaînes de l'interface.
    window.icone = (nom, classe) =>
        `<i class="ico ico-${nom}${classe ? ' ' + classe : ''}" aria-hidden="true"></i>`;

    // Les textures Phaser `ico_<nom>`, à la grille ×3 du pixel art.
    window.texturesIcones = function (scene) {
        for (const nom of window.ICONES) {
            const cle = 'ico_' + nom;
            if (!scene.textures.exists(cle)) scene.textures.addCanvas(cle, dessiner(nom, 3));
        }
    };

    // Une règle CSS par icône. L'image est à l'échelle 1 et agrandie par le navigateur
    // au plus proche voisin (`image-rendering: pixelated`) : nette à toute taille.
    const regles = window.ICONES.map(nom => {
        const g = GRILLES[nom];
        return `.ico-${nom}{background-image:url(${dessiner(nom, 1).toDataURL()});` +
               `aspect-ratio:${g[0].length}/${g.length}}`;
    });
    const style = document.createElement('style');
    style.id = 'icones-pixel';
    style.textContent = regles.join('\n');
    document.head.appendChild(style);
})();
