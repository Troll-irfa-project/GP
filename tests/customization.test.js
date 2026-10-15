import {test} from 'node:test';
import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import * as THREE from 'three';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';
import {logos,logoAchievements,ownsLogo} from '../public/logo-catalog.js';
import {chairs,pilots} from '../public/catalog.js';
import {paintChair,achievementProgress,shopItems} from '../public/progression.js';
import {makeChair} from '../public/chairs.js';
import {startTestServer,register} from './helpers.js';
function user(db,id='custom'){db.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES(?,?,?,?,0)').run(id,id,id,'fixture');return id;}
test('13 exact ordered logo assets, cumulative prestige and no purchases',()=>{
  assert.deepEqual(logos.map(l=>l.id),['looser','cocacola','shell','renault','gulf','handicap','worldcup','mercedes','redbull','avengers','ferrari','leagueoflegends','ricard']);
  for(const [i,l] of logos.entries()){
    const a=logoAchievements[i];assert.equal(a.goal,i+1);assert.equal(a.requirements.length,i+1);
    if(i)assert.deepEqual(a.requirements.slice(0,-1),logoAchievements[i-1].requirements);
    const metrics=Object.fromEntries(a.requirements.map(r=>[r.metric,r.goal]));
    // Repeated win metrics use their largest (last) goal.
    assert.equal(achievementProgress(a,metrics),a.goal);
    assert.ok(!shopItems.some(s=>s.id===l.achievement||s.type==='logo'));
    const svg=readFileSync(new URL('../public'+l.art,import.meta.url),'utf8');
    assert.match(svg,/<svg[\s>]/);assert.doesNotMatch(svg,/<script|<foreignObject|\sonload\s*=/i);
  }
});
test('styles validate ownership, colors and earned logos; no currency debit; per chair',()=>{
  const db=new Accounts(':memory:');try{
    const id=user(db),e=db.economy;
    assert.throws(()=>e.customize(id,{chairId:'comet',color:'#112233',logoId:'ricard'}),/succès/);
    assert.throws(()=>e.customize(id,{chairId:'apex',color:null,logoId:null}),/collection/);
    for(const color of ['red','#fff','url(x)','<script>',undefined,123])assert.throws(()=>e.customize(id,{chairId:'comet',color,logoId:null}),/Couleur/);
    assert.throws(()=>e.customize(id,{chairId:'comet',color:null,logoId:null,coins:99}),/invalide/);
    db.recordResult({raceId:'first',userId:id,trackId:'coast',time:80,bestLap:25,place:12});
    assert.ok(ownsLogo(e.profile(id),'looser'));const before=e.profile(id);
    e.customize(id,{chairId:'comet',color:'#ABCDEF',logoId:'looser'});
    e.customize(id,{chairId:'atlas',color:'#123456',logoId:null});
    const after=e.profile(id);assert.equal(after.coins,before.coins);assert.equal(after.xp,before.xp);
    assert.deepEqual(after.chairStyles.comet,{color:'#abcdef',logoId:'looser'});assert.equal(after.chairStyles.atlas.color,'#123456');
    const customized=paintChair(chairs[0],'paint-gold',after.chairStyles.comet);assert.equal(customized.color,'#abcdef');assert.equal(customized.logoId,'looser');
    assert.equal(paintChair(chairs[0],'paint-gold',{color:null}).color,'#ffd34e');
    assert.deepEqual(['speed','accel','handling'].map(k=>customized[k]),[10,8,6]);
  }finally{db.close();}
});
test('historical unlock migration idempotent, no inventory purchase needed',()=>{
  const db=new Accounts(':memory:');try{
    const id=user(db);db.db.prepare('UPDATE users SET races_finished=5 WHERE id=?').run(id);
    db.db.prepare('DELETE FROM economy_migrations WHERE id=5').run();db.economy.migrateLogos();
    const before=db.profile(id);assert.ok(ownsLogo(before.progression,'looser'));assert.ok(ownsLogo(before.progression,'cocacola'));
    assert.ok(!ownsLogo(before.progression,'shell'));assert.deepEqual(before.progression.owned,[]);
    db.economy.migrateLogos();assert.deepEqual(db.profile(id),before);
  }finally{db.close();}
});
test('all 11 chairs carry a readable rear logo mount, including race batching',()=>{
  for(const chair of chairs)for(const race of [false,true]){
    const model=makeChair(THREE,{...chair,logoId:'shell'},pilots[1],{race,rival:race});
    const mount=model.getObjectByName('logo-mount'),sticker=model.getObjectByName('chair-logo');
    assert.ok(mount);assert.ok(sticker);assert.equal(sticker.userData.logoId,'shell');
    assert.equal(mount.parent.name,'suspension-rig');assert.ok(mount.position.z>.60);assert.equal(sticker.rotation.y,0);
    const materials=new Set();model.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  }
});
test('waiting room broadcasts server-approved styles and restores style when switching chair',()=>{
  const db=new Accounts(':memory:');try{
    const id=user(db),m=new RoomManager(db),c={user:db.profile(id),messages:[],ws:{readyState:1,send:raw=>c.messages.push(JSON.parse(raw))}};
    db.economy.customize(id,{chairId:'comet',color:'#123abc',logoId:null});m.add(c);m.join(c,{roomId:'room-1',logoId:'ricard',customColor:'#ff0000'});
    assert.equal(c.racer.logoId,null);assert.equal(c.racer.customColor,'#123abc');
    m.configure(c,{chairId:'atlas'});assert.equal(c.racer.customColor,null);
    m.configure(c,{chairId:'comet'});assert.equal(c.racer.customColor,'#123abc');m.start(c);assert.equal(c.racer.customColor,'#123abc');
  }finally{db.close();}
});
test('authenticated HTTP customization persists across restart; other users stay unchanged',{timeout:30000},async()=>{
  const server=await startTestServer(8138);try{
    const a=await register(server.url,'Painter'),b=await register(server.url,'Observer');
    const send=(data,cookie=a.cookie,origin=server.url)=>fetch(server.url+'/api/customization',{method:'POST',headers:{'Content-Type':'application/json',cookie,origin},body:JSON.stringify(data)});
    const data={chairId:'comet',color:'#45abef',logoId:null};
    assert.equal((await send(data,'')).status,401);assert.equal((await send(data,a.cookie,'https://untrusted.example')).status,403);
    assert.equal((await send({...data,logoId:'ricard'})).status,400);assert.equal((await send(data)).status,200);
    await server.restart();const p=await (await fetch(server.url+'/api/me',{headers:{cookie:a.cookie}})).json();
    assert.deepEqual(p.user.progression.chairStyles.comet,{color:'#45abef',logoId:null});
    const other=await (await fetch(server.url+'/api/me',{headers:{cookie:b.cookie}})).json();assert.deepEqual(other.user.progression.chairStyles,{});
  }finally{await server.close();}
});
test('real sockets share color/logo in lobby and race; forging or live edits cannot equip locked logos',{timeout:30000},async()=>{
  const server=await startTestServer(8140),sockets=[];let db;
  try{
    const a=await register(server.url,'LogoDriver'),b=await register(server.url,'LogoWitness');
    db=new Accounts(join(server.directory,'test.sqlite'));
    db.recordResult({raceId:'earned-looser',userId:a.user.id,trackId:'coast',time:80,place:12});db.close();db=null;
    async function connect(account){
      const ws=new WebSocket(server.url.replace('http','ws')+'/ws',{headers:{Cookie:account.cookie,Origin:server.url}}),messages=[];sockets.push(ws);
      ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));
      const wait=async predicate=>{for(let i=0;i<200;i++){const value=messages.find(predicate);if(value)return value;await new Promise(r=>setTimeout(r,20));}throw Error('Missing cosmetic state');};
      await wait(m=>m.type==='hello');return {ws,messages,wait,send:data=>ws.send(JSON.stringify(data))};
    }
    const driver=await connect(a),witness=await connect(b);
    driver.send({type:'join_room',roomId:'room-1'});await driver.wait(m=>m.type==='joined');
    witness.send({type:'join_room',roomId:'room-1'});await witness.wait(m=>m.type==='joined');
    const save=body=>fetch(server.url+'/api/customization',{method:'POST',headers:{cookie:a.cookie,Origin:server.url,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await save({chairId:'comet',color:'#22bbcc',logoId:'looser'})).status,200);
    const shared=await witness.wait(m=>m.type==='state'&&m.racers.some(r=>r.id==='p-'+a.user.id&&r.logoId==='looser'));
    assert.equal(shared.racers.find(r=>r.id==='p-'+a.user.id).customColor,'#22bbcc');
    assert.equal(shared.racers.find(r=>r.id==='p-'+b.user.id).logoId,null);
    driver.send({type:'configure',logoId:'ricard',customColor:'#ff0000'});driver.send({type:'start'});
    const race=await witness.wait(m=>m.type==='state'&&m.lobby.phase==='countdown');
    const racer=race.racers.find(r=>r.id==='p-'+a.user.id);assert.equal(racer.logoId,'looser');assert.equal(racer.customColor,'#22bbcc');
    assert.equal((await save({chairId:'comet',color:'#ffffff',logoId:null})).status,409);
  }finally{db?.close();for(const ws of sockets)ws.terminate();await server.close();}
});
