'use strict';
// Canvas rendering for NightScene: layers from desk to effects, drawn in 1200x650 world space.
(() => {
  const { rr, label } = NightBackdrop, T = NightArt.tex, TAU = Math.PI * 2;
  const mint = '#bbf880', red = '#ff766a';

  function keys(g, scene, game) {
    const L = NightScene.letters, t = scene.t, fx = scene.fx;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
      const { x, y } = NightScene.keyPos(r, c), target = !game.hunting && r === game.target.row && c === game.target.col;
      const warn = game.strikes.find(s => s.row === r && s.col === c && !s.hit);
      const dep = (scene.press.get(r * 10 + c) || 0) * 5, pulse = fx ? .5 + .5 * Math.sin(t * 5) : .5;
      g.save();
      if (target) { g.shadowColor = mint; g.shadowBlur = fx ? 10 + pulse * 14 : 14; }
      g.drawImage(T.key[warn ? 'warn' : target ? 'target' : 'normal'], x - 45, y - 40 + dep, 90, 84);
      g.restore();
      g.font = 'bold 17px monospace'; g.fillStyle = '#0006'; g.fillText(L[r][c], x - 26, y - 8 + dep);
      g.fillStyle = target ? '#e6ffd0' : warn ? '#ffd8d2' : '#c4d3df'; g.fillText(L[r][c], x - 27, y - 9 + dep);
      if (target) {
        label(g, game.targetLabel || 'BUG', x - 25, y + 17 + dep, 9, mint);
        label(g,game.threadMission ? 'E' : game.coopCue ? 'ОТОЙДИ' : 'SPACE',x-21,y-45,10,'#e6ffd0');
        g.strokeStyle = mint; g.globalAlpha = .55 + pulse * .45; g.lineWidth = 2; g.beginPath(); g.roundRect(x - 36, y - 31 + dep, 72, 55, 5); g.stroke(); g.globalAlpha = 1;
      }
      if (game.spills?.some(s => s.row === r && s.col === c)) {
        g.fillStyle = game.night===1 ? '#58a4d36b' : '#ad72296b'; g.beginPath(); g.ellipse(x, y+6, 33, 21, .2, 0, TAU); g.fill();
        label(g, game.night===1 ? 'ДОЖДЬ' : 'КОФЕ', x-19, y+21, 9, game.night===1 ? '#bdeaff' : '#ffe0a0');
      }
      if (game.undo?.row === r && game.undo.col === c) {
        g.strokeStyle = '#99dfff'; g.lineWidth = 3; g.strokeRect(x-39,y-34,78,62);
        label(g, `E · ${Math.ceil(game.undo.left)}с`, x-22,y+19,12,'#cdefff');
      }
      if (game.crumb?.row===r && game.crumb.col===c) {
        g.fillStyle='#ffc77a'; g.beginPath(); g.arc(x+18,y+8,7,0,TAU); g.fill();
        label(g,'+4с',x+5,y+29,10,'#ffe0a0');
      }
      if (target && game.targetLeft>0) label(g,`${Math.ceil(game.targetLeft)}с`,x+12,y-9,12,'#fff');
      const anchor=game.anchors?.findIndex(s=>s.row===r && s.col===c) ?? -1;
      if (anchor>=0) {
        const next=game.anchors[anchor+1];
        const end=game.night ? (next ? NightScene.keyPos(next.row,next.col) : {x,y:y-25}) : {x:972,y:123};
        g.strokeStyle='#99dfff'; g.lineWidth=2; g.beginPath(); g.moveTo(x,y); g.lineTo(end.x,end.y); g.stroke();
        label(g,'✓',x+18,y+18,17,'#99dfff');
      }
      if (warn) {
        const k = Math.min(1, warn.age / warn.delay), flick = k;
        // A closing bracket reads as a countdown without a rapid strobe.
        const reach = 43 + (1-k)*15;
        g.strokeStyle = red; g.lineWidth = 2; g.beginPath();
        for (const side of [-1,1]) {
          g.moveTo(x+side*reach,y-24); g.lineTo(x+side*reach,y-34); g.lineTo(x+side*(reach-10),y-34);
          g.moveTo(x+side*reach,y+15); g.lineTo(x+side*reach,y+25); g.lineTo(x+side*(reach-10),y+25);
        }
        g.stroke();
        g.fillStyle = `rgba(255,70,60,${.08 + flick * .2 * k})`; g.beginPath(); g.roundRect(x - 41, y - 36, 82, 65, 8); g.fill();
        g.strokeStyle = red; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * k); g.stroke();
        label(g, '!', x - 4, y + 6, 19, '#ffe0d6');
      }
    }
    const sp = g.createLinearGradient(0, 508, 0, 536); sp.addColorStop(0, '#41566a'); sp.addColorStop(1, '#273746');
    g.save(); g.shadowColor = '#000a'; g.shadowBlur = 6; g.shadowOffsetY = 3; rr(g, 371, 512, 463, 26, 7, sp, '#5b7084'); g.restore();
    g.save(); g.beginPath(); g.roundRect(371, 512, 463, 26, 7); g.clip(); g.fillStyle = NightArt.pattern(g, 'grain'); g.fillRect(371, 512, 463, 26); g.restore();
    label(g, `SPACE / ${game.actionLabel || 'ОПЕЧАТКА'}`, 497, 529, 10, '#9db0c1');
  }

  function web(g, scene, w) {
    const { x, y } = NightScene.keyPos(w.row, w.col), t = scene.t, fx = scene.fx;
    const fade = w.life < 1.5 ? .35 + .65 * (fx ? .5 + .5 * Math.sin(t * 22) : 1) * (w.life / 1.5) : 1;
    g.save(); g.globalAlpha = (.55 + Math.min(1, w.life / 2) * .4) * fade; g.strokeStyle = '#cdeeff'; g.lineWidth = 1.3; g.shadowColor = '#99dfff'; g.shadowBlur = 6;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 36, y + Math.sin(a) * 30); g.stroke(); }
    for (const radius of [9, 18, 27]) {
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = i * Math.PI / 4, a2 = a - Math.PI / 8, sag = i ? .86 : 1;
        if (i) g.quadraticCurveTo(x + Math.cos(a2) * radius * sag, y + Math.sin(a2) * radius * .8 * sag, x + Math.cos(a) * radius, y + Math.sin(a) * radius * .8);
        else g.moveTo(x + radius, y);
      }
      g.stroke();
    }
    g.shadowBlur = 0; g.fillStyle = '#fff';
    if (fx) for (let i = 0; i < 4; i++) { const a = i * 1.6 + t * .8; g.globalAlpha = .5 + .4 * Math.sin(t * 4 + i); g.beginPath(); g.arc(x + Math.cos(a) * 20, y + Math.sin(a) * 16, 1.4, 0, TAU); g.fill(); }
    g.restore();
  }

  function finger(g, x, y, off, alpha, tint) {
    g.save(); g.globalAlpha = Math.max(0, alpha);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + 10, y + 16, 28, 11, 0, 0, TAU); g.fill();
    g.translate(0, off);
    g.shadowColor = '#0008'; g.shadowBlur = 16; g.shadowOffsetX = 8; g.shadowOffsetY = 10;
    const skin = g.createLinearGradient(x - 26, 0, x + 27, 0); skin.addColorStop(0, '#c58f7d'); skin.addColorStop(.35, '#e8bcab'); skin.addColorStop(.7, '#d9a592'); skin.addColorStop(1, '#b57e6e');
    g.fillStyle = skin; g.beginPath(); g.roundRect(x - 26, y - 250, 53, 270, 25); g.fill(); g.shadowColor = 'transparent';
    g.save(); g.clip(); g.fillStyle = NightArt.pattern(g, 'grain'); g.globalAlpha *= .8; g.fillRect(x - 30, y - 255, 62, 280); g.restore();
    g.strokeStyle = 'rgba(110,60,50,.45)'; g.lineWidth = 1.4;
    for (const ky of [-130, -178]) { g.beginPath(); g.moveTo(x - 17, ky + y); g.quadraticCurveTo(x, ky + y + 5, x + 17, ky + y); g.stroke(); g.beginPath(); g.moveTo(x - 12, ky + y + 6); g.quadraticCurveTo(x, ky + y + 10, x + 12, ky + y + 6); g.stroke(); }
    const nail = g.createLinearGradient(x - 15, y - 14, x + 15, y + 6); nail.addColorStop(0, '#f6dfd5'); nail.addColorStop(1, '#d9b3a6');
    g.fillStyle = nail; g.beginPath(); g.roundRect(x - 15, y - 18, 30, 26, [5, 5, 12, 12]); g.fill(); g.strokeStyle = 'rgba(120,70,60,.4)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(x - 5, y - 8, 3, 7, .2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.roundRect(x - 20, y - 245, 8, 255, 4); g.fill();
    if (tint) { g.strokeStyle = tint; g.lineWidth = 2; g.globalAlpha *= .8; g.beginPath(); g.roundRect(x - 26, y - 250, 53, 270, 25); g.stroke(); }
    g.restore();
  }
  const ease = k => k * k * (3 - 2 * k);

  function fingers(g, scene, game) {
    for (const s of game.strikes) {
      const { x, y } = NightScene.keyPos(s.row, s.col);
      if (!s.hit) {
        const k = Math.min(1, s.age / s.delay), e = scene.fx ? k * k : k;
        g.fillStyle = `rgba(0,0,0,${.12 + e * .3})`; g.beginPath(); g.ellipse(x + 8 * (1 - e), y + 12, 12 + 24 * e, 7 + 10 * e, 0, 0, TAU); g.fill();
        finger(g, x, y, -(1 - e) * 170 - 20, .08 + .22 * e, null);
      } else {
        const k = Math.min(1, (s.age - s.delay) / .42), up = ease(Math.max(0, (k - .3) / .7));
        if (s.blocked) finger(g, x, y, -40 - up * 160 - Math.sin(Math.min(1, k * 3) * Math.PI) * -8, 1 - Math.max(0, k - .5) * 2, '#99dfff');
        else finger(g, x, y, -up * 190 + Math.sin(Math.min(1, k * 4) * Math.PI) * 3, 1 - Math.max(0, k - .55) / .45, null);
      }
    }
  }

  function storyLayers(g,scene,game) {
    if(game.threadRoute) {
      const a=NightScene.keyPos(game.threadRoute.a.row,game.threadRoute.a.col), b=NightScene.keyPos(game.threadRoute.b.row,game.threadRoute.b.col);
      g.strokeStyle='#bcecff'; g.lineWidth=3; g.setLineDash([8,5]); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); g.setLineDash([]);
      for(const p of [a,b]) { g.strokeStyle='#ffe08a'; g.beginPath(); g.arc(p.x,p.y,31,0,TAU); g.stroke(); label(g,'SHIFT',p.x-19,p.y+31,10,'#ffe08a'); }
    }
    if(game.routeStart) { const p=NightScene.keyPos(game.routeStart.row,game.routeStart.col); label(g,'ДОМОЙ',p.x-20,p.y-36,10,'#99dfff'); }
    if(game.coopCue) {
      const p=NightScene.keyPos(game.coopCue.row,game.coopCue.col);
      g.strokeStyle='#ffe08a'; g.lineWidth=4; g.strokeRect(p.x-40,p.y-34,80,64);
      label(g,'ОТОЙДИ',p.x-26,p.y+15,12,'#ffe08a');
      finger(g,p.x,p.y,-100-game.coopCue.left*35,.35,'#ffe08a');
    }
    if(game.finale && game.night===0) {
      // Lid casts a growing shadow but never hides warnings, keys or the escape.
      const depth=40+Math.min(1,game.stageTime/game.limit)*130;
      const shadow=g.createLinearGradient(0,210,0,210+depth); shadow.addColorStop(0,'#03080ec9'); shadow.addColorStop(1,'#03080e00');
      g.fillStyle=shadow; g.fillRect(40,210,1120,depth);
      label(g,`КРЫШКА · ${Math.ceil(game.time)}с ДО ЗАКРЫТИЯ`,420,222,11,'#ffe08a');
    }
    if(game.finale && game.night===1) {
      // Emergency light is steady even with FX enabled: no lightning flashes.
      for(let i=0;i<4;i++) { rr(g,440+i*80,210,65,18,4,i<game.done?'#bbf880':'#243c51','#99dfff'); label(g,String(i+1),467+i*80,223,11,'#eef8ff'); }
      const p=NightScene.keyPos(game.target.row,game.target.col); g.strokeStyle='#99dfff'; g.lineWidth=2;
      g.beginPath();g.moveTo(600,235);g.lineTo(p.x,p.y-42);g.stroke();
    }
  }

  function effects(g, scene) {
    if (scene.fx) for (const m of scene.marks) {
      const k = m.age/m.life, e = 1-Math.pow(1-k,3);
      g.save(); g.translate(m.x,m.y); g.rotate(m.angle);
      g.globalAlpha = (1-k)*.85; g.strokeStyle=m.color; g.lineWidth=2;
      g.beginPath();
      if (m.kind === 'speed') {
        for (let i=-2;i<=2;i++) {
          const y=i*10, start=-22-e*65-Math.abs(i)*6;
          g.moveTo(start,y); g.lineTo(start+25+(2-Math.abs(i))*12,y);
        }
      } else if (m.kind === 'silk') {
        const radius=12+e*38;
        for (let i=0;i<8;i++) {
          const a=i*TAU/8;
          g.moveTo(Math.cos(a)*radius*.45,Math.sin(a)*radius*.35);
          g.lineTo(Math.cos(a)*radius,Math.sin(a)*radius*.8);
        }
        g.ellipse(0,0,radius,radius*.8,0,0,TAU);
      } else if (m.kind === 'success') {
        for (let i=0;i<6;i++) {
          const a=i*TAU/6, r=24+e*22;
          g.moveTo(Math.cos(a)*r,Math.sin(a)*r*.75);
          g.lineTo(Math.cos(a)*(r+9),Math.sin(a)*(r+9)*.75);
        }
      } else {
        const radius=25+e*33;
        g.ellipse(0,10,radius,radius*.33,0,0,TAU);
        for (const side of [-1,1]) { g.moveTo(side*(radius+5),6); g.lineTo(side*(radius+13),-4); }
      }
      g.stroke(); g.restore();
    }
    if (scene.fx) for (const r of scene.rings) {
      g.globalAlpha = 1 - r.age / r.life; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - r.age / r.life * .6);
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .72, 0, 0, TAU); g.stroke();
    }
    if (scene.fx) for (const p of scene.parts) {
      const a = Math.max(0, p.life / p.max); g.globalAlpha = p.kind === 'dust' ? a * .5 : a; g.fillStyle = p.color;
      if (p.kind === 'dust') { g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - a * .6), 0, TAU); g.fill(); }
      else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .7); g.restore(); }
    }
    g.globalAlpha = 1; g.textAlign = 'center';
    for (const f of scene.floats) {
      const k = f.age / f.life; g.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3; g.font = `bold ${f.size}px monospace`;
      const y = f.y - (scene.fx ? ease(Math.min(1, k * 1.4)) * 34 : 0); g.lineWidth = 4; g.strokeStyle = 'rgba(5,10,15,.85)'; g.strokeText(f.text, f.x, y); g.fillStyle = f.color; g.fillText(f.text, f.x, y);
    }
    g.globalAlpha = 1; g.textAlign = 'left';
  }

  function spider(g, scene, game) {
    const s = scene.spider, t = scene.t, fx = scene.fx, inv = game.invulnerable > 0;
    if (fx) for (const q of scene.trail) { const grd = g.createRadialGradient(q.x, q.y, 2, q.x, q.y, 34); grd.addColorStop(0, `rgba(153,223,255,${q.a * .55})`); grd.addColorStop(1, 'rgba(153,223,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(q.x, q.y, 34, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(s.x + 5, s.y + 15, 32, 12, 0, 0, TAU); g.fill();
    const glow = fx ? .5 + .5 * Math.sin(t * 4) : .5;
    g.strokeStyle = inv ? '#99dfff' : `rgba(187,248,128,${.28 + glow * .22})`; g.lineWidth = 2; g.beginPath(); g.ellipse(s.x, s.y + 8, 36 + glow * 2, 28 + glow * 1.5, 0, 0, TAU); g.stroke();
    g.save(); g.translate(s.x, s.y); g.rotate(s.angle);
    g.globalAlpha = inv ? (fx ? (Math.sin(t * 30) > .3 ? .45 : 1) : .6) : 1;
    g.shadowColor = '#000'; g.shadowBlur = 8;
    NightArt.spider(g, { t: fx ? t : 0, speed: s.speed, squash: s.squash, stretch: s.stretch, hurt: game.invulnerable > .8 });
    g.restore();
    label(g, 'ТОЧКА', s.x - 17, s.y - 46, 10, '#e0edce');
  }

  NightScene.prototype.draw = function (g, game) {
    const d = this.display, v = d.view, pr = d.pixelRatio, canvas = g.canvas, fx = this.fx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    const k = pr * v.scale;
    g.setTransform(k, 0, 0, k, pr * v.x, pr * v.y);
    if (fx && this.shake > .3 && this.dt > 0) g.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    const rect = { x0: -v.x / v.scale - 30, y0: -v.y / v.scale - 30, x1: (v.width - v.x) / v.scale + 30, y1: (v.height - v.y) / v.scale + 30 };
    g.textBaseline = 'alphabetic';
    NightBackdrop.desk(g, rect, game, this.t); NightBackdrop.sideProps(g, rect); NightBackdrop.monitor(g, game, this.t, fx); NightBackdrop.props(g, game, this.t, fx);
    NightBackdrop.keyboardCase(g, game, this.t, fx); keys(g, this, game);
    for (const w of game.webs) web(g, this, w);
    storyLayers(g,this,game); spider(g, this, game); fingers(g, this, game); effects(g, this);
    if(game.invulnerable>0) label(g,`ЗАЩИТА ${game.invulnerable.toFixed(1)}с`,this.spider.x-42,this.spider.y+51,11,'#99dfff');
    if(game.lastDanger && game.phase==='lost') label(g,'ПОДСКАЗКА — НА КАРТОЧКЕ ПОВТОРА',350,570,13,'#ffe08a');
    // Persistent controls live in the HUD and field guide, not on the desk.
    if (game.combo > 1) label(g, `СЕРИЯ ×${game.combo}`, 550, 196, 14, mint);
    g.setTransform(pr, 0, 0, pr, 0, 0); // viewport-space overlays
    if (fx && this.flash > 0) { const grd = g.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * .25, v.width / 2, v.height / 2, Math.max(v.width, v.height) * .7); grd.addColorStop(0, 'rgba(255,60,50,0)'); grd.addColorStop(1, `rgba(255,60,50,${this.flash * .5})`); g.fillStyle = grd; g.fillRect(0, 0, v.width, v.height); }
  };
})();
