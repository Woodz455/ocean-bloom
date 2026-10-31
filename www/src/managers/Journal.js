// --- LE JOURNAL D'ESSAI ---
//
// Les tests prouvent que le jeu FONCTIONNE ; ils ne disent pas s'il est AMUSANT. Pour
// le savoir, il faut des joueurs — et pour ne pas décider sur une impression, ce
// qu'ils ont fait : combien de temps par niveau, où ils meurent et de quoi, quels
// pouvoirs ils utilisent vraiment, à quel moment ils abandonnent.
//
// Tout reste sur la machine du joueur (localStorage), rien ne part sur le réseau. Le
// joueur le copie lui-même depuis les réglages, en texte lisible, et le renvoie.
//
// Le journal survit à « Réinitialiser » : effacer sa progression pour rejouer est
// justement ce qu'un testeur fait, et c'est une information.

const CLE = 'oceanBloomJournal';
const MAX_NIVEAUX = 200;

const NOMS_CAUSES = {
    ennemi: 'ennemi', meduse: 'méduse', mine: 'mine', dechet: 'déchet',
    baudroie: 'baudroie', boss: 'boss', projectile: 'tir du boss'
};

function lire() {
    try {
        const j = JSON.parse(localStorage.getItem(CLE));
        if (j && Array.isArray(j.niveaux)) return j;
    } catch (e) { /* journal illisible : on repart d'un journal vide */ }
    return { debut: Date.now(), niveaux: [], achats: [] };
}

let J = lire();
// L'entrée du niveau en cours, s'il y en a un.
let courant = null;

function ecrire() {
    if (J.niveaux.length > MAX_NIVEAUX) J.niveaux = J.niveaux.slice(-MAX_NIVEAUX);
    try { localStorage.setItem(CLE, JSON.stringify(J)); } catch (e) { /* stockage plein ou bloqué */ }
}

function cloturer(issue, cause) {
    if (!courant || courant.issue) return;
    courant.issue = issue;
    if (cause) courant.cause = cause;
    courant.duree = Math.round((Date.now() - courant.debut) / 1000);
    ecrire();
}

export const journal = {
    // Un niveau commence (MainScene, ChaseScene). Un niveau laissé sans issue — page
    // rechargée d'une façon que `pagehide` n'a pas vue — est marqué interrompu.
    debutNiveau(niveau, type, totalBalises) {
        J = lire();
        const ouvert = J.niveaux[J.niveaux.length - 1];
        if (ouvert && !ouvert.issue) {
            ouvert.issue = 'interrompu';
            ouvert.duree = ouvert.duree || Math.round(((ouvert.vu || ouvert.debut) - ouvert.debut) / 1000);
        }
        courant = {
            niveau, type: type || 'niveau', debut: Date.now(), issue: null,
            balises: 0, totalBalises: totalBalises || 0,
            coups: {}, parades: 0, pouvoirs: {}, lumiereMin: 100,
            ecran: `${window.innerWidth}×${window.innerHeight}`
        };
        J.niveaux.push(courant);
        ecrire();
    },

    coup(cause, degats) {
        if (!courant || courant.issue || !degats) return;
        const c = cause || 'inconnu';
        courant.coups[c] = (courant.coups[c] || 0) + 1;
        courant.derniereCause = c;
        ecrire();
    },

    parade() {
        if (!courant || courant.issue) return;
        courant.parades++;
        ecrire();
    },

    pouvoir(nom) {
        if (!courant || courant.issue) return;
        courant.pouvoirs[nom] = (courant.pouvoirs[nom] || 0) + 1;
        ecrire();
    },

    balise(allumees, total) {
        if (!courant || courant.issue) return;
        courant.balises = allumees;
        if (total) courant.totalBalises = total;
        ecrire();
    },

    // Appelée à chaque changement de la réserve : seul le minimum est gardé, et il
    // n'est écrit que quand il baisse d'un point entier.
    lumiere(pourcent) {
        if (!courant || courant.issue) return;
        const v = Math.floor(pourcent);
        if (v < courant.lumiereMin) { courant.lumiereMin = v; courant.vu = Date.now(); ecrire(); }
    },

    gagne() { cloturer('gagné'); },
    perdu() { cloturer('perdu', courant && courant.derniereCause); },
    abandon() { cloturer('abandonné'); },

    achat(type, palier) {
        J.achats.push({ type, palier, date: Date.now() });
        ecrire();
    },

    // Le journal en texte, à copier-coller tel quel dans un message.
    texte() {
        const j = lire();
        const date = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        const duree = s => s === undefined ? '?' : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
        const liste = o => Object.entries(o).map(([k, n]) => `${NOMS_CAUSES[k] || k} ×${n}`).join(', ');
        const lignes = [`OCEAN BLOOM — journal d'essai, commencé le ${date(j.debut)}`];
        if (!j.niveaux.length) lignes.push('(aucun niveau joué)');
        for (const n of j.niveaux) {
            const nom = n.type === 'prologue' ? 'Prologue'
                : n.type === 'course' ? `Niveau ${n.niveau} (course)` : `Niveau ${n.niveau}`;
            const morceaux = [`${nom} — ${n.issue || 'en cours'} en ${duree(n.duree)}`];
            if (n.issue === 'perdu' && n.cause) morceaux.push(`tuée par : ${NOMS_CAUSES[n.cause] || n.cause}`);
            if (n.totalBalises) morceaux.push(`balises ${n.balises}/${n.totalBalises}`);
            const coups = Object.values(n.coups).reduce((a, b) => a + b, 0);
            morceaux.push(coups ? `coups reçus : ${coups} (${liste(n.coups)})` : 'aucun coup reçu');
            if (n.parades) morceaux.push(`parades du bouclier : ${n.parades}`);
            morceaux.push(Object.keys(n.pouvoirs).length ? `pouvoirs : ${liste(n.pouvoirs)}` : 'aucun pouvoir');
            morceaux.push(`lumière au plus bas : ${n.lumiereMin} %`);
            lignes.push(`[${date(n.debut)}, ${n.ecran}] ` + morceaux.join(' · '));
        }
        if (j.achats.length) {
            lignes.push('Achats : ' + j.achats.map(a => `${a.type} → ${a.palier}`).join(', '));
        }
        return lignes.join('\n');
    },

    effacer() {
        J = { debut: Date.now(), niveaux: [], achats: [] };
        courant = null;
        ecrire();
    }
};

// Quitter en plein niveau — fermer l'onglet, recharger — est un abandon. `pagehide` est
// le seul événement fiable à la fermeture ; `beforeunload` ne l'est pas partout.
window.addEventListener('pagehide', () => journal.abandon());

window.journal = journal;
