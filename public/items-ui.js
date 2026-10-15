import { compareRacers } from './racing.js';
import { allRaceItems as raceItems } from './items.js';

const paths={
  viagra:'M12 36 30 8 26 25 44 20 24 49 28 31Z',
  ladder:'M14 7v42M42 7v42M14 12h28M14 23h28M14 34h28M14 45h28',
  lexomil:'M10 28h36M28 10a18 18 0 1 0 0 36 18 18 0 0 0 0-36',
  'viagra-box':'M9 17 28 7 47 17v25L28 51 9 42ZM9 17l19 10 19-10M28 27v24M20 15l18 10',
  revolver:'M7 17h39v11H29l-3 9H15l4-9H7ZM18 37l-3 12h10l2-12M46 15v16',
  round:'M16 9h24v12a12 12 0 0 1-24 0ZM28 33v14M19 47h18M16 18h24',
  puddle:'M7 36c8-12 34-12 42 0-8 9-34 9-42 0ZM16 31c2-8 5-12 9-14M33 30c2-7 4-10 7-12',
  cane:'M38 8c-12 0-15 8-11 14l11 8M38 8l8 5M27 21 12 49M8 49h16',
  aah:'M28 10v36M10 28h36M17 17l22 22M39 17 17 39',
  lightning:'M33 5 14 31h13l-3 20 19-27H30Z',
};
export const itemIcon=id=>`<svg viewBox="0 0 56 56" aria-hidden="true"><path d="${paths[id]||'M21 19a8 8 0 1 1 12 7l-5 4v6M28 43v2'}" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function createItemsUI(activate) {
  const race=document.getElementById('race'),canvas=document.getElementById('game');
  race.insertAdjacentHTML('beforeend',`<div id="itemHud" class="item-hud hidden"><button id="useItem" class="item-slot" aria-label="Utiliser l’objet (A)" disabled><span id="itemIcon"></span><b id="itemCharges"></b><kbd>A</kbd></button><div><span class="section-kicker">BOÎTE MYSTÈRE</span><strong id="itemName">AUCUN OBJET</strong><small id="itemHint">Traverse une boîte sur la piste</small></div></div><div id="itemEffects" class="item-effects" role="status"></div><div id="itemNotice" class="item-notice" role="status" aria-live="polite"></div>`);
  document.getElementById('useItem').onclick=activate;
  const instructions=document.createElement('details');instructions.className='item-guide';
  instructions.innerHTML=`<summary>LES 6 OBJETS · TOUCHE A</summary><p>Un seul emplacement. Traverse une boîte pour l’ouvrir ; elle revient après 8 s. Les bots utilisent aussi les objets. Effets fictifs de jeu.</p><div>${raceItems.map(i=>`<article style="--item-color:${i.color}">${itemIcon(i.id)}<span><b>${i.name}</b><small>${i.description}</small></span></article>`).join('')}</div>`;
  instructions.innerHTML=instructions.innerHTML.replace('LES 6 OBJETS','LES 10 OBJETS');
  document.getElementById('roomGarageButton').before(instructions);
  let previousItem='',previousNotice='';
  return {update(state,me){
    const enabled=Boolean(state?.lobby.itemsEnabled),item=raceItems.find(i=>i.id===me?.item);
    document.getElementById('itemHud').classList.toggle('hidden',!enabled);
    const signature=JSON.stringify([item?.id,me?.itemCharges]);
    if(signature!==previousItem){
      previousItem=signature;document.getElementById('itemIcon').innerHTML=itemIcon(item?.id);
      document.getElementById('itemName').textContent=item?.name.toUpperCase()||'AUCUN OBJET';
      document.getElementById('itemCharges').textContent=item?`×${me.itemCharges}`:'';
      document.getElementById('itemHint').textContent=item?.description||'Traverse une boîte sur la piste';
      document.getElementById('useItem').style.setProperty('--item-color',item?.color||'#869ab8');
    }
    const active=state?.lobby.phase==='racing'&&!me?.finished;
    const order=[...(state?.racers||[])].sort(compareRacers),ahead=order[order.findIndex(r=>r.id===me?.id)-1];
    const canTarget=me?.item!=='revolver'||Boolean(ahead&&!ahead.finished);
    document.getElementById('useItem').disabled=!active||!item||me.stun>0||me.itemCooldown>0||!canTarget||((me.item==='viagra'||me.item==='viagra-box')&&me.itemBoost>0);
    const labels=[];
    if(enabled&&active)for(const [key,label]of [['itemBoost','BOOST +20 %'],['slow','VMAX −20 %'],['blur','VISION TROUBLE'],['stun','IMMOBILISÉ']])if(me?.[key]>0)labels.push(`<span class="effect-${key}">${label} <b>${me[key].toFixed(1)} s</b></span>`);
    document.getElementById('itemEffects').innerHTML=labels.join('');
    // Normalized blur intensity .5 maps to 4px; HUD remains sharp and readable.
    canvas.style.filter=enabled&&active&&me?.blur>0?'blur(4px)':'';
    canvas.dataset.blurIntensity=enabled&&active&&me?.blur>0?'0.5':'0';
    const message=enabled&&active&&me?.itemNotice?.until>state.lobby.raceTime?me.itemNotice.text:'';
    if(message!==previousNotice){previousNotice=message;document.getElementById('itemNotice').textContent=message;}
  },clear(){canvas.style.filter='';canvas.dataset.blurIntensity='0';document.getElementById('itemNotice').textContent='';document.getElementById('itemEffects').textContent='';previousNotice='';}};
}
