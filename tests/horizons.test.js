import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chairs,tracks} from '../public/catalog.js';
import {topSpeed,steeringRate,lateralGrip,distanceToRoute} from '../public/motion.js';
import {createCourse,spawnRacer,stepRace} from '../public/racing.js';
import {cups} from '../public/competition.js';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';
import {groundHeight} from '../public/environment-math.js';

test('three-stat budget, meaningful high-speed understeer and braking recovery',()=>{
  for(const c of chairs){
    assert.equal(c.speed+c.accel+c.handling,24);
    assert.ok(!('weight' in c)&&!('offroad' in c));
    assert.ok([c.speed,c.accel,c.handling].every(v=>v>=1&&v<=10));
  }
  const fast=chairs.find(c=>c.id==='comet'),agile=chairs.find(c=>c.id==='drift');
  const radius=(c,v)=>v/steeringRate(c,v);
  assert.ok(radius(fast,topSpeed(fast))>22,'full throttle cannot make a tight bend');
  assert.ok(radius(fast,14)<10,'braking restores a tight trajectory');
  assert.ok(radius(agile,24)<radius(fast,24)*.75,'handling offers a material cornering advantage');
  assert.ok(Math.abs(24*steeringRate(fast,24)-lateralGrip(fast))<1e-8);
  const course=createCourse(tracks[0]);
  const a={id:'a',chairId:'atlas',input:{}},b={id:'b',chairId:'comet',input:{}};
  spawnRacer(a,0,course);spawnRacer(b,0,course);b.z+=1;
  const az=a.z,bz=b.z;stepRace([a,b],course,chairs,1/60);
  assert.ok(Math.abs((az-a.z)-(b.z-bz))<1e-9,'equal collision mass for every chair');
});

test('Horizons loops meet distance, clearance and finish-straight requirements',()=>{
  assert.equal(cups.length,2);
  for(const t of tracks.filter(t=>t.cupId==='horizons')){
    const c=createCourse(t);assert.ok(c.total>=800&&c.total<=1200);
    assert.ok(Math.abs(c.total-t.length)<1e-6);
    assert.ok(c.segments.some(s=>s.len>50));
    for(const p of t.route)assert.equal(groundHeight(t,...p),0);
    // No non-neighbouring branches are closer than both drivable half-widths.
    for(let i=0;i<c.segments.length;i++)for(let j=i+1;j<c.segments.length;j++){
      const a=c.segments[i],b=c.segments[j];
      const along=Math.min(Math.abs(a.start-b.start),c.total-Math.abs(a.start-b.start));
      if(along<45)continue;
      assert.ok(distanceToRoute(...a.a,[b.a,b.b])>t.width*2+1,t.id+' branch clearance');
    }
  }
});

test('host-only Horizons cup runs exactly its five tracks and persists its identity',()=>{
  const db=new Accounts(':memory:');try{
    const m=new RoomManager(db);
    function client(id){
      db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'test-only');
      const c={user:db.profile(id),messages:[],ws:{readyState:1,send:raw=>c.messages.push(JSON.parse(raw))}};
      m.add(c);m.join(c,{roomId:'room-1'});return c;
    }
    const host=client('host'),guest=client('guest'),room=m.rooms.get('room-1');
    m.configure(guest,{cupId:'horizons'});assert.equal(guest.messages.at(-1).type,'error');
    m.configure(host,{mode:'tournament',cupId:'horizons',difficulty:'50',itemsEnabled:true});
    const route=[];
    for(let n=0;n<5;n++){
      m.start(host);route.push(room.trackId);
      m.configure(host,{cupId:'classic'});assert.equal(room.cupId,'horizons');
      room.phase='racing';
      room.racers.forEach((r,i)=>Object.assign(r,{finished:true,finishTime:180+i,bestLapTime:55,progress:3}));
      m.tick(1/60);
      assert.equal(room.cup.complete,n===4);
    }
    assert.deepEqual(route,cups[1].trackIds);
    assert.equal(db.db.prepare('SELECT cup_id FROM tournament_results WHERE user_id=?').get('host').cup_id,'horizons');
    assert.equal(room.cup.entries[0].points,75);
    assert.equal(db.profile('host').career.completed.length,0);
  }finally{db.close();}
});
