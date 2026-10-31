'use strict';
// Campaign owns objectives; NightGame remains the shared movement/collision engine.
class NightCampaign extends NightGame {
  reset() {
    super.reset(); this.mode = 'campaign'; this.level = 0; this.done = 0;
    this.charge = 0; this.retries = 0; this.slow = 0; this.stageTime = 0;
    this.undo = null; this.undoClock = 6; this.spills = []; this.anchors = [];
    this.checkpoint = null; this.time = 65; this.respite = false;
  }
  get chapter() { return this.level || 0; }
  get quota() { return [8, 10, 2, 4, 3][this.chapter]; }
  get limit() { return [65, 80, 65, 80, 70][this.chapter]; }
  get progress() { return this.mode === 'arcade' ? Math.min(1, this.score / 50) : (this.chapter + this.done / this.quota) / 5; }
  get actionLabel() { return this.mode === 'arcade' || this.chapter < 2 ? 'ОПЕЧАТКА' : this.chapter === 2 ? 'КРЕПЛЕНИЕ · E' : this.chapter === 3 ? 'ЛОВУШКА · E' : ['СОХРАНИТЬ', 'ОТКЛЮЧИТЬ', 'УЙТИ ПОД ESC'][this.done] || 'ГОТОВО'; }
  get targetLabel() { return this.mode === 'arcade' || this.chapter < 2 ? 'BUG' : this.chapter === 2 ? 'НИТЬ E' : this.chapter === 3 ? 'ПРИМАНКА' : ['SAVE', 'STOP', 'ESC'][this.done] || 'ESC'; }
  get objective() {
    if (this.mode === 'arcade') return `Ещё один фикс · волна ${1 + Math.floor(this.elapsed / 25)} · ${this.score} ошибок`;
    return [ `Посей ошибки · ${this.done}/8`, `Сорви исправления · ${this.done}/10`, `Закрепи кружку: E на цели · ${this.done}/2`, `Поймай пальцы паутиной · ${this.done}/4`, `${['Сохрани черновик', 'Отключи автосборку', 'Вернись под Esc'][this.done] || 'Человек сохранён'} · пробел` ][this.chapter];
  }
  start(mode = 'campaign') {
    this.reset(); this.mode = mode; this.phase = 'playing';
    if (mode === 'arcade') { this.level = 4; this.time = 90; }
    else this.enterStage(0, false);
  }
  enterStage(level, card = true) {
    this.level = level; this.done = 0; this.time = this.limit; this.stageTime = 0;
    this.row = 1; this.col = 4; this.target = { row: 1, col: 4 };
    this.silk = level === 0 ? 2 : 3; this.lives = 3; this.cooldown = 0; this.slow = 0;
    this.strikes = []; this.webs = []; this.combo = 0; this.comboTimer = 0;
    this.undo = null; this.undoClock = 6; this.anchors = []; this.respite = false;
    this.spills = level === 2 ? [{row:0,col:3},{row:1,col:6},{row:2,col:5},{row:1,col:8}] : [];
    if (level === 2) this.target = {row:0,col:8};
    if (level === 4) this.target = {row:1,col:1};
    this.nextStrike = 3; this.invulnerable = .8; this.phase = card ? 'chapter' : 'playing';
    this.checkpoint = this.snapshot();
  }
  snapshot() { return { version: 1, level: this.chapter, score: this.score, elapsed: this.elapsed, hits: this.hits, blocked: this.blocked, maxCombo: this.maxCombo, retries: this.retries }; }
  restore(data) {
    if (!data || data.version !== 1 || !Number.isInteger(data.level) || data.level < 0 || data.level > 4) return false;
    if (!['score','elapsed','hits','blocked','maxCombo','retries'].every(k => Number.isFinite(data[k]) && data[k] >= 0 && data[k] <= 1e7)) return false;
    this.reset();
    for (const k of ['score','elapsed','hits','blocked','maxCombo','retries']) this[k] = data[k];
    // Resuming is not a pristine continuous run for medals.
    this.retries++; this.enterStage(data.level); return true;
  }
  retry() {
    if (this.phase !== 'lost' || this.mode !== 'campaign' || !this.checkpoint) return false;
    const elapsed = this.elapsed, hits = this.hits, retries = this.retries + 1, saved = this.checkpoint;
    this.score = saved.score; this.blocked = saved.blocked; this.maxCombo = saved.maxCombo;
    this.charge = 0; this.enterStage(saved.level, false);
    this.elapsed = elapsed; this.hits = hits; this.retries = retries; this.checkpoint = this.snapshot(); return true;
  }
  advance() {
    if (this.mode !== 'campaign' || this.done < this.quota) return;
    if (this.chapter === 4) { this.phase = 'won'; this.strikes = []; this.webs = []; this.events.push('saved'); }
    else { this.enterStage(this.chapter + 1); this.events.push('chapter'); }
  }
  gainCharge(amount = 1) {
    const previous = this.charge; this.charge = Math.min(6, this.charge + amount);
    if (previous < 6 && this.charge === 6) this.events.push('charged');
  }
  move(dr, dc) {
    if (this.slow > 0) return false;
    const moved = super.move(dr, dc);
    if (moved && this.spills.some(s => s.row === this.row && s.col === this.col)) { this.slow = .26; this.events.push('sticky'); }
    return moved;
  }
  dash(dr, dc) {
    const slow = this.slow, from = {row:this.row,col:this.col}; this.slow = 0;
    if (!super.dash(dr, dc)) { this.slow = slow; return false; }
    this.slow = 0;
    if (this.charge === 6) {
      this.charge = 0; this.invulnerable = 1; this.cooldown = 1.5;
      // Leave a real protective thread on every traversed cell, including landing.
      for (let i = 0; i <= 2; i++) {
        const row = Math.max(0,Math.min(2,from.row + dr*i)), col = Math.max(0,Math.min(9,from.col + dc*i));
        if (!this.webs.some(w => w.row === row && w.col === col)) this.webs.push({row,col,life:6});
      }
      this.events.push('powerdash');
    }
    return true;
  }
  typo() {
    if (this.phase !== 'playing') return false;
    if (this.row !== this.target.row || this.col !== this.target.col) { this.events.push('miss'); return false; }
    if (this.mode === 'campaign' && [2,3].includes(this.chapter)) { this.events.push('useweb'); return false; }
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1; this.comboTimer = 4;
    this.maxCombo = Math.max(this.maxCombo,this.combo); this.score++; this.gainCharge();
    this.events.push(this.mode === 'campaign' && this.chapter === 4 ? 'objective' : 'typo');
    if (this.combo % 3 === 0) { const bonus = Math.min(3,(this.mode === 'arcade' ? 90 : this.limit)-this.time); this.time += bonus; this.bonusTime += bonus; this.events.push('combo'); }
    if (this.score % 4 === 0 && this.silk < 3) { this.silk++; this.events.push('silk'); }
    if (this.mode === 'arcade') { this.chooseTarget(); return true; }
    this.done++;
    if (this.chapter === 4) this.target = this.done === 1 ? {row:0,col:9} : {row:0,col:0};
    else this.chooseTarget();
    this.advance(); return true;
  }
  weave() {
    if (this.phase !== 'playing') return false;
    const at = p => p && p.row === this.row && p.col === this.col;
    if (this.mode === 'campaign' && this.chapter === 2 && at(this.target)) {
      // Objective knots have their own thread: spending all defensive silk cannot soft-lock a chapter.
      this.anchors.push({...this.target}); this.done++; this.gainCharge(2); this.events.push('anchor');
      this.target = {row:2,col:1}; this.advance(); return true;
    }
    if (at(this.undo)) { this.undo = null; this.undoClock = 9; this.gainCharge(2); this.events.push('undo-block'); return true; }
    return super.weave();
  }
  spawnStrikes() {
    this.volley++;
    const difficulty = this.mode === 'arcade' ? Math.min(7, 2 + Math.floor(this.elapsed / 25)) : this.chapter;
    const cells = [{row:this.row,col:this.col}]; let event = 'warning';
    if (difficulty >= 1 && this.volley % 4 === 0) {
      event = 'backspace';
      for (let n = 1; n < 4; n++) if (this.col - n >= 0) cells.push({row:this.row,col:this.col-n,offset:n*.22});
    } else if (difficulty >= 3 && this.volley % 3 === 0) {
      event = 'hands'; const safe = (this.row+1)%3;
      for (let r=0;r<3;r++) if (r !== safe) for (let c=Math.max(0,this.col-1);c<=Math.min(9,this.col+1);c++) if (r!==this.row || c!==this.col) cells.push({row:r,col:c});
    } else if (difficulty >= 1) {
      const cell = {row:Math.floor(this.random()*3),col:Math.floor(this.random()*10)};
      if (cell.row!==this.row || cell.col!==this.col) cells.push(cell);
    }
    for (const cell of cells) this.strikes.push({...cell,delay:Math.max(.9,1.5-difficulty*.08)+(cell.offset||0),age:0,hit:false,blocked:false});
    this.nextStrike = Math.max(1.25,2.7-difficulty*.22); this.events.push(event);
  }
  tick(dt) {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.stageTime += dt; this.slow = Math.max(0,this.slow-dt);
    const rest = this.stageTime % 24 >= 18;
    if (rest && !this.respite) this.events.push('rest');
    this.respite = rest; if (rest) this.nextStrike = Math.max(this.nextStrike,dt+1);
    if (this.mode === 'campaign' && this.chapter === 1) {
      if (this.undo) {
        this.undo.left -= dt;
        if (this.undo.left <= 0) { this.done = Math.max(0,this.done-2); this.undo = null; this.undoClock = 9; this.events.push('undo'); }
      } else {
        this.undoClock -= dt;
        if (this.undoClock <= 0) { this.undo = {row:2,col:0,left:7}; this.events.push('undo-warning'); }
      }
    }
    const blocked = this.blocked;
    // Periodic silk regen makes the hunting objective recoverable after missed traps.
    if (Math.floor((this.stageTime-dt)/5) < Math.floor(this.stageTime/5) && this.silk < 3) { this.silk++; this.events.push('silk'); }
    super.tick(dt);
    const gained = this.blocked-blocked;
    if (gained) {
      this.gainCharge(gained*2);
      if (this.mode === 'campaign' && this.chapter === 3 && this.phase === 'playing') { this.done += gained; this.advance(); }
    }
  }
  medals() {
    if (this.phase !== 'won' || this.mode !== 'campaign') return [];
    const medals = ['Человек сохранён'];
    if (!this.hits && !this.retries) medals.push('Тихий спасатель');
    if (this.blocked >= 6) medals.push('Мастер паутины');
    if (this.elapsed <= 240 && !this.retries) medals.push('До рассвета');
    return medals;
  }
}
window.NightCampaign = NightCampaign;
