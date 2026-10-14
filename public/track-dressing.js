import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { pointAt } from './racing.js';
import { distanceToRoute } from './motion.js';
import { groundHeight } from './environment-math.js';
import { MAX_RACERS, gridSlot } from './game-config.js';

// Colour-per-instance scenery: a whole race festival without one draw call per prop.
export function dressCircuit(root, track, course, palette) {
  const night = ['neon', 'metro'].includes(track.id);
  const accent = { coast: '#00b5ce', neon: '#ff59c8', metro: '#8ce6ed', garden: '#ffd145', orbit: '#aa8bff' }[track.id] || track.accent;
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1), rounded: new RoundedBoxGeometry(1, 1, 1, 2, .12),
    sphere: new THREE.SphereGeometry(1, 12, 8), pole: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 12), dome: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  }, batches = new Map(), transform = new THREE.Object3D(), color = new THREE.Color();
  const footprints = root.userData.dressingFootprints = [];
  const safe = (x, z, radius) => distanceToRoute(x, z, track.route) > track.width + radius + 2;
  function add(shape, tint, x, y, z, sx, sy, sz, yaw = 0, glow = false) {
    const key = shape + (glow ? '-glow' : '');
    if (!batches.has(key)) batches.set(key, { shape, glow, items: [] });
    batches.get(key).items.push({ tint, x, y, z, sx, sy, sz, yaw });
  }
  function footprint(x, z, radius, kind) { footprints.push({ x, z, radius, kind }); }

  // Close, readable track furniture. Gaps at tightly neighbouring branches keep
  // both driving lanes and the chase camera clear of walls and billboards.
  for (let along = 8; along < course.total; along += 5) {
    const p = pointAt(course, along), yaw = Math.PI / 2 - Math.atan2(p.tz, p.tx);
    for (const side of [-1, 1]) {
      const x = p.x - p.tz * (track.width + 2) * side, z = p.z + p.tx * (track.width + 2) * side;
      if (distanceToRoute(x, z, track.route) < track.width + 1.4) continue;
      // Low painted guide rail, not a tall wall hiding the next corner.
      if (Math.floor(along / 35) % 3 === 0) {
        add('rounded', '#f2f5ef', x, .75, z, .32, .5, 4.6, yaw);
        add('box', accent, x, 1.025, z, .34, .07, 4.4, yaw, night);
      }
      if (Math.floor(along) % 15 < 5) add('pole', '#faf0b6', x, .65, z, .13, .7, .13);
    }
  }

  // Start grid and small pit-side grandstands with coloured seats, roof and flags.
  const gate = course.finishGate, heading = Math.atan2(gate.tz, gate.tx);
  for (let i = 0; i < MAX_RACERS; i++) {
    const slot = gridSlot(i), p = pointAt(course, slot.along, slot.lane);
    add('box', '#fff6cf', p.x, .426, p.z, 2.25, .012, .07, Math.PI / 2 - heading);
  }
  for (const side of [-1, 1]) {
    const p = pointAt(course, 13, (track.width + 14) * side);
    if (!safe(p.x, p.z, 8.5)) continue;
    footprint(p.x, p.z, 8.5, 'grandstand');
    const yaw = -heading, base = groundHeight(track, p.x, p.z);
    const local = (x, z) => [p.x + x * gate.tx - z * gate.tz, p.z + x * gate.tz + z * gate.tx];
    for (let row = 0; row < 3; row++) {
      const [x, z] = local(0, row * 1.5 * side);
      add('box', '#324562', x, base + .45 + row * .45, z, 12, .9 + row * .9, 1.5, yaw);
      for (let seat = -5; seat <= 5; seat++) {
        const [sx, sz] = local(seat, row * 1.5 * side);
        add('rounded', seat % 3 ? accent : '#ffe379', sx, base + 1.15 + row * .9, sz, .65, .3, .75, yaw);
        add('rounded', seat % 3 ? accent : '#ffe379', sx, base + 1.5 + row * .9, sz + .27 * side, .65, .65, .16, yaw);
      }
    }
    for (const x of [-6, 6]) for (const z of [-1, 5]) {
      const [px, pz] = local(x, z * side); add('pole', '#d6e5ed', px, base + 2.8, pz, .12, 5.6, .12);
    }
    const [rx, rz] = local(0, 2 * side);
    add('rounded', accent, rx, base + 5.8, rz, 13.3, .35, 7.5, yaw);
    add('box', '#ffe276', rx, base + 6.02, rz, 13.1, .1, .5, yaw);
  }

  // Branded panels, all using one atlas and one GPU batch.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#102848'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(260, 0); ctx.lineTo(130, 256); ctx.lineTo(0, 256); ctx.fill();
  ctx.fillStyle = '#ffdf4b'; ctx.font = 'italic 900 112px Arial'; ctx.textAlign = 'center'; ctx.fillText('ROLL RUSH', 575, 153, 750);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 28px Arial'; ctx.fillText('ELECTRIC RACING CLUB', 573, 213);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const panels = [];
  for (let along = 26; along < course.total; along += 54) {
    const p = pointAt(course, along, track.width + 5);
    if (!safe(p.x, p.z, 2.5)) continue;
    footprint(p.x, p.z, 2.5, 'sponsor-panel');
    const y = groundHeight(track, p.x, p.z);
    panels.push({ x: p.x, y: y + 1.65, z: p.z, yaw: Math.PI - Math.atan2(p.tz, p.tx) });
    add('pole', '#dee8f0', p.x, y + .85, p.z, .13, 1.7, .13);
  }
  const front = new THREE.PlaneGeometry(4.8, 1.2), back = front.clone().rotateY(Math.PI), panelGeometry = mergeGeometries([front, back]); front.dispose(); back.dispose();
  const panelMesh = new THREE.InstancedMesh(panelGeometry, new THREE.MeshStandardMaterial({ map, roughness: .7, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: night ? .5 : .12 }), panels.length);
  panelMesh.name = 'sponsor-panels';
  panels.forEach((p, i) => { transform.position.set(p.x, p.y, p.z); transform.rotation.set(0, p.yaw, 0); transform.scale.set(1, 1, 1); transform.updateMatrix(); panelMesh.setMatrixAt(i, transform.matrix); });
  panelMesh.computeBoundingSphere(); root.add(panelMesh);

  // Soft, layered canopies and flower beds fill the foreground without hiding bends.
  for (let i = 0; i < 95; i++) {
    const x = -87 + i * 43.77 % 174, z = -84 + i * 31.49 % 168, d = distanceToRoute(x, z, track.route);
    if (!safe(x, z, 3.4) || d > 25 || Math.hypot(x, z) > 94 || footprints.some(p => Math.hypot(p.x - x, p.z - z) < p.radius + 3.4)) continue;
    footprint(x, z, 3.4, 'canopy');
    const y = groundHeight(track, x, z), height = 3.8 + i % 3 * .7;
    add('pole', '#906344', x, y + height * .4, z, .32, height * .8, .32);
    const tint = track.id === 'orbit' ? ['#747bcc', '#af9ee2', '#d3bbed'] : track.id === 'garden' && i % 3 === 0 ? ['#d25487', '#ee88b3', '#ffb8cf'] : ['#217b49', '#37a655', '#8acb54'];
    add('sphere', tint[0], x, y + height, z, 3, 1.5, 2.6);
    add('sphere', tint[1], x - .65, y + height + .65, z, 2.3, 1.5, 2.1);
    add('sphere', tint[2], x - .8, y + height + 1.5, z - .15, 1.5, .8, 1.45);
    for (let j = 0; j < 7; j++) {
      const a = j * Math.PI * 2 / 7, fx = x + Math.cos(a) * 2.8, fz = z + Math.sin(a) * 2.8;
      add('sphere', j % 2 ? '#ffd247' : '#ef8aba', fx, y + .24, fz, .2, .2, .2);
    }
  }

  if (track.id === 'coast') {
    for (let i = 0; i < 8; i++) {
      const p = pointAt(course, 30 + i * 43, track.width + 11);
      if (!safe(p.x, p.z, 3) || footprints.some(f => Math.hypot(f.x - p.x, f.z - p.z) < f.radius + 3)) continue;
      footprint(p.x, p.z, 3, 'parasol');
      const y = groundHeight(track, p.x, p.z);
      add('pole', '#faf1d4', p.x, y + 1.6, p.z, .085, 3.2, .085);
      add('dome', i % 2 ? '#f76d5e' : '#00b6cb', p.x, y + 3.05, p.z, 2.3, .75, 2.3);
      add('dome', '#fff2ce', p.x, y + 3.12, p.z, 1.7, .73, 1.7);
      add('rounded', '#ffe9b4', p.x + .6, y + .45, p.z, .85, .22, 2.4, .3);
    }
  }
  if (night) {
    for (let along = 28; along < course.total; along += 24) {
      const p = pointAt(course, along, -(track.width + 4));
      if (!safe(p.x, p.z, 1.5)) continue;
      add('pole', '#29425e', p.x, 3.1, p.z, .12, 6.2, .12);
      add('rounded', accent, p.x, 6.25, p.z, .5, .13, 2.6, -Math.atan2(p.tz, p.tx), true);
      add('box', accent, p.x, .08, p.z, 1.5, .05, 1.5, 0, true);
    }
  }
  if (track.id === 'orbit') {
    const planet = new THREE.Group(); planet.name = 'ringed-planet'; planet.position.set(128, 32, -20); planet.rotation.z = .35;
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(18, 32, 20), new THREE.MeshStandardMaterial({ color: '#8c88d6', roughness: .8 })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(22, 30, 80), new THREE.MeshBasicMaterial({ color: '#efd5a5', side: THREE.DoubleSide })); ring.rotation.x = Math.PI / 2.4; planet.add(ring); root.add(planet);
  }

  // Animated pennants at the starting straight: one instanced mesh and one shader.
  const flagGeo = new THREE.PlaneGeometry(1.7, 2.7, 5, 5); flagGeo.translate(.85, -1.35, 0);
  const time = { value: 0 }; root.userData.timeUniforms.push(time);
  const flagMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: .75 });
  flagMat.onBeforeCompile = shader => {
    shader.uniforms.flagTime = time;
    shader.vertexShader = 'uniform float flagTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += sin(position.x*3.2 + flagTime*3. + instanceMatrix[3].x*.2)*.18*position.x;');
  };
  flagMat.customProgramCacheKey = () => 'race-pennant-wind-v1';
  const flags = [];
  for (let i = 0; i < 10; i++) {
    const p = pointAt(course, -15 + i * 7, -(track.width + 5));
    if (!safe(p.x, p.z, 2)) continue;
    add('pole', '#e8eff0', p.x, 3.5, p.z, .07, 7, .07);
    flags.push(p);
  }
  const flagMesh = new THREE.InstancedMesh(flagGeo, flagMat, flags.length); flagMesh.name = 'animated-race-flags';
  flags.forEach((p, i) => { transform.position.set(p.x, 6.8, p.z); transform.rotation.set(0, -heading, 0); transform.scale.set(1, 1, 1); transform.updateMatrix(); flagMesh.setMatrixAt(i, transform.matrix); flagMesh.setColorAt(i, color.set(i % 2 ? '#ffd74d' : accent)); });
  flagMesh.computeBoundingSphere(); root.add(flagMesh);

  const used = new Set();
  for (const { shape, glow, items } of batches.values()) {
    used.add(shape);
    const material = glow ? new THREE.MeshBasicMaterial({ color: '#ffffff' }) : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .68 });
    const mesh = new THREE.InstancedMesh(geometries[shape], material, items.length); mesh.name = 'festival-' + shape;
    mesh.castShadow = !glow; mesh.receiveShadow = !glow;
    items.forEach((p, i) => { transform.position.set(p.x, p.y, p.z); transform.rotation.set(0, p.yaw, 0); transform.scale.set(p.sx, p.sy, p.sz); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); mesh.setColorAt(i, color.set(p.tint)); });
    mesh.computeBoundingSphere(); root.add(mesh);
  }
  for (const [id, geometry] of Object.entries(geometries)) if (!used.has(id)) geometry.dispose();
}
