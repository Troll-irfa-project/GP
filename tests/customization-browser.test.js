import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Accounts} from '../backend/accounts.js';
import {logos} from '../public/logo-catalog.js';
import {startTestServer,signInPage,enterGarage,startRoomRace} from './helpers.js';
test('garage colors/logos, locked preview, free unlock, network appearance and restart',{timeout:90000},async()=>{
  const server=await startTestServer(8139);let browser,db;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const user=await signInPage(page,server.url);db=new Accounts(join(server.directory,'test.sqlite'));
    db.recordResult({raceId:'first-style-race',userId:user.id,trackId:'coast',time:85,bestLap:26,place:12});
    const before=db.profile(user.id).progression;db.close();db=null;
    await page.goto(server.url);await enterGarage(page);
    await page.evaluate(async()=>{
      const THREE=await import('/three.js');
      THREE.Scene.prototype.onAfterRender=function(renderer,scene){
        const model=scene.children.find(o=>o.userData.chairId);if(!model)return;
        const logo=model.getObjectByName('chair-logo');
        window.customizationRender={chair:model.userData.chairId,color:model.userData.customColor,logo:logo?.userData.logoId||null,loaded:!!logo?.material.map?.image,player:!!model.userData.isPlayer,logoMeshes:scene.children.filter(o=>o.getObjectByName('chair-logo')).length,calls:renderer.info.render.calls};
      };
    });
    await page.locator('#customizeTab').click();
    assert.equal(await page.locator('#logoChoices button').count(),14);
    assert.equal(await page.locator('#logoCount').textContent(),'1 / 13');
    await page.locator('[data-color="#9b78ff"]').click();await page.locator('[data-logo="ricard"]').click();
    assert.equal(await page.locator('#saveCustomization').isDisabled(),true);
    assert.match(await page.locator('#logoObjective').textContent(),/APERÇU UNIQUEMENT/);
    await page.locator('[data-logo="looser"]').click();
    await page.waitForFunction(()=>window.customizationRender?.logo==='looser'&&window.customizationRender?.color==='#9b78ff');
    await page.locator('#saveCustomization').click();
    await page.waitForFunction(()=>document.querySelector('#customizationStatus').textContent.includes('enregistrés'));
    const me=await (await page.request.get(server.url+'/api/me')).json();
    assert.equal(me.user.progression.coins,before.coins);assert.equal(me.user.progression.xp,before.xp);
    assert.deepEqual(me.user.progression.chairStyles.comet,{color:'#9b78ff',logoId:'looser'});
    await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/customization-desktop.png'});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/customization-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:900});await page.locator('#circuitStep').click();await startRoomRace(page);
    await page.waitForFunction(()=>window.customizationRender?.player&&window.customizationRender.logo==='looser');
    assert.equal((await page.evaluate(()=>window.customizationRender)).color,'#9b78ff');
    const locked=await page.request.post(server.url+'/api/customization',{headers:{origin:server.url},data:{chairId:'comet',color:'#ffffff',logoId:null}});assert.equal(locked.status(),409);
    await page.screenshot({path:'test-results/customization-race.png'});
    await page.locator('#backButton').click();await page.locator('[data-room="room-1"]').waitFor();
    await server.restart();await page.reload();await enterGarage(page);await page.locator('#customizeTab').click();
    assert.equal(await page.locator('#chairColor').inputValue(),'#9b78ff');assert.equal(await page.locator('[data-logo="looser"]').getAttribute('aria-pressed'),'true');
    const gallery=await browser.newPage({viewport:{width:1200,height:900}});
    await gallery.setContent(`<body style="margin:0;background:#102746;color:white;font:16px Arial"><h1 style="padding:20px">ROLL RUSH / COLLECTION DE LOGOS</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:20px">${logos.map(l=>`<div style="padding:14px;background:#fff;color:#132746;text-align:center;border-radius:12px"><img src="${server.url+l.art}" style="width:170px;height:150px;object-fit:contain"><p>${l.tier}. ${l.name}</p></div>`).join('')}</div></body>`);
    await gallery.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await gallery.screenshot({path:'test-results/logo-assets.png',fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{db?.close();await browser?.close();await server.close();}
});
