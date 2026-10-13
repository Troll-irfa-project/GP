import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItems,resetRacerItems,useItem,tickItems,collectItems,raceItems,rollRaceItem } from '../public/items.js';
import { createCourse,spawnRacer,stepRace,pointAt,nearest } from '../public/racing.js';
import { chairs,tracks } from '../public/catalog.js';
import { driveSpeed,topSpeed,SnapshotBuffer } from '../public/motion.js';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';

const course=createCourse(tracks.find(t=>t.id==='coast'));
function racer(i=0){const r={id:'r'+i,name:'Test '+i,chairId:'comet',pilotId:'maya',input:{gas:true},isBot:false};spawnRacer(r,i,course);resetRacerItems(r);return r;}
function give(r,id){r.item=id;r.itemCharges=id==='viagra-box'?3:1;r.itemCooldown=0;}
function advance(racers,world,seconds){for(let i=0;i<Math.ceil(seconds*60);i++){tickItems(racers,course,world,1/60,i/60);stepRace(racers,course,chairs,1/60,3,i/60);}}
function seed(db,id='test'){db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'fixture');return id;}
function client(db,manager,id){const messages=[],c={user:db.profile(id),ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};manager.add(c);return c;}

test('weighted loot matches requested percentages and exact cumulative boundaries',()=>{
  const expected={viagra:30,ladder:30,lexomil:5,'viagra-box':10,revolver:20,round:5};
  assert.deepEqual(Object.fromEntries(raceItems.map(i=>[i.id,i.dropChance])),expected);
  assert.equal(raceItems.reduce((n,i)=>n+i.dropChance,0),100);
  const counts=Object.fromEntries(raceItems.map(i=>[i.id,0]));
  for(let i=0;i<10000;i++)counts[rollRaceItem(()=>(i+.5)/10000).id]++;
  assert.deepEqual(counts,Object.fromEntries(Object.entries(expected).map(([id,p])=>[id,p*100])));
  const boundaries=[0,.30,.60,.65,.75,.95];
  boundaries.forEach((value,index)=>{
    assert.equal(rollRaceItem(()=>value).id,raceItems[index].id);
    if(index)assert.equal(rollRaceItem(()=>value-1e-9).id,raceItems[index-1].id);
  });
  assert.equal(rollRaceItem(()=>1-Number.EPSILON).id,'round');
});

test('12 swept mystery boxes, all six loots, one inventory slot, cooldown and server respawn',()=>{
  for(let kind=0;kind<6;kind++){
    const world=createItems(course,true),r=racer(),other=racer(1),box=world.boxes[0];assert.equal(world.boxes.length,12);
    Object.assign(r,{x:box.x+4,z:box.z});Object.assign(other,{x:box.x+4,z:box.z});
    collectItems([r,other],course,world,new Map([[r.id,{x:box.x-3,z:box.z}],[other.id,{x:box.x-8,z:box.z}]]),1,()=>[.15,.45,.625,.70,.85,.975][kind]);
    assert.equal(r.item,raceItems[kind].id);assert.equal(other.item,null);assert.equal(r.itemStats.boxes,1);assert.equal(box.respawn,8);
    assert.equal(r.itemCharges,kind===3?3:1);
    r.x=world.boxes[1].x;r.z=world.boxes[1].z;collectItems([r],course,world,new Map(),2);
    assert.equal(r.itemStats.boxes,1,'full inventory does not consume another box');
    tickItems([r,other],course,world,8,10);assert.equal(box.respawn,0);
  }
});

test('Viagra is exactly +20% Vmax for 3 seconds, three charges are separate and boosts do not stack',()=>{
  const r=racer(),world=createItems(course,true),chair=chairs[0];give(r,'viagra-box');
  for(let charge=2;charge>=0;charge--){
    assert.ok(useItem(r,[r],course,world,0));assert.equal(r.itemBoost,3);assert.equal(r.itemCharges,charge);
    assert.equal(useItem(r,[r],course,world,0),false);
    let speed=topSpeed(chair);for(let i=0;i<180;i++)speed=driveSpeed(speed,{gas:true},chair,1,0,1,1/60,null,r.itemBoost,0);
    assert.ok(Math.abs(speed-topSpeed(chair)*1.2)<1e-8);
    tickItems([r],course,world,3,3);assert.equal(r.itemBoost,0);
  }
  assert.equal(r.item,null);assert.equal(r.itemStats.uses,3);
  let speed=0;for(let i=0;i<600;i++)speed=driveSpeed(speed,{gas:true},chair,1,1,1,1/60,null,3,0);
  assert.ok(Math.abs(speed-topSpeed(chair)*1.35)<1e-8,'road turbo and item do not multiply');
});

test('ladder spans 75% of road, sits behind owner and stops only first crossing with 360-degree spin',()=>{
  const r=racer(),a=racer(1),b=racer(2),world=createItems(course,true);
  Object.assign(r,pointAt(course,20),{lastAlong:20});give(r,'ladder');assert.ok(useItem(r,[r,a,b],course,world,0));
  const trap=world.traps[0],before=pointAt(course,14),after=pointAt(course,20);
  assert.equal(trap.halfWidth*2,course.width*2*.75);assert.ok(Math.hypot(trap.x-r.x,trap.z-r.z)>2.9);
  Object.assign(a,after,{speed:24});Object.assign(b,after,{speed:24});
  collectItems([a,b],course,world,new Map([[a.id,before],[b.id,pointAt(course,11)]]),1);
  assert.equal(a.speed,0);assert.equal(a.stun,.5);assert.equal(a.spin,.5);assert.equal(b.stun,0);assert.equal(world.traps.length,0);
  const location={x:a.x,z:a.z};stepRace([a],course,chairs,1/60);assert.equal(a.x,location.x);assert.equal(a.z,location.z);
  advance([a],world,.49);assert.equal(a.speed,0);advance([a],world,.1);assert.ok(a.speed>0&&a.speed<2);
  const buffer=new SnapshotBuffer(0),out={};
  for(const [time,spin]of [[0,.5],[250,.25],[500,0]])buffer.push({lobby:{raceId:1},serverTime:time,racers:[{...a,spin}]},time);
  buffer.sample(a.id,250,out);assert.equal(out.spin,.25);assert.equal((1-out.spin/.5)*Math.PI*2,Math.PI);
  buffer.sample(a.id,500,out);assert.equal(out.spin,0);
});

test('revolver auto-targets ranking predecessor, consumes one bullet and holds target for one second',()=>{
  const racers=Array.from({length:4},(_,i)=>racer(i)),world=createItems(course,true);
  racers.forEach((r,i)=>r.progress=4-i);const r=racers[2];give(r,'revolver');
  assert.ok(useItem(r,racers,course,world,0));assert.equal(racers[1].stun,1);assert.equal(racers[0].stun,0);assert.equal(racers[3].stun,0);assert.equal(r.item,null);assert.equal(r.itemStats.hits,1);
  advance([racers[1]],world,.9);assert.equal(racers[1].speed,0);advance([racers[1]],world,.2);assert.ok(racers[1].speed>0&&racers[1].speed<2);
  give(racers[0],'revolver');assert.equal(useItem(racers[0],racers,course,world,2),false);assert.equal(racers[0].itemCharges,1);
  racers[0].finished=true;racers[0].finishTime=1;racers[1].finished=true;racers[1].finishTime=2;give(r,'revolver');assert.equal(useItem(r,racers,course,world,3),false);
});

test('Lexomil lasts 10s at minus 20% Vmax; blur is linear from 10s to 5s and excludes caster',()=>{
  const racers=Array.from({length:12},(_,i)=>racer(i)),world=createItems(course,true),r=racers[5];racers.forEach((r,i)=>r.progress=12-i);
  give(r,'lexomil');useItem(r,racers,course,world,0);
  racers.forEach(other=>assert.equal(other.slow,other===r?0:10));
  let speed=topSpeed(chairs[0]);for(let i=0;i<120;i++)speed=driveSpeed(speed,{gas:true},chairs[0],1,0,1,1/60,null,0,10);
  assert.ok(Math.abs(speed-topSpeed(chairs[0])*.8)<1e-8);
  give(r,'round');useItem(r,racers,course,world,0);
  racers.forEach((other,i)=>assert.equal(other.blur,other===r?0:10-5*i/11));
  tickItems(racers,course,world,10,10);assert.ok(racers.every(r=>r.blur===0&&r.slow===0));
});

test('room option host-only, immutable in race/cup; no objects when disabled; new round resets effects',()=>{
  const db=new Accounts(':memory:');try{
    const manager=new RoomManager(db),a=client(db,manager,seed(db,'a')),b=client(db,manager,seed(db,'b'));
    manager.join(a,{roomId:'room-1'});manager.join(b,{roomId:'room-1'});const room=manager.rooms.get('room-1');
    manager.configure(b,{itemsEnabled:true});assert.equal(room.itemsEnabled,false);
    manager.configure(a,{itemsEnabled:'true'});assert.equal(room.itemsEnabled,false);
    give(a.racer,'lexomil');assert.equal(useItem(a.racer,room.racers,course,room.items,0),false);
    manager.configure(a,{itemsEnabled:true,mode:'tournament'});assert.equal(room.items.boxes.length,12);
    manager.start(a);manager.configure(a,{itemsEnabled:false});assert.equal(room.itemsEnabled,true);
    manager.tick(3.1);give(a.racer,'lexomil');manager.handle(a,{type:'use_item',target:b.racer.id,item:'revolver'});manager.tick(1/60);
    assert.equal(b.racer.slow,10);assert.equal(b.racer.stun,0,'client cannot choose effect or target');
    assert.equal(manager.rooms.get('room-2').racers[0].slow,0,'other rooms unaffected');
    room.phase='results';manager.configure(a,{itemsEnabled:false});assert.equal(room.itemsEnabled,true);
    manager.start(a);assert.equal(room.itemsEnabled,true);assert.equal(room.items.traps.length,0);assert.ok(room.racers.every(r=>r.item===null&&r.slow===0&&r.blur===0));
    manager.leave(a);manager.leave(b);manager.career(a,{difficulty:'50'});manager.configure(a,{itemsEnabled:true});assert.equal(manager.rooms.get(a.roomId).itemsEnabled,true);
  }finally{db.close();}
});

test('separate records, authoritative item achievements, legacy defaults and idempotent rewards',()=>{
  const db=new Accounts(':memory:');try{
    const id=seed(db);const result={userId:id,trackId:'coast',time:80,bestLap:25,place:1,difficulty:'150'};
    db.db.prepare('INSERT INTO race_results(race_id,user_id,track_id,time_ms,place,created_at) VALUES(?,?,?,?,?,?)').run('old',id,'coast',90000,1,0);
    assert.equal(db.economy.metrics(id).pureWins,0,'legacy wins do not silently unlock new achievements');
    for(let i=0;i<10;i++){
      db.recordResult({...result,raceId:'pure'+i});
      db.recordResult({...result,raceId:'items'+i,time:70,bestLap:20,itemsEnabled:true,itemStats:{boxes:10,uses:10,hits:5}});
    }
    assert.equal(db.leaderboard('coast').races[0].timeMs,80000);assert.equal(db.leaderboard('coast',true).races[0].timeMs,70000);
    assert.equal(db.leaderboard('coast').laps[0].timeMs,25000);assert.equal(db.leaderboard('coast',true).laps[0].timeMs,20000);
    for(let i=0;i<3;i++)for(const itemsEnabled of [true,false])db.recordTournament({id:'cup'+i+itemsEnabled,userId:id,difficulty:'150',mode:'tournament',place:1,points:65,itemsEnabled});
    const p=db.profile(id).progression;
    for(const a of ['items-winner','pure-winner','items-cup','pure-cup','box-collector','item-marksman'])assert.ok(p.earned.includes(a),a);
    db.recordResult({...result,raceId:'items0',itemsEnabled:true,itemStats:{boxes:999,hits:999}});
    assert.deepEqual(db.profile(id).progression,p);assert.equal(p.metrics.itemBoxes,100);assert.equal(p.metrics.itemHits,50);
  }finally{db.close();}
});

for(const track of tracks)test('12 bots loot and use items, then finish on '+track.id,()=>{
  const c=createCourse(track),world=createItems(c,true),racers=Array.from({length:12},(_,i)=>{
    const r=racer(i);r.chairId=chairs[i%5].id;r.isBot=true;r.skill=1.45;r.aiDifficulty='150';spawnRacer(r,i,c);return r;
  });
  let seed=31;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let t=0;t<300*60&&!racers.every(r=>r.finished);t++){
    tickItems(racers,c,world,1/60,t/60);
    stepRace(racers,c,chairs,1/60,3,t/60,previous=>collectItems(racers,c,world,previous,t/60,random));
  }
  assert.ok(racers.every(r=>r.finished),'all bots finish');assert.ok(racers.reduce((n,r)=>n+r.itemStats.boxes,0)>10);assert.ok(racers.reduce((n,r)=>n+r.itemStats.uses,0)>10);
  assert.ok(racers.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.z)&&r.recoveryCount<=1));
  for(const box of world.boxes)assert.ok(nearest(c,box.x,box.z).distance<c.width);
});
