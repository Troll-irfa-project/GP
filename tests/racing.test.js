import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chairs, tracks } from '../public/catalog.js';
import { createCourse, spawnRacer, stepRace, nearest, pointAt, updateLapProgress, gateCrossing, compareRacers } from '../public/racing.js';
const dt = 1 / 60;

for (const track of tracks) test(`twelve bots finish three laps on ${track.id} without recovery or prolonged excursions`, () => {
  const course = createCourse(track);
  const racers = Array.from({length: 12}, (_, i) => {
    const r = { id: `bot-${i}`, chairId: chairs[i % 5].id, isBot: true, skill: .92 + i % 6 * .012 };
    spawnRacer(r, i, course); return r;
  });
  const offTime = racers.map(() => 0), longestOff = racers.map(() => 0);
  let elapsed = 0, maxDeviation = 0;
  while (elapsed < (track.cupId==='horizons'?600:240) && racers.some(r => !r.finished)) {
    elapsed += dt; stepRace(racers, course, chairs, dt, 3, elapsed);
    racers.forEach((r, i) => {
      assert.ok(Number.isFinite(r.x) && Number.isFinite(r.z));
      const n = nearest(course, r.x, r.z);
      maxDeviation = Math.max(maxDeviation, n.distance);
      offTime[i] = n.distance > course.width ? offTime[i] + dt : 0;
      longestOff[i] = Math.max(longestOff[i], offTime[i]);
    });
  }
  console.log(JSON.stringify({track: track.id, elapsed: +elapsed.toFixed(1), maxDeviation: +maxDeviation.toFixed(2), racers: racers.map(r => ({chair:r.chairId, progress:+r.progress.toFixed(2), recovery:r.recoveryCount, time:r.finishTime && +r.finishTime.toFixed(1)}))}));
  assert.ok(racers.every(r => r.finished), 'all bots must finish a full race');
  assert.ok(racers.every(r => r.recoveryCount === 0), 'normal racing should not rely on teleportation');
  assert.ok(Math.max(...longestOff) < 2, 'no sustained wall driving or off-road shortcut');
  assert.ok(racers.every(r => r.finishTime > course.total * 3 / 33), 'no free laps at the start');
  for (const r of racers) {
    const gate = course.finishGate;
    assert.equal(r.completedLaps, 3);
    assert.ok(Math.abs((r.x - gate.x) * gate.tx + (r.z - gate.z) * gate.tz) < 1e-8, 'final pose is on the painted finish line');
    assert.ok(Math.abs((r.x - gate.x) * -gate.tz + (r.z - gate.z) * gate.tx) <= track.width);
  }
});

test('a displaced, wrong-way bot returns to the track and completes its lap', () => {
  const course = createCourse(tracks[0]), r = {id:'lost', chairId:'comet', isBot:true, skill:1};
  spawnRacer(r, 0, course);
  const p = pointAt(course, 70, 13);
  Object.assign(r, {x:p.x, z:p.z, heading:Math.atan2(p.tz,p.tx)+Math.PI, lastAlong:70, distance:70});
  r.ai.safeAlong = 68; r.ai.bestDistance = 70;
  for (let t=0;t<100 && !r.finished;t+=dt) stepRace([r], course, chairs, dt, 1, t);
  assert.ok(r.finished, 'must escape and finish, not keep hitting a boundary');
  assert.ok(r.recoveryCount <= 1);
});

test('stuck safeguard does not award progress', () => {
  const course = createCourse(tracks[0]), r = {id:'stuck', chairId:'atlas', isBot:true, skill:1};
  spawnRacer(r, 0, course);
  const start = r.distance;
  for(let t=0;t<6;t+=dt) {
    r.speed = 0; r.heading = Math.PI; r.x = 100; r.z = 100;
    stepRace([r], course, chairs, dt, 3, t);
  }
  assert.ok(r.recoveryCount >= 1);
  assert.ok(r.distance <= start + 1, 'recovery must not grant a shortcut');
});

test('bot passes a stationary racer instead of repeatedly driving into it', () => {
  const course = createCourse(tracks[0]);
  const r = {id:'passing', chairId:'comet', isBot:true, skill:1};
  const obstacle = {id:'parked', chairId:'atlas', isBot:false, input:{}};
  spawnRacer(r, 0, course); spawnRacer(obstacle, 1, course);
  const p = pointAt(course, 18, -.9);
  Object.assign(obstacle, {x:p.x,z:p.z,heading:Math.atan2(p.tz,p.tx),lastAlong:18,distance:18});
  for(let t=0;t<20 && r.distance<40;t+=dt) stepRace([r, obstacle],course,chairs,dt,3,t);
  assert.ok(r.distance > 40, 'bot must get past the obstruction');
  assert.equal(r.recoveryCount, 0, 'must actually drive around, not teleport');
});

test('five non-affine layouts have a straight finish, smooth bends and long straights', () => {
  const signatures = [];
  for (const track of tracks) {
    const course = createCourse(track), gate = course.finishGate, before = pointAt(course, -12), after = pointAt(course, 12);
    assert.ok(course.total > 350);
    assert.ok(course.segments.some(s => s.len > 27));
    assert.ok(track.route.length > 75);
    assert.ok(Math.abs(before.tz - gate.tz) < 1e-8 && Math.abs(after.tz - gate.tz) < 1e-8);
    signatures.push(Array.from({length: 16}, (_, i) => { const p = pointAt(course, course.total * i / 16); return [p.tx.toFixed(2), p.tz.toFixed(2)]; }));
  }
  assert.equal(new Set(signatures.map(s => JSON.stringify(s))).size, 10);
});

test('laps require ordered checkpoints and directional crossings, not a distance counter', () => {
  const course = createCourse(tracks[1]), r = {id:'human',chairId:'comet',isBot:false};
  spawnRacer(r, 0, course);
  function cross(index, { lateral = 0, reverse = false } = {}) {
    const g = course.gates[index], sign = reverse ? -1 : 1;
    const before = { x:g.x - g.tx * sign * .3 - g.tz * lateral, z:g.z - g.tz * sign * .3 + g.tx * lateral };
    r.x = g.x + g.tx * sign * .3 - g.tz * lateral; r.z = g.z + g.tz * sign * .3 + g.tx * lateral;
    r.lastAlong = course.total * index / course.gates.length; r.speed = 18;
    updateLapProgress(r, course, before, 1 / 30, 3, 10);
  }
  cross(0);
  assert.equal(r.lapStarted, true); assert.equal(r.completedLaps, 0);
  r.distance = course.total * 999; // Historical odometer drift cannot end a race.
  cross(0); cross(0, {reverse:true}); cross(0);
  assert.equal(r.completedLaps, 0); assert.equal(r.finished, false);
  cross(2); assert.equal(r.nextCheckpoint, 1, 'cannot skip checkpoint 1');
  for (let lap = 0; lap < 3; lap++) {
    for (let index = 1; index < course.gates.length; index++) cross(index);
    cross(0, {reverse:true}); assert.equal(r.completedLaps, lap);
    cross(0, {lateral:course.width + 1}); assert.equal(r.completedLaps, lap, 'outside the painted line does not count');
    cross(0, {lateral:2}); assert.equal(r.completedLaps, lap + 1);
  }
  assert.equal(r.finished, true); assert.equal(r.progress, 3);
  assert.ok(Math.abs(r.finishTime - (10 - 1 / 60)) < 1e-8, 'crossing time is interpolated inside the physics tick');
  assert.equal(r.x, course.finishGate.x);
});

test('gate sweep rejects reverse, out-of-bounds and teleport crossings', () => {
  const course = createCourse(tracks[0]), g = course.finishGate;
  assert.equal(gateCrossing(g, {x:g.x+1,z:g.z}, {x:g.x-1,z:g.z}), null);
  assert.equal(gateCrossing(g, {x:g.x-1,z:g.z+20}, {x:g.x+1,z:g.z+20}), null);
  const r = {id:'teleport',chairId:'comet'}; spawnRacer(r,0,course);
  r.x = g.x + 20; r.z = g.z;
  updateLapProgress(r,course,{x:g.x-20,z:g.z},dt,3,1);
  assert.equal(r.lapStarted,false);
});

test('collision movement through the finish is counted after collision resolution', () => {
  const course = createCourse(tracks[0]), a = {id:'a',chairId:'comet',input:{}}, b = {id:'b',chairId:'atlas',input:{}};
  spawnRacer(a,0,course); spawnRacer(b,1,course);
  for (const r of [a,b]) Object.assign(r,{x:course.finishGate.x-.2,z:course.finishGate.z,heading:0,lastAlong:course.total-.2,completedLaps:2,lapStarted:true,nextCheckpoint:0});
  // The heavier second racer is pushed forwards while the first is pushed back.
  stepRace([a,b],course,chairs,dt,3,100);
  assert.equal(b.finished,true); assert.equal(a.finished,false);
  assert.equal(b.x,course.finishGate.x);
});

test('finished racers are ordered by crossing time, never by tied progress', () => {
  const racers = [{id:'late',finished:true,progress:3,finishTime:91},{id:'unfinished',finished:false,progress:2.99},{id:'winner',finished:true,progress:3,finishTime:84}];
  assert.deepEqual(racers.sort(compareRacers).map(r=>r.id),['winner','late','unfinished']);
});
