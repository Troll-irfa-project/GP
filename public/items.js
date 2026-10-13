// Server-authoritative arcade objects. Names describe fictional game effects only.
import { pointAt, nearest, compareRacers } from './racing.js';

export const raceItems = [
  {id:'viagra',dropChance:30,name:'Viagra',icon:'↗',color:'#38bfff',description:'Vmax +20 % pendant 3 s. Une utilisation.'},
  {id:'ladder',dropChance:30,name:'Échelle',icon:'≡',color:'#ffce55',description:'Piège derrière toi : arrêt et tête-à-queue de 0,5 s.'},
  {id:'lexomil',dropChance:5,name:'Lexomil',icon:'−20%',color:'#bd98ff',description:'Vmax des autres pilotes −20 % pendant 10 s.'},
  {id:'viagra-box',dropChance:10,name:'Boîte de Viagra',icon:'↗×3',color:'#53e8e4',description:'Trois boosts de 3 s, à activer séparément.'},
  {id:'revolver',dropChance:20,name:'Revolver',icon:'◎',color:'#ff947e',description:'Une munition : le pilote classé juste devant est arrêté 1 s.'},
  {id:'round',dropChance:5,name:'Tournée générale',icon:'◉',color:'#ff84cd',description:'Flou chez les autres : 10 s pour le premier, 5 s pour le dernier.'},
];
export function rollRaceItem(random=Math.random) {
  const roll=random()*100;
  let cumulative=0;
  for(const item of raceItems){cumulative+=item.dropChance;if(roll<cumulative)return item;}
  return raceItems.at(-1);
}
export const ITEM_BOOST_SECONDS=3, BOX_RESPAWN_SECONDS=8;

export function createItems(course,enabled=false) {
  const boxes=[];
  if(enabled)for(const fraction of [.09,.34,.60,.85])for(const lane of [-.52,0,.52]) {
    const p=pointAt(course,course.total*fraction,course.width*lane);
    boxes.push({id:'box-'+boxes.length,x:p.x,z:p.z,respawn:0});
  }
  return {enabled,boxes,traps:[],shots:[],serial:0};
}
export function resetRacerItems(r) {
  Object.assign(r,{item:null,itemCharges:0,itemBoost:0,slow:0,blur:0,stun:0,spin:0,
    itemCooldown:0,pickupCooldown:0,itemUseQueued:false,itemStats:{boxes:0,uses:0,hits:0},itemNotice:null});
}
function notice(r,text,time){r.itemNotice={text,until:time+2.5};}
function stop(r,seconds,spin=false) {
  r.stun=Math.max(r.stun,seconds);r.speed=0;r.boost=0;r.itemBoost=0;
  r.drift=0;r.wasDrifting=false;r.spin=spin?.5:0;
}
export function useItem(r,racers,course,world,time) {
  if(!world?.enabled || r.finished || r.pit || r.stun>0 || !r.item || r.itemCharges<1 || r.itemCooldown>0)return false;
  const sorted=[...racers].sort(compareRacers),position=sorted.indexOf(r);
  const target=position>0?sorted[position-1]:null;
  if(r.item==='revolver' && (!target || target.finished || target.pit))return false;
  if((r.item==='viagra'||r.item==='viagra-box') && r.itemBoost>0)return false;
  const item=raceItems.find(i=>i.id===r.item);if(!item)return false;
  if(r.item==='viagra'||r.item==='viagra-box')r.itemBoost=ITEM_BOOST_SECONDS;
  if(r.item==='ladder') {
    const n=nearest(course,r.x,r.z,r.lastAlong),p=pointAt(course,n.along-3);
    const ownLane=(r.x-n.x)*-n.tz+(r.z-n.z)*n.tx;
    const lane=Math.max(-course.width*.25,Math.min(course.width*.25,ownLane));
    world.traps.push({id:'ladder-'+(++world.serial),owner:r.id,x:p.x-p.tz*lane,z:p.z+p.tx*lane,tx:p.tx,tz:p.tz,halfWidth:course.width*.75,life:30});
    if(world.traps.length>24)world.traps.shift();
  }
  if(r.item==='lexomil')for(const other of racers)if(other!==r&&!other.finished&&!other.pit){other.slow=10;notice(other,'LEXOMIL · VMAX −20 %',time);}
  if(r.item==='round')sorted.forEach((other,index)=>{if(other!==r&&!other.finished&&!other.pit){other.blur=10-5*index/Math.max(1,sorted.length-1);notice(other,'TOURNÉE GÉNÉRALE · VISION TROUBLE',time);}});
  if(r.item==='revolver') {
    stop(target,1);r.itemStats.hits++;notice(target,'TOUCHÉ · ARRÊT 1 S',time);
    world.shots.push({id:++world.serial,x:r.x,z:r.z,targetX:target.x,targetZ:target.z,life:.4});
  }
  r.itemStats.uses++;r.itemCooldown=.4;notice(r,item.name.toUpperCase()+' !',time);
  if(--r.itemCharges===0)r.item=null;
  return true;
}
export function tickItems(racers,course,world,dt,time) {
  if(!world?.enabled)return;
  for(const box of world.boxes)box.respawn=Math.max(0,box.respawn-dt);
  world.traps=world.traps.filter(t=>(t.life-=dt)>0);
  world.shots=world.shots.filter(s=>(s.life-=dt)>0);
  for(const r of racers) {
    for(const key of ['itemBoost','slow','blur','stun','spin','itemCooldown','pickupCooldown'])r[key]=Math.max(0,(r[key]||0)-dt);
  }
  for(const r of racers) {
    if(r.finished){r.itemUseQueued=false;continue;}
    if(r.isBot && r.item && r.itemCooldown===0) {
      const ready=time>=(r.ai.nextItemUse||0);
      if(ready){useItem(r,racers,course,world,time);r.ai.nextItemUse=time+.8;}
    } else if(r.itemUseQueued)useItem(r,racers,course,world,time);
    r.itemUseQueued=false;
  }
}
// Swept circle/box collision: fast karts cannot tunnel through pickups or traps.
function sweptBox(before,after,box,halfX,halfZ) {
  const dx=after.x-before.x,dz=after.z-before.z;
  let lo=0,hi=1;
  for(const [start,delta,center,half] of [[before.x,dx,box.x,halfX],[before.z,dz,box.z,halfZ]]) {
    if(Math.abs(delta)<1e-9){if(Math.abs(start-center)>half)return null;continue;}
    const a=(center-half-start)/delta,b=(center+half-start)/delta;
    lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return null;
  }
  return lo;
}
export function collectItems(racers,course,world,previous,time,random=Math.random) {
  if(!world?.enabled)return;
  const active=racers.filter(r=>!r.finished&&!r.pit);
  for(const box of world.boxes) {
    if(box.respawn>0)continue;
    const hits=active.filter(r=>!r.item&&r.pickupCooldown===0&&r.stun===0).map(r=>({r,t:sweptBox(previous.get(r.id)||r,r,box,1.8,1.8)})).filter(h=>h.t!==null).sort((a,b)=>a.t-b.t);
    if(!hits.length)continue;
    const r=hits[0].r,item=rollRaceItem(random);
    r.item=item.id;r.itemCharges=item.id==='viagra-box'?3:1;r.pickupCooldown=1;r.itemStats.boxes++;
    r.ai.nextItemUse=time+1;box.respawn=BOX_RESPAWN_SECONDS;notice(r,item.name.toUpperCase()+' · A POUR UTILISER',time);
  }
  world.traps=world.traps.filter(trap=>{
    const local=p=>({x:(p.x-trap.x)*-trap.tz+(p.z-trap.z)*trap.tx,z:(p.x-trap.x)*trap.tx+(p.z-trap.z)*trap.tz});
    const hits=active.filter(r=>r.stun===0).map(r=>({r,t:sweptBox(local(previous.get(r.id)||r),local(r),{x:0,z:0},trap.halfWidth+.65,.9)})).filter(h=>h.t!==null).sort((a,b)=>a.t-b.t);
    if(!hits.length)return true;
    const target=hits[0].r,before=previous.get(target.id)||target;
    target.x=before.x+(target.x-before.x)*hits[0].t;target.z=before.z+(target.z-before.z)*hits[0].t;
    stop(target,.5,true);notice(target,'ÉCHELLE · TÊTE-À-QUEUE !',time);
    const owner=racers.find(r=>r.id===trap.owner);if(owner&&owner!==target)owner.itemStats.hits++;
    return false;
  });
}
