import { chairs,tracks } from '../public/catalog.js';
import { difficulties } from '../public/competition.js';
import { createCourse,spawnRacer,stepRace } from '../public/racing.js';
for(const track of tracks) {
  const report=[];
  for(const d of difficulties) {
    const course=createCourse(track),racers=Array.from({length:12},(_,i)=>({id:String(i),isBot:true,chairId:chairs[i%5].id,skill:d.speed*(.97+i%6*.012),aiDifficulty:d.id}));
    racers.forEach((r,i)=>spawnRacer(r,i,course));let driftFrames=0;
    for(let frame=0;frame<18000&&!racers.every(r=>r.finished);frame++){stepRace(racers,course,chairs,1/60,3,(frame+1)/60);driftFrames+=racers.filter(r=>r.wasDrifting).length;}
    report.push({cc:d.id,finished:racers.filter(r=>r.finished).length,best:Math.min(...racers.filter(r=>r.finished).map(r=>r.finishTime)).toFixed(1),mean:(racers.reduce((s,r)=>s+(r.finishTime||300),0)/12).toFixed(1),recovery:racers.reduce((s,r)=>s+r.recoveryCount,0),driftFrames});
  }
  console.log(track.id,JSON.stringify(report));
}
