import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { chairs, tracks, pilots } from './public/catalog.js';
import { createCourse, spawnRacer, stepRace } from './public/racing.js';

const root=fileURLToPath(new URL('.',import.meta.url)),PORT=process.env.PORT||8080,PHYSICS_DT=1/60,NETWORK_DT=1/15;
const courses = new Map(tracks.map(track => [track.id, createCourse(track)]));
const clients=new Map();let nextId=1,racers=[],lobby={trackId:'coast',laps:3,started:false,countdown:0,raceTime:0,winner:null,raceId:0};
const track=()=>tracks.find(t=>t.id===lobby.trackId)||tracks[0],chair=id=>chairs.find(c=>c.id===id)||chairs[0];
function spawn(r, i) { spawnRacer(r, i, courses.get(lobby.trackId)); }
function bot(i){const c=chairs[i%chairs.length];return{id:`bot-${nextId++}`,name:['Pixel','Nova','Axel','Moxie','Kiro'][i-1]||`Bot ${i}`,chairId:c.id,pilotId:pilots[i%pilots.length].id,isBot:true,x:0,z:0,heading:0,speed:0,progress:0,lap:1,lastAlong:0,finished:false,boost:0,drift:0,wasDrifting:false,skill:.88+Math.random()*.12}}
function fillBots(){while(racers.length<6)racers.push(bot(racers.length))}
function reset(){lobby.raceId++;lobby.started=false;lobby.countdown=0;lobby.raceTime=0;lobby.winner=null;racers.forEach((r,i)=>spawn(r,i))}
// Static meshes/routes/catalogs are sent once in hello, never at the 15 Hz race rate.
function state(){return JSON.stringify({type:'state',lobby,racers,serverTime:Date.now()})}
function broadcast(){const m=state();for(const ws of clients.keys())if(ws.readyState===1)ws.send(m)}
function input(ws,msg){let d;try{d=JSON.parse(msg)}catch{return}const p=clients.get(ws);if(d.type==='join'){if(p)return;if(racers.length>=6){const botIndex=racers.findIndex(r=>r.isBot);if(botIndex<0){ws.send(JSON.stringify({type:'error',message:'La grille est complète : 6 joueurs sont déjà connectés.'}));return;}racers.splice(botIndex,1)}if(tracks.some(t=>t.id===d.trackId))lobby.trackId=d.trackId;const r={id:`p-${nextId++}`,name:String(d.name||'Pilote').slice(0,16),chairId:chair(d.chairId).id,pilotId:(pilots.find(p=>p.id===d.pilotId)||pilots[0]).id,isBot:false,x:0,z:0,heading:0,speed:0,progress:0,lap:1,lastAlong:0,finished:false,boost:0,drift:0,wasDrifting:false,input:{gas:false,brake:false,left:false,right:false,drift:false}};clients.set(ws,r);ws.send(JSON.stringify({type:'joined',playerId:r.id}));racers.push(r);fillBots();reset();broadcast();return}if(!p)return;if(d.type==='input')p.input={...p.input,...d.input};if(d.type==='configure'&&!lobby.started){if(tracks.some(t=>t.id===d.trackId))lobby.trackId=d.trackId;p.chairId=chair(d.chairId).id;p.pilotId=(pilots.find(p=>p.id===d.pilotId)||pilots[0]).id;if(d.name)p.name=String(d.name).slice(0,16);reset();broadcast()}if(d.type==='start'&&!lobby.started&&!lobby.countdown&&racers.length){const raceId=lobby.raceId;lobby.countdown=3;broadcast();setTimeout(()=>{if(lobby.raceId!==raceId)return;lobby.countdown=2;broadcast()},650);setTimeout(()=>{if(lobby.raceId!==raceId)return;lobby.countdown=1;broadcast()},1300);setTimeout(()=>{if(lobby.raceId!==raceId)return;lobby.countdown=0;lobby.started=true;broadcast()},1950)}if(d.type==='restart'){reset();broadcast()}}
function update() {
  if (!lobby.started) return;
  lobby.raceTime += PHYSICS_DT;
  stepRace(racers, courses.get(lobby.trackId), chairs, PHYSICS_DT, lobby.laps, lobby.raceTime);
  const winner = racers.filter(r => r.finished).sort((a, b) => a.finishTime - b.finishTime)[0];
  if (winner) lobby.winner = winner.name;
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary','.ttf':'font/ttf','.json':'application/json; charset=utf-8'};const http=createServer(async(req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const p=pathname==='/'?'/index.html':pathname;try{const file=p==='/three.js'?join(root,'node_modules','three','build','three.module.js'):join(root,'public',p);const body=await readFile(file);res.writeHead(200,{'Content-Type':p==='/three.js'?'text/javascript; charset=utf-8':mime[extname(p)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}});const wss=new WebSocketServer({server:http});wss.on('connection',ws=>{ws.send(JSON.stringify({type:'hello',chairs,tracks,pilots}));ws.on('message',m=>input(ws,m.toString()));ws.on('close',()=>{const p=clients.get(ws);if(p){racers=racers.filter(r=>r.id!==p.id);clients.delete(ws);fillBots();reset();broadcast()}})});setInterval(update,PHYSICS_DT*1000);setInterval(()=>{if(lobby.started)broadcast()},NETWORK_DT*1000);http.listen(PORT,()=>console.log(`Roll Rush Arena listening on http://localhost:${PORT}`));
