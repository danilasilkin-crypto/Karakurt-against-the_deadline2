'use strict';
// Scene state: spider animation, particles, rings, floating labels, key presses and finger impacts.
// Rendering lives in render.js. Game rules are never touched here; the scene only observes `game`.
class NightScene {
  static letters = ['QWERTYUIOP', 'ASDFGHJKL;', 'ZXCVBNM,./'];
  static keyPos(row, col) { return { x: 102 + row * 17 + col * 96, y: 287 + row * 88 }; }
  constructor(display) {
    this.display = display; this.t = 0; this.dt = 0;
    this.reset(null);
  }
  get fx() { return !this.display.reducedMotion; }
  reset(game) {
    const p = game ? NightScene.keyPos(game.row, game.col) : NightScene.keyPos(1, 4);
    this.spider = { x: p.x, y: p.y, angle: 0, speed: 0, squash: 0, stretch: 0 };
    this.parts = []; this.rings = []; this.floats = []; this.trail = []; this.marks = []; this.press = new Map();
    this.seen = new WeakSet(); this.shake = 0; this.flash = 0; this.trailTime = 0; this.celebrated = false;
  }
  burst(x, y, color, n = 14, speed = 190, kind = 'spark') {
    if (!this.fx) return;
    for (let i = 0; i < n && this.parts.length < 320; i++) {
      const a = Math.random() * 6.2832, v = speed * (.35 + Math.random() * .65), life = .45 + Math.random() * .45;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'dust' ? 30 : 0), g: kind === 'spark' ? 260 : 40, life, max: life, size: kind === 'dust' ? 5 + Math.random() * 7 : 2 + Math.random() * 3, color, rot: a, vr: (Math.random() - .5) * 14, kind });
    }
  }
  ring(x, y, color, max = 70, life = .5, width = 3) {
    if (!this.fx) return;
    if (this.rings.length >= 32) this.rings.shift();
    this.rings.push({ x, y, r: 6, max, life, age: 0, color, width });
  }
  float(x, y, text, color, size = 17) {
    if (this.floats.length >= 12) this.floats.shift();
    this.floats.push({ x, y, text, color, size, age: 0, life: 1.1 });
  }
  mark(kind, x, y, color, angle = 0) {
    if (!this.fx) return;
    if (this.marks.length >= 24) this.marks.shift();
    this.marks.push({ kind, x, y, color, angle, age: 0, life: kind === 'silk' ? .65 : .38 });
  }
  /** Reacts to a model event; called by game.js right after the model emits it. */
  onEvent(name, game) {
    const s = this.spider, key = game.row * 10 + game.col;
    // Use the actual key, not the interpolated spider: fast input may precede a frame.
    const p = NightScene.keyPos(game.row, game.col);
    if (['dash','powerdash','route-ride'].includes(name)) {
      this.mark('speed', s.x, s.y, '#99dfff', Math.atan2(p.y-s.y, p.x-s.x));
      this.trailTime = .32; s.stretch = 1;
    }
    if (['web','anchor','route-ready','undo-block'].includes(name)) this.mark('silk', p.x, p.y, '#bfeaff');
    if (['typo','objective','partner-press','crumb'].includes(name)) this.mark('success', p.x, p.y, name === 'crumb' ? '#ffe08a' : '#bbf880');
    if (name === 'near-miss') this.mark('speed', s.x, s.y, '#ffe08a', s.angle-Math.PI/2);
    if(['near-miss','route-ready','route-ride','partner-press','partner-ready'].includes(name)) {
      const text={'near-miss':'НА ВОЛОСКЕ · +1', 'route-ready':'НИТЬ-ПУТЬ · SHIFT', 'route-ride':'ПО НИТИ!', 'partner-ready':'ОТОЙДИ · ДАЙ НАЖАТЬ', 'partner-press':'ВМЕСТЕ!'}[name];
      this.float(s.x,s.y-66,text,'#ffe08a',14); this.ring(s.x,s.y,'#99dfff',80,.5);
    }
    if (name === 'typo') {
      s.squash = 1; this.press.set(key, 1); this.burst(s.x, s.y, '#bbf880', 16); this.ring(s.x, s.y + 6, '#bbf880', 62, .45);
      this.float(s.x, s.y - 52, game.combo > 1 ? `+1 БАГ ×${game.combo}` : '+1 БАГ', '#d8ffb2');
      for (let i = 0; i < 3; i++) this.burst(s.x, s.y, '#e4ffc7', 1, 120, 'dust');
    } else if (name === 'miss') { this.press.set(key, .5); this.float(s.x, s.y - 52, 'НЕ ТА КЛАВИША', '#9fb0bd', 12); }
    else if (name === 'hurt') { this.flash = 1; this.shake = Math.max(this.shake, 14); this.burst(s.x, s.y, '#ff766a', 24, 260); this.float(s.x, s.y - 52, 'ПАНЦИРЬ −1', '#ff9a8f'); }
    else if (name === 'dash') { this.trailTime = .32; s.stretch = 1; this.burst(s.x, s.y, '#99dfff', 12, 220); this.ring(s.x, s.y + 8, '#99dfff', 80, .4); }
    else if (name === 'web') { this.burst(s.x, s.y, '#bfeaff', 14, 120); this.ring(s.x, s.y + 6, '#99dfff', 58, .65, 2); this.float(s.x, s.y - 52, 'ПАУТИНА', '#99dfff', 13); }
    else if (name === 'combo') this.float(s.x, s.y - 74, 'ВРЕМЯ +', '#ffe08a', 14);
    else if (name === 'silk') this.float(s.x + 40, s.y - 40, '+ НИТЬ', '#99dfff', 12);
    else if (['anchor','undo-block','objective','charged','powerdash'].includes(name)) {
      const text = {anchor:'КРУЖКА ДЕРЖИТСЯ', 'undo-block':'ОТМЕНА ОТМЕНЕНА', objective:'СОХРАНЕНО', charged:'8 ЛАП · SHIFT', powerdash:'ЗАЩИТНАЯ НИТЬ'}[name];
      this.float(s.x, s.y-65, text, '#99dfff', 14); this.ring(s.x,s.y,'#99dfff',90,.6); this.burst(s.x,s.y,'#bbf880',18);
    }
  }
  update(dt, game) {
    this.dt = dt; this.t += dt; const s = this.spider, fx = this.fx;
    if (!fx) {
      this.parts.length = this.rings.length = this.trail.length = this.marks.length = 0;
      this.trailTime = this.shake = this.flash = 0;
    }
    for (const m of this.marks) m.age += dt;
    this.marks = this.marks.filter(m => m.age < m.life);
    const target = NightScene.keyPos(game.row, game.col);
    if (dt > 0) {
      const k = Math.min(1, dt * 22), dx = (target.x - s.x) * k, dy = (target.y - s.y) * k, dist = Math.hypot(dx, dy);
      s.x += dx; s.y += dy;
      s.speed += ((fx ? Math.min(1, dist / dt / 260) : 0) - s.speed) * Math.min(1, dt * 12);
      if (dist > .5) {
        let diff = Math.atan2(dx, -dy) - s.angle; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        s.angle += diff * Math.min(1, dt * 16);
      }
      s.squash = Math.max(0, s.squash - dt * 5); s.stretch = Math.max(0, s.stretch - dt * 4);
      this.shake *= Math.exp(-dt * 9); this.flash = Math.max(0, this.flash - dt * 2.2);
      for (const [key, v] of this.press) { const n = v - dt * 6; if (n <= 0) this.press.delete(key); else this.press.set(key, n); }
      if (this.trailTime > 0 && fx) { this.trailTime -= dt; if (this.trail.length < 24) this.trail.push({ x: s.x, y: s.y, a: .5 }); }
      for (const q of this.trail) q.a -= dt * 1.7; this.trail = this.trail.filter(q => q.a > 0);
    }
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= Math.exp(-dt * 1.6); p.rot += p.vr * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const r of this.rings) { r.age += dt; r.r = 6 + (r.max - 6) * (1 - Math.pow(1 - Math.min(1, r.age / r.life), 3)); }
    this.rings = this.rings.filter(r => r.age < r.life);
    for (const f of this.floats) f.age += dt;
    this.floats = this.floats.filter(f => f.age < f.life);
    for (const st of game.strikes) {
      if (!st.hit || this.seen.has(st)) continue;
      this.seen.add(st); const p = NightScene.keyPos(st.row, st.col);
      this.press.set(st.row * 10 + st.col, 1);
      this.mark(st.blocked ? 'silk' : 'impact', p.x, p.y, st.blocked ? '#99dfff' : '#e7bba1');
      if (st.blocked) { this.burst(p.x, p.y, '#bfeaff', 18, 210); this.ring(p.x, p.y, '#99dfff', 70, .5, 2); this.float(p.x, p.y - 56, 'ПАЛЕЦ ЗАПУТАЛСЯ!', '#99dfff', 13); }
      else { this.shake = Math.max(this.shake, 6); this.burst(p.x, p.y + 12, '#a98b78', 12, 150, 'dust'); this.ring(p.x, p.y + 10, '#e7bba1', 64, .4, 3); }
    }
    if (game.phase === 'won' && !this.celebrated) {
      this.celebrated = true;
      for (let i = 0; i < 5; i++) this.burst(300 + i * 150, 330, ['#bbf880', '#99dfff', '#ffe08a'][i % 3], 12, 280);
    }
    if (game.phase !== 'won' && game.phase !== 'lost') this.celebrated = false;
  }
}
window.NightScene = NightScene;
