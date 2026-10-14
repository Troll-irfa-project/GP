import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {startTestServer,signInPage} from './helpers.js';
test('Horizons cup selection, new menu assets and three-stat garage on desktop/mobile',{timeout:60000},async()=>{
  const server=await startTestServer(8136);let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
    await signInPage(page,server.url);await page.goto(server.url);
    await page.locator('[data-room="room-1"]').click();
    await page.locator('#competitionMode').selectOption('tournament');
    await page.locator('#competitionCup').selectOption('horizons');
    await page.waitForFunction(()=>document.querySelector('#roomCircuit').textContent==='Canyon Solaire');
    assert.match(await page.locator('#cupRoute').textContent(),/Canyon Solaire.*Glacier Boréal.*Caldeira Rouge.*Temple Émeraude.*Docks Minuit/);
    await mkdir('test-results',{recursive:true});
    await page.screenshot({path:'test-results/horizons-cup.png',fullPage:true});
    await page.locator('#roomGarageButton').click();
    await page.locator('#chairTab').click();
    assert.equal(await page.locator('[role="meter"]').count(),3);
    assert.deepEqual(await page.locator('[role="meter"]').evaluateAll(es=>es.map(e=>+e.getAttribute('aria-valuenow'))),[10,8,6]);
    await page.locator('#circuitStep').click();
    assert.equal(await page.locator('.track-card').count(),10);
    for(const id of ['canyon','glacier','volcano','jungle','harbor']){
      const response=await page.request.get(server.url+'/assets/'+id+'-menu.svg');
      assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/svg/);
    }
    assert.equal(await page.locator('[data-track="canyon"]').isDisabled(),true);
    await page.locator('[data-track="canyon"]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#trackLength').textContent(),'860 m');
    await page.screenshot({path:'test-results/horizons-selection.png'});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'test-results/horizons-selection-mobile.png',fullPage:true});
    await page.locator('#startButton').click();
    assert.equal(await page.locator('#competitionCup').inputValue(),'horizons');
    await page.locator('#launchRace').click();
    await page.locator('#game').waitFor();
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close();}
});
