import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { chairs,tracks,pilots } from '../public/catalog.js';
import { startTestServer,signInPage } from './helpers.js';

test('browser: global records, career locks, multiplayer settings and mobile layouts', {timeout:60000},async()=>{
  const server=await startTestServer(8122);let browser,db;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const user=await signInPage(page,server.url);
    db=new Accounts(join(server.directory,'test.sqlite'));
    db.recordResult({raceId:'browser-record',userId:user.id,trackId:'coast',time:82.123,bestLap:25.001,place:1});
    await page.goto(server.url);
    await page.locator('[data-career="50"]:enabled').waitFor();
    assert.equal(await page.locator('[data-career="100"]').isDisabled(),true);
    await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/competition-hub.png',fullPage:true});
    await page.locator('#openRecords').click();await page.locator('#recordsTrack').selectOption('coast');
    await page.locator('#globalRaces .record-row').waitFor();assert.match(await page.locator('#globalRaces').textContent(),/1:22.123/);
    assert.match(await page.locator('#globalLaps').textContent(),/0:25.001/);
    await page.screenshot({path:'test-results/global-records.png',fullPage:true});
    await page.locator('#closeRecords').click();await page.locator('[data-career="50"]').click();
    await page.locator('#roomRoster .room-seat').first().waitFor();
    assert.equal(await page.locator('#roomRoster .bot').count(),11);
    assert.equal(await page.locator('#competitionMode').inputValue(),'career');
    assert.equal(await page.locator('#competitionDifficulty').isDisabled(),true);
    await page.locator('#leaveRoomButton').click();
    await page.locator('[data-room="room-1"]').click();
    await page.locator('#competitionMode').selectOption('tournament');
    await page.locator('#competitionDifficulty').selectOption('200');
    await page.waitForFunction(()=>document.querySelector('#competitionDifficulty').value==='200');
    await page.locator('#roomGarageButton').click();await page.locator('#circuitStep').click();
    assert.equal(await page.locator('[data-track="coast"]').isDisabled(),true,'cup determines all tracks');
    await page.locator('#garageRoomButton').click();await page.locator('#leaveRoomButton').click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/career-mobile.png',fullPage:true});
    await page.locator('#openRecords').click();await page.locator('#globalRaces .record-row').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
  }finally{db?.close();await browser?.close();await server.close();}
});

test('browser: five real room-engine rounds, standings, next track and saved career unlock', {timeout:90000},async()=>{
  const server=await startTestServer(8123);let browser,db;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const user=await signInPage(page,server.url);
    db=new Accounts(join(server.directory,'test.sqlite'));
    const manager=new RoomManager(db);let client;
    // Network fixture runs the actual RoomManager. Only physics is fast-forwarded.
    // No test endpoints or client-supplied results exist in the shipped server.
    await page.routeWebSocket('**',route=>{
      client={user,ws:{readyState:1,send:raw=>route.send(raw)}};
      manager.send(client,'hello',{chairs,tracks,pilots,user,capacity:12});manager.add(client);
      route.onMessage(raw=>manager.handle(client,JSON.parse(String(raw))));
    });
    await page.goto(server.url);await page.locator('[data-career="50"]:enabled').click();
    for(let round=0;round<5;round++) {
      await page.locator('#launchRace').click();
      await page.waitForFunction(()=>!document.querySelector('#race').classList.contains('hidden'));
      const room=manager.rooms.get(client.roomId);
      assert.equal(room.cup.round,round);assert.equal(room.trackId,tracks[round].id);
      room.phase='racing';
      room.racers.forEach((r,i)=>Object.assign(r,{finished:true,finishTime:80+i,bestLapTime:25,progress:3}));
      manager.tick(1/60);
      await page.locator('#result').waitFor();
      assert.match(await page.locator('#resultCup').textContent(),new RegExp(`${15*(round+1)} pts`));
      if(round===4){await page.screenshot({path:'test-results/career-victory.png',fullPage:true});assert.match(await page.locator('#resultCup').textContent(),/VICTOIRE DE/);}
      await page.locator('#againButton').click();
      if(round<4)assert.match(await page.locator('#launchRace').textContent(),/COURSE SUIVANTE/);
    }
    await page.locator('#leaveRoomButton').click();
    assert.equal(await page.locator('[data-career="100"]').isDisabled(),false);
    assert.equal(await page.locator('[data-career="150"]').isDisabled(),true);
    assert.equal(db.profile(user.id).championships.length,1);
    assert.deepEqual(errors,[]);
  }finally{db?.close();await browser?.close();await server.close();}
});
