import * as THREE from 'three';
import { distanceToRoute, treePlacements } from './motion.js';
import { decorateTrack, raceThemes } from './scenery.js';
import { groundHeight, islandEdge } from './environment-math.js';
import { createCourse, pointAt } from './racing.js';
import { dressCircuit } from './track-dressing.js';
import { surfaceTexture } from './material-textures.js';

export function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; return texture;
}

function roadTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#484f60'; ctx.fillRect(0, 0, size, size);
    let seed = 74; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 15000; i++) { const value = 45 + Math.floor(random() * 45); ctx.fillStyle = `rgba(${value},${value + 5},${value + 12},.34)`; ctx.fillRect(random() * size, random() * size, 1, 1); }
    ctx.globalAlpha=.18;ctx.strokeStyle='#d8e0e7';ctx.lineWidth=1;for(let i=0;i<18;i++){const y=random()*size;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y+random()*12-6);ctx.stroke();}
    ctx.globalAlpha=.12;ctx.strokeStyle='#151c29';for(let i=0;i<10;i++){const x=random()*size;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+random()*20-10,size);ctx.stroke();}
  });
}

function ribbon(route, width, y, material) {
  const positions = [], uv = [], indices = []; let distance = 0;
  for (let i = 0; i <= route.length; i++) {
    const index = i % route.length, p = route[index], before = route[(index - 1 + route.length) % route.length], after = route[(index + 1) % route.length];
    const a = new THREE.Vector2(p[0] - before[0], p[1] - before[1]).normalize(), b = new THREE.Vector2(after[0] - p[0], after[1] - p[1]).normalize();
    const normal = new THREE.Vector2(-a.y - b.y, a.x + b.x).normalize();
    const factor = Math.min(1.8, 1 / Math.max(.3, normal.dot(new THREE.Vector2(-b.y, b.x))));
    if (i) distance += Math.hypot(p[0] - before[0], p[1] - before[1]);
    for (const side of [1, -1]) { positions.push(p[0] + normal.x * width * factor * side, y, p[1] + normal.y * width * factor * side); uv.push(side === 1 ? 0 : width / 3, distance / 6); }
    if (i < route.length) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; return mesh;
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .83, ...extra });
function instances(root, geometry, material, transforms, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length), object = new THREE.Object3D(); mesh.name = name;
  transforms.forEach((p, i) => { object.position.set(...p.position); object.rotation.set(0, p.angle || 0, 0); object.scale.set(...p.scale); object.updateMatrix(); mesh.setMatrixAt(i, object.matrix); });
  mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh); return mesh;
}

function terrain(track, palette) {
  const size=track.cupId==='horizons'?2*(Math.max(...track.route.map(p=>Math.hypot(...p)))+70):244;
  const geometry = new THREE.PlaneGeometry(size, size, 120, 120); geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position, colors = [], grass = new THREE.Color(palette.ground), sand = new THREE.Color(palette.stone), dark = grass.clone().multiplyScalar(.79), light = grass.clone().lerp(new THREE.Color('#c5d97f'), .2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), distance = distanceToRoute(x, z, track.route), r = Math.hypot(x, z);
    const edge = track.cupId==='horizons'?size/2-25:islandEdge(x, z), y = groundHeight(track, x, z, distance);
    position.setY(i, y);
    const color = dark.clone().lerp(light, .45 + Math.sin(x * .13 + Math.cos(z * .05)) * .2 + Math.cos(z * .12) * .15);
    if (distance < track.width + 2.3 || r > edge - 10) color.lerp(sand, .72);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat('#ffffff', { vertexColors: true, map:surfaceTexture(THREE,'ground',palette.ground,palette.stone) })); mesh.name = 'sculpted-terrain'; mesh.receiveShadow = true; return mesh;
}

function sky(root, palette) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color(palette.sky) }, horizon: { value: new THREE.Color(palette.fog) } }, vertexShader: 'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top;uniform vec3 horizon;varying vec3 vP;void main(){float t=pow(clamp(normalize(vP).y+.06,0.,1.),.5);gl_FragColor=vec4(mix(horizon,top,t),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));
  // Shader chunks must begin at the start of a GLSL line.
  mesh.material.fragmentShader = mesh.material.fragmentShader.replace('#include <tonemapping_fragment>', '').replace(';#include', ';\n#include');
  mesh.name = 'gradient-sky'; root.add(mesh);
}

export function createRaceWorld(track, models) {
  const root = new THREE.Group(); root.name = 'trackWorld'; root.userData.trackId = track.id;
  const palette = raceThemes[track.id] || raceThemes.coast, course = createCourse(track); sky(root, palette); root.add(terrain(track, palette));
  const texture = roadTexture(); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  root.add(ribbon(track.route, track.width + 1.05, .23, mat('#f3e3bc', {map:surfaceTexture(THREE,'curb','#f3e3bc','#fff9dc')})));
  root.add(ribbon(track.route, track.width + .64, .32, mat('#ed5c61', {map:surfaceTexture(THREE,'curb','#ed5c61','#ffd0a0')})));
  root.add(ribbon(track.route, track.width, .40, mat('#ffffff', { map: texture, roughness: .94 })));
  const white = [], red = [], dashes = [];
  const steps = Math.ceil(course.total / 2.4), spacing = course.total / steps;
  for (let j = 0; j < steps; j++) {
    const p = pointAt(course, (j + .5) * spacing), angle = Math.PI / 2 - Math.atan2(p.tz, p.tx);
    for (const side of [-1, 1]) (j % 2 ? red : white).push({ position: [p.x - p.tz * (track.width + .32) * side, .43, p.z + p.tx * (track.width + .32) * side], scale: [.63, .13, spacing + .08], angle });
    if (j % 3 === 1) dashes.push({ position: [p.x, .417, p.z], scale: [.15, .012, 1.7], angle });
  }
  instances(root, new THREE.BoxGeometry(1, 1, 1), mat('#fff3dc', {map:surfaceTexture(THREE,'curb','#fff3dc','#ffffff')}), white, 'white-curbs');
  instances(root, new THREE.BoxGeometry(1, 1, 1), mat('#ec4e56', {map:surfaceTexture(THREE,'curb','#ec4e56','#ffb39f')}), red, 'red-curbs');
  instances(root, new THREE.BoxGeometry(1, 1, 1), mat('#f5eed9'), dashes, 'road-markings');
  const gate = course.finishGate, startYaw = Math.PI / 2 - Math.atan2(gate.tz, gate.tx);
  const checkered = canvasTexture(256, (ctx, s) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x + y) % 2 ? '#1b2943' : '#fff5d5'; ctx.fillRect(x * s / 16, y * s / 2, s / 16, s / 2); } });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(gate.halfWidth * 2, 1.6), mat('#ffffff', { map: checkered })); line.name = 'finish-line'; line.userData.gate = gate; line.rotation.set(-Math.PI / 2, 0, startYaw); line.position.set(gate.x, .425, gate.z); root.add(line);
  const boostTexture = canvasTexture(256, (ctx, s) => { ctx.fillStyle = '#122e63'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#68f2ff'; ctx.lineWidth = 24; for (let y = -60; y < 350; y += 90) { ctx.beginPath(); ctx.moveTo(20, y + 40); ctx.lineTo(128, y); ctx.lineTo(236, y + 40); ctx.stroke(); } });
  const boostMaterial = mat('#ffffff', { map: boostTexture, emissive: '#59bbff', emissiveMap: boostTexture, emissiveIntensity: .7 });
  for (const along of course.boosts) {
    const p = pointAt(course, along), pad = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.4), boostMaterial);
    pad.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - Math.atan2(p.tz, p.tx)); pad.position.set(p.x, .43, p.z); root.add(pad);
  }
  // Retain explicit safe footprints for tests and diagnostics; visible trees are batched below.
  root.userData.treePlacements = treePlacements(track.route);
  for (const tree of root.userData.treePlacements) { const marker = new THREE.Group(); marker.name = 'tree'; marker.position.set(tree.x, 0, tree.z); marker.userData.radius = tree.radius; root.add(marker); }
  decorateTrack(THREE, root, track, models);
  dressCircuit(root, track, course, palette);
  root.userData.boostMaterial = boostMaterial; return root;
}

export function animateWorld(root, now, dt) {
  if (!root) return;
  for (const uniform of root.userData.timeUniforms || []) uniform.value = now * .001;
  for (const o of root.userData.animated || []) {
    if (o.userData.animation === 'balloon') { o.position.y = o.userData.baseY + Math.sin(now * .0005 + o.userData.phase) * .8; o.rotation.z = Math.sin(now * .0003 + o.userData.phase) * .025; }
    if (o.userData.animation === 'beacon') o.rotation.y += dt * .22;
  }
  root.userData.boostMaterial.emissiveIntensity = .6 + Math.sin(now * .005) * .15;
}
