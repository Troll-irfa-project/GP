import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { chairs, pilots, tracks } from '../public/catalog.js';
import { makeChair, animateChair } from '../public/chairs.js';
import { groundHeight } from '../public/environment-math.js';
import { SnapshotBuffer } from '../public/motion.js';

test('rigged chairs roll, steer and lean without moving the authoritative root', () => {
  for (const chair of chairs) {
    const model = makeChair(THREE, chair, pilots[0], { race: true });
    model.position.set(10, .41, -20); model.rotation.y = .3;
    const before = model.position.clone(), rig = model.userData.animation;
    let meshes = 0; model.traverse(o => { if (o.isMesh) meshes++; });
    assert.ok(meshes < 55, `${chair.id} batches detailed parts into ${meshes} meshes`);
    for (let frame = 0; frame < 120; frame++) animateChair(model, { speed: 18, steer: .8, drifting: true }, 1 / 60, frame * 1000 / 60);
    assert.deepEqual(model.position, before); assert.equal(model.rotation.y, .3);
    assert.ok(rig.wheels.every(w => Math.abs(w.rotation.x) > 20));
    assert.ok(Math.abs(rig.body.rotation.z) > .04 && Math.abs(rig.body.rotation.z) < .08);
    assert.ok(Math.abs(rig.body.position.y) < .004);
    if (rig.casters.length) assert.ok(Math.abs(rig.casters[0].rotation.y) > .25);
    const spin = rig.wheels[0].rotation.x;
    for (let frame = 0; frame < 180; frame++) animateChair(model, { speed: 0, steer: 0 }, 1 / 60, frame * 1000 / 60);
    assert.equal(rig.wheels[0].rotation.x, spin, 'stationary wheels stay stationary');
    assert.ok(Math.abs(rig.body.rotation.z) < 1e-5, 'suspension settles');
    const materials = new Set(); model.traverse(o => { o.geometry?.dispose(); if (o.material) materials.add(o.material); }); materials.forEach(m => m.dispose());
  }
});

test('sculpted terrain remains flat along the full physics corridor', () => {
  for (const track of tracks) for (let i = 0; i < track.route.length; i++) {
    const a = track.route[i], b = track.route[(i + 1) % track.route.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    for (let t = 0; t <= 1; t += .1) for (const side of [-1, 0, 1]) {
      const x = a[0] + dx * t - dz / length * (track.width + 1) * side, z = a[1] + dz * t + dx / length * (track.width + 1) * side;
      assert.equal(groundHeight(track, x, z), 0, 'decorative hills never hide the road');
    }
  }
});

test('animation inputs interpolate with network positions', () => {
  const buffer = new SnapshotBuffer(0);
  for (const [time, speed, steer, boost] of [[0, 0, -1, 0], [100, 20, 1, 1]]) buffer.push({ lobby: { raceId: 1 }, serverTime: time, racers: [{ id: 'p', x: time, z: 0, heading: 0, speed, steer, boost, drift: boost, wasDrifting: boost === 1 }] }, time);
  const pose = {}; buffer.sample('p', 50, pose);
  assert.equal(pose.speed, 10); assert.equal(pose.steer, 0); assert.equal(pose.boost, .5); assert.equal(pose.drifting, true);
});

test('finish flag waits for the same delayed snapshot as the finish-line position', () => {
  const buffer = new SnapshotBuffer(100), pose = {};
  for (const [time, x, finished] of [[0,-2,false],[100,0,true],[200,0,true]]) buffer.push({lobby:{raceId:1},serverTime:time,racers:[{id:'p',x,z:0,heading:0,finished}]},time);
  buffer.sample('p',150,pose); assert.equal(pose.x,-1); assert.equal(pose.finished,false);
  buffer.sample('p',200,pose); assert.equal(pose.x,0); assert.equal(pose.finished,true);
});
