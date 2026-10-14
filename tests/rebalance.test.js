import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { chairs,tracks } from '../public/catalog.js';
import { makeChair } from '../public/chairs.js';
import { shopItems,achievements,achievementProgress,raceReward,cupReward } from '../public/progression.js';
function user(db,id='test'){db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'fixture');return id;}
function client(db,manager,id){const messages=[],c={user:db.profile(id),ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};manager.add(c);return c;}

test('reduced rewards, raised prices, exact F1 stats and distinct F1 geometry',()=>{
  assert.equal(raceReward(1,'50').coins,54);assert.equal(raceReward(12,'50').coins,10);
  assert.equal(cupReward(1,'50').coins,168);
  assert.equal(shopItems.length,33);assert.equal(achievements.length,39);
  const hawking=shopItems.find(i=>i.id==='pilot-hawking');
  assert.ok(shopItems.filter(i=>i!==hawking).every(i=>i.price<hawking.price&&i.level<hawking.level));
  const f1=chairs.find(c=>c.id==='apex');assert.deepEqual(['speed','accel','handling'].map(k=>f1[k]),[10,10,4]);
  const model=makeChair(THREE,f1);assert.ok(model.getObjectByName('f1-front-wing'));assert.ok(model.getObjectByName('f1-rear-wing'));
  assert.equal(model.userData.animation.wheels.length,4);
  const materials=new Set();model.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
});

test('migration locks formerly free Hawking without removing purchases or balances; historical easy wins do not satisfy prestige',()=>{
  const db=new Accounts(':memory:');try {
    const id=user(db);db.economy.grant(id,'fixture','Fixture',{coins:7777,xp:75000});
    db.db.prepare("UPDATE users SET pilot_id='hawking' WHERE id=?").run(id);
    db.db.prepare('INSERT INTO inventory VALUES(?,?)').run(id,'paint-gold');
    db.db.prepare('INSERT INTO earned_achievements VALUES(?,?)').run(id,'cup-winner');
    db.db.prepare("INSERT INTO race_results(race_id,user_id,track_id,time_ms,place,created_at,difficulty,balance_version) VALUES('old',?,'coast',50000,1,0,'200',1)").run(id);
    db.db.prepare("INSERT INTO tournament_results(tournament_id,user_id,difficulty,mode,place,points,created_at,balance_version,won_races) VALUES('old',?,'200','career',1,75,0,1,5)").run(id);
    db.db.prepare('DELETE FROM economy_migrations WHERE id=2').run();db.economy.migrateBalance();
    const p=db.profile(id);assert.equal(p.pilotId,'maya');assert.equal(p.progression.coins,7777);assert.equal(p.progression.xp,75000);
    assert.ok(p.progression.owned.includes('paint-gold'));assert.ok(p.progression.earned.includes('cup-winner'));
    assert.equal(p.progression.metrics.eliteWins,0);assert.equal(p.progression.metrics.perfectCups,0);
    db.economy.migrateBalance();assert.deepEqual(db.profile(id),p);
    const manager=new RoomManager(db),c=client(db,manager,id);
    manager.join(c,{roomId:'room-1',pilotId:'hawking'});assert.equal(c.messages.at(-1).type,'error');assert.ok(!c.roomId);
    manager.join(c,{roomId:'room-1'});assert.equal(c.racer.pilotId,'maya');
    manager.configure(c,{pilotId:'hawking'});assert.equal(c.racer.pilotId,'maya');
    assert.throws(()=>db.economy.buy(id,'pilot-hawking'),/succès/);
    assert.throws(()=>db.economy.buy(id,'chair-apex'),/succès/);
  }finally{db.close();}
});

test('F1 and ultimate pilot require verified current-era achievements, not XP or money alone',()=>{
  const db=new Accounts(':memory:');try {
    const id=user(db);db.economy.grant(id,'fixture','Fixture',{coins:50000,xp:75000});
    const ultimate=achievements.find(a=>a.id==='ultimate-master');
    for(let i=0;i<50;i++) {
      db.recordResult({raceId:'r'+i,userId:id,trackId:tracks[i%5].id,time:55,bestLap:17,place:1,difficulty:'200'});
      if(i===18)assert.throws(()=>db.economy.buy(id,'chair-apex'),/succès/);
      if(i===19)db.economy.buy(id,'chair-apex');
    }
    assert.equal(achievementProgress(ultimate,db.profile(id).progression.metrics),2);
    for(let i=0;i<10;i++)db.recordTournament({id:'cup'+i,userId:id,difficulty:'200',mode:'career',place:1,points:i<3?75:65,wonRaces:i<3?5:3});
    assert.equal(achievementProgress(ultimate,db.profile(id).progression.metrics),4);
    assert.throws(()=>db.economy.buy(id,'pilot-hawking'),/succès/);
    for(const difficulty of ['50','100','150'])db.recordTournament({id:'career'+difficulty,userId:id,difficulty,mode:'career',place:1,points:60,wonRaces:3});
    const earned=db.profile(id).progression;assert.ok(earned.earned.includes('ultimate-master'));
    db.economy.buy(id,'pilot-hawking');assert.equal(db.profile(id).progression.coins,earned.coins-25000);
    const manager=new RoomManager(db),c=client(db,manager,id);manager.join(c,{roomId:'room-1',pilotId:'hawking',chairId:'apex'});
    assert.equal(c.racer.pilotId,'hawking');assert.equal(c.racer.chairId,'apex');
    const balance=db.profile(id).progression.coins;db.economy.checkAchievements(id);assert.equal(db.profile(id).progression.coins,balance);
  }finally{db.close();}
});
