'use strict';
// Main-menu backdrop. Markup lives in index.html; this class animates the canvas
// (web, hanging spider, drifting keycaps) only while the menu is visible.
class NightMenu {
  constructor(root, canvas, isReduced) {
    this.root = root; this.canvas = canvas; this.g = canvas.getContext('2d'); this.isReduced = isReduced;
    this.t = 0; this.last = 0; this.raf = 0; this.w = 1; this.h = 1; this.dpr = 1;
    const rand = NightArt.rng(2026), chars = 'TYPOBUGSLEEP;{}/*DEADLINE'.split('');
    this.keys = Array.from({ length: 22 }, (_, i) => ({
      x: rand(), y: rand(), v: .012 + rand() * .02, size: 30 + rand() * 26, ch: chars[i % chars.length],
      rot: (rand() - .5) * .8, spin: (rand() - .5) * .15, hot: i % 7 === 3, phase: rand() * 6.28,
    }));
    new ResizeObserver(() => { this.resize(); if (!this.raf) this.draw(); }).observe(root);
    this.resize();
  }
  get visible() { return !this.root.hidden; }
  show() { this.root.hidden = false; this.resize(); this.start(); }
  hide() { this.root.hidden = true; cancelAnimationFrame(this.raf); this.raf = 0; }
  start() {
    cancelAnimationFrame(this.raf); this.last = 0;
    const loop = now => {
      if (!this.visible) { this.raf = 0; return; }
      const dt = Math.min((now - (this.last || now)) / 1000, .05); this.last = now;
      if (!this.isReduced()) this.t += dt;
      this.draw(); this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    this.w = rect.width; this.h = rect.height; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(this.w * this.dpr), ch = Math.round(this.h * this.dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
  }
  web(g, w, h) {
    const size = Math.min(w, h) * .95, spokes = 8;
    g.save(); g.translate(w, 0); g.strokeStyle = '#cfe9d92a'; g.lineWidth = 1; g.lineCap = 'round';
    for (let i = 0; i <= spokes; i++) { const a = Math.PI / 2 + i / spokes * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * size, Math.sin(a) * size); g.stroke(); }
    for (let r = 1; r <= 7; r++) {
      const d = size * r / 7; g.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = Math.PI / 2 + i / spokes * Math.PI / 2, x = Math.cos(a) * d, y = Math.sin(a) * d;
        // Each strand sags toward the corner between two spokes.
        if (!i) g.moveTo(x, y); else { const m = a - Math.PI / 4 / spokes; g.quadraticCurveTo(Math.cos(m) * d * .9, Math.sin(m) * d * .9, x, y); }
      }
      g.stroke();
    }
    g.restore();
  }
  keycap(g, k, w, h, t) {
    const y = ((k.y - t * k.v) % 1 + 1) % 1, x = k.x * w + Math.sin(t * .4 + k.phase) * 10, py = y * (h + 120) - 60, s = k.size;
    g.save(); g.translate(x, py); g.rotate(k.rot + Math.sin(t * .3 + k.phase) * .1 + t * k.spin * .1);
    g.globalAlpha = (k.hot ? .55 : .22) * Math.min(1, Math.sin(y * Math.PI) * 2.2);
    g.fillStyle = k.hot ? '#27401f' : '#1f2b32'; g.strokeStyle = k.hot ? '#bbf880' : '#5b6d72'; g.lineWidth = 1.5;
    g.beginPath(); if (g.roundRect) g.roundRect(-s / 2, -s / 2, s, s, 7); else g.rect(-s / 2, -s / 2, s, s);
    g.fill(); g.stroke();
    g.fillStyle = k.hot ? '#bbf880' : '#9fb1b6'; g.font = `bold ${Math.round(s * .42)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(k.ch, 0, 1); g.restore();
  }
  hero(g, w, h, t) {
    // Decorative scene stays in the upper right; all controls remain HTML.
    const s = Math.min(w * .40 / 560, h * .32 / 260), x = w * .74, y = h * .28;
    g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-.10);
    g.shadowColor = '#0009'; g.shadowBlur = 24;
    g.fillStyle = '#182a32'; g.strokeStyle = '#51665f'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(-280,-85,560,235,20); g.fill(); g.stroke(); g.shadowBlur=0;
    for(let r=0;r<2;r++) for(let c=0;c<6;c++) {
      const hot=r===0 && c===3, kx=-260+c*87+r*6, ky=-63+r*96;
      g.fillStyle=hot?'#42633a':'#2a3d47'; g.strokeStyle=hot?'#bbf880':'#52616b';
      g.beginPath(); g.roundRect(kx,ky,76,78,8); g.fill(); g.stroke();
      g.fillStyle=hot?'#e2ffc9':'#a5b8be'; g.font='18px monospace'; g.textAlign='left'; g.fillText('QWERTYASDFGH'[r*6+c],kx+10,ky+24);
    }
    g.strokeStyle='#cfe5b4aa'; g.beginPath(); g.moveTo(0,170); g.lineTo(48,-30); g.lineTo(280,-140); g.stroke();
    g.save(); g.translate(48,-22+Math.sin(t)*3); g.scale(2.25,2.25);
    NightArt.spider(g,{t,speed:.12,squash:0,stretch:0,ghost:0,hurt:0,glow:0}); g.restore();
    g.fillStyle='#c4a488'; g.strokeStyle='#eed5b1'; g.lineWidth=2;
    g.save(); g.translate(170,-110); g.rotate(.35); g.beginPath(); g.roundRect(-30,-220,65,230,30); g.fill(); g.stroke();
    g.fillStyle='#e4cfaf'; g.beginPath(); g.roundRect(-21,-44,46,42,16); g.fill(); g.restore();
    g.restore();
  }
  draw() {
    const g = this.g, { w, h, t } = this; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#0e1419'); bg.addColorStop(.6, '#142027'); bg.addColorStop(1, '#0a1014');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w * .2, h * .85, 0, w * .2, h * .85, Math.max(w, h) * .6);
    glow.addColorStop(0, '#bbf88022'); glow.addColorStop(1, '#bbf88000'); g.fillStyle = glow; g.fillRect(0, 0, w, h);
    for (const k of this.keys) this.keycap(g, k, w, h, t);
    this.web(g, w, h);
    if (w > 900 && h > 500) this.hero(g, w, h, t);
    // Spider hangs from the top edge on a thread and bobs slowly.
    const narrow = w < 901, sx = w * (narrow ? .92 : .96) + Math.sin(t * .7) * 4, sy = h * .08 + Math.sin(t * .9) * 5;
    const scale = Math.max(.8, Math.min(2.3, Math.min(w, h) / 380));
    if (narrow) {
    g.strokeStyle = '#dfeee633'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, sy - 24 * scale); g.stroke();
    g.save(); g.translate(sx, sy); g.rotate(Math.PI + Math.sin(t * .7) * .12); g.scale(scale, scale);
    NightArt.spider(g, { t, speed: .18, squash: 0, stretch: 0, ghost: 0, hurt: 0, glow: 0 }); g.restore();
    }
    const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
    vig.addColorStop(0, '#0000'); vig.addColorStop(1, '#000000aa'); g.fillStyle = vig; g.fillRect(0, 0, w, h);
  }
}
window.NightMenu = NightMenu;
