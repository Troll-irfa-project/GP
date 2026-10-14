export const difficulties = [
  {id:'50', name:'50cc', label:'Club', speed:1.06, corner:1.12, line:.7, drift:.6},
  {id:'100', name:'100cc', label:'Sport', speed:1.25, corner:1.35, line:1, drift:.9},
  {id:'150', name:'150cc', label:'Expert', speed:1.45, corner:1.58, line:1.25, drift:1.2},
  {id:'200', name:'200cc', label:'Élite', speed:1.65, corner:1.8, line:1.45, drift:1.4},
];
export const cups=[
  {id:'classic',name:'Coupe Originale',trackIds:['neon','coast','metro','garden','orbit']},
  {id:'horizons',name:'Coupe Horizons',trackIds:['canyon','glacier','volcano','jungle','harbor']}
];
export const cupById=id=>cups.find(c=>c.id===id)||cups[0];
export const positionPoints = [15,12,10,9,8,7,6,5,4,3,2,1];
export function careerProgress(wins) {
  const completed = difficulties.filter(d=>wins.includes(d.id)).map(d=>d.id);
  let unlocked = 1;
  while (unlocked < difficulties.length && completed.includes(difficulties[unlocked-1].id)) unlocked++;
  return {completed, unlocked:difficulties.slice(0,unlocked).map(d=>d.id)};
}
export function standings(entries) {
  return [...entries].sort((a,b)=>b.points-a.points || b.wins-a.wins || a.time-b.time || a.seed-b.seed);
}
