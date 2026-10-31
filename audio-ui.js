'use strict';
// Presentation only. The mixer is independent of game rules and can fail silently.
class NightAudioControls {
  constructor(audio, beforeOpen) {
    this.audio = audio;
    const el = id => document.getElementById(id), dialog = el('audio-dialog');
    this.dialog = dialog;
    // A restored preference is still a toggle, not permission to resume when
    // the player explicitly clicks «Выключить звук» before the first gesture.
    const toggle = () => { void audio.setEnabled(!audio.settings.enabled); };
    for (const id of ['sound', 'menu-sound', 'audio-toggle']) el(id).onclick = toggle;
    for (const id of ['audio-settings', 'menu-audio']) el(id).onclick = () => {
      beforeOpen(); if (!dialog.open) dialog.showModal();
    };
    el('close-audio').onclick = () => dialog.close();
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    for (const channel of ['music', 'effects']) el(`volume-${channel}`).addEventListener('input', e => audio.setVolume(channel, Number(e.target.value) / 100));
    el('audio-test').onclick = async () => {
      const ready = audio.settings.enabled ? await audio.unlock() : await audio.setEnabled(true);
      if (ready) audio.play('web');
    };
    // Browsers require a real gesture, even if sound was enabled last time.
    const activate = e => {
      if (!e.isTrusted || e.target.closest?.('#sound, #menu-sound, #audio-toggle')) return;
      if (audio.settings.enabled && (!audio.unlocked || audio.context?.state !== 'running')) void audio.unlock();
    };
    document.addEventListener('pointerdown', activate, true);
    document.addEventListener('keydown', activate, true);
    document.addEventListener('click', e => {
      if (e.target.closest?.('#menu-help, #menu-about, #close-help, #close-about, #close-audio, #to-menu, #menu-play')) audio.play('select');
    });
    const update = () => {
      const enabled = audio.settings.enabled;
      for (const id of ['sound', 'menu-sound', 'audio-toggle']) {
        const button = el(id);
        button.textContent = enabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ';
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
      }
      for (const channel of ['music', 'effects']) {
        const value = Math.round(audio.settings[channel] * 100);
        el(`volume-${channel}`).value = value; el(`level-${channel}`).textContent = `${value}%`;
      }
      const text = audio.error || (!enabled ? 'Включи звук — послушай ночную тему «03:47».' : !audio.unlocked ? 'Настройки сохранены. Нажми любую кнопку для запуска звука.' : audio.background ? 'Звук приостановлен, пока вкладка неактивна.' : audio.settings.music === 0 ? 'Музыка выключена в микшере. Эффекты настраиваются отдельно.' : audio.hasMusic ? NightScore.title(audio) : 'Музыка на паузе. Можно спокойно выдохнуть.');
      el('audio-status').textContent = text; el('menu-track-text').textContent = text;
      el('menu-track').classList.toggle('is-playing', audio.audible && audio.hasMusic && audio.settings.music > 0);
    };
    audio.addEventListener('change', update); update();
  }
}
window.NightAudioControls = NightAudioControls;
