// All costume details join the existing suspension/head rigs and material batches.
export function dressLegendary({THREE,group,pilot,box,oval,limb,skin,clothes,hair,white,dark,metal,trim}) {
  if(pilot.rarity!=='legendary')return;
  const id=pilot.id;
  const parts=name=>group.children.filter(o=>o.name===name);
  const remove=name=>parts(name).forEach(o=>{group.remove(o);o.geometry.dispose();});
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.7});
  const accent=material(id==='reeve'?'#2373d8':id==='hector'?'#eee0c8':id==='bran'?'#78604b':'#e4bc70');
  const recolor=(names,mat)=>names.forEach(name=>parts(name).forEach(o=>o.material=mat));
  remove('jacket-zip');
  if(['croizon','xavier'].includes(id)){remove('hair-cap');remove('fringe');}
  if(['dan','coach','bran'].includes(id)){
    for(const side of [-1,1])for(let n=0;n<5;n++){
      const strand=oval('hair-long',[.07,.22+(n%2)*.04,.09],[side*(.18+n*.018),1.92-(n%2)*.06,.08+n*.048],hair);
      strand.rotation.z=side*.18;
    }
  }
  if(['dan','coach'].includes(id)){
    parts('beard').forEach(o=>{o.position.z=-.075;o.scale.set(.22,.13,.17);});
    for(const side of [-1,1]){
      box('leather-lapel',[.13,.30,.05],[side*.13,1.44,-.08],dark).rotation.z=side*.35;
      box('leather-pocket',[.14,.10,.04],[side*.19,1.22,-.085],clothes);
    }
    box('leather-belt',[.53,.08,.04],[0,1.05,-.10],hair);
    box('leather-buckle',[.11,.09,.025],[0,1.05,-.13],metal);
    if(id==='coach'){
      box('scarf',[.12,.55,.06],[.12,1.32,-.14],white);
      for(let i=0;i<5;i++)oval('coach-patch',[.043,.05,.022],[-.13+(i%2)*.09,1.5-Math.floor(i/2)*.13,-.095],i%2?trim:accent);
    }
  }
  if(['reeve','philippe','xavier'].includes(id)){
    box('shirt',[.26,.46,.05],[0,1.32,-.095],id==='reeve'?accent:white);
    for(const side of [-1,1]){
      box('suit-lapel',[.105,.37,.06],[side*.16,1.36,-.13],clothes).rotation.z=side*.27;
      box('shirt-cuff',[.16,.05,.12],[side*.42,1.2,-.22],white);
    }
    if(id==='reeve'){
      box('hero-shield',[.19,.17,.035],[0,1.36,-.14],trim).rotation.z=Math.PI/4;
      const red=material('#dc2432');
      for(const [x,y] of [[0,1.41],[-.04,1.38],[0,1.35],[.04,1.32],[0,1.29]])
        box('hero-emblem',[.08,.025,.02],[x,y,-.175],red);
    }else{
      box('suit-tie',[.055,.32,.025],[0,1.39,-.14],id==='xavier'?dark:accent);
      box('suit-pocket-square',[.06,.055,.025],[-.21,1.43,-.09],white);
      if(id==='xavier')for(const angle of [-.7,.7])box('x-insignia',[.025,.095,.03],[.21,1.43,-.10],trim).rotation.z=angle;
      if(id==='philippe')for(const side of [-1,1])oval('hair-temple',[.045,.115,.12],[side*.237,1.99,.075],metal);
    }
  }
  if(id==='bran'){
    box('winter-blanket',[.68,.56,.13],[0,.72,-.53],clothes);
    for(const side of [-1,1])for(let i=0;i<6;i++){
      oval('fur-collar',[.105,.10,.12],[side*(.10+i*.035),1.53-i*.018,.03],accent);
      oval('fur-hem',[.075,.09,.09],[side*(.04+i*.055),.46,-.55],accent);
    }
    box('cloak-back',[.73,.70,.10],[0,1.24,.32],clothes);
    oval('raven-body',[.10,.16,.09],[.37,1.75,-.03],dark);
    oval('raven-head',[.075,.075,.08],[.37,1.92,-.06],dark);
    limb('raven-beak',[.37,1.92,-.10],[.37,1.91,-.22],.025,metal);
    for(const side of [-1,1])oval('raven-wing',[.045,.16,.09],[.37+side*.08,1.74,-.01],dark).rotation.x=-.35;
    oval('raven-eye',[.012,.012,.012],[.43,1.94,-.10],trim);
  }
  if(id==='jake'){
    recolor(['forearm'],skin);
    limb('adventure-harness',[-.21,1.08,-.095],[.23,1.55,-.04],.043,dark);
    box('harness-buckle',[.10,.09,.035],[0,1.32,-.15],metal);
    for(const side of [-1,1])box('cargo-pocket',[.13,.12,.10],[side*.25,.98,-.20],clothes);
    recolor(['thigh','shin'],clothes);
  }
  if(id==='hector'){
    remove('fringe');
    oval('cap-straw-brim',[.37,.035,.32],[0,2.09,.07],accent);
    oval('cap-straw-crown',[.25,.18,.23],[0,2.2,.09],accent);
    oval('cap-dark-band',[.255,.035,.235],[0,2.12,.09],dark);
    for(let i=-2;i<=2;i++)box('shirt-stripe',[.025,.44,.022],[i*.085,1.29,-.09],white);
    oval('service-bell',[.10,.065,.10],[-.50,1.27,-.32],trim);
    box('bell-base',[.23,.025,.23],[-.50,1.21,-.32],dark);
    limb('bell-button',[-.50,1.31,-.32],[-.50,1.37,-.32],.025,trim);
    for(const side of [-1,1])limb('face-tube',[side*.24,1.90,.03],[side*.05,1.83,-.18],.009,white);
  }
  if(id==='croizon'){
    remove('forearm');remove('hand');
    for(const side of [-1,1]){
      oval('suit-shoulder',[.14,.12,.14],[side*.24,1.46,.08],accent);
      box('prosthetic-shin',[.13,.23,.14],[side*.18,.62,-.52],metal);
    }
  }
  if(id==='stevie'){
    recolor(['sleeve','forearm','thigh','shin','shoe'],white);
    for(const side of [-1,1])limb('sweater-v',[side*.17,1.52,-.07],[0,1.32,-.12],.018,white);
    box('school-badge',[.045,.07,.025],[-.16,1.38,-.09],trim);
    parts('hair-cap').forEach(o=>{o.scale.y=.085;o.position.y=2.13;});
    remove('fringe');
  }
  if(id==='timmy'){
    parts('head').forEach(o=>o.scale.set(.30,.34,.245));
    parts('eye-white').forEach(o=>o.scale.set(.093,.11,.027));
    parts('eye-pupil').forEach(o=>o.scale.set(.015,.021,.014));
    remove('fringe');
    for(let i=0;i<7;i++)oval('hair-tuft',[.045,.09,.055],[(i-3)*.075,2.17+(i%2)*.025,.035],hair).rotation.z=(3-i)*.3;
  }
  if(id==='schumacher'){
    recolor(['thigh','shin','shoe'],clothes);
    for(const side of [-1,1]){
      box('racing-stripe',[.045,.43,.035],[side*.18,1.30,-.09],white);
      limb('racing-sleeve-stripe',[side*.25,1.49,-.015],[side*.38,1.24,-.07],.023,white);
      box('racing-kneepad',[.17,.16,.06],[side*.18,.95,-.50],dark);
      box('racing-boot-stripe',[.16,.025,.15],[side*.18,.50,-.67],white);
    }
    box('racing-badge',[.095,.13,.025],[-.12,1.46,-.09],trim);
    box('racing-collar',[.19,.065,.20],[0,1.58,.09],white);
  }
  group.userData.legendaryCostume=id;
}
