import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import * as THREE from 'three';
import {legendaryPilots} from '../public/legendary-catalog.js';
import {chairs,pilots} from '../public/catalog.js';
import {shopItems,ownsSelection,achievements} from '../public/progression.js';
import {makeChair,animateChair} from '../public/chairs.js';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';

test('twelve legendary pilots have references, bounded prices and server-enforced purchases',()=>{
  const db=new Accounts(':memory:');
  try{
    db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run('legend','Legend','legend','test-only');
    const manager=new RoomManager(db),messages=[];
    const client={user:db.profile('legend'),ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))}};
    manager.add(client);
    assert.equal(legendaryPilots.length,12);
    assert.equal(new Set(pilots.map(p=>p.id)).size,pilots.length);
    let spent=0;
    db.economy.grant('legend','fixture','Test fixture',{coins:200000,xp:0});
    for(const p of legendaryPilots){
      const item=shopItems.find(i=>i.target===p.id);
      assert.ok(existsSync('public'+p.art));
      assert.equal(item.rarity,'legendary');
      assert.ok(item.price>=5000&&item.price<=20000);
      assert.equal(ownsSelection(db.profile('legend').progression,'pilot',p.id),false);
      manager.join(client,{roomId:'room-1',pilotId:p.id});
      assert.equal(messages.at(-1).type,'error');
      assert.throws(()=>db.economy.buy('legend',item.id),/succès/);
      db.db.prepare('INSERT INTO earned_achievements VALUES(?,?)').run('legend',item.achievement);
      db.economy.buy('legend',item.id);spent+=item.price;
      assert.equal(ownsSelection(db.profile('legend').progression,'pilot',p.id),true);
      assert.throws(()=>db.economy.buy('legend',item.id),/déjà/);
    }
    assert.equal(db.profile('legend').progression.coins,200000-spent);
  }finally{db.close();}
});

test('all legendary costumes render and animate on every chair within the batched mesh budget',()=>{
  for(const pilot of legendaryPilots)for(const chair of chairs){
    const model=makeChair(THREE,chair,pilot,{race:true});
    assert.equal(model.userData.legendaryCostume,pilot.id);
    let meshes=0;const materials=new Set();
    model.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.position.count>0);materials.add(o.material);}});
    assert.ok(meshes<60,pilot.id+'/'+chair.id+': '+meshes);
    animateChair(model,{speed:20,steer:.5},1/60,1200);
    assert.ok(Number.isFinite(model.userData.animation.head.rotation.y));
    assert.equal(model.position.length(),0);
    model.traverse(o=>o.geometry?.dispose());materials.forEach(m=>m.dispose());
  }
});
test('legendary goals award once at their threshold, never grant the pilot automatically',()=>{
  for(const a of achievements.filter(a=>a.id.startsWith('legend-'))){
    const db=new Accounts(':memory:');
    try{
      db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run('goal','Goal','goal','test-only');
      db.economy.metrics=()=>({[a.metric]:a.goal-1});
      db.economy.checkAchievements('goal');
      assert.ok(!db.economy.profile('goal').earned.includes(a.id));
      db.economy.metrics=()=>({[a.metric]:a.goal});
      db.economy.checkAchievements('goal');
      const earned=db.economy.profile('goal');
      assert.ok(earned.earned.includes(a.id));
      assert.ok(!earned.owned.includes('pilot-'+a.id.slice(7)));
      db.economy.checkAchievements('goal');
      assert.deepEqual(db.economy.profile('goal'),earned);
    }finally{db.close();}
  }
});

test('historical legendary migration keeps purchases and credits eligible goals once',()=>{
  const db=new Accounts(':memory:');
  try{
    db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run('old','Old','old','test-only');
    db.db.prepare('INSERT INTO inventory VALUES(?,?)').run('old','pilot-schumacher');
    for(const trackId of ['coast','neon','metro','garden','orbit'])
      db.recordResult({raceId:trackId,userId:'old',trackId,time:80,bestLap:25,place:1,difficulty:'200'});
    // Recreate the pre-feature state in this isolated in-memory fixture only.
    db.db.prepare("DELETE FROM earned_achievements WHERE achievement_id LIKE 'legend-%'").run();
    db.db.prepare("DELETE FROM rewards WHERE event_id LIKE 'achievement:legend-%'").run();
    db.db.prepare('DELETE FROM economy_migrations WHERE id=3').run();
    db.economy.migrateLegends();
    const after=db.profile('old').progression;
    assert.ok(after.earned.includes('legend-bran')&&after.earned.includes('legend-jake'));
    assert.ok(after.owned.includes('pilot-schumacher'));
    assert.ok(!after.earned.includes('legend-schumacher'));
    db.economy.migrateLegends();
    assert.deepEqual(db.profile('old').progression,after);
  }finally{db.close();}
});
