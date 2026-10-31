'use strict';
(() => {
  let passed=0,failed=0;
  const assert=(ok,msg='Нарушено условие')=>{if(!ok)throw Error(msg);};
  const test=(name,fn)=>{const li=document.createElement('li');try{fn();passed++;li.textContent='PASS — '+name;}catch(e){failed++;li.className='fail';li.textContent='FAIL — '+name+': '+e.message;}document.querySelector('#results').append(li);};
  const make=(night,chapter=0)=>{const g=new NightJourney(()=>.4);g.start('campaign',night);g.enterStage(chapter,false);return g;};
  const step=(g,time)=>{for(let t=0;t<time&&g.phase==='playing';t+=.05)g.tick(.05);};
  const walk=g=>{for(let i=0;i<50&&(g.row!==g.target.row||g.col!==g.target.col);i++){if(g.slow)step(g,.3);if(g.row!==g.target.row)g.move(Math.sign(g.target.row-g.row),0);else g.move(0,Math.sign(g.target.col-g.col));}assert(g.row===g.target.row&&g.col===g.target.col,'Цель недостижима');};
  for(const night of [1,2]) {
    test(`Ночь ${night+1}: все пять глав до настоящей победы`,()=>{
      const g=make(night);
      for(let chapter=0;chapter<5;chapter++) {
        assert(g.chapter===chapter&&g.night===night);
        if(g.phase==='chapter')g.continueChapter();
        const quota=g.quota;
        if(g.hunting) {
          for(let t=0;t<80&&g.chapter===chapter&&g.phase==='playing';t+=.05){
            if(g.strikes.some(s=>!s.hit&&s.row===g.row&&s.col===g.col))g.weave();
            g.tick(.05);
          }
        } else for(let n=0;n<quota;n++){
          walk(g);assert(g.threadMission?g.weave():g.typo());
          if(g.coopCue) { g.move(0,g.col===9?-1:1); step(g,1.9); }
        }
        assert(chapter===4 ? g.phase==='won' : g.phase==='chapter',`Глава ${chapter}: ${g.phase}, ${g.done}`);
      }
      assert(g.progress===1&&g.blocked>=4&&NightStory.ending(g).text===g.episode.epilogue);
    });
    test(`Ночь ${night+1}: снимок каждой главы, повтор и правильный маршрут`,()=>{
      for(let chapter=0;chapter<5;chapter++) {
        const g=make(night,chapter),saved=JSON.parse(JSON.stringify(g.checkpoint)),next=new NightJourney();
        assert(next.restore(saved));assert(next.night===night&&next.chapter===chapter&&next.phase==='chapter'&&next.time===g.limit);
        assert(JSON.stringify(next.target)===JSON.stringify(g.target));
        next.continueChapter();next.tick(next.time+.1);assert(next.phase==='lost');assert(next.retry()&&next.night===night&&next.chapter===chapter&&next.lives===3);
      }
    });
    test(`Ночь ${night+1}: столбцы предупреждают и оставляют выход`,()=>{
      const g=make(night,3);g.volley=2;g.spawnStrikes();
      assert(g.events.includes(night===1?'storm':'notifications'));
      const columns=new Set(g.strikes.map(s=>s.col));assert(columns.size===(night===1?1:2));
      assert(g.strikes.every(s=>s.delay>=1.6&&!s.hit));assert(columns.size<10);
    });
  }
  test('Истёкшая цель переезжает, не отнимая собранное',()=>{const g=make(1);g.typo();const old={...g.target};g.nextStrike=100;step(g,9.1);assert(g.done===1&&g.events.includes('relocate'));assert(g.target.row!==old.row||g.target.col!==old.col);});
  test('Разрыв цепи сбрасывает узлы, но не таймер главы; можно пройти заново без шёлка',()=>{const g=make(2,2);walk(g);g.silk=0;assert(g.weave()&&g.linkLeft===10);g.nextStrike=100;step(g,10.1);assert(g.done===0&&g.anchors.length===0&&g.time<g.limit&&g.events.includes('link-lost'));for(let i=0;i<5;i++){walk(g);g.silk=0;assert(g.weave());}assert(g.chapter===3);});
  test('Крошка появляется только в передышке и подбирается один раз',()=>{const g=make(1);g.nextStrike=100;step(g,18.1);assert(g.respite&&g.crumb);g.target={...g.crumb};const before=g.time;walk(g);assert(!g.crumb&&g.crumbs===1&&g.time>before&&g.charge>=2);g.move(0,1);g.move(0,-1);assert(g.crumbs===1);step(g,6);assert(!g.respite&&!g.crumb);});
  test('Пауза останавливает цепь, исчезающую цель и крошку',()=>{for(const g of [make(1),make(1,1)]){walk(g);if(g.threadMission)g.weave();g.pause();const before=JSON.stringify(g);g.tick(30);g.weave();g.typo();assert(JSON.stringify(g)===before);}});
  test('Старые контрольные точки мигрируют в первую ночь',()=>{const old=new NightCampaign();old.start();old.enterStage(2);const g=new NightJourney();assert(g.restore(old.checkpoint)&&g.night===0&&g.chapter===2&&g.threadMission);});
  test('Битые ночи и контрольные точки отклоняются без изменения состояния',()=>{const g=make(1);const before=JSON.stringify(g);for(const night of [-1,3,NaN,1.5,'1',null]){assert(!g.restore({...g.checkpoint,night}));}assert(!g.restore({...g.checkpoint,level:99}));assert(JSON.stringify(g)===before);});
  test('Аркада после новой ночи не наследует миссии и проходит 24 очка',()=>{const g=make(2);g.start('arcade');for(let n=0;n<30;n++){walk(g);assert(g.typo());}assert(g.mode==='arcade'&&!g.mission&&g.phase==='playing'&&g.score===30);});
  test('Неверное время не повреждает новые таймеры',()=>{const g=make(1,1),before=JSON.stringify(g);for(const dt of [0,-1,NaN,Infinity])g.tick(dt);assert(JSON.stringify(g)===before);});
  test('Нить-путь: реальный расход шёлка, оба направления, перезарядка и истечение',()=>{
    const g=make(0); assert(g.weave()&&g.silk===1); assert(g.weave()&&g.routeStart); g.move(0,1);g.move(0,1);
    assert(g.weave()&&g.silk===0&&g.threadRoute.life===18);
    assert(g.dash(0,1)&&g.col===4&&g.cooldown===1.5&&g.invulnerable>0);assert(!g.dash(0,1));
    g.nextStrike=100;step(g,1.6);assert(g.dash(0,-1)&&g.col===6);step(g,18);assert(!g.threadRoute);
  });
  test('Начало нити отменяется; нулевой шёлк не теряет узел; цели задач имеют приоритет',()=>{
    const g=make(0);g.weave();g.weave();g.weave();assert(!g.routeStart&&g.silk===1);
    g.weave();g.move(0,1);g.silk=0;assert(!g.weave()&&g.routeStart&&!g.threadRoute);
    g.move(0,-1);assert(g.weave()&&!g.routeStart);
    const task=make(1,1);task.weave();task.weave();walk(task);assert(task.weave()&&task.done===1);
  });
  test('На волоске: поздний уход награждается один раз; ранний уход и возврат под удар — нет',()=>{
    for(const kind of ['late','early','return']) {
      const g=make(0);g.invulnerable=0;g.nextStrike=100;
      g.strikes=[{row:g.row,col:g.col,age:kind==='early'?0:.85,delay:1,hit:false,blocked:false}];
      g.move(0,1);if(kind==='return')g.move(0,-1);step(g,1.1);
      assert(g.nearMisses===(kind==='late'?1:0),kind);const charge=g.charge;step(g,.2);assert(g.charge===charge);
    }
  });
  test('Напарник ждёт занятую клавишу, паузу и свободный проход; нажатие засчитывается один раз',()=>{
    const g=make(2,4);walk(g);g.typo();g.nextStrike=100;step(g,2);assert(g.done===0&&g.coopCue.left===1.8);
    g.move(0,1);g.pause();g.tick(5);assert(g.coopCue.left===1.8);g.pause();step(g,1.9);assert(g.done===1&&!g.coopCue);
    step(g,1);assert(g.done===1);g.spawnStrikes();assert(g.strikes.every(s=>s.row!==g.target.row));
  });
  test('Дождь меняет лужи без урона, целевой узел не затоплен',()=>{
    const g=make(1,2),old=JSON.stringify(g.spills);g.nextStrike=100;step(g,6.2);
    assert(JSON.stringify(g.spills)!==old&&g.hits===0&&g.spills.length<=3);
    assert(!g.spills.some(p=>p.row===g.target.row&&p.col===g.target.col));
  });
  test('Повтор главы очищает маршруты и ожидание напарника; причина поражения конкретная',()=>{
    const g=make(2,4);walk(g);g.typo();g.tick(g.time+1);assert(g.phase==='lost'&&NightStory.ending(g).text.includes('Лёша ждёт'));
    assert(g.retry()&&!g.coopCue&&!g.threadRoute&&!g.routeStart);
  });
  document.querySelector('#summary').textContent=`Результат ночей: ${passed} пройдено, ${failed} ошибок`;
})();
