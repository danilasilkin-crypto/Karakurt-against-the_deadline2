'use strict';
// CSS pixels and world coordinates stay separate from the HiDPI backing store.
class NightDisplay {
  constructor(canvas, onExit) {
    this.canvas = canvas; this.onExit = onExit; this.mode = 'window'; this.busy = false;
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.motionChoice = null;
    try { this.motionChoice = localStorage.getItem('karakurt-motion'); } catch (_) {}
    this.setMotion(this.motionChoice === 'full' ? false : this.motionChoice === 'reduced' ? true : this.motionQuery.matches);
    this.motionQuery.addEventListener('change', e => { if (!this.motionChoice) this.setMotion(e.matches); });
    document.getElementById('motion').onclick = () => {
      this.motionChoice = this.reducedMotion ? 'full' : 'reduced';
      this.setMotion(!this.reducedMotion);
      try { localStorage.setItem('karakurt-motion', this.motionChoice); } catch (_) {}
    };
    document.getElementById('fullscreen').onclick = () => this.toggleFullscreen();
    document.addEventListener('fullscreenchange', () => {
      const wasNative = this.mode === 'native';
      this.setMode(document.fullscreenElement ? 'native' : 'window');
      if (wasNative && !document.fullscreenElement) this.onExit();
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
    window.addEventListener('resize', () => this.resize());
    this.setMode('window'); this.resize();
  }
  setMotion(reduced) {
    this.reducedMotion = reduced;
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    const button = document.getElementById('motion');
    button.setAttribute('aria-pressed', String(reduced));
    button.setAttribute('aria-label', reduced ? 'Включить анимацию' : 'Уменьшить анимацию');
    button.title = reduced ? 'Спокойный режим · включить анимацию' : 'Уменьшить анимацию';
    button.textContent = reduced ? 'FX −' : 'FX';
  }
  setMode(mode) {
    this.mode = mode;
    const root = document.documentElement, button = document.getElementById('fullscreen');
    root.classList.toggle('immersive', mode !== 'window'); root.dataset.display = mode;
    button.setAttribute('aria-pressed', String(mode !== 'window'));
    const label = mode === 'native' ? 'Выйти из полного экрана' : mode === 'focus' ? 'Выйти из режима фокуса' : 'На весь экран';
    button.setAttribute('aria-label', label); button.title = `${label} · F`;
    button.querySelector('span').textContent = mode === 'window' ? 'НА ВЕСЬ ЭКРАН' : 'ВЕРНУТЬ ОКНО';
    requestAnimationFrame(() => this.resize());
  }
  notify(text) {
    const message = document.getElementById('display-status');
    message.textContent = text; message.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { message.hidden = true; }, 6500);
  }
  async toggleFullscreen() {
    if (this.busy) return;
    this.busy = true;
    const button = document.getElementById('fullscreen'); button.disabled = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (this.mode === 'focus') { this.setMode('window'); this.onExit(); }
      else if (document.documentElement.requestFullscreen && document.fullscreenEnabled) {
        await document.documentElement.requestFullscreen();
      } else {
        this.setMode('focus'); this.notify('Браузер не поддерживает полный экран. Включён режим фокуса в окне.');
      }
    } catch (_) {
      if (!document.fullscreenElement) {
        this.setMode('focus'); this.notify('Полный экран не разрешён браузером. Включён режим фокуса в окне.');
      } else this.notify('Не удалось выйти из полного экрана. Используй Esc.');
    } finally { this.busy = false; button.disabled = false; }
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    // Compact upper scenery keeps the desk visible without shrinking the keys.
    // World bounds: x 10..1190, y -5..645, including steam and impact margin.
    const scale = Math.min(width / 1180, height / 650);
    this.view = { width, height, scale, x: (width - 1180 * scale) / 2 - 10 * scale, y: (height - 650 * scale) / 2 + 5 * scale };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6000000 / (width * height)));
    const w = Math.max(1, Math.round(width * this.pixelRatio)), h = Math.max(1, Math.round(height * this.pixelRatio));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  point(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect(), v = this.view;
    return { x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale };
  }
}
window.NightDisplay = NightDisplay;
