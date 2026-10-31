'use strict';
// Procedural audio only: no downloads. A supplied OfflineAudioContext also allows
// rendering the real mixer/voices in tests, without replacing the audio API.
class NightAudio extends EventTarget {
  static defaults = { enabled: false, music: .45, effects: .7 };
  constructor({ context = null, storage, settings, automatic = true } = {}) {
    super();
    try { this.storage = storage === undefined ? window.localStorage : storage; } catch (_) { this.storage = null; }
    let saved;
    try { saved = JSON.parse(this.storage?.getItem('karakurt-audio') || 'null'); } catch (_) {}
    this.settings = { ...NightAudio.defaults };
    const input = settings || saved || {};
    if (typeof input.enabled === 'boolean') this.settings.enabled = input.enabled;
    for (const key of ['music', 'effects']) if (Number.isFinite(input[key])) this.settings[key] = Math.max(0, Math.min(1, input[key]));
    this.automatic = automatic; this.voices = new Set(); this.recent = new Map();
    this.mode = 'menu'; this.chapter = 0; this.urgent = false; this.background = false;
    this.timer = null; this.step = 0; this.nextNote = 0; this.unlocked = false; this.error = '';
    if (context) this.connect(context);
  }
  connect(context) {
    this.context = context; this.offline = typeof context.startRendering === 'function';
    this.master = context.createGain(); this.music = context.createGain(); this.effects = context.createGain();
    this.output = context.createDynamicsCompressor();
    this.output.threshold.value = -18; this.output.knee.value = 18; this.output.ratio.value = 5;
    this.output.attack.value = .003; this.output.release.value = .18;
    this.music.connect(this.master); this.effects.connect(this.master); this.master.connect(this.output); this.output.connect(context.destination);
    // A quiet, bounded echo belongs only to the music, never to warning sounds.
    this.echo = context.createDelay(1); this.echo.delayTime.value = .28;
    this.echoGain = context.createGain(); this.echoGain.gain.value = .18;
    this.music.connect(this.echo); this.echo.connect(this.echoGain); this.echoGain.connect(this.master); this.echoGain.connect(this.echo);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = this.noise.getChannelData(0); let seed = 719;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.master.gain.value = this.settings.enabled ? .8 : 0;
    this.music.gain.value = this.settings.music; this.effects.gain.value = this.settings.effects;
    this.nextNote = context.currentTime + .04;
  }
  get audible() { return !!this.context && this.settings.enabled && !this.background && (this.offline || this.context.state === 'running'); }
  get hasMusic() { return ['menu', 'ready', 'chapter', 'playing'].includes(this.mode); }
  changed() { this.dispatchEvent(new Event('change')); }
  save() { try { this.storage?.setItem('karakurt-audio', JSON.stringify(this.settings)); } catch (_) {} }
  async unlock() {
    if (!this.settings.enabled || this.background) return false;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        if (!this.context) {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) throw Error('В этом браузере нет Web Audio. Игра работает без звука.');
          this.connect(new Context());
        }
        // A fast blur/focus may arrive before suspend() has settled. Resume in
        // order, and recheck consent: the player can mute while we are waiting.
        if (this.suspending) await this.suspending;
        if (!this.settings.enabled || this.background) return false;
        if (!this.offline && this.context.state !== 'running') {
          let timeout;
          try { await Promise.race([this.context.resume(), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Нажми «Включить звук» ещё раз: браузер ждёт нажатия.')), 1800); })]); }
          finally { clearTimeout(timeout); }
        }
        if (!this.settings.enabled || this.background) { this.apply(); return false; }
        this.unlocked = true; this.error = ''; this.apply(); this.refresh(); return true;
      } catch (e) { this.error = e.message || 'Не удалось запустить звук. Попробуй ещё раз.'; return false; }
      finally { this.changed(); }
    })();
    const result = await this.pending; this.pending = null; return result;
  }
  async setEnabled(enabled) {
    this.settings.enabled = !!enabled; this.save();
    if (!enabled) { this.error = ''; this.stopAll(); this.apply(); this.changed(); return false; }
    this.changed(); return this.unlock();
  }
  setVolume(channel, value) {
    if (!['music', 'effects'].includes(channel) || !Number.isFinite(value)) return;
    this.settings[channel] = Math.max(0, Math.min(1, value)); this.save(); this.apply(); this.refresh(); this.changed();
  }
  apply() {
    if (!this.context) return;
    const t = this.context.currentTime;
    for (const [node, value] of [[this.master, this.settings.enabled && !this.background ? .8 : 0], [this.music, this.settings.music], [this.effects, this.settings.effects]]) {
      node.gain.cancelScheduledValues(t); node.gain.setTargetAtTime(value, t, .025);
    }
  }
  setMode(mode, chapter = 0, urgent = false, night = 0, situation = 'active') {
    night = Number.isInteger(night) && night >= 0 && night < 3 ? night : 0;
    const restart = mode !== this.mode || night !== this.night;
    // Within a night, keep the musical phrase and audio clock through situation changes.
    const state = `${mode}/${chapter}/${night}/${situation}/${!!urgent}/${!!this.rest}`;
    this.urgent = !!urgent; this.mode = mode; this.chapter = chapter; this.night = night; this.situation = situation;
    if (restart) { this.stopMusic(); this.refresh(); }
    if (state !== this.scoreState) { this.scoreState = state; this.changed(); }
  }
  setBackground(hidden) {
    if (this.background === hidden) return;
    this.background = hidden;
    if (hidden) {
      this.stopAll(); this.apply();
      if (this.context && !this.offline && this.context.state !== 'closed') {
        this.suspending = this.context.suspend().catch(() => {});
      }
    } else if (this.settings.enabled && this.context) void this.unlock();
    this.changed();
  }
  refresh() {
    if (!this.audible || !this.hasMusic || this.settings.music === 0) { this.stopMusic(); return; }
    if (this.automatic && this.timer === null) {
      this.nextNote = this.context.currentTime + .04; this.schedule();
      this.timer = setInterval(() => this.schedule(), 50);
    }
  }
  schedule(until = this.context.currentTime + .18) {
    if (!this.audible || !this.hasMusic || !this.settings.music) return;
    const now = this.context.currentTime;
    if (this.nextNote < now - .1) this.nextNote = now + .03; // never catch up a background tab in a burst
    while (this.nextNote < until) {
      NightScore.play(this, this.step++, this.nextNote);
      const bpm = NightScore.tempo(this);
      this.nextNote += 30 / bpm;
    }
  }
  stopMusic() { clearInterval(this.timer); this.timer = null; this.step = 0; this.stopVoices('music'); if (this.context) this.nextNote = this.context.currentTime + .04; }
  stopAll() { this.stopMusic(); this.stopVoices('effects'); this.recent.clear(); }
  stopVoices(bus) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices) if (voice.bus === bus && !voice.stopping) {
      voice.stopping = true; voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(.0001, now, .008);
      try { voice.source.stop(now + .035); } catch (_) {}
    }
  }
  voice({ frequency = 440, end, duration = .15, volume = .12, type = 'sine', at, bus = 'effects', pan = 0, attack = .006, noise = false, filter = 1800 } = {}) {
    if (!this.audible || !this.settings[bus] || this.voices.size >= 64) return false;
    const c = this.context, t = at ?? c.currentTime, source = noise ? c.createBufferSource() : c.createOscillator();
    const gain = c.createGain(), nodes = [gain];
    if (noise) {
      source.buffer = this.noise; const lowpass = c.createBiquadFilter();
      lowpass.type = 'lowpass'; lowpass.frequency.value = filter; source.connect(lowpass); lowpass.connect(gain); nodes.push(lowpass);
    } else {
      source.type = type; source.frequency.setValueAtTime(frequency, t);
      if (end) source.frequency.exponentialRampToValueAtTime(end, t + duration);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    if (c.createStereoPanner) { const stereo = c.createStereoPanner(); stereo.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(stereo); stereo.connect(this[bus]); nodes.push(stereo); }
    else gain.connect(this[bus]);
    const voice = { source, gain, bus }; this.voices.add(voice);
    source.onended = () => { source.disconnect(); nodes.forEach(n => n.disconnect()); this.voices.delete(voice); };
    source.start(t); source.stop(t + duration + .02); return true;
  }
  play(name, { col = 4, score = 0 } = {}) {
    if (!this.audible || !this.settings.effects) return false;
    const now = this.context.currentTime, gap = name === 'move' ? .055 : .07;
    if (now - (this.recent.get(name) ?? -Infinity) < gap) return false;
    this.recent.set(name, now);
    const pan = (col - 4.5) / 9, note = (f, duration = .13, volume = .12, delay = 0, type = 'sine', end) => this.voice({ frequency: f, end, duration, volume, at: now + delay, type, pan });
    const noise = (duration, volume, filter) => this.voice({ noise: true, duration, volume, filter, pan });
    const chime = (notes, speed = .1) => notes.forEach((n, i) => note(440 * 2 ** ((n - 69) / 12), .45, .12, i * speed, 'triangle'));
    switch (name) {
      case 'move': noise(.028, .12, 1600); note(160, .045, .07, 0, 'triangle', 90); break;
      case 'typo': noise(.035, .2, 2400); note(523 * 2 ** ((score % 5) / 12), .22, .16); note(1046, .11, .05, .035); break;
      case 'miss': note(150, .12, .1, 0, 'triangle', 95); break;
      case 'warning': note(659, .09, .12); note(880, .1, .12, .12); break;
      case 'sweep': note(330, .22, .1, 0, 'triangle', 660); break;
      case 'strike': noise(.12, .35, 900); note(115, .2, .23, 0, 'sine', 42); break;
      case 'hurt': noise(.22, .22, 1400); note(210, .28, .16, 0, 'triangle', 60); break;
      case 'dash': noise(.18, .15, 3300); note(330, .15, .07, 0, 'sine', 1320); break;
      case 'web': note(280, .22, .14, 0, 'triangle', 880); note(1174, .25, .07, .08); break;
      case 'block': noise(.08, .12, 4000); chime([81, 88], .065); break;
      case 'silk': chime([76, 79], .09); break;
      case 'combo': chime([76, 79, 83], .075); break;
      case 'chapter': chime([69, 72, 76, 79], .14); break;
      case 'win': this.stopVoices('effects'); chime([60, 64, 67, 72, 76, 79, 84], .17); break;
      case 'lose': this.stopVoices('effects'); chime([69, 67, 64, 57], .22); break;
      case 'start': chime([57, 64, 69], .09); break;
      case 'pause': note(440, .17, .08, 0, 'sine', 220); break;
      case 'select': note(740, .07, .08); break;
      case 'undo-warning': case 'backspace': case 'hands': chime([64, 64, 76], .09); break;
      case 'undo': note(500, .4, .12, 0, 'triangle', 180); break;
      case 'anchor': case 'undo-block': case 'objective': chime([72, 79, 84], .09); break;
      case 'charged': case 'powerdash': chime([69, 76, 81, 88], .06); break;
      case 'rest': chime([72, 67], .2); break;
      case 'sticky': noise(.09, .12, 600); break;
      case 'useweb': note(260, .1, .07); break;
      case 'saved': chime([72, 76, 79], .12); break;
      case 'storm': noise(.55, .16, 420); note(65,.5,.12,0,'sine',38); chime([74,81],.12); break;
      case 'notifications': chime([84,79,84],.09); break;
      case 'relocate': note(740,.18,.08,0,'sine',980); break;
      case 'link-lost': chime([77,74,69],.13); break;
      case 'crumb': chime([79,84,88],.07); break;
      case 'route-start': case 'route-cancel': note(587,.12,.08); break;
      case 'route-ready': chime([69,76,83],.1); break;
      case 'route-ride': note(294,.3,.1,0,'sine',1174); break;
      case 'route-empty': case 'route-faded': note(220,.15,.08); break;
      case 'near-miss': chime([83,88],.065); break;
      case 'partner-ready': case 'partner-lane': chime([72,79],.14); break;
      case 'partner-press': chime([72,76,79,84],.085); break;
      case 'partner-wait': note(440,.09,.06); break;
      case 'rain-shift': noise(.18,.07,1800); break;
      default: return false;
    }
    return true;
  }
  async dispose() {
    this.stopAll();
    if (this.context && !this.offline && this.context.state !== 'closed') await this.context.close();
  }
}
window.NightAudio = NightAudio;
