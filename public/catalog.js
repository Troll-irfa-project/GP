const route=[[-8,-58],[35,-58],[48,-44],[50,-18],[34,-4],[15,-2],[8,12],[28,28],[20,46],[-8,54],[-34,47],[-46,30],[-45,6],[-28,-4],[-12,-8],[-18,-25],[-42,-34],[-40,-49]];
export const chairs=[
 {id:'comet',name:'Comète',tag:'Vitesse',color:'#ff6b52',speed:10,accel:8,handling:6,offroad:4,weight:7},
 {id:'atlas',name:'Atlas',tag:'Impact',color:'#f6c453',speed:6,accel:6,handling:6,offroad:7,weight:10},
 {id:'drift',name:'Drift',tag:'Virages',color:'#58d6c4',speed:8,accel:6,handling:10,offroad:5,weight:6},
 {id:'trail',name:'Trailblazer',tag:'Hors-piste',color:'#9b78ff',speed:7,accel:7,handling:7,offroad:10,weight:4},
 {id:'pulse',name:'Pulse',tag:'Accélération',color:'#70a6ff',speed:9,accel:10,handling:6,offroad:4,weight:6}
];
// Appearance only: pilot choice never changes vehicle handling or performance.
export const pilots = [
 {id:'hawking',name:'Stephen Hawking',short:'Hawking',role:'L’esprit de la course',color:'#344767',skin:'#e8b48e',hair:'#96816a',style:'glasses',portrait:0},
 {id:'maya',name:'Maya Dubois',short:'Maya',role:'Toujours une longueur d’avance',color:'#ed568e',skin:'#dba47d',hair:'#573326',style:'ponytail',portrait:1},
 {id:'amine',name:'Amine Traoré',short:'Amine',role:'Le sourire dans les virages',color:'#35b567',skin:'#935d3d',hair:'#241c20',style:'beard',portrait:2},
 {id:'lina',name:'Lina Garcia',short:'Lina',role:'Une trajectoire haute en couleur',color:'#8a4ede',skin:'#e8b18d',hair:'#f04a9e',style:'buns',portrait:3},
 {id:'ren',name:'Ren Tanaka',short:'Ren',role:'Le prochain virage est à lui',color:'#f59036',skin:'#dcab84',hair:'#24232c',style:'spikes',portrait:4},
 {id:'camille',name:'Camille Leclerc',short:'Camille',role:'Du style jusqu’à la ligne',color:'#526782',skin:'#d9a17b',hair:'#503728',style:'cap',portrait:5},
 {id:'sofia',name:'Sofia Morel',short:'Sofia',role:'Le calme avant le turbo',color:'#ede0b8',skin:'#b9825c',hair:'#ead39d',style:'bob',portrait:6},
];
export const tracks=[
 {id:'neon',name:'Boucle Néon',subtitle:'Raccourci sous le pont',hue:168,width:6.2,route},
 {id:'coast',name:'Côte Azur',subtitle:'Épingles et boost marin',hue:196,width:6.0,route:route.map(([x,z])=>[x*1.08,z*.82])},
 {id:'metro',name:'Métro Fantôme',subtitle:'Rails, tunnel et chicanes',hue:270,width:5.8,route:route.map(([x,z])=>[x*.82,z*1.05])},
 {id:'garden',name:'Jardin Turbo',subtitle:'Berges et tremplins',hue:108,width:6.6,route:route.map(([x,z])=>[x*1.05,z*.9])},
 {id:'orbit',name:'Orbital 9',subtitle:'Le grand tour suspendu',hue:310,width:5.7,route:route.map(([x,z])=>[x*1.16,z*.88])}
];
