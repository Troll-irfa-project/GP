import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { join } from 'node:path';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { startTestServer,register,TEST_PASSWORD } from './helpers.js';

const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function client(url,account) {
  const ws=new WebSocket(url.replace('http','ws')+'/ws',{headers:{Cookie:account.cookie,Origin:url}}),messages=[];
  ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));
  const value={ws,messages,mark:()=>messages.length,send:data=>ws.send(JSON.stringify(data)),async wait(test,from=0){for(let i=0;i<250;i++){const m=messages.slice(from).find(test);if(m)return m;await pause(20);}throw new Error('Expected WS message not received');}};
  await value.wait(m=>m.type==='hello');return value;
}
async function post(url,path,data,cookie='',origin=url) {return fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(data)});}

test('accounts: validation, cookie security, login, persistence, logout and private records', {timeout:45000}, async()=>{
  const server=await startTestServer(8110),url=server.url;
  try {
    assert.equal((await post(url,'/api/register',{username:'aa',password:TEST_PASSWORD})).status,400);
    assert.equal((await post(url,'/api/register',{username:'Valid',password:'short'})).status,400);
    const a=await register(url,'Alice_Test');
    assert.equal((await post(url,'/api/register',{username:'alice_test',password:TEST_PASSWORD})).status,409);
    const wrong=await post(url,'/api/login',{username:'Alice_Test',password:'Wrong password'});
    const missing=await post(url,'/api/login',{username:'Unknown',password:'Wrong password'});
    assert.equal(wrong.status,401);assert.deepEqual(await wrong.json(),await missing.json());
    const login=await post(url,'/api/login',{username:'ALICE_TEST',password:TEST_PASSWORD});
    assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
    const cookie=login.headers.get('set-cookie').split(';')[0];assert.notEqual(cookie,a.cookie);
    assert.equal((await post(url,'/api/profile',{favoriteChairIds:['drift','atlas']},cookie)).status,200);
    assert.equal((await post(url,'/api/profile',{racesWon:999,favoriteChairIds:[]},cookie)).status,400);
    assert.equal((await post(url,'/api/logout',{},cookie,'https://attacker.invalid')).status,403);
    const record=await (await fetch(url+'/api/me',{headers:{Cookie:cookie}})).json();
    assert.deepEqual(record.user.favoriteChairIds,['drift','atlas']);assert.ok(!JSON.stringify(record).includes('password'));
    assert.equal((await fetch(url+'/api/rooms')).status,401);
    assert.equal((await fetch(url+'/backend/accounts.js')).status,404);
    await server.restart();
    const restored=await (await fetch(url+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(restored.user.id,a.user.id);
    assert.deepEqual(restored.user.favoriteChairIds,['drift','atlas']);
    assert.equal((await post(url,'/api/logout',{},cookie)).status,200);
    assert.equal((await (await fetch(url+'/api/me',{headers:{Cookie:cookie}})).json()).user,null);
    const db=new Accounts(join(server.directory,'test.sqlite'));
    const stored=db.db.prepare('SELECT password_hash FROM users').get().password_hash;
    assert.ok(stored.startsWith('scrypt$'));assert.ok(!stored.includes(TEST_PASSWORD));db.close();
  } finally {await server.close();}
});

test('rooms: host authority, isolation, 12 seats, takeover and departure during countdown/race', {timeout:45000}, async()=>{
  const server=await startTestServer(8111),url=server.url,sockets=[];
  try {
    const alice=await register(url,'Alice'),bob=await register(url,'Bob'),chloe=await register(url,'Chloe');
    const a=await client(url,alice),b=await client(url,bob),c=await client(url,chloe);sockets.push(a.ws,b.ws,c.ws);
    const listing=await a.wait(m=>m.type==='rooms');assert.equal(listing.rooms.length,3);
    a.send({type:'join_room',roomId:'room-1',chairId:'comet',pilotId:'maya',name:'Impostor'});
    const aj=await a.wait(m=>m.type==='joined');let s=await a.wait(m=>m.type==='state');
    assert.equal(s.racers.length,12);assert.equal(s.racers.filter(r=>r.isBot).length,11);assert.equal(s.lobby.hostId,aj.playerId);
    assert.equal(s.racers.find(r=>r.id===aj.playerId).name,'Alice');
    assert.equal(s.racers.some(r=>r.userId),false);
    b.send({type:'join_room',roomId:'room-1',chairId:'pulse',pilotId:'lina'});const bj=await b.wait(m=>m.type==='joined');
    s=await a.wait(m=>m.type==='state'&&m.racers.filter(r=>!r.isBot).length===2);assert.equal(s.racers.filter(r=>r.isBot).length,10);
    c.send({type:'join_room',roomId:'room-2'});await c.wait(m=>m.type==='joined');
    let mark=b.mark();b.send({type:'start'});await b.wait(m=>m.type==='error',mark);
    mark=b.mark();b.send({type:'configure',trackId:'orbit'});await b.wait(m=>m.type==='error',mark);
    a.send({type:'configure',trackId:'garden'});await b.wait(m=>m.type==='state'&&m.lobby.trackId==='garden');
    assert.ok(!c.messages.some(m=>m.type==='state'&&m.lobby.roomId==='room-1'),'no cross-room snapshots');
    mark=b.mark();a.send({type:'leave_room'});await b.wait(m=>m.type==='state'&&m.lobby.hostId===bj.playerId,mark);
    b.send({type:'start'});await b.wait(m=>m.type==='state'&&m.lobby.countdown===3);
    mark=a.mark();a.send({type:'join_room',roomId:'room-1'});await a.wait(m=>m.type==='error',mark);
    mark=c.mark();c.send({type:'leave_room'});await c.wait(m=>m.type==='left',mark);
    await b.wait(m=>m.type==='state'&&m.lobby.phase==='racing');
    b.send({type:'input',input:{gas:true,speedLimit:100000,steer:99}});
    const moving=await b.wait(m=>m.type==='state'&&m.racers.some(r=>r.id===bj.playerId&&r.speed>0));
    assert.equal(moving.racers.find(r=>r.id===bj.playerId).input.speedLimit,undefined);
    b.send({type:'leave_room'});await b.wait(m=>m.type==='left');
    const reopened=await a.wait(m=>m.type==='rooms'&&m.rooms.find(r=>r.id==='room-1').humans===0&&m.rooms.find(r=>r.id==='room-1').phase==='waiting',mark);
    assert.ok(reopened);
  } finally {for(const ws of sockets)ws.terminate();await server.close();}
});

test('room engine: capacity, oldest-human succession, bot relay and server-only saved results',()=>{
  const profiles=new Map(),saved=[];
  const accounts={profile:id=>profiles.get(id),preferences:(id,p)=>Object.assign(profiles.get(id),p),recordResult:r=>saved.push(r)};
  const manager=new RoomManager(accounts,3),people=Array.from({length:13},(_,i)=>{
    const user={id:'u'+i,username:'User'+i,chairId:'comet',pilotId:'maya'};profiles.set(user.id,user);
    const messages=[],c={user,ws:{readyState:1,send:raw=>messages.push(JSON.parse(raw))},messages};manager.add(c);return c;
  });
  for(const c of people.slice(0,12))manager.join(c,{roomId:'room-1'});
  const room=manager.rooms.get('room-1');assert.equal(room.racers.length,12);assert.equal(room.racers.filter(r=>r.isBot).length,0);
  manager.join(people[12],{roomId:'room-1'});assert.equal(people[12].messages.at(-1).type,'error');
  manager.start(people[0]);for(let i=0;i<185;i++)manager.tick(1/60);
  assert.equal(room.phase,'racing');const id=room.raceId,time=room.raceTime;
  manager.leave(people[0]);assert.equal(manager.host(room),people[1]);assert.equal(room.raceId,id);assert.equal(room.racers.length,12);assert.equal(room.racers.filter(r=>r.isBot).length,1);
  manager.tick(1/60);assert.ok(room.raceTime>time);
  const racer=people[1].racer;Object.assign(racer,{finished:true,finishTime:85,bestLapTime:26,progress:3});
  manager.tick(1/60);manager.tick(1/60);assert.equal(saved.length,1);assert.equal(saved[0].userId,'u1');assert.equal(saved[0].place,1);
  manager.handle(people[2],{type:'save_progress',racesWon:999});assert.equal(saved.length,1);
});

test('SQLite results are idempotent and keep faster times across database reopen',async()=>{
  const server=await startTestServer(8112);
  try {
    const a=await register(server.url,'Chronos');let db=new Accounts(join(server.directory,'test.sqlite'));
    const race={raceId:'verified-1',userId:a.user.id,trackId:'coast',time:93.123,bestLap:29.112,place:1};
    db.recordResult(race);db.recordResult(race);db.recordResult({...race,raceId:'verified-2',time:97,bestLap:28,place:3});db.close();
    db=new Accounts(join(server.directory,'test.sqlite'));const p=db.profile(a.user.id);
    assert.equal(p.racesFinished,2);assert.equal(p.racesWon,1);assert.equal(p.records[0].bestRaceMs,93123);assert.equal(p.records[0].bestLapMs,28000);assert.deepEqual(p.championships,[]);db.close();
  } finally {await server.close();}
});

test('WebSocket requires a session and same-origin, rejects duplicate seats, and logout migrates host', {timeout:30000}, async()=>{
  const server=await startTestServer(8113),url=server.url,sockets=[];
  const rejectedUpgrade=headers=>new Promise(resolve=>{
    const ws=new WebSocket(url.replace('http','ws')+'/ws',{headers});ws.on('error',()=>{});
    ws.on('unexpected-response',(_req,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});
    ws.on('open',()=>{ws.close();resolve(101);});
  });
  try {
    assert.equal(await rejectedUpgrade({Origin:url}),401);
    const alice=await register(url,'SocketAlice'),bob=await register(url,'SocketBob');
    assert.equal(await rejectedUpgrade({Cookie:alice.cookie,Origin:'https://evil.example'}),403);
    const a=await client(url,alice),b=await client(url,bob);sockets.push(a.ws,b.ws);
    const duplicate=new WebSocket(url.replace('http','ws')+'/ws',{headers:{Cookie:alice.cookie,Origin:url}});sockets.push(duplicate);
    const code=await new Promise(resolve=>duplicate.on('close',resolve));assert.equal(code,4009);
    a.send({type:'join_room',roomId:'room-1'});await a.wait(m=>m.type==='joined');
    b.send({type:'join_room',roomId:'room-1'});const joined=await b.wait(m=>m.type==='joined');
    const mark=b.mark();assert.equal((await post(url,'/api/logout',{},alice.cookie)).status,200);
    const s=await b.wait(m=>m.type==='state'&&m.lobby.hostId===joined.playerId,mark);
    assert.equal(s.racers.filter(r=>!r.isBot).length,1);
    for(let i=0;i<10;i++)assert.equal((await post(url,'/api/login',{username:'Nobody',password:'incorrect'})).status,401);
    assert.equal((await post(url,'/api/login',{username:'Nobody',password:'incorrect'})).status,429);
  } finally {for(const ws of sockets)ws.terminate();await server.close();}
});
