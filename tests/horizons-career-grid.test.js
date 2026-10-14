import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';
import {cups} from '../public/competition.js';
import {compareRacers} from '../public/racing.js';
import {driveSpeed} from '../public/motion.js';
import {chairs} from '../public/catalog.js';
import * as THREE from 'three';
import {makeChair,animateChair} from '../public/chairs.js';
function client(db,m,id){
  db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'fixture');
  const c={user:db.profile(id),messages:[],ws:{readyState:1,send:s=>c.messages.push(JSON.parse(s))}};m.add(c);return c;
}
function finish(m,room,order){room.phase='racing';order.forEach((r,i)=>Object.assign(r,{finished:true,finishTime:150+i,progress:3}));m.completeRace(room);}
test('independent Horizons career locks, five routes, rewards and idempotence',()=>{
  const db=new Accounts(':memory:');try{
    const m=new RoomManager(db),c=client(db,m,'career');
    for(const difficulty of ['50','100','150','200']){
      if(difficulty!=='200'){m.career(c,{cupId:'horizons',difficulty:'200'});assert.equal(c.messages.at(-1).type,'error');}
      m.career(c,{cupId:'horizons',difficulty});const room=m.rooms.get(c.roomId),routes=[];
      for(let n=0;n<5;n++){m.start(c);routes.push(room.trackId);finish(m,room,room.racers);}
      assert.deepEqual(routes,cups[1].trackIds);
      const p=db.profile(c.user.id);assert.deepEqual(p.career.completed,[]);assert.ok(p.careers.horizons.completed.includes(difficulty));
      assert.equal(db.db.prepare('SELECT COUNT(*) n FROM rewards WHERE user_id=? AND event_id=?').get(c.user.id,'achievement:horizons-'+difficulty)?.n,1);
      const coins=p.progression.coins;m.completeRace(room);assert.equal(db.profile(c.user.id).progression.coins,coins);m.leave(c);
    }
    assert.deepEqual(db.profile(c.user.id).careers.horizons.unlocked,['50','100','150','200']);
  }finally{db.close();}
});
test('humans start 12th then 11th; next grid follows last race, not cumulative points',()=>{
  const db=new Accounts(':memory:');try{
    const m=new RoomManager(db),a=client(db,m,'first'),b=client(db,m,'second');
    m.join(a,{roomId:'room-1'});m.join(b,{roomId:'room-1'});const room=m.rooms.get(a.roomId);
    assert.equal(a.racer.gridPosition,12);assert.equal(b.racer.gridPosition,11);
    assert.equal([...room.racers].sort(compareRacers).at(-1).id,a.racer.id);
    m.configure(a,{mode:'tournament'});m.start(a);
    const order=[...room.racers].reverse();finish(m,room,order);m.start(a);
    assert.deepEqual([...room.racers].sort((a,b)=>a.gridPosition-b.gridPosition).map(r=>r.id),order.map(r=>r.id));
    const next=[order.at(-1),...order.slice(0,-1)];finish(m,room,next);m.start(a);
    assert.equal(next[0].gridPosition,1);assert.equal(order[0].gridPosition,2);
    assert.equal(new Set(room.racers.map(r=>r.gridPosition)).size,12);
  }finally{db.close();}
});
test('ceramic brake module is a 2 percent braking improvement only',()=>{
  const c=chairs[0],args=[20,{brake:true},c,1,0,1,.1];
  assert.ok(Math.abs((20-driveSpeed(...args,'module-brake'))/(20-driveSpeed(...args))-1.02)<1e-9);
  assert.equal(driveSpeed(0,{gas:true},c,1,0,1,.1,'module-brake'),driveSpeed(0,{gas:true},c,1,0,1,.1));
});
test('rival batching keeps animated rigs and colors while reducing draw calls',()=>{
  for(const chair of chairs){
    const detailed=makeChair(THREE,chair,undefined,{race:true}),rival=makeChair(THREE,chair,undefined,{race:true,rival:true});
    const count=model=>{let n=0;model.traverse(o=>{if(o.isMesh)n++;});return n;};
    assert.ok(count(rival)<count(detailed)*.65,chair.id);
    assert.equal(rival.userData.animation.wheels.length,detailed.userData.animation.wheels.length);
    animateChair(rival,{speed:15,steer:.5},1/60,1000);
    assert.ok(rival.userData.animation.wheels.every(w=>w.rotation.x!==0));
    rival.traverse(o=>{if(o.material?.vertexColors)assert.ok(o.geometry.attributes.color);});
    for(const model of [detailed,rival]){const materials=new Set();model.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());}
  }
});
test('twelve humans have unique reversed grid slots; host departure moves remaining humans back',()=>{
  const db=new Accounts(':memory:');try{
    const m=new RoomManager(db),players=Array.from({length:12},(_,i)=>client(db,m,'human'+i));
    for(const p of players)m.join(p,{roomId:'room-1'});
    assert.deepEqual(players.map(p=>p.racer.gridPosition),[12,11,10,9,8,7,6,5,4,3,2,1]);
    m.leave(players[0]);const room=m.rooms.get('room-1');
    assert.equal(players[1].racer.gridPosition,12);assert.equal(room.racers.find(r=>r.isBot).gridPosition,1);
  }finally{db.close();}
});
