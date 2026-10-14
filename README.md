# Roll Rush

Jeu de course 3D multijoueur : 12 concurrents, dix circuits, deux coupes, dix fauteuils et vingt-trois personnages, comptes persistants.

## Pilotes légendaires

Douze pilotes inspirés des visuels fournis, disponibles dans **Boutique → Pilotes légendaires** après leur succès dédié, contre des Rush gagnés en jeu. Achat permanent vérifié par le serveur, puis sélection au garage. Aucun bonus de performance. Portraits de référence et costumes 3D animés sont distincts : les modèles sont des adaptations stylisées, pas des scans des images.

| Pilote | Rush |
| --- | ---: |
| Lieutenant Dan | 9000 |
| Le Coach | 7000 |
| Christopher Reeve | 18000 |
| Bran Stark | 15000 |
| Jake Sully | 10000 |
| Hector Salamanca | 14000 |
| Philippe Croizon | 12000 |
| Philippe · Intouchables | 11000 |
| Professeur Xavier | 19000 |
| Timmy | 6000 |
| Stevie | 5000 |
| Michael Schumacher | 20000 |

Stephen Hawking reste le déblocage ultime à 25 000 Rush avec ses conditions existantes. Les personnages sont compatibles avec tous les fauteuils, livrées et modes. La rangée du garage défile horizontalement ; les flèches parcourent tous les pilotes, même verrouillés. Un pilote non acheté est affiché en aperçu uniquement : continuer conserve le pilote équipé. Son objectif, sa progression et son prix apparaissent au garage.

### Succès légendaires

Chaque objectif ouvre l’achat du personnage et accorde 300 XP et de 750 à 4 000 Rush, une seule fois. Les prix restent inchangés. Les autres succès rapportent désormais trois fois leur récompense Rush initiale, sans changer l’XP ni les gains de course/tournoi. Les succès déjà obtenus reçoivent automatiquement la différence au démarrage du serveur, une seule fois. Les résultats enregistrés avant la mise à jour comptent, les achats antérieurs restent acquis.

| Pilote | Objectif |
| --- | --- |
| stevie | Obtenir 30 podiums en course. |
| timmy | Terminer 80 courses. |
| coach | Toucher 150 adversaires avec une échelle ou un revolver dans des courses terminées. |
| dan | Gagner 40 courses. |
| jake | Gagner sur chacun des cinq circuits. |
| philippe | Gagner 8 tournois sans objets. |
| croizon | Gagner 15 courses d’endurance. |
| hector | Gagner 50 courses avec objets. |
| bran | Gagner sur les cinq circuits en 200cc. |
| reeve | Gagner 35 courses en 150cc ou 200cc. |
| xavier | Gagner 7 tournois en 200cc. |
| schumacher | Remporter les cinq manches de 2 tournois en 150cc ou 200cc. |

## Lancement

```sh
docker compose up --build -d
```

Ouvrir http://localhost:8080. SQLite est sauvegardé dans le volume `rollrush-data` ; reconstruire le conteneur conserve les comptes, records et coupes. Ne pas utiliser `docker compose down -v` pour une mise à jour : cette option supprimerait le volume.

## Conduite à trois statistiques et Coupe Horizons

Chaque fauteuil dispose de **24 points** répartis entre vitesse maximale, accélération et maniabilité (1 à 10). Masse identique et coefficient hors-piste commun de 0,55 : aucune statistique cachée propre à un fauteuil.

| Fauteuil | Vitesse | Accélération | Maniabilité |
| --- | ---: | ---: | ---: |
| Comète | 10 | 8 | 6 |
| Atlas | 6 | 9 | 9 |
| Drift | 8 | 6 | 10 |
| Trailblazer | 7 | 8 | 9 |
| Pulse | 9 | 10 | 5 |
| Vector | 8 | 8 | 8 |
| Nomad | 7 | 10 | 7 |
| Stint GT | 9 | 7 | 8 |
| Relay R | 8 | 9 | 7 |
| Apex F1 | 10 | 10 | 4 |

La Vmax vaut `14 + 1,1 × vitesse` m/s ; l’accélération linéaire vaut `2,2 + 0,65 × accélération` m/s². L’accélération latérale maximale vaut `8 + 3,2 × maniabilité` m/s² : le rayon minimal augmente avec le carré de la vitesse. À fond, la Comète demande environ 23 m de rayon ; à 14 m/s, environ 7 m. Freiner avec **S / flèche bas** avant le virage puis réaccélérer est nécessaire dans les courbes serrées. Déraper apporte seulement 8 % de rotation supplémentaire, pas une exemption à cette limite. Bots et humains utilisent la même physique ; les IA anticipent leurs vitesses de passage.

Dans un salon, choisir **Tournoi → Coupe Horizons**. L’hôte choisit la coupe, la catégorie et les objets. La carrière existante reste sur la Coupe Originale ; les deux tournois ont chacun cinq manches et le même barème. L’identité de la coupe est enregistrée avec le résultat.

| Nouveau circuit | Distance réelle par tour | Ambiance |
| --- | ---: | --- |
| Canyon Solaire | 860 m | Désert, mesas et cactus |
| Glacier Boréal | 940 m | Glace et aiguilles enneigées |
| Caldeira Rouge | 1 020 m | Basalte, lave et fumées |
| Temple Émeraude | 1 100 m | Jungle et pyramides |
| Docks Minuit | 1 180 m | Grues et conteneurs |

Les nouveaux circuits sont aussi accessibles en course unique et en endurance, avec ou sans objets, et possèdent leurs classements mondiaux. Sprint Horizons : limite 10 minutes, puis 120 secondes après le premier arrivé (dans cette limite). Les autres limites restent inchangées. Comptes, achats, monnaies, succès, carrière et records existants sont conservés.

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
- Vingt-sept succès donnent automatiquement un bonus unique de Rush et d’XP. Certains ouvrent aussi l’accès à l’achat d’articles exclusifs ; le niveau et le prix restent requis.
- Vingt et un articles : trois livrées, trois modules, cinq pilotes (Aurore, Idris, Stephen Hawking, Nora, Sacha), cinq fauteuils (Vector, Nomad, Apex F1, Stint GT, Relay R), cinq titres publics.
- Les cinq fauteuils et six personnages de départ restent disponibles sans achat. Maya est le pilote par défaut ; Stephen Hawking est désormais verrouillé. Tous les fauteuils ont 24 points sur trois statistiques. Les personnages, titres et livrées sont purement visuels.
- Un seul module actif : accélération +2 %, adhérence hors-piste +2 % (plafonnée à l’adhérence sur route), ou braquage +1,5 %. Aucun module n’augmente la vitesse maximale sur route. Le module équipé s’applique à tous les fauteuils et reste figé durant l’épreuve.

À la première mise à jour, les anciens résultats enregistrés sont crédités **une seule fois**. Les courses historiques n’ayant pas conservé leur difficulté sont comptées en 100cc ; les anciens tournois utilisent leur catégorie enregistrée. Comptes, chronos, favoris et progression de carrière sont préservés.

La monnaie, l’XP, les succès, la collection et l’équipement sont stockés dans SQLite dans le même volume Docker. Attribution des récompenses, achats et bonus sont transactionnels et idempotents. Le client ne peut envoyer ni résultat, ni prix, ni quantité d’XP à créditer. Les nouveaux pilotes et fauteuils sont également contrôlés à l’entrée et à la configuration du salon.

## Rééquilibrage et objectifs de prestige

Les récompenses de course en Rush sont réduites de 58 à 75 % selon la position ; celles des tournois d’environ 68 %. L’XP des courses reste inchangée. Les achats deviennent plus chers : première livrée à 500 Rush, modules de 1 500 à 2 400, Vector à 2 600, Nomad à 4 500. Les succès initiaux demandent désormais 5 courses finies et 5 victoires, puis 30/150 courses, une victoire sur chaque circuit, 5 coupes et 3 coupes de carrière 150cc.

- **Apex F1** : 7 000 Rush, niveau 12, succès « Licence Superpilote » (20 victoires en 150/200cc depuis ce rééquilibrage). Carrosserie de monoplace électrique, quatre roues et ailerons. Statistiques : vitesse 10, accélération 10, maniabilité 4.
- **Stephen Hawking** : 25 000 Rush, niveau 25, succès « Maître de l’espace-temps ». Il faut 50 victoires de course en 200cc, 10 tournois gagnés en 200cc, une victoire sur chacun des cinq circuits en 200cc, 3 grands chelems (les cinq manches gagnées dans un tournoi 150/200cc), et les quatre catégories de carrière remportées. Les objectifs de course/tournoi prestigieux ne prennent en compte que les nouvelles IA ; les catégories de carrière déjà validées sont conservées.

Les prix, niveaux, conditions et progressions détaillées sont visibles dans Boutique & succès. Les achats, crédits, XP, records et succès déjà acquis ne sont pas retirés. Seul Hawking, auparavant gratuit, devient un déblocage à gagner : les comptes qui l’avaient sélectionné basculent sur Maya. Les anciennes victoires ne sont pas requalifiées en performances contre les nouvelles IA ; la difficulté et la version d’équilibrage sont maintenant enregistrées avec chaque résultat.

## Endurance — 15 tours

Dans le salon, l’hôte choisit **Endurance · 15 tours**, son circuit, la difficulté des IA et **avec ou sans objets**. Ce format est une course unique, distincte des tournois et de la carrière de 3 tours. Les douze participants, humains et bots, utilisent les mêmes règles d’usure. Le relais IA d’un joueur déconnecté conserve l’état de ses pneus et peut terminer un arrêt en cours.

À chaque **tour réellement terminé**, le train de pneus actuel vieillit d’un tour. Le premier passage depuis la grille ne compte pas. Pour un âge `n`, la perte totale de Vmax est `n × (n+1) / 2 %` : 1 %, 3 %, 6 %, 10 %, 15 %, 21 %… Elle est plafonnée à **80 %** pour toujours pouvoir rejoindre les stands. Ce multiplicateur s’applique aussi aux turbos et au ralentissement du Lexomil ; accélération et maniabilité restent inchangées. Aucun fauteuil premium ne réduit l’usure.

### Arrêt aux stands

1. Appuyer sur **E** (ou cliquer sur le bouton pneus) pour préparer l’arrêt. E annule la demande tant qu’on n’est pas immobilisé.
2. Rejoindre la **bande cyan à droite, juste après la ligne de départ**, signalée PIT / E sur chaque circuit. La demande ne téléporte pas : il faut réellement entrer dans la zone.
3. Le fauteuil s’arrête automatiquement à 0. Reproduire la séquence de **flèches directionnelles** au clavier ou avec les boutons du QTE. Il y a exactement autant de touches que de tours parcourus avec ce train de pneus, même au plafond d’usure.
4. Une mauvaise flèche recommence la séquence ; une courte pénalité de 0,4 s empêche le spam. Les validations sont espacées d’au moins 0,15 s et le service prend au minimum 1,2 s. Le serveur contrôle le stop, l’index et la séquence.
5. Une fois le service fini, pneus neufs, usure remise à zéro et reprise de l’accélération depuis 0 km/h. Un arrêt sans erreur compte comme parfait.

Pendant le service, le fauteuil ne peut ni utiliser/ramasser des objets ni subir de nouveaux impacts ; les collisions entre fauteuils ne bloquent pas les stands. Les effets déjà reçus expirent normalement. L’IA rejoint physiquement la même zone tous les 4 à 6 tours et consacre 0,5 s à chaque étape du service. Aucun checkpoint ni distance de course n’est offert par un arrêt.

L’endurance dispose de **30 minutes maximum**, avec **180 s après la première arrivée** pour les concurrents encore en piste. Les limites sprint restent à 5 minutes / 60 s. Un abandon ne rapporte ni record, ni XP/Rush de course, ni progression de succès liés aux arrêts.

### Récompenses et records d’endurance

Une endurance terminée rapporte **4 fois les Rush et l’XP d’une course classique**, à difficulté et position identiques. Elle compte comme une seule course pour les compteurs existants. Sept nouveaux succès donnent leurs bonus une seule fois et ouvrent les achats suivants (niveau et Rush toujours requis) :

| Objectif | Déblocage | Niveau / prix |
| --- | --- | --- |
| Terminer 1 endurance | Titre Longue distance | 4 / 800 Rush |
| Terminer 10 endurances | Pilote Nora Flux | 10 / 4 000 Rush |
| Gagner 5 endurances | Fauteuil Stint GT : 8 / 7 / 7 / 7 / 6 | 12 / 6 000 Rush |
| Gagner 3 endurances sans objets | Titre Horloger des stands | 12 / 3 000 Rush |
| Gagner 3 endurances avec objets | Pilote Sacha Volt | 14 / 6 500 Rush |
| 10 arrêts parfaits dans des endurances terminées | Fauteuil Relay R : 7 / 8 / 8 / 6 / 6 | 14 / 6 500 Rush |
| Gagner les 5 circuits + 5 victoires endurance 200cc | Succès Maître du relais : 500 Rush / 1 500 XP | — |

Les pilotes sont cosmétiques et les nouveaux fauteuils ont chacun 24 points. Les récompenses, arrêts et succès sont persistants et idempotents. Stephen Hawking reste le pilote le plus difficile et le plus coûteux à débloquer.

Les classements proposent désormais **Sprint / Endurance**, puis **Avec / Sans objets**, pour les courses complètes comme pour les meilleurs tours. L’API publique ajoute `endurance` et `enduranceWithItems` sans modifier les classements existants. Migration SQLite additive : aucun effacement de compte, record, achat ou progression.

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
