import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { startTestServer } from './helpers.js';
import { Accounts } from '../backend/accounts.js';
import { RoomManager } from '../backend/rooms.js';
import { chairs,tracks,pilots } from '../public/catalog.js';
import { createCourse,pointAt } from '../public/racing.js';
import { useItem,collectItems } from '../public/items.js';

// Real RoomManager behind a test-only intercepted socket. No debug/cheat endpoint
// is added to the shipped server. Test controls seed positions and loot only.
test('browser objects: host toggle, 3D boxes/traps, A not Q, three charges, effects and clean exit', {timeout:90000}, async()=>{
  const server=await startTestServer(8127),db=new Accounts(':memory:');let browser,timer;
  try{
    db.db.prepare("INSERT INTO users(id,username,username_key,password_hash,created_at) VALUES('items','ItemsQA','items','fixture',0)").run();
    const user=db.profile('items'),manager=new RoomManager(db);let client;
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],received=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))errors.push(m.text());});
    await page.route('**/api/me',r=>r.fulfill({json:{user}}));
    await page.routeWebSocket('**',route=>{
      client={user,ws:{readyState:1,send:raw=>route.send(raw)}};
      route.send(JSON.stringify({type:'hello',user,chairs,tracks,pilots}));manager.add(client);
      route.onMessage(raw=>{const data=JSON.parse(raw.toString());received.push(data);manager.handle(client,data);});
    });
    await page.goto(server.url);await page.locator('[data-room="room-1"]').click();
    await page.locator('#competitionItems').selectOption('on');
    await page.waitForFunction(()=>document.querySelector('#competitionItems').value==='on');
    const room=manager.rooms.get('room-1'),course=createCourse(tracks.find(t=>t.id==='coast'));
    await page.locator('.item-guide summary').click();assert.equal(await page.locator('.item-guide article').count(),6);
    await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/items-options.png',fullPage:true});
    await page.evaluate(async()=>{
      const THREE=await import('/three.js');window.itemFrames=[];
      THREE.Scene.prototype.onAfterRender=function(renderer,scene,camera){
        const player=scene.children.find(o=>o.userData.isPlayer),boxes=scene.getObjectByName('mystery-boxes'),traps=scene.getObjectByName('ladder-traps');
        if(!player||!boxes)return;window.itemFrame={boxes:boxes.count,traps:traps?.count||0,spin:player.userData.pose.spin,yaw:player.rotation.y,heading:player.userData.pose.heading,geometries:renderer.info.memory.geometries,calls:renderer.info.render.calls};
        window.itemFrames.push(window.itemFrame);if(window.itemFrames.length>400)window.itemFrames.shift();
      };
    });
    await page.locator('#launchRace').click();
    while(room.phase!=='countdown')await new Promise(r=>setTimeout(r,20));
    manager.tick(3.01);manager.broadcast(room);
    // Freeze dynamics between controlled steps; keep normal 15Hz snapshots.
    timer=setInterval(()=>manager.broadcast(room),66);
    const me=client.racer;
    await page.waitForFunction(()=>window.itemFrame?.boxes===12);
    assert.equal(await page.locator('#itemHud').isVisible(),true);assert.equal(await page.locator('#competitionItems').isDisabled(),true);
    await page.keyboard.press('a');assert.equal(received.filter(m=>m.type==='use_item').length,1);assert.equal(Boolean(me.input.left),false);
    await page.keyboard.down('q');await page.waitForTimeout(50);assert.equal(me.input.left,true);assert.equal(received.filter(m=>m.type==='use_item').length,1);await page.keyboard.up('q');
    const box=room.items.boxes[1];Object.assign(me,{x:box.x,z:box.z,lastAlong:course.total*.09});
    collectItems(room.racers,course,room.items,new Map(),room.raceTime,()=>.70);manager.broadcast(room);
    await page.waitForFunction(()=>document.querySelector('#itemCharges').textContent==='×3');
    assert.equal(me.item,'viagra-box');await page.waitForFunction(()=>window.itemFrame.boxes===11);
    await page.waitForTimeout(600);await page.screenshot({path:'test-results/items-pickup.png'});
    await page.keyboard.down('a');await page.keyboard.down('a');await page.waitForTimeout(50);manager.tick(1/60);manager.broadcast(room);
    await page.waitForFunction(()=>document.querySelector('#itemCharges').textContent==='×2');
    assert.equal(me.itemStats.uses,1);assert.equal(me.input.left,false);assert.ok(me.itemBoost>0);
    await page.keyboard.up('a');await page.screenshot({path:'test-results/items-boost.png'});
    for(let i=0;i<2;i++){me.itemBoost=0;me.itemCooldown=0;manager.broadcast(room);await page.keyboard.press('a');await page.waitForTimeout(50);manager.tick(1/60);manager.broadcast(room);}
    assert.equal(me.item,null);assert.equal(me.itemStats.uses,3);
    me.item='ladder';me.itemCharges=1;me.itemCooldown=0;me.itemBoost=0;
    Object.assign(me,pointAt(course,20),{lastAlong:20,heading:0});
    useItem(me,room.racers,course,room.items,room.raceTime);manager.broadcast(room);
    await page.waitForFunction(()=>window.itemFrame.traps===13);
    await page.waitForTimeout(700);await page.screenshot({path:'test-results/items-ladder.png'});
    const trap=room.items.traps[0];Object.assign(me,{x:trap.x,z:trap.z});
    collectItems(room.racers,course,room.items,new Map([[me.id,pointAt(course,13)]]),room.raceTime);
    manager.broadcast(room);await page.waitForFunction(()=>window.itemFrames.some(f=>f.spin>0));
    for(let i=0;i<8;i++){manager.tick(1/60);manager.broadcast(room);await page.waitForTimeout(17);}
    assert.ok((await page.evaluate(()=>window.itemFrames)).some(f=>f.spin>0&&Math.abs(f.yaw-(-f.heading-Math.PI/2))>.3));
    const other=room.racers[1];me.stun=0;me.spin=0;
    room.racers.forEach((r,i)=>r.progress=i===0?2:i===1?2.1:0);me.item='revolver';me.itemCharges=1;me.itemCooldown=0;manager.broadcast(room);
    await page.waitForFunction(()=>document.querySelector('#itemName').textContent==='REVOLVER');await page.locator('#useItem').click();await page.waitForTimeout(50);manager.tick(1/60);manager.broadcast(room);
    assert.equal(other.stun,1);await page.waitForTimeout(200);await page.screenshot({path:'test-results/items-revolver.png'});
    other.stun=0;
    other.item='lexomil';other.itemCharges=1;other.itemCooldown=0;useItem(other,room.racers,course,room.items,room.raceTime);
    other.item='round';other.itemCharges=1;other.itemCooldown=0;useItem(other,room.racers,course,room.items,room.raceTime);manager.broadcast(room);
    await page.waitForFunction(()=>document.querySelector('#game').dataset.blurIntensity==='0.5');
    assert.match(await page.locator('#itemEffects').textContent(),/VMAX −20 %/);assert.equal(await page.locator('#game').evaluate(e=>e.style.filter),'blur(4px)');
    await page.screenshot({path:'test-results/items-blur.png'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/items-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(await page.locator('#useItem').isVisible());
    const stats=await page.evaluate(()=>window.itemFrame);assert.ok(stats.calls<240);assert.ok(stats.geometries<450);
    await page.locator('#backButton').click();await page.locator('#roomBrowser').waitFor();
    db.recordResult({raceId:'plain',userId:user.id,trackId:'coast',time:80,bestLap:25,place:1});
    db.recordResult({raceId:'chaos',userId:user.id,trackId:'coast',time:70,bestLap:20,place:1,itemsEnabled:true});
    await page.route('**/api/leaderboards',route=>route.fulfill({json:{circuits:tracks.map(t=>db.leaderboard(t.id)),withItems:tracks.map(t=>db.leaderboard(t.id,true))}}));
    await page.locator('#openRecords').click();await page.locator('#recordsTrack').selectOption('coast');
    await page.waitForFunction(()=>document.querySelector('#globalRaces').textContent.includes('1:20.000'));
    await page.locator('#recordsItems').selectOption('on');await page.waitForFunction(()=>document.querySelector('#globalRaces').textContent.includes('1:10.000'));
    await page.locator('#closeRecords').click();
    assert.equal(await page.locator('#game').evaluate(e=>e.style.filter),'');
    clearInterval(timer);await page.setViewportSize({width:1440,height:900});
    await page.locator('[data-room="room-1"]').click();await page.locator('#competitionItems').selectOption('off');
    await page.locator('#launchRace').click();while(room.phase!=='countdown')await new Promise(r=>setTimeout(r,20));manager.tick(3.01);manager.broadcast(room);
    await page.locator('#race').waitFor({state:'visible'});await page.waitForTimeout(500);
    assert.equal(await page.locator('#itemHud').isVisible(),false);assert.equal(room.items.boxes.length,0);
    assert.deepEqual(errors,[]);
  }finally{clearInterval(timer);await browser?.close();db.close();await server.close();}
});
