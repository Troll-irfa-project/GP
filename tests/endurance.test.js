import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chairs,tracks} from '../public/catalog.js';
import {createCourse,spawnRacer,stepRace,pointAt,updateLapProgress,nearest} from '../public/racing.js';
import {createItems,resetRacerItems,tickItems,collectItems,useItem} from '../public/items.js';
import {resetEndurance,tyreLoss,tyreFactor,pitZone,enterPit,pitKey,tickEndurance} from '../public/endurance.js';
import {driveSpeed,topSpeed} from '../public/motion.js';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';
import {raceReward,shopItems} from '../public/progression.js';

const course=createCourse(tracks.find(t=>t.id==='coast'));
function racer(i=0,c=course){const r={id:'r'+i,name:'Racer '+i,chairId:chairs[i%5].id,pilotId:'maya',input:{gas:true},isBot:false,skill:1.45,aiDifficulty:'150'};spawnRacer(r,i,c);resetRacerItems(r);resetEndurance(r,true);return r;}
function user(db,id){db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'fixture');return id;}
function client(db,m,id){const messages=[],c={user:db.profile(id),ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};m.add(c);return c;}

test('triangular tyre loss, 80% safety cap and exact reduced Vmax without altering acceleration',()=>{
  assert.deepEqual(Array.from({length:7},(_,i)=>tyreLoss(i)),[0,1,3,6,10,15,21]);assert.equal(tyreLoss(15),80);
  const r=racer();r.tyreAge=4;assert.equal(tyreFactor(r),.9);
  let speed=0;for(let i=0;i<600;i++)speed=driveSpeed(speed,{gas:true},chairs[0],1,0,1,1/60,null,0,0,tyreFactor(r));
  assert.ok(Math.abs(speed-topSpeed(chairs[0])*.9)<1e-8);r.endurance=false;assert.equal(tyreFactor(r),1);
});

test('wear increases only on validated full laps, never the starting crossing or reverse crossing',()=>{
  const r=racer(),f=course.finishGate;
  const before={x:f.x-f.tx*.1,z:f.z-f.tz*.1};r.x=f.x+f.tx*.1;r.z=f.z+f.tz*.1;r.speed=12;
  updateLapProgress(r,course,before,1/60,15,1);assert.equal(r.tyreAge,0);assert.equal(r.completedLaps,0);
  for(let i=1;i<=15;i++){r.nextCheckpoint=0;r.x=f.x+f.tx*.1;r.z=f.z+f.tz*.1;updateLapProgress(r,course,before,1/60,15,1+i*25);assert.equal(r.tyreAge,i);assert.equal(r.finished,i===15);}
  const reverse=racer();reverse.nextCheckpoint=0;reverse.x=before.x;reverse.z=before.z;updateLapProgress(reverse,course,{x:f.x+.1,z:f.z},1/60,15,2);assert.equal(reverse.tyreAge,0);
});

test('pit requires request, worn tyres and actual lane; QTE length, errors, replay protection and new tyres',()=>{
  const r=racer(),zone=pitZone(course);r.tyreAge=5;r.pitRequested=true;
  assert.equal(enterPit(r,course,0),false);Object.assign(r,{x:zone.x,z:zone.z});
  assert.ok(enterPit(r,course,0,()=>0));assert.equal(r.pit.sequence.length,5);assert.equal(r.speed,0);
  const pitId=r.pit.id;assert.equal(pitKey(r,'arrowup',pitId,0,0),false,'minimum key interval');
  assert.ok(pitKey(r,'arrowup',pitId,0,.2));assert.equal(pitKey(r,'arrowup',pitId,0,.4),false,'stale index');
  assert.equal(pitKey(r,'arrowdown',pitId,1,.5),false);assert.equal(r.pit.index,0);assert.equal(r.pit.errors,1);
  const before={x:r.x,z:r.z};stepRace([r],course,chairs,.1,15,1);assert.equal(r.x,before.x);assert.equal(r.z,before.z);
  for(let i=0;i<5;i++)assert.ok(pitKey(r,'arrowup',pitId,i,1+i*.2));
  tickEndurance([r],.1,2);assert.equal(r.tyreAge,0);assert.equal(r.pit,null);assert.equal(r.speed,0);assert.equal(r.pitStops,1);assert.equal(r.perfectStops,0);
  assert.equal(pitKey(r,'arrowup',pitId,0,3),false);assert.equal(enterPit(r,course,3),false);
  r.tyreAge=1;r.pitRequested=true;assert.ok(enterPit(r,course,3,()=>0));
  pitKey(r,'arrowup',r.pit.id,0,3.2);tickEndurance([r],.1,3.3);assert.ok(r.pit,'at least 1.2s of service');tickEndurance([r],.1,4.3);assert.equal(r.perfectStops,1);
});

test('pit is immune to weapons, cannot use loot and resets when returning to sprint',()=>{
  const r=racer(),other=racer(1),world=createItems(course,true),zone=pitZone(course);r.tyreAge=2;r.pitRequested=true;Object.assign(r,{x:zone.x,z:zone.z});enterPit(r,course,0);
  other.item='lexomil';other.itemCharges=1;useItem(other,[r,other],course,world,1);assert.equal(r.slow,0);
  r.item='viagra';r.itemCharges=1;assert.equal(useItem(r,[r,other],course,world,1),false);
  resetEndurance(r,false);assert.equal(r.pit,undefined);assert.equal(r.tyreAge,undefined);assert.equal(tyreFactor(r),1);
});

test('host endurance mode, track choice, 15 laps, longer deadline, QTE validation and relay',()=>{
  const db=new Accounts(':memory:');try{
    const m=new RoomManager(db),a=client(db,m,user(db,'a')),b=client(db,m,user(db,'b'));m.join(a,{roomId:'room-1'});m.join(b,{roomId:'room-1'});
    const room=m.rooms.get('room-1');m.configure(b,{mode:'endurance'});assert.equal(room.mode,'race');
    m.configure(a,{mode:'endurance',itemsEnabled:true,trackId:'garden'});assert.equal(room.trackId,'garden');assert.equal(room.laps,15);m.start(a);assert.equal(room.cup,null);m.tick(3.1);
    room.raceTime=301;m.tick(1/60);assert.equal(room.phase,'racing','not the sprint five-minute cap');
    const c=createCourse(tracks.find(t=>t.id==='garden')),zone=pitZone(c);a.racer.tyreAge=3;Object.assign(a.racer,{x:zone.x,z:zone.z});
    m.handle(a,{type:'pit_request',raceId:'forged'});assert.equal(a.racer.pitRequested,false);
    m.handle(a,{type:'pit_request',raceId:room.raceId});m.tick(1/60);assert.equal(a.racer.pit.sequence.length,3);
    const pit=a.racer.pit;m.handle(a,{type:'pit_key',raceId:room.raceId,stopId:pit.id,index:999,key:pit.sequence[0]});assert.equal(pit.index,0);
    const departed=a.racer;m.leave(a);assert.equal(departed.isBot,true);assert.ok(departed.pit);
    for(let i=0;i<200;i++)m.tick(1/60);assert.equal(departed.pit,null);assert.equal(departed.tyreAge,0);
    assert.equal(m.host(room),b);
    b.racer.finished=true;b.racer.finishTime=room.raceTime;b.racer.progress=15;b.racer.bestLapTime=20;m.tick(1/60);assert.ok(room.deadline-room.raceTime>179);
    assert.equal(db.db.prepare('SELECT race_mode FROM race_results WHERE user_id=?').get('b').race_mode,'endurance');
  }finally{db.close();}
});

test('endurance records isolated in both item modes; rewards, achievements and paid unlocks idempotent',()=>{
  const db=new Accounts(':memory:');try{
    const id=user(db,'endurance'),base={userId:id,trackId:'coast',place:1,time:300,bestLap:18,difficulty:'200'};
    db.recordResult({...base,raceId:'sprint',time:60});
    const before=db.profile(id).progression;db.recordResult({...base,raceId:'e0',mode:'endurance',pitStops:2,perfectStops:2});
    assert.equal(db.leaderboard('coast').races[0].timeMs,60000);assert.equal(db.leaderboard('coast',false,'endurance').races[0].timeMs,300000);
    assert.equal(db.leaderboard('coast',true,'endurance').races.length,0);
    assert.equal(db.profile(id).progression.coins-before.coins,raceReward(1,'200','endurance').coins+150);
    assert.equal(raceReward(1,'200','endurance').coins,raceReward(1,'200').coins*4);
    for(let i=1;i<10;i++)db.recordResult({...base,raceId:'e'+i,trackId:tracks[i%5].id,mode:'endurance',itemsEnabled:i%2===1,pitStops:2,perfectStops:2});
    const p=db.profile(id).progression;for(const a of ['endurance-debut','endurance-regular','endurance-winner','endurance-pure','endurance-chaos','pit-perfect','endurance-master'])assert.ok(p.earned.includes(a),a);
    db.recordResult({...base,raceId:'e0',mode:'endurance',pitStops:999,perfectStops:999});assert.deepEqual(db.profile(id).progression,p);
    db.economy.grant(id,'test-funds','Test fixture',{coins:50000,xp:75000});
    for(const item of shopItems.filter(i=>['nora','sacha','stint','relay'].includes(i.target)))db.economy.buy(id,item.id);
    const m=new RoomManager(db),a=client(db,m,id);m.join(a,{roomId:'room-1',chairId:'stint',pilotId:'nora'});assert.equal(a.racer.chairId,'stint');
    assert.equal(db.profile(id).progression.metrics.enduranceFinishes,10);
  }finally{db.close();}
});

for(const track of tracks)for(const objects of [false,true])test(`endurance bots finish 15 laps and service tyres: ${track.id}, objects=${objects}`,()=>{
  const c=createCourse(track),world=createItems(c,objects),racers=Array.from({length:12},(_,i)=>{const r=racer(i,c);r.isBot=true;return r;});
  const zone=pitZone(c);assert.ok(nearest(c,zone.x,zone.z).distance<c.width);
  let seed=25;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let t=0;t<1800*30&&!racers.every(r=>r.finished);t++){
    tickEndurance(racers,1/30,t/30);tickItems(racers,c,world,1/30,t/30);
    stepRace(racers,c,chairs,1/30,15,t/30,previous=>{racers.forEach(r=>enterPit(r,c,t/30,random));collectItems(racers,c,world,previous,t/30,random);});
  }
  assert.ok(racers.every(r=>r.finished),JSON.stringify(racers.map(r=>({id:r.id,lap:r.lap,pit:r.pit,age:r.tyreAge}))));
  assert.ok(racers.every(r=>r.completedLaps===15&&r.pitStops>=2&&r.recoveryCount<=1),JSON.stringify(racers.map(r=>({id:r.id,pits:r.pitStops,recovery:r.recoveryCount}))));
});
