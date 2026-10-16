import { createCustomization } from './customization-ui.js';
import { chairs, pilots, tracks } from './catalog.js';
import { silhouettes } from './chairs.js';
import { createGarage } from './garage.js';
import { ownsSelection, paintChair, itemFor, achievements, achievementProgress } from './progression.js';
import { MAX_RACERS } from './game-config.js';
import { seasonalEvents } from './seasonal.js';

const $ = selector => document.querySelector(selector);
const stats = [['Vitesse max.', 'speed'], ['Accélération', 'accel'], ['Maniabilité', 'handling']];
const themes = {
  coast: { label: 'GRAND PRIX DU LITTORAL', description: 'Soleil, embruns et virages serrés.', difficulty: 2, tip: 'Garde de la vitesse dans les grandes courbes. Anticipe le freinage avant les épingles.' },
  neon: { label: 'GRAND PRIX NOCTURNE', description: 'La ville s’illumine. La course aussi.', difficulty: 3, tip: 'Les longues lignes droites récompensent la vitesse. Prépare ta trajectoire avant chaque enchaînement.' },
  metro: { label: 'GRAND PRIX SOUTERRAIN', description: 'Un rythme serré, une trajectoire précise.', difficulty: 4, tip: 'Le tracé le plus étroit : privilégie la maniabilité et garde une marge pour les dépassements.' },
  garden: { label: 'GRAND PRIX NATURE', description: 'Une parenthèse verte. À pleine vitesse.', difficulty: 2, tip: 'La piste est plus large : essaie plusieurs trajectoires et utilise toute la largeur dans les courbes.' },
  orbit: { label: 'GRAND PRIX CÉLESTE', description: 'La tête dans les nuages. Les yeux sur la piste.', difficulty: 4, tip: 'Un tour plus long et une piste étroite. La régularité vaut autant que la vitesse de pointe.' },
};
for(const track of tracks.filter(t=>t.cupId==='horizons'))themes[track.id]={label:'COUPE HORIZONS',description:track.subtitle,difficulty:4,tip:'Longue distance : prépare le freinage avant les épingles, puis accélère une fois le fauteuil aligné.'};
const orderedTracks = [...['coast', 'neon', 'garden', 'metro', 'orbit', 'canyon','glacier','volcano','jungle','harbor'].map(id => tracks.find(t => t.id === id)), ...tracks.filter(t=>t.eventId)];
for(const event of seasonalEvents) for(const track of tracks.filter(t=>t.eventId===event.id)) themes[track.id]={label:`EVENT ${event.name.toUpperCase()}`,description:track.subtitle,difficulty:4,tip:`Circuit saisonnier de l’événement ${event.name}.`};
const pad = n => String(n).padStart(2, '0');

export function createSelection(onChange,onCustomize) {
  let screen = 'pilot', chairId = 'comet', pilotId = 'maya', trackId = 'coast', garage, ready = false, visible = true;
  let progression = null, previewPilotId = null,customizing=false;
  $('#chairTab').insertAdjacentHTML('afterend','<button id="customizeTab" class="customize-trigger" aria-pressed="false">COULEURS & LOGOS</button>');
  const customization=createCustomization({save:onCustomize,preview:style=>{if(!customizing)return;garage?.update(paintChair(chairs.find(c=>c.id===chairId),progression?.paint,style),pilots.find(p=>p.id===pilotId));garage?.setRearView(true);}});
  let populated = false, rosterSignature = '', trackLocked = false, timeTrial = null;
  const choices = () => ({ chairId, pilotId, trackId });
  const listFor = () => screen === 'pilot' ? pilots : screen === 'chair' ? chairs : orderedTracks;
  const idFor = () => screen === 'pilot' ? (previewPilotId || pilotId) : screen === 'chair' ? chairId : trackId;
  function populate() {
    if (populated) return; populated = true;
    $('#pilots').innerHTML = pilots.map(p => `<button class="pilot-card ${p.rarity==='legendary'?'legendary':''}" data-pilot="${p.id}" aria-label="Choisir ${p.name}" aria-pressed="false"><span class="portrait" style="background-position:${(p.portrait || 0) % 4 * 100 / 3}% ${Math.floor((p.portrait || 0) / 4) * 100}%"></span><span class="card-name">${p.name}${p.rarity==='legendary'?'<small class="rarity-label">LÉGENDAIRE</small>':''}</span></button>`).join('');
    $('#chairs').innerHTML = chairs.map(c => `<button class="chair-card" data-chair="${c.id}" aria-label="Choisir le fauteuil ${c.name}" aria-pressed="false"><img alt="" width="320" height="180"/><span class="card-name">${c.name}<small>${c.tag.toUpperCase()} · 24 POINTS</small></span></button>`).join('');
    $('#tracks').innerHTML = orderedTracks.map(t => `<button class="track-card" data-track="${t.id}" aria-label="Choisir ${t.name}" aria-pressed="false"><img src="${t.menuArt||`/assets/${t.id}-menu.png`}" alt="" width="320" height="180" loading="lazy"/><span class="card-name">${t.name}<small>3 TOURS · 12 PILOTES</small></span></button>`).join('');
    $('#pilots').addEventListener('click', e => { const card = e.target.closest('[data-pilot]'); if (card) choose(card.dataset.pilot); });
    $('#chairs').addEventListener('click', e => { const card = e.target.closest('[data-chair]'); if (card) choose(card.dataset.chair); });
    $('#tracks').addEventListener('click', e => { const card = e.target.closest('[data-track]'); if (card) choose(card.dataset.track); });
    for(const p of pilots.filter(p=>p.art)){
      const portrait=document.querySelector(`[data-pilot="${p.id}"] .portrait`);
      portrait.classList.add('legendary-art');portrait.style.backgroundImage=`url('${p.art}')`;portrait.style.backgroundPosition='';
    }
    try {
      garage = createGarage($('#garagePreview'));
      for(const pilot of pilots.filter(p=>p.portrait===null&&!p.art)) {
        const portrait=garage.thumbnails([chairs[0]],pilot).get(chairs[0].id);
        const card=document.querySelector(`[data-pilot="${pilot.id}"] .portrait`);
        card.style.backgroundImage=`url('${portrait}')`;card.style.backgroundSize='cover';card.style.backgroundPosition='center';
      }
      const thumbs = garage.thumbnails(chairs, pilots[0]);
      for (const card of document.querySelectorAll('.chair-card')) card.querySelector('img').src = thumbs.get(card.dataset.chair);
    } catch (error) {
      console.warn('3D preview unavailable:', error);
      $('#menuStatus').textContent = 'Aperçu indisponible : WebGL doit être activé pour jouer.';
    }
  }
  function choose(id) {
    if (screen === 'track' && trackLocked) return;
    if (screen === 'pilot' && !ownsSelection(progression,'pilot',id)) {
      previewPilotId=id;render();return;
    }
    if (screen === 'chair' && !ownsSelection(progression,'chair',id)) return;
    previewPilotId=null;
    if (screen === 'pilot') pilotId = id;
    else if (screen === 'chair') chairId = id;
    else trackId = id;
    onChange(choices()); render();
  }
  function show(next, focus = false) {
    customizing=false;screen = next; if(next!=='pilot')previewPilotId=null; render();
    if (focus) document.querySelector(`#${next === 'pilot' ? 'pilots' : next === 'chair' ? 'chairs' : 'tracks'} .active`)?.focus({ preventScroll: true });
  }
  function render() {
    populate();
    const isTrack = screen === 'track', isChair = screen === 'chair';
    const pilot = pilots.find(p => p.id === (screen==='pilot' ? previewPilotId || pilotId : pilotId)), chair = chairs.find(c => c.id === chairId), track = tracks.find(t => t.id === trackId), theme = themes[trackId];
    $('#lobby').dataset.screen = screen;
    $('#lobby').dataset.customizing=String(customizing);
    $('#customizeTab').classList.toggle('active',customizing);$('#customizeTab').setAttribute('aria-pressed',String(customizing));
    $('#garageContent').classList.toggle('hidden', isTrack); $('#circuitContent').classList.toggle('hidden', !isTrack);
    $('#pilots').classList.toggle('hidden', screen !== 'pilot'); $('#chairs').classList.toggle('hidden', !isChair); $('#tracks').classList.toggle('hidden', !isTrack);
    $('#continueButton').classList.toggle('hidden', isTrack); $('#startButton').classList.toggle('hidden', !isTrack);
    $('#selectionBack').classList.toggle('hidden', !isTrack); $('#nameField').classList.toggle('hidden', isTrack);
    $('#selectionTitle').innerHTML = isTrack ? 'CHOIX DU <em>CIRCUIT</em>' : isChair ? 'CHOIX DU <em>FAUTEUIL</em>' : 'CHOIX DU <em>PILOTE</em>';
    $('#continueButton').innerHTML = isChair ? 'CHOISIR LE CIRCUIT <span>❯</span>' : 'CHOISIR LE FAUTEUIL <span>❯</span>';
    const previewLocked=screen==='pilot'&&!ownsSelection(progression,'pilot',pilot.id);
    if(previewLocked)$('#continueButton').textContent='CONTINUER AVEC '+pilots.find(p=>p.id===pilotId).short.toUpperCase();
    $('#garagePreview').dataset.previewPilot=pilot.id;
    $('#garagePreview').dataset.previewOnly=String(previewLocked);
    $('#selectionKicker').textContent = isChair ? 'UNE MACHINE, TON STYLE' : 'LE GARAGE / PERSONNAGE';
    $('#selectionName').textContent = isChair ? chair.name : pilot.name;
    $('#selectionQuote').textContent = isChair ? silhouettes[chairId].label : pilot.role;
    $('#equippedChair').textContent = `${chair.name.toUpperCase()}${isChair ? ` / ${pilot.short.toUpperCase()}` : ''}`;
    $('#chairSpecialty').textContent = chair.tag.toUpperCase();
    $('#selectedStats').innerHTML = stats.map(([label, key]) => `<div class="stat-row"><span>${label}</span><div class="stat-track" role="meter" aria-label="${label}" aria-valuemin="1" aria-valuemax="10" aria-valuenow="${chair[key]}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < chair[key] ? 'on' : ''}"></i>`).join('')}</div><strong>${chair[key]}/10</strong></div>`).join('');
    $('#selectionNote').textContent = isChair ? '3 statistiques, 24 points. Freine avant les virages : à haute vitesse, le rayon s’élargit.' : 'Le personnage change le style. Le fauteuil fait les performances.';
    if(previewLocked){
      const item=itemFor('pilot',pilot.id),a=achievements.find(a=>a.id===item.achievement);
      const earned=a&&progression?.earned.includes(a.id);
      $('#selectionQuote').textContent=(a ? `${earned?'✓':'🔒'} ${a.name} · ${Math.min(a.goal,achievementProgress(a,progression?.metrics||{}))}/${a.goal}. ${a.description.split(' Débloque')[0]}` : `Niveau ${item.level} requis.`) + ` Prix : ${item.price.toLocaleString('fr-FR')} Rush.`;
      $('#selectionNote').textContent=`APERÇU UNIQUEMENT · Non acheté. Pilote équipé : ${pilots.find(p=>p.id===pilotId).name}. L’achat se fait en boutique.`;
    }
    for (const [id, active] of [['pilotTab', !isChair&&!customizing], ['chairTab', isChair&&!customizing]]) { $(`#${id}`).classList.toggle('active', active); $(`#${id}`).setAttribute('aria-pressed', active); }
    for (const [id, active] of [['garageStep', !isTrack], ['circuitStep', isTrack]]) { $(`#${id}`).classList.toggle('current', active); if (active) $(`#${id}`).setAttribute('aria-current', 'step'); else $(`#${id}`).removeAttribute('aria-current'); }
    for (const [kind, selected] of [['pilot', previewPilotId || pilotId], ['chair', chairId], ['track', trackId]]) for (const card of document.querySelectorAll(`[data-${kind}]`)) {
      const active = card.dataset[kind] === selected; card.classList.toggle('active', active); card.setAttribute('aria-pressed', active);
      if (kind === 'track') card.disabled = trackLocked;
      else {
        const locked=!ownsSelection(progression,kind,card.dataset[kind]);
        card.disabled=kind==='pilot'?false:locked;card.classList.toggle('locked',locked);
        if(kind==='pilot')card.setAttribute('aria-label',`${locked?'Prévisualiser':'Choisir'} ${pilots.find(p=>p.id===card.dataset.pilot).name}${locked?' — non acheté':''}`);
        card.querySelector('.unlock-label')?.remove();
        if(locked) {
          const item=itemFor(kind,card.dataset[kind]);
          const label=document.createElement('small');label.className='unlock-label';label.textContent=item.rarity==='legendary'?`${item.price.toLocaleString('fr-FR')} RUSH`:`BOUTIQUE · NIV. ${item.level}`;card.querySelector('.card-name').append(label);
        }
      }
    }
    $('#dockLabel').textContent = isTrack ? 'CHOISIS TON TERRAIN DE JEU' : isChair ? 'CHOISIS TON FAUTEUIL' : 'CHOISIS TON PERSONNAGE';
    const items = listFor(); $('#selectionCount').textContent = `${pad(items.findIndex(item => item.id === idFor()) + 1)} / ${pad(items.length)}`;
    const background = isTrack ? track.menuArt||`/assets/${trackId}-menu.png` : '/assets/coast-menu.png';
    if ($('#menuBackdrop').dataset.source !== background) { $('#menuBackdrop').style.backgroundImage = `url('${background}')`; $('#menuBackdrop').dataset.source = background; }
    $('#trackName').textContent = track.name; $('#trackKicker').textContent = theme.label;
    $('#trackDescription').textContent = theme.description; $('#trackTip').textContent = theme.tip;
    const length = track.route.reduce((sum, point, i) => { const next = track.route[(i + 1) % track.route.length]; return sum + Math.hypot(next[0] - point[0], next[1] - point[1]); }, 0);
    $('#trackLength').textContent = `${Math.round(length)} m`;
    $('#trackDifficulty').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < theme.difficulty ? 'on' : ''}"></i>`).join('');
    $('#trackDifficulty').setAttribute('aria-label', `${theme.difficulty} sur 5`);
    const medalPanel=$('#timeTrialMedals');
    medalPanel.classList.toggle('hidden',!timeTrial);
    if(timeTrial){
      const medalTime=medal=>Number(timeTrial.medals?.[medal]||0);
      medalPanel.innerHTML=`<span class="medal-title">TEMPS À BATTRE · ${String(timeTrial.target||'gold').toUpperCase()}</span><div><b class="bronze">BRONZE <strong>${medalTime('bronze').toFixed(2)} s</strong></b><b class="silver">ARGENT <strong>${medalTime('silver').toFixed(2)} s</strong></b><b class="gold">OR <strong>${medalTime('gold').toFixed(2)} s</strong></b></div>${timeTrial.target==='record'?`<small>Référence sélectionnée : ${Number(timeTrial.reference||0).toFixed(2)} s</small>`:''}`;
    }
    const route = track.route.map(p => p.join(',')).join(' '), start = track.route[0];
    const xs = track.route.map(p => p[0]), zs = track.route.map(p => p[1]);
    $('#trackRoute').setAttribute('viewBox', `${Math.min(...xs) - 12} ${Math.min(...zs) - 12} ${Math.max(...xs) - Math.min(...xs) + 24} ${Math.max(...zs) - Math.min(...zs) + 24}`);
    $('#trackRoute').innerHTML = `<polyline points="${route} ${start.join(',')}" fill="none" stroke="#05172f" stroke-width="11" stroke-linejoin="round"/><polyline points="${route} ${start.join(',')}" fill="none" stroke="#f9dc50" stroke-width="5" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="5" fill="white" stroke="#0c2544" stroke-width="2"/>`;
    garage?.update(paintChair(chair,progression?.paint,progression?.chairStyles?.[chair.id]), pilot); garage?.setRearView(customizing);garage?.setActive(visible && !isTrack);
    customization.update(chair,progression,customizing);
    $('#continueButton').disabled = !ready; $('#startButton').disabled = !ready;
  }
  $('#customizeTab').onclick=()=>{screen='chair';customizing=true;previewPilotId=null;render();};
  $('#pilotTab').onclick = () => show('pilot'); $('#chairTab').onclick = () => show('chair');
  $('#garageStep').onclick = () => show('pilot'); $('#circuitStep').onclick = () => show('track');
  $('#continueButton').onclick = () => show(screen === 'pilot' ? 'chair' : 'track', true);
  $('#selectionBack').onclick = () => show('chair', true);
  function move(direction) { const items = listFor().filter(i=>screen==='track'||screen==='pilot'||ownsSelection(progression,screen,i.id)), index = items.findIndex(item => item.id === idFor()); choose(items[(index + direction + items.length) % items.length].id); const card = document.querySelector(`#${screen === 'pilot' ? 'pilots' : screen === 'chair' ? 'chairs' : 'tracks'} .active`); card?.focus({ preventScroll: true }); card?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
  $('#previousChoice').onclick = () => move(-1); $('#nextChoice').onclick = () => move(1);
  document.addEventListener('keydown', e => {
    if (!visible || e.target instanceof HTMLInputElement || e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); show(screen === 'track' ? 'chair' : 'pilot', true); }
  });
  return {
    choices,
    setProgression(value) {progression=value;if(populated)render();},
    setChoices(user) {if(user.pilotId!==pilotId)previewPilotId=null;chairId=user.chairId;pilotId=user.pilotId;render();},
    setMultiplayer(id,host) {if(trackId===id && trackLocked===!host)return;trackId=id;trackLocked=!host;render();if(trackLocked)$('#menuStatus').textContent='Le circuit est choisi par l’hôte du salon.';else $('#menuStatus').textContent='';},
    show,
    setVisible(value) { visible = value; garage?.setActive(value && screen !== 'track'); },
    setReady(value) { ready = value; $('#continueButton').disabled = !value; $('#startButton').disabled = !value; },
    update(state) {
      if (!populated) render();
      const nextTimeTrial=['time-trial','weekly-gp'].includes(state?.lobby?.mode)?state.lobby.timeTrial:null;
      const timeTrialChanged=JSON.stringify(nextTimeTrial)!==JSON.stringify(timeTrial);
      timeTrial=nextTimeTrial;
      const racers = state?.racers || [], signature = JSON.stringify([state?.lobby?.laps,state?.lobby?.mode,timeTrial?.target,timeTrial?.reference,timeTrial?.medals,racers.map(r => [r.id, r.name, r.isBot])]);
      if (signature === rosterSignature) {if(timeTrialChanged)render();return;} rosterSignature = signature;
      if(timeTrialChanged)render();
      $('#slots').replaceChildren(...Array.from({ length: MAX_RACERS }, (_, i) => {
        const r = racers[i], slot = document.createElement('span'); slot.className = `slot ${r && !r.isBot ? 'human' : ''}`;
        slot.textContent = r && !r.isBot ? '●' : 'AI'; slot.title = r ? `${r.name}${r.isBot ? ' · bot' : ''}` : 'Place libre — complétée par un bot'; return slot;
      }));
      const humans = racers.filter(r => !r.isBot).length;
      $('#gridLabel').textContent = `${humans} joueur${humans > 1 ? 's' : ''} · ${MAX_RACERS - humans} bots · ${state?.lobby?.laps||3} tours`;
      for(const el of document.querySelectorAll('.track-card small'))el.textContent=`${state?.lobby?.laps||3} TOURS · 12 PILOTES`;
      document.querySelector('.route-preview small').textContent=`${state?.lobby?.laps||3} TOURS POUR FAIRE LA DIFFÉRENCE`;
    },
  };
}
