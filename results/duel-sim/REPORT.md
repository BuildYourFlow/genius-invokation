# Rapport final — duels réels v7.0.0

Verdict du juge statistique aveugle : **A**. Après révélation : **Kirara / Keqing / Jadeplume Terrorshroom**. Ce verdict porte uniquement sur ces politiques et ce duel entre deux decks.

## Exécution et intégrité

Moteur open source core 0.20.8, données v7.0.0, exécution locale v24.20.0. Campagne principale : 2000 tentatives, 2000 parties valides, 0 erreurs techniques, 0 nulles. Sensibilité : 400 tentatives, 400 valides, 0 erreurs et 0 nulles. Les erreurs historiques du run 34683327214 sont exclues de ces échantillons.

Départs alternés strictement par indice : 1000 par deck dans le principal, 200 dans la sensibilité. Seeds principales 710000–711999 ; sensibilité 810000–810399. Les smoke tests 700012–700031 sont exclus. Les résultats bruts et les empreintes des scripts sont conservés.

## Résultats

| Échantillon et deck | Victoires / décisives | Winrate | Wilson 95 % | En premier | En second |
|---|---:|---:|---|---:|---:|
| Principal — Venti / Hydro Tulpa / Black Serpent Knight: Windcutter | 576/2000 | 28.80 % | 26.86 %–30.82 % | 30.20 % | 27.40 % |
| Principal — Kirara / Keqing / Jadeplume Terrorshroom | 1424/2000 | 71.20 % | 69.18 %–73.14 % | 72.60 % | 69.80 % |
| Sensibilité — Venti / Hydro Tulpa / Black Serpent Knight: Windcutter | 148/400 | 37.00 % | 32.41 %–41.83 % | 37.00 % | 37.00 % |
| Sensibilité — Kirara / Keqing / Jadeplume Terrorshroom | 252/400 | 63.00 % | 58.17 %–67.59 % | 63.00 % | 63.00 % |

Premier joueur, tous decks réunis : **51.40 %**, Wilson 95 % **49.21 %–53.59 %**. Effet premier moins second pour le deck 0 : 2.80 points ; pour le deck 1 : 2.80 points.

## Durée et rounds

Principal : rounds moyens 5.20, médiane 5, p95 6, extrêmes 3–7. Temps par partie : moyenne 1.73 s, médiane 1.70 s, p95 2.33 s. Ce sont des temps de calcul sous charge parallèle, pas des durées de jeu humaines.

Sensibilité : rounds moyens 5.09, médiane 5, p95 6. Les distributions complètes résumées figurent dans analysis.json.

## Sensibilité et limites

Winrate du deck 0, première moitié : 28.70 % (25.98 %–31.58 %) ; seconde moitié : 28.90 % (26.18 %–31.79 %). Verdict aveugle du second échantillon : A. La politique resource est une variante plus riche, sans supériorité démontrée : cet échantillon mesure la sensibilité, pas une validation par IA optimale.

Les politiques sont strictement identiques pour les deux decks et n'accèdent qu'aux informations autorisées au joueur. Elles restent heuristiques : choix de cartes et mulligan rudimentaires, pas de recherche stratégique profonde, prise en compte incomplète des synergies et effets différés. Les intervalles couvrent l'aléa des parties à politique fixe, pas cette incertitude stratégique ni les éventuels écarts du moteur au client officiel. Les analyses secondaires sont descriptives.

## Aveugle et révélation

Seed d'anonymisation : duel-blind-20260912. A = Kirara / Keqing / Jadeplume Terrorshroom. B = Venti / Hydro Tulpa / Black Serpent Knight: Windcutter. Le programme judge.mjs a reçu exclusivement blind-input.json et a enregistré blind-verdict.json avant la création de reveal.json. C'est un juge statistique déterministe aux règles préfixées, pas un avis humain indépendant.

## Reproduction

Après compilation des paquets du workflow : lancer node scripts/duel-sim/campaign.mjs, puis node scripts/duel-sim/analyze.mjs. Le workflow manuel propose aussi full_campaign. Consulter scripts/duel-sim/METHODOLOGY.md pour le protocole complet ; main-raw.jsonl et sensitivity-raw.jsonl pour toutes les parties.

## Contrôles supplémentaires

Contrôle miroir de force : 200 tentatives, 0 erreurs techniques. Variante resource : 100/200, 50.00 % (Wilson 95 % 43.14 %–56.86 %). Par deck : 57/100 ; 43/100. Supériorité démontrée selon le critère préfixé : **non**. Aucune seconde politique plus forte n'a donc été établie par ce contrôle ; le deuxième échantillon reste une analyse de sensibilité.

1307 parties terminées de la première campagne ont été entièrement exclues : le mélange initial n'était pas reproductible. Les lignes conservées dans excluded-unseeded ne contribuent à aucun winrate présenté. Les tentatives en cours lors de l'arrêt ne sont pas comptées comme parties terminées.

Comparaison des 20 smoke tests entre Windows v24.20.0 et GitHub Linux v26.8.2 : identiques pour tous les champs de jeu enregistrés hors durée. Run GitHub : https://github.com/BuildYourFlow/genius-invokation/actions/runs/34684316772.
