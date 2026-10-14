import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, register } from './helpers.js';
import { WebSocket } from 'ws';
import * as THREE from 'three';
import { chairs, pilots, tracks } from '../public/catalog.js';
import { makeChair } from '../public/chairs.js';
import { sceneryPlacements } from '../public/scenery.js';
import { distanceToRoute } from '../public/motion.js';

test('twenty-three cosmetic pilots and ten distinct chairs preserve the 24-point budget', () => {
  assert.equal(pilots.length, 23); assert.equal(chairs.length, 10);
  for (const c of chairs) {
    const stats = ['speed', 'accel', 'handling'].map(key => c[key]);
    assert.equal(stats.reduce((a, b) => a + b), 24);
    assert.ok(stats.every(value => Number.isInteger(value) && value >= 1 && value <= 10));
  }
  for (const p of pilots) {
    const model = makeChair(THREE, chairs[0], p);
    assert.equal(model.userData.pilotId, p.id);
    assert.equal(model.userData.chairId, chairs[0].id);
    assert.equal(model.getObjectByName('torso').material.color.getHexString(), p.color.slice(1));
    const materials = new Set();
    model.traverse(o => { o.geometry?.dispose(); if (o.material) materials.add(o.material); });
    for (const material of materials) material.dispose();
  }
});

test('new decorative footprints stay clear of all five circuits', () => {
  for (const track of tracks) {
    const placements = sceneryPlacements(track); assert.ok(placements.length > 20);
    for (const p of placements) assert.ok(distanceToRoute(p.x, p.z, track.route) > 8.6 + p.radius + 2);
  }
});

test('WebSocket: each human and bot keeps its own pilot and chair', { timeout: 15000 }, async () => {
  const port = 8101, server = await startTestServer(port);
  const sockets = [];
  async function client() {
    const account=await register(server.url);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`,{headers:{Cookie:account.cookie,Origin:server.url}}); sockets.push(ws);
    const messages = [];
    ws.on('message', data => messages.push(JSON.parse(data.toString())));
    return {
      send(data) { ws.send(JSON.stringify(data)); },
      mark: () => messages.length,
      async wait(predicate, from = 0) {
        for (let i = 0; i < 150; i++) { const match = messages.slice(from).find(predicate); if (match) return match; await new Promise(resolve => setTimeout(resolve, 20)); }
        throw new Error('Expected WebSocket message was not received');
      },
    };
  }
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 25)); }
    const a = await client(), b = await client();
    assert.equal((await a.wait(m => m.type === 'hello')).pilots.length, 23);
    await b.wait(m => m.type === 'hello');
    a.send({ type: 'join_room', roomId: 'room-1', name: 'Alice', chairId: 'comet', pilotId: 'maya', trackId: 'coast' });
    const joinedA = await a.wait(m => m.type === 'joined');
    b.send({ type: 'join_room', roomId: 'room-1', name: 'Bob', chairId: 'pulse', pilotId: 'camille', trackId: 'coast' });
    const joinedB = await b.wait(m => m.type === 'joined');
    const first = await a.wait(m => m.type === 'state' && m.racers.some(r => r.id === joinedB.playerId));
    assert.equal(first.racers.length, 12);
    assert.equal(first.tracks, undefined, 'detailed static routes are not retransmitted every tick');
    assert.equal(first.lobby.track, undefined);
    assert.ok(Buffer.byteLength(JSON.stringify(first)) < 15000, 'twelve-player snapshot stays compact');
    assert.equal(first.racers.find(r => r.id === joinedA.playerId).pilotId, 'maya');
    assert.equal(first.racers.find(r => r.id === joinedB.playerId).pilotId, 'camille');
    assert.ok(first.racers.filter(r => r.isBot).every(r => pilots.some(p => p.id === r.pilotId)));
    const mark = b.mark();
    a.send({ type: 'configure', chairId: 'atlas', pilotId: 'lina', trackId: 'garden' });
    const changed = await b.wait(m => m.type === 'state', mark);
    assert.equal(changed.lobby.trackId, 'garden');
    assert.equal(changed.racers.find(r => r.id === joinedA.playerId).pilotId, 'lina');
    assert.equal(changed.racers.find(r => r.id === joinedA.playerId).chairId, 'atlas');
    assert.equal(changed.racers.find(r => r.id === joinedB.playerId).pilotId, 'camille');
    assert.equal(changed.racers.find(r => r.id === joinedB.playerId).chairId, 'pulse');
  } finally { for (const ws of sockets) ws.terminate(); await server.close(); }
});
