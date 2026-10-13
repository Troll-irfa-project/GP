# Roll Rush

Jeu de course 3D multijoueur : 12 concurrents, cinq circuits, huit fauteuils et neuf personnages, comptes persistants.

## Lancement

```sh
docker compose up --build -d
```

Ouvrir http://localhost:8080. SQLite est sauvegardé dans le volume `rollrush-data` ; reconstruire le conteneur conserve les comptes, records et coupes. Ne pas utiliser `docker compose down -v` pour une mise à jour : cette option supprimerait le volume.

## Compétitions

- **Records mondiaux** : bouton dans le paddock, top 50 des meilleurs temps de course (trois tours) et de tour par circuit. Un record par pilote et par règlement, classements séparés course/tour et **avec/sans objets**. Les anciens records sont conservés. L’API GET `/api/leaderboards` est publique et ne renvoie que pseudos, rangs, circuits et chronos.
- **Tournoi** : l’hôte sélectionne « Tournoi · 5 circuits » et la catégorie IA dans son salon. Cinq manches : Néon, Côte Azur, Métro, Jardin, Orbite. Même grille de 12 pilotes, trois tours par manche. L’hôte lance la manche suivante depuis le salon, une fois la manche terminée.
- **Points** : 15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1. Un abandon rapporte 0. Égalités départagées par nombre de victoires, temps cumulé (600 s de pénalité par abandon), puis ordre initial sur la grille.
- **Difficultés IA** : 50cc (club), 100cc (sport), 150cc (expert), 200cc (élite). Le plafond de vitesse des bots est multiplié respectivement par 1,06 / 1,25 / 1,45 / 1,65, avec une légère variation individuelle. Ils prennent des trajectoires intérieures, visent les plaques turbo, dépassent et chargent de vrais dérapages pour relancer. Leur rythme en virage et la durée des dérapages augmentent avec la catégorie. Il n’y a ni téléportation de progression ni rattrapage artificiel lié au joueur ; checkpoints et collisions restent validés par la physique. Les performances humaines restent identiques : les chronos sont donc regroupés entre catégories.
- **Carrière** : tournoi privé contre 11 bots. Seule la catégorie 50cc est ouverte au départ. Une victoire au classement général débloque la suivante, jusqu’à 200cc. Finir deuxième, gagner une seule manche ou remporter une coupe multijoueur ne débloque pas une catégorie de carrière. Les coupes gagnées et déblocages sont sauvegardés côté serveur.
- **Fin de manche** : 60 secondes après le premier arrivé, avec un maximum de cinq minutes de course. Les pilotes encore en piste sont classés en abandon, derrière les arrivants et par progression. Aucun record n’est enregistré pour un abandon.

Les rooms et tournois en cours sont en mémoire : quitter sa carrière, se déconnecter ou redémarrer le serveur abandonne l’épreuve en cours. Les records et catégories déjà gagnées restent acquis. En multijoueur, un départ est remplacé par une IA ; l’humain présent depuis le plus longtemps devient hôte. Une IA relais ne gagne pas de progression pour le joueur parti.

## Progression, boutique et succès

Le bouton **Boutique & succès** du paddock ouvre la collection. Les crédits **Rush** se gagnent uniquement en jouant : aucun achat en argent réel. Le niveau dépend de l’XP totale, qui n’est jamais dépensée. Acheter déduit des Rush ; équiper ou retirer un article acquis est gratuit. Quitter le salon est nécessaire pour modifier l’équipement.

- Course terminée, rang `p` (1 à 12) : `10 + (12-p) × 4` Rush et `70 + (12-p) × 12` XP.
- Tournoi terminé avec au moins un point : bonus de `50 + (12-p) × 8` Rush (+30 pour le vainqueur) et `300 + (12-p) × 35` XP. Ce bonus s’ajoute aux récompenses de chaque manche.
- Multiplicateurs IA : 50cc ×1, 100cc ×1,15, 150cc ×1,35, 200cc ×1,6. Arrondi à l’entier. Les abandons ne donnent pas de récompense de course.
- Le niveau `n` commence à `250 × (n-1) × n / 2` XP cumulés : niveau 2 à 250 XP, niveau 3 à 750 XP, etc.
- Vingt succès donnent automatiquement un bonus unique de Rush et d’XP. Certains ouvrent aussi l’accès à l’achat d’articles exclusifs ; le niveau et le prix restent requis.
- Quinze articles : trois livrées, trois modules, trois pilotes (Aurore, Idris, Stephen Hawking), trois fauteuils (Vector, Nomad, Apex F1), trois titres publics.
- Les cinq fauteuils et six personnages de départ restent disponibles sans achat. Maya est le pilote par défaut ; Stephen Hawking est désormais verrouillé. Tous les fauteuils ont 35 points de statistiques. Les personnages, titres et livrées sont purement visuels.
- Un seul module actif : accélération +2 %, adhérence hors-piste +2 % (plafonnée à l’adhérence sur route), ou braquage +1,5 %. Aucun module n’augmente la vitesse maximale sur route. Le module équipé s’applique à tous les fauteuils et reste figé durant l’épreuve.

À la première mise à jour, les anciens résultats enregistrés sont crédités **une seule fois**. Les courses historiques n’ayant pas conservé leur difficulté sont comptées en 100cc ; les anciens tournois utilisent leur catégorie enregistrée. Comptes, chronos, favoris et progression de carrière sont préservés.

La monnaie, l’XP, les succès, la collection et l’équipement sont stockés dans SQLite dans le même volume Docker. Attribution des récompenses, achats et bonus sont transactionnels et idempotents. Le client ne peut envoyer ni résultat, ni prix, ni quantité d’XP à créditer. Les nouveaux pilotes et fauteuils sont également contrôlés à l’entrée et à la configuration du salon.

## Rééquilibrage et objectifs de prestige

Les récompenses de course en Rush sont réduites de 58 à 75 % selon la position ; celles des tournois d’environ 68 %. L’XP des courses reste inchangée. Les achats deviennent plus chers : première livrée à 500 Rush, modules de 1 500 à 2 400, Vector à 2 600, Nomad à 4 500. Les succès initiaux demandent désormais 5 courses finies et 5 victoires, puis 30/150 courses, une victoire sur chaque circuit, 5 coupes et 3 coupes de carrière 150cc.

- **Apex F1** : 7 000 Rush, niveau 12, succès « Licence Superpilote » (20 victoires en 150/200cc depuis ce rééquilibrage). Carrosserie de monoplace électrique, quatre roues et ailerons. Statistiques : vitesse 10, accélération 10, maniabilité 9, hors-piste 3, poids 3.
- **Stephen Hawking** : 25 000 Rush, niveau 25, succès « Maître de l’espace-temps ». Il faut 50 victoires de course en 200cc, 10 tournois gagnés en 200cc, une victoire sur chacun des cinq circuits en 200cc, 3 grands chelems (les cinq manches gagnées dans un tournoi 150/200cc), et les quatre catégories de carrière remportées. Les objectifs de course/tournoi prestigieux ne prennent en compte que les nouvelles IA ; les catégories de carrière déjà validées sont conservées.

Les prix, niveaux, conditions et progressions détaillées sont visibles dans Boutique & succès. Les achats, crédits, XP, records et succès déjà acquis ne sont pas retirés. Seul Hawking, auparavant gratuit, devient un déblocage à gagner : les comptes qui l’avaient sélectionné basculent sur Maya. Les anciennes victoires ne sont pas requalifiées en performances contre les nouvelles IA ; la difficulté et la version d’équilibrage sont maintenant enregistrées avec chaque résultat.

## Objets de course

L’hôte choisit **Sans objets** (par défaut) ou **Avec objets** dans le salon, avant le départ. Cette option s’applique aux courses uniques, aux cinq manches d’un tournoi et à la carrière. Elle est verrouillée du départ jusqu’à la fin de l’épreuve ; changer de circuit ou d’hôte ne change pas le règlement.

**A** utilise l’objet (ou cliquer sur son icône). **Q / ←** tourne à gauche, **D / →** à droite, **Z / W / ↑** accélère, **S / ↓** freine, **Espace** dérape. A ne braque plus le fauteuil.

Douze boîtes mystères animées sont réparties en quatre rangées sur chaque circuit. Les traverser donne aléatoirement un des six objets (Échelle 30 %, Viagra 30 %, Revolver 20 %, Lexomil 5 %, Tournée générale 5 %, Boîte de Viagra 10 %). Un seul emplacement : aucune boîte n’est consommée si l’inventaire est plein. Une boîte réapparaît après 8 secondes et ne peut être récupérée que par un pilote à la fois. Les bots ramassent et utilisent les mêmes objets.

| Objet | Effet |
| --- | --- |
| Viagra | Une charge : Vmax +20 % pendant 3 s. Ne se multiplie pas avec un turbo de piste/dérapage : seul le bonus le plus fort s’applique. |
| Échelle | Posée 3 m derrière, perpendiculaire à la piste et large de 75 % de la chaussée. Premier impact : arrêt à 0, tête-à-queue de 360° pendant 0,5 s, puis accélération normale. Disparaît au premier impact ou après 30 s. |
| Lexomil | Vmax des autres pilotes −20 % pendant 10 s. Réapplication : durée rafraîchie, sans multiplier le ralentissement. |
| Boîte de Viagra | Trois activations séparées de 3 s. Attendre la fin d’un boost pour utiliser la charge suivante. |
| Revolver | Une munition, cible automatiquement le pilote classé immédiatement devant. Arrêt pendant 1 s, puis redémarrage à 0. Sans cible valide, la munition est conservée. |
| Tournée générale | Flou d’intensité 0,5 (4 px sur le rendu 3D, HUD net) chez tous les autres pilotes. Durée calculée au lancement : 10 s pour le premier, 5 s pour le douzième, interpolation linéaire entre les deux. |

Effets purement fictifs de jeu. Les impacts n’infligent aucune blessure : immobilisation et effets arcade uniquement. Le flou cesse à expiration ou en quittant la course. Les effets, inventaires et pièges sont réinitialisés à chaque manche.

Le serveur décide seul du loot, des cibles, des collisions et des durées. Le client envoie uniquement une demande d’utilisation, sans objet ni cible imposable. Collisions balayées pour ne pas traverser une boîte ou une échelle à grande vitesse ; modèles instanciés et pools bornés pour préserver les performances.

Six nouveaux succès : **Chaos maîtrisé** (10 victoires avec objets), **Tout au pilotage** (10 sans), **Coupe du chaos** (3 tournois avec), **La ligne parfaite** (3 sans), **Surprise sur surprise** (100 boîtes), **Trouble-fête** (50 impacts d’échelle/revolver sur des adversaires). Les compteurs ne progressent que sur des courses terminées et des résultats enregistrés depuis cette mise à jour. Aucun bonus sur abandon, aucun double crédit. Les succès existants restent valables dans les deux règlements.

Les anciens records restent dans **Sans objets** ; les nouveaux records avec objets sont enregistrés séparément et consultables via le filtre des classements mondiaux. L’API publique conserve `circuits` (sans objets) et ajoute `withItems`. Migration SQLite additive, sans retrait de monnaie, d’achats ou de progression.

## Vérification locale

Node 22 avec SQLite natif (ou Node 24), dépendances installées via `npm install` :

```sh
npm test
npm run test:browser
```

Les tests navigateur utilisent Chrome installé et Playwright. Ils créent des bases temporaires séparées du volume Docker. Ils couvrent notamment les cinq manches, les points, les verrouillages de carrière, la persistance, les records globaux, les quatre catégories d’IA sur les cinq circuits et les écrans desktop/mobile.

Pour une exposition sur Internet, utiliser un reverse proxy HTTPS, définir `APP_ORIGIN` et `COOKIE_SECURE=true`. Les mots de passe sont hachés avec scrypt et les sessions utilisent des cookies HttpOnly.
