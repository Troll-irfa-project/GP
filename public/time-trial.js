import { createCourse } from './racing.js';
// Targets are intentionally demanding: bronze already requires a clean lap,
// while gold rewards near-perfect lines and acceleration management.
export function timeTrialMedals(track){const lap=createCourse(track).total,base=lap/22.25;return{bronze:base*1.15,silver:base,gold:base*.88};}
export function timeTrialReference(track,choice='gold',records=[]){if(choice==='record'){const record=records.find(r=>r.trackId===track.id&&!r.itemsEnabled&&r.mode!=='endurance');if(record?.bestRaceMs)return record.bestRaceMs/1000;}return timeTrialMedals(track)[choice]||timeTrialMedals(track).gold;}
export function timeTrialMedal(track,time){const medals=timeTrialMedals(track);if(time<=medals.gold)return'gold';if(time<=medals.silver)return'silver';if(time<=medals.bronze)return'bronze';return'none';}
