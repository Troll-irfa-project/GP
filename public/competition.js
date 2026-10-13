export const difficulties = [
  {id:'50', name:'50cc', label:'Découverte', speed:.55},
  {id:'100', name:'100cc', label:'Sport', speed:.78},
  {id:'150', name:'150cc', label:'Expert', speed:1},
  {id:'200', name:'200cc', label:'Élite', speed:1.22},
];
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
