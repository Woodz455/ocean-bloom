# Regroupe le jeu — index.html, style.css, deux scripts classiques et onze modules ES —
# en UNE page autonome, publiable en Artifact.
#
# Contraintes de l'hôte : aucun fichier joint, aucun script externe hors CDN autorisé,
# aucune balise <html>/<head>/<body> propre. D'où trois substitutions :
#   · Phaser local        -> EMBARQUÉ TEL QUEL (1 Mo)
#   · les deux woff2      -> EMBARQUÉS en data: (28 Ko)
#   · le graphe de modules -> un seul <script type="module">, imports aplatis
#
# Phaser pouvait venir de cdnjs et les polices de Google Fonts, tous deux autorisés par
# l'hôte. Tout est embarqué quand même, parce que le proxy de l'environnement de
# développement refuse ces deux domaines : la version publiée n'aurait alors pas été
# celle que l'on peut tester ici, et on ne livre pas un lien qu'on n'a pas ouvert. Une
# page sans AUCUNE requête sortante se vérifie exactement telle qu'elle sera servie —
# et le budget est de 16 Mo pour 1,3.
#
# L'aplatissement est sûr ici parce que tout ce qui traverse un module est soit une
# déclaration de fonction (hissée), soit une classe ou un const utilisé à l'exécution
# seulement. C'est aussi ce qui permet aux deux cycles du projet (Player <-> Enemies,
# Allies <-> Enemies) de survivre à la mise à plat : dans une seule portée, ils
# disparaissent.
import re, pathlib, sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
W = RACINE / 'www'
lire = lambda p: (W / p).read_text(encoding='utf-8')

# --- 1. LES MORCEAUX DE index.html ---
#
# Découpés par REPÈRES, plus par numéros de ligne. La première version codait en dur
# html[21:142], html[146:284]... ; dès qu'index.html a grandi (boutique, dictionnaires,
# démarrage au clavier), les découpes sont tombées au milieu du dictionnaire et ont
# embarqué des <script src> vers des fichiers absents. La page démarrait quand même à
# moitié — le pire des cas, celui qu'on ne voit pas. Chaque repère est vérifié unique.
html = lire('index.html')

def entre(debut, fin, apres=0):
    i = html.index(debut, apres)
    j = html.index(fin, i + len(debut))
    return html[i + len(debut):j], j

def unique(motif):
    n = html.count(motif)
    assert n == 1, f'repère « {motif} » trouvé {n} fois dans index.html'

# Le seul <script> en ligne de la tête : dictionnaire et helpers.
unique('window.gameDict = {')
fin_tete = html.index('</head>')
debut_dict = html.rindex('<script>', 0, html.index('window.gameDict = {'))
assert debut_dict < fin_tete
script_dict, _ = entre('<script>', '</script>', debut_dict)

# Le balisage : de <body> au premier script externe de fin de page.
unique('<script src="audio.js"></script>')
corps, _ = entre('<body>', '<script src="audio.js"></script>')

# La couche d'interface : le <script> en ligne qui suit le module principal.
unique('<script type="module" src="src/main.js"></script>')
apres_module = html.index('<script type="module" src="src/main.js"></script>')
script_jeu, _ = entre('<script>', '</script>', apres_module)

# Garde-fous : rien d'externe ne doit survivre dans ce qui est recopié tel quel.
for nom, bout in (('dictionnaire', script_dict), ('balisage', corps), ('interface', script_jeu)):
    assert '<script src=' not in bout and '<script type="module"' not in bout, f'script externe dans le {nom}'

# --- 2. CSS : les deux woff2 deviennent des data: ---
import base64
def police(nom):
    b64 = base64.b64encode((W / 'fonts' / nom).read_bytes()).decode()
    return f"url('data:font/woff2;base64,{b64}') format('woff2')"

css = lire('style.css')
css = css.replace("url('fonts/press-start-2p-latin.woff2') format('woff2')", police('press-start-2p-latin.woff2'))
css = css.replace("url('fonts/cinzel-decorative-700-latin.woff2') format('woff2')", police('cinzel-decorative-700-latin.woff2'))
assert 'fonts/' not in css, 'une police pointe encore vers un fichier'

# --- 3. LES MODULES, DANS L'ORDRE DES DÉPENDANCES ---
MODULES = [
    'src/managers/GameState.js',
    'src/managers/Veil.js',
    'src/managers/UIManager.js',
    'src/entities/Player.js',
    'src/entities/Allies.js',
    'src/entities/Enemies.js',
    'src/managers/LevelGenerator.js',
    'src/scenes/IntroScene.js',
    'src/scenes/MainScene.js',
    'src/scenes/ChaseScene.js',
    'src/main.js',
]

def aplatir(src):
    src = re.sub(r'^import\s+.*?;\s*$', '', src, flags=re.M)   # imports d'une ligne
    src = re.sub(r'^import\s+\{[^}]*\}\s+from\s+[^;]*;\s*$', '', src, flags=re.M | re.S)
    src = re.sub(r'^export\s+default\s+', '', src, flags=re.M)
    src = re.sub(r'^export\s+', '', src, flags=re.M)
    return src

morceaux, noms = [], {}
for m in MODULES:
    code = aplatir(lire(m))
    # Garde-fou : deux modules qui déclareraient le même nom au premier niveau se
    # marcheraient dessus une fois dans la même portée, en silence.
    for nom in re.findall(r'^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', code, flags=re.M):
        if nom in noms:
            sys.exit(f'COLLISION : « {nom} » déclaré dans {noms[nom]} et {m}')
        noms[nom] = m
    morceaux.append(f'/* ===== {m} ===== */\n{code}')

if 'import' in '\n'.join(morceaux).replace('// import', ''):
    restes = [l for l in '\n'.join(morceaux).split('\n') if re.match(r'\s*import\s', l)]
    if restes:
        sys.exit('IMPORT NON APLATI : ' + restes[0])

page = f"""<title>Ocean Bloom</title>
<style>
{css}
</style>

<script>
{lire('vendor/phaser.min.js')}
</script>

<script>
{script_dict}
</script>

{corps}

<script>
{lire('audio.js')}
</script>

<script>
{lire('assets.js')}
</script>

<script>
{lire('src/managers/DesktopInput.js')}
</script>

<script type="module">
{chr(10).join(morceaux)}
</script>

<script>
{script_jeu}
</script>
"""

sortie = RACINE / 'tests' / 'sortie' / 'ocean-bloom.html'
sortie.parent.mkdir(parents=True, exist_ok=True)
sortie.write_text(page, encoding='utf-8')
print(f'écrit {sortie} — {len(page) / 1024:.0f} Ko, {len(noms)} noms au premier niveau, aucune collision')
