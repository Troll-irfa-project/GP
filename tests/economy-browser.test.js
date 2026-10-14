import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { Accounts } from '../backend/accounts.js';
import { tracks } from '../public/catalog.js';
import { startTestServer,signInPage,enterGarage } from './helpers.js';

test('browser: shop, achievements, owned pilots/chairs, paint in 3D and persistent equipment', {timeout:90000},async()=>{
  const server=await startTestServer(8125);let browser,db;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const user=await signInPage(page,server.url);await page.goto(server.url);
    await page.locator('#openCollection').click();
    assert.equal(await page.locator('[data-item="paint-lagoon"]').isDisabled(),true);
    assert.equal(await page.locator('[data-item="module-start"]').isDisabled(),true);
    await page.locator('#closeCollection').click();await enterGarage(page);
    assert.equal(await page.locator('[data-pilot="aurore"]').isDisabled(),false);
    assert.equal(await page.locator('[data-pilot="hawking"]').isDisabled(),false);
    await page.locator('#chairTab').click();assert.equal(await page.locator('[data-chair="vector"]').isDisabled(),true);
    await page.locator('#garageRoomButton').click();await page.locator('#leaveRoomButton').click();
    db=new Accounts(join(server.directory,'test.sqlite'));
    for(let i=0;i<150;i++)db.recordResult({raceId:'qa-'+i,userId:user.id,trackId:tracks[i%5].id,time:80,bestLap:25,place:1});
    await page.reload();await page.locator('#openCollection').click();
    await mkdir('test-results',{recursive:true});
    await page.screenshot({path:'test-results/shop-desktop.png',fullPage:true});
    const buy=async id=>{await page.locator(`[data-item="${id}"][data-action="buy"]`).click();await page.locator(`[data-item="${id}"][data-action="equip"]`).waitFor();};
    for(const id of ['paint-lagoon','module-start','pilot-aurore','chair-vector','title-rookie'])await buy(id);
    for(const id of ['paint-lagoon','module-start','title-rookie']){await page.locator(`[data-item="${id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-item="${id}"]`).textContent==='RETIRER',id);}
    await page.locator('#achievementsTab').click();assert.equal(await page.locator('.achievement-card.earned').count(),11);
    await page.screenshot({path:'test-results/achievements-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/achievements-mobile.png',fullPage:true});
    await page.locator('#shopTab').click();await page.locator('#shopFilter').selectOption('paint');
    assert.equal(await page.locator('#shopGrid .shop-card').count(),3);
    await page.screenshot({path:'test-results/shop-mobile.png',fullPage:true});
    await page.locator('#closeCollection').click();await page.setViewportSize({width:1440,height:900});
    await enterGarage(page);await page.locator('[data-pilot="aurore"]').click();await page.locator('#chairTab').click();await page.locator('[data-chair="vector"]').click();
    await page.screenshot({path:'test-results/vector-aurore-garage.png'});
    await page.locator('#garageRoomButton').click();assert.match(await page.locator('#roomRoster .self').textContent(),/Étoile montante/);
    await page.evaluate(async()=>{
      const THREE=await import('/three.js');
      THREE.Scene.prototype.onAfterRender=function(_r,scene){const player=scene.children.find(o=>o.userData.isPlayer);if(player){const colors=[];player.traverse(o=>{if(o.material?.color)colors.push(o.material.color.getHexString());});window.equipmentFrame={chair:player.userData.chairId,pilot:player.userData.pilotId,paint:player.userData.paintId,colors};}};
    });
    const response=await page.request.post(server.url+'/api/shop/equip',{headers:{Origin:server.url},data:{slot:'upgrade',itemId:null}});assert.equal(response.status(),409,'no changes in an active room');
    await page.locator('#launchRace').click();await page.waitForFunction(()=>window.equipmentFrame?.paint==='paint-lagoon');
    const frame=await page.evaluate(()=>window.equipmentFrame);assert.equal(frame.chair,'vector');assert.equal(frame.pilot,'aurore');assert.ok(frame.colors.includes('21d9bd'));
    await page.screenshot({path:'test-results/vector-aurore-race.png'});
    await page.locator('#backButton').click();await page.reload();await page.locator('#openCollection').click();
    assert.equal(await page.locator('[data-item="paint-lagoon"]').textContent(),'RETIRER');
    assert.equal(db.profile(user.id).progression.upgrade,'module-start');
    // Bounded trusted fixture: unlock the F1 through verified results, fund its purchase.
    for(let i=0;i<20;i++)db.recordResult({raceId:'f1-'+i,userId:user.id,trackId:tracks[i%5].id,time:55,bestLap:17,place:1,difficulty:'150'});
    db.economy.grant(user.id,'f1-fixture','Test fixture',{coins:10000,xp:0});
    await page.reload();await page.locator('#openCollection').click();
    assert.equal(await page.locator('[data-item="pilot-hawking"]').isDisabled(),true);
    await buy('chair-apex');await page.locator('#closeCollection').click();await enterGarage(page);
    await page.locator('#chairTab').click();await page.locator('[data-chair="apex"]').click();
    assert.deepEqual(await page.locator('[role="meter"]').evaluateAll(els=>els.map(el=>Number(el.getAttribute('aria-valuenow')))),[10,10,4]);
    await page.screenshot({path:'test-results/apex-f1-garage.png'});
    await page.locator('#garageRoomButton').click();await page.locator('#launchRace').click();
    await page.locator('#race').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#countdown').textContent!=='');
    await page.waitForFunction(()=>document.querySelector('#raceMapDots').children.length===12 && document.querySelector('#countdown').textContent==='');
    await page.screenshot({path:'test-results/apex-f1-race.png'});
    await page.locator('#backButton').click();assert.deepEqual(errors,[]);
  }finally{db?.close();await browser?.close();await server.close();}
});
