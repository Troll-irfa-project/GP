import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { difficulties, positionPoints, standings } from '../public/competition.js';
import { tracks, chairs } from '../public/catalog.js';
import { createCourse, spawnRacer, stepRace } from '../public/racing.js';
import { startTestServer, register } from './helpers.js';

function player(manager, user) {
  const messages=[], c={user,ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};
  manager.add(c);return c;
}
function resolveRace(manager,room,winner) {
  room.phase='racing';
  const racers=[...room.racers].sort((a,b)=>Number(b.id===winner)-Number(a.id===winner));
  racers.forEach((r,i)=>Object.assign(r,{finished:true,finishTime:80+i,bestLapTime:25,progress:3}));
  manager.tick(1/60);
}
test('five-round career, enforced locks, private rooms, stable roster and persistent idempotent unlocks',async()=>{
  const server=await startTestServer(8120);let db;
  try {
    const a=await register(server.url,'Champion'),b=await register(server.url,'Visitor');
    db=new Accounts(join(server.directory,'test.sqlite'));
    const manager=new RoomManager(db),c=player(manager,a.user),other=player(manager,b.user);
    manager.handle(c,{type:'start_career',difficulty:'200'});assert.equal(c.messages.at(-1).type,'error');
    manager.handle(c,{type:'start_career',difficulty:'50'});
    const room=manager.rooms.get(c.roomId);assert.equal(manager.list().length,3);
    manager.join(other,{roomId:room.id});assert.equal(other.messages.at(-1).type,'error');
    manager.configure(c,{difficulty:'200'});assert.equal(room.difficulty,'50');
    let ids;const routes=[],raceIds=[];
    for(let i=0;i<5;i++) {
      manager.start(c);assert.equal(room.phase,'countdown');
      const current=room.racers.map(r=>r.id);if(ids)assert.deepEqual(current,ids);else ids=current;
      routes.push(room.trackId);raceIds.push(room.raceId);
      manager.start(c);assert.equal(room.cup.round,i,'cannot skip an active round');
      resolveRace(manager,room,c.racer.id);
      assert.equal(room.phase,'results');assert.equal(room.cup.entries.find(e=>e.id===c.racer.id).points,15*(i+1));
      if(i<4)assert.deepEqual(db.profile(a.user.id).career.unlocked,['50']);
    }
    assert.deepEqual(routes,tracks.slice(0,5).map(t=>t.id));assert.equal(new Set(raceIds).size,5);
    assert.equal(db.db.prepare('SELECT won_races FROM tournament_results WHERE tournament_id=?').get(room.cup.id).won_races,5);
    assert.equal(room.cup.complete,true);assert.deepEqual(db.profile(a.user.id).career.unlocked,['50','100']);
    manager.completeRace(room);assert.equal(db.profile(a.user.id).championships.length,1);
    assert.equal(db.profile(a.user.id).racesFinished,5);
    assert.ok(!JSON.stringify(c.messages.at(-1)).includes('userId'));
    manager.leave(c);assert.ok(!manager.rooms.has(room.id));
    db.close();db=new Accounts(join(server.directory,'test.sqlite'));
    assert.deepEqual(db.profile(a.user.id).career.completed,['50']);
    manager.accounts=db;
    manager.career(c,{difficulty:'100'});manager.start(c);
    const second=manager.rooms.get(c.roomId);
    for(let i=0;i<5;i++){if(i)manager.start(c);resolveRace(manager,second,second.racers[1].id);}
    assert.deepEqual(db.profile(a.user.id).career.unlocked,['50','100'],'losing does not unlock next level');
    manager.leave(c);
    for(const difficulty of ['100','150','200']) {
      manager.career(c,{difficulty});const cupRoom=manager.rooms.get(c.roomId);
      for(let round=0;round<5;round++){manager.start(c);resolveRace(manager,cupRoom,c.racer.id);}
      manager.leave(c);
    }
    assert.deepEqual(db.profile(a.user.id).career.completed,['50','100','150','200']);
    assert.equal(db.profile(a.user.id).championships.length,4);
  } finally {db?.close();await server.close();}
});

test('global API aggregates users and survives restart, without credentials or duplicate records',async()=>{
  const server=await startTestServer(8121);let db;
  try {
    const a=await register(server.url,'FastRace'),b=await register(server.url,'FastLap');
    db=new Accounts(join(server.directory,'test.sqlite'));
    db.recordResult({raceId:'a',userId:a.user.id,trackId:'coast',time:80,bestLap:25,place:1});
    db.recordResult({raceId:'b',userId:b.user.id,trackId:'coast',time:90,bestLap:24,place:2});
    db.recordResult({raceId:'c',userId:a.user.id,trackId:'coast',time:85,bestLap:26,place:1});
    db.recordTournament({id:'online',userId:a.user.id,difficulty:'200',mode:'tournament',place:1,points:75});
    assert.deepEqual(db.profile(a.user.id).career.unlocked,['50'],'online wins cannot skip career');
    db.close();db=null;await server.restart();
    const response=await fetch(server.url+'/api/leaderboards');assert.equal(response.status,200);
    const data=await response.json(), coast=data.circuits.find(t=>t.trackId==='coast');
    assert.equal(data.circuits.length,10);assert.equal(coast.races.length,2);
    assert.equal(coast.races[0].username,'FastRace');assert.equal(coast.races[0].timeMs,80000);
    assert.equal(coast.laps[0].username,'FastLap');assert.equal(coast.laps[0].timeMs,24000);
    assert.ok(!JSON.stringify(data).match(/password|userId|session/));
  } finally {db?.close();await server.close();}
});

test('multiplayer tournament host migration, DNF timeout, points and deterministic ties',()=>{
  const profiles=new Map(['a','b'].map(id=>[id,{id,username:id,chairId:'comet',pilotId:'maya'}]));
  const saved=[];const manager=new RoomManager({profile:id=>profiles.get(id),preferences(){},recordResult:r=>saved.push(r),recordTournament(){}});
  const a=player(manager,profiles.get('a')),b=player(manager,profiles.get('b'));
  manager.join(a,{roomId:'room-1'});manager.join(b,{roomId:'room-1'});
  manager.configure(b,{mode:'tournament',difficulty:'200'});const room=manager.rooms.get(a.roomId);assert.equal(room.mode,'race');
  manager.configure(a,{mode:'tournament',difficulty:'150'});manager.start(a);
  manager.leave(a);assert.equal(manager.host(room),b);assert.equal(room.cup.round,0);
  room.phase='racing';room.raceTime=299.99;manager.tick(.02);
  assert.equal(room.phase,'results');assert.ok(room.racers.every(r=>r.dnf));assert.equal(saved.length,0);
  assert.ok(room.cup.entries.every(e=>e.points===0));manager.start(b);assert.equal(room.cup.round,1);
  assert.equal(room.racers.length,12);assert.ok(room.racers.every(r=>!r.dnf));
  assert.equal(positionPoints.reduce((a,b)=>a+b,0),82);
  const entries=[{seed:0,points:20,wins:1,time:200},{seed:1,points:20,wins:2,time:300},{seed:2,points:20,wins:2,time:250}];
  assert.deepEqual(standings(entries).map(e=>e.seed),[2,1,0]);
});

for(const track of tracks)test(`AI tiers are significantly faster and finish safely on ${track.id}`,()=>{
  const times=[];const historical50={neon:147,coast:125.7,metro:148.2,garden:128.5,orbit:138.2};
  for(const difficulty of difficulties) {
    const course=createCourse(track),racers=Array.from({length:12},(_,i)=>({id:String(i),chairId:chairs[i%chairs.length].id,isBot:true,aiDifficulty:difficulty.id,skill:difficulty.speed*(.97+i%6*.012)}));
    racers.forEach((r,i)=>spawnRacer(r,i,course));
    for(let frame=0;frame<36000&&!racers.every(r=>r.finished);frame++)stepRace(racers,course,chairs,1/60,3,(frame+1)/60);
    assert.ok(racers.every(r=>r.finished),`${difficulty.name} all finish`);
    assert.ok(racers.every(r=>r.recoveryCount===0),`${difficulty.name} no stuck recovery`);
    times.push(racers.reduce((s,r)=>s+r.finishTime,0)/racers.length);
  }
  assert.ok(!historical50[track.id]||times[0]<historical50[track.id],'50cc is substantially tougher than the old baseline');
  for(let i=1;i<times.length;i++)assert.ok(times[i]<times[i-1]*.98,`meaningful speed increase: ${times.join(', ')}`);
  console.log(track.id,times.map(t=>t.toFixed(1)));
});
