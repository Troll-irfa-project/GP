import { angleDelta, driveSpeed, steeringRate, topSpeed } from './motion.js';

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
  return { segments, total, width: track.width, boosts: [3, 8, 13].map(i => segments[i].start) };
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
const pathDelta = (course, from, to) => wrap(to - from + course.total / 2, course.total) - course.total / 2;

export function spawnRacer(r, i, course) {
  const along = -4 - Math.floor(i / 2) * 3.5;
  const lane = (i % 2 ? 1 : -1) * 1.5;
  const p = pointAt(course, along, lane);
  Object.assign(r, {
    x: p.x, z: p.z, heading: Math.atan2(p.tz, p.tx), speed: 0, steer: 0,
    distance: along, progress: 0, lap: 1, lastAlong: wrap(along, course.total),
    finished: false, boost: 0, boostCooldown: 0, drift: 0, wasDrifting: false,
    finishTime: null, recoveryCount: 0, recoveryFlash: 0,
    ai: { lane, stuck: 0, bestDistance: along, safeAlong: wrap(along, course.total) }
  });
}

export function botInput(r, chair, course, n, racers = [], dt = 1 / 60) {
  // Pure pursuit: aim at a position ahead ON the route, not just the segment's tangent.
  const errorFromRoad = n.distance;
  const lookahead = clamp(3.5 + Math.abs(r.speed) * .30, 4, 10);
  let lane = r.ai.lane * .6;
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
  r.ai.targetLane = (r.ai.targetLane ?? lane) + (lane - (r.ai.targetLane ?? lane)) * Math.min(1, dt * 4);
  const p = pointAt(course, n.along + (errorFromRoad > course.width ? 3 : lookahead), r.ai.targetLane);
  const dx = p.x - r.x, dz = p.z - r.z;
  const error = angleDelta(r.heading, Math.atan2(dz, dx));
  const distance = Math.max(1, Math.hypot(dx, dz));
  const angularSpeed = 2 * Math.max(4, r.speed) * Math.sin(error) / distance;
  const steer = Math.abs(error) > 1.1 ? Math.sign(error) : clamp(angularSpeed / steeringRate(chair, r.speed), -1, 1);
  let speedLimit = topSpeed(chair) * (r.skill || 1);
  // Brake BEFORE a vertex, using the available deceleration and turn radius.
  for (let i = 0; i < course.segments.length; i++) {
    const s = course.segments[i], next = course.segments[(i + 1) % course.segments.length];
    const ahead = wrap(s.start + s.len - n.along, course.total);
    if (ahead > 30) continue;
    const angle = Math.abs(angleDelta(Math.atan2(s.tz, s.tx), Math.atan2(next.tz, next.tx)));
    if (angle < .15) continue;
    const turnSpeed = clamp(steeringRate(chair, 12) * 5.5 / angle, 8, speedLimit);
    speedLimit = Math.min(speedLimit, Math.sqrt(turnSpeed ** 2 + 2 * 10 * Math.max(0, ahead - lookahead)));
  }
  if (Math.abs(error) > .75) speedLimit = Math.min(speedLimit, 11);
  if (Math.abs(error) > 1.15 || errorFromRoad > course.width - 1) speedLimit = Math.min(speedLimit, 4.5);
  // AI braking targets a positive speed; it must never engage reverse in a corner.
  return { gas: true, brake: false, drift: false, steer, speedLimit };
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

export function stepRace(racers, course, chairs, dt, laps = 3, raceTime = 0) {
  for (const r of racers) {
    if (r.finished) continue;
    const chair = chairs.find(c => c.id === r.chairId);
    const n = nearest(course, r.x, r.z, r.isBot ? r.lastAlong : null);
    const input = r.isBot ? botInput(r, chair, course, n, racers, dt) : r.input || {};
    const grip = n.distance <= course.width ? 1 : Math.max(.35, chair.offroad / 10);
    r.speed = driveSpeed(r.speed, input, chair, grip, r.boost, r.isBot ? r.skill || 1 : 1, dt);
    const steer = input.steer ?? ((input.right ? 1 : 0) - (input.left ? 1 : 0));
    r.steer += (clamp(steer, -1, 1) - r.steer) * Math.min(1, dt * 12);
    const drifting = Boolean(input.drift && Math.abs(r.steer) > .15 && r.speed > 9 && grip === 1);
    if (drifting) r.drift = Math.min(1.6, r.drift + dt * (.6 + chair.handling / 15));
    if (r.wasDrifting && !drifting && r.drift > .35) r.boost = Math.min(1.1, r.drift * .8);
    r.wasDrifting = drifting;
    // Players and AI share the same speed, grip and turning limits.
    if (Math.abs(r.speed) > .15) r.heading += r.steer * steeringRate(chair, r.speed) * (drifting ? 1.3 : 1) * dt * Math.sign(r.speed);
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
    r.progress = Math.max(0, r.distance / course.total);
    r.lap = Math.min(laps, Math.max(1, Math.floor(r.progress) + 1));
    if (r.distance >= course.total * laps) { r.finished = true; r.progress = laps; r.finishTime = raceTime; r.speed = 0; }
    if (r.isBot) {
      if (after.distance < course.width - 2) r.ai.safeAlong = after.along;
      if (r.distance > r.ai.bestDistance + .7) { r.ai.bestDistance = r.distance; r.ai.stuck = 0; }
      else r.ai.stuck += dt;
      if (!r.finished && r.ai.stuck > 5) recoverBot(r, course, racers);
    }
  }
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j];
    if (a.finished || b.finished) continue;
    const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz);
    if (distance >= 2.1) continue;
    const nx = distance > .001 ? dx / distance : 1, nz = distance > .001 ? dz / distance : 0;
    const aw = chairs.find(c => c.id === a.chairId).weight, bw = chairs.find(c => c.id === b.chairId).weight;
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
}
