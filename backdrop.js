'use strict';
// Static-ish scenery: desk, monitor, sticky note, mug, keyboard case. World space is 1200x650.
const NightBackdrop = (() => {
  const T = NightArt.tex;
  const rr = (g, x, y, w, h, r, fill, stroke, lw = 1) => {
    g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  };
  const label = (g, s, x, y, size, color) => { g.fillStyle = color; g.font = `${size}px monospace`; g.fillText(s, x, y); };

  function desk(g, rect, game, t) {
    const { x0, y0, x1, y1 } = rect, w = x1 - x0, h = y1 - y0;
    g.save(); g.translate(x0, y0); g.fillStyle = NightArt.pattern(g, 'wood'); g.fillRect(0, 0, w, h); g.restore();
    const dawn = game.progress ?? Math.min(1, game.score / 24), chapter = game.chapter || 0;
    const glow = g.createRadialGradient(600, 60, 40, 600, 160, 780);
    glow.addColorStop(0, game.night===1 ? 'rgba(75,160,235,.32)' : game.night===2 ? 'rgba(240,177,95,.30)' : `rgba(${110 + dawn * 120},${150 + dawn * 40},${190 - dawn * 80},.30)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(x0, y0, w, h);
    if (chapter > 0 || game.phase === 'won') { // window light creeping across the desk
      g.save(); g.globalAlpha = .06 + dawn * .12; g.fillStyle = '#ffc77a'; g.beginPath();
      g.moveTo(x1 - 330, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + 360); g.closePath(); g.fill(); g.restore();
    }
    const v = g.createRadialGradient(600, 325, 260, 600, 325, Math.max(w, h) * .62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(3,6,10,.62)');
    g.fillStyle = v; g.fillRect(x0, y0, w, h);
  }

  function monitor(g, game, t, fx) {
    g.save(); g.translate(120,35); g.scale(.8,.8);
    rr(g, 283, -42, 633, 203, 15, '#0a1018', '#4a5b6c', 1.5);
    const scr = g.createLinearGradient(0, -30, 0, 137); scr.addColorStop(0, '#12202c'); scr.addColorStop(1, '#0c1620');
    rr(g, 299, -30, 600, 167, 6, scr);
    g.save(); g.beginPath(); g.roundRect(299, -30, 600, 167, 6); g.clip();
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = -30; y < 137; y += 4) g.fillRect(299, y, 600, 1);
    if (fx) { const sy = ((t * 40) % 220) - 50; const sg = g.createLinearGradient(0, sy, 0, sy + 50); sg.addColorStop(0, 'rgba(150,220,255,0)'); sg.addColorStop(.5, 'rgba(150,220,255,.07)'); sg.addColorStop(1, 'rgba(150,220,255,0)'); g.fillStyle = sg; g.fillRect(299, sy, 600, 50); }
    label(g, 'nightshift.js', 322, 24, 13, '#6a8498'); label(g, 'const deadline = "yesterday";', 337, 57, 17, '#91b4d0');
    const lines = ['while (!asleep) { ship(bugs); }', '// Ctrl+Z: undo the spider?', '// coffee !== backup', '// привет, маленький из стакана', '// save(project); save(human);'];
    label(g, game.phase === 'won' ? '// человек сохранён. спокойной ночи.' : game.mission ? `// ${game.mission.name}` : lines[game.chapter], 337, 87, 17, game.episode?.color || '#b7d89c');
    label(g, game.night ? `› ${game.night===1 ? 'backup' : 'demo'}: ${game.done}/${game.quota} · night ${game.night+1}` : game.score ? `✕ ${game.score} errors  ·  build failed` : '› compiling another bad idea…', 337, 117, 14, game.night ? '#99dfff' : game.score ? '#ff766a' : '#6e8696');
    if (!fx || Math.sin(t * 5) > -.2) { g.fillStyle = '#b7d89c'; g.fillRect(337 + 11.1 * 17 * (game.phase === 'won' ? 1.7 : 1.45), 73, 9, 17); }
    const lg = g.createLinearGradient(299, -30, 899, 137); lg.addColorStop(0, 'rgba(255,255,255,.07)'); lg.addColorStop(.4, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(299, -30, 600, 167);
    g.restore();
    if(game.finale && game.night===1 && game.phase!=='won') {
      rr(g,299,-30,600,167,6,'#08131af0'); label(g,'РЕЗЕРВНОЕ ПИТАНИЕ',350,40,19,'#99dfff');
      label(g,`${game.done}/4 · ${game.done===0?'ПРОВЕРЬ КОПИЮ':game.done===1?'СОХРАНИ':game.done===2?'ОТСОЕДИНИ ПИТАНИЕ':'ДОМОЙ ПОД ESC'}`,350,85,16,'#bbf880');
    }
    if (game.phase === 'won') {
      rr(g,299,-30,600,167,6,'#050a10e8'); label(g,'sleep mode · до утра',420,72,19,'#829b8b');
    }
    rr(g, 548, 162, 101, 17, 4, '#141e29', '#2c3a48'); rr(g, 470, 176, 258, 6, 3, '#1a2531');
    g.restore();
  }

  function props(g, game, t, fx) {
    g.save(); g.translate(120,55); g.scale(.8,.8);
    g.save(); g.translate(102, 99); g.rotate(-.12); g.shadowColor = '#0009'; g.shadowBlur = 12; g.shadowOffsetY = 5;
    const paper = g.createLinearGradient(-57, -55, 66, 63); paper.addColorStop(0, '#e4d29f'); paper.addColorStop(1, '#cdb87f');
    rr(g, -57, -55, 123, 118, 2, paper); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-57, -55, 123, 10);
    label(g, `НОЧЬ ${(game.night||0)+1}`, -39, -24, 17, '#4a4536'); label(g, ['1. релиз','1. бэкап','1. показ'][game.night||0], -39, 3, 14, '#4a4536'); label(g, '2. сон!', -39, 28, 14, '#4a4536');
    g.strokeStyle = '#4a4536'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-40, -1); g.lineTo(26, -3); g.stroke(); g.restore();
    g.strokeStyle = '#0d141c'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(1114, 120); g.bezierCurveTo(1190, 90, 1150, 20, 1190, -20); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(1072, 100, 70, 62, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#7e9099'; g.lineWidth = 7; g.fillStyle = '#16202a'; g.beginPath(); g.arc(1065, 85, 62, 0, 6.2832); g.fill(); g.stroke();
    g.strokeStyle = '#a9b8bf'; g.lineWidth = 2; g.globalAlpha = .5; g.beginPath(); g.arc(1065, 85, 63, 3.6, 4.7); g.stroke(); g.globalAlpha = 1;
    const cof = g.createRadialGradient(1055, 75, 6, 1065, 85, 49); cof.addColorStop(0, '#5a4338'); cof.addColorStop(1, '#2b201d');
    g.fillStyle = cof; g.beginPath(); g.arc(1065, 85, 48, 0, 6.2832); g.fill();
    g.strokeStyle = '#9a8070'; g.lineWidth = 1; g.globalAlpha = .4; g.beginPath(); g.arc(1065, 85, 32, 0, 6.2832); g.stroke(); g.globalAlpha = 1;
    // The mug stays an in-world prop without a floating caption.
    if(game.night>0) {
      g.strokeStyle='#92745c';g.lineWidth=3;g.beginPath();g.ellipse(1080,185,64,15,0,0,6.2832);g.stroke();
      g.strokeStyle='#bfeaff';g.lineWidth=1.5;g.beginPath();g.moveTo(1110,120);g.lineTo(1140,160);g.lineTo(1160,90);g.stroke();
      label(g,'ПОСЛЕ ТОЙ НОЧИ',975,198,9,'#97b1aa');
    }
    g.restore();
    if(game.night===2) {
      g.fillStyle='#dab47a';g.beginPath();g.arc(68,260,5,0,6.2832);g.fill();
      label(g,'ТОЧКЕ',42,247,9,'#ffe08a');
    }
    if(game.night===2 && game.phase==='won') {
      rr(g,178,570,70,23,10,'#456a79','#bceaff',2); rr(g,183,573,60,10,6,'#9ad4e2');
      label(g,'ВОДА ДЛЯ НАПАРНИКА',170,614,10,'#99dfff');
    }
    if (game.phase === 'won') {
      g.fillStyle = '#dab47a';
      for (const [x,y,r] of [[870,575,5],[880,581,3],[865,585,2]]) { g.beginPath(); g.arc(x,y,r,0,6.2832); g.fill(); }
      label(g, 'ДО УТРА, ТОЧКА.', 930, 584, 12, '#c5d4bb');
    }
    g.save(); g.translate(120,55); g.scale(.8,.8);
    if (fx) for (let i = 0; i < 3; i++) { // steam
      g.strokeStyle = `rgba(210,225,235,${.12 - ((t * .5 + i / 3) % 1) * .1})`; g.lineWidth = 3; g.beginPath();
      const p = (t * .5 + i / 3) % 1, bx = 1045 + i * 20;
      g.moveTo(bx, 55 - p * 6); g.bezierCurveTo(bx + 12 * Math.sin(t + i), 35 - p * 30, bx - 12, 15 - p * 40, bx + 6 * Math.sin(t * 1.3 + i), -6 - p * 48); g.stroke();
    }
    g.restore();
  }

  // Optional side wings use only the surplus viewport, never the keyboard area.
  function sideLayout(rect) {
    const left = Math.max(0, -rect.x0 - 55), right = Math.max(0, rect.x1 - 1255);
    return [
      { side: 'left', x: -left / 2 - 10, y: 326, scale: Math.min(1.15, left / 310) },
      { side: 'right', x: 1210 + right / 2, y: 326, scale: Math.min(1.15, right / 310) }
    ].filter(p => p.scale >= .5);
  }

  let accessoriesLayer = null;
  function sideProps(g, rect) {
    const placements = sideLayout(rect);
    if (!placements.length) return;
    if (!accessoriesLayer) {
      accessoriesLayer = NightArt.make(640, 440)[0];
      const c = accessoriesLayer.getContext('2d');
      // Left: cloth-bound notebook, unfinished checklist and a metal pen.
      c.save(); c.translate(160, 220); c.rotate(-.10);
      c.shadowColor = '#0009'; c.shadowBlur = 14; c.shadowOffsetY = 8;
      rr(c,-106,-146,212,284,10,'#263f44','#597378',2); c.shadowColor='transparent';
      rr(c,-97,-138,194,266,4,'#c7c2a6');
      c.fillStyle='#a29d83'; c.fillRect(-80,-138,2,266);
      c.strokeStyle='#929e9559'; c.lineWidth=1;
      for(let y=-82;y<116;y+=23) { c.beginPath(); c.moveTo(-66,y); c.lineTo(78,y); c.stroke(); }
      label(c,'ЗАВТРА',-61,-107,17,'#3e5555');
      for(const [i,text] of ['бэкап','один фикс','выспаться'].entries()) {
        c.strokeStyle='#52635d'; c.strokeRect(-62,-71+i*46,10,10);
        label(c,text,-44,-61+i*46,12,'#43574e');
      }
      c.strokeStyle='#60766a'; c.beginPath(); c.moveTo(-61,-66); c.lineTo(-58,-62); c.lineTo(-51,-72); c.stroke();
      rr(c,70,-141,7,278,2,'#855d48'); c.restore();
      c.save(); c.translate(280,226); c.rotate(.15);
      rr(c,-6,-114,12,214,5,'#283848','#8195a4'); rr(c,-5,-110,10,50,3,'#8a9ba7');
      c.fillStyle='#b2b8ba'; c.beginPath(); c.moveTo(-5,100); c.lineTo(5,100); c.lineTo(0,119); c.fill(); c.restore();
      // Right: stitched mouse mat, wired mouse and a sleeping phone.
      c.save(); c.translate(480,220);
      c.shadowColor='#0009'; c.shadowBlur=14; c.shadowOffsetY=8;
      rr(c,-128,-66,256,230,22,'#15252d','#4a626a',2); c.shadowColor='transparent';
      c.setLineDash([3,5]); rr(c,-120,-58,240,214,17,'#1c2e35','#52616a'); c.setLineDash([]);
      label(c,'// just one more fix',-97,136,11,'#637f86');
      c.strokeStyle='#0b1119'; c.lineWidth=6; c.beginPath(); c.moveTo(28,-26); c.bezierCurveTo(78,-78,126,-79,117,-172); c.stroke();
      const shell=c.createLinearGradient(-25,0,85,0); shell.addColorStop(0,'#273744'); shell.addColorStop(.5,'#51636e'); shell.addColorStop(1,'#23343e');
      c.save(); c.translate(25,29); c.rotate(.14);
      rr(c,-47,-61,94,134,[41,41,35,35],shell,'#788992',1.5);
      c.strokeStyle='#172732'; c.beginPath(); c.moveTo(0,-59); c.lineTo(0,-4); c.moveTo(-44,-2); c.quadraticCurveTo(0,9,44,-2); c.stroke();
      rr(c,-5,-44,10,28,4,'#13242b','#8caaa9'); c.restore();
      c.save(); c.translate(-65,-139); c.rotate(-.13);
      rr(c,-37,-66,74,132,10,'#101b25','#677b86',2); rr(c,-31,-58,62,115,6,'#253c47');
      label(c,'03:47',-26,-17,15,'#a3bbc3'); label(c,'НЕ БЕСПОКОИТЬ',-28,8,6,'#91a6ae');
      rr(c,-12,-53,24,4,2,'#0d1b23'); c.strokeStyle='#50717b'; c.beginPath(); c.moveTo(-23,34); c.lineTo(22,10); c.stroke(); c.restore();
      c.restore();
    }
    for (const p of placements) {
      g.save(); g.translate(p.x,p.y); g.scale(p.scale,p.scale);
      g.drawImage(accessoriesLayer,p.side==='left'?0:320,0,320,440,-160,-220,320,440);
      g.restore();
    }
  }

  // The case never changes, so it is rendered once per zoom level into an offscreen layer
  // (the 36px shadow blur was the most expensive single operation of every frame).
  let caseLayer = null;
  function keyboardCase(g, game, t, fx) {
    const s = Math.min(2, Math.max(.25, Math.round(g.getTransform().a * 20) / 20));
    if (!caseLayer || caseLayer.s !== s) {
      const x0 = -30, y0 = 150, w = 1260, h = 490, [c, cg] = NightArt.make(Math.round(w * s), Math.round(h * s));
      cg.scale(s, s); cg.translate(-x0, -y0); caseStatic(cg);
      caseLayer = { s, c, x0, y0, w, h };
    }
    g.drawImage(caseLayer.c, caseLayer.x0, caseLayer.y0, caseLayer.w, caseLayer.h);
    label(g, 'N / 87', 65, 233, 10, '#8aa0b2');
    const blink = !fx || Math.sin(t * 3) > -.3;
    g.fillStyle = '#97b479'; g.shadowColor = '#b9f77f'; g.shadowBlur = blink ? 8 : 0;
    g.beginPath(); g.arc(962, 229, 3, 0, 6.2832); g.fill(); g.beginPath(); g.arc(1043, 229, 3, 0, 6.2832); g.fill(); g.shadowBlur = 0;
    label(g, 'CAPS', 970, 233, 9, '#97b479'); label(g, 'NIGHT MODE', 1051, 233, 9, '#97b479');
  }

  function caseStatic(g) {
    g.save(); g.shadowColor = '#000c'; g.shadowBlur = 36; g.shadowOffsetY = 14; rr(g, 33, 209, 1134, 352, 18, '#0b1118'); g.restore();
    const body = g.createLinearGradient(0, 205, 0, 549); body.addColorStop(0, '#2b3948'); body.addColorStop(1, '#1b2632');
    rr(g, 39, 205, 1122, 344, 16, body, '#566676', 1.5);
    g.save(); g.beginPath(); g.roundRect(39, 205, 1122, 344, 16); g.clip(); g.globalAlpha = .7; g.fillStyle = NightArt.pattern(g, 'grain'); g.fillRect(39, 205, 1122, 344);
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.beginPath(); for (let x = 39; x < 1161; x += 3) { g.moveTo(x, 205); g.lineTo(x, 549); } g.stroke();
    g.restore();
    rr(g, 49, 241, 1102, 292, 10, '#0c131b', '#050a10');
    for (const [x, y] of [[56, 214], [1144, 214], [56, 538], [1144, 538]]) { g.fillStyle = '#0a1016'; g.beginPath(); g.arc(x, y, 3.2, 0, 6.2832); g.fill(); g.fillStyle = '#6f8191'; g.beginPath(); g.arc(x - .6, y - .6, 1.6, 0, 6.2832); g.fill(); }
  }
  return { desk, monitor, props, sideProps, sideLayout, keyboardCase, rr, label };
})();
window.NightBackdrop = NightBackdrop;
