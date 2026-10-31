'use strict';
// Called in the actual game document by the integration runner. No API mocks.
// Check assets before the long gameplay scenario; exercise the actual lazy image.
async function runPreviewUITest(test, assert) {
  await test('Превью доступно в «Об игре»; оба PNG настоящего размера, метаданные подключены', async () => {
    $('menu-about').click();
    try {
      const image = document.querySelector('.cover-preview img');
      image.scrollIntoView({ block: 'center' });
      await new Promise((resolve, reject) => {
        if (image.complete && image.naturalWidth) { resolve(); return; }
        const cleanup = () => { clearTimeout(timeout); image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(Error(`Ошибка загрузки превью: ${image.currentSrc || image.src}`)); };
        const timeout = setTimeout(() => { cleanup(); reject(Error('Превью не загрузилось за 5 секунд')); }, 5000);
        image.addEventListener('load', loaded); image.addEventListener('error', failed);
      });
      await image.decode();
      assert(image.naturalWidth === 1200 && image.naturalHeight === 630);
      const card = new Image(); card.src = 'assets/jam-cover.png'; await card.decode();
      assert(card.naturalWidth === 630 && card.naturalHeight === 500);
      assert(document.querySelector('meta[property="og:image"]').content.endsWith('assets/preview.png'));
      assert(document.querySelector('meta[name="twitter:card"]').content === 'summary_large_image');
    } finally { $('close-about').click(); }
  });
}
async function runAudioUITests(test, assert, wait, key) {
  const settings = { ...sound.settings };
  let stored, canStore = false;
  try { stored = localStorage.getItem('karakurt-audio'); canStore = true; } catch (_) {}
  try {
    await test('Сохранённый звук можно выключить первым нажатием, не запуская музыку', async () => {
      await sound.setEnabled(false);
      sound.settings.enabled = true; sound.unlocked = false; sound.changed();
      $('sound').click();
      assert(!sound.settings.enabled && $('sound').getAttribute('aria-pressed') === 'false');
      assert($('menu-sound').getAttribute('aria-pressed') === 'false');
    });
    await test('Микшер открывается из игры: пауза, изоляция клавиш и ручное продолжение', () => {
      if (menu.visible) $('menu-play').click();
      if (game.phase !== 'playing') start();
      const score = game.score, col = game.col;
      $('audio-settings').click();
      assert(soundControls.dialog.open && game.phase === 'paused');
      key('ArrowLeft'); key('Space');
      assert(game.score === score && game.col === col, 'Действие игры сработало внутри микшера');
      $('close-audio').click();
      assert(!soundControls.dialog.open && game.phase === 'paused');
    });
    await test('Ползунки обновляют независимые дорожки, подписи и сохранённые настройки', () => {
      for (const [channel, value] of [['music', 23], ['effects', 61]]) {
        const range = $(`volume-${channel}`); range.value = value;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        assert(sound.settings[channel] === value / 100 && $(`level-${channel}`).textContent === `${value}%`);
      }
      if (canStore) {
        const saved = JSON.parse(localStorage.getItem('karakurt-audio'));
        assert(saved.music === .23 && saved.effects === .61);
      }
      const restore = new NightAudio({ storage: canStore ? localStorage : null, settings: canStore ? undefined : sound.settings });
      assert(restore.settings.music === .23 && restore.settings.effects === .61 && !restore.context);
    });
    await test('Web Audio запускается; меню планирует тему, пауза останавливает планировщик', async () => {
      sound.setBackground(false);
      $('to-menu').click();
      assert(menu.visible && sound.mode === 'menu');
      const ok = await sound.setEnabled(true);
      assert(ok && sound.context.state === 'running', sound.error || 'AudioContext не запущен');
      await wait(160);
      assert(sound.timer !== null && sound.voices.size > 0 && $('menu-track').classList.contains('is-playing'));
      $('menu-play').click(); $('start').click();
      assert(sound.mode === 'playing' && sound.timer !== null);
      $('pause').click();
      assert(sound.mode === 'paused' && sound.timer === null);
    });
    await test('Быстрые blur/focus не оставляют контекст приостановленным и не возобновляют игру', async () => {
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
      await wait(180);
      assert(!sound.background && sound.context.state === 'running', `Состояние: ${sound.context.state}`);
      assert(game.phase === 'paused' && sound.timer === null);
      $('to-menu').click();
      await wait(120); assert(sound.timer !== null && sound.mode === 'menu');
      window.dispatchEvent(new Event('blur'));
      await wait(150);
      assert(sound.context.state === 'suspended' && sound.timer === null);
      window.dispatchEvent(new Event('focus'));
      await wait(180);
      assert(sound.context.state === 'running' && sound.timer !== null);
    });
    await test('Музыка 0% останавливает планирование; mute очищает голоса и зеркалится в меню', async () => {
      sound.setVolume('music', 0);
      assert(sound.timer === null && sound.settings.effects === .61);
      await wait(100);
      assert(![...sound.voices].some(v => v.bus === 'music'));
      sound.setVolume('music', .23); assert(sound.timer !== null);
      $('menu-sound').click(); await wait(140);
      assert(!sound.settings.enabled && sound.timer === null && !sound.voices.size);
      assert($('sound').getAttribute('aria-pressed') === 'false' && $('audio-toggle').getAttribute('aria-pressed') === 'false');
    });
  } finally {
    if (soundControls.dialog.open) soundControls.dialog.close();
    if (about.open) about.close();
    await sound.setEnabled(false);
    sound.setVolume('music', settings.music); sound.setVolume('effects', settings.effects);
    // Restore the preference without starting unsolicited sound after the suite.
    sound.settings.enabled = settings.enabled; sound.unlocked = false; sound.changed();
    if (canStore) { try { if (stored === null) localStorage.removeItem('karakurt-audio'); else localStorage.setItem('karakurt-audio', stored); } catch (_) {} }
  }
}
