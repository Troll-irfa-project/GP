import {logos,logoAchievements,colorSwatches,ownsLogo} from './logo-catalog.js';
import {achievementProgress,paintChair} from './progression.js';

export function createCustomization({save,preview}){
  const $=id=>document.getElementById(id);
  $('selectedStats').insertAdjacentHTML('beforebegin',`<section id="customizationPanel" class="customization-panel hidden" aria-label="Couleurs et logos"><div class="paint-heading"><label for="chairColor">CARROSSERIE <input id="chairColor" type="color" value="#ff6b52" aria-label="Couleur personnalisée du fauteuil"></label><button id="originalColor" type="button">RÉINITIALISER</button></div><div id="colorSwatches" class="color-swatches" aria-label="Palette de couleurs">${colorSwatches.map(c=>`<button type="button" data-color="${c}" style="--swatch:${c}" aria-label="Couleur ${c}" aria-pressed="false"></button>`).join('')}</div><div class="logo-heading"><strong>ÉCUSSONS DE PILOTE</strong><span id="logoCount"></span></div><div id="logoChoices" class="logo-choices"><button type="button" data-logo="" aria-label="Sans logo"><span class="no-logo">∅</span><small>Aucun</small></button>${logos.map(l=>`<button type="button" data-logo="${l.id}" aria-label="Prévisualiser ${l.name}"><img src="${l.art}" alt="${l.name}" width="100" height="56"/><small>${l.name}</small><span class="logo-lock" aria-hidden="true">🔒</span></button>`).join('')}</div><div id="logoObjective" class="logo-objective"></div><div class="customization-actions"><button id="saveCustomization" class="secondary" type="button">APPLIQUER AU FAUTEUIL</button><button id="cancelCustomization" type="button">ANNULER</button></div><p id="customizationStatus" role="status" aria-live="polite">Couleur gratuite · logos offerts par succès · aucun effet sur les statistiques.</p></section>`);
  let chair,progression,signature='',draft={color:null,logoId:null},busy=false;
  function paint(){
    if(!chair)return;
    $('chairColor').value=paintChair(chair,progression?.paint,draft).color;
    for(const b of $('colorSwatches').children)b.setAttribute('aria-pressed',String(b.dataset.color===draft.color));
    $('logoCount').textContent=`${logos.filter(l=>ownsLogo(progression,l.id)).length} / ${logos.length}`;
    for(const b of $('logoChoices').children){const id=b.dataset.logo||null,owned=ownsLogo(progression,id);b.classList.toggle('locked',!owned);b.setAttribute('aria-pressed',String(id===draft.logoId));b.title=id?`${logos.find(l=>l.id===id).name} · ${owned?'débloqué gratuitement':'succès requis'}`:'Aucun logo';}
    const logo=logos.find(l=>l.id===draft.logoId),objective=logoAchievements.find(a=>a.logo===draft.logoId),owned=ownsLogo(progression,draft.logoId);
    $('logoObjective').innerHTML=!logo?'Aucun écusson. L’emplacement reste disponible à l’arrière du dossier.':`<strong>${logo.name} · PALIER ${logo.tier}/13</strong><p>${owned?'✓ DÉBLOQUÉ · GRATUIT':`🔒 APERÇU UNIQUEMENT · ${achievementProgress(objective,progression?.metrics||{})}/${objective.goal} objectifs`}</p><details><summary>Voir les conditions du succès</summary><ul>${objective.requirements.map(r=>`<li>${r.label} <b>${Math.min(r.goal,progression?.metrics?.[r.metric]||0)}/${r.goal}</b></li>`).join('')}</ul></details>`;
    $('saveCustomization').disabled=busy||!owned;$('cancelCustomization').disabled=busy;
    preview({...draft});
  }
  $('colorSwatches').onclick=e=>{const b=e.target.closest('[data-color]');if(b&&!busy){draft.color=b.dataset.color;paint();}};
  $('chairColor').onchange=()=>{if(!busy){draft.color=$('chairColor').value;paint();}};
  $('originalColor').onclick=()=>{if(!busy){draft.color=null;paint();}};
  $('logoChoices').onclick=e=>{const b=e.target.closest('[data-logo]');if(b&&!busy){draft.logoId=b.dataset.logo||null;paint();}};
  $('cancelCustomization').onclick=()=>{draft={color:null,logoId:null,...progression?.chairStyles?.[chair.id]};paint();$('customizationStatus').textContent='Personnalisation enregistrée restaurée.';};
  $('saveCustomization').onclick=async()=>{
    if(busy||!ownsLogo(progression,draft.logoId))return;
    const savedChair=chair.id;busy=true;paint();$('customizationStatus').textContent='Enregistrement…';
    try{await save({chairId:savedChair,...draft});$('customizationStatus').textContent='✓ Couleur et logo enregistrés pour ce fauteuil.';}
    catch(error){$('customizationStatus').textContent=error.message;}
    finally{busy=false;paint();}
  };
  return {update(selected,p,visible){
    chair=selected;progression=p;
    const next=JSON.stringify([chair.id,p?.chairStyles?.[chair.id],p?.paint,p?.earned]);
    if(next!==signature){signature=next;draft={color:null,logoId:null,...p?.chairStyles?.[chair.id]};$('customizationStatus').textContent='Couleur gratuite · logos offerts par succès · aucun effet sur les statistiques.';}
    $('customizationPanel').classList.toggle('hidden',!visible);
    if(visible)paint();
  }};
}
