import { tracks } from './catalog.js';

function parisDate(date) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return new Date(Date.UTC(values.year,values.month-1,values.day));
}
export function isoWeekStart(date=new Date()) {
  const value=parisDate(date);
  const day=value.getUTCDay()||7;value.setUTCDate(value.getUTCDate()-day+1);return value.toISOString().slice(0,10);
}
export function grandPrixDay(date=new Date()) { const day=parisDate(date).getUTCDay()||7; return day<1||day>3?0:day; }
export function grandPrixTrackId(weekKey=isoWeekStart()) {
  const hash=[...weekKey].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  return tracks[hash%tracks.length].id;
}
