'use strict';
(async()=>{
  let passed=0,failed=0;
  const assert=(v,m)=>{if(!v)throw Error(m);};
  for(const [w,h] of [[1920,1080],[1366,768],[1024,600],[900,900],[390,844],[844,390]]) {
    const f=document.createElement('iframe'); f.width=w; f.height=h; f.src='index.html';
    const loaded=new Promise(resolve=>f.onload=resolve); document.querySelector('#frames').append(f); await loaded;
    await new Promise(resolve=>setTimeout(resolve,150));
    const d=f.contentDocument,win=f.contentWindow,menu=d.querySelector('#menu'),inner=d.querySelector('.menu-inner');
    const li=document.createElement('li');
    try {
      const b=menu.getBoundingClientRect();
      assert(Math.abs(b.width-w)<2 && Math.abs(b.height-h)<2,'Меню не заполняет viewport');
      assert(menu.scrollWidth<=menu.clientWidth+1,'Горизонтальное переполнение');
      assert(inner.clientWidth>=w*.85,'Меню осталось узкой колонкой');
      for(const id of ['menu-play','menu-help','menu-about','menu-fullscreen']) {
        const el=d.getElementById(id); el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect();
        assert(r.left>=0 && r.right<=w+1 && r.top>=-1 && r.bottom<=h+1,'Недоступная кнопка '+id);
      }
      menu.scrollTop=0;
      assert(win.getComputedStyle(inner).gridTemplateColumns.split(' ').length===(w>900?2:1),'Неверное число колонок');
      const img=new win.Image(); img.src='assets/preview.png'; await img.decode(); assert(img.naturalWidth===1200,'Превью не загрузилось');
      assert(typeof win.NightMenu==='function' && typeof win.NightArt==='object','Скрипты меню не загрузились');
      li.textContent=`PASS — ${w}×${h}: раскладка, кнопки и превью`; passed++;
    } catch(e) {li.textContent=`FAIL — ${w}×${h}: ${e.message}`;failed++;}
    document.querySelector('#results').append(li); f.remove();
  }
  document.querySelector('#summary').textContent=`Меню: ${passed} пройдено, ${failed} ошибок`;
})();
