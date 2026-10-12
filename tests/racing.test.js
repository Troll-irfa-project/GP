import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chairs, tracks } from '../public/catalog.js';
import { createCourse, spawnRacer, stepRace, nearest, pointAt } from '../public/racing.js';
const dt = 1 / 60;

for (const track of tracks) test(`six bots finish three laps on ${track.id} without recovery or prolonged excursions`, () => {
  const course = createCourse(track);
  const racers = Array.from({length: 6}, (_, i) => {
    const r = { id: `bot-${i}`, chairId: chairs[i % 5].id, isBot: true, skill: .94 + i * .01 };
    spawnRacer(r, i, course); return r;
  });
  const offTime = racers.map(() => 0), longestOff = racers.map(() => 0);
  let elapsed = 0, maxDeviation = 0;
  while (elapsed < 240 && racers.some(r => !r.finished)) {
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
