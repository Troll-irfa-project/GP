import { chromium } from '@playwright/test';
import { startTestServer, signInPage, enterGarage, startRoomRace } from './helpers.js';
const server=await startTestServer(8192);let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  if(process.env.PERF_BASELINE==='1')await page.route('**/*.js',async route=>{
    const response=await route.fetch();let source=await response.text();
    if(route.request().url().endsWith('/app.js'))source=source.replace('sun.shadow.mapSize.set(1024, 1024)','sun.shadow.mapSize.set(2048, 2048)').replace('renderer.shadowMap.autoUpdate=false','renderer.shadowMap.autoUpdate=true').replace('rival: r.id !== playerId','rival: false');
    if(route.request().url().endsWith('/chairs.js'))source=source.replace('options.race ? 1 : 2','2').replace('options.race ? 12 : 20','20').replace('options.race ? 8 : 14','14');
    await route.fulfill({response,body:source});
  });
  await signInPage(page,server.url);await page.goto(server.url);await enterGarage(page);
  await page.evaluate(async()=>{
    const THREE=await import('/three.js');window.probe=[];let previous;
    THREE.Scene.prototype.onAfterRender=function(renderer,scene){
      if(!scene.getObjectByName('trackWorld') || !scene.children.some(o=>o.userData.isPlayer))return;
      const now=performance.now();if(previous)window.probe.push({ms:now-previous,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ratio:renderer.getPixelRatio()});previous=now;
    };
    window.hudReplacements=0;new MutationObserver(events=>window.hudReplacements+=events.filter(e=>e.type==='childList').length).observe(document.querySelector('#raceMapDots'),{childList:true});
  });
  await page.locator('#circuitStep').click();await startRoomRace(page);await page.locator('#race').waitFor({state:'visible'});await page.waitForTimeout(4500);
  await page.evaluate(()=>{window.probe=[];window.hudReplacements=0;});await page.waitForTimeout(8000);
  console.log(JSON.stringify(await page.evaluate(()=>{const rows=window.probe,sorted=rows.map(r=>r.ms).sort((a,b)=>a-b);return {frames:rows.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],meanCalls:rows.reduce((s,r)=>s+r.calls,0)/rows.length,meanTriangles:rows.reduce((s,r)=>s+r.triangles,0)/rows.length,ratio:rows.at(-1)?.ratio,mapReplacements:window.hudReplacements};})));
}finally{await browser?.close();await server.close();}
