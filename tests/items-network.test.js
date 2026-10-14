import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {startTestServer,register} from './helpers.js';

test('real sockets: host option, shared loot and authoritative item activation', {timeout:45000},async()=>{
  const server=await startTestServer(8128),clients=[];
  try{
    for(let i=0;i<2;i++){
      const account=await register(server.url),messages=[];
      const ws=new WebSocket(server.url.replace('http','ws')+'/ws',{headers:{Cookie:account.cookie,Origin:server.url}});
      ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));
      const c={ws,messages,send:data=>ws.send(JSON.stringify(data)),async wait(predicate,from=0){const until=Date.now()+15000;while(Date.now()<until){const found=messages.slice(from).find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,25));}throw Error('No matching socket state');}};
      clients.push(c);await c.wait(m=>m.type==='hello');c.send({type:'join_room',roomId:'room-1',chairId:'pulse'});const joined=await c.wait(m=>m.type==='joined');c.id=joined.playerId;
    }
    const [a,b]=clients;let mark=b.messages.length;
    b.send({type:'configure',itemsEnabled:true});await b.wait(m=>m.type==='error',mark);
    a.send({type:'configure',itemsEnabled:true,difficulty:'50'});
    for(const c of clients){const state=await c.wait(m=>m.type==='state'&&m.lobby.itemsEnabled);assert.equal(state.items.boxes.length,12);}
    a.send({type:'start'});await a.wait(m=>m.type==='state'&&m.lobby.phase==='racing');
    a.send({type:'input',input:{gas:true}});b.send({type:'input',input:{gas:true}});
    const picked=await a.wait(m=>m.type==='state'&&m.racers.find(r=>r.id===a.id)?.item),r=picked.racers.find(r=>r.id===a.id);
    assert.ok(r.itemStats.boxes>0);assert.ok(picked.items.boxes.some(box=>box.respawn>0));
    a.send({type:'input',input:{}});b.send({type:'input',input:{}});
    if(r.item==='revolver')await a.wait(m=>m.type==='state'&&m.racers.some(other=>other.id!==a.id&&other.progress>m.racers.find(p=>p.id===a.id).progress));
    const from=a.messages.length,otherFrom=b.messages.length;
    a.send({type:'use_item',item:'forged',target:'forged',charges:999});
    const used=await a.wait(m=>m.type==='state'&&m.racers.find(r=>r.id===a.id)?.itemStats.uses===1,from);
    const self=used.racers.find(r=>r.id===a.id);assert.equal(self.itemCharges,r.itemCharges-1);
    const shared=await b.wait(m=>m.type==='state'&&m.racers.find(r=>r.id===a.id)?.itemStats.uses===1,otherFrom);
    assert.equal(shared.racers.find(r=>r.id===a.id).itemCharges,self.itemCharges);
    a.send({type:'configure',itemsEnabled:false});await a.wait(m=>m.type==='error',from);
    assert.equal(used.lobby.itemsEnabled,true);
  }finally{for(const c of clients)c.ws.close();await server.close();}
});
