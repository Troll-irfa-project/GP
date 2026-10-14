import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { driveSpeed, topSpeed, SnapshotBuffer, modelYaw, treePlacements, distanceToRoute } from '../public/motion.js';
import { makeChair, silhouettes } from '../public/chairs.js';

test('acceleration is linear, takes seconds, and clamps exactly to Vmax', () => {
  for (const [speed, accel] of [[10, 8], [6, 6], [8, 6], [7, 7], [9, 10]]) {
    const chair = { speed, accel }, dt = 1 / 60;
    let v = 0;
    const maximum = topSpeed(chair);
    const expectedStep = (2.2 + accel * .65) * dt;
    for (let tick = 0; tick < 60; tick++) {
      const next = driveSpeed(v, { gas: true }, chair, 1, 0, 1, dt);
      assert.ok(Math.abs(next - v - expectedStep) < 1e-10);
      v = next;
    }
    assert.ok(v < maximum * .42, 'still accelerating after one second');
    for (let tick = 60; tick < 400; tick++) v = driveSpeed(v, { gas: true }, chair, 1, 0, 1, dt);
    assert.equal(v, maximum);
    const braking = driveSpeed(v, { brake: true }, chair, 1, 0, 1, dt);
    assert.ok(braking < v && braking > 0, 'braking does not instantly reverse');
  }
});

test('15Hz snapshots yield continuous 60fps positions, including heading wrap', () => {
  const buffer = new SnapshotBuffer(100);
  for (let t = 0; t < 1000; t += 1000 / 15) {
    buffer.push({ lobby: { raceId: 1 }, serverTime: t, racers: [{ id: 'p', x: t / 100, z: 0, heading: 0 }] }, t);
  }
  const pose = {}; let previous = null;
  for (let now = 200; now <= 900; now += 1000 / 60) {
    assert.ok(buffer.sample('p', now, pose));
    if (previous !== null) assert.ok(Math.abs(pose.x - previous - 1 / 6) < 1e-9);
    previous = pose.x;
  }
  const turn = new SnapshotBuffer(0);
  turn.push({ lobby: { raceId: 1 }, serverTime: 0, racers: [{ id: 'p', x: 0, z: 0, heading: Math.PI - .1 }] }, 0);
  turn.push({ lobby: { raceId: 1 }, serverTime: 100, racers: [{ id: 'p', x: 1, z: 0, heading: -Math.PI + .1 }] }, 100);
  turn.sample('p', 50, pose);
  assert.ok(Math.abs(pose.heading - Math.PI) < 1e-9);
  turn.push({ lobby: { raceId: 2 }, serverTime: 200, racers: [{ id: 'p', x: -30, z: 0, heading: 0 }] }, 200);
  turn.sample('p', 200, pose);
  assert.equal(pose.x, -30, 'restart must not interpolate across teleport');
});

test('a loading stall does not permanently corrupt the interpolation clock', () => {
  const buffer = new SnapshotBuffer(100), out = {};
  const frame = time => ({ lobby: { raceId: 1 }, serverTime: time, racers: [{ id: 'p', x: time / 100, z: 0, heading: 0 }] });
  buffer.push(frame(0), 0);
  buffer.push(frame(100), 2000); // Main thread stalled during shader compilation.
  for (let time = 2100; time <= 5000; time += 1000 / 15) buffer.push(frame(time), time + 5);
  assert.equal(buffer.offset, 0, 'delayed arrivals must not become the clock reference');
  let previous = null;
  for (let time = 4300; time < 4700; time += 1000 / 60) {
    buffer.sample('p', time, out);
    if (previous !== null) assert.ok(Math.abs(out.x - previous - 1 / 6) < 1e-8);
    previous = out.x;
  }
});

test('models face their direction of travel and have distinct silhouettes', () => {
  const signatures = new Set();
  for (const id of Object.keys(silhouettes)) {
    const chair = makeChair(THREE, { id, color: '#ff6b52' });
    const parts = []; chair.traverse(o => parts.push(o.name));
    signatures.add(parts.join(','));
    assert.ok(chair.getObjectByName('footrest').position.z < 0);
    assert.ok(chair.getObjectByName('backrest').position.z > 0);
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, .79]) {
      chair.rotation.y = modelYaw(heading); chair.updateMatrixWorld(true);
      const front = new THREE.Vector3(0, 0, -1).transformDirection(chair.matrixWorld);
      assert.ok(front.dot(new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading))) > .999999);
    }
  }
  assert.equal(signatures.size, 10);
});

test('tree crowns have clearance from straights, closing segment and corners', () => {
  const route = [[-30, -20], [30, -20], [30, 20], [0, 30], [-30, 20]];
  for (const scale of [.82, 1, 1.16]) {
    const scaled = route.map(([x, z]) => [x * scale, z * scale]);
    const trees = treePlacements(scaled);
    assert.equal(trees.length, 24);
    for (const t of trees) assert.ok(distanceToRoute(t.x, t.z, scaled) >= 8.6 + t.radius + 2);
  }
});
