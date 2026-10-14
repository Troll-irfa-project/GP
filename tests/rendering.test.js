import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signInPage, enterGarage, startRoomRace } from './helpers.js';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { distanceToRoute } from '../public/motion.js';
import { tracks } from '../public/catalog.js';
import { createCourse } from '../public/racing.js';

test('five 3D themes, drift particles, turbo and bounded rendering resources', { timeout: 180000 }, async () => {
  const port = 8102, url = `http://127.0.0.1:${port}`;
  const server = await startTestServer(port);
  let browser;
  try {

    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [], results = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader|GLTF/i.test(message.text())) errors.push(message.text()); });
    await signInPage(page,url);
    await page.goto(url);
    await enterGarage(page); await page.locator('.pilot-card').first().waitFor();
    await page.evaluate(async () => {
      const THREE = await import('/three.js'); window.renderHistory = [];
      THREE.Scene.prototype.onAfterRender = function(renderer, scene) {
        const root = scene.getObjectByName('trackWorld'), player = scene.children.find(o => o.userData.isPlayer);
        if (!root || !player) return;
        const particles = scene.getObjectByName('pooled-race-vfx'), sizes = particles.geometry.attributes.size.array;
        const row = { track: root.userData.trackId, steer: player.userData.pose.steer, lean: player.userData.animation.lean, speed: player.userData.pose.speed, boost: player.userData.pose.boost, drift: player.userData.pose.drift, particles: sizes.filter(v => v > .01).length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
        const line = root.getObjectByName('finish-line');
        row.finishLine = { x: line.position.x, z: line.position.z, width: line.geometry.parameters.width };
        row.footprints = [...root.userData.dressingFootprints,...(root.userData.horizonFootprints||[])];
        window.lastRender = row; window.renderHistory.push(row); if (window.renderHistory.length > 1000) window.renderHistory.shift();
      };
    });
    await mkdir('test-results', { recursive: true });
    for (const track of ['coast', 'neon', 'metro', 'garden', 'orbit', 'canyon','glacier','volcano','jungle','harbor', 'coast']) {
      if (await page.locator('#backButton').isVisible()) {await page.locator('#backButton').click();await enterGarage(page);}
      await page.locator('#circuitStep').click(); await page.locator(`[data-track="${track}"]`).click();
      await page.evaluate(() => { window.lastRender = null; window.renderHistory = []; });
      await startRoomRace(page);
      await page.waitForFunction(id => window.lastRender?.track === id && document.querySelector('#countdown').textContent === '', track);
      await page.keyboard.down('w'); await page.waitForTimeout(3100); await page.keyboard.up('w');
      await page.screenshot({ path: `test-results/race-${track}-art.png` });
      const metrics = await page.evaluate(() => window.lastRender);
      const catalogTrack = tracks.find(t => t.id === track), course = createCourse(catalogTrack);
      assert.equal(metrics.finishLine.x, course.finishGate.x); assert.equal(metrics.finishLine.z, course.finishGate.z);
      assert.equal(metrics.finishLine.width, course.finishGate.halfWidth * 2);
      for (const prop of metrics.footprints) assert.ok(distanceToRoute(prop.x, prop.z, catalogTrack.route) > catalogTrack.width + prop.radius + 2, `${track}: ${prop.kind} must stay outside the track`);
      delete metrics.footprints; results.push(metrics);
      assert.ok(metrics.calls < 240, `${track} draw calls: ${metrics.calls}`);
      assert.ok(metrics.triangles < 600000, `${track} triangle budget: ${metrics.triangles}`);
      assert.ok(metrics.geometries < 450, `${track} geometry budget: ${metrics.geometries}`);
    }
    const first = results[0], last = results.at(-1);
    assert.ok(last.textures <= first.textures + 6, 'track replay releases obsolete textures');
    await page.keyboard.down('w'); await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
    // Observe the real charge, not a wall-clock sleep that can miss the boost
    // threshold under GPU/CI load or during a collision on the starting straight.
    await page.waitForFunction(() => window.lastRender.drift > .5 && window.lastRender.particles > 0, undefined, { timeout: 5000 });
    await page.keyboard.up('Space'); await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => window.renderHistory.some(r => r.boost > .05 && r.particles > 0), undefined, { timeout: 5000 });
    await page.screenshot({ path: 'test-results/race-turbo-art.png' }); await page.keyboard.up('w');
    const animation = await page.evaluate(() => window.renderHistory);
    assert.ok(animation.some(r => Math.abs(r.lean) > .015), 'body responds to steering');
    assert.ok(animation.some(r => r.drift > .2 && r.particles > 0), 'charged drift emits sparks');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ renderingThemes: results }));
  } finally { await browser?.close(); await server.close(); }
});
