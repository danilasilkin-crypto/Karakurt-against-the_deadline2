'use strict';
// Elements are static, so each lookup is cached (sync() runs every frame).
const domCache = new Map();
const $ = id => { let el = domCache.get(id); if (!el) { el = document.getElementById(id); domCache.set(id, el); } return el; };
const canvas = $('board'), ctx = canvas.getContext('2d'), game = new NightJourney();
const letters = NightScene.letters, keyPos = NightScene.keyPos;
let facing = [0, 1], last = 0, moveTimer = 0, dashCycle = 0, shownDashPercent = -1;
const sound = new NightAudio();
let held = new Set(), lastPhase = null;
// Leaving fullscreen (Esc or button) must not let the timer run unseen.
const display = new NightDisplay(canvas, () => { if (game.phase === 'playing') pause(); });
const scene = new NightScene(display);
let campaignSave = null, unlocked = false, medals = [], arcadeBest = 0, completedNights = [], selectedNight = 0;
try {
  const saved = JSON.parse(localStorage.getItem('karakurt-campaign') || 'null');
  if (saved?.version === 1) {
    const probe = new NightJourney();
    if (probe.restore(saved.checkpoint)) campaignSave = saved.checkpoint;
    unlocked = saved.unlocked === true;
    // Legacy victories unlock the second night; old checkpoints belong to night one.
    completedNights = Array.isArray(saved.completedNights) ? [...new Set(saved.completedNights.filter(n => Number.isInteger(n) && n>=0 && n<3))] : unlocked ? [0] : [];
    medals = Array.isArray(saved.medals) ? saved.medals.filter(m => ['Человек сохранён','Тихий спасатель','Мастер паутины','До рассвета'].includes(m)) : [];
    arcadeBest = Number.isFinite(saved.arcadeBest) ? Math.max(0, Math.floor(saved.arcadeBest)) : 0;
  }
} catch (_) { /* Storage is optional. */ }
function saveCampaign() {
  try { localStorage.setItem('karakurt-campaign', JSON.stringify({version:1, checkpoint:campaignSave, unlocked, medals, arcadeBest, completedNights})); } catch (_) {}
}
// Writes to the DOM only when the value really changed; the last shown value is remembered.
const shown = new Map();
const setText = (id, value) => { const text = String(value); if (shown.get(id) !== text) { shown.set(id, text); $(id).textContent = text; } };
const setDisabled = (el, value) => { if (el.disabled !== value) el.disabled = value; };
const directionButtons = [...document.querySelectorAll('[data-direction]')], chapterItems = [...document.querySelectorAll('.chapters li')];
const guide = $('guide-dialog'), about = $('about-dialog');
const menu = new NightMenu($('menu'), $('menu-canvas'), () => display.reducedMotion);
// While the menu covers the page, the game underneath must not be reachable by Tab or screen readers.
function setMenu(open) {
  if (open) menu.show(); else menu.hide();
  sound.setMode(open ? 'menu' : game.phase, game.chapter, false, open ? selectedNight : game.night);
  for (const el of document.querySelectorAll('.topbar, main')) el.inert = open;
  if (open) $('menu-play').focus({ preventScroll: true });
}
const nightButtons = [...document.querySelectorAll('[data-night]')];
function updateMenuRecord() {
  nightButtons.forEach((button,n) => {
    button.disabled=n>0 && !completedNights.includes(n-1);
    button.setAttribute('aria-pressed', String(n===selectedNight));
    button.querySelector('small').textContent=completedNights.includes(n) ? 'ПРОЙДЕНО · ПЕРЕИГРАТЬ' : button.disabled ? `ПОСЛЕ НОЧИ ${n}` : 'ДОСТУПНА';
  });
  setText('night-description', NightEpisodes[selectedNight].description);
  setText('menu-record', `3 ночи × 5 глав · пройдено ${completedNights.length}/3${unlocked ? ` · аркада: ${arcadeBest}` : ''}`);
  $('menu-continue').hidden = !campaignSave; $('menu-arcade').hidden = !unlocked;
  setText('menu-continue', `ПРОДОЛЖИТЬ · НОЧЬ ${(campaignSave?.night ?? 0)+1} · ГЛАВА ${(campaignSave?.level ?? 0)+1}`);
  setText('menu-medals', medals.length ? `Медали: ${medals.join(' · ')}` : 'Пройди историю, чтобы открыть аркаду «Ещё один фикс».');
}
let shownProgress = -1, shownLives = -1, shownUrgent = null, shownCombo = null, shownChapter = -1, shownWon = null;
const soundControls = new NightAudioControls(sound, () => { if (game.phase === 'playing') pause(); held.clear(); });
function say(speaker, line) { setText('speaker', speaker); setText('line', line); $('speaker').parentElement.parentElement.classList.toggle('human', speaker.startsWith('ЛЁША')); }
function move(dr, dc) { facing = [dr, dc]; if (game.move(dr, dc)) sound.play('move', game); events(); sync(); }
function typo() { game.typo(); events(); sync(); }
function dash() { game.dash(...facing); events(); sync(); }
function weave() { game.weave(); events(); sync(); }
function sync() {
  const active = game.phase === 'playing';
  sound.rest = !menu.visible && game.respite;
  sound.combo = active ? game.combo : 0;
  sound.threat = active && game.strikes.some(s=>!s.hit && s.delay-s.age<.6);
  sound.partner = active && !!game.coopCue;
  sound.setMode(menu.visible ? 'menu' : game.phase === 'won' ? 'menu' : game.phase, game.chapter, game.time <= 15, menu.visible ? selectedNight : game.night, menu.visible ? 'calm' : game.phase === 'won' ? 'ending' : game.hunting ? 'chase' : game.threadMission ? 'weave' : game.chapter === 4 ? 'final' : 'active');
  setText('night-clock', ['03:47','02:16','23:08'][game.night]);
  setText('night-caption', `НОЧЬ ${game.night+1} · ${game.episode.name.toUpperCase()}`);
  setText('score', game.score); setText('time', Math.ceil(game.time));
  const urgent = game.time <= 15;
  if (urgent !== shownUrgent) { shownUrgent = urgent; $('time').classList.toggle('urgent', urgent); }
  setText('lives', '● '.repeat(game.lives).trim() + ' ○'.repeat(3 - game.lives));
  if (game.lives !== shownLives) { shownLives = game.lives; $('lives').setAttribute('aria-label', `Осталось жизней: ${game.lives}`); }
  if (game.progress !== shownProgress) { shownProgress = game.progress; $('progress').style.width = `${game.progress * 100}%`; }
  setText('score-label', game.mode === 'arcade' ? ' ошибок · рекорд ' + arcadeBest : ` действий · глава ${game.chapter+1}/5`);
  setText('charge', game.charge === 6 ? '8 ЛАП: РЫВОК УСИЛЕН' : `8 ЛАП: ${game.charge}/6`);
  $('charge').classList.toggle('active', game.charge === 6);
  setText('event-state', game.undo ? `CTRL+Z · Z + E · ${Math.ceil(game.undo.left)}с` : game.respite ? 'ПЕРЕДЫШКА · ДЕЙСТВУЙ' : game.mode === 'arcade' ? 'ЕЩЁ ОДИН ФИКС' : `НОЧЬ ${game.night+1} · ${NightStory.chapterFor(game).name.toUpperCase()}`);
  setText('typo', game.threadMission || game.hunting ? 'НУЖНА ПАУТИНА · E' : `${game.actionLabel} · SPACE`);
  setText('dash', game.cooldown > 0 ? `РЫВОК · ${game.cooldown.toFixed(1)}с` : 'РЫВОК · SHIFT');
  const cooling = game.cooldown > 0;
  if (!cooling) dashCycle = 0;
  else dashCycle = Math.max(dashCycle, game.cooldown);
  setText('dash-time', cooling ? `${game.cooldown.toFixed(1)} с` : game.charge === 6 ? 'УСИЛЕН' : 'ГОТОВ');
  $('dash-status').classList.toggle('cooling', cooling);
  $('dash-status').setAttribute('aria-label', cooling ? `Рывок: откат ${Math.ceil(game.cooldown)} с` : game.charge === 6 ? 'Усиленный рывок готов' : 'Рывок готов');
  const dashPercent = cooling ? Math.round(100 * (1 - game.cooldown / dashCycle)) : 100;
  if (dashPercent !== shownDashPercent) { shownDashPercent = dashPercent; $('dash-progress').style.width = `${dashPercent}%`; }
  setDisabled($('dash'), !active || game.cooldown > 0);
  setDisabled($('typo'), !active);
  const missionThread = (game.threadMission && game.row === game.target.row && game.col === game.target.col) || (game.undo && game.row === game.undo.row && game.col === game.undo.col);
  setDisabled($('web'), !active || (!missionThread && !game.routeStart && !game.webs.some(w => w.row === game.row && w.col === game.col) && game.silk <= 0));
  setText('web', game.routeStart ? 'СОЕДИНИТЬ НИТЬ · E' : game.webs.some(w=>w.row===game.row && w.col===game.col) ? 'НАЧАТЬ МАРШРУТ · E' : 'ПАУТИНА · E');
  setText('route-status', game.routeHint + (game.threadRoute ? ` · ${Math.ceil(game.threadRoute.life)}с` : ''));
  for (const b of directionButtons) setDisabled(b, !active);
  setText('silk', `${game.silk} / 3`);
  setText('combo', `СЕРИЯ ×${game.combo}${game.combo ? ` · ${game.comboTimer.toFixed(1)}с` : ''}`);
  const hot = game.combo >= 3;
  if (hot !== shownCombo) { shownCombo = hot; $('combo').classList.toggle('active', hot); }
  setText('position', letters[game.row][game.col]); setText('target-key', letters[game.target.row][game.target.col]);
  setText('objective', game.coopCue ? `ОТОЙДИ С ${letters[game.coopCue.row][game.coopCue.col]} · ЛЁША ЖДЁТ ${game.coopCue.left.toFixed(1)}с` : game.objective.toUpperCase());
  if(game.finale) setText('event-state', game.atmosphere);
  setText('target-key', game.hunting ? 'КРАСНАЯ + E' : letters[game.target.row][game.target.col]);
  const won = game.phase === 'won';
  if (game.chapter !== shownChapter || won !== shownWon) {
    shownChapter = game.chapter; shownWon = won;
    chapterItems.forEach((el, i) => {
      el.textContent = `${String(i+1).padStart(2,'0')}  ${(game.night ? game.episode.chapters : NightStory.chapters)[i].name}`;
      if (i === game.chapter) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      el.classList.toggle('complete', i < game.chapter || won);
    });
  }
  if (game.phase !== lastPhase) { lastPhase = game.phase; showPhase(); }
}
function setCard(card) {
  setText('overline', card.tag); setText('title', card.title); setText('description', card.text);
}
function showPhase() {
  const playing = game.phase === 'playing'; $('overlay').hidden = playing; $('pause').hidden = !playing;
  $('to-menu').hidden = !['paused', 'won', 'lost'].includes(game.phase);
  $('next-night').hidden = !(game.phase === 'won' && game.mode === 'campaign' && game.night < NightEpisodes.length-1);
  $('results').hidden = true; $('rules').hidden = game.phase !== 'ready' || game.night > 0;
  if (playing) return;
  held.clear();
  if (game.phase === 'ready' || game.phase === 'chapter') {
    const chapter = NightStory.chapterFor(game); setCard(chapter); setText('start', chapter.button);
    say(chapter.voice, chapter.line);
    setText('record', game.phase === 'ready' ? '5 глав · разные задачи · контрольные точки' : 'Глава сохранена. Время остановлено — продолжай, когда будешь готов.');
    if (game.phase === 'chapter' && game.mode === 'campaign') { campaignSave = game.checkpoint; saveCampaign(); updateMenuRecord(); }
    if (game.phase === 'chapter') $('start').focus({ preventScroll: true });
    return;
  }
  if (game.phase === 'paused') {
    setCard({ tag: 'ТИШЕ. ОН НИЧЕГО НЕ ЗАМЕТИЛ.', title: 'Перерыв на паутинку.', text: 'Время, удары и ловушки замерли. Выдохни, расправь лапы и возвращайся. E — паутина на текущей клавише; Shift — рывок; пробел — опечатка на мятной цели.' });
    setText('start', 'ПРОДОЛЖИТЬ ↗'); setText('record', 'P / Esc — вернуться к игре');
  } else {
    if (game.mode === 'arcade') arcadeBest = Math.max(arcadeBest, game.score);
    if (game.phase === 'won' && game.mode === 'campaign') {
      unlocked = true; campaignSave = null; medals = [...new Set([...medals, ...game.medals()])];
      completedNights = [...new Set([...completedNights, game.night])];
    }
    saveCampaign(); updateMenuRecord();
    const ending = NightStory.ending(game); setCard(ending); say(ending.voice, ending.line);
    $('results').hidden = false; $('results').replaceChildren();
    for (const [value, label] of [[game.score, 'действия'], [`×${game.maxCombo}`, 'лучшая серия'], [game.blocked, 'перехваты'], [`${Math.ceil(game.elapsed)}с`, 'активное время']]) {
      const stat = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('span');
      strong.textContent = value; small.textContent = label; stat.append(strong, small); $('results').append(stat);
    }
    setText('start', game.phase === 'lost' && game.mode === 'campaign' ? `ПОВТОРИТЬ ГЛАВУ ${game.chapter+1} ↗` : game.mode === 'campaign' ? 'ПЕРЕИГРАТЬ ЭТУ НОЧЬ ↗' : 'ЕЩЁ ОДИН ЗАБЕГ ↗');
    setText('record', game.phase === 'won' ? `Медали: ${game.medals().join(' · ')}` : game.mode === 'arcade' ? `Рекорд аркады: ${arcadeBest}` : 'Начало главы сохранено. Панцирь и таймер восстановятся.');
    sound.play(game.phase === 'won' ? 'win' : 'lose');
  }
  $('start').focus({ preventScroll: true });
}
function events() {
  for (const event of game.events.splice(0)) {
    scene.onEvent(event, game);
    sound.play(event, game);
    if (event === 'typo') {
      setText('log', [`SyntaxError: unexpected spider at line ${game.score * 17}`, 'build failed: слишком много лап в аргументах', 'git commit -m "почему оно опять не работает"'][game.score % 3]);
      if (NightStory.beats[game.score]) say(...NightStory.beats[game.score]);
    }
    const newMessages={'route-start':'Начало нити закреплено. Перейди на другую клавишу и нажми E: стоимость — одна нить.', 'route-cancel':'Начало маршрута отменено. Шёлк не потрачен.', 'route-empty':'Нет шёлка на соединение. Дождись восстановления или нажми E у начала для отмены.', 'route-ready':'Путь готов на 18 секунд! Shift на любом конце переносит к другому.', 'route-ride':'По своей нити — прямо к выходу.', 'route-faded':'Нить-путь истончилась. Можно проложить новую.', 'near-miss':'НА ВОЛОСКЕ! Позднее уклонение: +1 заряд рывка.', 'partner-ready':'Теперь отойди с мятной клавиши. Лёша нажмёт её сам — через 1,8 секунды свободного прохода.', 'partner-wait':'Лёша ждёт. Освободи отмеченную клавишу.', 'partner-press':'Лёша нажимает клавишу: «Спасибо, напарник». Следующая — за тобой.', 'partner-lane':'Лёша оставляет весь ряд цели свободным. Человек теперь помогает.', 'rain-shift':'Капли сменили маршрут. Синие лужицы тормозят, но не запирают путь.'};
    if(newMessages[event]) setText('log',newMessages[event]);
    if(event==='partner-press') say('ЛЁША · РАЗРАБОТЧИК','Я понял. Ты показываешь — я нажимаю. Вместе.');
    if (event === 'miss') setText('log', `Нужна клавиша ${letters[game.target.row][game.target.col]} — она подсвечена мятным.`);
    if (event === 'hurt') setText('log', 'Панцирь треснул. Серия сброшена. Уходи с красного!');
    if (event === 'web') setText('log', 'Паутина натянута на 6 секунд. Один удар — за её счёт.');
    if (event === 'block') setText('log', 'Палец запутался! Паутина поглотила удар.');
    if (event === 'silk') setText('log', 'Ещё одна нить! Шёлк пополняется каждые 5 секунд и за 4 опечатки.');
    if (event === 'combo') setText('log', `Серия ×${game.combo}! Автосборка отложена — до +3 секунд.`);
    if (event === 'sweep') setText('log', 'ШИРОКИЙ УДАР! Уходи в другой ряд клавиш.');
    const messages = { 'undo-warning':'CTRL+Z: успей на Z и нажми E! Осталось 7 секунд.', 'undo-block':'Отмена заблокирована. Две ошибки спасены!', undo:'Лёша исправил две ошибки этой главы.', anchor:'Крепление готово! Кружка держится на твоей нити.', hands:'ДВЕ РУКИ: свободный ряд без красных меток — твой выход.', backspace:'BACKSPACE: опасность движется влево. Смени ряд!', rest:'Лёша потянулся за кофе. Шесть секунд без новых атак!', charged:'ВОСЬМИЛАПЫЙ РЕЖИМ: следующий Shift оставит защитную нить.', powerdash:'Усиленный рывок! Нить защищает весь пройденный путь.', sticky:'Лапы прилипли на миг. Shift вытаскивает из кофе.', useweb:'Здесь нужна паутина: нажми E, не пробел.', objective:'Действие выполнено. Следующая цель подсвечена.', saved:'Черновик сохранён. Автосборка выключена. До утра!' };
    const nightMessages = {storm:'ГРОЗА: красный столбец! Уходи вбок.', notifications:'УВЕДОМЛЕНИЯ: два столбца. Найди свободный проход.', 'link-lost':'Связь потеряна. Переплети маршрут с первого узла.', relocate:'Фрагмент сменил место. Собранный прогресс остался.', crumb:'Крошка! До +4 секунд и +2 заряда рывка.', anchor:'Узел закреплён. Следующая точка подсвечена.', rest:'Шесть секунд без новых атак. Золотая крошка даёт время и заряд.', sticky:'Вода тормозит лапы. Shift освобождает.', saved:'Работа сохранена. До утра!'};
    if (game.night && nightMessages[event]) setText('log', nightMessages[event]);
    else if (messages[event]) setText('log', messages[event]);
    if (game.night && ['anchor','objective','rest','storm','notifications','saved'].includes(event)) say('ТОЧКА · КАРАКУРТ', NightStory.chapterFor(game).line);
    else if (NightStory.signals[event]) say(...NightStory.signals[event]);
  }
}
function start() {
  held.clear(); moveTimer = 0;
  if (game.phase === 'paused') game.pause();
  else if (game.phase === 'chapter') { game.continueChapter(); setText('log', NightStory.chapterFor(game).threat); }
  else if (game.phase === 'lost' && game.mode === 'campaign') { game.retry(); campaignSave = game.checkpoint; saveCampaign(); scene.reset(game); setText('log', NightStory.chapterFor(game).threat); }
  else {
    game.start(game.mode); facing = [0, 1]; scene.reset(game);
    if (game.mode === 'campaign') { campaignSave = game.checkpoint; saveCampaign(); updateMenuRecord(); }
    const chapter = NightStory.chapterFor(game);
    say(chapter.voice, chapter.line); setText('log', chapter.threat);
  }
  sync(); sound.play('start'); canvas.focus({ preventScroll: true });
}
function pause() {
  const before = game.phase; game.pause(); held.clear(); sync();
  if (game.phase !== before) sound.play(game.phase === 'playing' ? 'start' : 'pause');
  if (game.phase === 'playing') canvas.focus({ preventScroll: true });
}
$('start').onclick = start; $('pause').onclick = pause;
for (const [id, action] of [['typo', typo], ['dash', dash], ['web', weave]]) $(id).onclick = () => { action(); if (game.phase === 'playing') canvas.focus({ preventScroll: true }); };
// Audio controls and persisted mixer settings live in audio-ui.js.
const directions = { KeyW: [-1, 0], ArrowUp: [-1, 0], KeyS: [1, 0], ArrowDown: [1, 0], KeyA: [0, -1], ArrowLeft: [0, -1], KeyD: [0, 1], ArrowRight: [0, 1] };
// Field guide: opening it pauses the run; the dialog closes by Esc (native), the close button or a click on the backdrop.
$('help').onclick = () => {
  if (game.phase === 'playing') pause();
  held.clear();
  if (typeof guide.showModal === 'function' && !guide.open) guide.showModal(); else guide.setAttribute('open', '');
};
$('close-help').onclick = () => guide.close();
guide.addEventListener('click', e => { if (e.target === guide) guide.close(); });
// Main menu: Play goes to the chapter card (story + rules); "В меню" abandons the current run.
function openNight(night) {
  if (night > 0 && !completedNights.includes(night-1)) return;
  selectedNight = night; game.prepare(night); lastPhase = null; shownChapter = -1;
  scene.reset(game); updateMenuRecord(); setMenu(false); sync(); $('start').focus({preventScroll:true});
}
nightButtons.forEach((button,n) => { button.onclick = () => {
  if (button.disabled) return;
  selectedNight=n; updateMenuRecord(); sync(); sound.play('select');
}; });
$('menu-play').onclick = () => openNight(selectedNight);
$('next-night').onclick = () => { if(game.phase==='won') openNight(game.night+1); };
$('menu-continue').onclick = () => {
  if (!game.restore(campaignSave)) return;
  selectedNight=game.night; shownChapter=-1;
  scene.reset(game); lastPhase = null; setMenu(false); sync(); $('start').focus({ preventScroll: true });
};
$('menu-arcade').onclick = () => {
  if (!unlocked) return;
  game.start('arcade'); scene.reset(game); lastPhase = null; setMenu(false); sync();
  setText('log','90 секунд. Опечатки, серии и знакомые угрозы. Каждые 25 секунд — новая волна.'); canvas.focus({preventScroll:true});
};
$('menu-help').onclick = () => $('help').click();
$('menu-about').onclick = () => { if (typeof about.showModal === 'function' && !about.open) about.showModal(); else about.setAttribute('open', ''); };
$('close-about').onclick = () => about.close();
about.addEventListener('click', e => { if (e.target === about) about.close(); });
$('to-menu').onclick = () => { held.clear(); game.reset(); scene.reset(game); sync(); setMenu(true); };
// Menu toggles drive the real toolbar buttons and mirror their label and state.
for (const [source, copy] of [['motion', 'menu-motion'], ['fullscreen', 'menu-fullscreen']]) {
  const from = $(source), to = $(copy);
  const mirror = () => { to.textContent = from.textContent.replace(/\s+/g, ' ').trim(); to.setAttribute('aria-pressed', from.getAttribute('aria-pressed') || 'false'); to.title = from.title; };
  new MutationObserver(mirror).observe(from, { childList: true, subtree: true, characterData: true, attributes: true });
  to.onclick = () => from.click(); mirror();
}
updateMenuRecord(); setMenu(true);
window.addEventListener('keydown', e => {
  if (guide.open || about.open || soundControls.dialog.open) return; // keys belong to the dialog while it is open
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'KeyF' && !e.repeat && e.target.tagName !== 'INPUT') { e.preventDefault(); display.toggleFullscreen(); return; }
  if (menu.visible) { if (e.code === 'Enter' && !e.repeat && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('menu-play').click(); } return; }
  if (['KeyP', 'Escape'].includes(e.code)) { if (!e.repeat) pause(); e.preventDefault(); return; }
  if (game.phase !== 'playing' || (!(e.code in directions) && !['Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(e.code))) return;
  if (e.code === 'Space' && e.target.tagName === 'BUTTON') return;
  e.preventDefault(); if (e.repeat) return;
  if (directions[e.code]) { held.add(e.code); move(...directions[e.code]); moveTimer = .16; }
  else if (e.code === 'Space') typo(); else if (e.code === 'KeyE') weave(); else dash();
});
window.addEventListener('keyup', e => held.delete(e.code));
window.addEventListener('blur', () => { sound.setBackground(true); held.clear(); if (game.phase === 'playing') pause(); });
window.addEventListener('focus', () => sound.setBackground(document.hidden));
document.addEventListener('visibilitychange', () => {
  sound.setBackground(document.hidden || !document.hasFocus());
  if (document.hidden && game.phase === 'playing') pause();
});
window.addEventListener('pagehide', () => sound.setBackground(true));
window.addEventListener('pageshow', () => sound.setBackground(document.hidden));
canvas.addEventListener('pointerdown', e => {
  if (game.phase !== 'playing') return;
  const { x, y } = display.point(e.clientX, e.clientY);
  let nearest, distance = Infinity;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) { const p = keyPos(r, c), d = Math.hypot(p.x - x, p.y - y); if (d < distance) { nearest = [r, c]; distance = d; } }
  if (distance > 65) return;
  const [r, c] = nearest;
  if (r === game.row && c === game.col) typo(); else if (r !== game.row) move(Math.sign(r - game.row), 0); else move(0, Math.sign(c - game.col));
  if (game.phase === 'playing') canvas.focus({ preventScroll: true });
});
document.querySelectorAll('[data-direction]').forEach(button => {
  const code = button.dataset.direction;
  button.addEventListener('pointerdown', e => {
    if (game.phase !== 'playing') return;
    e.preventDefault(); button.setPointerCapture(e.pointerId); held.add(code); move(...directions[code]); moveTimer = .2;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => held.delete(code));
  button.onclick = e => { if (e.detail === 0) move(...directions[code]); };
});
function frame(now) {
  const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
  if (game.phase === 'playing') { moveTimer -= dt; if (moveTimer <= 0 && held.size) { const code = [...held].at(-1); move(...directions[code]); moveTimer = .13; } game.tick(dt); events(); sync(); }
  scene.update(game.phase === 'paused' ? 0 : dt, game); scene.draw(ctx, game); requestAnimationFrame(frame);
}
sync();
requestAnimationFrame(frame);
