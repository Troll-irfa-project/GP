import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { Economy } from '../backend/economy.js';
import { levelProgress, raceReward, cupReward, ownsSelection, paintChair } from '../public/progression.js';
import { chairs, tracks } from '../public/catalog.js';
import { driveSpeed, topSpeed } from '../public/motion.js';
import { startTestServer, register } from './helpers.js';
function seed(db,id='test') {db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'test-only');return id;}
function rewardRace(db,id,n,place=1) {db.recordResult({raceId:'r'+n,userId:id,trackId:tracks[n%5].id,time:80,bestLap:25,place,difficulty:'100'});}
function client(manager,db,id) {const messages=[],c={user:db.profile(id),ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};manager.add(c);return c;}

test('XP boundaries, verified rewards and achievements are credited exactly once',()=>{
  const db=new Accounts(':memory:');try {
    const id=seed(db);assert.equal(db.profile(id).progression.coins,0);
    assert.equal(levelProgress(0).level,1);assert.equal(levelProgress(249).level,1);assert.equal(levelProgress(250).level,2);assert.equal(levelProgress(750).level,3);
    rewardRace(db,id,0);const p=db.profile(id).progression,r=raceReward(1);
    assert.equal(p.coins,r.coins+100);assert.equal(p.xp,r.xp+50);
    assert.deepEqual(p.earned,['logo-looser']);
    rewardRace(db,id,0);assert.deepEqual(db.profile(id).progression,p);
    db.recordResult({raceId:'invalid',userId:id,trackId:'coast',time:0,place:1});assert.deepEqual(db.profile(id).progression,p);
    for(let n=1;n<30;n++)rewardRace(db,id,n,12);
    const later=db.profile(id).progression;assert.ok(later.earned.includes('regular'));assert.ok(!later.earned.includes('explorer'));
    const cup={id:'cup',userId:id,difficulty:'50',mode:'career',place:1,points:75};db.recordTournament(cup);
    const winner=db.profile(id).progression;assert.equal(winner.coins-later.coins,cupReward(1,'50').coins);
    db.recordTournament(cup);assert.deepEqual(db.profile(id).progression,winner);
    db.recordTournament({...cup,id:'dnf',points:0,place:12});assert.equal(db.profile(id).progression.coins,winner.coins);
  }finally{db.close();}
});

test('purchases enforce levels, achievements, balances, ownership and one equipped module',()=>{
  const db=new Accounts(':memory:');try {
    const id=seed(db),e=db.economy;
    e.grant(id,'test-level','Test only',{coins:0,xp:250});
    assert.throws(()=>e.buy(id,'paint-lagoon'),/insuffisants/);
    assert.throws(()=>e.buy(id,'module-start'),/Niveau/);
    assert.throws(()=>e.buy(id,'unknown'),/inconnu/);
    assert.throws(()=>e.equip(id,'paint','paint-gold'),/Achète/);
    for(let n=0;n<150;n++)rewardRace(db,id,n);
    const before=e.profile(id);assert.throws(()=>e.buy(id,'paint-gold'),/succès/);assert.deepEqual(e.profile(id),before);
    e.buy(id,'module-start');e.buy(id,'module-grip');e.equip(id,'upgrade','module-start');e.equip(id,'upgrade','module-grip');
    assert.equal(e.profile(id).upgrade,'module-grip');e.equip(id,'upgrade',null);assert.equal(e.profile(id).upgrade,null);
    e.buy(id,'paint-lagoon');e.equip(id,'paint','paint-lagoon');
    const bought=e.profile(id);assert.throws(()=>e.buy(id,'paint-lagoon'),/déjà/);assert.deepEqual(e.profile(id),bought);
    assert.throws(()=>e.equip(id,'coins',999),/invalide/);
    e.buy(id,'chair-vector');assert.ok(ownsSelection(e.profile(id),'chair','vector'));
    assert.ok(!ownsSelection(e.profile(id),'pilot','idris'));assert.ok(ownsSelection(null,'chair','comet'));
    const manager=new RoomManager(db),c=client(manager,db,id);
    manager.join(c,{roomId:'room-1',pilotId:'idris'});assert.equal(c.messages.at(-1).type,'error');
    manager.join(c,{roomId:'room-1',chairId:'vector'});assert.equal(c.racer.chairId,'vector');assert.equal(c.racer.paintId,'paint-lagoon');
    manager.configure(c,{chairId:'nomad'});assert.equal(c.racer.chairId,'vector');
    assert.equal(paintChair(chairs[0],c.racer.paintId).color,'#21d9bd');
  }finally{db.close();}
});

test('historical migration credits actual records once, including achievement bonuses',()=>{
  const db=new Accounts(':memory:');try {
    const id=seed(db);
    // Only this disposable in-memory fixture represents the pre-economy database.
    db.db.prepare('DELETE FROM economy_migrations').run();
    db.db.prepare('INSERT INTO race_results(race_id,user_id,track_id,time_ms,place,created_at) VALUES(?,?,?,?,?,?)').run('old',id,'coast',85000,1,1);
    db.db.prepare('UPDATE users SET races_finished=1,races_won=1 WHERE id=?').run(id);
    db.db.prepare('INSERT INTO records VALUES(?,?,?,?)').run(id,'coast',85000,27000);
    new Economy(db.db);const first=db.profile(id).progression;
    assert.equal(first.coins,raceReward(1).coins+100);assert.equal(db.profile(id).records[0].bestRaceMs,85000);
    new Economy(db.db);assert.deepEqual(db.profile(id).progression,first);
  }finally{db.close();}
});

test('module bonus is bounded at two percent and never raises top speed',()=>{
  const chair=chairs[0],dt=1/60;
  const plain=driveSpeed(0,{gas:true},chair,1,0,1,dt),tuned=driveSpeed(0,{gas:true},chair,1,0,1,dt,'module-start');
  assert.ok(Math.abs(tuned/plain-1.02)<1e-10);
  let speed=0;for(let i=0;i<600;i++)speed=driveSpeed(speed,{gas:true},chair,1,0,1,dt,'module-start');
  assert.equal(speed,topSpeed(chair));
});

test('HTTP purchases are authenticated, CSRF protected, atomic and survive restart',async()=>{
  const server=await startTestServer(8124);let db;
  const post=(path,data,cookie='',origin=server.url)=>fetch(server.url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(data)});
  try {
    const a=await register(server.url,'EconomyQA'),b=await register(server.url,'OtherQA');
    assert.equal((await post('/api/shop/buy',{itemId:'paint-lagoon'})).status,401);
    assert.equal((await post('/api/shop/buy',{itemId:'paint-lagoon'},a.cookie,'https://evil.example')).status,403);
    db=new Accounts(join(server.directory,'test.sqlite'));for(let n=0;n<12;n++)rewardRace(db,a.user.id,n);
    const before=db.profile(a.user.id).progression;
    const results=await Promise.all([1,2].map(()=>post('/api/shop/buy',{itemId:'paint-lagoon',price:-999,coins:999999},a.cookie)));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    assert.equal(db.profile(a.user.id).progression.coins,before.coins-500);
    assert.equal((await post('/api/shop/equip',{slot:'paint',itemId:'paint-lagoon'},a.cookie)).status,200);
    assert.equal((await post('/api/shop/equip',{slot:'paint',itemId:'paint-lagoon'},b.cookie)).status,400);
    assert.equal((await post('/api/profile',{favoriteChairIds:[],xp:99999},a.cookie)).status,400);
    db.close();db=null;await server.restart();
    const p=(await (await fetch(server.url+'/api/me',{headers:{Cookie:a.cookie}})).json()).user.progression;
    assert.equal(p.paint,'paint-lagoon');assert.equal(p.coins,before.coins-500);assert.equal(p.xp,before.xp);
  }finally{db?.close();await server.close();}
});
