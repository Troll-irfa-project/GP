import { tyreFactor, pitZone } from './endurance.js';
import { angleDelta, driveSpeed, steeringRate, topSpeed, lateralGrip } from './motion.js';
import { difficulties } from './competition.js';
import { gridSlot } from './game-config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (value, length) => ((value % length) + length) % length;
export function createCourse(track) {
  let total = 0;
  const segments = track.route.map((a, i) => {
    const b = track.route[(i + 1) % track.route.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const segment = { a, b, len, start: total, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len };
    total += len; return segment;
  });
  const course = { segments, total, width: track.width, boosts: [.22, .51, .78].map(t => total * t) };
  course.gates = Array.from({ length: 12 }, (_, i) => ({ ...pointAt(course, total * i / 12), halfWidth: i ? track.width + 6 : track.width }));
  course.finishGate = course.gates[0];
  return course;
}

export function pointAt(course, along, offset = 0) {
  const distance = wrap(along, course.total);
  const s = course.segments.find(s => s.start + s.len > distance) || course.segments.at(-1);
  const u = distance - s.start;
  return { x: s.a[0] + s.tx * u - s.tz * offset, z: s.a[1] + s.tz * u + s.tx * offset, tx: s.tx, tz: s.tz };
}

export function nearest(course, x, z, around = null) {
  let best = null;
  for (const s of course.segments) {
    const u = clamp((x - s.a[0]) * s.tx + (z - s.a[1]) * s.tz, 0, s.len);
    const along = s.start + u;
    // Do not switch to another branch when a nearby hairpin is closer in space.
    if (around !== null && Math.abs(pathDelta(course, around, along)) > 22) continue;
    const px = s.a[0] + s.tx * u, pz = s.a[1] + s.tz * u;
    const distance = Math.hypot(x - px, z - pz);
    if (!best || distance < best.distance) best = { x: px, z: pz, distance, along, tx: s.tx, tz: s.tz };
  }
  return best || nearest(course, x, z);
}
export const pathDelta = (course, from, to) => wrap(to - from + course.total / 2, course.total) - course.total / 2;

export function spawnRacer(r, i, course) {
  const {along,lane} = gridSlot(i);
  const p = pointAt(course, along, lane);
  Object.assign(r, {
    x: p.x, z: p.z, heading: Math.atan2(p.tz, p.tx), speed: 0, steer: 0,
    distance: along, progress: 0, lap: 1, lastAlong: wrap(along, course.total),
    finished: false, dnf: false, boost: 0, boostCooldown: 0, drift: 0, wasDrifting: false,
    finishTime: null, completedLaps: 0, lapStarted: false, lapStartTime: null, bestLapTime: null, nextCheckpoint: 0, recoveryCount: 0, recoveryFlash: 0,
    caneBoost: 0, caneBonus: 0, lightning: 0, lightningBoost: 0, lightningHitCooldown: 0, heavySlow: 0,
    ai: { lane, stuck: 0, bestDistance: along, safeAlong: wrap(along, course.total) }
  });
}

function stopOnCollision(r, time) {
  r.speed=0; r.stun=Math.max(r.stun||0,.5); r.collisionGhost=Math.max(r.collisionGhost||0,3); r.spin=.5; r.drift=0; r.wasDrifting=false; r.heavySlow=3;
  r.itemNotice={text:'ACCIDENT ECLAIR · RALENTI',until:time+2.5};
}

// A swept crossing, in the correct direction, inside the actual gate. A reverse
// crossing or going around its edge cannot count. Gates are shared with rendering.
export function gateCrossing(gate, before, after) {
  const from = (before.x - gate.x) * gate.tx + (before.z - gate.z) * gate.tz;
  const to = (after.x - gate.x) * gate.tx + (after.z - gate.z) * gate.tz;
  if (from > 0 || to <= 0 || to - from < 1e-8) return null;
  const fraction = -from / (to - from);
  const x = before.x + (after.x - before.x) * fraction, z = before.z + (after.z - before.z) * fraction;
  if (Math.abs((x - gate.x) * -gate.tz + (z - gate.z) * gate.tx) > gate.halfWidth) return null;
  return { x, z, fraction };
}

export function updateLapProgress(r, course, before, dt, laps, raceTime) {
  if (r.finished || r.pit) return;
  // Exclude respawns/teleports; collision displacement is included in normal steps.
  const moved = Math.hypot(r.x - before.x, r.z - before.z);
  const crossing = moved <= Math.max(5, Math.abs(r.speed) * dt * 3) ? gateCrossing(course.gates[r.nextCheckpoint], before, r) : null;
  if (crossing) {
    if (r.nextCheckpoint === 0) {
      const crossingTime = raceTime - dt + crossing.fraction * dt;
      if (r.lapStarted && r.lapStartTime !== null) {
        const lapTime = crossingTime - r.lapStartTime;
        if (lapTime > 0) r.bestLapTime = Math.min(r.bestLapTime ?? Infinity, lapTime);
      }
      r.lapStartTime = crossingTime;
      if (r.lapStarted) {r.completedLaps++;if(r.endurance)r.tyreAge++;}
      else r.lapStarted = true; // Crossing from the grid starts, but never awards, lap 1.
      if (r.completedLaps >= laps) {
        r.finished = true; r.finishTime = raceTime - dt + crossing.fraction * dt;
        r.x = crossing.x; r.z = crossing.z; r.speed = 0; r.boost = 0;
      }
    }
    r.nextCheckpoint = (r.nextCheckpoint + 1) % course.gates.length;
  }
  const n = nearest(course, r.x, r.z, r.lastAlong);
  const fraction = Math.min(n.along / course.total, (r.nextCheckpoint || course.gates.length) / course.gates.length);
  r.progress = r.finished ? laps : r.lapStarted ? r.completedLaps + fraction : 0;
  r.lap = Math.min(laps, r.completedLaps + 1);
}

export function compareRacers(a, b) {
  if (Boolean(a.dnf) !== Boolean(b.dnf)) return a.dnf ? 1 : -1;
  if (a.dnf && b.dnf) return b.progress-a.progress;
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  return a.finished ? a.finishTime - b.finishTime : b.progress - a.progress || (a.gridPosition || 0)-(b.gridPosition || 0);
}

export function botInput(r, chair, course, n, racers = [], dt = 1 / 60) {
  // Pure pursuit: aim at a position ahead ON the route, not just the segment's tangent.
  const tuning = difficulties.find(d=>d.id===r.aiDifficulty) || {corner:1,line:0,drift:0};
  const errorFromRoad = n.distance;
  const lookahead = clamp(3.5 + Math.abs(r.speed) * .30, 4, 10);
  const aheadTangent=pointAt(course,n.along+12);
  const bend=angleDelta(Math.atan2(n.tz,n.tx),Math.atan2(aheadTangent.tz,aheadTangent.tx));
  let lane = tuning.line ? r.ai.lane*.15 + clamp(bend*2,-1,1)*tuning.line : r.ai.lane*.6;
  if(tuning.line && course.boosts.some(mark=>{const ahead=pathDelta(course,n.along,mark);return ahead>=0&&ahead<16;}))lane=0;
  const ownLateral = (r.x - n.x) * -n.tz + (r.z - n.z) * n.tx;
  const blocker = racers.find(other => {
    if (other === r || other.finished || other.speed > r.speed - .8 && other.speed > 2) return false;
    const dx = other.x - r.x, dz = other.z - r.z;
    const ahead = dx * n.tx + dz * n.tz, sideways = dx * -n.tz + dz * n.tx;
    return ahead > 1 && ahead < Math.max(9, r.speed * .8) && Math.abs(sideways) < 2.4;
  });
  if (blocker) {
    const obstacleLateral = (blocker.x - n.x) * -n.tz + (blocker.z - n.z) * n.tx;
    lane = obstacleLateral >= ownLateral ? -2.8 : 2.8;
  }
  if(r.endurance&&r.pitRequested){const pit=pitZone(course),ahead=pathDelta(course,n.along,pit.along);if(ahead>-8&&ahead<45)lane=pit.lane;}
  r.ai.targetLane = (r.ai.targetLane ?? lane) + (lane - (r.ai.targetLane ?? lane)) * Math.min(1, dt * 4);
  const p = pointAt(course, n.along + (errorFromRoad > course.width ? 3 : lookahead), r.ai.targetLane);
  const dx = p.x - r.x, dz = p.z - r.z;
  const error = angleDelta(r.heading, Math.atan2(dz, dx));
  const distance = Math.max(1, Math.hypot(dx, dz));
  const angularSpeed = 2 * Math.max(4, r.speed) * Math.sin(error) / distance;
  let steer = Math.abs(error) > 1.1 ? Math.sign(error) : clamp(angularSpeed / steeringRate(chair, r.speed), -1, 1);
  const extraTop = (r.caneBoost > 0 ? (r.caneBonus || 0) * Math.min(1, r.caneBoost / 2.5) : 0) +
    (r.lightningBoost > 0 ? topSpeed(chair) * .1 : 0);
  let speedLimit = (topSpeed(chair) * (r.skill || 1) + extraTop) * (r.boost>0 ? 1.35 : r.itemBoost>0 ? 1.2 : 1) * (r.slow>0 ? .8 : 1) * (r.heavySlow>0 ? .25 : 1) * tyreFactor(r);
  // Brake BEFORE a vertex, using the available deceleration and turn radius.
  for (let i = 0; i < course.segments.length; i++) {
    const s = course.segments[i], next = course.segments[(i + 1) % course.segments.length];
    const ahead = wrap(s.start + s.len - n.along, course.total);
    if (ahead > 30) continue;
    const angle = Math.abs(angleDelta(Math.atan2(s.tz, s.tx), Math.atan2(next.tz, next.tx)));
    if (angle < .15) continue;
    const turnSpeed = clamp(steeringRate(chair, 12) * 5.5 * tuning.corner / angle, 8, speedLimit);
    speedLimit = Math.min(speedLimit, Math.sqrt(turnSpeed ** 2 + 2 * 10 * Math.max(0, ahead - lookahead)));
  }
  // Rounded corners have many tiny vertices: anticipate their combined curvature.
  for (const ahead of [6, 12, 20, 28]) {
    const a = pointAt(course, n.along + ahead - 5), b = pointAt(course, n.along + ahead + 5);
    const angle = Math.abs(angleDelta(Math.atan2(a.tz, a.tx), Math.atan2(b.tz, b.tx)));
    if (angle < .08) continue;
    const turnSpeed = Math.min(speedLimit, Math.sqrt(lateralGrip(chair) * 10 / angle) * Math.min(.97, .57 + tuning.corner * .21));
    speedLimit = Math.min(speedLimit, Math.sqrt(turnSpeed ** 2 + 20 * Math.max(0, ahead - lookahead)));
  }
  if (Math.abs(error) > .75) speedLimit = Math.min(speedLimit, 11*tuning.corner);
  if (Math.abs(error) > 1.15 || errorFromRoad > course.width - 1) speedLimit = Math.min(speedLimit, 4.5);
  // AI braking targets a positive speed; it must never engage reverse in a corner.
  r.ai.driftCooldown=Math.max(0,(r.ai.driftCooldown || 0)-dt);
  const drift=Boolean(tuning.drift && r.ai.driftCooldown===0 && r.speed>10 && Math.abs(steer)>.25 && Math.abs(error)<.75 && errorFromRoad<course.width-2 && r.drift<tuning.drift);
  if(r.wasDrifting&&!drift)r.ai.driftCooldown=1.2;
  if(drift)steer=clamp(angularSpeed/(steeringRate(chair,r.speed)*1.08),-1,1);
  return { gas: true, brake: false, drift, steer, speedLimit };
}

function recoverBot(r, course, racers) {
  let along = r.ai.safeAlong;
  let p;
  for (let attempt = 0; attempt < 8; attempt++) {
    p = pointAt(course, along, 0);
    if (!racers.some(other => other !== r && !other.finished && Math.hypot(p.x - other.x, p.z - other.z) < 3)) break;
    along -= 3;
  }
  // Repositioning never grants race distance or a checkpoint.
  r.x = p.x; r.z = p.z; r.heading = Math.atan2(p.tz, p.tx);
  r.lastAlong = wrap(along, course.total); r.speed = 0; r.boost = 0; r.steer = 0;
  r.ai.stuck = 0; r.ai.bestDistance = r.distance;
  r.recoveryCount++; r.recoveryFlash = .8;
}

export function stepRace(racers, course, chairs, dt, laps = 3, raceTime = 0, afterMove = null) {
  const previous = new Map(racers.map(r => [r.id, { x: r.x, z: r.z }]));
  for (const r of racers) {
    if (r.finished) continue;
    if(r.stun>0||r.pit){r.speed=0;r.boost=0;r.itemBoost=0;continue;}
    const chair = chairs.find(c => c.id === r.chairId);
    const n = nearest(course, r.x, r.z, r.isBot ? r.lastAlong : null);
    const input = r.isBot ? botInput(r, chair, course, n, racers, dt) : r.input || {};
    const grip = n.distance <= course.width ? 1 : Math.min(1, .55 * (r.upgradeId === 'module-grip' ? 1.02 : 1));
    const extraTop = (r.caneBoost > 0 ? (r.caneBonus || 0) * Math.min(1, r.caneBoost / 2.5) : 0) +
      (r.lightningBoost > 0 ? topSpeed(chair) * .1 : 0);
    r.speed = driveSpeed(r.speed, input, chair, grip, r.boost, r.isBot ? r.skill || 1 : 1, dt, r.upgradeId, r.itemBoost, r.slow, tyreFactor(r), extraTop, r.heavySlow);
    const steer = input.steer ?? ((input.right ? 1 : 0) - (input.left ? 1 : 0));
    r.steer += (clamp(steer, -1, 1) - r.steer) * Math.min(1, dt * 12);
    const drifting = Boolean(input.drift && Math.abs(r.steer) > .15 && r.speed > 9 && grip === 1);
    if (drifting) r.drift = Math.min(1.6, r.drift + dt * (.6 + chair.handling / 15));
    if (r.wasDrifting && !drifting && r.drift > .35) r.boost = Math.min(1.1, r.drift * .8);
    r.wasDrifting = drifting;
    // Players and AI share the same speed, grip and turning limits.
    if (Math.abs(r.speed) > .15) r.heading += r.steer * steeringRate(chair, r.speed) * (r.upgradeId === 'module-turn' ? 1.015 : 1) * (drifting ? 1.08 : 1) * dt * Math.sign(r.speed);
    r.heading = Math.atan2(Math.sin(r.heading), Math.cos(r.heading));
    r.x += Math.cos(r.heading) * r.speed * dt; r.z += Math.sin(r.heading) * r.speed * dt;
    r.boost = Math.max(0, r.boost - dt); r.boostCooldown = Math.max(0, r.boostCooldown - dt);
    r.recoveryFlash = Math.max(0, r.recoveryFlash - dt);
    if (!drifting) r.drift = Math.max(0, r.drift - dt * 1.2);
    const after = nearest(course, r.x, r.z, r.isBot ? r.lastAlong : null);
    if (after.distance > course.width + 9) {
      const excess = after.distance - course.width - 9;
      r.x += (after.x - r.x) / after.distance * excess;
      r.z += (after.z - r.z) / after.distance * excess;
      r.speed = Math.min(r.speed, 3);
    }
    if (r.boostCooldown === 0 && after.distance < 3 && course.boosts.some(mark => Math.abs(pathDelta(course, mark, after.along)) < 1.5)) {
      r.boost = .65; r.boostCooldown = 1.5;
    }
    const delta = pathDelta(course, r.lastAlong, after.along);
    if (after.distance < course.width + 1 && Math.abs(delta) < Math.max(2, Math.abs(r.speed) * dt * 3)) r.distance += delta;
    r.lastAlong = after.along;
    if (r.isBot) {
      if (after.distance < course.width - 2) r.ai.safeAlong = after.along;
      if (r.distance > r.ai.bestDistance + .7) { r.ai.bestDistance = r.distance; r.ai.stuck = 0; }
      else r.ai.stuck += dt;
      if (r.ai.stuck > 5) { recoverBot(r, course, racers); previous.set(r.id, { x: r.x, z: r.z }); }
    }
  }
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j];
    if (a.finished || b.finished || a.pit || b.pit) continue;
    if (a.collisionGhost > 0 || b.collisionGhost > 0 || a.stun > 0 || b.stun > 0 || a.heavySlow > 0 || b.heavySlow > 0) continue;
    const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz);
    if (distance >= 2.1) continue;
    const lightning = a.lightning > 0 ? a : b.lightning > 0 ? b : null;
    if (lightning && lightning.lightningHitCooldown <= 0) {
      const victim = lightning === a ? b : a;
      stopOnCollision(victim, raceTime);
      lightning.lightningHitCooldown = .65;
      lightning.lightningBoost = 5;
    }
    const nx = distance > .001 ? dx / distance : 1, nz = distance > .001 ? dz / distance : 0;
    const aw = 1, bw = 1; // Equal mass: no hidden fourth statistic.
    const total = aw + bw, overlap = 2.1 - distance;
    a.x -= nx * overlap * bw / total; a.z -= nz * overlap * bw / total;
    b.x += nx * overlap * aw / total; b.z += nz * overlap * aw / total;
    // Only a closing collision applies an impulse, never a perpetual weight-based shove.
    const closing = (Math.cos(a.heading) * a.speed - Math.cos(b.heading) * b.speed) * nx +
      (Math.sin(a.heading) * a.speed - Math.sin(b.heading) * b.speed) * nz;
    if (closing > 0) {
      a.speed -= closing * bw / total * (Math.cos(a.heading) * nx + Math.sin(a.heading) * nz);
      b.speed += closing * aw / total * (Math.cos(b.heading) * nx + Math.sin(b.heading) * nz);
    }
  }
  for(const r of racers)if(r.stun>0||r.pit){Object.assign(r,previous.get(r.id));r.speed=0;}
  afterMove?.(previous);
  for (const r of racers) updateLapProgress(r, course, previous.get(r.id), dt, laps, raceTime);
}
