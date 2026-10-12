import * as THREE from '/three.js';
import { makeChair, animateChair } from './chairs.js';
import { pilots } from './catalog.js';
import { createSelection } from './selection.js';
import { SnapshotBuffer, modelYaw } from './motion.js';
import { raceThemes } from './scenery.js';
import { loadModels } from './model-assets.js';
import { createRaceWorld, animateWorld } from './race-world.js';
import { createRaceEffects, attachContactShadow } from './race-effects.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const $ = selector => document.querySelector(selector);
const lobby = $('#lobby'), race = $('#race'), result = $('#result'), canvas = $('#game');
let socket, state, playerId;
const selection = createSelection(choices => send('configure', choices));
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scene, camera, renderer, sun, effects, environment, models, preparedChair, world = new Map(), raf, keys = {};
const snapshots = new SnapshotBuffer(100);
let previousFrame = 0, cameraReady = false, builtTrack = null, lobbySignature = '', lastHudUpdate = 0;
const cameraTarget = new THREE.Vector3(), cameraForward = new THREE.Vector3(), cameraDesired = new THREE.Vector3();
const sunOffset = new THREE.Vector3(-28, 46, -18);

function send(type, data = {}) { if (socket?.readyState === 1) socket.send(JSON.stringify({ type, ...data })); }
function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  socket.onopen = () => { $('#connection').textContent = 'serveur en ligne'; selection.setReady(true); };
  socket.onclose = () => { $('#connection').textContent = 'hors ligne'; selection.setReady(false); $('#menuStatus').textContent = 'Connexion perdue. Recharge la page pour rejoindre le serveur.'; };
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'error') { $('#menuStatus').textContent = message.message; selection.setReady(true); return; }
    if (message.type === 'joined') { playerId = message.playerId; return; }
    if (message.type === 'hello') {
      state = { chairs: message.chairs, tracks: message.tracks, pilots: message.pilots || pilots, racers: [], lobby: {} };
      renderLobby(); loadModels().catch(() => {}); return;
    }
    if (message.type !== 'state') return;
    const reset = state?.lobby.raceId !== message.lobby.raceId;
    state = message;
    snapshots.push(state, performance.now());
    if (reset) { cameraReady = false; effects?.reset(); }
    if (!lobby.classList.contains('hidden')) {
      const signature = JSON.stringify(state.racers.map(r => [r.id, r.name, r.pilotId]));
      if (signature !== lobbySignature) { lobbySignature = signature; renderLobby(); }
    }
    if ((state.lobby.started || state.lobby.countdown) && race.classList.contains('hidden') && result.classList.contains('hidden')) showRace();
    if (!state.lobby.started && !state.lobby.countdown && !race.classList.contains('hidden')) {
      race.classList.add('hidden'); lobby.classList.remove('hidden'); document.body.classList.remove('in-race'); cancelAnimationFrame(raf); selection.setVisible(true); selection.setReady(true); $('#menuStatus').textContent = ''; renderLobby();
    }
    if (performance.now() - lastHudUpdate > 100 || state.lobby.countdown) {
      updateRaceUi(); lastHudUpdate = performance.now();
    }
  };
}

function renderLobby() { if (state) selection.update(state); }

function buildWorld() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog('#c0e5ef', 110, 260);
  const pmrem = new THREE.PMREMGenerator(renderer), studio = new RoomEnvironment();
  scene.environment = pmrem.fromScene(studio, .04).texture; scene.environmentIntensity = .32;
  studio.dispose(); pmrem.dispose();
  camera = new THREE.PerspectiveCamera(54, 1, .1, 450);
  scene.add(new THREE.HemisphereLight('#e7f4ff', '#728297', 1.45));
  sun = new THREE.DirectionalLight('#fff0d7', 3.2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -26;
  sun.shadow.camera.right = sun.shadow.camera.top = 26; sun.shadow.camera.near = 1; sun.shadow.camera.far = 115;
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .05;
  scene.add(sun, sun.target); effects = createRaceEffects(scene);
  resize(); addEventListener('resize', resize);
}
function buildTrack(track = state.lobby.track) {
  if (builtTrack === track.id) return;
  if (environment) disposeObject(environment);
  builtTrack = track.id;
  const palette = raceThemes[builtTrack]; scene.fog.color.set(palette.fog);
  const night = ['neon', 'metro'].includes(builtTrack); sun.color.set(night ? '#d3dcff' : '#fff0d7'); sun.intensity = night ? 2 : 3.2;
  environment = createRaceWorld(track, models); scene.add(environment);
  const points = track.route.map(p => p.join(',')).join(' ');
  $('#raceMapRoute').setAttribute('points', points + ' ' + track.route[0].join(','));
}
function disposeObject(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse(child => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) for (const m of [].concat(child.material)) materials.add(m);
  });
  object.removeFromParent();
  geometries.forEach(g => g.dispose()); materials.forEach(m => { for (const value of Object.values(m)) if (value?.isTexture && !value.userData.shared) textures.add(value); m.dispose(); }); textures.forEach(t => t.dispose());
}
function syncRacers(now, dt) {
  for (const r of state.racers) {
    let object = world.get(r.id);
    if (object && (object.userData.chairId !== r.chairId || object.userData.pilotId !== (r.pilotId || pilots[0].id))) { disposeObject(object); world.delete(r.id); object = null; }
    if (!object) {
      if (r.id === playerId && preparedChair?.userData.chairId === r.chairId && preparedChair.userData.pilotId === r.pilotId) { object = preparedChair; preparedChair = null; }
      else object = makeChair(THREE, state.chairs.find(c => c.id === r.chairId) || state.chairs[0], pilots.find(p => p.id === r.pilotId) || pilots[0], { race: true });
      object.userData.pose = {};
      object.userData.isPlayer = r.id === playerId;
      object.traverse(child => { if (child.isMesh) child.castShadow = r.id === playerId; });
      object.userData.cameraFade = 1;
      attachContactShadow(object); scene.add(object); world.set(r.id, object);
    }
    const pose = object.userData.pose;
    if (snapshots.sample(r.id, now, pose)) {
      object.position.set(pose.x, .41, pose.z);
      object.rotation.y = modelYaw(pose.heading);
      animateChair(object, pose, dt, now);
    }
  }
  for (const [id, object] of world) if (!state.racers.some(r => r.id === id)) {
    disposeObject(object); world.delete(id);
  }
}
function resize() {
  if (!renderer) return;
  const width = canvas.clientWidth || 1100, height = canvas.clientHeight || 620;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
async function showRace() {
  selection.setVisible(false);
  lobby.classList.add('hidden'); result.classList.add('hidden'); race.classList.remove('hidden'); document.body.classList.add('in-race');
  $('#raceTrackName').textContent = state.lobby.track.name.toUpperCase();
  try { models = await loadModels(); }
  catch (error) { returnToGarage(); $('#menuStatus').textContent = 'Impossible de charger les modèles 3D. Réessaie après rechargement.'; console.error(error); return; }
  if (race.classList.contains('hidden')) return;
  buildWorld(); buildTrack(); resize(); cameraReady = false; previousFrame = 0; effects.reset();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(draw3D);
}
function draw3D(now) {
  if (!state || race.classList.contains('hidden')) return;
  const dt = previousFrame ? Math.min(.05, (now - previousFrame) / 1000) : 1 / 60;
  previousFrame = now;
  syncRacers(now, dt);
  animateWorld(environment, now, dt); effects.update(world, dt);
  const object = world.get(playerId);
  if (object) {
    const heading = object.userData.pose.heading;
    const speed = Math.abs(object.userData.pose.speed || 0);
    const targetFov = 54 + Math.min(8, speed * .28) + (object.userData.pose.boost > .05 ? 4 : 0);
    const nextFov = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(nextFov - camera.fov) > .01) { camera.fov = nextFov; camera.updateProjectionMatrix(); }
    cameraForward.set(Math.cos(heading), 0, Math.sin(heading));
    cameraDesired.copy(object.position).addScaledVector(cameraForward, -9.2); cameraDesired.y += 4.5;
    cameraTarget.copy(object.position).addScaledVector(cameraForward, 2.8); cameraTarget.y += 1.1;
    if (!cameraReady) { camera.position.copy(cameraDesired); cameraReady = true; }
    else camera.position.lerp(cameraDesired, 1 - Math.exp(-10 * dt));
    camera.lookAt(cameraTarget);
    sun.position.copy(object.position).add(sunOffset); sun.target.position.copy(object.position);
    // Racers between the chase camera and the player fade instead of hiding the action.
    for (const other of world.values()) {
      if (other === object) continue;
      const behind = (other.position.x - object.position.x) * cameraForward.x + (other.position.z - object.position.z) * cameraForward.z < -1.2;
      const lateral = Math.abs((other.position.x - object.position.x) * -cameraForward.z + (other.position.z - object.position.z) * cameraForward.x);
      const distance = other.position.distanceTo(camera.position), target = behind && lateral < 1.8 && distance < 7.5 ? .08 + .92 * Math.max(0, (distance - 4.5) / 3) : 1;
      const opacity = other.userData.cameraFade + (target - other.userData.cameraFade) * (1 - Math.exp(-15 * dt));
      other.userData.cameraFade = opacity;
      other.userData.cameraFadeUniform.value = opacity;
    }
  }
  renderer.render(scene, camera); raf = requestAnimationFrame(draw3D);
}
function updateRaceUi() {
  if (!state) return;
  const me = state.racers.find(r => r.id === playerId) || state.racers.find(r => !r.isBot);
  const sorted = [...state.racers].sort((a, b) => b.progress - a.progress);
  if (me) {
    $('#lapText').textContent = `TOUR ${Math.min(me.lap, state.lobby.laps)} / ${state.lobby.laps}`;
    $('#speedValue').textContent = Math.round(Math.abs(me.speed) * 3.6);
    $('#racePosition').textContent = String(sorted.findIndex(r => r.id === me.id) + 1).padStart(2, '0');
    $('#boostFill').style.width = `${Math.min(100, me.boost > 0 ? me.boost / 1.1 * 100 : me.drift / 1.6 * 100)}%`;
    $('#boostLabel').textContent = me.boost > 0 ? 'TURBO !' : me.drift > .1 ? 'CHARGE DU DÉRAPAGE' : 'ESPACE · DÉRAPAGE';
    race.classList.toggle('boosting', me.boost > 0);
  }
  $('#raceClock').textContent = new Date(state.lobby.raceTime * 1000).toISOString().slice(14, 19) + '.' + Math.floor(state.lobby.raceTime * 10) % 10;
  $('#countdown').textContent = state.lobby.countdown || '';
  $('#ranking').innerHTML = sorted.map((r, i) => `<div class="rank ${r.id === playerId ? 'me' : ''}"><span>${String(i + 1).padStart(2, '0')} &nbsp; ${escapeHtml(r.name)}</span><small>${r.finished ? 'FINI' : `T${r.lap}`}</small></div>`).join('');
  $('#raceMapDots').innerHTML = state.racers.map(r => `<circle cx="${r.x}" cy="${r.z}" r="${r.id === playerId ? 4 : 2.5}" fill="${r.id === playerId ? '#ffdf3c' : '#e9f8ff'}" stroke="#0e274b" stroke-width="1.2"/>`).join('');
  if (state.lobby.winner && state.racers.every(r => r.finished)) finish();
}
function finish() { document.body.classList.remove('in-race'); race.classList.add('hidden'); result.classList.remove('hidden'); const sorted = [...state.racers].sort((a, b) => b.progress - a.progress), place = sorted.findIndex(r => r.id === playerId); $('#resultTitle').textContent = place === 0 ? 'TU AS GAGNE.' : `#${place + 1}, BELLE COURSE.`; $('#resultCopy').textContent = `Victoire de ${state.lobby.winner}.`; $('#resultRanking').innerHTML = sorted.map((r, i) => `<div class="rank ${r.id === playerId ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name)}</span><small>${r.finished ? 'FINI' : ''}</small></div>`).join(''); }
function updateInput() {
  send('input', { input: {
    gas: !!(keys.w || keys.z || keys.arrowup), brake: !!(keys.s || keys.arrowdown),
    left: !!(keys.a || keys.q || keys.arrowleft), right: !!(keys.d || keys.arrowright), drift: !!keys[' ']
  } });
}
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || race.classList.contains('hidden')) return;
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (event.repeat || keys[key]) return;
  keys[key] = true; updateInput();
});
document.addEventListener('keyup', event => { if (race.classList.contains('hidden')) return; keys[event.key.toLowerCase()] = false; updateInput(); });
addEventListener('blur', () => { keys = {}; updateInput(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys = {}; updateInput(); }
  cameraReady = false; previousFrame = 0;
});
$('#startButton').onclick = async () => {
  if (socket?.readyState !== 1) return;
  selection.setReady(false); $('#menuStatus').textContent = 'Chargement du monde 3D…';
  try { models = await loadModels(); } catch { selection.setReady(true); $('#menuStatus').textContent = 'Chargement 3D impossible. Réessaie.'; return; }
  if (socket?.readyState !== 1) return;
  const choices = selection.choices();
  selection.setVisible(false); $('#menuStatus').textContent = 'Préparation des shaders…';
  try {
    buildWorld(); buildTrack(state.tracks.find(t => t.id === choices.trackId));
    if (preparedChair) disposeObject(preparedChair);
    preparedChair = makeChair(THREE, state.chairs.find(c => c.id === choices.chairId), pilots.find(p => p.id === choices.pilotId), { race: true });
    preparedChair.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(preparedChair); await renderer.compileAsync(scene, camera); preparedChair?.removeFromParent();
  } catch (error) {
    if (preparedChair) { disposeObject(preparedChair); preparedChair = null; }
    selection.setVisible(true); selection.setReady(true); $('#menuStatus').textContent = 'Initialisation graphique impossible. Réessaie.'; console.error(error); return;
  }
  if (socket?.readyState !== 1) { selection.setVisible(true); return; }
  $('#menuStatus').textContent = 'Préparation de la grille…';
  if (!playerId) send('join', { name: $('#playerName').value, ...choices });
  else send('configure', { name: $('#playerName').value, ...choices });
  send('start');
};
function returnToGarage() {
  race.classList.add('hidden'); result.classList.add('hidden'); lobby.classList.remove('hidden'); document.body.classList.remove('in-race');
  cancelAnimationFrame(raf); keys = {}; updateInput(); send('restart'); selection.setReady(socket?.readyState === 1); selection.setVisible(true); selection.show('pilot'); $('#menuStatus').textContent = ''; renderLobby();
}
$('#backButton').onclick = returnToGarage;
$('#againButton').onclick = returnToGarage;
connect();
