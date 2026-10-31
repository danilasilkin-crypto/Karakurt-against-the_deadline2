'use strict';
// Render production synthesis through the real browser audio graph, not mocks.
document.getElementById('run').onclick = async () => {
  const button = document.getElementById('run'), results = document.getElementById('results');
  button.disabled = true; results.replaceChildren();
  let passed = 0, failed = 0;
  const assert = (ok, message = 'Нарушено условие') => { if (!ok) throw Error(message); };
  const test = async (name, fn) => {
    const item = document.createElement('li');
    try { await fn(); passed++; item.textContent = `PASS — ${name}`; }
    catch (error) { failed++; item.className = 'fail'; item.textContent = `FAIL — ${name}: ${error.message}`; }
    results.append(item);
  };
  const context = seconds => new OfflineAudioContext(2, Math.ceil(22050 * seconds), 22050);
  function mixer(c, settings = {}) {
    return new NightAudio({ context: c, storage: null, automatic: false,
      settings: { enabled: true, music: .45, effects: .7, ...settings } });
  }
  function stats(buffer, from = 0, to = buffer.duration) {
    let peak = 0, energy = 0, count = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = Math.floor(from * buffer.sampleRate); i < Math.min(data.length, Math.floor(to * buffer.sampleRate)); i++) {
        assert(Number.isFinite(data[i]), 'NaN/Infinity в звуковой волне');
        peak = Math.max(peak, Math.abs(data[i])); energy += data[i] ** 2; count++;
      }
    }
    return { peak, rms: Math.sqrt(energy / Math.max(1, count)) };
  }
  async function render(configure, settings = {}, seconds = 3) {
    const c = context(seconds), audio = mixer(c, settings);
    configure(audio);
    const buffer = await c.startRendering();
    await new Promise(resolve => setTimeout(resolve, 0));
    return { audio, buffer, ...stats(buffer) };
  }
  await test('Настройки безопасны при битом JSON, заблокированном хранилище и выходе за диапазон', () => {
    const broken = new NightAudio({ storage: { getItem() { return '{bad'; }, setItem() { throw Error('blocked'); } } });
    assert(!broken.settings.enabled && broken.settings.music === .45);
    broken.setVolume('music', NaN); assert(broken.settings.music === .45);
    broken.setVolume('music', 20); broken.setVolume('effects', -4);
    assert(broken.settings.music === 1 && broken.settings.effects === 0);
    assert(!broken.context, 'Настройки не должны запускать AudioContext');
    const restored = new NightAudio({ storage: { getItem: () => '{"enabled":true,"music":0.23,"effects":0.61}' } });
    assert(restored.settings.enabled && restored.settings.music === .23 && restored.settings.effects === .61 && !restored.context);
  });
  await test('Меню «03:47»: настоящая стереоволна без клиппинга; завершённые узлы удаляются', async () => {
    const result = await render(a => a.schedule(3.1), {}, 8);
    assert(result.rms > .002 && result.peak < .95, `rms=${result.rms}, peak=${result.peak}`);
    assert(result.buffer.numberOfChannels === 2 && !result.audio.voices.size, 'Узлы не очищены');
  });
  await test('Игровая тема отличается от меню, финальная глава быстрее первой', async () => {
    const menu = await render(a => a.schedule(2));
    const first = await render(a => { a.setMode('playing', 0); a.schedule(2); });
    const final = await render(a => { a.setMode('playing', 4, true); a.schedule(2); });
    const rest = await render(a => { a.rest = true; a.setMode('playing', 4); a.schedule(2); });
    assert(rest.audio.step < first.audio.step, 'Передышка не меняет темп');
    assert(final.audio.step > first.audio.step && first.audio.step > menu.audio.step, 'Темп не меняется');
    const a = menu.buffer.getChannelData(0), b = first.buffer.getChannelData(0);
    assert(a.some((sample, i) => Math.abs(sample - b[i]) > .01), 'Дорожки одинаковые');
    assert(final.rms > .002 && final.peak < .95);
  });
  await test('Все 36 игровых сигналов дают непустой ограниченный сигнал', async () => {
    const names = ['storm', 'notifications', 'relocate', 'link-lost', 'crumb', 'move', 'typo', 'miss', 'warning', 'sweep', 'strike', 'hurt', 'dash', 'web', 'block', 'silk', 'combo', 'chapter', 'win', 'lose', 'start', 'pause', 'select', 'undo-warning', 'backspace', 'hands', 'undo', 'anchor', 'undo-block', 'objective', 'charged', 'powerdash', 'rest', 'sticky', 'useweb', 'saved'];
    for (const name of names) {
      const result = await render(a => assert(a.play(name, { score: 9, col: 8 }), name), { music: 0 }, 2);
      assert(result.rms > .0001 && result.peak < .95, `${name}: rms=${result.rms}, peak=${result.peak}`);
      assert(!result.audio.voices.size, `${name}: остались узлы`);
    }
  });
  await test('Выключенный звук и нулевой микшер рендерят тишину', async () => {
    for (const settings of [{ enabled: false }, { music: 0, effects: 0 }]) {
      const result = await render(a => { a.schedule(1); a.play('strike'); }, settings, 1.5);
      assert(result.peak === 0 && !result.audio.voices.size, `peak=${result.peak}`);
    }
  });
  await test('Музыка и эффекты выключаются независимо', async () => {
    const musicOnly = await render(a => { a.schedule(1); assert(!a.play('strike')); }, { effects: 0 }, 2);
    const effectsOnly = await render(a => { a.schedule(1); assert(a.step === 0); a.play('web'); }, { music: 0 }, 2);
    assert(musicOnly.rms > .001 && effectsOnly.rms > .001);
    const low = await render(a => a.play('web'), { effects: .1 }, 1);
    const high = await render(a => a.play('web'), { effects: .8 }, 1);
    assert(high.rms > low.rms * 2, 'Регулятор не влияет на громкость');
  });
  await test('Пауза и концовки не планируют музыку; победный аккорд остаётся', async () => {
    for (const mode of ['paused', 'won', 'lost']) {
      const result = await render(a => { a.setMode(mode); a.schedule(1); }, {}, 1.5);
      assert(result.peak === 0, `${mode}: музыка не остановлена`);
    }
    const win = await render(a => { a.setMode('won'); a.play('win'); }, {}, 2);
    assert(win.rms > .001);
  });
  await test('Фоновая вкладка запрещает новые голоса; возврат снова разрешает', async () => {
    const result = await render(a => { a.setBackground(true); a.schedule(1); assert(!a.play('strike')); }, {}, 1);
    assert(result.peak === 0 && result.audio.timer === null);
    const resumed = await render(a => { a.setBackground(true); a.setBackground(false); assert(a.play('web')); }, {}, 1);
    assert(resumed.rms > .001);
  });
  await test('Mute отменяет заранее запланированные ноты, без всплеска после остановки', async () => {
    const result = await render(a => { a.schedule(1.5); void a.setEnabled(false); }, {}, 2);
    assert(result.peak < .0001, `Остался звук: ${result.peak}`);
    assert(!result.audio.voices.size && result.audio.timer === null);
  });
  await test('Повторы эффектов ограничены; лимит голосов не допускает накопления', async () => {
    const c = context(1), a = mixer(c);
    assert(a.play('move') && !a.play('move') && !a.play('unknown'));
    for (let i = 0; i < 100; i++) a.voice();
    assert(a.voices.size === 64, `Голосов: ${a.voices.size}`);
    await c.startRendering(); await new Promise(resolve => setTimeout(resolve, 0));
    assert(!a.voices.size, 'После проигрывания остались голоса');
  });
  await test('Три ночи имеют разные реальные мелодии, все ситуации звучат без клиппинга', async () => {
    const waves=[];
    for(let night=0;night<3;night++) {
      for(const situation of ['calm','active','weave','chase','final','ending','rest','danger']) {
        const result=await render(a=>{a.rest=situation==='rest';a.setMode(['calm','ending'].includes(situation)?'menu':'playing',2,situation==='danger',night,situation);a.schedule(2);}, {}, 7);
        assert(result.rms>.001&&result.peak<.95,`${night}/${situation}: ${result.rms}/${result.peak}`);
        assert(!result.audio.voices.size,'Узлы не удалены');
        if(situation==='active')waves.push(result.buffer.getChannelData(0));
      }
    }
    for(let n=1;n<3;n++)assert(waves[n].some((v,i)=>Math.abs(v-waves[n-1][i])>.01),'Темы совпали');
  });
  await test('Смена ситуации меняет аранжировку; повтор sync не перезапускает музыку', async () => {
    const buffers=[];
    for(const situation of ['active','weave','chase','final']) {
      const r=await render(a=>{a.setMode('playing',2,false,1,situation);a.schedule(2);const step=a.step;a.setMode('playing',2,false,1,situation);assert(a.step===step);}, {}, 7);
      buffers.push(r.buffer.getChannelData(0));
    }
    for(let n=1;n<buffers.length;n++)assert(buffers[n].some((v,i)=>Math.abs(v-buffers[0][i])>.005),'Аранжировка не меняется');
  });
  await test('Новые сигналы маршрута, уклонения и напарника звучат и очищают узлы',async()=>{
    for(const name of ['route-start','route-cancel','route-ready','route-ride','route-empty','route-faded','near-miss','partner-ready','partner-lane','partner-press','partner-wait','rain-shift']) {
      const r=await render(a=>assert(a.play(name)),{music:0},2); assert(r.rms>.0001&&r.peak<.95&&!r.audio.voices.size,name);
    }
  });
  await test('Смена главы и ситуации сохраняет фразу; серия и ожидание дают разные слои',async()=>{
    const waves=[];
    for(const state of ['plain','combo','threat','partner']) {
      const r=await render(a=>{a.setMode('playing',2,false,2,'active');a.combo=state==='combo'?4:0;a.threat=state==='threat';a.partner=state==='partner';a.schedule(2);const step=a.step;a.setMode('playing',4,false,2,'final');assert(a.step===step,'Фраза сброшена');},{},7);
      assert(r.rms>.001&&r.peak<.95);waves.push(r.buffer.getChannelData(0));
    }
    for(let i=1;i<waves.length;i++)assert(waves[i].some((v,j)=>Math.abs(v-waves[0][j])>.002),'Слой не изменился');
  });
  document.getElementById('summary').textContent = `Результат аудио: ${passed} пройдено, ${failed} ошибок`;
  button.disabled = false;
};
