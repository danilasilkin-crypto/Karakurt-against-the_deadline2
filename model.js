'use strict';
// Rules use seconds and grid coordinates; the random source is injectable for tests.
class NightGame {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.row = 1; this.col = 4; this.score = 0; this.lives = 3; this.time = 90;
    this.elapsed = 0; this.cooldown = 0; this.invulnerable = 0; this.nextStrike = 2.6;
    this.phase = 'ready'; this.target = { row: 1, col: 4 }; this.strikes = []; this.events = [];
    this.silk = 2; this.webs = []; this.combo = 0; this.comboTimer = 0;
    this.maxCombo = 0; this.blocked = 0; this.hits = 0; this.bonusTime = 0; this.volley = 0;
  }
  get chapter() { return Math.min(2, Math.floor(this.score / 8)); }
  start() { this.reset(); this.phase = 'playing'; }
  continueChapter() {
    if (this.phase !== 'chapter') return false;
    this.phase = 'playing'; this.nextStrike = 2.6; this.invulnerable = .8;
    this.comboTimer = this.combo ? 4 : 0; return true;
  }
  move(dr, dc) {
    if (this.phase !== 'playing') return false;
    const row = Math.max(0, Math.min(2, this.row + dr));
    const col = Math.max(0, Math.min(9, this.col + dc));
    const changed = row !== this.row || col !== this.col;
    this.row = row; this.col = col; return changed;
  }
  chooseTarget() {
    const old = this.target, candidates = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 10; col++) {
      const distance = Math.abs(row - old.row) + Math.abs(col - old.col);
      if (distance >= 2 && distance <= 5) candidates.push({ row, col });
    }
    this.target = candidates[Math.floor(this.random() * candidates.length)];
  }
  typo() {
    if (this.phase !== 'playing') return false;
    if (this.row !== this.target.row || this.col !== this.target.col) { this.events.push('miss'); return false; }
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1; this.comboTimer = 4;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score++; this.events.push('typo');
    if (this.combo % 3 === 0) {
      const bonus = Math.min(3, 90 - this.time); this.time += bonus; this.bonusTime += bonus;
      if (bonus > 0) this.events.push('combo');
    }
    if (this.score % 4 === 0 && this.silk < 3) { this.silk++; this.events.push('silk'); }
    if (this.score >= 24) { this.phase = 'won'; this.strikes = []; return true; }
    this.chooseTarget();
    if (this.score % 8 === 0) {
      this.phase = 'chapter'; this.strikes = []; this.events.push('chapter');
    }
    return true;
  }
  dash(dr, dc) {
    if (this.phase !== 'playing' || this.cooldown > 0) return false;
    if (!this.move(dr * 2, dc * 2)) return false;
    this.cooldown = 3; this.invulnerable = Math.max(this.invulnerable, .45);
    this.events.push('dash'); return true;
  }
  weave() {
    if (this.phase !== 'playing' || this.silk <= 0 || this.webs.some(w => w.row === this.row && w.col === this.col)) return false;
    this.silk--; this.webs.push({ row: this.row, col: this.col, life: 6 });
    this.events.push('web'); return true;
  }
  pause() {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }
  spawnStrikes() {
    const delay = Math.max(.75, 1.25 - this.score * .018);
    const cells = [{ row: this.row, col: this.col }];
    this.volley++;
    if (this.chapter === 2 && this.volley % 3 === 0) {
      // A clearly telegraphed three-key sweep, never an entire inescapable row.
      for (const dc of [-1, 1]) if (this.col + dc >= 0 && this.col + dc < 10) cells.push({ row: this.row, col: this.col + dc });
      this.events.push('sweep');
    } else if (this.chapter >= 1) {
      const cell = { row: Math.floor(this.random() * 3), col: Math.floor(this.random() * 10) };
      if (cell.row !== this.row || cell.col !== this.col) cells.push(cell);
    }
    for (const cell of cells) this.strikes.push({ ...cell, delay, age: 0, hit: false, blocked: false });
    this.nextStrike = Math.max(1, 2.2 - this.score * .045); this.events.push('warning');
  }
  tick(dt) {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.time = Math.max(0, this.time - dt); this.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (!this.comboTimer) this.combo = 0;
    this.webs.forEach(w => { w.life -= dt; }); this.webs = this.webs.filter(w => w.life > 0);
    if (this.time <= 0) { this.phase = 'lost'; this.events.push('timeout'); return; }
    for (const strike of this.strikes) {
      strike.age += dt;
      if (!strike.hit && strike.age >= strike.delay) {
        strike.hit = true;
        const web = this.webs.find(w => w.row === strike.row && w.col === strike.col);
        if (web) {
          this.webs.splice(this.webs.indexOf(web), 1); strike.blocked = true; this.blocked++;
          this.events.push('block'); continue;
        }
        this.events.push('strike');
        if (strike.row === this.row && strike.col === this.col && this.invulnerable <= 0) {
          this.lives--; this.hits++; this.invulnerable = 1.4; this.combo = 0; this.comboTimer = 0; this.events.push('hurt');
          if (this.lives <= 0) { this.phase = 'lost'; break; }
        }
      }
    }
    this.strikes = this.strikes.filter(s => s.age < s.delay + .42);
    this.nextStrike -= dt;
    // Newly telegraphed strikes start at age zero, even after a slow frame.
    if (this.phase === 'playing' && this.nextStrike <= 0) this.spawnStrikes();
  }
}
window.NightGame = NightGame;
