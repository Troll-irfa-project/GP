import { shopItems, achievements, achievementProgress } from './progression.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={paint:'LIVRÉE',upgrade:'MODULE',pilot:'PILOTE',chair:'FAUTEUIL',title:'TITRE'};
export function createProgressionUI({show,setUser},api) {
  const $=id=>document.getElementById(id);
  $('roomCards').insertAdjacentHTML('beforebegin',`<div class="progression-pass"><div><span class="section-kicker">TON PASSEPORT DE PILOTE</span><strong id="paddockLevel">NIVEAU 1</strong><span id="paddockXp"></span><progress id="paddockXpBar" value="0" max="250"></progress></div><b id="paddockCoins">0 RUSH</b><button id="openCollection" class="primary">BOUTIQUE & SUCCÈS ❯</button></div>`);
  $('roomBrowser').insertAdjacentHTML('afterend',`<section id="progressionScreen" class="portal-screen collection-screen hidden"><div class="portal-backdrop"></div><div class="portal-heading"><div><span class="section-kicker">LE CLUB / CHAQUE TOUR TE FAIT GRANDIR</span><h1>TON STYLE. <em>TON HISTOIRE.</em></h1><p>Des crédits gagnés en piste. Aucun achat en argent réel.</p></div><button id="closeCollection" class="secondary">← PADDOCK</button></div><div class="collection-summary"><strong id="collectionLevel"></strong><b id="collectionCoins"></b><span id="collectionXp"></span><progress id="collectionXpBar"></progress></div><nav class="collection-tabs" aria-label="Collection"><button id="shopTab" class="secondary" aria-pressed="true">BOUTIQUE</button><button id="achievementsTab" class="secondary" aria-pressed="false">SUCCÈS</button></nav><p id="collectionStatus" role="status" aria-live="polite"></p><div id="shopPanel"><p class="collection-rules">Les 5 fauteuils et 6 pilotes de départ restent gratuits. Stephen Hawking est le déblocage ultime. Nouveaux fauteuils : 35 points, comme les anciens. Un seul module actif, bonus de 2 % maximum. Une condition de succès autorise l’achat, elle n’offre pas l’article.</p><label class="collection-filter">CATÉGORIE <select id="shopFilter"><option value="all">Tout voir</option><option value="legendary">PILOTES LÉGENDAIRES</option>${Object.entries(types).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><div id="shopGrid" class="shop-grid"></div></div><div id="achievementsPanel" class="hidden"><p>Récompenses automatiques, une seule fois par succès. Les courses abandonnées ne rapportent rien.</p><div id="achievementGrid" class="shop-grid"></div></div><details class="reward-history"><summary>Dernières récompenses et achats</summary><ol id="rewardHistory"></ol></details></section>`);
  $('roomGarageButton').insertAdjacentHTML('beforebegin','<p id="equippedLoadout" class="equipped-loadout"></p>');
  $('resultRanking').insertAdjacentHTML('beforebegin','<div id="rewardSummary" class="reward-summary hidden" role="status"></div>');
  document.body.insertAdjacentHTML('beforeend','<div id="rewardToast" class="reward-toast hidden" role="status" aria-live="polite"></div>');
  let user=null,busy=false,timer=null,raceId=null,gained={coins:0,xp:0,names:[]};
  function render() {
    const p=user?.progression;if(!p)return;
    const module=shopItems.find(i=>i.id===p.upgrade),paint=shopItems.find(i=>i.id===p.paint);
    $('equippedLoadout').textContent=`Livrée : ${paint?.name || 'origine'} · Module : ${module ? module.name+' — '+module.description : 'aucun'}. Équipement modifiable depuis la boutique du paddock.`;
    $('paddockLevel').textContent=`NIVEAU ${p.level}`;$('paddockCoins').textContent=`${p.coins.toLocaleString('fr-FR')} RUSH`;
    $('paddockXp').textContent=`${p.current} / ${p.required} XP`;
    $('collectionLevel').textContent=`NIVEAU ${p.level}`;$('collectionCoins').textContent=`${p.coins.toLocaleString('fr-FR')} RUSH`;
    $('collectionXp').textContent=`${p.current} / ${p.required} XP · prochain niveau`;
    for(const id of ['paddockXpBar','collectionXpBar']){$(id).max=p.required;$(id).value=p.current;}
    const filter=$('shopFilter').value;
    $('shopGrid').innerHTML=shopItems.filter(i=>filter==='all'||i.type===filter||(filter==='legendary'&&i.rarity==='legendary')).map(item=>{
      const owned=p.owned.includes(item.id),equipped=p[item.type]===item.id;
      const missingLevel=p.level<item.level,missingSuccess=item.achievement&&!p.earned.includes(item.achievement);
      const locked=missingLevel||missingSuccess;
      const objective=achievements.find(a=>a.id===item.achievement);
      const requirement=objective?objective.name:'';
      const objectiveProgress=objective?Math.min(objective.goal,achievementProgress(objective,p.metrics)):0;
      const equip=['paint','title','upgrade'].includes(item.type);
      const preview=item.type==='chair'?document.querySelector(`[data-chair="${item.target}"] img`)?.src:item.type==='pilot'?document.querySelector(`[data-pilot="${item.target}"] .portrait`)?.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]:null;
      return `<article class="shop-card ${item.rarity==='legendary'?'legendary':''} ${owned?'owned':''}"><div class="shop-emblem ${item.type}" style="--item-color:${item.color||'#ffdf57'}">${item.art?`<span class="legendary-art" style="background-image:url('${item.art}')" role="img" aria-label="${esc(item.name)}"></span>`:item.id==='pilot-hawking'?'<span class="hawking-shop-portrait" aria-label="Stephen Hawking"></span>':preview?`<img src="${esc(preview)}" alt="Aperçu ${esc(item.name)}"/>`:`<span>${item.type==='paint'?'◈':item.type==='upgrade'?'⚙':item.type==='pilot'?'★':item.type==='chair'?'➤':'♜'}</span>`}<small>${item.rarity==='legendary'?'PILOTE LÉGENDAIRE':types[item.type]}</small></div><div class="shop-card-body"><span class="section-kicker">${owned?'DANS TA COLLECTION':`NIVEAU ${item.level}`}</span><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><p class="item-requirements">${requirement?`${missingSuccess?'🔒':'✓'} ${esc(requirement)} · ${missingSuccess?objectiveProgress:objective.goal}/${objective.goal}${item.rarity==='legendary'?`<br>${esc(objective.description)}`:''}`:'Disponible au niveau indiqué.'}</p><strong>${owned?'ACQUIS':`${item.price} RUSH`}</strong><button class="${owned?'secondary':'primary'}" data-item="${item.id}" data-action="${owned?'equip':'buy'}" ${busy||(!owned&&(locked||p.coins<item.price))||(owned&&!equip)?'disabled':''}>${owned?(equip?(equipped?'RETIRER':'ÉQUIPER'):'DISPONIBLE AU GARAGE'):locked?'CONDITIONS REQUISES':p.coins<item.price?'CRÉDITS INSUFFISANTS':'ACHETER'}</button></div></article>`;
    }).join('');
    $('achievementGrid').innerHTML=achievements.map(a=>{
      const earned=p.earned.includes(a.id),value=earned?a.goal:Math.min(a.goal,achievementProgress(a,p.metrics));
      return `<article class="achievement-card ${earned?'earned':''}"><span class="section-kicker">${earned?'★ SUCCÈS REMPORTÉ':'OBJECTIF'}</span><h2>${esc(a.name)}</h2><p>${esc(a.description)}</p>${a.requirements?`<ul class="mastery-objectives">${a.requirements.map(r=>`<li>${esc(r.label)} : <b>${Math.min(r.goal,p.metrics[r.metric]||0)} / ${r.goal}</b></li>`).join('')}</ul>`:''}<progress max="${a.goal}" value="${value}" aria-label="${esc(a.name)}"></progress><span>${earned?a.goal:value} / ${a.goal}</span><strong>+${a.coins} RUSH · +${a.xp} XP</strong><small>${earned?'Bonus déjà versé · acquis conservé':'Bonus automatique à la réussite'}</small></article>`;
    }).join('');
    $('rewardHistory').innerHTML=p.recent.map(r=>`<li><span>${esc(r.label)}</span><strong>${r.coins>=0?'+':''}${r.coins} RUSH · +${r.xp} XP</strong></li>`).join('')||'<li>Ta première récompense t’attend sur la piste.</li>';
  }
  function profile(value) {
    const before=user?.id===value?.id?user?.progression:null,after=value?.progression;
    user=value;
    if(before&&after&&after.xp>before.xp) {
      const xp=after.xp-before.xp,coins=Math.max(0,after.coins-before.coins),names=after.earned.filter(id=>!before.earned.includes(id)).map(id=>achievements.find(a=>a.id===id)?.name);
      gained.xp+=xp;gained.coins+=coins;gained.names.push(...names);
      const summary=`+${gained.coins} RUSH · +${gained.xp} XP${gained.names.length?' · Succès : '+gained.names.join(', '):''}`;
      $('rewardSummary').textContent=summary;$('rewardSummary').classList.remove('hidden');
      $('rewardToast').textContent=`+${coins} RUSH · +${xp} XP${after.level>before.level?` · NIVEAU ${after.level} !`:''}${names.length?' · '+names.join(', '):''}`;
      $('rewardToast').classList.remove('hidden');clearTimeout(timer);timer=setTimeout(()=>$('rewardToast').classList.add('hidden'),7000);
    }
    if(!value){clearTimeout(timer);$('rewardToast').classList.add('hidden');raceId=null;gained={coins:0,xp:0,names:[]};}
    render();
  }
  $('openCollection').onclick=()=>{render();show('collection');};$('closeCollection').onclick=()=>show('rooms');
  $('shopFilter').onchange=render;
  function tab(shop){$('shopPanel').classList.toggle('hidden',!shop);$('achievementsPanel').classList.toggle('hidden',shop);$('shopTab').setAttribute('aria-pressed',String(shop));$('achievementsTab').setAttribute('aria-pressed',String(!shop));}
  $('shopTab').onclick=()=>tab(true);$('achievementsTab').onclick=()=>tab(false);
  $('shopGrid').onclick=async e=>{
    const button=e.target.closest('[data-item]');if(!button||button.disabled||busy)return;
    const item=shopItems.find(i=>i.id===button.dataset.item),action=button.dataset.action;
    busy=true;render();$('collectionStatus').textContent='Validation…';
    try {
      const data=action==='buy'?{itemId:item.id}:{slot:item.type,itemId:user.progression[item.type]===item.id?null:item.id};
      const response=await api(`/api/shop/${action}`,data);setUser(response.user);
      $('collectionStatus').textContent=action==='buy'?`${item.name} rejoint ta collection !`:'Équipement enregistré pour ta prochaine course.';
    }catch(error){$('collectionStatus').textContent=error.message;}
    finally{busy=false;render();}
  };
  return {profile,newRace(id){if(id!==raceId){raceId=id;gained={coins:0,xp:0,names:[]};$('rewardSummary').classList.add('hidden');}}};
}
