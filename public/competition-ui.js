import { difficulties, positionPoints, cups, cupById } from './competition.js';
import { tracks } from './catalog.js';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = ms => `${Math.floor(ms/60000)}:${(ms/1000%60).toFixed(3).padStart(6,'0')}`;
export function createCompetitionUI(callbacks, api) {
  const $ = id => document.getElementById(id);
  $('roomCards').insertAdjacentHTML('afterend','<section id="grandPrixPanel" class="grand-prix-panel"><div><span class="section-kicker">ÉPREUVE HEBDOMADAIRE</span><h2>GRAND PRIX DU CHRONO</h2><p id="grandPrixSummary">Chargement de l’épreuve…</p></div><div id="grandPrixBoard"></div></section>');
  $('roomCards').insertAdjacentHTML('afterend',`<section class="competition-hub"><div class="competition-heading"><div><span class="section-kicker">LE DÉFI SOLO / PROGRESSION SAUVEGARDÉE</span><h2>LA ROUTE DES CHAMPIONS.</h2><p>Remporte un tournoi de cinq courses au cumul des points pour débloquer la catégorie suivante.</p></div><button id="openRecords" class="secondary">CLASSEMENTS MONDIAUX ↗</button></div><label>CHAMPIONNAT <select id="careerCup">${cups.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label><div id="careerCards" class="career-cards"></div><p id="careerProgressNotice"></p><p>11 IA · 5 circuits · 3 tours par course. Quitter abandonne le tournoi en cours, mais conserve tes catégories gagnées.</p></section>`);
  $('roomGarageButton').insertAdjacentHTML('beforebegin',`<div class="competition-options"><label>FORMAT<select id="competitionMode"><option value="race">Course unique · 3 tours</option><option value="endurance">Endurance · 15 tours</option><option value="tournament">Tournoi · 5 circuits</option><option value="career" disabled>Carrière solo</option></select></label><label id="cupChoice">COUPE<select id="competitionCup">${cups.map(c=>`<option value="${c.id}">${c.name} · 5 circuits</option>`).join('')}</select></label><label>DIFFICULTÉ DES IA<select id="competitionDifficulty">${difficulties.map(d=>`<option value="${d.id}">${d.name} · ${d.label}</option>`).join('')}</select></label><label>OBJETS<select id="competitionItems"><option value="off">Sans objets · pilotage pur</option><option value="on">Avec objets · boîtes mystères</option></select></label><p>La vitesse de ton fauteuil reste identique. Seul le rythme des IA change.</p><p id="enduranceRules" class="hidden">15 tours · usure cumulée 1 %, 3 %, 6 %… (plafond 80 %). E prépare l’arrêt ; entre dans la bande cyan à droite après la ligne. QTE : une flèche par tour d’usure, erreur = séquence à recommencer. Pneus neufs et départ à 0. Récompenses course ×4. Limite : 30 min, puis 3 min après le premier.</p><p id="cupRoute" class="hidden"></p></div>`);
  $('roomRoster').insertAdjacentHTML('afterend','<div id="cupStandings" class="cup-standings hidden"></div>');
  $('competitionMode').insertAdjacentHTML('afterbegin','<option value="weekly-gp">Grand Prix hebdomadaire · 1 tour</option><option value="time-trial">Contre-la-montre · 1 tour</option>');
  $('resultRanking').insertAdjacentHTML('afterend','<div id="resultCup" class="cup-standings hidden"></div>');
  $('roomBrowser').insertAdjacentHTML('afterend',`<section id="recordsScreen" class="portal-screen records-screen hidden"><div class="portal-backdrop"></div><div class="portal-heading"><div><span class="section-kicker">LE CLUB / TOUS LES PILOTES</span><h1>LES MEILLEURS <em>CHRONOS.</em></h1><p>Top 50 global · records validés par le serveur · toutes catégories IA confondues.</p></div><button id="closeRecords" class="secondary">← PADDOCK</button></div><div class="records-toolbar"><label>CIRCUIT<select id="recordsTrack">${tracks.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><label>FORMAT<select id="recordsMode"><option value="race">Sprint · 3 tours</option><option value="endurance">Endurance · 15 tours</option></select></label><label>RÈGLES<select id="recordsItems"><option value="off">Sans objets</option><option value="on">Avec objets</option></select></label><button id="refreshRecords" class="secondary">ACTUALISER</button></div><p id="recordsStatus" role="status"></p><div class="records-columns"><section><h2 id="recordsRaceTitle">COURSE / 3 TOURS</h2><ol id="globalRaces"></ol></section><section><h2>MEILLEUR TOUR</h2><ol id="globalLaps"></ol></section></div></section>`);
  let user, data=[], itemData=[], enduranceData=[], enduranceItemData=[], online=false, grandPrix=null;
  const formatSeconds=seconds=>`${Number(seconds||0).toFixed(2)} s`;
  async function refreshGrandPrix(){try{grandPrix=await api('/api/grand-prix');$('grandPrixSummary').textContent=grandPrix.day?`Circuit : ${grandPrix.track} · ${grandPrix.day===1?'lundi · ouvert à tous':grandPrix.day===2?'mardi · top 4 qualifiés':'mercredi · top 2 qualifiés'}. ${grandPrix.canAttempt?'Tu peux tenter ton chrono aujourd’hui.':'Tu ne peux plus tenter aujourd’hui.'}`:'Qualifications fermées jusqu’à lundi prochain.';$('grandPrixBoard').innerHTML=grandPrix.leaderboard.length?`<ol>${grandPrix.leaderboard.slice(0,5).map(r=>`<li><b>#${r.rank}</b><span>${esc(r.username)}</span><strong>${formatSeconds(r.time)}</strong></li>`).join('')}</ol>${grandPrix.winner?`<p>Leader provisoire : <strong>${esc(grandPrix.winner.username||'Pilote')}</strong></p>`:''}`:'<p>Aucun chrono enregistré cette semaine.</p>';}catch(error){$('grandPrixSummary').textContent=error.message;}}
  refreshGrandPrix();
  function profile(value) {
    user=value;
    if(user)refreshGrandPrix();
    const career=user?.careers?.[$('careerCup').value] || user?.career;
    $('careerProgressNotice').textContent=career?.completed.length===4 ? '★ CARRIÈRE TERMINÉE — Les quatre coupes sont à toi !' : `${career?.completed.length || 0} / 4 coupes remportées`;
    $('careerCards').innerHTML=difficulties.map(d=>{
      const won=career?.completed.includes(d.id), unlocked=career?.unlocked.includes(d.id) ?? d.id==='50';
      return `<article class="career-card ${won?'won':''} ${!unlocked?'locked':''}"><span class="section-kicker">${won?'★ COUPE REMPORTÉE':unlocked?'À CONQUÉRIR':'CATÉGORIE VERROUILLÉE'}</span><h3>${d.name}</h3><p>${d.label}</p><button class="${unlocked?'primary':'secondary'}" data-career="${d.id}" ${!unlocked||!online?'disabled':''}>${won?'REJOUER':unlocked?'RELEVER LE DÉFI':'GAGNE LA COUPE PRÉCÉDENTE'}</button></article>`;
    }).join('');
  }
  $('careerCards').onclick=e=>{const b=e.target.closest('[data-career]');if(b&&!b.disabled)callbacks.onCareer(b.dataset.career,$('careerCup').value);};
  $('careerCup').onchange=()=>profile(user);
  $('competitionCup').onchange=()=>callbacks.onConfigure({cupId:$('competitionCup').value});
  $('competitionItems').onchange=()=>callbacks.onConfigure({itemsEnabled:$('competitionItems').value==='on'});
  $('competitionMode').insertAdjacentHTML('afterend','<label id="timeTrialChoice" class="hidden">TEMPS À BATTRE<select id="timeTrialTarget"><option value="bronze">Bronze</option><option value="silver">Argent</option><option value="gold">Or</option><option value="record">Mon record</option></select></label>');
  $('competitionMode').onchange=()=>{const mode=$('competitionMode').value;callbacks.onConfigure({mode:mode==='weekly-gp'?'time-trial':mode,weeklyGrandPrix:mode==='weekly-gp'});};
  $('timeTrialTarget').onchange=()=>callbacks.onConfigure({timeTrialTarget:$('timeTrialTarget').value});
  $('competitionDifficulty').onchange=()=>callbacks.onConfigure({difficulty:$('competitionDifficulty').value});
  function renderRecords() {
    const endurance=$('recordsMode').value==='endurance';
    $('recordsRaceTitle').textContent=endurance?'COURSE / 15 TOURS':'COURSE / 3 TOURS';
    const circuit=($('recordsItems').value==='on'?(endurance?enduranceItemData:itemData):(endurance?enduranceData:data)).find(c=>c.trackId===$('recordsTrack').value);
    for(const [id,key]of [['globalRaces','races'],['globalLaps','laps']]) {
      const rows=circuit?.[key]||[];
      $(id).innerHTML=rows.length?rows.map(r=>`<li class="record-row ${r.username===user?.username?'self':''}"><b>#${r.rank}</b><span>${esc(r.username)}</span><strong>${time(r.timeMs)}</strong></li>`).join(''):'<li class="record-empty">La piste attend son premier record.</li>';
    }
  }
  async function refresh() {
    $('refreshRecords').disabled=true;$('recordsStatus').textContent='Chargement des records…';
    try {const response=await api('/api/leaderboards');data=response.circuits;itemData=response.withItems||[];enduranceData=response.endurance||[];enduranceItemData=response.enduranceWithItems||[];renderRecords();$('recordsStatus').textContent='Un meilleur temps par pilote et par circuit. Les abandons ne comptent pas.';}
    catch(error){$('recordsStatus').textContent=error.message;}
    finally{$('refreshRecords').disabled=false;}
  }
  $('openRecords').onclick=()=>{callbacks.onRecords(true);refresh();};
  $('closeRecords').onclick=()=>callbacks.onRecords(false);
  $('refreshRecords').onclick=refresh;$('recordsTrack').onchange=renderRecords;$('recordsItems').onchange=renderRecords;$('recordsMode').onchange=renderRecords;
  function update(state, playerId) {
    const {lobby}=state;
    $('competitionItems').value=lobby.itemsEnabled?'on':'off';
    $('competitionItems').disabled=lobby.hostId!==playerId||lobby.phase!=='waiting';
    $('competitionMode').value=lobby.mode||'race';$('competitionDifficulty').value=lobby.difficulty||'100';
    $('timeTrialChoice').classList.toggle('hidden',!['time-trial','weekly-gp'].includes(lobby.mode));$('timeTrialTarget').value=lobby.timeTrial?.target||'gold';
    const locked=lobby.hostId!==playerId || lobby.phase!=='waiting' || lobby.mode==='career';
    $('competitionCup').value=lobby.cupId||'classic';$('competitionCup').disabled=locked;
    $('cupChoice').classList.toggle('hidden',!['tournament','career'].includes(lobby.mode));
    $('competitionMode').disabled=locked;$('competitionDifficulty').disabled=locked;
    $('enduranceRules').classList.toggle('hidden',lobby.mode!=='endurance');
    $('cupRoute').classList.toggle('hidden',!['tournament','career'].includes(lobby.mode));
    $('cupRoute').textContent='Les cinq manches : '+cupById(lobby.cupId).trackIds.map(id=>tracks.find(t=>t.id===id).name).join(' → ');
    const cup=lobby.cup;
    for(const id of ['cupStandings','resultCup']) {
      $(id).classList.toggle('hidden',!cup);
      if(!cup)continue;
      const next = difficulties[difficulties.findIndex(d=>d.id===lobby.difficulty)+1];
      const careerNotice = cup.complete && lobby.mode==='career' ? (cup.standings[0].id===playerId && cup.standings[0].points>0 ? (next ? `Catégorie ${next.name} débloquée ! Retrouve-la dans le paddock.` : 'Carrière terminée : les quatre catégories sont remportées !') : 'Coupe non remportée. Réessaie pour débloquer la suite !') : '';
      $(id).innerHTML=`<span class="section-kicker">${lobby.mode==='career'?'CARRIÈRE':'TOURNOI'} / ${esc(lobby.difficulty)}cc</span><h2>${cup.complete?`VICTOIRE DE ${esc(cup.standings[0].name)}`:`MANCHE ${cup.round} / ${cup.total}`}</h2><p>${careerNotice}</p><p>${cup.complete?'Coupe terminée.':lobby.phase==='results'?'Points attribués. L’hôte peut lancer la manche suivante.':'Classement cumulé des manches terminées.'}</p><ol>${cup.standings.map((e,i)=>`<li class="record-row ${e.id===playerId?'self':''}"><b>${i+1}</b><span>${esc(e.name)}</span><strong>${e.points} pts <small>+${e.lastPoints}</small></strong></li>`).join('')}</ol><p>Fin de course : 60 s après le premier, 5 min maximum. Circuits Horizons : 120 s après le premier, 10 min maximum.</p><p>Barème : ${positionPoints.join(' / ')}. Abandon : 0. Égalité : victoires, puis temps cumulé, puis ordre de grille.</p>`;
    }
    if(lobby.hostId===playerId && !locked && ['tournament','career'].includes(lobby.mode))$('launchRace').textContent='LANCER LE TOURNOI';
    if(lobby.hostId===playerId && lobby.phase==='waiting' && lobby.mode==='endurance')$('launchRace').textContent='LANCER LES 15 TOURS';
    if(lobby.hostId===playerId && lobby.phase==='waiting' && lobby.mode==='career')$('launchRace').textContent=`LANCER LA COUPE ${lobby.difficulty}cc`;
    if(lobby.hostId===playerId && lobby.phase==='results' && cup)$('launchRace').textContent=cup.complete?'REJOUER LE TOURNOI':`COURSE SUIVANTE · ${cup.round+1} / 5`;
  }
  return {profile,update,setOnline(value){online=value;profile(user);}};
}
