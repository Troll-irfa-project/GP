import { chairs } from '../public/catalog.js';
import { ownsLogo, validColor } from '../public/logo-catalog.js';
import { shopItems, achievements, levelProgress, raceReward, cupReward, achievementProgress } from '../public/progression.js';
import { seasonalEvents } from '../public/seasonal.js';

export class Economy {
  constructor(db) {
    this.db=db;
    db.exec(`CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),xp INTEGER NOT NULL DEFAULT 0 CHECK(xp>=0),paint TEXT,upgrade TEXT,title TEXT);
      CREATE TABLE IF NOT EXISTS inventory(user_id TEXT REFERENCES users(id),item_id TEXT NOT NULL,PRIMARY KEY(user_id,item_id));
      CREATE TABLE IF NOT EXISTS rewards(user_id TEXT REFERENCES users(id),event_id TEXT NOT NULL,label TEXT NOT NULL,coins INTEGER NOT NULL,xp INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,event_id));
      CREATE TABLE IF NOT EXISTS earned_achievements(user_id TEXT REFERENCES users(id),achievement_id TEXT NOT NULL,PRIMARY KEY(user_id,achievement_id));
      CREATE TABLE IF NOT EXISTS chair_styles(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,chair_id TEXT NOT NULL,color TEXT,logo_id TEXT,PRIMARY KEY(user_id,chair_id));
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
  migrateAchievementRush() {
    if(this.db.prepare('SELECT 1 FROM economy_migrations WHERE id=4').get())return;
    this.transaction(()=>{
      const earned=this.db.prepare('SELECT user_id,achievement_id FROM earned_achievements').all();
      for(const row of earned){
        const achievement=achievements.find(a=>a.id===row.achievement_id);
        if(!achievement)continue;
        const previous=this.db.prepare('SELECT coins FROM rewards WHERE user_id=? AND event_id=?').get(row.user_id,'achievement:'+achievement.id);
        const difference=Math.max(0,achievement.coins-(previous?.coins||0));
        if(difference)this.grant(row.user_id,'achievement-rush-v4:'+achievement.id,'Complément Rush : '+achievement.name,{coins:difference,xp:0});
      }
      this.db.prepare('INSERT INTO economy_migrations VALUES(4)').run();
    });
  }
  migrateLogos() {
    if(this.db.prepare('SELECT 1 FROM economy_migrations WHERE id=5').get())return;
    this.transaction(()=>{
      for(const {id} of this.db.prepare('SELECT id FROM users').all())this.checkAchievements(id);
      this.db.prepare('INSERT INTO economy_migrations VALUES(5)').run();
    });
  }
  customize(id,data) {
    if(!data||Object.keys(data).some(k=>!['chairId','color','logoId'].includes(k))||!chairs.some(c=>c.id===data.chairId))throw new Error('Fauteuil ou personnalisation invalide.');
    if(data.color!==null&&!validColor(data.color))throw new Error('Couleur invalide : utilise un code #RRGGBB.');
    return this.transaction(()=>{
      const p=this.profile(id),item=shopItems.find(i=>i.type==='chair'&&i.target===data.chairId);
      if(item&&!p.owned.includes(item.id))throw new Error('Ce fauteuil n’est pas encore dans ta collection.');
      if(!ownsLogo(p,data.logoId))throw new Error('Remporte le succès de ce logo avant de l’équiper.');
      this.db.prepare('INSERT INTO chair_styles(user_id,chair_id,color,logo_id) VALUES(?,?,?,?) ON CONFLICT(user_id,chair_id) DO UPDATE SET color=excluded.color,logo_id=excluded.logo_id').run(id,data.chairId,data.color?.toLowerCase()||null,data.logoId);
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
      ...Object.fromEntries(['50','100','150','200'].map(d=>['horizons'+d,this.db.prepare("SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND mode='career' AND cup_id='horizons' AND difficulty=? AND place=1 AND points>0").get(id,d).n])),
      ...Object.fromEntries(['bronze','silver','gold'].map(m=>['timeTrial'+m[0].toUpperCase()+m.slice(1),this.db.prepare("SELECT COUNT(*) AS n FROM race_results WHERE user_id=? AND race_mode='time-trial' AND time_trial_medal=?").get(id,m).n])),
      grandPrixWins:this.db.prepare('SELECT COUNT(*) AS n FROM weekly_gp_winners WHERE user_id=?').get(id).n,
      career150:this.db.prepare("SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND mode='career' AND cup_id='classic' AND difficulty='150' AND place=1 AND points>0").get(id).n,
      career:this.db.prepare("SELECT COUNT(DISTINCT difficulty) AS n FROM tournament_results WHERE user_id=? AND mode='career' AND cup_id='classic' AND place=1 AND points>0").get(id).n,
      ...Object.fromEntries(seasonalEvents.map(event=>[`eventWins-${event.id}`,this.db.prepare('SELECT COUNT(*) AS n FROM tournament_results WHERE user_id=? AND cup_id=? AND place=1 AND points>0').get(id,`season-${event.id}`).n]))};
  }
  checkAchievements(id) {
    const metrics=this.metrics(id);
    for(const a of achievements) if(achievementProgress(a,metrics)>=a.goal) {
      const inserted=this.db.prepare('INSERT OR IGNORE INTO earned_achievements VALUES(?,?)').run(id,a.id);
      if(inserted.changes)this.grant(id,'achievement:'+a.id,'Succès : '+a.name,a);
    }
    for(const row of this.db.prepare('SELECT achievement_id FROM earned_achievements WHERE user_id=?').all(id)){
      for(const item of shopItems.filter(item=>item.achievement===row.achievement_id&&item.freeOnAchievement))this.db.prepare('INSERT OR IGNORE INTO inventory VALUES(?,?)').run(id,item.id);
    }
  }
  profile(id) {
    this.ensure(id);
    const wallet=this.db.prepare('SELECT coins,xp,paint,upgrade,title FROM wallets WHERE user_id=?').get(id);
    return {...wallet,chairStyles:Object.fromEntries(this.db.prepare('SELECT chair_id,color,logo_id FROM chair_styles WHERE user_id=?').all(id).map(s=>[s.chair_id,{color:s.color,logoId:s.logo_id}])),...levelProgress(wallet.xp),owned:this.db.prepare('SELECT item_id FROM inventory WHERE user_id=?').all(id).map(r=>r.item_id),
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
