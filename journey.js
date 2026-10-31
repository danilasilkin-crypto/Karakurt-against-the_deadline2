'use strict';
// Additional nights reuse movement/collisions, but own their objectives and clocks.
class NightJourney extends NightCampaign {
  reset() { super.reset(); this.night=0; this.linkLeft=0; this.targetLeft=0; this.crumb=null; this.crumbs=0; this.routeStart=null; this.threadRoute=null; this.nearMisses=0; this.coopCue=null; this.lastDanger=null; }
  get episode() { return NightEpisodes[this.night || 0]; }
  get finale() { return this.mode==='campaign' && this.chapter===4; }
  get cooperating() { return this.finale && this.night===2; }
  get atmosphere() { return !this.finale ? '' : this.night===0 ? 'КРЫШКА ОПУСКАЕТСЯ · УСПЕЙ ПОД ESC' : this.night===1 ? 'РЕЗЕРВНОЕ ПИТАНИЕ · СЛЕДУЙ ИНДИКАТОРАМ' : 'НАПАРНИКИ · ОСВОБОДИ КЛАВИШУ ЛЁШЕ'; }
  get routeHint() { return this.threadRoute ? 'SHIFT У УЗЛА — ПО НИТИ' : this.routeStart ? 'E НА ДРУГОЙ КЛАВИШЕ — СОЕДИНИТЬ' : 'E НА ЛОВУШКЕ — НАЧАТЬ МАРШРУТ'; }
  routeAction() {
    if(this.phase!=='playing') return false;
    const at=p=>p && p.row===this.row && p.col===this.col;
    if(!this.routeStart) {
      if(!this.webs.some(at)) return false;
      this.routeStart={row:this.row,col:this.col}; this.events.push('route-start'); return true;
    }
    if(at(this.routeStart)) { this.routeStart=null; this.events.push('route-cancel'); return true; }
    if(this.silk<=0) { this.events.push('route-empty'); return false; }
    this.silk--; this.threadRoute={a:this.routeStart,b:{row:this.row,col:this.col},life:18};
    this.routeStart=null; this.events.push('route-ready'); return true;
  }
  dash(dr,dc) {
    const route=this.threadRoute;
    if(this.phase==='playing' && this.cooldown<=0 && route) {
      const at=p=>p.row===this.row && p.col===this.col;
      const end=at(route.a) ? route.b : at(route.b) ? route.a : null;
      if(end) { this.row=end.row; this.col=end.col; this.slow=0; this.cooldown=1.5; this.invulnerable=Math.max(this.invulnerable,.45); this.events.push('route-ride','dash'); return true; }
    }
    return super.dash(dr,dc);
  }
  get mission() { return this.night && this.mode==='campaign' ? this.episode.chapters[this.chapter] : null; }
  get hunting() { return this.mission ? this.mission.kind==='hunt' : this.mode==='campaign' && this.chapter===3; }
  get threadMission() { return this.mission ? ['relay','weave'].includes(this.mission.kind) : this.mode==='campaign' && this.chapter===2; }
  get quota() { return this.mission?.quota ?? super.quota; }
  get limit() { return this.mission?.limit ?? super.limit; }
  get actionLabel() { return this.mission ? this.mission.label : super.actionLabel; }
  get targetLabel() { return this.mission ? this.mission.label : super.targetLabel; }
  get objective() { return this.mission ? `${this.mission.name} · ${this.done}/${this.quota}${this.linkLeft>0 ? ` · нить ${Math.ceil(this.linkLeft)}с` : this.targetLeft>0 ? ` · цель ${Math.ceil(this.targetLeft)}с` : ''}` : super.objective; }
  prepare(night=0) {
    if (!Number.isInteger(night) || !NightEpisodes[night]) return false;
    this.reset(); this.night=night; this.enterStage(0,false); this.phase='ready'; return true;
  }
  start(mode='campaign',night=this.night) {
    if (mode==='arcade') { super.start(mode); return; }
    this.prepare(night); this.phase='playing';
  }
  enterStage(level,card=true) {
    super.enterStage(level,card); this.linkLeft=0; this.targetLeft=this.mission?.volatile || 0; this.crumb=null;
    if (this.mission) {
      this.undo=null; this.spills=this.mission.spills ? [{row:0,col:3},{row:1,col:6},{row:2,col:5}] : [];
      this.silk=3; this.volley=0; this.selectMissionTarget();
    }
    this.routeStart=null; this.threadRoute=null; this.nearMisses=0; this.coopCue=null; this.coopClock=0; this.lastDanger=null;
    this.rainStep=0;
    this.checkpoint=this.snapshot();
  }
  snapshot() { return {...super.snapshot(),night:this.night || 0}; }
  restore(data) {
    const night=data && Object.hasOwn(data,'night') ? data.night : 0;
    if (!Number.isInteger(night) || !NightEpisodes[night]) return false;
    if (!super.restore(data)) return false;
    this.night=night; this.enterStage(data.level); return true;
  }
  selectMissionTarget() {
    const route=this.mission?.route;
    if (route) { const [row,col]=route[Math.min(this.done,route.length-1)]; this.target={row,col}; }
  }
  move(dr,dc) {
    const origin={row:this.row,col:this.col};
    const moved=super.move(dr,dc);
    if(moved) for(const strike of this.strikes) {
      if(!strike.hit && strike.row===origin.row && strike.col===origin.col && strike.delay-strike.age<=.25) strike.escapedAt=this.elapsed;
    }
    if (moved && this.crumb?.row===this.row && this.crumb.col===this.col) {
      this.crumb=null; this.crumbs++; this.gainCharge(2); this.time=Math.min(this.limit,this.time+4); this.events.push('crumb');
    }
    return moved;
  }
  completeAction() {
    this.done++; this.score++; this.gainCharge(); this.events.push('objective');
    if (this.done>=this.quota) { this.advance(); return; }
    if (this.mission.route) this.selectMissionTarget(); else this.chooseTarget();
    this.targetLeft=this.mission.volatile || 0;
    if (this.mission.kind==='relay') this.linkLeft=this.mission.window;
  }
  typo() {
    if (!this.mission) return super.typo();
    if (this.phase!=='playing') return false;
    if (this.threadMission || this.hunting) { this.events.push('useweb'); return false; }
    if (this.row!==this.target.row || this.col!==this.target.col) { this.events.push('miss'); return false; }
    if(this.cooperating) {
      if(!this.coopCue) { this.coopCue={...this.target,left:1.8}; this.events.push('partner-ready'); }
      else this.events.push('partner-wait');
      return true;
    }
    this.combo=this.comboTimer>0 ? this.combo+1 : 1; this.comboTimer=4; this.maxCombo=Math.max(this.maxCombo,this.combo);
    this.completeAction(); return true;
  }
  weave() {
    if (!this.mission) {
      const objective=this.threadMission && this.row===this.target.row && this.col===this.target.col;
      const undo=this.undo && this.row===this.undo.row && this.col===this.undo.col;
      if(!objective && !undo && (this.routeStart || this.webs.some(w=>w.row===this.row && w.col===this.col))) return this.routeAction();
      return super.weave();
    }
    if (this.phase!=='playing') return false;
    if (this.threadMission && this.row===this.target.row && this.col===this.target.col) {
      this.anchors.push({...this.target}); this.events.push('anchor'); this.completeAction(); return true;
    }
    if(this.routeStart || this.webs.some(w=>w.row===this.row && w.col===this.col)) return this.routeAction();
    return NightGame.prototype.weave.call(this);
  }
  spawnStrikes() {
    // In the last night the hand deliberately preserves a whole safe lane.
    if(this.cooperating) {
      if(this.coopCue) { this.nextStrike=2; return; }
      const safe=this.target.row;
      for(let row=0;row<3;row++) if(row!==safe) this.strikes.push({row,col:this.col,delay:1.8,age:0,hit:false,blocked:false});
      this.nextStrike=3; this.events.push('partner-lane'); return;
    }
    if (!this.mission || this.volley%3!==2) return super.spawnStrikes();
    this.volley++; const columns=[this.col];
    if (this.night===2) columns.push((this.col+5)%10);
    for (const col of columns) for (let row=0;row<3;row++) this.strikes.push({row,col,delay:1.65,age:0,hit:false,blocked:false});
    this.nextStrike=2.7; this.events.push(this.night===1?'storm':'notifications');
  }
  tick(dt) {
    if(this.phase!=='playing' || !Number.isFinite(dt) || dt<=0) return;
    if(this.threadRoute) { this.threadRoute.life-=dt; if(this.threadRoute.life<=0) { this.threadRoute=null; this.events.push('route-faded'); } }
    if(this.coopCue) {
      const cue=this.coopCue;
      const occupied=this.row===cue.row && this.col===cue.col;
      if(!occupied) cue.left-=dt;
      if(cue.left<=0) { this.coopCue=null; this.events.push('partner-press'); this.completeAction(); if(this.phase!=='playing') return; }
    }
    if(this.night===1 && this.chapter===2) {
      const step=Math.floor(this.stageTime/6);
      if(step!==this.rainStep) {
        this.rainStep=step;
        this.spills=[0,1,2].map(row=>({row,col:(step*3+row*2+1)%10})).filter(p=>p.row!==this.target.row || p.col!==this.target.col);
        this.events.push('rain-shift');
      }
    }
    // Observe impacts across both campaign implementations, without changing collisions.
    const before=this.hits, strikes=[...this.strikes];
    this.tickJourney(dt);
    for(const strike of strikes) {
      if(strike.hit && !strike.nearAwarded && strike.escapedAt!==undefined && !strike.blocked && this.hits===before && this.phase==='playing' && (this.row!==strike.row || this.col!==strike.col)) {
        strike.nearAwarded=true; this.nearMisses++; this.gainCharge(1); this.events.push('near-miss');
      }
    }
    if(this.hits>before) this.lastDanger='Удар по красной клавише. Уходи до заполнения кольца; E ловит удар, Shift даёт короткую защиту.';
    if(this.phase==='lost' && this.time<=0) this.lastDanger=this.cooperating ? 'После пробела отойди с цели: Лёша ждёт свободную клавишу.' : this.threadMission ? 'Сначала проложи путь к следующему узлу; Shift освобождает из лужи.' : 'Держи серию и используй нить для быстрого возврата. Таймер главы восстановится.';
  }
  tickJourney(dt) {
    if (!this.mission) return super.tick(dt);
    if (this.phase!=='playing' || !Number.isFinite(dt) || dt<=0) return;
    this.stageTime+=dt; this.slow=Math.max(0,this.slow-dt);
    const rest=this.stageTime%24>=18;
    if (rest && !this.respite) {
      this.events.push('rest'); this.crumb={row:2,col:(this.chapter*3+2)%10};
    }
    this.respite=rest; if(rest) this.nextStrike=Math.max(this.nextStrike,dt+1); else this.crumb=null;
    if (this.linkLeft>0) {
      this.linkLeft=Math.max(0,this.linkLeft-dt);
      if (!this.linkLeft) { this.done=0; this.anchors=[]; this.selectMissionTarget(); this.events.push('link-lost'); }
    }
    if (this.mission.volatile) {
      this.targetLeft-=dt;
      if(this.targetLeft<=0) { this.chooseTarget(); this.targetLeft=this.mission.volatile; this.events.push('relocate'); }
    }
    if(Math.floor((this.stageTime-dt)/5)<Math.floor(this.stageTime/5) && this.silk<3) { this.silk++; this.events.push('silk'); }
    const blocked=this.blocked;
    NightGame.prototype.tick.call(this,dt);
    const gained=this.blocked-blocked;
    if(gained) {
      this.gainCharge(gained*2);
      if(this.hunting && this.phase==='playing') { this.done=Math.min(this.quota,this.done+gained); this.advance(); }
    }
  }
}
window.NightJourney=NightJourney;
