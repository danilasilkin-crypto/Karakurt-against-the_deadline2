'use strict';
// Executes in the real game document. Only user input is simulated; rules are untouched.
(async () => {
  const panel = document.createElement('section');
  // Floating, so the test report does not change the layout under test.
  panel.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:50;width:min(560px,96vw);max-height:46vh;overflow:auto;padding:14px 18px;border:1px solid #526477;font:12px/1.5 monospace;background:#11151cf5;color:#bbf880';
  panel.innerHTML = '<h2>Проверки интерфейса</h2><ol id="ui-results"></ol><strong id="summary">Выполняется…</strong><p><a href="index.html" style="color:#bbf880">Вернуться к игре</a></p>';
  document.body.prepend(panel);
  const output = document.querySelector('#ui-results');
  let passed = 0, failed = 0, saved, canStore = false;
  try { saved = localStorage.getItem('karakurt-campaign'); canStore = true; } catch (_) {}
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const assert = (condition, message = 'Нарушено условие') => { if (!condition) throw Error(message); };
  const test = async (name, fn) => {
    const li = document.createElement('li');
    try { await fn(); li.textContent = `PASS — ${name}`; passed++; }
    catch (e) { li.textContent = `FAIL — ${name}: ${e.message}`; li.style.color = '#ff766a'; failed++; }
    output.append(li);
  };
  const key = code => {
    const element = document.activeElement || canvas;
    element.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  };
  const scoreUntil = count => {
    for (let n = 0; game.score < count && n < 100; n++) {
      assert(game.phase === 'playing', `Фаза: ${game.phase}`);
      for (let r = 0; game.row !== game.target.row && r < 3; r++) key(game.row < game.target.row ? 'ArrowDown' : 'ArrowUp');
      for (let c = 0; game.col !== game.target.col && c < 10; c++) key(game.col < game.target.col ? 'ArrowRight' : 'ArrowLeft');
      key('Space');
    }
    assert(game.score === count, `Ожидалось ${count}, получено ${game.score}`);
  };
  try {
    await runPreviewUITest(test, assert);
    await test('Главное меню открыто при загрузке; «Начать ночь» открывает вступление главы', () => {
      assert(menu.visible && !$('menu').hidden, 'Меню не показано');
      assert($('menu').textContent.includes('Каракурт') && $('menu').textContent.includes('ПАУК ПРОТИВ ЧЕЛОВЕКА'));
      assert(document.querySelector('main').inert && document.querySelector('.topbar').inert, 'Игра под меню доступна');
      assert(game.phase === 'ready');
      $('menu-play').click();
      assert($('menu').hidden && !document.querySelector('main').inert && !$('overlay').hidden && game.phase === 'ready');
    });
    await test('Вступление и выключенные до старта действия', () => {
      assert($('title').textContent.includes('Он спас тебя.')); assert($('typo').disabled && $('web').disabled);
      assert(!$('rules').hidden && !$('overlay').hidden);
    });
    await test('Старт, пробел, WASD и рывок через реальные обработчики', () => {
      $('start').click(); assert(game.phase === 'playing' && $('overlay').hidden);
      key('Space'); assert($('score').textContent === '1');
      key('KeyD'); assert($('position').textContent === 'H');
      key('ShiftLeft'); assert(game.col === 7 && $('dash').disabled);
      key('KeyW'); assert($('position').textContent === 'I');
    });
    await test('Нижние кнопки скрыты, откат рывка перенесён в HUD и замерзает на паузе', async () => {
      assert(document.querySelector('.touch').hidden && document.querySelector('.touch').getBoundingClientRect().height===0);
      assert($('dash-status').closest('.hud') && $('dash-status').getBoundingClientRect().height>0);
      assert(game.cooldown>0 && $('dash-time').textContent.includes('с') && $('dash-status').classList.contains('cooling'));
      key('KeyP'); const value=$('dash-time').textContent;
      await wait(120); assert($('dash-time').textContent===value);
      $('start').click();
      const until=performance.now()+4000;
      while(game.cooldown>0 && performance.now()<until) await wait(40);
      assert(game.cooldown===0 && $('dash-time').textContent==='ГОТОВ');
      assert($('dash-progress').style.width==='100%');
    });
    await test('Паутина и начало маршрута через E: расход и отмена без дубля', () => {
      key('KeyE'); assert(game.webs.length === 1 && $('silk').textContent === '1 / 3' && !$('web').disabled);
      key('KeyE'); assert(game.routeStart && game.webs.length===1 && game.silk===1);
      assert($('web').textContent.includes('СОЕДИНИТЬ'));
      key('KeyE'); assert(!game.routeStart && game.webs.length===1 && game.silk===1);
    });
    await test('Пауза замораживает таймеры; продолжение запускает кадры', async () => {
      key('KeyP'); const before = game.time, life = game.webs[0].life;
      await wait(150); assert(game.time === before && game.webs[0].life === life && game.phase === 'paused');
      $('start').click(); assert(game.phase === 'playing', 'Кнопка не возобновила игру');
      await wait(150); assert(game.phase === 'playing' && game.time < before, `Фаза после ожидания: ${game.phase}`);
    });
    await test('Удержание стрелки двигает паука, отпускание останавливает', async () => {
      assert(game.phase === 'playing');
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true, cancelable: true }));
      await wait(280);
      canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', bubbles: true }));
      const col = game.col; assert(col < 6);
      await wait(120); assert(game.col === col);
    });
    await test('Восемь опечаток открывают главу 2, чтение не тратит время', async () => {
      scoreUntil(8); assert(game.phase === 'chapter' && $('overline').textContent.includes('ГЛАВА 02') && $('rules').hidden);
      const before = game.time; await wait(120); assert(game.time === before);
      $('start').click(); assert(game.phase === 'playing' && game.chapter === 1);
    });
    await test('Кампания: кофе, четыре настоящих перехвата, финал и открытие аркады через ввод', async () => {
      scoreUntil(18); assert(game.phase === 'chapter' && game.chapter === 2);
      $('start').click();
      const walk = async () => {
        for(let n=0;n<50 && (game.row!==game.target.row || game.col!==game.target.col);n++) {
          if(game.slow) await wait(300);
          key(game.row!==game.target.row ? (game.row<game.target.row?'ArrowDown':'ArrowUp') : (game.col<game.target.col?'ArrowRight':'ArrowLeft'));
        }
        assert(game.row===game.target.row && game.col===game.target.col,'Цель недостижима');
      };
      for(let n=0;n<2;n++) { await walk(); key('KeyE'); }
      assert(game.chapter===3 && game.phase==='chapter'); $('start').click();
      const deadline=performance.now()+26000;
      while(game.phase==='playing' && performance.now()<deadline) {
        if(game.strikes.some(s=>!s.hit && s.row===game.row && s.col===game.col) && !game.webs.some(w=>w.row===game.row && w.col===game.col)) key('KeyE');
        await wait(60);
      }
      assert(game.chapter===4 && game.phase==='chapter',`Охота: ${game.phase}, ${game.done}, блоков ${game.blocked}`);
      $('start').click();
      for(let n=0;n<3;n++) { await walk(); key('Space'); }
      assert(game.phase==='won' && $('title').textContent.includes('Человек уснул.'));
      assert(!$('results').hidden && $('rules').hidden && $('typo').disabled && unlocked && !$('menu-arcade').hidden);
      assert(game.medals().includes('Человек сохранён'));
    });
    await test('Победа сохраняется; повторный старт очищает все механики', () => {
      if (canStore) assert(JSON.parse(localStorage.getItem('karakurt-campaign')).unlocked);
      $('start').click(); assert(game.score === 0 && game.lives === 3 && game.silk === 2 && !game.webs.length && game.chapter === 0);
      assert($('results').hidden && $('overlay').hidden && $('score').textContent === '0');
    });
    await test('Потеря фокуса ставит игру на паузу', () => {
      window.dispatchEvent(new Event('blur')); assert(game.phase === 'paused' && !$('overlay').hidden);
    });
    await test('Холст занимает арену, клавиатура целиком в кадре, страница не переполнена', () => {
      const rect = canvas.getBoundingClientRect(), arena = canvas.parentElement.getBoundingClientRect(), v = display.view;
      assert(Math.abs(rect.width - arena.width) < 2 && Math.abs(rect.height - arena.height) < 2);
      assert(v.x + 33 * v.scale >= -1 && v.x + 1167 * v.scale <= v.width + 1);
      assert(v.y - 5 * v.scale >= -1 && v.y + 645 * v.scale <= v.height + 1, 'Стол, кружка или записка обрезаны');
      assert(canvas.width >= Math.floor(rect.width) && canvas.height >= Math.floor(rect.height));
      assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    });
    await test('Режим на весь экран переключает раскладку и пересчитывает холст', async () => {
      display.setMode('focus'); await wait(80);
      assert(document.documentElement.classList.contains('immersive') && $('fullscreen').getAttribute('aria-pressed') === 'true');
      assert(document.querySelector('.heading').offsetParent === null);
      display.setMode('window'); await wait(80);
      assert(!document.documentElement.classList.contains('immersive') && $('fullscreen').getAttribute('aria-pressed') === 'false');
    });
    await test('Обзор стола на широком, обычном и узком экранах; точность координат', () => {
      const bounds = canvas.getBoundingClientRect;
      try {
        for (const [width, height] of [[1850,625],[1280,390],[760,220],[360,400]]) {
          canvas.getBoundingClientRect = () => ({ left:17, top:23, width, height });
          display.resize(); const v = display.view;
          const previousScale = Math.min(width/1240,height/720);
          assert(v.scale > previousScale*1.04, 'Клавиатура не стала крупнее');
          for (const [x,y] of [[10,-5],[1190,645],[148,70],[1040,215]]) {
            const sx=v.x+x*v.scale, sy=v.y+y*v.scale;
            assert(sx>=-.01 && sx<=width+.01 && sy>=-.01 && sy<=height+.01, `Объект вне кадра ${width}×${height}`);
          }
          for(let r=0;r<3;r++) for(let c=0;c<10;c++) {
            const p=keyPos(r,c), hit=display.point(17+v.x+p.x*v.scale,23+v.y+p.y*v.scale);
            assert(Math.abs(hit.x-p.x)<.001 && Math.abs(hit.y-p.y)<.001,'Смещение ввода');
          }
        }
      } finally { canvas.getBoundingClientRect=bounds; display.resize(); }
    });
    await test('Клик по клавише на холсте переводит паука с учётом масштаба', () => {
      start(); const rect = canvas.getBoundingClientRect(), v = display.view, p = keyPos(1, 5);
      const clientX = rect.left + v.x + p.x * v.scale, clientY = rect.top + v.y + p.y * v.scale;
      const was = game.col; canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX, clientY, bubbles: true }));
      assert(game.col === was + Math.sign(5 - was) || game.col === 5);
    });
    await test('Кнопка «?» открывает подсказки: пауза, игровые клавиши молчат, закрытие работает', () => {
      if (game.phase !== 'playing') start();
      const score = game.score, col = game.col;
      $('help').click(); assert(guide.open, 'Диалог не открылся'); assert(game.phase === 'paused', `Фаза: ${game.phase}`);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
      key('ArrowLeft'); assert(game.score === score && game.col === col, 'Клавиши игры сработали в диалоге');
      $('close-help').click(); assert(!guide.open, 'Диалог не закрылся');
      assert(game.phase === 'paused', 'Игра не должна возобновляться сама');
    });
    await test('«В меню» сбрасывает забег; меню показывает рекорд, открывает подсказки и «Об игре», зеркалит настройки', async () => {
      assert(game.phase === 'paused' && !$('to-menu').hidden, `Фаза: ${game.phase}`);
      $('to-menu').click();
      assert(menu.visible && game.phase === 'ready' && game.score === 0 && document.querySelector('main').inert, 'Возврат в меню не сработал');
      assert($('menu-record').textContent.includes('5 глав') && !$('menu-continue').hidden && unlocked, 'Продолжение или аркада недоступны');
      $('menu-about').click(); assert(about.open, '«Об игре» не открылось'); $('close-about').click(); assert(!about.open);
      $('menu-help').click(); assert(guide.open, 'Подсказки не открылись'); $('close-help').click(); assert(!guide.open);
      let stored = null, canMotionStore = false;
      try { stored = localStorage.getItem('karakurt-motion'); canMotionStore = true; } catch (_) {}
      try {
        const before = $('motion').getAttribute('aria-pressed');
        $('menu-motion').click(); await wait(40);
        assert($('menu-motion').getAttribute('aria-pressed') !== before && $('menu-motion').textContent === $('motion').textContent, 'Кнопка FX в меню не зеркалит панель');
        $('menu-motion').click(); await wait(40);
        assert($('menu-motion').getAttribute('aria-pressed') === before);
      } finally {
        if (canMotionStore) { try { if (stored === null) localStorage.removeItem('karakurt-motion'); else localStorage.setItem('karakurt-motion', stored); } catch (_) {} }
      }
      $('menu-play').click(); assert($('menu').hidden && !$('overlay').hidden && $('to-menu').hidden, 'Меню не закрылось');
    });
    await test('FX отключает частицы и сохраняет выбор; повторное нажатие возвращает анимацию', () => {
      let stored = null, canMotionStore = false;
      try { stored = localStorage.getItem('karakurt-motion'); canMotionStore = true; } catch (_) {}
      try {
        const before = display.reducedMotion, root = document.documentElement;
        $('motion').click(); assert(display.reducedMotion === !before && root.dataset.motion === (before ? 'full' : 'reduced'));
        const reduced = display.reducedMotion, count = scene.parts.length; scene.burst(100, 100, '#fff', 10);
        assert(reduced ? scene.parts.length === count : scene.parts.length > count, 'Частицы не соответствуют режиму');
        $('motion').click(); assert(display.reducedMotion === before && root.dataset.motion === (before ? 'reduced' : 'full'));
      } finally {
        if (canMotionStore) { try { if (stored === null) localStorage.removeItem('karakurt-motion'); else localStorage.setItem('karakurt-motion', stored); } catch (_) {} }
      }
    });
    await test('Контрольная точка восстанавливается через меню; аркада запускается и сохраняет рекорд', () => {
      if(game.phase==='playing') pause(); $('to-menu').click();
      assert(campaignSave && !$('menu-continue').hidden);
      $('menu-continue').click(); assert(game.phase==='chapter' && game.chapter===campaignSave.level && game.retries>0);
      $('start').click(); assert(game.phase==='playing'); pause(); $('to-menu').click();
      $('menu-arcade').click(); assert(game.mode==='arcade' && game.phase==='playing' && game.time===90);
      scoreUntil(25); assert(game.phase==='playing' && game.score===25);
      game.tick(100); events(); sync(); assert(game.phase==='lost' && arcadeBest>=25 && $('record').textContent.includes('25'));
      $('to-menu').click();
    });
    await test('Ночи 2 и 3: выбор, продолжение, все задачи и последовательное открытие через UI', async () => {
      assert(completedNights.includes(0)&&!nightButtons[1].disabled,'Вторая ночь не открылась');
      nightButtons[1].click(); $('menu-play').click();
      assert(game.night===1&&$('title').textContent.includes('Сначала данные.')&&$('overline').textContent.includes('НОЧЬ 2'));
      $('start').click(); pause(); $('to-menu').click(); $('menu-continue').click();
      assert(game.night===1&&game.phase==='chapter'&&sound.night===1,'Продолжение потеряло ночь');
      const walk = async () => {
        for(let n=0;n<50&&(game.row!==game.target.row||game.col!==game.target.col);n++) {
          if(game.slow)await wait(300);
          key(game.row!==game.target.row ? (game.row<game.target.row?'ArrowDown':'ArrowUp') : (game.col<game.target.col?'ArrowRight':'ArrowLeft'));
        }
        assert(game.row===game.target.row&&game.col===game.target.col,'Маршрут');
      };
      for(const night of [1,2]) {
        assert(game.night===night);
        $('start').click();
        for(let chapter=0;chapter<5;chapter++) {
          assert(game.chapter===chapter&&game.phase==='playing',`Ночь ${night}, глава ${chapter}: ${game.phase}`);
          assert($('overline').textContent.includes(`НОЧЬ ${night+1}`));
          if(game.hunting) {
            const deadline=performance.now()+45000;
            while(game.phase==='playing'&&performance.now()<deadline) {
              if(game.strikes.some(s=>!s.hit&&s.row===game.row&&s.col===game.col)&&!game.webs.some(w=>w.row===game.row&&w.col===game.col))key('KeyE');
              await wait(50);
            }
          } else {
            const quota=game.quota;
            for(let n=0;n<quota;n++) {
              await walk(); if(game.threadMission){assert(!$('web').disabled);$('web').click();}else key('Space');
              if(game.coopCue) {
                assert($('objective').textContent.includes('ОТОЙДИ'),'Нет подсказки напарника');
                const before=game.done; key(game.col===9?'ArrowLeft':'ArrowRight');
                await wait(2050); assert(game.done===before+1,'Лёша не нажал свободную клавишу');
              }
            }
          }
          assert(game.phase===(chapter===4?'won':'chapter'),`Ночь ${night}, глава ${chapter}: ${game.phase}`);
          if(chapter<4)$('start').click();
        }
        assert(completedNights.includes(night)&&sound.night===night&&sound.situation==='ending');
        if(night===1){assert(!$('next-night').hidden&&!nightButtons[2].disabled);$('next-night').click();assert(game.night===2&&game.phase==='ready');}
      }
      assert($('next-night').hidden&&completedNights.length===3&&$('description').textContent.includes('Все три ночи завершены'));
      if(canStore)assert(JSON.parse(localStorage.getItem('karakurt-campaign')).completedNights.length===3);
      $('to-menu').click();nightButtons[0].click();
    });
    await runAudioUITests(test, assert, wait, key);
  } finally {
    if (canStore) { try { if (saved === null) localStorage.removeItem('karakurt-campaign'); else localStorage.setItem('karakurt-campaign', saved); } catch (_) {} }
    document.querySelector('#summary').textContent = `Результат UI: ${passed} пройдено, ${failed} ошибок`;
    panel.scrollIntoView();
  }
})();
