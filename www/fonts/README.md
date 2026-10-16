# Polices embarquées

Sous-ensemble latin (`U+0000-00FF` + ponctuation courante), extrait de Google Fonts.
Suffisant pour le français et l'anglais, accents compris.

| Fichier | Police | Auteur | Licence |
| --- | --- | --- | --- |
| `press-start-2p-latin.woff2` | Press Start 2P | CodeMan38 | SIL Open Font License 1.1 |
| `cinzel-decorative-700-latin.woff2` | Cinzel Decorative 700 | Natanael Gama | SIL Open Font License 1.1 |

La licence OFL autorise l'embarquement dans une application, y compris commerciale,
tant que les fichiers de police ne sont pas vendus seuls et que le nom réservé n'est
pas réutilisé pour une version modifiée.

Pour régénérer un sous-ensemble : récupérer la feuille CSS de Google Fonts avec un
`User-Agent` de navigateur récent (sinon Google renvoie du TTF au lieu du WOFF2), puis
télécharger l'URL du bloc `@font-face` dont l'`unicode-range` commence par `U+0000-00FF`.
