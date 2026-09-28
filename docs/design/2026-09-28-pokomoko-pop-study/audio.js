// Original study score. No recorded/reference music is used in the candidate.
// The same event list feeds live playback, recording, and OfflineAudioContext.
export const DURATION = 12;
const hz = m => 440 * 2 ** ((m - 69) / 12);
const notes = [72, 79, 76, 74, 81, 79, 76, 79, 77, 84, 81, 79, 74, 79, 83, 79];
export const inputs = [
  { t: .85, digit: 2, question: 0, cell: 1 }, { t: 1.5, digit: 6, question: 0, cell: 0, correct: 3 },
  { t: 4.1, digit: 4, question: 1, cell: 1 }, { t: 4.75, digit: 8, question: 1, cell: 0, correct: 4 },
  { t: 7.5, digit: 6, question: 2, cell: 1 }, { t: 8.15, digit: 1, question: 2, cell: 0, correct: 5 },
];
export const ARRIVAL = .47;
export function makeGraph(ctx, destination = ctx.destination) {
  const master = ctx.createGain(); master.gain.value = 1.12;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3;
  comp.attack.value = .003; comp.release.value = .16;
  const out = ctx.createGain(); out.gain.value = 1.7;
  master.connect(comp); comp.connect(out); out.connect(destination);
  return { ctx, master, out };
}
function tone(g, t, midi, duration, volume, type = 'sine', color = 0, position = 0) {
  const ctx = g.ctx, o = ctx.createOscillator(), e = ctx.createGain(), p = ctx.createStereoPanner();
  o.type = type; o.frequency.setValueAtTime(hz(midi), t);
  e.gain.setValueAtTime(.00001, t); e.gain.exponentialRampToValueAtTime(Math.max(.00002,volume), t + .006);
  e.gain.exponentialRampToValueAtTime(.00001, t + duration); p.pan.value = position;
  o.connect(e); e.connect(p); p.connect(g.master); o.start(t); o.stop(t + duration + .01);
  if (color) {
    const h = ctx.createOscillator(), he = ctx.createGain(); h.type = 'sine'; h.frequency.value = hz(midi) * 3;
    he.gain.setValueAtTime(volume * color, t); he.gain.exponentialRampToValueAtTime(.00001,t+.07);
    h.connect(he); he.connect(p); h.start(t); h.stop(t+.09);
  }
}
function noise(g, t, duration, volume, bright) {
  const c = g.ctx, len = Math.ceil(c.sampleRate * duration), b = c.createBuffer(1,len,c.sampleRate);
  let seed = 749; const d = b.getChannelData(0);
  for (let i=0;i<len;i++) { seed=(seed*1664525+1013904223)>>>0; d[i]=(seed/4294967296*2-1)*(1-i/len)**3; }
  const n=c.createBufferSource(), f=c.createBiquadFilter(), gain=c.createGain(); n.buffer=b; f.type='highpass'; f.frequency.value=bright; gain.gain.value=volume;
  n.connect(f); f.connect(gain); gain.connect(g.master); n.start(t);
}
function kick(g,t,v=.19) {
  const c=g.ctx,o=c.createOscillator(),e=c.createGain();o.frequency.setValueAtTime(115,t);o.frequency.exponentialRampToValueAtTime(48,t+.07);
  e.gain.setValueAtTime(v,t);e.gain.exponentialRampToValueAtTime(.00001,t+.2);o.connect(e);e.connect(g.master);o.start(t);o.stop(t+.22);
}
export function cue(g,name,t,{digit=0,streak=0}={}) {
  if(name==='tap')tone(g,t,72+(digit%3)*4,.055,.085,'triangle',.15);
  if(name==='catch')tone(g,t,79,.075,.065,'sine',.3,-.18);
  if(name==='place'){tone(g,t,55,.045,.08,'triangle');tone(g,t+.012,84,.12,.055,'sine',.2,.18);}
  if(name==='correct'){
    [0,4,7].forEach((n,i)=>tone(g,t+i*.055,72+n,.30,.075,'sine',.2,(i-1)*.18));
    if(streak>=3)noise(g,t+.1,.07,.045,1800);
  }
  if(name==='jump'){
    [72,76,79].forEach((n,i)=>tone(g,t+i*.055,n,.10,.05,'triangle'));
  }
  if(name==='land'){kick(g,t,.095);noise(g,t,.045,.026,1400);}
  if(name==='peak'){
    [67,72,76,79,84].forEach((n,i)=>tone(g,t+i*.06,n,.45,.09,'triangle',.12,(i-2)*.16));
    [60,64,67].forEach(n=>tone(g,t+.24,n,.65,.055,'sine'));kick(g,t+.24,.22);noise(g,t+.24,.27,.055,3800);
  }
  if(name==='retry')tone(g,t,60,.10,.055,'triangle');
}
export const scoreBeats=[];
for(let t=0,beat=0;t<DURATION-.15;beat++){
  const tier=t<2?0:t<5.3?1:t<8.6?2:3;
  scoreBeats.push({t,beat,tier,root:[48,45,53,55][Math.floor(beat/4)%4]});
  t+=60/(tier===0?112:tier===1?116:120);
}
export function schedule(g,start,offset=0) {
  const fixed=[];
  for(const {t,beat,tier,root} of scoreBeats){
    fixed.push({t,name:'note',m:notes[beat%notes.length],d:.27,v:.070,type:'sine',color:.22,pan:beat%2?.16:-.16});
    if(tier>=1&&beat%2===0){fixed.push({t,name:'note',m:root,d:.32,v:.105,type:'triangle'});fixed.push({t,name:'kick',v:.115});}
    if(tier>=1&&beat%2===1)fixed.push({t,name:'noise',d:.075,v:.04,f:1700});
    if(tier>=2)fixed.push({t:t+.25,name:'noise',d:.035,v:.017,f:6000});
    if(tier>=3&&beat%4===0)for(const n of [root+12,root+16,root+19])fixed.push({t,name:'note',m:n,d:.9,v:.026,type:'sine'});
  }
  for(const e of fixed){if(e.t<offset||e.t>=DURATION)continue;const at=start+e.t-offset;
    if(e.name==='note')tone(g,at,e.m,e.d,e.v,e.type,e.color,e.pan);
    if(e.name==='kick')kick(g,at,e.v);if(e.name==='noise')noise(g,at,e.d,e.v,e.f);
  }
  for(const e of inputs){
    for(const [delay,name] of [[0,'tap'],[.22,'catch'],[ARRIVAL,'place']])if(e.t+delay>=offset)cue(g,name,start+e.t+delay-offset,{digit:e.digit});
    if(e.correct){
      const at=e.t+ARRIVAL;
      if(at>=offset)cue(g,'correct',start+at-offset,{streak:e.correct});
      if((e.correct===3||e.correct===5)&&at+.09>=offset)cue(g,e.correct===5?'peak':'jump',start+at+.09-offset);
      if(at+.62>=offset)cue(g,'land',start+at+.62-offset);
    }
  }
  g.out.gain.setValueAtTime(1.7,start);g.out.gain.setValueAtTime(1.7,start+DURATION-offset-.3);g.out.gain.linearRampToValueAtTime(0,start+DURATION-offset);
}
export async function renderWav(){
  const c=new OfflineAudioContext(2,48000*DURATION,48000),g=makeGraph(c);schedule(g,0);
  const b=await c.startRendering(),out=new ArrayBuffer(44+b.length*4),v=new DataView(out);
  const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  str(0,'RIFF');v.setUint32(4,out.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,b.length*4,true);
  const a=b.getChannelData(0),z=b.getChannelData(1);let peak=0;
  for(let i=0;i<b.length;i++){peak=Math.max(peak,Math.abs(a[i]),Math.abs(z[i]));v.setInt16(44+i*4,Math.round(Math.max(-1,Math.min(1,a[i]))*32767),true);v.setInt16(46+i*4,Math.round(Math.max(-1,Math.min(1,z[i]))*32767),true);}
  return {blob:new Blob([out],{type:'audio/wav'}),peak};
}
