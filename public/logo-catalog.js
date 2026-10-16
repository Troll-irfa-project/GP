// Ordered prestige ladder. Each later tier includes every earlier requirement.
export const logos = [
  ['looser','Looser','races',1,'Terminer 1 course.'],
  ['cocacola','Coca-Cola','races',5,'Terminer 5 courses.'],
  ['shell','Shell','podiums',5,'Obtenir 5 podiums.'],
  ['renault','Renault','wins',5,'Gagner 5 courses.'],
  ['gulf','Gulf','wins',15,'Gagner 15 courses.'],
  ['handicap','Handicap','winningCircuits',5,'Gagner sur 5 circuits différents.'],
  ['worldcup','Coupe du monde','cups',3,'Gagner 3 tournois.'],
  ['mercedes','Mercedes','expertWins',15,'Gagner 15 courses en 150 ou 200cc.'],
  ['redbull','Red Bull','eliteWins',20,'Gagner 20 courses en 200cc.'],
  ['avengers','Avengers','career',4,'Remporter les 4 catégories de la carrière Originale.'],
  ['ferrari','Ferrari','perfectCups',3,'Réussir 3 grands chelems en tournoi 150 ou 200cc.'],
  ['leagueoflegends','League of Legends','horizons200',1,'Remporter la carrière Horizons 200cc.'],
  ['ricard','Ricard','eliteCups',15,'Gagner 15 tournois en 200cc.'],
].map(([id,name,metric,target,objective],index)=>({id,name,metric,target,objective,tier:index+1,achievement:'logo-'+id,art:'/assets/logos/'+id+'.svg'}));

export const logoAchievements=logos.map((logo,index)=>({
  id:logo.achievement,name:'Écusson '+logo.name,
  description:logo.objective+(index?' Valider aussi les paliers précédents.':'')+' Offre directement le logo '+logo.name+', sans achat.',
  goal:index+1,coins:100+index*75,xp:50+index*25,logo:logo.id,
  requirements:logos.slice(0,index+1).map(l=>({metric:l.metric,goal:l.target,label:l.objective}))
}));
export const ownsLogo=(progression,id)=>id===null||allLogos.some(l=>l.id===id&&progression?.earned?.includes(l.achievement));
export const validColor=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
export const colorSwatches=['#ff6b52','#ed2851','#ffac35','#ffd449','#74d464','#21d9bd','#70a6ff','#4262df','#9b78ff','#ff5299','#f6f3e9','#252b38'];
export const bonusLogos=[{id:'watch',name:'Montre Chrono',metric:'timeTrialGold',target:1,objective:'Gagner 1 médaille d’or en contre-la-montre.',tier:14,achievement:'logo-watch',art:'/assets/logos/watch.svg'}];
export const bonusLogoAchievements=bonusLogos.map(logo=>({id:logo.achievement,name:'Écusson '+logo.name,description:logo.objective+' Offre directement le logo '+logo.name+', sans achat.',goal:logo.target,coins:250,xp:150,logo:logo.id,requirements:[{metric:logo.metric,goal:logo.target,label:logo.objective}]}));
export const seasonalLogoAchievements=seasonalLogos.map(logo=>({id:logo.achievement,name:'Écusson '+logo.name,description:'Terminer les 10 succès de l’événement saisonnier associé. Offre directement ce logo.',goal:1,coins:600,xp:1200,logo:logo.id,requirements:[{metric:`eventWins-${logo.id}`,goal:10,label:'Succès de l’événement'}]}));
export const allLogos=[...logos,...bonusLogos,...seasonalLogos];
export const allLogoAchievements=[...logoAchievements,...bonusLogoAchievements,...seasonalLogoAchievements];
import { seasonalLogos } from './seasonal.js';

