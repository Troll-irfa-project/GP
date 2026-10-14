import { legendaryPilots } from './legendary-catalog.js';
import { trackLayouts } from './track-layouts.js';
export const chairs=[
 {id:'comet',name:'Comète',tag:'Vitesse',color:'#ff6b52',speed:10,accel:8,handling:6,offroad:4,weight:7},
 {id:'atlas',name:'Atlas',tag:'Impact',color:'#f6c453',speed:6,accel:6,handling:6,offroad:7,weight:10},
 {id:'drift',name:'Drift',tag:'Virages',color:'#58d6c4',speed:8,accel:6,handling:10,offroad:5,weight:6},
 {id:'trail',name:'Trailblazer',tag:'Hors-piste',color:'#9b78ff',speed:7,accel:7,handling:7,offroad:10,weight:4},
 {id:'pulse',name:'Pulse',tag:'Accélération',color:'#70a6ff',speed:9,accel:10,handling:6,offroad:4,weight:6},
 {id:'vector',name:'Vector',tag:'Polyvalence',color:'#b389ff',speed:8,accel:8,handling:8,offroad:5,weight:6},
 {id:'nomad',name:'Nomad',tag:'Exploration',color:'#f0b66b',speed:7,accel:6,handling:6,offroad:9,weight:7},
 {id:'stint',name:'Stint GT',tag:'Endurance GT',color:'#35c9bd',speed:8,accel:7,handling:7,offroad:7,weight:6},
 {id:'relay',name:'Relay R',tag:'Atelier course',color:'#ffad49',speed:7,accel:8,handling:8,offroad:6,weight:6},
 {id:'apex',name:'Apex F1',tag:'Monoplace',color:'#f3394e',speed:10,accel:10,handling:9,offroad:3,weight:3}
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
pilots.push(
 {id:'aurore',name:'Aurore Vega',short:'Aurore',role:'L’horizon n’est que le départ',color:'#a17bff',skin:'#e2ad89',hair:'#e9dcec',style:'helmet',portrait:null},
 {id:'nora',name:'Nora Flux',short:'Nora',role:'La précision sur quinze tours',color:'#2ec8bc',skin:'#ae795e',hair:'#28343e',style:'helmet',portrait:null},
 {id:'sacha',name:'Sacha Volt',short:'Sacha',role:'Toujours là au dernier relais',color:'#f36256',skin:'#e9b18d',hair:'#4b2928',style:'helmet',portrait:null},
 {id:'idris',name:'Idris Sol',short:'Idris',role:'Le soleil au bout de la piste',color:'#efba49',skin:'#9c6849',hair:'#252630',style:'helmet',portrait:null}
);
pilots.push(...legendaryPilots);
export const tracks=[
 {id:'neon',name:'Boucle Néon',subtitle:'Boulevards rapides et double chicane',hue:168,width:6.2,route:trackLayouts.neon},
 {id:'coast',name:'Côte Azur',subtitle:'Corniche, baie et virages en S',hue:196,width:6.0,route:trackLayouts.coast},
 {id:'metro',name:'Métro Fantôme',subtitle:'Tunnel, épingle et grande ligne droite',hue:270,width:5.8,route:trackLayouts.metro},
 {id:'garden',name:'Jardin Turbo',subtitle:'Courbes fluides et enchaînements techniques',hue:108,width:6.6,route:trackLayouts.garden},
 {id:'orbit',name:'Orbital 9',subtitle:'Grandes courbes et retour en épingle',hue:310,width:5.7,route:trackLayouts.orbit}
];
