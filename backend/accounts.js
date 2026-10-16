import { Economy } from './economy.js';
import { raceReward, cupReward } from '../public/progression.js';
import { careerProgress } from '../public/competition.js';
import { isoWeekStart, grandPrixDay, grandPrixTrackId } from '../public/grand-prix.js';
import { tracks } from '../public/catalog.js';
import { seasonalEvents } from '../public/seasonal.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt), SESSION_SECONDS = 7 * 24 * 3600;
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const tokenHash = token => createHash('sha256').update(token).digest('hex');
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function usernameKey(value) { return String(value ?? '').normalize('NFKC').trim().toLowerCase(); }

export class Accounts {
  constructor(filename) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename); this.hashing = 0;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
        chair_id TEXT NOT NULL DEFAULT 'comet', pilot_id TEXT NOT NULL DEFAULT 'maya',
        favorites TEXT NOT NULL DEFAULT '[]', races_finished INTEGER NOT NULL DEFAULT 0,
        races_won INTEGER NOT NULL DEFAULT 0, championships TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS records (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, track_id TEXT NOT NULL,
        best_race_ms INTEGER NOT NULL, best_lap_ms INTEGER, PRIMARY KEY(user_id, track_id)
      );
      CREATE TABLE IF NOT EXISTS race_results (
        race_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL, time_ms INTEGER NOT NULL, place INTEGER NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY(race_id, user_id)
      ); CREATE TABLE IF NOT EXISTS tournament_results (
        tournament_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
        difficulty TEXT NOT NULL, mode TEXT NOT NULL, place INTEGER NOT NULL,
        points INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(tournament_id,user_id)
      ); CREATE INDEX IF NOT EXISTS record_race_rank ON records(track_id,best_race_ms);
      CREATE INDEX IF NOT EXISTS record_lap_rank ON records(track_id,best_lap_ms);
      PRAGMA user_version=2;`);
    const raceColumns=this.db.prepare('PRAGMA table_info(race_results)').all().map(c=>c.name);
    if(!raceColumns.includes('difficulty'))this.db.exec('ALTER TABLE race_results ADD COLUMN difficulty TEXT');
    if(!raceColumns.includes('balance_version'))this.db.exec('ALTER TABLE race_results ADD COLUMN balance_version INTEGER NOT NULL DEFAULT 1');
    const cupColumns=this.db.prepare('PRAGMA table_info(tournament_results)').all().map(c=>c.name);
    if(!cupColumns.includes('balance_version'))this.db.exec('ALTER TABLE tournament_results ADD COLUMN balance_version INTEGER NOT NULL DEFAULT 1');
    if(!cupColumns.includes('won_races'))this.db.exec('ALTER TABLE tournament_results ADD COLUMN won_races INTEGER NOT NULL DEFAULT 0');
    for(const table of ['race_results','tournament_results']) {
      const columns=this.db.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name);
      if(!columns.includes('items_enabled'))this.db.exec('ALTER TABLE '+table+' ADD COLUMN items_enabled INTEGER NOT NULL DEFAULT 0');
    }
    for(const column of ['item_boxes','item_uses','item_hits'])if(!this.db.prepare('PRAGMA table_info(race_results)').all().some(c=>c.name===column))this.db.exec('ALTER TABLE race_results ADD COLUMN '+column+' INTEGER NOT NULL DEFAULT 0');
    this.db.exec('CREATE TABLE IF NOT EXISTS records_with_items(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,track_id TEXT NOT NULL,best_race_ms INTEGER NOT NULL,best_lap_ms INTEGER,PRIMARY KEY(user_id,track_id))');
    const enduranceColumns=this.db.prepare('PRAGMA table_info(race_results)').all().map(c=>c.name);
    for(const [column,definition] of [['race_mode',"TEXT NOT NULL DEFAULT 'race'"],['pit_stops','INTEGER NOT NULL DEFAULT 0'],['perfect_stops','INTEGER NOT NULL DEFAULT 0']])if(!enduranceColumns.includes(column))this.db.exec('ALTER TABLE race_results ADD COLUMN '+column+' '+definition);
    if(!this.db.prepare('PRAGMA table_info(race_results)').all().some(c=>c.name==='time_trial_medal'))this.db.exec("ALTER TABLE race_results ADD COLUMN time_trial_medal TEXT NOT NULL DEFAULT ''");
    this.db.exec('CREATE TABLE IF NOT EXISTS endurance_records(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,track_id TEXT NOT NULL,items_enabled INTEGER NOT NULL,best_race_ms INTEGER NOT NULL,best_lap_ms INTEGER,PRIMARY KEY(user_id,track_id,items_enabled)); CREATE INDEX IF NOT EXISTS endurance_rank ON endurance_records(track_id,items_enabled,best_race_ms);');
    if(!this.db.prepare('PRAGMA table_info(tournament_results)').all().some(c=>c.name==='cup_id'))this.db.exec("ALTER TABLE tournament_results ADD COLUMN cup_id TEXT NOT NULL DEFAULT 'classic'");
    this.db.exec("CREATE TABLE IF NOT EXISTS weekly_gp_attempts(week_key TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day INTEGER NOT NULL,time_ms INTEGER NOT NULL,track_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(week_key,user_id,day)); CREATE INDEX IF NOT EXISTS weekly_gp_rank ON weekly_gp_attempts(week_key,time_ms); CREATE TABLE IF NOT EXISTS weekly_gp_winners(week_key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),track_id TEXT NOT NULL,time_ms INTEGER NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS weekly_gp_controls(id INTEGER PRIMARY KEY CHECK(id=1),week_key TEXT NOT NULL,day INTEGER NOT NULL,track_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS competition_controls(cup_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 1);");
    this.db.prepare("INSERT OR IGNORE INTO competition_controls(cup_id,enabled) VALUES('classic',1),('horizons',1)").run();
    const addSeasonal = this.db.prepare('INSERT OR IGNORE INTO competition_controls(cup_id,enabled) VALUES(?,1)');
    for(const event of seasonalEvents)addSeasonal.run(`season-${event.id}`);
    this.economy = new Economy(this.db);
    this.economy.migrateBalance();
    this.economy.migrateLegends();
    this.economy.migrateAchievementRush();
    this.economy.migrateLogos();
    this.prune();
  }
  prune() { this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()); }
  async hash(password, salt = randomBytes(16).toString('hex')) {
    // Bound memory use even if many login requests arrive at once.
    if (this.hashing >= 2) throw new HttpError(503, 'Connexion occupée. Réessaie dans quelques secondes.');
    this.hashing++;
    try { return `scrypt$${salt}$${(await derive(password, salt, 64, SCRYPT)).toString('hex')}`; }
    finally { this.hashing--; }
  }
  async register(username, password) {
    const display = typeof username === 'string' ? username.normalize('NFKC').trim() : '';
    if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(display)) throw new HttpError(400, 'Pseudo : 3 à 20 lettres, chiffres, tirets ou underscores.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new HttpError(400, 'Mot de passe : entre 8 et 128 caractères.');
    const key = usernameKey(display);
    if (this.db.prepare('SELECT id FROM users WHERE username_key=?').get(key)) throw new HttpError(409, 'Ce pseudo est déjà utilisé.');
    const hash = await this.hash(password), id = randomUUID();
    try { this.db.prepare('INSERT INTO users(id,username,username_key,password_hash,created_at,pilot_id) VALUES(?,?,?,?,?,?)').run(id, display, key, hash, Date.now(),'maya'); }
    catch (error) {
      if (this.db.prepare('SELECT id FROM users WHERE username_key=?').get(key)) throw new HttpError(409, 'Ce pseudo est déjà utilisé.');
      throw error;
    }
    return this.profile(id);
  }
  async login(username, password) {
    if (typeof password !== 'string' || password.length > 128 || typeof username !== 'string' || username.length > 100) throw new HttpError(401, 'Pseudo ou mot de passe incorrect.');
    const row = this.db.prepare('SELECT id,password_hash FROM users WHERE username_key=?').get(usernameKey(username));
    // Unknown accounts take the same expensive hashing path as wrong passwords.
    const stored = row?.password_hash || `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const [, salt, expected] = stored.split('$');
    const actual = (await this.hash(password, salt)).split('$')[2];
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex')) || !row) throw new HttpError(401, 'Pseudo ou mot de passe incorrect.');
    return this.profile(row.id);
  }
  profile(id) {
    const row = this.db.prepare('SELECT id,username,chair_id,pilot_id,favorites,races_finished,races_won,championships FROM users WHERE id=?').get(id);
    if (!row) return null;
    return { id: row.id, username: row.username, chairId: row.chair_id, pilotId: row.pilot_id,
      progression: this.economy.profile(id),
      favoriteChairIds: JSON.parse(row.favorites), racesFinished: row.races_finished, racesWon: row.races_won,
      championships: [...JSON.parse(row.championships), ...this.db.prepare('SELECT tournament_id AS id,difficulty,mode,points FROM tournament_results WHERE user_id=? AND place=1 AND points>0').all(id)],
      careers: Object.fromEntries(['classic','horizons'].map(cup=>[cup,careerProgress(this.db.prepare("SELECT DISTINCT difficulty FROM tournament_results WHERE user_id=? AND place=1 AND points>0 AND mode='career' AND cup_id=?").all(id,cup).map(r=>r.difficulty))])),
      career: careerProgress(this.db.prepare("SELECT DISTINCT difficulty FROM tournament_results WHERE user_id=? AND place=1 AND points>0 AND mode='career' AND cup_id='classic'").all(id).map(r=>r.difficulty)),
      records: this.db.prepare('SELECT track_id AS trackId,best_race_ms AS bestRaceMs,best_lap_ms AS bestLapMs,0 AS itemsEnabled,\'race\' AS mode FROM records WHERE user_id=? UNION ALL SELECT track_id,best_race_ms,best_lap_ms,1,\'race\' FROM records_with_items WHERE user_id=? UNION ALL SELECT track_id,best_race_ms,best_lap_ms,items_enabled,\'endurance\' FROM endurance_records WHERE user_id=? ORDER BY trackId').all(id,id,id) };
  }
  preferences(id, { chairId, pilotId, favoriteChairIds } = {}) {
    const profile = this.profile(id);
    this.db.prepare('UPDATE users SET chair_id=?,pilot_id=?,favorites=? WHERE id=?').run(chairId ?? profile.chairId, pilotId ?? profile.pilotId, JSON.stringify(favoriteChairIds ?? profile.favoriteChairIds), id);
    return this.profile(id);
  }
  createSession(id) {
    const token = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), id, Date.now() + SESSION_SECONDS * 1000);
    return token;
  }
  session(token) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = tokenHash(token), row = this.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hash, Date.now());
    return row ? { hash, user: this.profile(row.user_id) } : null;
  }
  sessionValid(hash) { return Boolean(this.db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?').get(hash, Date.now())); }
  revoke(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token)); }
  recordResult({ raceId, userId, trackId, time, bestLap, place, difficulty = '100', itemsEnabled = false, itemStats = {}, mode = 'race', pitStops = 0, perfectStops = 0, timeTrialMedal = '' }) {
    const timeMs = Math.round(time * 1000), lapMs = Number.isFinite(bestLap) ? Math.round(bestLap * 1000) : null;
    if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isInteger(place) || place<1 || place>12) return;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const medal=['bronze','silver','gold'].includes(timeTrialMedal)?timeTrialMedal:'';
      const inserted = this.db.prepare('INSERT OR IGNORE INTO race_results(race_id,user_id,track_id,time_ms,place,created_at,difficulty,balance_version,items_enabled,item_boxes,item_uses,item_hits,race_mode,pit_stops,perfect_stops,time_trial_medal) VALUES(?,?,?,?,?,?,?,3,?,?,?,?,?,?,?,?)').run(raceId, userId, trackId, timeMs, place, Date.now(),difficulty,itemsEnabled?1:0,...['boxes','uses','hits'].map(k=>itemsEnabled?Math.max(0,Math.floor(itemStats[k]||0)):0),mode,mode==='endurance'?pitStops:0,mode==='endurance'?perfectStops:0,medal);
      if (inserted.changes) {
        this.db.prepare('UPDATE users SET races_finished=races_finished+1,races_won=races_won+? WHERE id=?').run(place === 1 ? 1 : 0, userId);
        if(mode==='endurance')this.db.prepare(`INSERT INTO endurance_records VALUES(?,?,?,?,?) ON CONFLICT(user_id,track_id,items_enabled) DO UPDATE SET best_race_ms=MIN(best_race_ms,excluded.best_race_ms),best_lap_ms=CASE WHEN best_lap_ms IS NULL THEN excluded.best_lap_ms WHEN excluded.best_lap_ms IS NULL THEN best_lap_ms ELSE MIN(best_lap_ms,excluded.best_lap_ms) END`).run(userId,trackId,itemsEnabled?1:0,timeMs,lapMs);
        else if(mode!=='weekly-gp')this.db.prepare(`INSERT INTO ${itemsEnabled?'records_with_items':'records'} VALUES(?,?,?,?) ON CONFLICT(user_id,track_id) DO UPDATE SET
          best_race_ms=MIN(best_race_ms,excluded.best_race_ms),
          best_lap_ms=CASE WHEN best_lap_ms IS NULL THEN excluded.best_lap_ms WHEN excluded.best_lap_ms IS NULL THEN best_lap_ms ELSE MIN(best_lap_ms,excluded.best_lap_ms) END`).run(userId, trackId, timeMs, lapMs);
      }
      if (inserted.changes) {
        this.economy.grant(userId,'race:'+raceId,'Course terminée · #'+place,raceReward(place,difficulty,mode,itemStats.aahBonus||0));
        if(mode==='weekly-gp')this.recordGrandPrixAttempt(userId,trackId,timeMs);
        this.economy.checkAchievements(userId);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  previousWeek(weekKey) { const date=new Date(`${weekKey}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-7);return date.toISOString().slice(0,10); }
  settleGrandPrix(weekKey) {
    if(this.db.prepare('SELECT 1 FROM weekly_gp_winners WHERE week_key=?').get(weekKey))return;
    const winner=this.db.prepare('SELECT user_id AS userId,track_id AS trackId,time_ms AS timeMs FROM weekly_gp_attempts WHERE week_key=? AND time_ms<2147483647 ORDER BY time_ms,user_id LIMIT 1').get(weekKey);
    if(!winner)return;
    this.db.prepare('INSERT OR IGNORE INTO weekly_gp_winners VALUES(?,?,?,?,?)').run(weekKey,winner.userId,winner.trackId,winner.timeMs,Date.now());
    this.economy.grant(winner.userId,'grand-prix:'+weekKey,'Victoire Grand Prix hebdomadaire',{coins:5000,xp:0});
    this.economy.checkAchievements(winner.userId);
  }
  grandPrixState(now=Date.now()) {
    const date=new Date(now),naturalWeek=isoWeekStart(date),control=this.db.prepare('SELECT week_key AS weekKey,day,track_id AS trackId FROM weekly_gp_controls WHERE id=1').get(),controlled=control?.weekKey===naturalWeek,weekKey=controlled?control.weekKey:naturalWeek,day=controlled?control.day:grandPrixDay(date);
    this.settleGrandPrix(day===0?weekKey:this.previousWeek(weekKey));
    const attempts=this.db.prepare('SELECT user_id AS userId,day,time_ms AS timeMs,track_id AS trackId FROM weekly_gp_attempts WHERE week_key=? ORDER BY time_ms,user_id').all(weekKey);
    const best=new Map();for(const attempt of attempts)if(attempt.timeMs<2147483647){const current=best.get(attempt.userId);if(!current||attempt.timeMs<current.timeMs)best.set(attempt.userId,attempt);}
    const byDay=value=>attempts.filter(a=>a.day===value&&a.timeMs<2147483647).sort((a,b)=>a.timeMs-b.timeMs||a.userId.localeCompare(b.userId));
    const eligible=day===1?null:byDay(day-1).slice(0,day===2?4:2).map(a=>a.userId);
    const leaderboard=[...best.values()].sort((a,b)=>a.timeMs-b.timeMs||a.userId.localeCompare(b.userId)).map((a,index)=>({...a,rank:index+1}));
    const finalWinner=this.db.prepare('SELECT user_id AS userId,track_id AS trackId,time_ms AS timeMs FROM weekly_gp_winners WHERE week_key=?').get(weekKey);
    const winner=day>=3?leaderboard[0]||null:day===0&&finalWinner?{...finalWinner,rank:1}:null;
    return {weekKey,day,trackId:controlled?control.trackId:grandPrixTrackId(weekKey),status:day?day===1?'open':day===2?'top-four':'top-two':'closed',manual:controlled,attempts:attempts.map(a=>({...a,time:a.timeMs/1000})),leaderboard:leaderboard.map(a=>({...a,time:a.timeMs/1000})),eligible,winner:winner?{...winner,time:winner.timeMs/1000}:null,canAttempt:userId=>{if(!day||attempts.some(a=>a.userId===userId&&a.day===day))return false;if(day===1)return true;return eligible.includes(userId);}};
  }
  reserveGrandPrixAttempt(userId,trackId) {
    const state=this.grandPrixState();
    if(state.trackId!==trackId||!state.day||!state.canAttempt(userId))return false;
    return Boolean(this.db.prepare('INSERT OR IGNORE INTO weekly_gp_attempts VALUES(?,?,?,?,?,?)').run(state.weekKey,userId,state.day,2147483647,trackId,Date.now()).changes);
  }
  recordGrandPrixAttempt(userId,trackId,timeMs) {
    const state=this.grandPrixState();
    if(state.trackId!==trackId||!state.day)return false;
    const reserved=this.db.prepare('UPDATE weekly_gp_attempts SET time_ms=? WHERE week_key=? AND user_id=? AND day=? AND time_ms=2147483647').run(timeMs,state.weekKey,userId,state.day);
    if(reserved.changes)return true;
    if(!state.canAttempt(userId))return false;
    return Boolean(this.db.prepare('INSERT OR IGNORE INTO weekly_gp_attempts VALUES(?,?,?,?,?,?)').run(state.weekKey,userId,state.day,timeMs,trackId,Date.now()).changes);
  }
  competitionStatus() { return Object.fromEntries(this.db.prepare('SELECT cup_id AS id,enabled FROM competition_controls').all().map(row=>[row.id,Boolean(row.enabled)])); }
  setCompetitionEnabled(cupId,enabled) { if(!this.db.prepare('SELECT 1 FROM competition_controls WHERE cup_id=?').get(cupId))throw new Error('Coupe inconnue.');this.db.prepare('UPDATE competition_controls SET enabled=? WHERE cup_id=?').run(enabled?1:0,cupId);return this.competitionStatus(); }
  adminLaunchGrandPrix(trackId) { const track=tracks.find(t=>t.id===trackId);if(!track)throw new Error('Circuit inconnu.');const weekKey=isoWeekStart();this.db.exec('BEGIN IMMEDIATE');try{this.db.prepare('DELETE FROM weekly_gp_attempts WHERE week_key=?').run(weekKey);this.db.prepare('DELETE FROM weekly_gp_winners WHERE week_key=?').run(weekKey);this.db.prepare('INSERT INTO weekly_gp_controls(id,week_key,day,track_id) VALUES(1,?,1,?) ON CONFLICT(id) DO UPDATE SET week_key=excluded.week_key,day=1,track_id=excluded.track_id').run(weekKey,trackId);this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return this.grandPrixState(); }
  adminAdvanceGrandPrix() { const state=this.grandPrixState(),control=this.db.prepare('SELECT * FROM weekly_gp_controls WHERE id=1 AND week_key=?').get(state.weekKey);if(!control)throw new Error('Aucun Grand Prix manuel actif cette semaine.');const next=control.day>=3?0:control.day+1;this.db.prepare('UPDATE weekly_gp_controls SET day=? WHERE id=1').run(next);if(next===0)this.settleGrandPrix(state.weekKey);return this.grandPrixState(); }
  leaderboard(trackId,itemsEnabled=false,mode='race') {
    const table=mode==='endurance'?'endurance_records':itemsEnabled?'records_with_items':'records';
    const read = column => this.db.prepare(`SELECT u.username,r.${column} AS timeMs,
      RANK() OVER (ORDER BY r.${column}) AS rank FROM ${table} r JOIN users u ON u.id=r.user_id
      WHERE r.track_id=? ${mode==='endurance'?`AND r.items_enabled=${itemsEnabled?1:0}`:''} AND r.${column}>0 ORDER BY r.${column},u.username_key LIMIT 50`).all(trackId);
    return {trackId, itemsEnabled, mode, races:read('best_race_ms'), laps:read('best_lap_ms')};
  }
  recordTournament({id,userId,difficulty,mode,place,points,wonRaces=0,itemsEnabled=false,cupId='classic'}) {
    this.economy.transaction(()=>{
      const inserted=this.db.prepare('INSERT OR IGNORE INTO tournament_results(tournament_id,user_id,difficulty,mode,place,points,created_at,won_races,balance_version,items_enabled,cup_id) VALUES(?,?,?,?,?,?,?,?,3,?,?)').run(id,userId,difficulty,mode,place,points,Date.now(),wonRaces,itemsEnabled?1:0,cupId);
      if(inserted.changes && points>0) {
        this.economy.grant(userId,'cup:'+id,'Tournoi terminé · #'+place,cupReward(place,difficulty));
        this.economy.checkAchievements(userId);
      }
    });
  }
  close() { this.db.close(); }
}

export function sessionCookie(token, secure = false) {
  return `rollrush_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`;
}
export function readSessionCookie(req) {
  return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('rollrush_session='))?.slice('rollrush_session='.length) || '';
}
