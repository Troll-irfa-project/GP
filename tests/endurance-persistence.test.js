import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {Accounts} from '../backend/accounts.js';
import {startTestServer,register} from './helpers.js';

test('public endurance records and rewards survive server/database restart without changing sprint history',async()=>{
  const server=await startTestServer(8130);let db;
  try{
    const account=await register(server.url);db=new Accounts(join(server.directory,'test.sqlite'));
    const base={userId:account.user.id,trackId:'coast',difficulty:'100',place:1,bestLap:20};
    db.recordResult({...base,raceId:'old-sprint',time:75});
    db.recordResult({...base,raceId:'long-race',time:400,mode:'endurance',pitStops:3,perfectStops:2});
    db.recordResult({...base,raceId:'long-items',time:420,mode:'endurance',itemsEnabled:true,pitStops:2,perfectStops:1});
    const profile=db.profile(account.user.id),before=await (await fetch(server.url+'/api/leaderboards')).json();
    assert.equal(before.circuits.find(c=>c.trackId==='coast').races[0].timeMs,75000);
    assert.equal(before.endurance.find(c=>c.trackId==='coast').races[0].timeMs,400000);
    assert.equal(before.enduranceWithItems.find(c=>c.trackId==='coast').races[0].timeMs,420000);
    db.close();db=null;await server.restart();db=new Accounts(join(server.directory,'test.sqlite'));
    assert.deepEqual(db.profile(account.user.id),profile);assert.deepEqual(await (await fetch(server.url+'/api/leaderboards')).json(),before);
    db.recordResult({...base,raceId:'long-race',time:390,mode:'endurance',pitStops:99,perfectStops:99});assert.deepEqual(db.profile(account.user.id),profile);
  }finally{db?.close();await server.close();}
});
