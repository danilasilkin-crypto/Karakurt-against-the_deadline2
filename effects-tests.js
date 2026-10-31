'use strict';
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
const display = { reducedMotion:false, pixelRatio:1, view:{width:1200,height:650,scale:1,x:0,y:0} };
const game = new NightJourney(), scene = new NightScene(display);
game.start(); scene.reset(game);
let passed=0, failed=0;
const assert = (value, message='Нарушено условие') => { if(!value) throw Error(message); };
function test(name, fn) {
  const li=document.createElement('li');
  try { fn(); passed++; li.textContent='PASS — '+name; }
  catch(e) { failed++; li.textContent='FAIL — '+name+': '+e.message; }
  document.querySelector('#results').append(li);
}
test('Успех привязан к клавише даже до интерполяции паука',()=>{
  game.col=7; scene.onEvent('typo',game);
  const p=NightScene.keyPos(game.row,7), m=scene.marks[0];
  assert(m.kind==='success' && m.x===p.x && m.y===p.y);
});
test('Рывок и паутина имеют разные рисунки',()=>{
  scene.onEvent('dash',game); scene.onEvent('web',game);
  assert(scene.marks.some(m=>m.kind==='speed') && scene.marks.some(m=>m.kind==='silk'));
});
test('Удар отмечается один раз, перехват отличается',()=>{
  scene.reset(game);
  game.strikes=[{row:1,col:2,age:1,delay:.8,hit:true},{row:1,col:4,age:1,delay:.8,hit:true,blocked:true}];
  scene.update(.01,game); scene.update(.01,game);
  assert(scene.marks.length===2 && scene.marks[0].kind==='impact' && scene.marks[1].kind==='silk');
});
test('Canvas отрисовывает все типы и предупреждения без ошибки',()=>{
  game.strikes.push({row:2,col:6,age:.7,delay:1.2,hit:false});
  for(const event of ['dash','web','typo','hurt','near-miss','partner-press']) scene.onEvent(event,game);
  scene.draw(ctx,game);
  assert(ctx.getImageData(100,280,1,1).data[3]>0);
});
test('Очереди ограничены при потоке событий',()=>{
  for(let i=0;i<200;i++) scene.onEvent('typo',game);
  assert(scene.marks.length<=24 && scene.parts.length<=320 && scene.floats.length<=12 && scene.rings.length<=32);
});
test('Пауза не старит эффекты',()=>{
  const age=scene.marks[0].age; scene.update(0,game); assert(scene.marks[0].age===age);
});
test('FX− немедленно очищает декор, сохраняя подписи',()=>{
  display.reducedMotion=true; scene.update(0,game);
  assert(!scene.parts.length && !scene.rings.length && !scene.marks.length && !scene.trail.length && !scene.flash && !scene.shake);
  scene.onEvent('web',game); assert(!scene.marks.length && !scene.parts.length && scene.floats.length);
  scene.draw(ctx,game);
});
test('Эффекты исчезают после срока жизни',()=>{
  display.reducedMotion=false; scene.reset(game); game.strikes=[];
  scene.onEvent('typo',game); for(let i=0;i<40;i++) scene.update(.05,game);
  assert(!scene.marks.length && !scene.parts.length && !scene.rings.length && !scene.floats.length);
});
test('Боковой декор использует свободные поля, не отдаляя клавиатуру',()=>{
  assert(NightBackdrop.sideLayout({x0:10,x1:1190}).length===0);
  for(const width of [1600,2100,2700]) {
    const rect={x0:600-width/2,x1:600+width/2};
    const slots=NightBackdrop.sideLayout(rect);
    for(const p of slots) {
      assert(p.x-160*p.scale>=rect.x0 && p.x+160*p.scale<=rect.x1,'Предмет вышел за кадр');
      assert(p.side==='left' ? p.x+160*p.scale<0 : p.x-160*p.scale>1200,'Декор перекрыл игровую область');
    }
  }
});
test('Боковой декор рисуется настоящим Canvas и сохраняет трансформацию',()=>{
  const c=document.createElement('canvas'); c.width=2400;c.height=650;
  const g=c.getContext('2d'); g.translate(600,0);
  NightBackdrop.sideProps(g,{x0:-600,x1:1800});
  assert(g.getTransform().e===600 && g.getTransform().a===1);
  assert(g.getImageData(310,310,1,1).data[3]>0 && g.getImageData(2090,360,1,1).data[3]>0);
});
test('Стол без постоянных подсказок, действие у цели сохранено',()=>{
  const texts=[], original=ctx.fillText;
  ctx.fillText=function(text,...args){texts.push(String(text));return original.call(this,text,...args);};
  try {
    for(const night of [0,1,2]) {
      game.prepare(night); game.start(); scene.reset(game); scene.draw(ctx,game);
    }
  } finally { ctx.fillText=original; }
  assert(!texts.some(s=>/МЯТНАЯ ЦЕЛЬ|КРАСНАЯ =|РЫВОК ГОТОВ|РЫВОК ПЕРЕЗАРЯЖАЕТСЯ|E — ПАУТИНА:|ЕЩЁ ОДНУ\?|ГРОЗА ЗА ОКНОМ|ПОКАЗ ЗАВТРА/.test(s)));
  assert(texts.includes('SPACE'),'Нет кнопки действия у цели');
});
document.querySelector('#summary').textContent=`Эффекты: ${passed} пройдено, ${failed} ошибок`;
document.querySelector('#wide').onclick=()=>{
  const wide=canvas.width===1200;
  canvas.width=wide?2400:1200;
  display.view={width:canvas.width,height:650,scale:1,x:wide?600:0,y:0};
  document.querySelector('#wide').textContent=wide?'Обычный стол':'Широкий стол';
};
let clock=0, previous=0;
function demo(){scene.reset(game); display.reducedMotion=false; document.querySelector('#reduce').textContent='FX−'; clock=0;}
document.querySelector('#demo').onclick=demo;
document.querySelector('#reduce').onclick=()=>{display.reducedMotion=!display.reducedMotion;document.querySelector('#reduce').textContent=display.reducedMotion?'FX+':'FX−';};
function frame(now){
  const dt=Math.min(.05,(now-(previous||now))/1000); previous=now; clock+=dt;
  if(clock>1){ clock=0; game.col=(game.col+2)%10; scene.onEvent(['dash','web','typo'][game.col%3],game); }
  scene.update(dt,game); scene.draw(ctx,game); requestAnimationFrame(frame);
}
demo(); requestAnimationFrame(frame);
