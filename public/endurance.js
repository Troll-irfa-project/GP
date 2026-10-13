// Shared endurance rules; only the room server may mutate tyre/QTE state.
export const ENDURANCE_LAPS=15, ENDURANCE_LIMIT=1800, ENDURANCE_GRACE=180;
export const PIT_KEYS=['arrowup','arrowright','arrowdown','arrowleft'];
export const tyreLoss=age=>Math.min(80,Math.max(0,age)*(Math.max(0,age)+1)/2);
export const tyreFactor=r=>r.endurance?1-tyreLoss(r.tyreAge||0)/100:1;
export function pitZone(course){
  const f=course.finishGate,lane=course.width-1.5;
  return {x:f.x+f.tx*16-f.tz*lane,z:f.z+f.tz*16+f.tx*lane,tx:f.tx,tz:f.tz,halfLength:8,halfWidth:1.4,lane,along:16};
}
export function resetEndurance(r,enabled){
  r.endurance=enabled;
  for(const key of ['tyreAge','pitRequested','pit','pitSerial','pitStops','perfectStops','pitNoticeUntil'])delete r[key];
  if(enabled)Object.assign(r,{tyreAge:0,pitRequested:false,pit:null,pitSerial:0,pitStops:0,perfectStops:0,pitNoticeUntil:0});
}
export function enterPit(r,course,time,random=Math.random){
  if(!r.endurance||r.finished||r.pit||!r.pitRequested||!r.tyreAge||r.stun>0)return false;
  const zone=pitZone(course),dx=r.x-zone.x,dz=r.z-zone.z;
  if(Math.abs(dx*zone.tx+dz*zone.tz)>zone.halfLength||Math.abs(dx*-zone.tz+dz*zone.tx)>zone.halfWidth)return false;
  const sequence=Array.from({length:r.tyreAge},()=>PIT_KEYS[Math.min(3,Math.floor(random()*4))]);
  r.pit={id:++r.pitSerial,sequence,index:0,errors:0,started:time,nextKeyAt:time+.15,ready:false};
  r.speed=0;r.boost=0;r.itemBoost=0;r.drift=0;r.wasDrifting=false;r.input={};r.itemUseQueued=false;
  return true;
}
export function pitKey(r,key,id,index,time){
  const pit=r.pit;
  if(!pit||r.finished||pit.ready||id!==pit.id||index!==pit.index||time<pit.nextKeyAt||!PIT_KEYS.includes(key))return false;
  if(key!==pit.sequence[pit.index]){pit.errors++;pit.index=0;pit.nextKeyAt=time+.4;return false;}
  pit.index++;pit.nextKeyAt=time+.15;
  if(pit.index===pit.sequence.length)pit.ready=true;
  return true;
}
export function tickEndurance(racers,dt,time){
  for(const r of racers){
    if(!r.endurance||r.finished)continue;
    if(r.isBot&&!r.pit&&r.tyreAge>=4+(Number(r.id.replace(/\D/g,''))||0)%3&&r.completedLaps<14)r.pitRequested=true;
    if(!r.pit)continue;
    r.speed=0;r.boost=0;r.itemBoost=0;r.itemUseQueued=false;
    if(r.isBot&&time>=r.pit.nextKeyAt){pitKey(r,r.pit.sequence[r.pit.index],r.pit.id,r.pit.index,time);r.pit.nextKeyAt=time+.5;}
    if(r.pit.ready&&time-r.pit.started>=1.2){
      r.perfectStops+=r.pit.errors===0?1:0;r.pitStops++;r.tyreAge=0;r.pit=null;r.pitRequested=false;r.input={};r.pitNoticeUntil=time+3;
      r.ai.stuck=0;r.ai.bestDistance=r.distance;
    }
  }
}
