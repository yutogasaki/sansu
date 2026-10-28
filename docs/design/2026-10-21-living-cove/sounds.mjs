export function noiseSamples(sampleRate,duration=.7) {
  const data=new Float32Array(Math.ceil(sampleRate*duration));let seed=384921;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/4294967296*2-1;}
  return data;
}
export function playStudySound(ctx,kind) {
  if(ctx.state!=='running')return;
  const now=ctx.currentTime,data=noiseSamples(ctx.sampleRate),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);buffer.copyToChannel(data,0);
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;
  filter.type=kind==='leaf'?'highpass':'lowpass';filter.frequency.value=kind==='leaf'?2200:kind==='water'?1100:380;
  source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0,now);
  if(kind==='leaf')for(let j=0;j<3;j++){gain.gain.linearRampToValueAtTime(.017,now+.025+j*.17);gain.gain.linearRampToValueAtTime(.001,now+.12+j*.17);}
  else {gain.gain.linearRampToValueAtTime(kind==='water'?.047:.06,now+.018);gain.gain.exponentialRampToValueAtTime(.001,now+(kind==='water'?.48:.2));}
  gain.gain.linearRampToValueAtTime(0,now+.65);source.start(now);source.stop(now+.7);
  if(kind==='water') {
    const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(780,now);o.frequency.exponentialRampToValueAtTime(230,now+.22);
    g.gain.setValueAtTime(.022,now);g.gain.exponentialRampToValueAtTime(.001,now+.25);o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+.28);
  }
}
