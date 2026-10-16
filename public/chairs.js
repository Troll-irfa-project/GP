import { attachChairLogo } from './chair-logo.js';
import { dressLegendary } from './legendary-models.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { surfaceTexture } from './material-textures.js';

// Authored model parts all use -Z as their forward axis (feet, face and headlights).
export const silhouettes = {
  horizon: {label:'Grand tourisme · doubles dérives dorées',width:1.26,length:1.95,back:.9,wheel:.44},
  comet: { label: 'Coque profilée · dossier bas', width: 1.05, length: 1.8, back: .85, wheel: .40 },
  atlas: { label: 'Châssis large · arceau renforcé', width: 1.4, length: 1.7, back: 1.2, wheel: .48 },
  drift: { label: 'Roues inclinées · châssis ouvert', width: 1.05, length: 1.4, back: .9, wheel: .52 },
  trail: { label: 'Six roues crantées · garde au sol haute', width: 1.25, length: 1.85, back: 1.1, wheel: .49 },
  stint: {label:'Prototype GT · carénages longue distance',width:1.22,length:2.05,back:.96,wheel:.42},
  relay: {label:'Châssis atelier · flancs renforcés',width:1.18,length:1.72,back:1.08,wheel:.45},
  apex: { label:'Monoplace électrique · ailes avant et arrière',width:1.08,length:2.1,back:.78,wheel:.36 },
  vector: { label: 'Double aileron · cockpit fuselé', width:1.12,length:1.65,back:.94,wheel:.43 },
  nomad: { label: 'Quatre grandes roues · pare-buffle', width:1.3,length:1.8,back:1.12,wheel:.46 },
  pulse: { label: 'Châssis compact · batteries latérales', width: .98, length: 1.35, back: 1.0, wheel: .38 },
  autumn: {label:'Coque feuille · ailettes de saison',width:1.16,length:1.86,back:1.02,wheel:.43},
  halloween: {label:'Coque cercueil · pointes fantômes',width:1.2,length:1.92,back:1.12,wheel:.44},
  thanksgiving: {label:'Châssis récolte · paniers latéraux',width:1.34,length:1.78,back:1.08,wheel:.47},
  winter: {label:'Châssis polaire · patins stabilisateurs',width:1.08,length:1.98,back:1.0,wheel:.41},
  christmas: {label:'Traîneau caréné · clochettes arrière',width:1.2,length:2.02,back:1.06,wheel:.42},
  newyear: {label:'Châssis Nova · fusées de célébration',width:1.1,length:1.9,back:.9,wheel:.4},
};

export function makeChair(THREE, chair, pilot = { id: 'hawking', color: '#344767', skin: '#e8b48e', hair: '#96816a', style: 'glasses' }, options = {}) {
  const spec = silhouettes[chair.id] || silhouettes.comet;
  const group = new THREE.Group();
  group.name = chair.id;
  group.userData.chairId = chair.id;
  group.userData.pilotId = pilot.id;
  group.userData.logoId = chair.logoId || null;
  group.userData.customColor = chair.color;
  const paint = new THREE.MeshPhysicalMaterial({ color: chair.color, map:surfaceTexture(THREE,'paint',chair.color,'#ffffff'), metalness: .2, roughness: .32, clearcoat: .75, clearcoatRoughness: .24 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202935', map:surfaceTexture(THREE,'rubber','#202935','#6b7884'), roughness: .8 });
  const metal = new THREE.MeshStandardMaterial({ color: '#adbbc4', map:surfaceTexture(THREE,'metal','#adbbc4','#ffffff'), metalness: .65, roughness: .35 });
  const skin = new THREE.MeshStandardMaterial({ color: pilot.skin, roughness: .76 });
  const clothes = new THREE.MeshStandardMaterial({ color: pilot.color, map:surfaceTexture(THREE,'fabric',pilot.color,'#ffffff'), roughness: .65 });
  const hair = new THREE.MeshStandardMaterial({ color: pilot.hair, roughness: .88 });
  const white = new THREE.MeshStandardMaterial({ color: '#fff9e9', roughness: .65 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#effbff', emissive: '#acdeff', emissiveIntensity: .5 });
  const trim = new THREE.MeshStandardMaterial({ color: chair.accent || '#ffdc56', metalness: .4, roughness: .3 });
  const red = new THREE.MeshStandardMaterial({ color: '#ff5a63', emissive: '#fa233b', emissiveIntensity: .6 });
  function box(name, size, position, mat = paint) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, options.race ? 1 : 2, Math.min(...size) * .28), mat);
    mesh.name = name; mesh.position.set(...position); group.add(mesh); return mesh;
  }
  function oval(name, size, position, mat) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, options.race ? 12 : 20, options.race ? 8 : 14), mat);
    mesh.name = name; mesh.scale.set(...size); mesh.position.set(...position); group.add(mesh); return mesh;
  }
  function limb(name, from, to, radius, mat) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 4, 10), mat);
    mesh.name = name; mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); group.add(mesh); return mesh;
  }
  box('chassis', [spec.width, .28, spec.length], [0, .48, 0]);
  if(chair.id==='horizon'){
    box('horizon-front-splitter',[1.6,.07,.3],[0,.4,-1.05],metal);
    for(const side of [-1,1]){
      box('horizon-side-pod',[.28,.3,1.25],[side*.66,.62,.12]);
      const fin=box('horizon-gold-fin',[.07,.52,.56],[side*.55,1.12,.73],new THREE.MeshStandardMaterial({color:'#ffd56a',metalness:.55,roughness:.32}));fin.rotation.z=side*-.15;
    }
    box('horizon-tail',[1.4,.08,.3],[0,1.38,.92],metal);
  }
  if(chair.decal){
    const seasonalPanel=new THREE.MeshStandardMaterial({color:chair.accent||'#ffdc56',emissive:chair.accent||'#ffdc56',emissiveIntensity:.18,metalness:.35,roughness:.3});
    box(`${chair.decal}-nose`,[.48,.08,.28],[0,.64,-spec.length/2-.08],seasonalPanel);
    box(`${chair.decal}-tail`,[.64,.08,.2],[0,1.28,spec.length/2-.08],seasonalPanel);
    for(const side of [-1,1])box(`${chair.decal}-side`,[.045,.12,.58],[side*(spec.width/2+.04),.82,.1],seasonalPanel);
  }
  box('seat', [.86, .16, .78], [0, .84, 0], dark);
  box('backrest', [.86, spec.back, .16], [0, .84 + spec.back / 2, .43], dark);
  box('back-shell', [.94, spec.back * .85, .10], [0, .84 + spec.back / 2, .54]);
  box('seat-cushion', [.76, .14, .70], [0, .94, -.02], dark);
  for (const side of [-1, 1]) {
    box('sculpted-side', [.15, .30, .98], [side * (spec.width / 2 - .025), .61, -.10]);
    box('trim-stripe', [.027, .045, .85], [side * (spec.width / 2 + .055), .69, -.1], trim);
    box('back-padding', [.12, spec.back * .65, .08], [side * .29, .91 + spec.back / 2, .30], dark);
    box('brake-light', [.23, .075, .035], [side * .30, 1.15, .607], red);
    limb('suspension-strut', [side * .40, .44, .10], [side * (spec.width / 2 + .08), spec.wheel, .27], .045, metal);
    for (let i = 0; i < 3; i++) box('cooling-fin', [.028, .14, .34], [side * .30 + i * .067, .55, .64], dark);
  }
  box('rear-number-plate', [.30, .15, .035], [0, 1.13, .611], trim);
  for (let i = 0; i < 3; i++) box('plate-stripe', [.033, .095, .010], [(i - 1) * .065, 1.13, .634], dark);
  box('footrest', [.8, .10, .5], [0, .37, -.96], metal);
  for (const side of [-1, 1]) {
    box('armrest', [.13, .12, .83], [side * .51, 1.15, -.04], dark);
    box('arm-support', [.07, .4, .07], [side * .51, .94, .23], metal);
    box('headlight', [.16, .10, .04], [side * .36, .53, -spec.length / 2 - .03], lamp);
  }
  const wheelZ = chair.id === 'trail' ? [-.62, 0, .62] : ['nomad','stint','relay'].includes(chair.id) ? [-.64,.64] : chair.id === 'apex' ? [-.8,.66] : [.27];
  for (const side of [-1, 1]) for (const z of wheelZ) {
    const wheel = new THREE.Group();
    wheel.name = 'drive-wheel'; wheel.position.set(side * (spec.width / 2 + .12), spec.wheel, z);
    if (chair.id === 'drift') wheel.rotation.z = -side * .18;
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheel, spec.wheel, .22, 24), dark);
    tyre.rotation.z = Math.PI / 2; wheel.add(tyre);
    const shoulder = new THREE.Mesh(new THREE.TorusGeometry(spec.wheel * .81, spec.wheel * .19, 8, 24), dark);
    shoulder.rotation.y = Math.PI / 2; shoulder.position.x = side * .09; wheel.add(shoulder);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheel * .5, spec.wheel * .5, .24, 10), metal);
    hub.rotation.z = Math.PI / 2; wheel.add(hub);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(spec.wheel * .69, .028, 6, 24), paint);
    rim.rotation.y = Math.PI / 2; rim.position.x = side * .126; wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(.035, spec.wheel * 1.05, .037), metal);
      spoke.position.x = side * .15; spoke.rotation.x = i * Math.PI / 3; wheel.add(spoke);
    }
    wheel.userData.radius = spec.wheel;
    if (chair.id === 'trail') for (let j = 0; j < 10; j++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(.25, .10, .17), dark), angle = j * Math.PI / 5;
      tread.position.set(0, Math.cos(angle) * spec.wheel, Math.sin(angle) * spec.wheel);
      tread.rotation.x = angle; wheel.add(tread);
    }
    group.add(wheel);
  }
  if (!['trail','nomad','apex','stint','relay'].includes(chair.id)) for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.name = 'caster-pivot'; pivot.position.set(side * .45, .18, -.72);
    const caster = new THREE.Group(); caster.name = 'caster'; caster.userData.radius = .18;
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .13, 16), dark); tyre.rotation.z = Math.PI / 2; caster.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .14, 12), metal); hub.rotation.z = Math.PI / 2; caster.add(hub);
    pivot.add(caster); group.add(pivot);
  }
  if(chair.id==='stint'){
    box('gt-long-nose',[.92,.22,.77],[0,.65,-.91]).rotation.x=-.18;
    box('gt-rear-deck',[1.36,.16,.64],[0,.91,.92]);
    box('gt-spoiler',[1.67,.08,.22],[0,1.16,1.08],white);
    for(const side of [-1,1]){box('gt-wheel-fairing',[.34,.19,1.9],[side*.74,.91,0]);box('gt-running-light',[.22,.04,.05],[side*.73,.93,-.96],lamp);}
    box('gt-racing-stripe',[.10,.025,.67],[0,.79,-.95],white);
  }else if(chair.id==='relay'){
    box('relay-service-case',[.84,.33,.38],[0,1.13,.85],metal);
    box('relay-roll-hoop',[1.35,.11,.13],[0,1.97,.69],trim);
    for(const side of [-1,1]){box('relay-hoop-upright',[.1,1.15,.1],[side*.62,1.4,.69],metal);box('relay-side-armor',[.24,.42,1.3],[side*.67,.76,0]);box('relay-reflector',[.035,.08,.85],[side*.8,.85,0],white);}
    box('relay-tool-latch',[.16,.12,.04],[0,1.15,1.05],dark);
  }else if (chair.id === 'apex') {
    box('f1-nose',[.38,.22,.95],[0,.58,-.93],paint).rotation.x=-.12;
    box('f1-front-wing',[1.9,.07,.35],[0,.30,-1.42],paint);
    box('f1-front-wing-flap',[1.65,.06,.18],[0,.39,-1.35],metal);
    box('f1-rear-wing',[1.8,.085,.36],[0,1.10,.95],paint);
    for(const side of [-1,1]) {
      box('f1-wing-support',[.05,.55,.07],[side*.35,.82,.94],metal);
      box('f1-endplate',[.055,.28,.40],[side*.89,1.09,.95],paint);
      box('f1-sidepod',[.28,.3,.85],[side*.62,.6,.02],paint);
      box('f1-intake',[.23,.18,.05],[side*.62,.61,-.42],dark);
      box('f1-front-endplate',[.045,.19,.42],[side*.94,.36,-1.42],paint);
      limb('f1-suspension',[side*.42,.49,-.45],[side*.72,.36,-.8],.035,metal);
    }
    box('f1-center-stripe',[.07,.015,.88],[0,.707,-.8],white);
  } else if (chair.id === 'vector') {
    for(const side of [-1,1]) {
      box('vector-fin',[.10,.44,.7],[side*.62,.84,.54],paint).rotation.z=side*.24;
      box('vector-light',[.025,.03,.85],[side*.60,.73,-.1],lamp);
    }
    box('vector-nose',[.62,.18,.6],[0,.67,-.7],paint).rotation.x=-.3;
  } else if (chair.id === 'nomad') {
    box('nomad-bumper',[1.6,.19,.2],[0,.5,-1.05],metal);
    for(const side of [-1,1])box('nomad-fender',[.3,.17,1.65],[side*.68,.98,0],paint);
    box('nomad-case',[.7,.25,.34],[0,1.15,.8],dark);
  } else if (chair.id === 'comet') {
    const nose = box('tapered-nose', [.83, .16, .63], [0, .64, -.65]); nose.rotation.x = -.22;
    box('rear-spoiler', [1.5, .09, .28], [0, .86, .85]);
  } else if (chair.id === 'atlas') {
    box('front-bumper', [1.65, .25, .22], [0, .46, -.97], metal);
    for (const side of [-1, 1]) box('roll-post', [.11, 1.4, .11], [side * .58, 1.25, .7], metal);
    box('roll-bar', [1.27, .11, .11], [0, 1.95, .7], metal);
  } else if (chair.id === 'drift') {
    for (const side of [-1, 1]) box('exposed-rail', [.08, .10, 1.6], [side * .61, .64, -.12], metal);
    box('rear-brace', [1.4, .1, .12], [0, .6, .64], metal);
  } else if (chair.id === 'trail') {
    box('equipment-rack', [1.0, .12, .5], [0, 1.05, .85], metal);
    box('equipment-case', [.62, .3, .4], [0, 1.26, .85], dark);
  } else {
    for (const side of [-1, 1]) {
      box('battery-pod', [.25, .6, .7], [side * .66, .69, .2]);
      box('battery-indicator', [.03, .35, .32], [side * .80, .74, .2], lamp);
    }
  }
  // Seated pilot with supported torso, legs, headrest and an accessible controller.
  oval('torso', [.30, .37, .20], [0, 1.24, .11], clothes);
  box('jacket-zip', [.026, .48, .022], [0, 1.28, -.089], metal);
  box('lap-belt', [.58, .07, .34], [0, .97, .06], dark);
  box('headrest', [.42, .28, .16], [0, 1.85, .4], dark);
  oval('neck', [.10, .15, .10], [0, 1.57, .09], skin);
  const head = oval('head', [.255, .30, .235], [0, 1.88, .065], skin);
  oval('hair-cap', [.261, .17, .239], [0, 2.075, .10], hair);
  oval('fringe', [.19, .082, .073], [-.045, 2.081, -.106], hair).rotation.z = -.22;
  oval('face-nose', [.05, .06, .075], [0, 1.87, -.166], skin);
  oval('smile', [.075, .016, .015], [0, 1.765, -.143], white);
  for (const side of [-1, 1]) {
    oval('ear', [.047, .083, .043], [side * .251, 1.89, .055], skin);
    oval('eye-white', [.061, .047, .023], [side * .105, 1.95, -.146], white);
    oval('eye-pupil', [.024, .030, .012], [side * .105, 1.95, -.169], dark);
    oval('eye-glint', [.007, .009, .007], [side * .102 - .005, 1.959, -.179], white);
    const brow = oval('eyebrow', [.070, .018, .020], [side * .107, 2.013, -.141], hair); brow.rotation.z = side * .12;
    limb('thigh', [side * .17, .98, .03], [side * .18, .98, -.40], .12, dark);
    limb('shin', [side * .18, .92, -.42], [side * .18, .50, -.53], .087, dark);
    oval('shoe', [.115, .085, .22], [side * .18, .43, -.65], dark);
    limb('sleeve', [side * .24, 1.44, .08], [side * .37, 1.22, .035], .10, clothes);
    limb('forearm', [side * .37, 1.22, .035], [side * .42, 1.20, -.29], .075, clothes);
    oval('hand', [.076, .057, .09], [side * .42, 1.20, -.32], skin);
  }
  if (pilot.style === 'glasses' || pilot.style === 'bob') {
    const frame = pilot.style === 'bob' ? new THREE.MeshStandardMaterial({ color: '#753ccb', roughness: .5 }) : dark;
    for (const side of [-1, 1]) {
      const glass = new THREE.Mesh(new THREE.TorusGeometry(.076, .012, 5, 16), frame);
      glass.name = 'glasses'; glass.position.set(side * .106, 1.95, -.176); glass.scale.y = .74; group.add(glass);
      box('glasses-arm', [.017, .016, .24], [side * .218, 1.951, -.04], frame);
    }
    box('glasses-bridge', [.066, .014, .012], [0, 1.96, -.18], frame);
  }
  if (pilot.style === 'ponytail') {
    oval('ponytail', [.14, .28, .13], [0, 1.94, .34], hair).rotation.x = -.45;
    oval('hair-band', [.105, .075, .075], [0, 2.12, .29], clothes);
  }
  if (pilot.style === 'buns') for (const side of [-1, 1]) oval('hair-bun', [.14, .14, .14], [side * .24, 2.12, .09], hair);
  if (pilot.style === 'beard') oval('beard', [.213, .11, .15], [0, 1.716, .012], hair);
  if (pilot.style === 'bob') for (const side of [-1, 1]) oval('bob-hair', [.10, .26, .18], [side * .222, 1.96, .12], hair);
  if (pilot.style === 'spikes') for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(.095, .25 + i % 2 * .08, 6), hair);
    spike.name = 'hair-spike'; spike.position.set((i - 2) * .095, 2.23, .07); spike.rotation.z = (2 - i) * .18; group.add(spike);
  }
  if (pilot.style === 'cap') {
    oval('cap', [.275, .14, .25], [0, 2.09, .075], clothes);
    oval('cap-visor', [.245, .025, .17], [0, 2.05, -.20], paint);
  }
  if (pilot.style === 'helmet') {
    oval('helmet-shell',[.29,.20,.27],[0,2.06,.08],pilot.id==='sacha'?white:clothes);
    box('helmet-visor',[.46,.115,.07],[0,1.97,-.177],metal);
    for(const side of [-1,1])oval('helmet-ear',[.07,.10,.12],[side*.268,1.94,.06],trim);
    box('helmet-stripe',[.06,.025,.35],[0,2.255,.05],trim);
  }
  if(['nora','sacha'].includes(pilot.id)){
    for(const side of [-1,1])box('endurance-suit-stripe',[.04,.38,.025],[side*.16,1.34,-.24],white);
    box('endurance-badge',[.12,.08,.035],[-.13,1.51,-.28],trim);
  }
  dressLegendary({THREE,group,pilot,box,oval,limb,skin,clothes,hair,white,dark,metal,trim});
  box('controller', [.16, .08, .23], [.52, 1.25, -.35], dark);
  limb('joystick', [.52, 1.30, -.37], [.52, 1.40, -.37], .025, metal);
  const body = new THREE.Group(); body.name = 'suspension-rig';
  const headRig = new THREE.Group(); headRig.name = 'head-rig'; headRig.position.set(0, 1.65, .08);
  const headNames = /^(head$|hair|helmet|fringe|face|smile|ear|eye|glasses|ponytail|beard|bob|cap)/;
  const wheels = [], casters = [], eyes = [];
  // A separate pivot for each eye allows a subtle blink without deforming the face.
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.name = 'eye-rig'; pivot.position.set(side * .105, 1.95, -.16);
    for (const child of [...group.children]) if (['eye-white', 'eye-pupil', 'eye-glint'].includes(child.name) && Math.sign(child.position.x) === side) { child.position.sub(pivot.position); pivot.add(child); }
    group.add(pivot); eyes.push(pivot);
  }
  for (const child of [...group.children]) {
    if (child.name === 'drive-wheel') wheels.push(child);
    else if (child.name === 'caster-pivot') { casters.push(child); wheels.push(child.children[0]); }
    else if (headNames.test(child.name)) { child.position.sub(headRig.position); headRig.add(child); }
    else body.add(child);
  }
  body.add(headRig); group.add(body);
  group.userData.animation = { body, head: headRig, eyes, wheels, casters, speed: 0, steer: 0, pitch: 0, lean: 0, wheelTravel: 0 };
  attachChairLogo(THREE,body,spec,chair.logoId);
  if (options.race) {
    const originals=new Set();group.traverse(o=>{if(o.material)originals.add(o.material);});
    const rivalMaterial=options.rival?new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:.12}):null;
    for (const wheel of wheels) batchStaticMeshes(THREE, wheel,rivalMaterial);
    for (const eye of eyes) batchStaticMeshes(THREE, eye,rivalMaterial);
    batchStaticMeshes(THREE, headRig,rivalMaterial); batchStaticMeshes(THREE, body,rivalMaterial);
    const retained=new Set();group.traverse(o=>{if(o.material)retained.add(o.material);});
    for(const material of originals)if(!retained.has(material))material.dispose();
    // Screen-space coverage fade: all surfaces use the SAME pixel mask, avoiding
    // translucent heads/chassis revealing their internal geometry near the camera.
    const fade = { value: 1 }, materials = new Set(); group.userData.cameraFadeUniform = fade;
    group.traverse(o => { if (o.material) materials.add(o.material); });
    for (const material of materials) {
      material.onBeforeCompile = shader => {
        shader.uniforms.uCameraFade = fade;
        shader.fragmentShader = 'uniform float uCameraFade;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nfloat coverage = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233))) * 43758.5453);\nif(coverage > uCameraFade) discard;');
      };
      material.customProgramCacheKey = () => 'avatar-camera-coverage-v1';
    }
  }
  return group;
}

function batchStaticMeshes(THREE, parent, rivalMaterial=null) {
  const buckets = new Map();
  for (const mesh of [...parent.children]) {
    if (!mesh.isMesh) continue;
    mesh.updateMatrix(); const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    // All authored parts use position, normal and uv; discard any extra channels.
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    const material=rivalMaterial&&!mesh.material.map?rivalMaterial:mesh.material;
    if(material===rivalMaterial){
      const colors=new Float32Array(geometry.attributes.position.count*3),color=mesh.material.color;
      for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material).push(geometry); mesh.geometry.dispose(); parent.remove(mesh);
  }
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, material); mesh.name = 'batched-detail'; mesh.castShadow = true; parent.add(mesh);
  }
}

export function animateChair(model, pose, dt, now) {
  const rig = model.userData.animation; if (!rig) return;
  const step = Math.max(0, Math.min(dt, .05)), easing = 1 - Math.exp(-10 * step);
  const speed = pose.speed || 0, steer = pose.steer || 0;
  const acceleration = Math.max(-12, Math.min(12, (speed - rig.speed) / Math.max(step, .001)));
  rig.speed += (speed - rig.speed) * easing; rig.steer += (steer - rig.steer) * easing;
  rig.pitch += (-acceleration * .003 - rig.pitch) * easing;
  rig.lean += (-rig.steer * Math.min(Math.abs(speed) / 18, 1) * .075 - rig.lean) * easing;
  rig.body.rotation.x = rig.pitch; rig.body.rotation.z = rig.lean;
  rig.body.position.y = Math.abs(speed) > 2 ? Math.sin(now * .012) * .0035 : 0;
  rig.head.rotation.y = -rig.steer * .10; rig.head.rotation.z = -rig.lean * .35;
  const phase = (now * .001 + model.name.length * .7) % 4.8;
  const blink = phase < .14 ? Math.max(.08, Math.abs(phase - .07) / .07) : 1;
  for (const eye of rig.eyes) eye.scale.y = blink;
  rig.wheelTravel = (rig.wheelTravel + speed * step) % 10000;
  for (const wheel of rig.wheels) wheel.rotation.x = -rig.wheelTravel / wheel.userData.radius;
  for (const caster of rig.casters) caster.rotation.y = -rig.steer * .4;
}
