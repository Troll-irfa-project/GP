import { randomUUID } from 'node:crypto';
import { chairs, tracks, pilots } from '../public/catalog.js';
import { MAX_RACERS } from '../public/game-config.js';
import { createCourse, spawnRacer, stepRace, compareRacers } from '../public/racing.js';

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
    return [...this.rooms.values()].map(r => ({id:r.id,name:r.name,trackId:r.trackId,phase:r.phase,humans:r.members.size,bots:MAX_RACERS-r.members.size,capacity:MAX_RACERS,host:this.host(r)?.user.username || null}));
  }
  announce() { const rooms = this.list(); for (const c of this.clients) this.send(c, 'rooms', {rooms}); }
  add(client) { this.clients.add(client); this.send(client, 'rooms', { rooms:this.list() }); }
  remove(client) { this.leave(client); this.clients.delete(client); }
  bot(index) {
    return {id:`bot-${++this.nextBot}`,name:names[index % names.length],chairId:chairs[index % chairs.length].id,pilotId:pilots[index % pilots.length].id,isBot:true,skill:.90+(index%6)*.016};
  }
  reset(room) {
    room.phase = 'waiting'; room.raceId = randomUUID(); room.raceTime = 0; room.countdown = 0; room.winner = null; room.recorded = new Set();
    const humans = [...room.members.values()].map(c => { c.racer.input = {}; return c.racer; });
    room.racers = humans;
    while (room.racers.length < MAX_RACERS) room.racers.push(this.bot(room.racers.length));
    room.racers.forEach((r,i) => spawnRacer(r,i,courses.get(room.trackId)));
  }
  broadcast(room) {
    const lobby = {roomId:room.id,roomName:room.name,hostId:this.host(room)?.racer.id || null,phase:room.phase,
      trackId:room.trackId,laps:3,capacity:MAX_RACERS,raceId:room.raceId,raceTime:room.raceTime,
      started:room.phase==='racing'||room.phase==='results',countdown:room.countdown,winner:room.winner};
    const racers = room.racers.map(({userId, ...r}) => r);
    for (const c of room.members.values()) this.send(c,'state',{lobby,racers,serverTime:Date.now()});
  }
  join(client, data) {
    const room = this.rooms.get(data.roomId);
    if (!room) return this.error(client,'Cette room n’existe pas.');
    if (client.roomId) return this.error(client,'Quitte ta room actuelle avant d’en rejoindre une autre.');
    if (room.phase !== 'waiting') return this.error(client,'La course a déjà commencé. Choisis une autre room.');
    if (room.members.size >= MAX_RACERS) return this.error(client,'Cette room est complète : 12 joueurs humains.');
    const profile = this.accounts.profile(client.user.id);
    client.racer = {id:`p-${client.user.id}`,userId:client.user.id,name:profile.username,
      chairId:validChair(data.chairId)?data.chairId:profile.chairId,pilotId:validPilot(data.pilotId)?data.pilotId:profile.pilotId,isBot:false,input:{}};
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
      const r = client.racer; r.isBot = true; delete r.userId; r.name = 'Relais IA'; r.skill = .94; r.input = {};
    }
    client.racer = null; this.send(client,'left'); this.broadcast(room); this.announce();
  }
  configure(client, data) {
    const room = this.rooms.get(client.roomId);
    if (!room || room.phase !== 'waiting') return this.error(client,'Les choix sont verrouillés pendant la course.');
    if (data.trackId && data.trackId !== room.trackId && this.host(room) !== client) return this.error(client,'Seul l’hôte choisit le circuit.');
    if (data.chairId && !validChair(data.chairId) || data.pilotId && !validPilot(data.pilotId) || data.trackId && !tracks.some(t=>t.id===data.trackId)) return this.error(client,'Choix de course invalide.');
    if (data.chairId) client.racer.chairId = data.chairId;
    if (data.pilotId) client.racer.pilotId = data.pilotId;
    const changed = data.trackId && data.trackId !== room.trackId;
    if (changed) room.trackId = data.trackId;
    this.accounts.preferences(client.user.id,{chairId:client.racer.chairId,pilotId:client.racer.pilotId});
    if (changed) this.reset(room);
    this.broadcast(room); if (changed) this.announce();
  }
  start(client) {
    const room = this.rooms.get(client.roomId);
    if (!room || this.host(room) !== client) return this.error(client,'Seul l’hôte peut lancer la course.');
    if (!['waiting','results'].includes(room.phase)) return this.error(client,'Une course est déjà en cours.');
    this.reset(room); room.phase = 'countdown'; room.countdown = 3; room.countdownLeft = 3;
    this.broadcast(room); this.announce();
  }
  handle(client, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    if (data.type === 'join_room') return this.join(client,data);
    if (data.type === 'leave_room') return this.leave(client);
    if (data.type === 'configure') return this.configure(client,data);
    if (data.type === 'start') return this.start(client);
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
      stepRace(room.racers,courses.get(room.trackId),chairs,dt,3,room.raceTime);
      const sorted = [...room.racers].sort(compareRacers);
      if (sorted[0].finished) room.winner = sorted[0].name;
      for (const [i,r] of sorted.entries()) if (r.finished && r.userId && !room.recorded.has(r.id)) {
        this.accounts.recordResult({raceId:room.raceId,userId:r.userId,trackId:room.trackId,time:r.finishTime,bestLap:r.bestLapTime,place:i+1});
        room.recorded.add(r.id);
        const client = room.members.get(r.userId);
        if (client) this.send(client,'profile',{user:this.accounts.profile(r.userId)});
      }
      if (room.racers.every(r=>r.finished)) {room.phase='results';this.broadcast(room);this.announce();}
    }
  }
  publish() { for (const room of this.rooms.values()) if (room.phase === 'racing') this.broadcast(room); }
}
