import { tyreLoss, PIT_KEYS } from './endurance.js';
const arrows={arrowup:'↑',arrowdown:'↓',arrowleft:'←',arrowright:'→'};
export function createEnduranceUI(send){
  const $=id=>document.getElementById(id);
  $('race').insertAdjacentHTML('beforeend',`<section id="tyreHud" class="tyre-hud hidden" aria-label="État des pneus"><span class="section-kicker">ENDURANCE / PNEUS</span><strong id="tyreStatus">PNEUS NEUFS</strong><progress id="tyreHealth" max="100" value="100"></progress><small id="tyreDetails"></small><small id="pitHint"></small><button id="requestPit" type="button"><kbd>E</kbd> PRÉPARER L’ARRÊT</button></section><section id="pitQte" class="pit-qte hidden" aria-label="Changement des pneus"><span class="section-kicker">PITSTOP / ÉQUIPE TECHNIQUE</span><h2>CHANGEMENT DE PNEUS.</h2><p>Reproduis la séquence avec les flèches du clavier ou les boutons. Une erreur recommence la séquence.</p><div id="pitSequence" class="pit-sequence"></div><div id="pitButtons" class="pit-buttons">${PIT_KEYS.map(k=>`<button type="button" data-pit-key="${k}" aria-label="${k}">${arrows[k]}</button>`).join('')}</div><p id="pitProgress" role="status"></p><progress id="pitMeter" max="1" value="0"></progress></section>`);
  let state,me,signature='',nextInputAt=0;
  const request=()=>{if(state?.lobby.phase==='racing'&&me?.endurance&&!me.finished&&!me.pit)send('pit_request',{raceId:state.lobby.raceId});};
  const key=key=>{
    if(!me?.pit||me.pit.ready||performance.now()<nextInputAt)return;
    nextInputAt=performance.now()+150;
    send('pit_key',{raceId:state.lobby.raceId,stopId:me.pit.id,index:me.pit.index,key});
  };
  $('requestPit').onclick=request;$('pitButtons').onclick=e=>{const b=e.target.closest('[data-pit-key]');if(b)key(b.dataset.pitKey);};
  return {key(keyName){if(me?.pit){if(PIT_KEYS.includes(keyName))key(keyName);return true;}if(keyName==='e'&&me?.endurance){request();return true;}return false;},update(value,r){
    state=value;me=r;
    const enabled=value?.lobby.mode==='endurance',active=enabled&&!me?.finished&&value.lobby.phase==='racing',pit=active&&me?.pit;
    $('tyreHud').classList.toggle('hidden',!enabled);$('pitQte').classList.toggle('hidden',!pit);$('race').classList.toggle('in-pit',Boolean(pit));
    if(!enabled)return;
    const loss=tyreLoss(me?.tyreAge||0);$('tyreStatus').textContent=loss?`VMAX −${loss} %`:'PNEUS NEUFS';
    $('tyreHealth').value=100-loss;$('tyreHud').classList.toggle('worn',loss>=15);
    $('tyreDetails').textContent=`${me?.tyreAge||0} tour(s) sur ce train · ${me?.pitStops||0} arrêt(s)`;
    $('requestPit').disabled=!active||!me?.tyreAge||Boolean(pit);
    $('pitHint').textContent=pit?'Immobilisé pendant le changement':me?.pitRequested?'Rejoins la bande cyan à droite après la ligne.':'';
    $('requestPit').innerHTML=pit?'ARRÊT EN COURS':me?.pitRequested?'<kbd>E</kbd> ARRÊT PRÉVU · ANNULER':'<kbd>E</kbd> PRÉPARER L’ARRÊT';
    $('requestPit').title='Rejoins la bande cyan à droite, juste après la ligne de départ.';
    const stamp=JSON.stringify(pit?[pit.id,pit.index,pit.errors,pit.ready,pit.sequence]:null);
    if(stamp!==signature){signature=stamp;if(pit){
      $('pitSequence').innerHTML=pit.sequence.map((k,i)=>`<span class="${i<pit.index?'done':i===pit.index?'current':''}">${arrows[k]}</span>`).join('');
      $('pitMeter').max=pit.sequence.length;$('pitMeter').value=pit.index;
      $('pitProgress').textContent=pit.ready?'SERRAGE FINAL…':`${pit.index} / ${pit.sequence.length} · ${pit.errors} erreur(s)`;
    }}
  },clear(){me=null;state=null;signature='';$('pitQte').classList.add('hidden');$('tyreHud').classList.add('hidden');$('race').classList.remove('in-pit');}};
}
