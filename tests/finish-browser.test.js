import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, enterGarage, startRoomRace } from './helpers.js';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { chairs, tracks, pilots } from '../public/catalog.js';
import { createCourse, spawnRacer } from '../public/racing.js';

// Deterministic network fixture exercises the shipped interpolation and UI without
// a privileged debug endpoint in the server or waiting through a three-lap race.
test('browser: finish is shown on the line, without waiting for unfinished rivals', {timeout:60000}, async () => {
  const port = 8103, url = `http://127.0.0.1:${port}`;
  const server = await startTestServer(port);
  let browser, timer;
  try {
    for (let i=0;i<100;i++) { try { if((await fetch(url)).ok) break; } catch {} await new Promise(r=>setTimeout(r,30)); }
    browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page = await browser.newPage({viewport:{width:1440,height:900}}), errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    const track = tracks.find(t=>t.id==='coast'), course=createCourse(track), gate=course.finishGate;
    const racers=Array.from({length:12},(_,i)=>{
      const r={id:i?'bot-'+i:'p-test',name:i?'Concurrent '+i:'Test arrivée',chairId:chairs[i%5].id,pilotId:pilots[i%pilots.length].id,isBot:i>0};
      spawnRacer(r,i,course); return r;
    });
    const me=racers[0]; Object.assign(me,{x:gate.x-1,z:gate.z,completedLaps:2,lapStarted:true,nextCheckpoint:0,lap:3,progress:2.99});
    const fixture={type:'state',lobby:{roomId:'room-1',roomName:'Test room',hostId:'p-test',phase:'waiting',trackId:track.id,track,laps:3,started:false,countdown:0,raceTime:90,winner:null,raceId:1},chairs,tracks,pilots,racers};
    const user={id:'test-account',username:'Test arrivée',chairId:'comet',pilotId:'hawking',favoriteChairIds:[],racesFinished:0,racesWon:0,records:[],championships:[]};
    await page.route('**/api/me',route=>route.fulfill({json:{user}}));
    let socket;
    const broadcast=()=>socket?.send(JSON.stringify({...fixture,serverTime:Date.now()}));
    await page.routeWebSocket('**', route=>{
      socket=route; route.send(JSON.stringify({type:'hello',chairs,tracks,pilots,user}));
      route.send(JSON.stringify({type:'rooms',rooms:[{id:'room-1',name:'Test room',trackId:'coast',phase:'waiting',humans:0,bots:12,capacity:12,host:null}]}));
      route.onMessage(raw=>{
        const message=JSON.parse(raw.toString());
        if(message.type==='join_room') {route.send(JSON.stringify({type:'joined',playerId:me.id,roomId:'room-1'}));broadcast();}
        if(message.type==='start') {fixture.lobby.started=true;fixture.lobby.phase='racing';broadcast();timer=setInterval(broadcast,66);}
      });
    });
    await page.goto(url); await enterGarage(page);
    await page.evaluate(async()=>{
      const THREE=await import('/three.js'); window.finishFrames=[];
      THREE.Scene.prototype.onAfterRender=function(renderer,scene){
        const player=scene.children.find(o=>o.userData.isPlayer),line=scene.getObjectByName('finish-line');
        if(player&&line) window.finishFrames.push({x:player.position.x,z:player.position.z,finished:player.userData.pose.finished,lineX:line.position.x,lineZ:line.position.z});
      };
    });
    await page.locator('#circuitStep').click(); await page.locator('[data-track="coast"]').click(); await startRoomRace(page);
    await page.waitForFunction(()=>window.finishFrames.length>15);
    assert.equal(await page.locator('#result').isVisible(),false);
    assert.equal(await page.locator('#countdown').textContent(),'');
    Object.assign(me,{x:gate.x,z:gate.z,finished:true,completedLaps:3,progress:3,finishTime:90.025,speed:0});
    fixture.lobby.winner=me.name; broadcast();
    await page.waitForFunction(()=>document.querySelector('#countdown').textContent==='ARRIVÉE !');
    await mkdir('test-results',{recursive:true}); await page.screenshot({path:'test-results/finish-line.png'});
    const frames=await page.evaluate(()=>window.finishFrames);
    assert.ok(frames.some(f=>!f.finished&&f.x<gate.x));
    for(const f of frames.filter(f=>f.finished)) {assert.ok(Math.abs(f.x-f.lineX)<1e-8);assert.ok(Math.abs(f.z-f.lineZ)<1e-8);}
    await page.locator('#result').waitFor({timeout:5000});
    assert.equal(racers.filter(r=>r.finished).length,1,'UI must not require bots to finish');
    assert.match(await page.locator('#resultTitle').textContent(),/GAGNÉ/);
    assert.equal(await page.locator('#resultRanking .rank small').filter({hasText:'EN COURSE'}).count(),11);
    Object.assign(racers[1],{finished:true,finishTime:93.33,progress:3}); broadcast();
    await page.waitForFunction(()=>document.querySelectorAll('#resultRanking .rank small')[1]?.textContent==='1:33.330');
    assert.match(await page.locator('#resultRanking .rank').first().textContent(),/Test arrivée/);
    await page.screenshot({path:'test-results/finish-result.png'});
    assert.deepEqual(errors,[]);
  } finally {clearInterval(timer);await browser?.close();await server.close();}
});
