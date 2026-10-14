import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signInPage, enterGarage, startRoomRace } from './helpers.js';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { treePlacements, distanceToRoute } from '../public/motion.js';

test('browser: art-directed selection, pilots, smooth motion, camera and replay', { timeout: 120000 }, async () => {
  const port = 8099, url = `http://127.0.0.1:${port}`;
  const server = await startTestServer(port);
  let browser;
  try {

    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader|GLTF/i.test(message.text())) errors.push(message.text()); });
    await signInPage(page,url);
    await page.goto(url);
    await enterGarage(page);
    await page.locator('.pilot-card').first().waitFor();
    assert.equal(await page.locator('.chair-card').count(), 11);
    assert.equal(await page.locator('.pilot-card').count(), 23);
    assert.equal(await page.locator('.track-card').count(), 10);
    await page.evaluate(() => document.fonts.ready);
    await mkdir('test-results', { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/selection-pilot.png' });
    await page.locator('[data-pilot="maya"]').click();
    assert.equal(await page.locator('#selectionName').textContent(), 'Maya Dubois');
    await page.locator('#continueButton').click();
    assert.equal(await page.locator('#lobby').getAttribute('data-screen'), 'chair');
    const values = await page.locator('[role="meter"]').evaluateAll(els => els.map(el => Number(el.getAttribute('aria-valuenow'))));
    assert.equal(values.reduce((a, b) => a + b), 24);
    assert.ok(values.every(v => v >= 1 && v <= 10));
    await page.screenshot({ path: 'test-results/selection-chair.png' });
    await page.locator('#continueButton').click();
    assert.equal(await page.locator('#lobby').getAttribute('data-screen'), 'track');
    for (const id of ['neon', 'garden', 'metro', 'orbit', 'coast']) {
      await page.locator(`[data-track="${id}"]`).click();
      assert.match(await page.locator('#menuBackdrop').getAttribute('style'), new RegExp(`${id}-menu.png`));
    }
    await page.screenshot({ path: 'test-results/selection-circuit.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    // Inspect the actual render calls, without adding diagnostics to the shipped game.
    await page.evaluate(async () => {
      const THREE = await import('/three.js');
      window.framesObserved = [];
      THREE.Scene.prototype.onAfterRender = function(renderer, scene, camera) {
        const racers = scene.children.filter(o => o.userData.pose);
        const player = racers.find(o => o.userData.isPlayer);
        if (player) {
          // WebGL uploads meshes lazily as they enter the expanded field of view.
          // Count owned geometry, not only the currently uploaded GPU resources.
          const geometries = new Set();
          scene.traverse(o => { if(o.geometry) geometries.add(o.geometry); });
          const heading = player.userData.pose.heading;
          const forward = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
          const facing = new THREE.Vector3(0, 0, -1).transformDirection(player.matrixWorld);
          const row = {
            t: performance.now(), x: player.position.x, z: player.position.z, heading,
            facing: facing.dot(forward), behind: camera.position.clone().sub(player.position).dot(forward),
            geometries: geometries.size, calls: renderer.info.render.calls,
            trees: scene.getObjectByName('trackWorld').children.filter(o => o.name === 'tree').length,
            models: racers.map(o => o.name), playerModel: player.name, playerPilot: player.userData.pilotId,
            wheel: player.userData.animation.wheels[0].rotation.x,
            lean: player.userData.animation.body.rotation.z,
            triangles: renderer.info.render.triangles,
            importedAssets: scene.getObjectByName('trackWorld').children.filter(o => o.name.startsWith('asset:')).length,
          };
          window.framesObserved.push(row);
          if (window.framesObserved.length > 700) window.framesObserved.shift();
        }
      };
    });
    await startRoomRace(page);
    await page.waitForFunction(() => window.framesObserved.length > 20);
    await page.waitForFunction(() => document.querySelector('#countdown').textContent === '');
    await page.keyboard.down('w');
    await page.waitForTimeout(3300);
    await page.keyboard.up('w');
    await mkdir('test-results', { recursive: true });
    await page.locator('#game').screenshot({ path: 'test-results/race-forward.png' });
    const frames = await page.evaluate(() => window.framesObserved);
    assert.ok(frames.every(f => f.facing > .9999), 'all rendered headings face forward');
    assert.ok(frames.every(f => f.behind < -8), 'camera stays behind the player');
    assert.equal(new Set(frames.map(f => f.geometries)).size, 1, 'geometry count is stable through the race');
    assert.equal(new Set(frames.at(-1).models).size, 5);
    assert.equal(frames.at(-1).trees, 24);
    assert.equal(frames.at(-1).playerPilot, 'maya', 'selected pilot is used by the server and race renderer');
    assert.ok(new Set(frames.map(f => f.wheel.toFixed(2))).size > 20, 'wheels rotate with distance');
    assert.ok(frames.at(-1).importedAssets > 8, 'GLB props are loaded and instanced');
    assert.ok(frames.at(-1).calls < 220, 'richer world stays within the draw-call budget');
    const moving = frames.filter(f => f.t > frames.at(-1).t - 1500 && f.t < frames.at(-1).t - 100);
    const deltas = moving.slice(1).map((f, i) => Math.hypot(f.x - moving[i].x, f.z - moving[i].z));
    const frozenFraction = deltas.filter(d => d < .00001).length / deltas.length;
    assert.ok(frozenFraction < .2, `interpolation must move between snapshots; frozen fraction ${frozenFraction}`);
    await page.locator('#backButton').click();
    await enterGarage(page);
    await page.locator('#chairTab').click();
    await page.locator('[data-chair="trail"]').click();
    await page.locator('#continueButton').click();
    await startRoomRace(page);
    await page.waitForFunction(() => window.framesObserved.at(-1)?.playerModel === 'trail');
    await page.locator('#game').screenshot({ path: 'test-results/race-trail.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ frames: frames.length, geometryCount: frames.at(-1).geometries, drawCalls: frames.at(-1).calls, frozenFraction, models: frames.at(-1).models }));
    // Validate scenery clearance on the five actual server routes.
    const catalog = await page.evaluate(async () => {const {tracks,pilots}=await import('/catalog.js');return {tracks,pilots};});
    for (const track of catalog.tracks) for (const tree of treePlacements(track.route)) {
      assert.ok(distanceToRoute(tree.x, tree.z, track.route) >= 8.6 + tree.radius + 2);
    }
    assert.equal(catalog.pilots.length, 23);
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    mobile.on('pageerror', error => errors.push(error.message));
    await signInPage(mobile,url);
    await mobile.goto(url);
    await enterGarage(mobile,'room-2');
    await mobile.locator('.pilot-card').first().waitFor();
    await mobile.evaluate(() => document.fonts.ready);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile menu does not overflow');
    await mobile.screenshot({ path: 'test-results/selection-mobile.png', fullPage: true });
    await mobile.locator('#continueButton').click();
    await mobile.locator('[data-chair="pulse"]').click();
    await mobile.locator('#continueButton').click();
    assert.equal(await mobile.locator('#startButton').isVisible(), true);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.screenshot({ path: 'test-results/selection-circuit-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); await server.close();
  }
});
