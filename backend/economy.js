import { shopItems, achievements, levelProgress, raceReward, cupReward, achievementProgress } from '../public/progression.js';

export class Economy {
  constructor(db) {
    this.db=db;
    db.exec(`CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),paint TEXT,upgrade TEXT,title TEXT);
      CREATE TABLE IF NOT EXISTS inventory(user_id TEXT REFERENCES users(id),item_id TEXT NOT NULL,PRIMARY KEY(user_id,item_id));
      CREATE TABLE IF NOT EXISTS rewards(user_id TEXT REFERENCES users(id),event_id TEXT NOT NULL,label TEXT NOT NULL,coins INTEGER NOT NULL,xp INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,event_id));
      CREATE TABLE IF NOT EXISTS earned_achievements(user_id TEXT REFERENCES users(id),achievement_id TEXT NOT NULL,PRIMARY KEY(user_id,achievement_id));
      CREATE TABLE IF NOT EXISTS economy_migrations(id INTEGER PRIMARY KEY);`);
    // Credit existing verified results once, without removing any existing content.
    if(!db.prepare('SELECT 1 FROM economy_migrations WHERE id=1').get()) {
      this.transaction(()=>{
        for(const {id} of db.prepare('SELECT id FROM users').all()) {
          this.ensure(id);
          for(const r of db.prepare('SELECT * FROM race_results WHERE user_id=?').all(id)) this.grant(id,'race:'+r.race_id,'Course (historique)',raceReward(r.place));
          for(const r of db.prepare('SELECT * FROM tournament_results WHERE user_id=? AND points>0').all(id)) this.grant(id,'cup:'+r.tournament_id,'Tournoi (historique)',cupReward(r.place,r.difficulty));
          this.checkAchievements(id);
        }
        db.prepare('INSERT INTO economy_migrations VALUES(1)').run();
      });
    }
  }
  migrateBalance() {
    if(this.db.prepare('SELECT 1 FROM economy_migrations WHERE id=2').get())return;
    this.transaction(()=>{
      this.db.exec("UPDATE users SET pilot_id='maya' WHERE pilot_id='hawking' AND NOT EXISTS(SELECT 1 FROM inventory WHERE user_id=users.id AND item_id='pilot-hawking')");
      // Acquired items, earned achievements, XP and balances are never clawed back.
      for(const {id} of this.db.prepare('SELECT id FROM users').all())this.checkAchievements(id);
      this.db.prepare('INSERT INTO economy_migrations VALUES(2)').run();
    });
  }
  migrateLegends() {
    if(this.db.prepare('SELECT 1 FROM economy_migrations WHERE id=3').get())return;
    this.transaction(()=>{
      for(const {id} of this.db.prepare('SELECT id FROM users').all())this.checkAchievements(id);
      this.db.prepare('INSERT INTO economy_migrations VALUES(3)').run();
    });
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  ensure(id) {this.db.prepare('INSERT OR IGNORE INTO wallets(user_id) VALUES(?)').run(id);}
  grant(id,event,label,{coins,xp}) {
    this.ensure(id);
    const inserted=this.db.prepare('INSERT OR IGNORE INTO rewards VALUES(?,?,?,?,?,?)').run(id,event,label,coins,xp,Date.now());
    if(inserted.changes)this.db.prepare('UPDATE wallets SET coins=coins+?,xp=xp+? WHERE user_id=?').run(coins,xp,id);
  }
  metrics(id) {
    const user=this.db.prepare('SELECT races_finished AS races,races_won AS wins FROM users WHERE id=?').get(id);
    return {...user,
      ...this.db.prepare(`SELECT COUNT(*) AS enduranceFinishes,SUM(CASE WHEN place=1 THEN 1 ELSE 0 END) AS enduranceWins,SUM(CASE WHEN place=1 AND items_enabled=1 THEN 1 ELSE 0 END) AS enduranceItemWins,SUM(CASE WHEN place=1 AND items_enabled=0 THEN 1 ELSE 0 END) AS endurancePureWins,COUNT(DISTINCT CASE WHEN place=1 THEN track_id END) AS enduranceCircuits,SUM(CASE WHEN place=1 AND difficulty='200' THEN 1 ELSE 0 END) AS enduranceEliteWins,COALESCE(SUM(perfect_stops),0) AS perfectPitStops FROM race_results WHERE user_id=? AND race_mode='endurance'`).get(id),
      ...Object.fromEntries([['itemWins',1],['pureWins',0]].map(([key,enabled])=>[key,this.db.prepare('SELECT COUNT(*) AS n FROM race_results WHERE user_id=? AND place=1 AND items_enabled=? AND balance_version>=3').get(id,enabled).n])),
      ...Object.fromEntries([['itemCups',1],['pureCups',0]].map(([key,enabled])=>[key,this.db.prepare('SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND place=1 AND points>0 AND items_enabled=? AND balance_version>=3').get(id,enabled).n])),
      ...this.db.prepare('SELECT COALESCE(SUM(item_boxes),0) AS itemBoxes,COALESCE(SUM(item_uses),0) AS itemUses,COALESCE(SUM(item_hits),0) AS itemHits FROM race_results WHERE user_id=? AND items_enabled=1').get(id),
      winningCircuits:this.db.prepare('SELECT COUNT(DISTINCT track_id) AS n FROM race_results WHERE user_id=? AND place=1').get(id).n,
      podiums:this.db.prepare('SELECT COUNT(*) AS n FROM race_results WHERE user_id=? AND place<=3').get(id).n,
      expertWins:this.db.prepare("SELECT COUNT(*) AS n FROM race_results WHERE user_id=? AND place=1 AND difficulty IN ('150','200') AND balance_version>=2").get(id).n,
      eliteWins:this.db.prepare("SELECT COUNT(*) AS n FROM race_results WHERE user_id=? AND place=1 AND difficulty='200' AND balance_version>=2").get(id).n,
      eliteCircuits:this.db.prepare("SELECT COUNT(DISTINCT track_id) AS n FROM race_results WHERE user_id=? AND place=1 AND difficulty='200' AND balance_version>=2").get(id).n,
      perfectCups:this.db.prepare("SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND place=1 AND won_races=5 AND difficulty IN ('150','200') AND balance_version>=2").get(id).n,
      eliteCups:this.db.prepare("SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND place=1 AND points>0 AND difficulty='200' AND balance_version>=2").get(id).n,
      circuits:this.db.prepare('SELECT COUNT(DISTINCT track_id) AS n FROM (SELECT track_id FROM records WHERE user_id=? UNION SELECT track_id FROM records_with_items WHERE user_id=?)').get(id,id).n,
      cups:this.db.prepare('SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND place=1 AND points>0').get(id).n,
      career150:this.db.prepare("SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND mode='career' AND difficulty='150' AND place=1 AND points>0").get(id).n,
      career:this.db.prepare("SELECT COUNT(DISTINCT difficulty) AS n FROM tournament_results WHERE user_id=? AND mode='career' AND place=1 AND points>0").get(id).n};
  }
  checkAchievements(id) {
    const metrics=this.metrics(id);
    for(const a of achievements) if(achievementProgress(a,metrics)>=a.goal) {
      const inserted=this.db.prepare('INSERT OR IGNORE INTO earned_achievements VALUES(?,?)').run(id,a.id);
      if(inserted.changes)this.grant(id,'achievement:'+a.id,'Succès : '+a.name,a);
    }
  }
  profile(id) {
    this.ensure(id);
    const wallet=this.db.prepare('SELECT coins,xp,paint,upgrade,title FROM wallets WHERE user_id=?').get(id);
    return {...wallet,...levelProgress(wallet.xp),owned:this.db.prepare('SELECT item_id FROM inventory WHERE user_id=?').all(id).map(r=>r.item_id),
      earned:this.db.prepare('SELECT achievement_id FROM earned_achievements WHERE user_id=?').all(id).map(r=>r.achievement_id),metrics:this.metrics(id),
      recent:this.db.prepare('SELECT event_id AS id,label,coins,xp FROM rewards WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 12').all(id)};
  }
  buy(id,itemId) {
    return this.transaction(()=>{
      const item=shopItems.find(i=>i.id===itemId),profile=this.profile(id);
      if(!item)throw new Error('Article inconnu.');
      if(profile.owned.includes(itemId))throw new Error('Cet article est déjà dans ta collection.');
      if(profile.level<item.level)throw new Error(`Niveau ${item.level} requis.`);
      if(item.achievement&&!profile.earned.includes(item.achievement))throw new Error('Le succès requis n’est pas encore remporté.');
      const debit=this.db.prepare('UPDATE wallets SET coins=coins-? WHERE user_id=? AND coins>=?').run(item.price,id,item.price);
      if(!debit.changes)throw new Error('Crédits Rush insuffisants.');
      this.db.prepare('INSERT INTO inventory VALUES(?,?)').run(id,item.id);
      this.db.prepare('INSERT INTO rewards VALUES(?,?,?,?,?,?)').run(id,'purchase:'+item.id,'Achat : '+item.name,-item.price,0,Date.now());
    });
  }
  equip(id,slot,itemId) {
    if(!['paint','upgrade','title'].includes(slot))throw new Error('Emplacement invalide.');
    const p=this.profile(id),item=shopItems.find(i=>i.id===itemId&&i.type===slot);
    if(itemId!==null&&(!item||!p.owned.includes(itemId)))throw new Error('Achète cet article avant de l’équiper.');
    this.db.prepare(`UPDATE wallets SET ${slot}=? WHERE user_id=?`).run(itemId,id);
  }
}
