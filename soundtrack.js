'use strict';
// Original procedural score: three motifs, arranged by objective and tension.
// Eighth notes use the AudioContext clock; transitions retain the mixer/consent.
const NightScore = (() => {
  const themes = [
    {title:'03:47', bpm:92, chords:[[57,60,64,71],[53,57,60,64],[48,55,59,64],[55,59,62,69]],
      melody:[76,null,79,null,83,null,79,76,74,null,72,null,71,null,72,null,76,null,79,null,84,null,83,79,76,null,74,null,72,null,71,null]},
    {title:'Гроза в проводах', bpm:98, chords:[[50,57,60,65],[46,53,57,62],[55,58,62,69],[45,52,57,61]],
      melody:[74,77,null,81,77,null,76,74,72,null,69,72,77,null,76,null,74,81,86,null,81,77,null,76,73,null,76,81,76,null,73,null]},
    {title:'До полуночи', bpm:104, chords:[[48,55,59,64],[55,62,65,69],[57,60,64,67],[53,60,64,69]],
      melody:[79,76,null,72,76,79,83,null,81,79,77,null,74,null,79,null,81,84,83,79,76,null,79,81,77,76,72,null,76,79,72,null]}
  ];
  const hz = midi => 440 * 2 ** ((midi-69)/12);
  const theme = a => themes[a.night] || themes[0];
  const mood = a => a.mode!=='playing' ? (a.situation==='ending' ? 'ending':'calm') : a.rest ? 'rest' : a.urgent ? 'danger' : a.situation || 'active';
  const names = {calm:'ночная тема', active:'за работу', weave:'тонкая нить', chase:'восемь лап вперёд', final:'сохрани человека', danger:'последние секунды', rest:'выдох', ending:'до утра'};
  function tempo(a) {
    if(a.mode!=='playing') return 76 + (a.night || 0)*2;
    if(a.rest) return 80;
    return Math.min(144, theme(a).bpm + Math.min(4,a.chapter)*8 + (a.urgent ? 8:0));
  }
  function play(a,index,at) {
    const s=index%64, bar=Math.floor(s/8), beat=s%8, track=theme(a), state=mood(a);
    const chord=track.chords[Math.floor(bar/2)], beatTime=60/tempo(a);
    const gentle=['calm','rest','ending'].includes(state), running=!gentle;
    const suspense=!!a.threat || !!a.partner;
    const note=(midi,duration,volume,type='sine',pan=0,attack=.012)=>a.voice({frequency:hz(midi),at,duration,volume,type,pan,attack,bus:'music'});
    if(s%16===0) chord.forEach((n,i)=>note(n,beatTime*7.5,.039,'sine',(i-1.5)*.25,.25));
    if(beat===0 || beat===4) note(chord[0]-12,beatTime*1.6,.12);
    const lead=track.melody[Math.floor(s/2)];
    if(s%2===0 && lead!==null && (state!=='rest' || beat===0)) {
      note(lead+(state==='ending'?-12:0),gentle?.95:.6,.075,a.night===1?'sine':'triangle',bar%2?.2:-.2);
      if(state==='final' || state==='ending') note(lead-12,.9,.035,'sine',-.2);
    }
    if(state==='weave' && beat%2===0) note(chord[(beat/2)%4]+12,.32,.065,'sine',beat<4?-.4:.4);
    if(running && !suspense && a.combo>=3 && beat%2===0) note(chord[(beat/2)%4]+24,.22,.028,'sine',.35);
    if(a.partner && beat===0) note(chord[2]+12,.7,.045,'sine',-.3);
    if(running && !suspense) {
      if(beat%4===0) a.voice({frequency:90,end:40,duration:.17,volume:.14,at,bus:'music'});
      if(beat%2===1) a.voice({noise:true,duration:.035,volume:.032,filter:a.night===1?2200:3300,pan:.25,at,bus:'music'});
      if(['chase','danger'].includes(state)) {
        note(chord[beat%4]+12,.12,.045,'triangle',beat%2?.35:-.35);
        if(beat===2 || beat===6) a.voice({noise:true,duration:.09,volume:.055,filter:1700,at,bus:'music'});
      } else if(a.chapter>0 && beat%2===0 && state!=='weave') note(chord[(beat/2)%4]+12,.16,.035,'triangle',-.25);
      if(state==='danger' && beat%2===0) note(88,.055,.045);
      if(a.night===1 && beat===6) note(chord[2]+24,.45,.025,'sine',-.4);
      if(a.night===2 && beat===7) note(chord[3]+12,.12,.045,'triangle',.35);
    }
  }
  return {play,tempo,mood,themes,title:a=>`«${theme(a).title}» · ${names[mood(a)]}`};
})();
window.NightScore=NightScore;
