'use strict';
// Procedural art: every texture is generated once into offscreen canvases (no external assets).
const NightArt = (() => {
  const rng = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = {};

  // Seamless dark wood tile: periodic wavy grain lines drawn three times for vertical wrap.
  function buildWood() {
    const [c, g] = make(512, 256), r = rng(11);
    const base = g.createLinearGradient(0, 0, 0, 256); base.addColorStop(0, '#2b2724'); base.addColorStop(.5, '#332d29'); base.addColorStop(1, '#292522');
    g.fillStyle = base; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 90; i++) {
      const y0 = r() * 256, amp = 1 + r() * 5, k = 1 + Math.floor(r() * 3), ph = r() * 6.28, dark = r() < .6;
      g.strokeStyle = dark ? `rgba(8,6,5,${.1 + r() * .25})` : `rgba(130,105,80,${.03 + r() * .06})`; g.lineWidth = .6 + r() * 1.8;
      for (const wrap of [-256, 0, 256]) {
        g.beginPath();
        for (let x = 0; x <= 512; x += 8) { const y = y0 + wrap + Math.sin(x / 512 * 6.2832 * k + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
    }
    for (let i = 0; i < 3; i++) { // knots
      const x = r() * 512, y = r() * 256;
      for (let n = 4; n > 0; n--) { g.strokeStyle = `rgba(10,7,5,${.1 + n * .03})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, n * 7, n * 3.2, 0, 0, 6.2832); g.stroke(); }
    }
    return c;
  }
  // Fine speckle used as an overlay on plastic and metal.
  function buildGrain() {
    const [c, g] = make(128, 128), r = rng(5), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() < .5 ? 255 : 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 26; }
    g.putImageData(img, 0, 0); return c;
  }
  // Keycap sprite at 2x. Key centre sits at (45,40); top face 82x65, base is 5px lower.
  function keycap(kind) {
    const [c, g] = make(180, 168), pal = {
      normal: ['#41566a', '#2c3c4b', '#5b7084', '#101923'], target: ['#6a8b58', '#455f3a', '#c8f79b', '#17251a'], warn: ['#85454a', '#5a2a30', '#ff8f84', '#241013']
    }[kind];
    g.scale(2, 2);
    g.shadowColor = '#000b'; g.shadowBlur = 7; g.shadowOffsetY = 4;
    g.fillStyle = pal[3]; g.beginPath(); g.roundRect(4, 9, 82, 71, 8); g.fill(); g.shadowColor = 'transparent';
    const side = g.createLinearGradient(0, 9, 0, 80); side.addColorStop(0, pal[1]); side.addColorStop(1, pal[3]);
    g.fillStyle = side; g.beginPath(); g.roundRect(4, 9, 82, 71, 8); g.fill();
    const top = g.createLinearGradient(4, 4, 70, 70); top.addColorStop(0, pal[0]); top.addColorStop(1, pal[1]);
    g.fillStyle = top; g.beginPath(); g.roundRect(4, 4, 82, 65, 8); g.fill();
    const dish = g.createRadialGradient(45, 34, 3, 45, 38, 38); dish.addColorStop(0, '#fff1'); dish.addColorStop(.7, '#0000'); dish.addColorStop(1, '#0003');
    g.fillStyle = dish; g.beginPath(); g.roundRect(10, 9, 70, 54, 6); g.fill();
    g.save(); g.beginPath(); g.roundRect(4, 4, 82, 65, 8); g.clip(); g.globalAlpha = .9; g.fillStyle = g.createPattern(tex.grain, 'repeat'); g.fillRect(0, 0, 90, 84); g.restore();
    g.strokeStyle = pal[2]; g.lineWidth = 1.2; g.beginPath(); g.roundRect(4.6, 4.6, 80.8, 64, 8); g.stroke();
    g.strokeStyle = '#fff3'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(11, 5.8); g.lineTo(79, 5.8); g.stroke();
    return c;
  }
  // Leg chain: shoulder -> knee -> foot. Phase offsets give the alternating-tetrapod gait.
  const LEG = [[-9, -16, -30], [-3, -22, -8], [3, -30, 14], [9, -26, 34]];
  const fuzz = (() => { const r = rng(77); return Array.from({ length: 26 }, () => { const a = r() * 6.28, d = Math.sqrt(r()) * 12; return [Math.cos(a) * d * .85, 8 + Math.sin(a) * d * 1.25, a]; }); })();

  /** s: {t, speed 0..1, squash, stretch, ghost, hurt, glow}. Spider faces up (-y) in local space. */
  function spider(g, s) {
    const walk = Math.min(1, s.speed), t = s.t;
    g.save(); g.scale((1 + s.squash * .22 - s.stretch * .12) * 1.12, (1 - s.squash * .2 + s.stretch * .28) * 1.12);
    g.lineCap = g.lineJoin = 'round';
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      const [ay, kx, fy] = LEG[i], step = Math.sin(t * 17 + i * 1.57 + (side > 0 ? 3.14 : 0)) * walk;
      const idle = Math.sin(t * 1.7 + i * 2.3 + side) * (1 - walk) * 1.6;
      const lift = Math.max(0, step), fx = side * (34 - Math.abs(i - 1.5) * 3.5 + lift * 3), fyy = fy + step * 8 + idle;
      const sx = side * 6, kxx = side * (Math.abs(kx) + 8 + lift * 6), ky = ay - 14 - lift * 7 + step * 3;
      for (const [w, col] of [[5, '#05080c'], [2.6, '#1d2733'], [.9, '#4a5a6c']]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(sx, ay * .55); g.quadraticCurveTo(kxx, ky, fx, fyy); g.stroke();
      }
    }
    for (const side of [-1, 1]) { g.strokeStyle = '#222d3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(side * 3, -17); g.lineTo(side * 7, -26 + Math.sin(t * 6 + side) * (1 - walk)); g.stroke(); }
    const ab = g.createRadialGradient(-4, 0, 2, 0, 6, 21); ab.addColorStop(0, s.hurt ? '#5a2a2e' : '#2b3849'); ab.addColorStop(.55, '#0f151d'); ab.addColorStop(1, '#04060a');
    g.fillStyle = ab; g.beginPath(); g.ellipse(0, 7 + Math.sin(t * 2.4) * .6, 14, 18, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#2d3b4c'; g.lineWidth = .8; g.globalAlpha = .7; // hairs
    for (const [x, y, a] of fuzz) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff22'; g.beginPath(); g.ellipse(-5, 1, 3.4, 8, -.25, 0, 6.2832); g.fill();
    const pulse = .75 + Math.sin(t * 4) * .25; g.shadowColor = '#ff4d3d'; g.shadowBlur = 8 * pulse; g.fillStyle = '#ff5a48';
    g.beginPath(); g.moveTo(-4.5, 1); g.lineTo(4.5, 1); g.lineTo(1, 8); g.lineTo(4.5, 15); g.lineTo(-4.5, 15); g.lineTo(-1, 8); g.closePath(); g.fill(); g.shadowBlur = 0;
    const ct = g.createRadialGradient(-3, -15, 1, 0, -12, 10); ct.addColorStop(0, '#46586c'); ct.addColorStop(1, '#10171f');
    g.fillStyle = ct; g.beginPath(); g.arc(0, -12, 9, 0, 6.2832); g.fill();
    g.fillStyle = '#eaffd0'; for (const [x, y, r] of [[-3.4, -17, 1.8], [3.4, -17, 1.8], [-6, -14.5, 1.1], [6, -14.5, 1.1]]) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
    g.fillStyle = '#fff'; g.fillRect(-4, -18, .9, .9); g.fillRect(2.8, -18, .9, .9);
    g.restore();
  }
  tex.grain = buildGrain(); tex.wood = buildWood();
  tex.key = { normal: keycap('normal'), target: keycap('target'), warn: keycap('warn') };
  // createPattern is not free; one pattern per (context, texture) is reused across frames.
  const patterns = new WeakMap();
  function pattern(g, name) {
    let byName = patterns.get(g); if (!byName) patterns.set(g, byName = {});
    return byName[name] ||= g.createPattern(tex[name], 'repeat');
  }
  return { tex, spider, rng, make, pattern };
})();
window.NightArt = NightArt;
