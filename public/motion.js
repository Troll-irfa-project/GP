// Shared, deterministic helpers. Heading 0 points along world +X; models face local -Z.
export const modelYaw = heading => -heading - Math.PI / 2;
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const topSpeed = chair => chair.speed * 2.4;
export const steeringRate = (chair, speed) => (1.5 + chair.handling * .10) * (.3 + .7 * Math.min(1, Math.abs(speed) / 8));

export function approachSpeed(speed, target, acceleration, dt) {
  const step = acceleration * dt;
  return speed + Math.max(-step, Math.min(step, target - speed));
}

export function driveSpeed(speed, input, chair, grip, boost, skill, dt, upgrade = null, itemBoost = 0, slow = 0, tyres = 1) {
  const top = topSpeed(chair) * grip * skill * (slow > 0 ? .8 : 1) * tyres;
  const target = input.brake ? -4 : input.gas ? Math.min(top * (boost > 0 ? 1.35 : itemBoost > 0 ? 1.2 : 1), input.speedLimit ?? Infinity) : 0;
  // Equal increments per second: 0 -> Vmax in 3.0–4.6 s for the current garage.
  const secondsToTop = 7 - chair.accel * .4;
  const acceleration = topSpeed(chair) / secondsToTop * (upgrade === 'module-start' ? 1.02 : 1);
  const rate = input.brake ? 16 : !input.gas ? 5 : speed > target ? 13 : boost > 0 || itemBoost > 0 ? 18 : acceleration;
  return approachSpeed(speed, target, rate, dt);
}

export function distanceToRoute(x, z, route) {
  let best = Infinity;
  for (let i = 0; i < route.length; i++) {
    const [ax, az] = route[i], [bx, bz] = route[(i + 1) % route.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function treePlacements(route, roadEnvelope = 8.6) {
  const trees = [];
  // Deterministic placement, with clearance for the full crown and roadside margin.
  for (let i = 0; i < 200 && trees.length < 24; i++) {
    const x = -78 + (i * 37) % 156, z = -67 + (i * 47) % 134;
    const radius = 1.5 + (i % 3) * .35;
    if (distanceToRoute(x, z, route) < roadEnvelope + radius + 2) continue;
    if (trees.some(t => Math.hypot(x - t.x, z - t.z) < t.radius + radius + 2)) continue;
    trees.push({ x, z, radius });
  }
  return trees;
}

export class SnapshotBuffer {
  constructor(delay = 100) { this.delay = delay; this.frames = []; this.offset = null; this.raceId = null; }
  push(state, receivedAt) {
    if (this.raceId !== state.lobby.raceId) {
      this.frames = []; this.offset = null; this.raceId = state.lobby.raceId;
    }
    const offset = state.serverTime - receivedAt;
    // serverTime - receiveTime gets SMALLER when delivery/main-thread work is delayed.
    // Keep the least-delayed sample, otherwise asset/shader loading permanently
    // pushes the interpolation clock behind the oldest retained snapshot.
    this.offset = this.offset === null ? offset : Math.max(this.offset, offset);
    this.frames.push({ time: state.serverTime, racers: new Map(state.racers.map(r => [r.id, r])) });
    if (this.frames.length > 32) this.frames.shift();
  }
  sample(id, now, out) {
    if (!this.frames.length) return false;
    const time = now + this.offset - this.delay;
    let before = this.frames[0], after = before;
    for (const frame of this.frames) {
      after = frame;
      if (frame.time >= time) break;
      before = frame;
    }
    const a = before.racers.get(id), b = after.racers.get(id) || a;
    if (!a || !b) return false;
    const alpha = before.time === after.time ? 1 : Math.max(0, Math.min(1, (time - before.time) / (after.time - before.time)));
    out.x = a.x + (b.x - a.x) * alpha;
    out.z = a.z + (b.z - a.z) * alpha;
    out.heading = a.heading + angleDelta(a.heading, b.heading) * alpha;
    for (const key of ['speed', 'steer', 'boost', 'drift', 'itemBoost', 'slow', 'blur', 'stun']) out[key] = (a[key] || 0) + ((b[key] || 0) - (a[key] || 0)) * alpha;
    out.spin = a.spin > 0 ? Math.max(0,a.spin-(time-before.time)/1000) : alpha>=1 ? b.spin||0 : 0;
    out.drifting = alpha < .5 ? Boolean(a.wasDrifting) : Boolean(b.wasDrifting);
    // Reveal the result only when the interpolated vehicle has reached the line.
    out.finished = Boolean(a.finished || alpha >= 1 && b.finished);
    return true;
  }
}
