import { legendaryPilots } from './legendary-catalog.js';
// Shared display rules. Currency, ownership and rewards are enforced by the server.
export const shopItems = [
  {id:'paint-lagoon',type:'paint',name:'Lagon électrique',description:'Carrosserie turquoise et finitions nacrées.',price:500,level:2,color:'#21d9bd'},
  {id:'paint-sunset',type:'paint',name:'Coucher de soleil',description:'Carrosserie rose corail.',price:1000,level:3,color:'#ff5299'},
  {id:'paint-gold',type:'paint',name:'Or du champion',description:'Livrée dorée réservée aux vainqueurs de coupe.',price:2600,level:7,achievement:'cup-winner',color:'#ffd34e'},
  {id:'module-start',type:'upgrade',name:'Contrôleur précis',description:'Accélération +2 %. Aucun gain de vitesse maximale.',price:1500,level:5,effect:'acceleration'},
  {id:'module-grip',type:'upgrade',name:'Pneus souples',description:'Adhérence hors-piste +2 %, sans dépasser la vitesse sur route.',price:1500,level:5,effect:'grip'},
  {id:'module-turn',type:'upgrade',name:'Direction fine',description:'Vitesse de braquage +1,5 %. Un seul module équipé.',price:2400,level:8,achievement:'explorer',effect:'steering'},
  {id:'pilot-aurore',type:'pilot',target:'aurore',name:'Aurore Vega',description:'Pilote au casque spatial et à la combinaison lilas. Apparence uniquement.',price:2000,level:6},
  {id:'pilot-idris',type:'pilot',target:'idris',name:'Idris Sol',description:'Pilote exclusif au casque doré. Apparence uniquement.',price:4500,level:10,achievement:'career-150'},
  {id:'chair-vector',type:'chair',target:'vector',name:'Vector',description:'Châssis à double aileron. Stats : 8 / 8 / 8 / 5 / 6 = 35.',price:2600,level:7},
  {id:'chair-nomad',type:'chair',target:'nomad',name:'Nomad',description:'Quatre grandes roues et pare-buffle. Stats : 7 / 6 / 6 / 9 / 7 = 35.',price:4500,level:10,achievement:'cup-winner'},
  {id:'title-rookie',type:'title',name:'Étoile montante',description:'Titre public sous ton pseudo dans le salon.',price:600,level:3},
  {id:'title-champion',type:'title',name:'Champion du club',description:'Un titre pour les vainqueurs de tournoi.',price:1800,level:7,achievement:'cup-winner'},
  {id:'title-legend',type:'title',name:'Légende 200cc',description:'Le titre exclusif de la carrière complète.',price:5000,level:12,achievement:'career-master'},
];
shopItems.push(...legendaryPilots.map(p=>({id:`pilot-${p.id}`,type:'pilot',target:p.id,name:p.name,description:p.description+' Apparence uniquement.',price:p.price,level:1,rarity:p.rarity,art:p.art,achievement:`legend-${p.id}`})));
shopItems.push(
  {id:'chair-apex',type:'chair',target:'apex',name:'Apex F1',description:'Monoplace électrique : 10 vitesse / 10 accélération / 9 maniabilité / 3 hors-piste / 3 poids. 35 points.',price:7000,level:12,achievement:'expert-racer'},
  {id:'pilot-hawking',type:'pilot',target:'hawking',name:'Stephen Hawking',description:'Le pilote ultime. Réservé à une maîtrise complète des catégories et des circuits. Apparence uniquement.',price:25000,level:25,achievement:'ultimate-master'}
);
export const achievements = [
  {id:'first-finish',name:'Premiers tours',description:'Terminer 5 courses.',metric:'races',goal:5,coins:40,xp:100},
  {id:'first-win',name:'Tout devant',description:'Gagner 5 courses.',metric:'wins',goal:5,coins:60,xp:150},
  {id:'regular',name:'Habitué du paddock',description:'Terminer 30 courses.',metric:'races',goal:30,coins:120,xp:350},
  {id:'veteran',name:'Inarrêtable',description:'Terminer 150 courses.',metric:'races',goal:150,coins:400,xp:1000},
  {id:'explorer',name:'Tour du monde',description:'Gagner une course sur chacun des cinq circuits. Débloque l’achat de Direction fine.',metric:'winningCircuits',goal:5,coins:150,xp:250},
  {id:'cup-winner',name:'La coupe à la maison',description:'Gagner 5 tournois. Débloque Or du champion, Nomad et Champion du club.',metric:'cups',goal:5,coins:200,xp:400},
  {id:'career-150',name:'Pilote d’élite',description:'Remporter 3 fois la coupe de carrière 150cc. Débloque l’achat d’Idris Sol.',metric:'career150',goal:3,coins:250,xp:600},
  {id:'career-master',name:'Une légende est née',description:'Remporter les quatre catégories de carrière. Débloque Légende 200cc.',metric:'career',goal:4,coins:400,xp:1200},
];
achievements.push(
  {id:'podium-regular',name:'Sur la boîte',description:'Obtenir 25 podiums en course.',metric:'podiums',goal:25,coins:100,xp:400},
  {id:'expert-racer',name:'Licence Superpilote',description:'Gagner 20 courses en 150cc ou 200cc avec les nouvelles IA. Débloque l’achat de l’Apex F1.',metric:'expertWins',goal:20,coins:250,xp:800},
  {id:'elite-racer',name:'Chasseur 200cc',description:'Gagner 15 courses en 200cc avec les nouvelles IA.',metric:'eliteWins',goal:15,coins:250,xp:800},
  {id:'perfect-cup',name:'Grand chelem',description:'Gagner les cinq manches d’un tournoi 150cc ou 200cc avec les nouvelles IA.',metric:'perfectCups',goal:1,coins:200,xp:600},
  {id:'elite-champion',name:'Le patron du 200cc',description:'Gagner 5 tournois 200cc avec les nouvelles IA.',metric:'eliteCups',goal:5,coins:350,xp:1200},
  {id:'ultimate-master',name:'Maître de l’espace-temps',description:'Réussir les cinq objectifs de maîtrise ci-dessous. Débloque l’achat de Stephen Hawking.',goal:5,coins:800,xp:2000,
   requirements:[{metric:'eliteWins',goal:50,label:'Victoires en 200cc (nouvelles IA)'},{metric:'eliteCups',goal:10,label:'Tournois gagnés en 200cc (nouvelles IA)'},{metric:'eliteCircuits',goal:5,label:'Circuits gagnés en 200cc (nouvelles IA)'},{metric:'perfectCups',goal:3,label:'Grands chelems 150/200cc (nouvelles IA)'},{metric:'career',goal:4,label:'Catégories de carrière remportées'}]}
);
achievements.push(
  {id:'items-winner',name:'Chaos maîtrisé',description:'Gagner 10 courses avec objets.',metric:'itemWins',goal:10,coins:120,xp:350},
  {id:'pure-winner',name:'Tout au pilotage',description:'Gagner 10 courses sans objets depuis cette mise à jour.',metric:'pureWins',goal:10,coins:120,xp:350},
  {id:'items-cup',name:'Coupe du chaos',description:'Remporter 3 tournois avec objets.',metric:'itemCups',goal:3,coins:180,xp:500},
  {id:'pure-cup',name:'La ligne parfaite',description:'Remporter 3 tournois sans objets depuis cette mise à jour.',metric:'pureCups',goal:3,coins:180,xp:500},
  {id:'box-collector',name:'Surprise sur surprise',description:'Ouvrir 100 boîtes mystères lors de courses terminées.',metric:'itemBoxes',goal:100,coins:100,xp:300},
  {id:'item-marksman',name:'Trouble-fête',description:'Toucher 50 adversaires avec une échelle ou un revolver lors de courses terminées.',metric:'itemHits',goal:50,coins:150,xp:400}
);
shopItems.push(
  {id:'title-distance',type:'title',name:'Longue distance',description:'Ton premier titre de pilote d’endurance.',price:800,level:4,achievement:'endurance-debut'},
  {id:'pilot-nora',type:'pilot',target:'nora',name:'Nora Flux',description:'Spécialiste des relais, casque turquoise. Apparence uniquement.',price:4000,level:10,achievement:'endurance-regular'},
  {id:'chair-stint',type:'chair',target:'stint',name:'Stint GT',description:'Carénage longue distance. Stats : 8 / 7 / 7 / 7 / 6 = 35. Usure identique aux autres fauteuils.',price:6000,level:12,achievement:'endurance-winner'},
  {id:'title-clockwork',type:'title',name:'Horloger des stands',description:'Titre gagné au pilotage pur en endurance.',price:3000,level:12,achievement:'endurance-pure'},
  {id:'pilot-sacha',type:'pilot',target:'sacha',name:'Sacha Volt',description:'Pilote du chaos, combinaison rouge et casque blanc. Apparence uniquement.',price:6500,level:14,achievement:'endurance-chaos'},
  {id:'chair-relay',type:'chair',target:'relay',name:'Relay R',description:'Châssis atelier aux roues carénées. Stats : 7 / 8 / 8 / 6 / 6 = 35. Aucun avantage au QTE.',price:6500,level:14,achievement:'pit-perfect'}
);
achievements.push(
  {id:'endurance-debut',name:'Quinze tours plus tard',description:'Terminer une course d’endurance. Débloque l’achat de Longue distance.',metric:'enduranceFinishes',goal:1,coins:50,xp:200},
  {id:'endurance-regular',name:'Le souffle long',description:'Terminer 10 endurances. Débloque Nora Flux.',metric:'enduranceFinishes',goal:10,coins:250,xp:800},
  {id:'endurance-winner',name:'Au bout de l’effort',description:'Gagner 5 endurances. Débloque le Stint GT.',metric:'enduranceWins',goal:5,coins:250,xp:800},
  {id:'endurance-pure',name:'Précision longue durée',description:'Gagner 3 endurances sans objets. Débloque Horloger des stands.',metric:'endurancePureWins',goal:3,coins:150,xp:500},
  {id:'endurance-chaos',name:'Survivre au chaos',description:'Gagner 3 endurances avec objets. Débloque Sacha Volt.',metric:'enduranceItemWins',goal:3,coins:150,xp:500},
  {id:'pit-perfect',name:'Mécanique de précision',description:'Réussir 10 arrêts sans erreur de QTE dans des endurances terminées. Débloque Relay R.',metric:'perfectPitStops',goal:10,coins:150,xp:500},
  {id:'endurance-master',name:'Maître du relais',description:'Gagner sur les cinq circuits en endurance et remporter 5 endurances en 200cc.',goal:2,coins:500,xp:1500,requirements:[{metric:'enduranceCircuits',goal:5,label:'Circuits gagnés en endurance'},{metric:'enduranceEliteWins',goal:5,label:'Victoires endurance 200cc'}]}
);
achievements.push(...[
  {
    "id": "legend-stevie",
    "name": "Premier de la classe",
    "metric": "podiums",
    "goal": 30,
    "description": "Obtenir 30 podiums en course. Débloque l’achat de Stevie.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-timmy",
    "name": "Toujours de la partie",
    "metric": "races",
    "goal": 80,
    "description": "Terminer 80 courses. Débloque l’achat de Timmy.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-coach",
    "name": "École du chaos",
    "metric": "itemHits",
    "goal": 150,
    "description": "Toucher 150 adversaires avec une échelle ou un revolver dans des courses terminées. Débloque l’achat de Le Coach.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-dan",
    "name": "Ne jamais lâcher",
    "metric": "wins",
    "goal": 40,
    "description": "Gagner 40 courses. Débloque l’achat de Lieutenant Dan.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-jake",
    "name": "Terrain conquis",
    "metric": "winningCircuits",
    "goal": 5,
    "description": "Gagner sur chacun des cinq circuits. Débloque l’achat de Jake Sully.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-philippe",
    "name": "La belle échappée",
    "metric": "pureCups",
    "goal": 8,
    "description": "Gagner 8 tournois sans objets. Débloque l’achat de Philippe.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-croizon",
    "name": "Au-delà de la distance",
    "metric": "enduranceWins",
    "goal": 15,
    "description": "Gagner 15 courses d’endurance. Débloque l’achat de Philippe Croizon.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-hector",
    "name": "Dernier avertissement",
    "metric": "itemWins",
    "goal": 50,
    "description": "Gagner 50 courses avec objets. Débloque l’achat de Hector Salamanca.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-bran",
    "name": "Couronne des circuits",
    "metric": "eliteCircuits",
    "goal": 5,
    "description": "Gagner sur les cinq circuits en 200cc. Débloque l’achat de Bran Stark.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-reeve",
    "name": "Toujours plus haut",
    "metric": "expertWins",
    "goal": 35,
    "description": "Gagner 35 courses en 150cc ou 200cc. Débloque l’achat de Christopher Reeve.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-xavier",
    "name": "Maîtrise absolue",
    "metric": "eliteCups",
    "goal": 7,
    "description": "Gagner 7 tournois en 200cc. Débloque l’achat de Professeur Xavier.",
    "coins": 0,
    "xp": 300
  },
  {
    "id": "legend-schumacher",
    "name": "La course parfaite",
    "metric": "perfectCups",
    "goal": 2,
    "description": "Remporter les cinq manches de 2 tournois en 150cc ou 200cc. Débloque l’achat de Michael Schumacher.",
    "coins": 0,
    "xp": 300
  }
]);
export function achievementProgress(achievement,metrics) {
  return achievement.requirements ? achievement.requirements.filter(r=>(metrics[r.metric]||0)>=r.goal).length : metrics[achievement.metric]||0;
}
export function levelProgress(xp) {
  const level=Math.floor((1+Math.sqrt(1+8*Math.max(0,xp)/250))/2);
  const floor=250*(level-1)*level/2,next=250*level*(level+1)/2;
  return {level,current:xp-floor,required:next-floor,next};
}
export function raceReward(place,difficulty='100',mode='race') {
  const multiplier=({'50':1,'100':1.15,'150':1.35,'200':1.6})[difficulty] || 1;
  const duration=mode==='endurance'?4:1;
  return {coins:Math.round((10+(12-place)*4)*multiplier)*duration,xp:Math.round((70+(12-place)*12)*multiplier)*duration};
}
export function cupReward(place,difficulty='100') {
  const multiplier=({'50':1,'100':1.15,'150':1.35,'200':1.6})[difficulty] || 1;
  return {coins:Math.round((50+(12-place)*8+(place===1?30:0))*multiplier),xp:Math.round((300+(12-place)*35)*multiplier)};
}
export function itemFor(type,target) {return shopItems.find(i=>i.type===type&&i.target===target);}
export function ownsSelection(progression,type,target) {
  const item=itemFor(type,target);return !item || Boolean(progression?.owned.includes(item.id));
}
export function paintChair(chair,paintId) {
  const paint=shopItems.find(i=>i.type==='paint'&&i.id===paintId);
  return paint ? {...chair,color:paint.color} : chair;
}
