ASCENSION SOUVERAINE — DASHBOARD FINAL V1

FICHIERS
- index.html
- app.js
- sw.js
- manifest.webmanifest
- apple-touch-icon.png
- icon-192.png
- icon-512.png

FONCTIONNEMENT
1. AUJOURD'HUI
   - tap sur une ligne = coche/décoche
   - compteur à droite = progression de cet objectif sur la semaine

2. SEMAINE
   - pourcentage global = somme(min(validations, cible)) / somme(cibles)
   - les jours futurs sont bloqués
   - les jours antérieurs à la création d’un objectif ou postérieurs à son archivage sont bloqués
   - les flèches permettent de consulter/corriger les semaines précédentes

3. RÉGLAGES
   - emoji, nom et fréquence hebdomadaire
   - changement de fréquence effectif à partir du lundi de la semaine courante
   - renommer ne casse jamais l'historique
   - un objectif déjà utilisé est archivé au lieu d'être supprimé immédiatement
   - export/import JSON
   - affichage de la date de dernière sauvegarde

STOCKAGE
- une seule clé localStorage : asc.v1
- schemaVersion dès la première version
- demande navigator.storage.persist() si disponible
- ne jamais changer inutilement l'URL du site après installation
- faire régulièrement Exporter JSON

RAPPELS
Les rappels 08:00 / 14:00 / 20:00 sont déjà gérés par ChatGPT.

DÉPLOIEMENT GITHUB PAGES
1. Créer un dépôt GitHub, par exemple ascension-dashboard.
2. Envoyer TOUS les fichiers de ce dossier à la racine du dépôt.
3. GitHub > Settings > Pages.
4. Build and deployment > Source : Deploy from a branch.
5. Branch : main ; folder : /(root) ; Save.
6. Attendre que GitHub affiche l'URL HTTPS du site.
7. Ouvrir cette URL sur l'iPhone.

INSTALLATION IPHONE (iOS 26)
1. Ouvrir l'URL dans Safari.
2. Partager.
3. Ajouter à l'écran d'accueil.
4. Laisser « Ouvrir comme app web » activé.
5. Ajouter.
6. À partir de là, utiliser l'icône Ascension plutôt que la page dans Safari.

IMPORTANT
L'app installée possède son propre stockage web. Commencer à cocher une fois
l'application installée. Garder des exports JSON périodiques.
