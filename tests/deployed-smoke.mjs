import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { signInPage, enterGarage, startRoomRace } from './helpers.js';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader|GLTF/i.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failed.push(response.url()); });
  const url=process.env.GAME_TEST_URL || 'http://localhost:8080';
  await signInPage(page,url);
  await page.goto(url);
  await page.locator('#roomBrowser').waitFor();
  assert.equal(await page.locator('.room-card').count(),3);
  await page.locator('#openCollection').click();
  assert.equal(await page.locator('#shopGrid .shop-card').count(),33);
  assert.equal(await page.locator('[data-item="paint-lagoon"]').isDisabled(),true);
  await page.locator('#achievementsTab').click();
  assert.equal(await page.locator('.achievement-card').count(),39);
  await page.locator('#closeCollection').click();
  await page.locator('[data-career="50"]:enabled').waitFor();
  assert.equal(await page.locator('[data-career="100"]').isDisabled(),true);
  await page.locator('#openRecords').click();
  await page.waitForFunction(()=>document.querySelector('#recordsStatus').textContent.startsWith('Un meilleur temps'));
  assert.equal(await page.locator('#recordsTrack option').count(),5);
  assert.equal(await page.locator('#recordsItems option').count(),2);
  await page.locator('#recordsMode').selectOption('endurance');assert.match(await page.locator('#recordsRaceTitle').textContent(),/15 TOURS/);
  await page.locator('#closeRecords').click();
  await page.locator('[data-career="50"]').click();
  await page.locator('#roomRoster .room-seat').first().waitFor();
  assert.equal(await page.locator('#competitionMode').inputValue(),'career');
  assert.equal(await page.locator('#roomRoster .bot').count(),11);
  await page.locator('#leaveRoomButton').click();
  await enterGarage(page);
  await page.locator('.pilot-card').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.check('16px Race')), true);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#garageStep').click();
    await page.locator('#pilotTab').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (viewport.width > 700) {
      const details = await page.locator('#garageContent .selection-details').boundingBox(), dock = await page.locator('.selection-dock').boundingBox();
      assert.ok(details.y + details.height < dock.y, `details must not overlap roster at ${viewport.width}px`);
    }
    await page.locator('#continueButton').click();
    await page.locator('[data-chair="atlas"]').click();
    await page.locator('#continueButton').click();
    await page.locator('[data-track="garden"]').click();
    assert.equal(await page.locator('#trackName').textContent(), 'Jardin Turbo');
    assert.ok(await page.locator('#startButton').isEnabled());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#startButton').click();
  await page.locator('#competitionMode').selectOption('endurance');
  await page.locator('#competitionItems').selectOption('on');
  await page.evaluate(async()=>{const THREE=await import('/three.js');THREE.Scene.prototype.onAfterRender=function(_renderer,scene){const boxes=scene.getObjectByName('mystery-boxes');if(boxes)window.deployedBoxes=boxes.count;};});
  await page.locator('#launchRace').click();
  await page.locator('#game').waitFor();
  await page.waitForFunction(() => document.querySelector('#raceMapDots').children.length === 12 && document.querySelector('#countdown').textContent === '');
  await page.waitForFunction(()=>window.deployedBoxes>0);
  assert.equal(await page.locator('#itemHud').isVisible(),true);
  assert.equal(await page.locator('#tyreHud').isVisible(),true);assert.match(await page.locator('#lapText').textContent(),/\/ 15/);
  await page.keyboard.press('a');
  await page.keyboard.down('w'); await page.waitForTimeout(2300); await page.keyboard.up('w');
  assert.ok(Number(await page.locator('#speedValue').textContent()) > 10);
  const canvas = await page.locator('#game').boundingBox(); assert.equal(canvas.width, 1440); assert.equal(canvas.height, 900);
  await page.screenshot({ path: 'test-results/deployed-race.png' });
  await page.locator('#backButton').click();
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await page.locator('#roomBrowser').waitFor();
  await page.locator('#logoutButton').click();await page.locator('#authScreen').waitFor();
  console.log('Docker smoke OK: 15-lap endurance/tyre HUD, sprint/endurance records, mystery boxes/items HUD/A key, separate record filters, economy/shop/achievements, global records, career locks/private room, account/session, 3 rooms, 12 racers, local GLB assets, shaders, 3 selection screens, 1440/1024/390px, logout, no browser errors.');
} finally { await browser.close(); }
