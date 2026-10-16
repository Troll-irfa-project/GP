import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Accounts, HttpError, readSessionCookie, sessionCookie, usernameKey } from './backend/accounts.js';
import { RoomManager } from './backend/rooms.js';
import { chairs, tracks, pilots } from './public/catalog.js';
import { MAX_RACERS } from './public/game-config.js';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url)), PORT = Number(process.env.PORT || 8080);
const accounts = new Accounts(process.env.DB_PATH || join(root,'data','rollrush.sqlite'));
const roomCount = Math.max(1,Math.min(20,Number.parseInt(process.env.ROOM_COUNT || '3',10) || 3));
const rooms = new RoomManager(accounts,roomCount), connections = new Map(), usersOnline = new Map();
const attempts = new Map();
const adminSessions = new Map();
const publicRoot = resolve(root,'public');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.glb':'model/gltf-binary','.ttf':'font/ttf','.json':'application/json; charset=utf-8'};

function trustedOrigin(req, optional = false) {
  const expected = process.env.APP_ORIGIN || `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
  if (!req.headers.origin) return optional;
  try { return new URL(req.headers.origin).origin === new URL(expected).origin; } catch { return false; }
}
function json(res, status, data, headers = {}) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415,'Un corps JSON est requis.');
  let size=0, chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>8192) throw new HttpError(413,'Requête trop volumineuse.');
    chunks.push(chunk);
  }
  try {
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400,'Requête JSON invalide.'); }
}
function limited(key, max, windowMs) {
  const now=Date.now();
  let entry=attempts.get(key);
  if(!entry || entry.until<=now) { entry={count:0,until:now+windowMs}; attempts.set(key,entry); }
  entry.count++;
  if(entry.count>max) throw new HttpError(429,'Trop de tentatives. Réessaie dans quelques minutes.');
}
function requireSession(req) {
  const session=accounts.session(readSessionCookie(req));
  if(!session) throw new HttpError(401,'Connecte-toi pour continuer.');
  return session;
}
function requireAdmin(req) { const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('rollrush_admin='))?.slice(14);if(!token||adminSessions.get(token)<=Date.now())throw new HttpError(401,'Authentification admin requise.');return token; }
function adminCookie(token,maxAge=3600) { return `rollrush_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`; }
async function api(req,res,path) {
  if(path==='/api/admin/login') { if(req.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');if(!trustedOrigin(req))throw new HttpError(403,'Origine non autorisée.');const data=await body(req);if(data.username!=='admin'||data.password!=='admin')throw new HttpError(401,'Identifiants admin invalides.');const token=randomUUID();adminSessions.set(token,Date.now()+3600*1000);return json(res,200,{ok:true},{'Set-Cookie':adminCookie(token)}); }
  if(path==='/api/admin/logout') { const token=requireAdmin(req);adminSessions.delete(token);return json(res,200,{ok:true},{'Set-Cookie':adminCookie('',0)}); }
  if(path==='/api/admin/state') { requireAdmin(req);const gp=accounts.grandPrixState(),name=id=>accounts.db.prepare('SELECT username FROM users WHERE id=?').get(id)?.username||'Pilote';return json(res,200,{grandPrix:{...gp,canAttempt:undefined,leaderboard:gp.leaderboard.map(row=>({...row,username:name(row.userId)})),winner:gp.winner?{...gp.winner,username:name(gp.winner.userId)}:null},competitions:accounts.competitionStatus()}); }
  if(path==='/api/admin/action') { requireAdmin(req);if(req.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');if(!trustedOrigin(req))throw new HttpError(403,'Origine non autorisée.');const data=await body(req);let result;if(data.action==='launch-grand-prix')result=accounts.adminLaunchGrandPrix(data.trackId);else if(data.action==='advance-grand-prix')result=accounts.adminAdvanceGrandPrix();else if(data.action==='toggle-competition')result={competitions:accounts.setCompetitionEnabled(data.cupId,Boolean(data.enabled))};else throw new HttpError(400,'Action admin inconnue.');return json(res,200,{ok:true,result}); }
  if(req.method==='GET' && path==='/api/leaderboards') { const leaderboardTracks=tracks.filter(t=>!t.eventId); return json(res,200,{circuits:leaderboardTracks.map(t=>accounts.leaderboard(t.id)),withItems:leaderboardTracks.map(t=>accounts.leaderboard(t.id,true)),endurance:leaderboardTracks.map(t=>accounts.leaderboard(t.id,false,'endurance')),enduranceWithItems:leaderboardTracks.map(t=>accounts.leaderboard(t.id,true,'endurance'))}); }
  if(req.method==='GET' && path==='/api/grand-prix') {const session=requireSession(req),state=accounts.grandPrixState(),name=id=>accounts.db.prepare('SELECT username FROM users WHERE id=?').get(id)?.username||'Pilote';return json(res,200,{...state,canAttempt:state.canAttempt(session.user.id),track:tracks.find(t=>t.id===state.trackId)?.name||state.trackId,leaderboard:state.leaderboard.map(row=>({...row,username:name(row.userId)})),winner:state.winner?{...state.winner,username:name(state.winner.userId)}:null});}
  if(req.method==='GET' && path==='/api/me') return json(res,200,{user:accounts.session(readSessionCookie(req))?.user || null});
  if(req.method==='GET' && path==='/api/rooms') {requireSession(req);return json(res,200,{rooms:rooms.list()});}
  if(req.method!=='POST') throw new HttpError(405,'Méthode non autorisée.');
  if(!trustedOrigin(req)) throw new HttpError(403,'Origine non autorisée.');
  const data=await body(req);
  if(path==='/api/register' || path==='/api/login') {
    limited('ip:'+req.socket.remoteAddress,30,10*60*1000);
    const key='login:'+usernameKey(data.username).slice(0,100);
    if(path==='/api/login') limited(key,10,15*60*1000);
    const user=path==='/api/register' ? await accounts.register(data.username,data.password) : await accounts.login(data.username,data.password);
    attempts.delete(key);
    // Rotate the cookie on every authentication; no token is exposed to JavaScript.
    accounts.revoke(readSessionCookie(req));
    const token=accounts.createSession(user.id), secure=process.env.COOKIE_SECURE==='true' || Boolean(req.socket.encrypted);
    return json(res,path==='/api/register'?201:200,{user},{'Set-Cookie':sessionCookie(token,secure)});
  }
  const session=requireSession(req);
  if(path==='/api/logout') {
    accounts.revoke(readSessionCookie(req));
    for(const [ws,client] of connections) if(client.sessionHash===session.hash) {rooms.remove(client);ws.close(4001,'Déconnexion');}
    return json(res,200,{ok:true},{'Set-Cookie':sessionCookie('',process.env.COOKIE_SECURE==='true')});
  }
  if(path==='/api/shop/buy' || path==='/api/shop/equip') {
    if([...connections.values()].some(c=>c.user.id===session.user.id&&c.roomId)) throw new HttpError(409,'Quitte le salon avant de modifier ton équipement.');
    try {
      if(path.endsWith('/buy')) accounts.economy.buy(session.user.id,data.itemId);
      else accounts.economy.equip(session.user.id,data.slot,data.itemId);
    } catch(error) {throw new HttpError(400,error.message);}
    const user=accounts.profile(session.user.id);
    for(const client of connections.values()) if(client.user.id===user.id) rooms.send(client,'profile',{user});
    return json(res,200,{user});
  }
  if(path==='/api/customization') {
    const clients=[...connections.values()].filter(c=>c.user.id===session.user.id);
    if(clients.some(c=>c.roomId&&rooms.rooms.get(c.roomId)?.phase!=='waiting'))throw new HttpError(409,'La personnalisation est verrouillée pendant une course.');
    try{accounts.economy.customize(session.user.id,data);}catch(error){throw new HttpError(400,error.message);}
    const user=accounts.profile(session.user.id);
    for(const client of clients){rooms.refreshAppearance(client);rooms.send(client,'profile',{user});const room=rooms.rooms.get(client.roomId);if(room)rooms.broadcast(room);}
    return json(res,200,{user});
  }
  if(path==='/api/profile') {
    const keys=Object.keys(data);
    if(keys.some(k=>!['favoriteChairIds'].includes(k)) || !Array.isArray(data.favoriteChairIds) || data.favoriteChairIds.length>chairs.length || data.favoriteChairIds.some(id=>!chairs.some(c=>c.id===id))) throw new HttpError(400,'Préférences invalides.');
    const user=accounts.preferences(session.user.id,{favoriteChairIds:[...new Set(data.favoriteChairIds)]});
    for(const client of connections.values()) if(client.user.id===user.id) rooms.send(client,'profile',{user});
    return json(res,200,{user});
  }
  throw new HttpError(404,'Route introuvable.');
}
const http=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname.startsWith('/api/')) return await api(req,res,pathname);
    if(!['GET','HEAD'].includes(req.method)) throw new HttpError(405,'Méthode non autorisée.');
    const path=decodeURIComponent(pathname==='/'?'/index.html':pathname);
    const file=path==='/three.js' ? join(root,'node_modules','three','build','three.module.js') : resolve(publicRoot,'.'+path);
    if(path!=='/three.js' && (!file.startsWith(publicRoot+sep) || !mime[extname(file)])) throw new HttpError(404,'Fichier introuvable.');
    const contents=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:contents);
  } catch(error) {
    const status=error.status || (error.code==='ENOENT' || error instanceof URIError ? 404 : 500);
    if(status===500) console.error('Request failed:',error.message);
    if(!res.headersSent) json(res,status,{error:status===500?'Erreur du serveur.':error.status?error.message:'Fichier introuvable.'});
    else res.end();
  }
});
const wss=new WebSocketServer({noServer:true,maxPayload:4096});
http.on('upgrade',(req,socket,head)=>{
  const reject=status=>{socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);socket.destroy();};
  if(!trustedOrigin(req,true)) return reject('403 Forbidden');
  const session=accounts.session(readSessionCookie(req));
  if(!session) return reject('401 Unauthorized');
  if(req.url!=='/ws') return reject('404 Not Found');
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,session));
});
wss.on('connection',(ws,session)=>{
  const client={ws,user:session.user,sessionHash:session.hash,roomId:null,racer:null,messages:0,window:Date.now(),alive:true};
  // A single account cannot occupy multiple seats or control multiple racers.
  if(usersOnline.has(session.user.id)) {ws.close(4009,'Ce compte est déjà connecté dans un autre onglet.');return;}
  connections.set(ws,client);usersOnline.set(session.user.id,ws);
  rooms.send(client,'hello',{chairs,tracks,pilots,user:session.user,capacity:MAX_RACERS});
  rooms.add(client);
  ws.on('pong',()=>{client.alive=true;});
  ws.on('message',raw=>{
    if(!accounts.sessionValid(client.sessionHash)) {rooms.remove(client);ws.close(4001,'Session expirée');return;}
    if(Date.now()-client.window>1000) {client.window=Date.now();client.messages=0;}
    if(++client.messages>60) {ws.close(4008,'Trop de messages');return;}
    let data;try{data=JSON.parse(raw.toString());}catch{return rooms.error(client,'Message invalide.');}
    try {rooms.handle(client,data);}catch(error){console.error('Room request failed:',error.message);rooms.error(client,'Action impossible. Réessaie.');}
  });
  ws.on('error',()=>{}); // Close performs cleanup, without logging session material.
  ws.on('close',()=>{
    rooms.remove(client);connections.delete(ws);
    if(usersOnline.get(client.user.id)===ws) usersOnline.delete(client.user.id);
  });
});
setInterval(()=>rooms.tick(1/60),1000/60);
setInterval(()=>rooms.publish(),1000/15);
setInterval(()=>{
  accounts.prune();
  for(const [key,entry] of attempts) if(entry.until<Date.now()) attempts.delete(key);
  for(const [ws,client] of connections) {
    if(!accounts.sessionValid(client.sessionHash)) {rooms.remove(client);ws.close(4001,'Session expirée');continue;}
    if(!client.alive) {ws.terminate();continue;}
    client.alive=false;ws.ping();
  }
},30000).unref();
http.listen(PORT,()=>console.log(`Roll Rush listening on http://localhost:${PORT} · ${roomCount} rooms · ${MAX_RACERS} racers`));
