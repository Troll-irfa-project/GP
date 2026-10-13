import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {startTestServer} from './helpers.js';
import {Accounts} from '../backend/accounts.js';
import {RoomManager} from '../backend/rooms.js';
import {chairs,tracks,pilots} from '../public/catalog.js';
import {createCourse,pointAt} from '../public/racing.js';
import {pitZone} from '../public/endurance.js';

test('browser endurance: 15 laps, physical pit lane, keyboard/touch QTE, tyre reset, finish and exclusive rewards',{timeout:90000},async()=>{
  const server=await startTestServer(8129),db=new Accounts(':memory:');let browser,timer,client,run=false;
  try{
    db.db.prepare("INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES('end','EnduranceQA','enduranceqa','fixture',0)").run();
    const user=db.profile('end'),manager=new RoomManager(db),room=manager.rooms.get('room-1'),course=createCourse(tracks.find(t=>t.id==='coast'));
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/me',r=>r.fulfill({json:{user:db.profile(user.id)}}));
    await page.route('**/api/shop/buy',async route=>{try{db.economy.buy(user.id,route.request().postDataJSON().itemId);await route.fulfill({json:{user:db.profile(user.id)}});}catch(e){await route.fulfill({status:400,json:{error:e.message}});}});
    await page.routeWebSocket('**',route=>{
      client={user,ws:{readyState:1,send:raw=>route.send(raw)}};route.send(JSON.stringify({type:'hello',user,chairs,tracks,pilots}));manager.add(client);
      route.onMessage(raw=>manager.handle(client,JSON.parse(raw.toString())));
    });
    let frames=0;timer=setInterval(()=>{if(run)manager.tick(1/60);if(++frames%4===0)manager.broadcast(room);},1000/60);
    await page.goto(server.url);await page.locator('#openCollection').click();
    for(const id of ['pilot-nora','pilot-sacha','chair-stint','chair-relay'])assert.equal(await page.locator(`[data-item="${id}"]`).isDisabled(),true);
    await page.locator('#closeCollection').click();await page.locator('[data-room="room-1"]').click();await page.locator('#competitionMode').selectOption('endurance');await page.locator('#competitionItems').selectOption('on');
    await page.waitForFunction(()=>document.querySelector('#launchRace').textContent==='LANCER LES 15 TOURS');
    await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/endurance-options.png',fullPage:true});
    await page.locator('#roomGarageButton').click();await page.waitForFunction(()=>document.querySelector('#gridLabel').textContent.includes('15 tours'));
    await page.locator('#circuitStep').click();assert.match(await page.locator('.track-card small').first().textContent(),/15 TOURS/);
    await page.locator('#startButton').click();
    await page.evaluate(async()=>{
      const THREE=await import('/three.js');THREE.Scene.prototype.onAfterRender=function(renderer,scene){
        const player=scene.children.find(o=>o.userData.isPlayer),pit=scene.getObjectByName('endurance-pit');
        if(player&&pit)window.enduranceFrame={pitVisible:pit.visible,x:player.position.x,z:player.position.z,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries};
      };
    });
    await page.locator('#launchRace').click();run=true;
    await page.waitForFunction(()=>window.enduranceFrame?.pitVisible&&document.querySelector('#countdown').textContent==='');run=false;
    assert.match(await page.locator('#lapText').textContent(),/\/ 15/);assert.equal(await page.locator('#requestPit').isDisabled(),true);
    const me=client.racer,zone=pitZone(course);Object.assign(me,{...pointAt(course,2),heading:0,lastAlong:2,completedLaps:4,lapStarted:true,lap:5,tyreAge:4,nextCheckpoint:1});manager.broadcast(room);
    await page.waitForFunction(()=>document.querySelector('#tyreStatus').textContent==='VMAX −10 %');await page.waitForTimeout(650);
    await page.screenshot({path:'test-results/endurance-lane.png'});
    await page.keyboard.press('e');await page.waitForTimeout(60);assert.equal(me.pitRequested,true);
    manager.tick(1/60);assert.equal(me.pit,null,'request away from lane must not teleport');
    Object.assign(me,{x:zone.x,z:zone.z,lastAlong:16});manager.tick(1/60);manager.broadcast(room);
    await page.locator('#pitQte').waitFor({state:'visible'});assert.equal(await page.locator('#pitSequence span').count(),4);assert.equal(me.speed,0);
    run=true;
    const waitPitReady=async()=>{for(let i=0;i<200;i++){if(me.pit&&room.raceTime>=me.pit.nextKeyAt+.05)return;await page.waitForTimeout(25);}throw Error('Pit key did not become ready');};
    await waitPitReady();
    const wrong=me.pit.sequence[0]==='arrowup'?'ArrowDown':'ArrowUp';await page.keyboard.press(wrong);
    await page.waitForFunction(()=>document.querySelector('#pitProgress').textContent.includes('1 erreur'));
    assert.equal(me.pit.index,0);await page.waitForTimeout(500);
    await page.screenshot({path:'test-results/endurance-qte.png'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/endurance-qte-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const pos={x:me.x,z:me.z};
    for(let i=0;i<4;i++){
      await waitPitReady();const next=me.pit.sequence[i];
      if(i<2)await page.keyboard.press(({arrowup:'ArrowUp',arrowdown:'ArrowDown',arrowleft:'ArrowLeft',arrowright:'ArrowRight'})[next]);
      else await page.locator(`[data-pit-key="${next}"]`).click();
      if(i<3){await page.waitForFunction(index=>document.querySelector('#pitProgress').textContent.startsWith(index+' /'),i+1);assert.equal(me.x,pos.x);assert.equal(me.z,pos.z);await page.waitForTimeout(170);}
    }
    await page.locator('#pitQte').waitFor({state:'hidden'});run=false;assert.equal(me.tyreAge,0);assert.equal(me.pitStops,1);assert.equal(me.perfectStops,0);
    assert.equal(await page.locator('#tyreStatus').textContent(),'PNEUS NEUFS');assert.equal(me.speed,0);
    await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'test-results/endurance-new-tyres.png'});
    // Seed only progress; the actual finish is a physical crossing in the room engine.
    Object.assign(me,{...pointAt(course,-.3),heading:0,lastAlong:course.total-.3,completedLaps:14,lap:15,nextCheckpoint:0,lapStarted:true,lapStartTime:room.raceTime-25,speed:8,input:{gas:true}});run=true;
    await page.locator('#result').waitFor({timeout:7000});run=false;
    assert.equal(me.completedLaps,15);assert.equal(db.profile(user.id).progression.metrics.enduranceFinishes,1);assert.equal(db.leaderboard('coast').races.length,0);assert.equal(db.leaderboard('coast',true,'endurance').races.length,1);
    await page.locator('#againButton').click();await page.locator('#leaveRoomButton').click();
    await page.route('**/api/leaderboards',r=>r.fulfill({json:{circuits:tracks.map(t=>db.leaderboard(t.id)),withItems:tracks.map(t=>db.leaderboard(t.id,true)),endurance:tracks.map(t=>db.leaderboard(t.id,false,'endurance')),enduranceWithItems:tracks.map(t=>db.leaderboard(t.id,true,'endurance'))}}));
    await page.locator('#openRecords').click();await page.locator('#recordsTrack').selectOption('coast');await page.locator('#recordsItems').selectOption('on');await page.locator('#recordsMode').selectOption('endurance');
    await page.waitForFunction(()=>document.querySelector('#globalRaces').textContent.includes('EnduranceQA'));assert.match(await page.locator('#recordsRaceTitle').textContent(),/15 TOURS/);
    await page.locator('#recordsMode').selectOption('race');assert.equal(await page.locator('#globalRaces .record-row').count(),0);await page.locator('#closeRecords').click();
    for(let i=0;i<10;i++)db.recordResult({raceId:'end-unlock-'+i,userId:user.id,trackId:tracks[i%5].id,time:350,bestLap:20,place:1,difficulty:'150',mode:'endurance',itemsEnabled:i%2===0,pitStops:2,perfectStops:2});
    db.economy.grant(user.id,'end-test-funds','Test fixture',{coins:40000,xp:60000});manager.send(client,'profile',{user:db.profile(user.id)});
    await page.locator('#openCollection').click();
    for(const id of ['pilot-nora','pilot-sacha','chair-stint','chair-relay']){await page.locator(`[data-item="${id}"][data-action="buy"]`).click();await page.locator(`[data-item="${id}"][data-action="equip"]`).waitFor();}
    await page.locator('#closeCollection').click();await page.locator('[data-room="room-1"]').click();await page.locator('#roomGarageButton').click();
    await page.locator('[data-pilot="nora"]').click();await page.locator('#chairTab').click();await page.locator('[data-chair="stint"]').click();await page.waitForTimeout(300);await page.screenshot({path:'test-results/endurance-stint-nora.png'});
    await page.locator('#pilotTab').click();await page.locator('[data-pilot="sacha"]').click();await page.locator('#chairTab').click();await page.locator('[data-chair="relay"]').click();await page.waitForTimeout(300);await page.screenshot({path:'test-results/endurance-relay-sacha.png'});
    assert.deepEqual(errors,[]);
  }finally{clearInterval(timer);await browser?.close();db.close();await server.close();}
});
