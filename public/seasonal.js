export const seasonalEvents = [
  {id:'autumn',name:'Automne',color:'#d77735',tracks:['Feuilles mortes','Forêt cuivrée','Route des vendanges','Crépuscule roux','Lac des brumes'],chair:{id:'autumn',name:'Feuille d’Or',tag:'Saison automnale',color:'#d77735',accent:'#ffd16b',decal:'leaf',speed:8,accel:8,handling:8},pilot:{id:'autumn',name:'Dame Automne',short:'Automne',role:'La reine des feuilles et des virages dorés.',color:'#a84c32',skin:'#dba47d',hair:'#6a3025',style:'classic',accessory:'couronne de feuilles'},logo:{id:'autumn',name:'Feuille d’Or',art:'/assets/logos/season-autumn.svg'}},
  {id:'halloween',name:'Halloween',color:'#a75cff',tracks:['Manoir hanté','Cimetière brumeux','Citrouilles en furie','Village des ombres','Train fantôme'],chair:{id:'halloween',name:'Cercueil Turbo',tag:'Saison Halloween',color:'#812d9e',accent:'#ff8a28',decal:'bat',speed:9,accel:7,handling:8},pilot:{id:'halloween',name:'Comtesse Squelette',short:'Squelette',role:'Elle ne freine jamais devant une maison hantée.',color:'#34213f',skin:'#d4a27f',hair:'#d7d7e8',style:'helmet',accessory:'voile spectral'},logo:{id:'halloween',name:'Citrouille Noire',art:'/assets/logos/season-halloween.svg'}},
  {id:'thanksgiving',name:'Thanksgiving',color:'#d59b49',tracks:['Route de la parade','Ferme du dîner','Canyon des récoltes','Grande tablée','Dinde express'],chair:{id:'thanksgiving',name:'Turkey Racer',tag:'Saison Thanksgiving',color:'#b66c36',accent:'#f3c66c',decal:'harvest',speed:7,accel:9,handling:8},pilot:{id:'thanksgiving',name:'Chef Harvest',short:'Harvest',role:'La recette secrète : accélérer avant la dernière courbe.',color:'#b56a37',skin:'#c98d67',hair:'#38231e',style:'beard',accessory:'toque de chef'},logo:{id:'thanksgiving',name:'Dinde Dorée',art:'/assets/logos/season-thanksgiving.svg'}},
  {id:'winter',name:'Hiver',color:'#6ed8ff',tracks:['Col de glace','Forêt givrée','Lac gelé','Station polaire','Aurore boréale'],chair:{id:'winter',name:'Frost Runner',tag:'Saison hivernale',color:'#72d7ef',accent:'#e9fcff',decal:'snowflake',speed:8,accel:7,handling:9},pilot:{id:'winter',name:'Capitaine Givre',short:'Givre',role:'La glace ne ralentit que les pilotes qui hésitent.',color:'#3b91c0',skin:'#e3b99b',hair:'#e7f5ff',style:'helmet',accessory:'visière polaire'},logo:{id:'winter',name:'Flocon Royal',art:'/assets/logos/season-winter.svg'}},
  {id:'christmas',name:'Noël',color:'#ef5a5a',tracks:['Usine de jouets','Village du Père Noël','Traîneau express','Marché illuminé','Atelier des cadeaux'],chair:{id:'christmas',name:'Traîneau Rush',tag:'Saison de Noël',color:'#e43f4f',accent:'#ffd45a',decal:'star',speed:9,accel:9,handling:6},pilot:{id:'christmas',name:'Père Noël',short:'Santa',role:'Ho ho ho, et plein gaz dans la cheminée suivante.',color:'#c9283c',skin:'#e3b08f',hair:'#f2f2f2',style:'beard',accessory:'bonnet rouge'},logo:{id:'christmas',name:'Étoile de Noël',art:'/assets/logos/season-christmas.svg'}},
  {id:'newyear',name:'Jour de l’an',color:'#ffd85c',tracks:['Boulevard minuit','Feu d’artifice','Compte à rebours','Toits de la ville','Première aube'],chair:{id:'newyear',name:'Nova 2027',tag:'Saison Jour de l’an',color:'#f3c84b',accent:'#8fe8ff',decal:'firework',speed:10,accel:7,handling:7},pilot:{id:'newyear',name:'Monsieur Minuit',short:'Minuit',role:'Il prend toujours le dernier virage avant les douze coups.',color:'#283d83',skin:'#b77d5d',hair:'#17203a',style:'glasses',accessory:'lunettes de fête'},logo:{id:'newyear',name:'Feu d’Artifice',art:'/assets/logos/season-newyear.svg'}}
];

// These are authored seasonal route profiles, not variations of the base-game layouts.
const seasonalVisuals = [
  ['#b65c3a','#f0ae78','#6f4739','#3f7770','#57352d','#c66b3d','#dca35a'],['#7b3f32','#e3a26e','#7a4a35','#385f62','#57382d','#b34e31','#f2c16d'],['#c17739','#f3c77b','#895b35','#4e806e','#67452f','#d09443','#f0db8a'],['#6b3440','#c77f72','#5e3c4a','#426a63','#4b3042','#a55346','#f2b45e'],['#80553f','#d9aa78','#806045','#4d7773','#67503e','#bd7c49','#e8d18a'],
  ['#251b4d','#7562a6','#33284d','#343e72','#201a36','#6845a8','#ff9f43'],['#171b43','#6967a0','#2c3152','#303a68','#24233d','#8b4d9c','#df7bff'],['#33204c','#a478bd','#473456','#3d5870','#2b203d','#b05fbd','#ffb452'],['#241c3e','#8370a9','#3b3156','#475176','#26213b','#6d58a7','#e45d8e'],['#171d39','#5c6d9d','#2d3652','#334e73','#202941','#8d4da5','#ffbe55'],
  ['#9b4e2d','#e7aa63','#795034','#54745a','#70482d','#ba7138','#f5d26a'],['#7e4128','#d88a4c','#75452d','#5c7651','#633d28','#ce6c39','#f3bd58'],['#aa6137','#edbd72','#8c5932','#4a8066','#77472e','#d58a3e','#ffe08a'],['#6f3c35','#d28f5d','#724439','#4e6b59','#5a3936','#bd6544','#f4cb6f'],['#8e502c','#df9d51','#805837','#5b7c58','#60422e','#b8773a','#f0d28b'],
  ['#487da6','#c6e4f0','#8eb5c5','#6fa8bc','#d5e6ea','#87bdd2','#efffff'],['#35678d','#acd4e9','#7da1b8','#6599b3','#c2d8e4','#4d91bd','#d9f7ff'],['#5676a7','#d1e2ff','#9aaecb','#688cb4','#d8e4f2','#6e8ec3','#ffffff'],['#386f8a','#b7dce3','#76aab7','#5d9ca7','#c3d8db','#4c94a5','#e8ffff'],['#637ca1','#d8e7f5','#a9bdcf','#789bb3','#d5e1e9','#7995bf','#f5ffff'],
  ['#5f202a','#d89591','#5b684c','#4c8790','#74403f','#cf4d51','#ffe06e'],['#7f2530','#e5a6a0','#6b734d','#528d8b','#82423c','#e24b4c','#f7d05b'],['#471b39','#c58aa1','#53634d','#587f8e','#61394f','#b54671','#ffdc72'],['#8a2d32','#e8b0a0','#687650','#659a92','#864b40','#d53d4d','#fff09a'],['#5b253a','#d19aa7','#4d684e','#4d8191','#733f58','#c54a66','#ffd35d'],
  ['#111a4a','#5d70ae','#26365f','#36569a','#1d234b','#486de0','#ffe273'],['#17204e','#7384c4','#2f426e','#3c64aa','#232a52','#5062d2','#ffcf5b'],['#201545','#8774b5','#33315f','#4d5897','#30234e','#8053c9','#ffdf6d'],['#111b3e','#5774ac','#273d67','#2d6b98','#1d2d50','#3d8bd0','#ffe48a'],['#241843','#6a63ad','#303460','#4168a3','#2a2553','#6758d4','#ffd457']
].map(([sky,fog,ground,water,stone,trees,accent])=>({sky,fog,ground,water,stone,trees,accent}));

function authoredRoute(seed) {
  const points=[];
  const count=16;
  for(let i=0;i<count;i++) {
    const a=i*Math.PI*2/count;
    const radius=1+0.16*Math.sin(a*(2+(seed%3))+seed*.37)+0.08*Math.cos(a*(3+(seed%4))-seed*.21);
    const x=Math.cos(a)*(38+seed%5*2)*radius + Math.sin(a*2+seed)*5;
    const z=Math.sin(a)*(25+seed%4*3)*radius + Math.cos(a*3-seed*.4)*4;
    points.push([Number(x.toFixed(3)),Number(z.toFixed(3))]);
  }
  return points;
}
function normalizedAngle(value) {
  while(value>Math.PI)value-=Math.PI*2;
  while(value<-Math.PI)value+=Math.PI*2;
  return value;
}
function turnAt(route,index) {
  const previous=route[(index-1+route.length)%route.length], current=route[index], next=route[(index+1)%route.length];
  const incoming=Math.atan2(current[1]-previous[1],current[0]-previous[0]);
  const outgoing=Math.atan2(next[1]-current[1],next[0]-current[0]);
  return Math.abs(normalizedAngle(outgoing-incoming));
}
function putStartOnStraight(route) {
  let selected=0,best=-Infinity;
  for(let i=0;i<route.length;i++) {
    const next=(i+1)%route.length, a=route[i], b=route[next];
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const score=length/(1+turnAt(route,i)*7+turnAt(route,next)*7);
    if(score>best){best=score;selected=i;}
  }
  const next=(selected+1)%route.length, midpoint=[(route[selected][0]+route[next][0])/2,(route[selected][1]+route[next][1])/2];
  return [midpoint,...route.slice(next),...route.slice(0,next)];
}
function scaleRouteToLength(route,target) {
  let perimeter=0;
  for(let i=0;i<route.length;i++){const a=route[i],b=route[(i+1)%route.length];perimeter+=Math.hypot(b[0]-a[0],b[1]-a[1]);}
  const scale=target/perimeter;
  return route.map(([x,z])=>[Number((x*scale).toFixed(3)),Number((z*scale).toFixed(3))]);
}
const seasonalLengths=[420,560,720,900,1180,480,640,820,1040,1320,450,610,790,980,1260,430,590,760,1120,1480,500,680,860,1200,1580,470,620,840,1080,1400];
export const seasonalTracks = seasonalEvents.flatMap((event,eventIndex) => event.tracks.map((name,index) => {
  const visual=seasonalVisuals[eventIndex*5+index], seed=eventIndex*5+index+1, targetLength=seasonalLengths[eventIndex*5+index];
  return {id:`${event.id}-${index+1}`,name,subtitle:`${event.name} · ${name}`,hue:(parseInt(event.color.slice(1),16)+index*17)%360,width:5.7+(index%4)*.35,route:scaleRouteToLength(putStartOnStraight(authoredRoute(seed)),targetLength),targetLength,menuArt:`/assets/season-${event.id}.png`,eventId:event.id,seasonal:true,visual,routeSeed:seed};
}));
export const seasonalChairs = seasonalEvents.map(event => ({...event.chair}));
export const seasonalPilots = seasonalEvents.map(event => ({...event.pilot,rarity:'seasonal',portrait:null}));
export const seasonalLogos = seasonalEvents.map(event => ({...event.logo,achievement:`season-${event.id}-10`}));
export const seasonalCups = seasonalEvents.map(event => ({id:`season-${event.id}`,name:`Event ${event.name}`,trackIds:seasonalTracks.filter(track=>track.eventId===event.id).map(track=>track.id),seasonal:true,eventId:event.id}));
