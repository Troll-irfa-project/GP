import { createProgressionUI } from './progression-ui.js';
import { createCompetitionUI } from './competition-ui.js';
import { chairs, tracks, pilots } from './catalog.js';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path, data) {
  const response = await fetch(path, {credentials:'same-origin', ...(data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Action impossible. Réessaie.');
  return value;
}

export function createPortal(callbacks) {
  let user = null, page = 'auth', registering = false, roomState = null, playerId = null, busy = false, online = false;
  const competition = createCompetitionUI({...callbacks,onRecords:open=>show(open?'records':'rooms')},api);
  const progression = createProgressionUI({show,setUser},api);
  function show(next) {
    if(next==='auth' && page!=='auth') authMode(false);
    page = next;
    for (const [name,id] of Object.entries({collection:'progressionScreen',records:'recordsScreen',auth:'authScreen',rooms:'roomBrowser',waiting:'roomLobby',garage:'lobby',race:'race',result:'result'})) $(`#${id}`).classList.toggle('hidden',name!==next);
    document.body.classList.toggle('in-race',next==='race'); callbacks.onView(next);
  }
  function setUser(value) {
    user = value; $('#accountBar').classList.toggle('hidden',!user);
    $('#accountName').textContent = user?.username || '';
    $('#playerName').value = user?.username || ''; $('#playerName').readOnly = true;
    if (user) {
      $('#profileRaces').textContent = user.racesFinished;
      $('#profileWins').textContent = user.racesWon;
      $('#profileRecords').textContent = new Set(user.records.map(r=>r.trackId)).size;
      $('#profileFavorites').textContent = user.favoriteChairIds.length ? user.favoriteChairIds.map(id=>chairs.find(c=>c.id===id)?.name).join(' · ') : 'Aucun favori — ajoute une étoile dans le garage.';
      const format = ms => `${Math.floor(ms/60000)}:${(ms/1000%60).toFixed(3).padStart(6,'0')}`;
      $('#personalRecords').innerHTML = user.records.length ? user.records.map(r=>`<div><strong>${escapeHtml(tracks.find(t=>t.id===r.trackId)?.name || r.trackId)}</strong><span>${r.mode==='endurance'?'Endurance 15 tours':'Sprint 3 tours'} · ${r.itemsEnabled?'Avec objets':'Sans objets'} · Course ${format(r.bestRaceMs)}${r.bestLapMs ? ` · Tour ${format(r.bestLapMs)}` : ''}</span></div>`).join('') : '<p>Termine une course pour inscrire ton premier chrono.</p>';
    }
    progression.profile(user);
    competition.profile(user);
    callbacks.onProfile(user);
  }
  function authMode(register) {
    registering=register;
    $('#loginTab').classList.toggle('active',!register); $('#registerTab').classList.toggle('active',register);
    $('#loginTab').setAttribute('aria-selected',String(!register)); $('#registerTab').setAttribute('aria-selected',String(register));
    $('#authSubmit').textContent=register?'CRÉER MON COMPTE':'ENTRER AU PADDOCK';
    $('#authPassword').autocomplete=register?'new-password':'current-password'; $('#authPassword').minLength=register?8:1;
    $('#passwordHint').textContent=register?'8 caractères minimum. Pas besoin d’adresse e-mail.':'Retrouve ton compte, tes favoris et tes chronos.';
    $('#authStatus').textContent='';
  }
  $('#loginTab').onclick=()=>authMode(false); $('#registerTab').onclick=()=>authMode(true);
  $('#authForm').onsubmit=async event=>{
    event.preventDefault(); $('#authSubmit').disabled=true; $('#authStatus').textContent='Connexion en cours…';
    try {
      const value=await api(registering?'/api/register':'/api/login',{username:$('#authUsername').value,password:$('#authPassword').value});
      $('#authPassword').value=''; $('#authStatus').textContent=''; setUser(value.user); show('rooms'); callbacks.onSignedIn(value.user);
    } catch(error) {$('#authStatus').textContent=error.message;}
    finally {$('#authSubmit').disabled=false;}
  };
  $('#logoutButton').onclick=async()=>{
    $('#logoutButton').disabled=true;
    try {await api('/api/logout',{});callbacks.onSignedOut();setUser(null);show('auth');}
    catch(error) {$('#roomBrowserStatus').textContent=error.message;}
    finally {$('#logoutButton').disabled=false;}
  };
  $('#roomCards').onclick=event=>{const button=event.target.closest('[data-room]');if(button&&!button.disabled){$('#roomBrowserStatus').textContent='Entrée dans la room…';callbacks.onJoin(button.dataset.room);}};
  $('#leaveRoomButton').onclick=()=>callbacks.onLeave();
  $('#roomGarageButton').onclick=()=>{callbacks.onGarage();show('garage');};
  $('#launchRace').onclick=()=>callbacks.onStart();
  $('#favoriteChair').onclick=async()=>{
    if(!user) return;
    const id=callbacks.getChoices().chairId, values=new Set(user.favoriteChairIds);
    if(values.has(id)) values.delete(id); else values.add(id);
    $('#favoriteChair').disabled=true;
    try {setUser((await api('/api/profile',{favoriteChairIds:[...values]})).user);}
    catch(error){$('#menuStatus').textContent=error.message;}
    finally{$('#favoriteChair').disabled=false;}
  };
  function updateWaiting(state,id) {
    roomState=state;playerId=id;
    progression.newRace(state.lobby.raceId);
    const {lobby,racers}=state, host=racers.find(r=>r.id===lobby.hostId), me=racers.find(r=>r.id===id);
    $('#roomName').textContent=lobby.roomName; $('#roomCircuit').textContent=tracks.find(t=>t.id===lobby.trackId)?.name || '';
    $('#roomBackdrop').style.backgroundImage=`linear-gradient(0deg,#07182edd,#09224477 55%,#071c3955),url('${tracks.find(t=>t.id===lobby.trackId)?.menuArt||`/assets/${lobby.trackId}-menu.png`}')`;
    const humans=racers.filter(r=>!r.isBot).length;
    $('#roomOccupancy').textContent=`${humans} JOUEUR${humans>1?'S':''} · ${racers.filter(r=>r.isBot).length} BOTS · 12 PLACES`;
    $('#roomHost').textContent=host?.name || '—';
    const canLaunch=lobby.hostId===id && ['waiting','results'].includes(lobby.phase);
    $('#launchRace').disabled=!online||busy||!canLaunch;
    $('#launchRace').textContent=busy?'PRÉPARATION…':lobby.hostId!==id?'EN ATTENTE DE L’HÔTE':lobby.phase==='results'?'LANCER LA REVANCHE':lobby.phase==='waiting'?'LANCER LA COURSE':'COURSE EN COURS';
    $('#roomGarageButton').disabled=lobby.phase!=='waiting'||busy;
    if(!busy) $('#roomLobbyStatus').textContent=!online?'Connexion au serveur interrompue.':lobby.phase==='waiting'?(canLaunch?'Tu es l’hôte. Attends tes amis, puis lance la course : les bots occupent les places restantes.':`${host?.name || 'L’hôte'} choisit le circuit et lance la course. Tu peux préparer ton fauteuil.`):lobby.phase==='results'?(lobby.cup&&!lobby.cup.complete?'Manche terminée. L’hôte peut lancer le circuit suivant.':'Épreuve terminée. L’hôte peut lancer une revanche.'):me?.finished?'Les autres pilotes terminent leur course. Tu peux rester pour la revanche ou quitter la room.':'La course est en cours.';
    competition.update(state,id);
    if(busy) $('#launchRace').textContent='PRÉPARATION…';
    $('#roomRoster').innerHTML=[...racers].sort((a,b)=>(a.gridPosition||0)-(b.gridPosition||0)).map((r,i)=>`<li class="room-seat ${r.id===id?'self':''} ${r.isBot?'bot':''}"><span class="seat-number">${String(i+1).padStart(2,'0')}</span><div><strong>${escapeHtml(r.name)}</strong><small>${r.isBot?'IA':`Niv. ${r.level || 1}${r.title?' · '+escapeHtml(r.title):''}`}<br>${escapeHtml(chairs.find(c=>c.id===r.chairId)?.name || '')} · ${escapeHtml(pilots.find(p=>p.id===r.pilotId)?.short || '')}</small></div><span class="seat-role">${r.isBot?'IA':r.id===lobby.hostId?'HÔTE':r.id===id?'TOI':'JOUEUR'}</span></li>`).join('');
  }
  return {
    show,setUser,updateWaiting,get user(){return user;},get page(){return page;},
    setBusy(value,message='') {busy=value;if(roomState)updateWaiting(roomState,playerId);if(message)$('#roomLobbyStatus').textContent=message;},
    setOnline(value){online=value;competition.setOnline(value);if(roomState)updateWaiting(roomState,playerId);for(const button of document.querySelectorAll('[data-room]'))button.disabled=!value||button.dataset.available!=='true';},
    error(message){const target=page==='auth'?'authStatus':page==='collection'?'collectionStatus':page==='records'?'recordsStatus':page==='rooms'?'roomBrowserStatus':page==='garage'?'menuStatus':'roomLobbyStatus';$(`#${target}`).textContent=message;},
    authExpired(message){callbacks.onSignedOut();setUser(null);show('auth');$('#authStatus').textContent=message;},
    rooms(list){
      $('#roomCount').textContent=`${list.length} ROOMS DE TEST`;
      $('#roomCards').innerHTML=list.map(room=>{const track=tracks.find(t=>t.id===room.trackId),available=room.phase==='waiting'&&room.humans<room.capacity;
        return `<article class="room-card"><div class="room-art" style="background-image:url('${track?.menuArt||`/assets/${room.trackId}-menu.png`}')"><span class="room-phase">${room.phase==='waiting'?'OUVERTE':room.phase==='countdown'?'DÉPART IMMINENT':'EN COURSE'}</span><b>${String(room.humans).padStart(2,'0')}<small> / ${room.capacity}</small></b></div><div class="room-card-body"><span class="section-kicker">${escapeHtml(track?.name || '')}</span><h2>${escapeHtml(room.name)}</h2><p>${room.mode==='endurance'?'Endurance · 15 tours':room.mode==='tournament'?'Tournoi · 5 circuits':'Course unique · 3 tours'} · ${escapeHtml(room.difficulty || '100')}cc<br>${room.humans} joueur${room.humans>1?'s':''} · ${room.bots} bots<br>Hôte : ${escapeHtml(room.host || 'le premier joueur')}</p><button class="primary" data-room="${room.id}" data-available="${available}" ${!online||!available?'disabled':''}>${available?'REJOINDRE':room.humans>=room.capacity?'COMPLÈTE':'EN COURSE'} <span>❯</span></button></div></article>`;}).join('');
    },
    async bootstrap(){
      show('auth');$('#authSubmit').disabled=true;
      try {const value=await api('/api/me');if(value.user){setUser(value.user);show('rooms');callbacks.onSignedIn(value.user);}}
      catch(error){$('#authStatus').textContent=error.message;}
      finally{$('#authSubmit').disabled=false;}
    },
  };
}
