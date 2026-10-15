import { createEnduranceUI } from './endurance-ui.js';
import { createPitVisuals } from './endurance-visuals.js';
import { createCourse } from './racing.js';
import { createItemVisuals } from './item-visuals.js';
import { createItemsUI } from './items-ui.js';
import * as THREE from '/three.js';
import { makeChair, animateChair } from './chairs.js';
import { pilots } from './catalog.js';
import { createSelection } from './selection.js';
import { SnapshotBuffer, modelYaw } from './motion.js';
import { compareRacers } from './racing.js';
import { raceThemes } from './scenery.js';
import { loadModels } from './model-assets.js';
import { createRaceWorld, animateWorld } from './race-world.js';
import { createRaceEffects, attachContactShadow } from './race-effects.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { paintChair } from './progression.js';
import { createPortal, api } from './portal.js';
import { createAudioManager } from './audio.js';

const $ = selector => document.querySelector(selector);
const audio = createAudioManager();
addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
const lobby = $('#lobby'), race = $('#race'), result = $('#result'), canvas = $('#game');
let socket, state, playerId, currentRoom = null, portal;
const selection = createSelection(choices => {
  updateFavorite();
  if (currentRoom && state?.lobby.phase === 'waiting') {
    const data = { chairId:choices.chairId, pilotId:choices.pilotId };
    if (state.lobby.hostId === playerId && ['race','endurance'].includes(state.lobby.mode)) data.trackId = choices.trackId;
    send('configure',data);
  }
},async data=>{const response=await api('/api/customization',data);portal.setUser(response.user);});
function updateFavorite() {
  const favorite = portal?.user?.favoriteChairIds.includes(selection.choices().chairId) || false;
  $('#favoriteChair').setAttribute('aria-pressed',String(favorite));
  $('#favoriteChair').textContent = favorite ? '★ FAVORI' : '☆ FAVORI';
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let itemVisuals,pitVisuals,pitTrack;
let scene, camera, renderer, sun, effects, environment, models, preparedChair, world = new Map(), raf, keys = {};
const snapshots = new SnapshotBuffer(100);
let previousFrame = 0, cameraReady = false, builtTrack = null, lobbySignature = '', lastHudUpdate = 0, finishPresentedAt = null;
const cameraTarget = new THREE.Vector3(), cameraForward = new THREE.Vector3(), cameraDesired = new THREE.Vector3();
const sunOffset = new THREE.Vector3(-28, 46, -18);

function send(type, data = {}) { if (socket?.readyState === 1) socket.send(JSON.stringify({ type, ...data })); }
function connect() {
  const connection = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket = connection;
  connection.onopen = () => { if (socket !== connection) return; $('#connection').textContent = 'serveur en ligne'; selection.setReady(true); portal.setOnline(true); };
  connection.onclose = event => {
    if (socket !== connection) return;
    $('#connection').textContent = 'hors ligne'; selection.setReady(false); portal.setOnline(false);
    if (event.code === 4001) portal.authExpired('Session expirée. Reconnecte-toi pour continuer.');
    else if (event.code === 4009) portal.error('Ce compte est déjà ouvert dans un autre onglet. Ferme cet onglet puis recharge la page.');
    else {
      stopRace(); currentRoom = null; playerId = null; portal.show('rooms');
      portal.error('Connexion perdue. Recharge la page pour retrouver les rooms.');
    }
  };
  connection.onmessage = event => {
    if (socket !== connection) return;
    const message = JSON.parse(event.data);
    if (message.type === 'error') { portal.setBusy(false); portal.error(message.message); selection.setReady(true); return; }
    if (message.type === 'joined') { playerId = message.playerId; currentRoom = message.roomId; portal.show('waiting'); portal.error(''); return; }
    if (message.type === 'left') { currentRoom = null; playerId = null; stopRace(); portal.show('rooms'); portal.error(''); return; }
    if (message.type === 'rooms') { portal.rooms(message.rooms); return; }
    if (message.type === 'profile') { portal.setUser(message.user); return; }
    if (message.type === 'hello') {
      state = { chairs:message.chairs, tracks:message.tracks, pilots:message.pilots || pilots, racers:[], lobby:{} };
      portal.setUser(message.user); renderLobby(); loadModels().catch(() => {}); return;
    }
    if (message.type !== 'state' || message.lobby.roomId !== currentRoom) return;
    const reset = state?.lobby.raceId !== message.lobby.raceId;
    state = { ...state, ...message };
    audio.observe(state,playerId);
    state.lobby.track = state.tracks.find(track => track.id === state.lobby.trackId);
    snapshots.push(state, performance.now());
    if (reset) { cameraReady = false; finishPresentedAt = null; effects?.reset(); }
    selection.setMultiplayer(state.lobby.trackId,state.lobby.hostId === playerId && (!state.lobby.mode || ['race','endurance'].includes(state.lobby.mode)));
    if (portal.page === 'garage') renderLobby();
    // Lobby DOM is event-driven; physics snapshots should not rebuild 12 cards at 15 Hz.
    const signature = JSON.stringify([state.lobby.itemsEnabled,state.lobby.mode,state.lobby.difficulty,state.lobby.cup,state.lobby.roomId,state.lobby.phase,state.lobby.hostId,state.lobby.trackId,state.racers.map(r=>[r.id,r.name,r.chairId,r.pilotId,r.isBot,r.finished,r.title,r.level])]);
    if (signature !== lobbySignature) {lobbySignature=signature;portal.updateWaiting(state,playerId);}
    const me = state.racers.find(r=>r.id===playerId);
    if (me?.dnf && state.lobby.phase === 'results' && portal.page === 'race') finish();
    if ((state.lobby.started || state.lobby.countdown) && !me?.finished && portal.page !== 'race') showRace();
    if (state.lobby.phase === 'waiting' && !['waiting','garage'].includes(portal.page)) {stopRace();portal.show('waiting');}
    if (performance.now() - lastHudUpdate > 100 || state.lobby.countdown || state.lobby.phase === 'results') {
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
  camera = new THREE.PerspectiveCamera(54, 1, .1, 1100);
  scene.add(new THREE.HemisphereLight('#e7f4ff', '#657c87', 1.05));
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
  scene.fog.near=track.cupId==='horizons'?170:110;scene.fog.far=track.cupId==='horizons'?650:260;
  const night = ['neon', 'metro','volcano','harbor'].includes(builtTrack); sun.color.set(night ? '#c6d8ff' : '#fff0d7'); sun.intensity = night ? 1.8 : 2.6;
  environment = createRaceWorld(track, models); scene.add(environment);
  const points = track.route.map(p => p.join(',')).join(' ');
  const xs = track.route.map(p => p[0]), zs = track.route.map(p => p[1]);
  $('#raceMapRoute').closest('svg').setAttribute('viewBox', `${Math.min(...xs) - 12} ${Math.min(...zs) - 12} ${Math.max(...xs) - Math.min(...xs) + 24} ${Math.max(...zs) - Math.min(...zs) + 24}`);
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
function updateLightningAura(object, pose, now) {
  let aura = object.userData.lightningAura;
  if (!aura) {
    aura = new THREE.Group();
    aura.name = 'lightning-aura';
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, .045, 6, 32),
      new THREE.MeshBasicMaterial({color:'#ffe45c', transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false})
    );
    ring.rotation.x = Math.PI / 2;
    aura.add(ring);
    const boltMaterial = new THREE.LineBasicMaterial({color:'#fff9b0', transparent:true, opacity:.95, blending:THREE.AdditiveBlending});
    for (let i=0;i<4;i++) {
      const angle=i*Math.PI/2;
      const points=[];
      for (let j=0;j<5;j++) {
        const radius=.65+j*.25, jitter=(j%2?.16:-.12);
        points.push(new THREE.Vector3(Math.cos(angle)*radius+jitter, .35+j*.38, Math.sin(angle)*radius-jitter));
      }
      aura.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),boltMaterial));
    }
    object.add(aura); object.userData.lightningAura=aura;
  }
  const active = pose.lightning > .02;
  aura.visible=active;
  if (!active) return;
  const pulse=1+Math.sin(now*.018)*.12;
  aura.scale.setScalar(pulse);
  aura.rotation.y=now*.002;
  aura.children[0].material.opacity=.62+Math.sin(now*.025)*.25;
}
function syncRacers(now, dt) {
  for (const r of state.racers) {
    let object = world.get(r.id);
    if (object && (object.userData.paintId !== (r.paintId || null) || object.userData.appearanceKey !== `${r.customColor||''}/${r.logoId||''}` || object.userData.chairId !== r.chairId || object.userData.pilotId !== (r.pilotId || pilots[0].id))) { disposeObject(object); world.delete(r.id); object = null; }
    if (!object) {
      if (r.id === playerId && preparedChair?.userData.chairId === r.chairId && preparedChair.userData.pilotId === r.pilotId && preparedChair.userData.appearanceKey === `${r.customColor||''}/${r.logoId||''}`) { object = preparedChair; preparedChair = null; }
      else object = makeChair(THREE, paintChair(state.chairs.find(c => c.id === r.chairId) || state.chairs[0],r.paintId,{color:r.customColor,logoId:r.logoId}), pilots.find(p => p.id === r.pilotId) || pilots[0], { race: true, rival: r.id !== playerId });
      object.userData.paintId = r.paintId || null;
      object.userData.appearanceKey = `${r.customColor||''}/${r.logoId||''}`;
      object.userData.pose = {};
      object.userData.isPlayer = r.id === playerId;
      object.traverse(child => { if (child.isMesh) child.castShadow = r.id === playerId; });
      object.userData.cameraFade = 1;
      attachContactShadow(object); scene.add(object); world.set(r.id, object);
    }
    const pose = object.userData.pose;
    if (snapshots.sample(r.id, now, pose)) {
      object.position.set(pose.x, .41, pose.z);
      object.rotation.y = modelYaw(pose.heading) + (pose.spin>0 ? (1-pose.spin/.5)*Math.PI*2 : 0);
      animateChair(object, pose, dt, now);
      updateLightningAura(object, pose, now);
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
  portal.show('race');
  $('#raceTrackName').textContent = `${state.lobby.track.name.toUpperCase()} · ${state.lobby.difficulty || '100'}cc${state.lobby.mode==='endurance'?' · ENDURANCE':''}${state.lobby.cup ? ` · MANCHE ${state.lobby.cup.round}/5` : ''}`;
  $('#raceStatus').textContent = 'À TOI LA PISTE !';
  try { models = await loadModels(); }
  catch (error) { returnToGarage(); $('#menuStatus').textContent = 'Impossible de charger les modèles 3D. Réessaie après rechargement.'; console.error(error); return; }
  if (race.classList.contains('hidden')) return;
  buildWorld(); buildTrack(); resize(); cameraReady = false; previousFrame = 0; effects.reset();
  cancelAnimationFrame(raf);
  syncRacers(performance.now(),0);
  if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
  if(race.classList.contains('hidden'))return;
  lastShadowUpdate=0;frameAverage=16.7;qualitySample=performance.now();qualityFrames=0;
  raf = requestAnimationFrame(draw3D);
}
let lastShadowUpdate=0, frameAverage=16.7, qualitySample=0, qualityFrames=0;
const mapDots=new Map();
let rankingMarkup='';
function draw3D(now) {
  if (!state || race.classList.contains('hidden')) return;
  const dt = previousFrame ? Math.min(.05, (now - previousFrame) / 1000) : 1 / 60;
  if(previousFrame && now-previousFrame<250){frameAverage=frameAverage*.97+(now-previousFrame)*.03;qualityFrames++;}
  if(now-qualitySample>4000 && qualityFrames>60){
    const cap=Math.min(devicePixelRatio,1.35), current=renderer.getPixelRatio();
    const next=frameAverage>24?Math.max(.75,current-.15):frameAverage<17.5?Math.min(cap,current+.1):current;
    if(Math.abs(next-current)>.01){renderer.setPixelRatio(next);resize();}
    qualitySample=now;qualityFrames=0;
  }
  previousFrame = now;
  syncRacers(now, dt);
  if(state.items?.enabled && !itemVisuals)itemVisuals=createItemVisuals(scene);
  itemVisuals?.update(state.items,now);
  audio.observeItems(state.items);
  if(state.lobby.mode==='endurance'&&pitTrack!==state.lobby.trackId){if(pitVisuals)disposeObject(pitVisuals);pitVisuals=createPitVisuals(createCourse(state.lobby.track));pitTrack=state.lobby.trackId;scene.add(pitVisuals);}
  if(pitVisuals)pitVisuals.visible=state.lobby.mode==='endurance';
  animateWorld(environment, now, dt); effects.update(world, dt);
  const object = world.get(playerId);
  audio.updateEngine(object?.userData.pose.speed || 0, Boolean(object && state.lobby.phase === 'racing'));
  if (object) {
    const heading = object.userData.pose.heading;
    const speed = Math.abs(object.userData.pose.speed || 0);
    const targetFov = 54 + Math.min(8, speed * .28) + (object.userData.pose.boost > .05 || object.userData.pose.itemBoost > .05 ? 4 : 0);
    const nextFov = camera.fov + (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
    if (Math.abs(nextFov - camera.fov) > .01) { camera.fov = nextFov; camera.updateProjectionMatrix(); }
    cameraForward.set(Math.cos(heading), 0, Math.sin(heading));
    cameraDesired.copy(object.position).addScaledVector(cameraForward, -9.2); cameraDesired.y += 4.5;
    cameraTarget.copy(object.position).addScaledVector(cameraForward, 2.8); cameraTarget.y += 1.1;
    if (!cameraReady) { camera.position.copy(cameraDesired); cameraReady = true; }
    else camera.position.lerp(cameraDesired, 1 - Math.exp(-10 * dt));
    camera.lookAt(cameraTarget);
    if(now-lastShadowUpdate>=1000/30){sun.position.copy(object.position).add(sunOffset); sun.target.position.copy(object.position);}
    // Racers between the chase camera and the player fade instead of hiding the action.
    for (const other of world.values()) {
      if (other === object) continue;
      const behind = (other.position.x - object.position.x) * cameraForward.x + (other.position.z - object.position.z) * cameraForward.z < -1.2;
      const lateral = Math.abs((other.position.x - object.position.x) * -cameraForward.z + (other.position.z - object.position.z) * cameraForward.x);
      const distance = other.position.distanceTo(camera.position), target = behind && lateral < 1.8 && distance < 8.3 ? 0 : 1;
      const opacity = other.userData.cameraFade + (target - other.userData.cameraFade) * (1 - Math.exp(-15 * dt));
      other.userData.cameraFade = opacity;
      other.userData.cameraFadeUniform.value = opacity;
      // Fully cull camera-obstructing racers after the brief transition, avoiding
      // a permanent noisy semi-transparent silhouette across the player's vehicle.
      other.visible = opacity >= .025;
    }
  }
  // Refresh the shadow camera and its texture together at most 30 times/s.
  renderer.shadowMap.autoUpdate=false;
  if(now-lastShadowUpdate>=1000/30){renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;}
  renderer.render(scene, camera);
  if (object?.userData.pose.finished) {
    finishPresentedAt ??= now;
    $('#countdown').textContent = 'ARRIVÉE !';
    $('#raceStatus').textContent = 'LIGNE FRANCHIE · COURSE TERMINÉE';
    if (now - finishPresentedAt > 1200) { finish(); return; }
  }
  raf = requestAnimationFrame(draw3D);
}
function updateRaceUi() {
  if (!state) return;
  const me = state.racers.find(r => r.id === playerId) || state.racers.find(r => !r.isBot);
  const sorted = [...state.racers].sort(compareRacers);
  itemUI.update(state,me);enduranceUI.update(state,me);
  if (me) {
    $('#lapText').textContent = `TOUR ${Math.min(me.lap, state.lobby.laps)} / ${state.lobby.laps}`;
    $('#speedValue').textContent = Math.round(Math.abs(me.speed) * 3.6);
    $('#racePosition').textContent = String(sorted.findIndex(r => r.id === me.id) + 1).padStart(2, '0');
    $('#boostFill').style.width = `${Math.min(100, me.boost > 0 ? me.boost / 1.1 * 100 : me.drift / 1.6 * 100)}%`;
    $('#boostLabel').textContent = me.boost > 0 ? 'TURBO !' : me.drift > .1 ? 'CHARGE DU DÉRAPAGE' : 'ESPACE · DÉRAPAGE';
    race.classList.toggle('boosting', me.boost > 0);
  }
  $('#raceClock').textContent = new Date(state.lobby.raceTime * 1000).toISOString().slice(14, 19) + '.' + Math.floor(state.lobby.raceTime * 10) % 10;
  if (finishPresentedAt === null) $('#countdown').textContent = state.lobby.countdown || '';
  if (state.lobby.deadline && !me?.finished) $('#raceStatus').textContent = `FIN DANS ${Math.max(0,Math.ceil(state.lobby.deadline-state.lobby.raceTime))} S`;
  const nextRanking = sorted.map((r, i) => `<div class="rank ${r.id === playerId ? 'me' : ''}"><span>${String(i + 1).padStart(2, '0')} &nbsp; ${escapeHtml(r.name)}</span><small>${r.dnf ? 'ABANDON' : r.finished ? 'FINI' : `T${r.lap}`}</small></div>`).join('');
  if(nextRanking!==rankingMarkup){$('#ranking').innerHTML=nextRanking;rankingMarkup=nextRanking;}
  const active=new Set();
  for(const r of state.racers){
    active.add(r.id);let dot=mapDots.get(r.id);
    if(!dot){dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('stroke','#0e274b');dot.setAttribute('stroke-width','1.2');mapDots.set(r.id,dot);$('#raceMapDots').append(dot);}
    dot.setAttribute('cx',r.x);dot.setAttribute('cy',r.z);dot.setAttribute('r',r.id===playerId?4:2.5);dot.setAttribute('fill',r.id===playerId?'#ffdf3c':'#e9f8ff');
  }
  for(const [id,dot] of mapDots)if(!active.has(id)){dot.remove();mapDots.delete(id);}
  if (me?.finished && !result.classList.contains('hidden')) finish();
}
function finish() {
  if (result.classList.contains('hidden')) { keys = {}; updateInput(); cancelAnimationFrame(raf); }
  portal.show('result');
  const sorted = [...state.racers].sort(compareRacers), place = sorted.findIndex(r => r.id === playerId);
  $('#resultTitle').textContent = sorted[place]?.dnf ? 'TEMPS ÉCOULÉ.' : place === 0 ? 'TU AS GAGNÉ.' : `#${place + 1}, BELLE COURSE.`;
  $('#resultCopy').textContent = `${sorted[0].dnf ? 'Aucun pilote n’a terminé.' : `Victoire de ${sorted[0].name}.`} ${sorted.some(r => !r.finished) ? 'Les autres pilotes sont encore en piste.' : 'Classement final.'}`;
  $('#resultRanking').innerHTML = sorted.map((r, i) => `<div class="rank ${r.id === playerId ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name)}</span><small>${r.dnf ? 'ABANDON · 0 PT' : r.finished ? `${Math.floor(r.finishTime / 60)}:${(r.finishTime % 60).toFixed(3).padStart(6, '0')}` : 'EN COURSE'}</small></div>`).join('');
}
function updateInput() {
  send('input', { input: {
    gas: !!(keys.w || keys.z || keys.arrowup), brake: !!(keys.s || keys.arrowdown),
    left: !!(keys.q || keys.arrowleft), right: !!(keys.d || keys.arrowright), drift: !!keys[' ']
  } });
}
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || race.classList.contains('hidden')) return;
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (event.repeat || keys[key]) return;
  keys[key] = true;
  if(enduranceUI.key(key)){event.preventDefault();return;}
  if(key==='a'){event.preventDefault();send('use_item');return;}
  updateInput();
});
document.addEventListener('keyup', event => { if (race.classList.contains('hidden')) return; keys[event.key.toLowerCase()] = false; updateInput(); });
addEventListener('blur', () => { keys = {}; updateInput(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys = {}; updateInput(); }
  cameraReady = false; previousFrame = 0;
});
async function launchRace() {
  if (socket?.readyState !== 1 || state?.lobby.hostId !== playerId) return;
  const roomId = currentRoom, choices = selection.choices(); let failure = null;
  portal.setBusy(true,'Chargement du monde 3D…');
  try {
    models = await loadModels();
    if (roomId !== currentRoom || socket?.readyState !== 1) return;
    buildWorld(); buildTrack(state.lobby.track);
    if (preparedChair) disposeObject(preparedChair);
    const style=portal.user?.progression?.chairStyles?.[choices.chairId];
    preparedChair = makeChair(THREE,paintChair(state.chairs.find(c=>c.id===choices.chairId),portal.user?.progression?.paint,portal.user?.progression?.chairStyles?.[choices.chairId]),pilots.find(p=>p.id===choices.pilotId),{race:true});
    preparedChair.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    preparedChair.userData.appearanceKey=`${style?.color||''}/${style?.logoId||''}`;
    scene.add(preparedChair); await renderer.compileAsync(scene,camera); preparedChair?.removeFromParent();
    if (roomId === currentRoom && state.lobby.hostId === playerId && socket?.readyState === 1) send('start');
  } catch (error) {
    if (preparedChair) {disposeObject(preparedChair);preparedChair=null;}
    console.error(error);failure='Initialisation 3D impossible. Réessaie.';
  } finally {portal.setBusy(false);if(failure)portal.error(failure);}
}
function stopRace() {
  cancelAnimationFrame(raf); keys = {}; updateInput(); effects?.reset(); itemUI.clear();enduranceUI.clear(); document.body.classList.remove('in-race');
}
function leaveRoom() {stopRace();send('leave_room');}
function returnToGarage() {stopRace();leaveRoom();}
function returnToRoom() {stopRace();portal.show(currentRoom?'waiting':'rooms');}
$('#startButton').onclick = returnToRoom;
$('#garageRoomButton').onclick = returnToRoom;
$('#backButton').onclick = leaveRoom;
$('#againButton').onclick = returnToRoom;
const enduranceUI=createEnduranceUI((type,data)=>send(type,data));
const itemUI=createItemsUI(()=>send('use_item'));
portal = createPortal({
  onView(page) {audio.setContext(page);selection.setVisible(page==='garage');if(page!=='race'){cancelAnimationFrame(raf);itemUI.clear();enduranceUI.clear();}},
  onSignedIn(user) {selection.setChoices(user);connect();},
  onSignedOut() {const old=socket;socket=null;old?.close();currentRoom=null;playerId=null;stopRace();portal.setOnline(false);},
  onProfile(user) {selection.setProgression(user?.progression || null);updateFavorite();},
  onJoin(roomId) {send('join_room',{roomId,...selection.choices()});},
  onCareer(difficulty,cupId) {send('start_career',{difficulty,cupId,...selection.choices()});},
  onConfigure(data) {send('configure',data);},
  onLeave:leaveRoom,onStart:launchRace,
  onGarage() {selection.setReady(socket?.readyState===1);selection.show('pilot');renderLobby();updateFavorite();},
  getChoices:()=>selection.choices(),
});
portal.bootstrap();
