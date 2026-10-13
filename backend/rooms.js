import { resetEndurance, tickEndurance, enterPit, pitKey, ENDURANCE_LAPS, ENDURANCE_LIMIT, ENDURANCE_GRACE } from '../public/endurance.js';
import { createItems, resetRacerItems, tickItems, collectItems } from '../public/items.js';
import { randomUUID } from 'node:crypto';
import { chairs, tracks, pilots } from '../public/catalog.js';
import { MAX_RACERS } from '../public/game-config.js';
import { createCourse, spawnRacer, stepRace, compareRacers } from '../public/racing.js';

import { ownsSelection, shopItems } from '../public/progression.js';
import { difficulties, positionPoints, standings } from '../public/competition.js';

const courses = new Map(tracks.map(t => [t.id, createCourse(t)]));
const names = ['Pixel','Nova','Axel','Moxie','Kiro','Ziggy','Bolt','Echo','Luna','Flash','Nox','Vega'];
const validChair = id => chairs.some(c => c.id === id), validPilot = id => pilots.some(p => p.id === id);
export class RoomManager {
  constructor(accounts, count = 3) {
    this.accounts = accounts; this.clients = new Set(); this.nextBot = 0;
    this.rooms = new Map(Array.from({length:count}, (_, i) => {
      const id = `room-${i + 1}`, name = ['Paddock Azur','Club Néon','Jardin Turbo'][i] || `Paddock ${i + 1}`;
      const room = { id, name, members: new Map(), trackId: ['coast','neon','garden'][i % 3], racers: [] };
      this.reset(room); return [id, room];
    }));
  }
  send(client, type, payload = {}) { if (client.ws.readyState === 1) client.ws.send(JSON.stringify({ type, ...payload })); }
  error(client, message) { this.send(client, 'error', { message }); }
  host(room) { return room.members.values().next().value || null; }
  list() {
    return [...this.rooms.values()].filter(r=>!r.private).map(r => ({id:r.id,name:r.name,trackId:r.trackId,mode:r.mode,difficulty:r.difficulty,itemsEnabled:r.itemsEnabled,phase:r.phase,humans:r.members.size,bots:MAX_RACERS-r.members.size,capacity:MAX_RACERS,host:this.host(r)?.user.username || null}));
  }
  announce() { const rooms = this.list(); for (const c of this.clients) this.send(c, 'rooms', {rooms}); }
  add(client) { this.clients.add(client); this.send(client, 'rooms', { rooms:this.list() }); }
  remove(client) { this.leave(client); this.clients.delete(client); }
  bot(index) {
    return {id:`bot-${++this.nextBot}`,name:names[index % names.length],chairId:chairs[index % 5].id,pilotId:pilots.filter(p=>p.id!=='hawking')[index % 6].id,isBot:true,skill:.90+(index%6)*.016};
  }
  reset(room, preserve = false) {
    room.itemsEnabled ??= false;
    room.mode ??= 'race'; room.difficulty ??= '100'; room.deadline = null;
    if (!preserve) room.cup = null;
    if (!preserve && ['tournament','career'].includes(room.mode)) room.trackId = tracks[0].id;
    room.laps=room.mode==='endurance'?ENDURANCE_LAPS:3;
    room.items = createItems(courses.get(room.trackId),room.itemsEnabled);
    room.phase = 'waiting'; room.raceId = randomUUID(); room.raceTime = 0; room.countdown = 0; room.winner = null; room.recorded = new Set();
    const humans = [...room.members.values()].map(c => { c.racer.input = {}; return c.racer; });
    if (!preserve) room.racers = humans;
    while (room.racers.length < MAX_RACERS) room.racers.push(this.bot(room.racers.length));
    room.racers.forEach((r,i) => {
      r.input = {}; r.aiDifficulty=room.difficulty; r.skill = difficulties.find(d=>d.id===room.difficulty).speed * (.97+(i%6)*.012);
      spawnRacer(r,i,courses.get(room.trackId)); resetRacerItems(r);resetEndurance(r,room.mode==='endurance');
    });
  }
  broadcast(room) {
    const lobby = {roomId:room.id,roomName:room.name,hostId:this.host(room)?.racer.id || null,phase:room.phase,
      trackId:room.trackId,laps:room.laps,capacity:MAX_RACERS,raceId:room.raceId,raceTime:room.raceTime,
      mode:room.mode,difficulty:room.difficulty,itemsEnabled:room.itemsEnabled,deadline:room.deadline,cup:room.cup ? {round:room.cup.round+1,total:5,complete:room.cup.complete,standings:standings(room.cup.entries).map(({userId,...entry})=>entry)} : null,
      started:room.phase==='racing'||room.phase==='results',countdown:room.countdown,winner:room.winner};
    const racers = room.racers.map(({userId, ...r}) => r);
    for (const c of room.members.values()) this.send(c,'state',{lobby,racers,items:room.items,serverTime:Date.now()});
  }
  join(client, data) {
    const room = this.rooms.get(data.roomId);
    if (!room) return this.error(client,'Cette room n’existe pas.');
    if (room.private && room.owner !== client.user.id) return this.error(client,'Cette carrière est privée.');
    if (client.roomId) return this.error(client,'Quitte ta room actuelle avant d’en rejoindre une autre.');
    if (room.phase !== 'waiting') return this.error(client,'La course a déjà commencé. Choisis une autre room.');
    if (room.members.size >= MAX_RACERS) return this.error(client,'Cette room est complète : 12 joueurs humains.');
    const profile = this.accounts.profile(client.user.id);
    if (!ownsSelection(profile.progression,'chair',data.chairId || profile.chairId) || !ownsSelection(profile.progression,'pilot',data.pilotId || profile.pilotId)) return this.error(client,'Ce pilote ou fauteuil doit être acheté dans la boutique.');
    client.racer = {id:`p-${client.user.id}`,userId:client.user.id,name:profile.username,
      chairId:validChair(data.chairId)?data.chairId:profile.chairId,pilotId:validPilot(data.pilotId)?data.pilotId:profile.pilotId,isBot:false,input:{},paintId:profile.progression?.paint || null,upgradeId:profile.progression?.upgrade || null,title:shopItems.find(i=>i.id===profile.progression?.title)?.name || '',level:profile.progression?.level || 1};
    client.roomId = room.id; room.members.set(client.user.id,client);
    this.accounts.preferences(client.user.id,{chairId:client.racer.chairId,pilotId:client.racer.pilotId});
    this.reset(room); this.send(client,'joined',{playerId:client.racer.id,roomId:room.id}); this.broadcast(room); this.announce();
  }
  leave(client) {
    const room = this.rooms.get(client.roomId); client.roomId = null;
    if (!room) return;
    room.members.delete(client.user.id);
    if (room.phase === 'waiting' || !room.members.size) this.reset(room);
    else {
      // Mid-race departures never reset the other racers: AI takes over this seat.
      const r = client.racer; r.isBot = true; delete r.userId; r.name = 'Relais IA'; r.aiDifficulty=room.difficulty; r.skill = difficulties.find(d=>d.id===room.difficulty).speed; r.input = {};
    }
    if (!room.members.size && room.private) this.rooms.delete(room.id);
    client.racer = null; this.send(client,'left'); this.broadcast(room); this.announce();
  }
  configure(client, data) {
    const room = this.rooms.get(client.roomId);
    if (!room || room.phase !== 'waiting') return this.error(client,'Les choix sont verrouillés pendant la course.');
    if(data.itemsEnabled!==undefined && (typeof data.itemsEnabled!=='boolean' || this.host(room)!==client))return this.error(client,'Seul l’hôte peut choisir une option objets valide.');
    if ((data.mode !== undefined || data.difficulty !== undefined) && (this.host(room) !== client || room.private)) return this.error(client,'Seul l’hôte peut régler un salon multijoueur.');
    if (data.mode !== undefined && !['race','tournament','endurance'].includes(data.mode) || data.difficulty !== undefined && !difficulties.some(d=>d.id===data.difficulty)) return this.error(client,'Mode ou difficulté invalide.');
    if (data.trackId && data.trackId !== room.trackId && this.host(room) !== client) return this.error(client,'Seul l’hôte choisit le circuit.');
    if (data.chairId && !validChair(data.chairId) || data.pilotId && !validPilot(data.pilotId) || data.trackId && !tracks.some(t=>t.id===data.trackId)) return this.error(client,'Choix de course invalide.');
    const profile=this.accounts.profile(client.user.id);
    if (!ownsSelection(profile.progression,'chair',data.chairId || client.racer.chairId) || !ownsSelection(profile.progression,'pilot',data.pilotId || client.racer.pilotId)) return this.error(client,'Ce pilote ou fauteuil n’est pas encore dans ta collection.');
    if (data.itemsEnabled!==undefined) room.itemsEnabled=data.itemsEnabled;
    if (data.mode) room.mode = data.mode;
    if (data.difficulty) room.difficulty = data.difficulty;
    if (data.chairId) client.racer.chairId = data.chairId;
    if (data.pilotId) client.racer.pilotId = data.pilotId;
    const changed = data.trackId && data.trackId !== room.trackId;
    if (changed) room.trackId = data.trackId;
    this.accounts.preferences(client.user.id,{chairId:client.racer.chairId,pilotId:client.racer.pilotId});
    if (changed || data.mode || data.difficulty || data.itemsEnabled!==undefined) this.reset(room);
    this.broadcast(room); if (changed || data.mode || data.difficulty || data.itemsEnabled!==undefined) this.announce();
  }
  start(client) {
    const room = this.rooms.get(client.roomId);
    if (!room || this.host(room) !== client) return this.error(client,'Seul l’hôte peut lancer la course.');
    if (!['waiting','results'].includes(room.phase)) return this.error(client,'Une course est déjà en cours.');
    if (['tournament','career'].includes(room.mode)) {
      if (room.cup && !room.cup.complete) {
        room.cup.round++;
      } else {
        this.reset(room);
        room.cup = {id:randomUUID(),round:0,complete:false,entries:room.racers.map((r,seed)=>({id:r.id,userId:r.userId,name:r.name,seed,points:0,wins:0,time:0,lastPoints:0}))};
      }
      room.trackId = tracks[room.cup.round].id;
      this.reset(room,true);
    } else this.reset(room);
    room.phase = 'countdown'; room.countdown = 3; room.countdownLeft = 3;
    this.broadcast(room); this.announce();
  }
  career(client, data) {
    if (client.roomId) return this.error(client,'Quitte ta room avant de commencer une carrière.');
    const profile = this.accounts.profile(client.user.id);
    if (!profile.career.unlocked.includes(data.difficulty)) return this.error(client,'Gagne le tournoi précédent pour débloquer cette catégorie.');
    const room = {id:`career-${client.user.id}`,name:'Coupe Carrière',private:true,owner:client.user.id,mode:'career',difficulty:data.difficulty,members:new Map(),racers:[],trackId:tracks[0].id};
    this.reset(room); this.rooms.set(room.id,room);
    this.join(client,{...data,roomId:room.id});
  }
  completeRace(room) {
    if (room.phase !== 'racing') return;
    room.phase = 'results';
    if (room.cup) {
      [...room.racers].sort(compareRacers).forEach((r,i)=>{
        const entry = room.cup.entries.find(e=>e.id===r.id);
        entry.lastPoints = r.dnf ? 0 : positionPoints[i];
        entry.points += entry.lastPoints; entry.wins += !r.dnf && i===0 ? 1 : 0;
        entry.time += r.dnf ? 600 : r.finishTime;
      });
      if (room.cup.round === tracks.length-1) {
        room.cup.complete = true;
        standings(room.cup.entries).forEach((entry,i)=>{
          // Departed racers are AI relays, never a source of offline career wins.
          if (!entry.userId || !room.members.has(entry.userId)) return;
          this.accounts.recordTournament({id:room.cup.id,userId:entry.userId,difficulty:room.difficulty,mode:room.mode,place:i+1,points:entry.points,wonRaces:entry.wins,itemsEnabled:room.itemsEnabled});
          const client=room.members.get(entry.userId),user=this.accounts.profile(entry.userId);
          client.racer.level=user.progression?.level || client.racer.level;
          this.send(client,'profile',{user});
        });
      }
    }
    this.broadcast(room); this.announce();
  }
  handle(client, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    if (data.type === 'start_career') return this.career(client,data);
    if (data.type === 'join_room') return this.join(client,data);
    if (data.type === 'leave_room') return this.leave(client);
    if (data.type === 'configure') return this.configure(client,data);
    if (data.type === 'start') return this.start(client);
    if(data.type==='pit_request'||data.type==='pit_key'){
      const room=this.rooms.get(client.roomId),r=client.racer;
      if(room?.phase!=='racing'||room.mode!=='endurance'||!r||r.finished||data.raceId!==room.raceId)return;
      if(data.type==='pit_request'&&!r.pit&&r.tyreAge>0)r.pitRequested=!r.pitRequested;
      if(data.type==='pit_key')pitKey(r,data.key,data.stopId,data.index,room.raceTime);
      this.broadcast(room);return;
    }
    if(data.type==='use_item') {
      const room=this.rooms.get(client.roomId);
      if(room?.phase==='racing' && room.itemsEnabled && client.racer && !client.racer.finished)client.racer.itemUseQueued=true;
      return;
    }
    if (data.type === 'input' && client.racer && this.rooms.get(client.roomId)?.phase === 'racing') {
      client.racer.input = Object.fromEntries(['gas','brake','left','right','drift'].map(k=>[k,data.input?.[k]===true]));
    }
  }
  tick(dt) {
    for (const room of this.rooms.values()) {
      if (!room.members.size) continue;
      if (room.phase === 'countdown') {
        room.countdownLeft -= dt;
        const count = Math.max(0,Math.ceil(room.countdownLeft));
        if (count !== room.countdown) {
          room.countdown = count;
          if (!count) { room.phase = 'racing'; this.announce(); }
          this.broadcast(room);
        }
      }
      if (room.phase !== 'racing') continue;
      room.raceTime += dt;
      const course=courses.get(room.trackId);
      tickEndurance(room.racers,dt,room.raceTime);
      tickItems(room.racers,course,room.items,dt,room.raceTime);
      stepRace(room.racers,course,chairs,dt,room.laps,room.raceTime,previous=>{
        if(room.mode==='endurance')for(const r of room.racers)enterPit(r,course,room.raceTime);
        collectItems(room.racers,course,room.items,previous,room.raceTime);
      });
      const sorted = [...room.racers].sort(compareRacers);
      if (sorted[0].finished) room.winner = sorted[0].name;
      for (const [i,r] of sorted.entries()) if (r.finished && !r.dnf && r.userId && !room.recorded.has(r.id)) {
        this.accounts.recordResult({raceId:room.raceId,userId:r.userId,trackId:room.trackId,time:r.finishTime,bestLap:r.bestLapTime,place:i+1,difficulty:room.difficulty,itemsEnabled:room.itemsEnabled,itemStats:r.itemStats,mode:room.mode,pitStops:r.pitStops||0,perfectStops:r.perfectStops||0});
        room.recorded.add(r.id);
        const client = room.members.get(r.userId);
        if (client) {
          const user=this.accounts.profile(r.userId);r.level=user.progression?.level || r.level;
          this.send(client,'profile',{user});
        }
      }
      if (!room.deadline && sorted[0].finished) room.deadline = room.raceTime + (room.mode==='endurance'?ENDURANCE_GRACE:60);
      if (room.raceTime >= Math.min(room.deadline || Infinity,room.mode==='endurance'?ENDURANCE_LIMIT:300)) {
        for (const r of room.racers) if (!r.finished) {r.finished=true;r.dnf=true;r.speed=0;r.boost=0;}
      }
      if (room.racers.every(r=>r.finished)) this.completeRace(room);
    }
  }
  publish() { for (const room of this.rooms.values()) if (room.phase === 'racing') this.broadcast(room); }
}
