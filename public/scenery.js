import { horizonTracks } from './horizons.js';
import { decorateHorizons } from './horizon-scenery.js';
import { distanceToRoute, angleDelta } from './motion.js';
import { createCourse, pointAt } from './racing.js';
import { groundHeight } from './environment-math.js';
import { instanceModel } from './model-assets.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { surfaceTexture } from './material-textures.js';

export const raceThemes = {
  coast: { sky: '#0c8bd8', fog: '#ade4ec', ground: '#398e48', water: '#079cb8', stone: '#e6cda0', trees: '#50a569' },
  neon: { sky: '#313e73', fog: '#68729b', ground: '#374965', water: '#334c7b', stone: '#30405d', trees: '#3c858b' },
  garden: { sky: '#249de1', fog: '#b6e8ee', ground: '#288541', water: '#249d9a', stone: '#bdaf81', trees: '#3c944c' },
  metro: { sky: '#565581', fog: '#777f9b', ground: '#727c91', water: '#4b657e', stone: '#7c8497', trees: '#54898b' },
  orbit: { sky: '#a1b4ed', fog: '#d0d8f9', ground: '#acc4d9', water: '#b3c9f5', stone: '#e2e2ef', trees: '#829ee1' },
};

for(const track of horizonTracks)raceThemes[track.id]=track.palette;

// All solid decorative footprints are checked against the same route as physics.
export function sceneryPlacements(track) {
  const placements = [];
  for (let i = 0; i < 36; i++) {
    const angle = i * Math.PI * 2 / 36, radius = track.cupId==='horizons'?Math.max(...track.route.map(p=>Math.hypot(...p)))+25:83+(i%3)*5;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (distanceToRoute(x, z, track.route) > 8.6 + 5 + 2) placements.push({ x, z, radius: 5, angle, variant: i % 4, height: 4 + i % 5 });
  }
  return placements;
}

// Geometry is batched by material; GLB props preserve their original hierarchy.
export function decorateTrack(THREE, root, track, models = new Map()) {
  if(track.cupId==='horizons')return decorateHorizons(THREE,root,track);
  const theme = raceThemes[track.id], course = createCourse(track), batches = new Map(), transform = new THREE.Object3D();
  root.userData.timeUniforms = []; root.userData.animated = [];
  const shapes = {
    box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 16, 12),
    rock: new THREE.IcosahedronGeometry(1, 1), roof: new THREE.ConeGeometry(1, 1, 16),
    cliff: new THREE.IcosahedronGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 24),
    dome: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  const isNight = track.id === 'neon' || track.id === 'metro';
  function place(shape, color, position, scale, rotation = 0, emissive = false) {
    const key = `${shape}/${color}/${emissive}`;
    if (!batches.has(key)) batches.set(key, { shape, color, emissive, instances: [] });
    batches.get(key).instances.push({ position, scale, rotation });
  }
  function mesh(geometry, color, position, options = {}) {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .65, ...options }));
    object.position.set(...position); object.castShadow = true; object.receiveShadow = true; root.add(object); return object;
  }
  function sign(text, x, y, z, yaw, width = 8, height = 2, color = '#ffda39') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0a2348'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 116);
    ctx.font = 'italic 900 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 67, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.PlaneGeometry(width, height), back = front.clone().rotateY(Math.PI), geometry = mergeGeometries([front, back]); front.dispose(); back.dispose();
    const board = mesh(geometry, '#ffffff', [x, y, z], { map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: .22 }); board.rotation.y = yaw; return board;
  }
  // Stylized water: animated ripples and shoreline foam in one draw call.
  const time = { value: 0 }; root.userData.timeUniforms.push(time);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { time, deep: { value: new THREE.Color(theme.water) }, foam: { value: new THREE.Color('#d3ffff') }, fogColor: { value: new THREE.Color(theme.fog) } },
    vertexShader: 'uniform float time;varying vec3 vP;void main(){vec3 p=position;p.y+=sin(p.x*.12+time)*.10+cos(p.z*.1+time*.7)*.07;vP=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: `uniform float time;uniform vec3 deep;uniform vec3 foam;uniform vec3 fogColor;varying vec3 vP;
      void main(){float r=length(vP.xz);float a=atan(vP.z,vP.x);float edge=107.+sin(a*5.)*7.+sin(a*9.)*3.;
      float wave=sin(vP.x*.3+sin(vP.z*.2)+time*.65)*cos(vP.z*.32-time*.45);
      float line=smoothstep(.78,.92,wave)*.22;float shore=(1.-smoothstep(0.,6.,abs(r-edge+1.5)))*(.3+.4*smoothstep(.2,.6,sin(r*2.-time*1.8)));
      vec3 c=mix(deep,foam,line+shore);c=mix(c,fogColor,smoothstep(200.,410.,r));
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }`,
  });
  const seaGeometry = new THREE.PlaneGeometry(850, 850, 40, 40); seaGeometry.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeometry, waterMaterial); sea.name = 'animated-water'; sea.position.y = -3.4; root.add(sea);
  // Large cliff stacks and distant islands frame the course instead of a flat disk.
  for (let i = 0; i < 26; i++) {
    const angle = i * Math.PI * 2 / 26, r = 145 + i % 4 * 8, h = 12 + (i * 7) % 31;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    place('cliff', theme.stone, [x, h * .35 - 4, z], [17 + i % 4 * 2, h * .65, 15 + i % 5], angle);
    place('cliff', theme.ground, [x - 1.5, h * .68 - 4, z], [11 + i % 4, h * .32, 10 + i % 5], angle);
  }
  // Real houses form clusters; all foundations are outside the route envelope.
  const homes = sceneryPlacements(track);
  const homeIds = ['building-type-a', 'building-type-e', 'building-type-f'];
  if (track.id === 'coast' || track.id === 'garden') for (let i = 0; i < homeIds.length; i++) {
    const items = homes.filter((p, n) => n % 3 === i).map(p => ({ ...p, y: groundHeight(track, p.x, p.z), scale: 4.7 }));
    instanceModel(THREE, root, models.get(homeIds[i]), items);
    for (const p of items) place('box', theme.stone, [p.x, p.y - .10, p.z], [7, .5, 6.6], p.angle);
  }
  if (track.id === 'orbit') for (const p of homes) {
    const y = groundHeight(track, p.x, p.z);
    place('cylinder', '#617caa', [p.x, y + .25, p.z], [4.5, .5, 4.5]);
    place('cylinder', '#e7edf7', [p.x, y + 1.4, p.z], [3.9, 2.4, 3.9]);
    place('cylinder', '#89e1f2', [p.x, y + 2.4, p.z], [3.95, .18, 3.95], 0, true);
    place('dome', '#95afdf', [p.x, y + 2.7, p.z], [3.6, 2.8, 3.6]);
    place('cylinder', '#e7edf7', [p.x, y + 5.8, p.z], [.09, 1.4, .09]);
    place('sphere', '#ffe3a0', [p.x, y + 6.6, p.z], [.25, .25, .25], 0, true);
  }
  // Layered skylines with luminous window bands for the two urban circuits.
  if (isNight) {
    const towerIds = ['building-skyscraper-b', 'building-skyscraper-d', 'building-skyscraper-e'];
    for (let i = 0; i < towerIds.length; i++) {
      const items = homes.filter((_, n) => n % 3 === i).map(p => ({ ...p, y: groundHeight(track, p.x, p.z), scale: track.id === 'neon' ? 5 : 3.7 }));
      instanceModel(THREE, root, models.get(towerIds[i]), items, { tint: i % 2 ? '#c7c0ee' : '#a6d3ed' });
      for (const p of items) {
        place('box', '#304058', [p.x, p.y + .15, p.z], [7.2, .3, 7.2], p.angle);
        place('box', i % 2 ? '#ee80d3' : '#74def1', [p.x, p.y + 1.6, p.z], [7, .15, 7], p.angle, true);
      }
    }
    for (let i = 0; i < homes.length; i += 5) {
      const p = homes[i], y = groundHeight(track, p.x, p.z);
      sign(i % 2 ? 'TURBO' : 'ROLL RUSH', p.x, y + 6.5, p.z, p.angle, 5.8, 2.4, i % 2 ? '#f397d8' : '#8df7ff');
    }
  }
  // Imported foliage: original crown clearance is respected, including animation.
  const treeIds = track.id === 'coast' ? ['tree_palmDetailedTall', 'tree_palmBend', 'tree_detailed'] : ['tree_detailed'];
  treeIds.forEach((id, index) => {
    const asset = models.get(id); if (!asset) return;
    const extent = Math.max(Math.hypot(asset.bounds.min[0], asset.bounds.min[2]), Math.hypot(asset.bounds.max[0], asset.bounds.max[2]));
    const items = root.userData.treePlacements.filter((_, i) => i % treeIds.length === index).map(p => ({ ...p, y: groundHeight(track, p.x, p.z), scale: p.radius / extent * .97, angle: p.x * .17 }));
    instanceModel(THREE, root, asset, items, { wind: true });
  });
  // Rounded foreground shrubs echo the soft vegetation of the selection artwork.
  for (let i = 0; i < 130; i++) {
    const x = -85 + i * 37.31 % 170, z = -78 + i * 41.91 % 156, d = distanceToRoute(x, z, track.route);
    if (d < 12 || d > 22) continue;
    const y = groundHeight(track, x, z), radius = .8 + i % 3 * .25;
    for (let j = 0; j < 3; j++) place('sphere', ['#398e40', '#50a548', '#70b650'][j], [x + (j - 1) * .65, y + .6 + j % 2 * .35, z], [radius, .75 + j % 2 * .3, radius * .8]);
  }
  const accents = { grass: [], grass_leafs: [], flower_redA: [], flower_yellowB: [], rock_largeA: [], rock_largeC: [] };
  for (let i = 0; i < 470; i++) {
    const x = -96 + i * 37.137 % 192, z = -88 + i * 53.177 % 176, d = distanceToRoute(x, z, track.route);
    if (d < 10.8 || d > 26 || Math.hypot(x, z) > 98) continue;
    const id = Object.keys(accents)[i % 6], scale = id.startsWith('rock') ? 2.5 : id.startsWith('flower') ? 2.2 : 2.9;
    accents[id].push({ x, z, y: groundHeight(track, x, z), scale, angle: i * 1.3 });
  }
  for (const [id, items] of Object.entries(accents)) instanceModel(THREE, root, models.get(id), items, { wind: !id.startsWith('rock') });
  if (track.id === 'coast') {
    const shape = new THREE.Shape();
    shape.moveTo(-5, 0); shape.lineTo(-5, 13); shape.lineTo(5, 13); shape.lineTo(5, 0); shape.lineTo(3.3, 0); shape.lineTo(3.3, 5); shape.absarc(0, 5, 3.3, 0, Math.PI, false); shape.lineTo(-3.3, 0); shape.closePath();
    shapes.viaduct = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: .12, bevelThickness: .12, bevelSegments: 1, steps: 1, curveSegments: 12 });
    for (let i = 0; i < 11; i++) {
      place('viaduct', '#d4c5a9', [105, -3.2, -68 + i * 10], [1, 1, 1], Math.PI / 2);
      place('box', '#e5d7b9', [106.5, 10.3, -68 + i * 10], [3.8, .9, 10], 0);
    }
    const x = 67, z = -23, base = groundHeight(track, x, z);
    for (let i = 0; i < 6; i++) place('cylinder', i % 2 ? '#f7ede0' : '#ee735e', [x, base + 1.65 + i * 2.65, z], [2.8 - i * .17, 2.65, 2.8 - i * .17]);
    place('cylinder', '#fbdfac', [x, base + 16.2, z], [3.0, .4, 3.0]);
    place('cylinder', '#9ceafb', [x, base + 17.6, z], [1.85, 2.3, 1.85], 0, true);
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; place('cylinder', '#34576d', [x + Math.cos(a) * 2.8, base + 16.8, z + Math.sin(a) * 2.8], [.055, 1.2, .055]); }
    place('roof', '#d95450', [x, base + 19.3, z], [2.7, 1.6, 2.7]);
    const beacon = new THREE.Group(); beacon.position.set(x, base + 17.5, z); beacon.userData.animation = 'beacon';
    const lens = new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff1ac' })); lens.position.z = 1.4; beacon.add(lens); root.add(beacon); root.userData.animated.push(beacon);
    instanceModel(THREE, root, models.get('boat-row-small'), [{ x: 119, z: -19, y: -3.4, scale: 2.4, angle: .8 }, { x: 121, z: 34, y: -3.4, scale: 2, angle: -.8 }]);
  }
  // Start arch: no upright or banner intersects the driveable surface.
  const start = track.route[0], second = track.route[1], direction = Math.atan2(second[1] - start[1], second[0] - start[0]);
  const nx = -Math.sin(direction), nz = Math.cos(direction);
  for (const side of [-1, 1]) {
    const x = start[0] + nx * 9.4 * side, z = start[1] + nz * 9.4 * side;
    place('box', '#183958', [x, 3.5, z], [.8, 7, .8]); place('box', '#ffda45', [x, 3.5, z], [.86, .25, .86]);
  }
  const arch = mesh(new THREE.BoxGeometry(19.8, 1.3, .65), '#142e52', [start[0], 7.2, start[1]]); arch.rotation.y = Math.PI / 2 - direction;
  const board = sign('DÉPART / ARRIVÉE', start[0] - Math.cos(direction) * .34, 7.2, start[1] - Math.sin(direction) * .34, -Math.PI / 2 - direction, 12, 1.15); board.name = 'start-banner';
  // Roadside chevrons at corners, only when the entire panel is outside the road.
  for (let along = 20; along < course.total; along += 18) {
    const p = pointAt(course, along), next = pointAt(course, along + 12);
    const heading = Math.atan2(p.tz, p.tx), turn = angleDelta(heading, Math.atan2(next.tz, next.tx));
    if (Math.abs(turn) < .3) continue;
    for (const side of [-Math.sign(turn)]) {
      const x = p.x - p.tz * 11.8 * side, z = p.z + p.tx * 11.8 * side;
      if (distanceToRoute(x, z, track.route) < 10.8) continue;
      const y = groundHeight(track, x, z);
      place('cylinder', '#d1d9df', [x, y + 1.4, z], [.07, 2.8, .07]);
      sign(turn > 0 ? '› › ›' : '‹ ‹ ‹', x, y + 2.8, z, -Math.PI / 2 - heading, 3.4, 1.25);
      break;
    }
  }
  if (track.id === 'metro') {
    const length = Math.hypot(second[0] - start[0], second[1] - start[1]) - 5;
    const tunnel = new THREE.CylinderGeometry(11.7, 11.7, length, 24, 1, true, 0, Math.PI); tunnel.rotateZ(Math.PI / 2);
    const arch = mesh(tunnel, '#666984', [(start[0] + second[0]) / 2, .1, start[1]], { side: THREE.DoubleSide }); arch.name = 'metro-vault';
    for (let x = start[0] + 3; x < second[0]; x += 6) {
      place('box', '#fce3a0', [x, 8.6, start[1] - 7.4], [.4, .24, 2.5], 0, true);
      place('box', '#65e4f3', [x, 1.4, start[1] + 10.5], [3, .16, .12], 0, true);
    }
  }
  if (track.id === 'orbit' || track.id === 'garden') {
    for (const fraction of [.25, .53, .82]) {
      const p = pointAt(course, course.total * fraction);
      const hoop = mesh(new THREE.TorusGeometry(11, track.id === 'orbit' ? .25 : .85, 6, 40, Math.PI), track.id === 'orbit' ? '#ffda71' : '#b3b798', [p.x, .1, p.z], { emissive: track.id === 'orbit' ? '#ffac3a' : '#000000', emissiveIntensity: .65 });
      hoop.rotation.y = Math.PI / 2 - Math.atan2(p.tz, p.tx);
    }
  }
  // Soft bright cloud banks and striped hot-air balloons.
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI / 10, x = Math.cos(angle) * 175, z = Math.sin(angle) * 175, y = 32 + i % 4 * 8;
    for (let j = -2; j <= 2; j++) place('sphere', isNight ? '#a8abc6' : '#ffffff', [x + j * 4, y + (2 - Math.abs(j)) * 1.7, z], [5.5, 3.1, 4.5]);
  }
  if (!isNight) for (let i = 0; i < 4; i++) {
    const balloon = new THREE.Group(), colors = ['#f3aa46', '#e8669a', '#56bfcf', '#a189e9'];
    for (let panel = 0; panel < 8; panel++) {
      const shape = new THREE.SphereGeometry(3.1, 5, 14, panel * Math.PI / 4, Math.PI / 4, 0, Math.PI);
      const part = new THREE.Mesh(shape, new THREE.MeshStandardMaterial({ color: panel % 2 ? '#fff0b1' : colors[i], roughness: .8 })); part.scale.y = 1.35; balloon.add(part);
    }
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, .9, 1.2), new THREE.MeshStandardMaterial({ color: '#b87540' })); basket.position.y = -5.1; balloon.add(basket);
    for (const side of [-1, 1]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, 1.5, 4), new THREE.MeshStandardMaterial({ color: '#866748' })); rope.position.set(side * .6, -4.2, 0); balloon.add(rope); }
    balloon.position.set(-80 + i * 57, 30 + i % 2 * 13, -115 + i % 3 * 90); balloon.userData = { animation: 'balloon', baseY: balloon.position.y, phase: i * 2.3 }; root.add(balloon); root.userData.animated.push(balloon);
  }
  const used = new Set();
  for (const batch of batches.values()) {
    const isCloud = batch.shape === 'sphere' && ['#ffffff', '#a8abc6'].includes(batch.color);
    const textureType=batch.shape==='sphere'&&isCloud?'fabric':batch.shape==='rock'||batch.shape==='cliff'?'stone':batch.shape==='box'?'metal':'ground';
    const material = new THREE.MeshStandardMaterial({ color: batch.color, map:surfaceTexture(THREE,textureType,batch.color,theme.stone), roughness: .8, emissive: batch.emissive || isCloud ? batch.color : '#000000', emissiveIntensity: batch.emissive ? .65 : isCloud ? .35 : 0 });
    const object = new THREE.InstancedMesh(shapes[batch.shape], material, batch.instances.length); object.name = 'scenery-batch'; object.castShadow = batch.shape !== 'sphere'; object.receiveShadow = true; used.add(batch.shape);
    batch.instances.forEach((item, i) => { transform.position.set(...item.position); transform.scale.set(...item.scale); transform.rotation.set(0, item.rotation, 0); transform.updateMatrix(); object.setMatrixAt(i, transform.matrix); });
    object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); root.add(object);
  }
  for (const [name, geometry] of Object.entries(shapes)) if (!used.has(name)) geometry.dispose();
}
