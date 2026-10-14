import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {Accounts} from '../backend/accounts.js';
import {startTestServer,signInPage,enterGarage} from './helpers.js';

test('legendary shop purchase, scrolling selection and 3D race models', {timeout:120000},async()=>{
  const server=await startTestServer(8135);let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const user=await signInPage(page,server.url);
    const db=new Accounts(join(server.directory,'test.sqlite'));
    db.economy.grant(user.id,'legendary-fixture','Test fixture',{coins:200000,xp:0});db.close();
    await page.goto(server.url);
    await page.locator('#openCollection').click();
    await page.locator('#shopFilter').selectOption('legendary');
    assert.equal(await page.locator('#shopGrid .legendary').count(),12);
    assert.equal(await page.locator('[data-item="pilot-bran"]').isDisabled(),true);
    const denied=await page.request.post(server.url+'/api/shop/buy',{headers:{Origin:server.url},data:{itemId:'pilot-bran'}});
    assert.equal(denied.status(),400);
    const fixture=new Accounts(join(server.directory,'test.sqlite'));
    for(const trackId of ['coast','neon','metro','garden','orbit'])fixture.recordResult({raceId:'legend-'+trackId,userId:user.id,trackId,time:80,bestLap:25,place:1,difficulty:'200'});
    fixture.close();
    await page.reload();await page.locator('#openCollection').click();
    await page.locator('#shopFilter').selectOption('legendary');
    await page.locator('[data-item="pilot-bran"]').click();
    await page.getByText('Bran Stark rejoint ta collection !',{exact:true}).waitFor();
    await mkdir('test-results',{recursive:true});
    await page.screenshot({path:'test-results/legendary-shop.png'});
    await page.locator('#closeCollection').click();
    await enterGarage(page);
    await page.locator('[data-pilot="bran"]').click();
    assert.equal(await page.locator('#selectionName').textContent(),'Bran Stark');
    await page.screenshot({path:'test-results/legendary-garage.png'});
    await page.locator('[data-pilot="hector"]').click();
    assert.equal(await page.locator('#garagePreview').getAttribute('data-preview-pilot'),'hector');
    assert.equal(await page.locator('#garagePreview').getAttribute('data-preview-only'),'true');
    assert.match(await page.locator('#selectionQuote').textContent(),/Dernier avertissement/);
    assert.match(await page.locator('#selectionNote').textContent(),/Bran Stark/);
    await page.screenshot({path:'test-results/locked-pilot-preview.png'});
    for(const viewport of [{width:1024,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(viewport.width>700){
        const details=await page.locator('#garageContent .selection-details').boundingBox(),dock=await page.locator('.selection-dock').boundingBox();
        assert.ok(details.y+details.height<dock.y,'locked pilot details must not overlap cards');
      }
    }
    await page.screenshot({path:'test-results/locked-pilot-mobile.png'});
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#continueButton').click();
    assert.equal(await page.locator('#garagePreview').getAttribute('data-preview-pilot'),'bran');
    await page.locator('#pilotTab').click();
    await page.locator('[data-pilot="hawking"]').click();
    assert.equal(await page.locator('#garagePreview').getAttribute('data-preview-only'),'true');
    await page.locator('#nextChoice').click();
    assert.equal(await page.locator('#selectionName').textContent(),'Maya Dubois');
    const rendered=await page.evaluate(async()=>{
      const THREE=await import('/three.js'),{makeChair,animateChair}=await import('/chairs.js');
      const {pilots,chairs}=await import('/catalog.js');
      const canvas=document.createElement('canvas');canvas.id='legendary-preview';document.body.append(canvas);
      Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:100});
      const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(1440,900);
      const scene=new THREE.Scene();scene.background=new THREE.Color('#192b43');
      scene.add(new THREE.HemisphereLight(0xffffff,0x667788,3));
      const light=new THREE.DirectionalLight(0xffffff,4);light.position.set(0,10,-10);scene.add(light);
      const camera=new THREE.PerspectiveCamera(35,1440/900,.1,100);camera.position.set(0,12,-22);camera.lookAt(0,0,0);
      const models=pilots.filter(p=>p.rarity==='legendary').map((p,i)=>{
        const m=makeChair(THREE,chairs[0],p,{race:true});m.position.set((i%6-2.5)*3,0,Math.floor(i/6)*4-2);
        animateChair(m,{speed:15,steer:.2},1/60,1000);scene.add(m);return m;
      });
      renderer.render(scene,camera);
      window.legendaryPreview={renderer,scene,models};
      return models.length;
    });
    assert.equal(rendered,12);
    await page.screenshot({path:'test-results/legendary-models.png'});
    await page.evaluate(()=>{window.legendaryPreview.renderer.dispose();document.querySelector('#legendary-preview').remove();});
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-pilot="bran"]').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'test-results/legendary-mobile.png'});
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close();}
});
