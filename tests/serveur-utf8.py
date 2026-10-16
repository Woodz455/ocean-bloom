# Sert tests/sortie/ (la page groupée) sur le port 8097, en déclarant l'UTF-8.
#
# `python -m http.server` sert le HTML sans charset : le navigateur devine, et tous les
# emojis du jeu passent en mojibake (« â™ª » au lieu de ⚪). L'hôte de l'Artifact, lui,
# déclare l'encodage. On teste donc dans SES conditions — sinon on corrige un bug qui
# n'existe que sur le banc d'essai (c'est arrivé une fois).
import pathlib
from functools import partial
from http.server import SimpleHTTPRequestHandler, HTTPServer

class Handler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        t = super().guess_type(path)
        return t + '; charset=utf-8' if t.startswith('text/html') else t

sortie = pathlib.Path(__file__).resolve().parent / 'sortie'
sortie.mkdir(exist_ok=True)
HTTPServer(('127.0.0.1', 8097), partial(Handler, directory=str(sortie))).serve_forever()
