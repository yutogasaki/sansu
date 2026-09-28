import { DURATION, inputs, ARRIVAL, makeGraph, schedule, cue, renderWav, scoreBeats } from './audio.js';

const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),ref=document.querySelector('#reference');
const play=document.querySelector('#play'),scrub=document.querySelector('#scrub'),status=document.querySelector('#status');
const C={ink:'#191d48',paper:'#fffcf5',blue:'#386bff',pink:'#ff7ab6',yellow:'#ffda46',mint:'#4dd9bb',lilac:'#b79af7'};
const atlas=new Image();atlas.src='assets/pokomoko-original.webp';
await Promise.all([atlas.decode(),document.fonts.load('32px Display'),document.fonts.load('32px Round')]);
let time=0,playing=false,startAt=0,startOffset=0,audioMode='candidate',ac=null,graph=null,recording=false;
let manual=false,manualStart=0,manualEvents=[],manualQ=0,manualStep=0,manualStreak=2,manualNext=0;
const questions=[{a:27,b:35,op:'+',answer:'62'},{a:57,b:27,op:'+',answer:'84'},{a:91,b:75,op:'−',answer:'16'},{a:46,b:23,op:'+',answer:'69'}];
const keys=['7','8','9','4','5','6','1','2','3','⌫','0','C'].map((label,i)=>({label,x:18+(i%3)*135,y:578+Math.floor(i/3)*67,w:124,h:58}));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,k)=>a+(b-a)*k;
const ease=k=>1-(1-k)**3;
function round(g,x,y,w,h,r=14){g.beginPath();g.roundRect(x,y,w,h,r);}
function box(g,x,y,w,h,fill,r=14,shadow=4,stroke=3){if(shadow){g.fillStyle=C.ink;round(g,x,y+shadow,w,h,r);g.fill();}g.fillStyle=fill;round(g,x,y,w,h,r);g.fill();g.lineWidth=stroke;g.strokeStyle=C.ink;g.stroke();}
function text(g,s,x,y,size=24,color=C.ink,font='Round',align='center'){g.font=`900 ${size}px ${font},sans-serif`;g.textAlign=align;g.textBaseline='middle';g.fillStyle=color;g.fillText(s,x,y);}
function star(g,x,y,r,fill=C.yellow,angle=0,stroke=2){g.save();g.translate(x,y);g.rotate(angle);g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.45:r;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=C.ink;g.lineWidth=stroke;g.lineJoin='round';g.stroke();}g.restore();}
function bez(a,b,c,k){return{x:(1-k)**2*a.x+2*(1-k)*k*b.x+k*k*c.x,y:(1-k)**2*a.y+2*(1-k)*k*b.y+k*k*c.y};}
function caption(g,n,x,y,scale=1){g.save();g.translate(x,y);g.rotate(-.07);g.scale(scale,scale);g.lineJoin='round';g.font='96px Display,sans-serif';g.textAlign='center';g.textBaseline='middle';g.strokeStyle=C.ink;g.lineWidth=11;g.strokeText(n,3,5);g.strokeStyle='#fff';g.lineWidth=7;g.strokeText(n,0,0);g.strokeStyle=C.ink;g.lineWidth=2;g.strokeText(n,0,0);g.fillStyle=n==='5'?C.blue:C.pink;g.fillText(n,0,0);g.font='25px Display,sans-serif';g.lineWidth=8;g.strokeStyle=C.ink;g.strokeText('れんぞく！',0,67);g.fillStyle=C.pink;g.fillText('れんぞく！',0,67);g.restore();}
function bear(g,x,ground,size,pose,{turn=0,squash=1}={}){g.save();g.translate(x,ground);g.scale(squash,1/squash);g.rotate(turn);g.drawImage(atlas,pose*192,0,192,224,-size*.5,-size*224/192,size,size*224/192);g.restore();}
function derive(t,events=inputs,isManual=false){
 const completed=events.filter(e=>e.correct&&t>=e.t+ARRIVAL),last=completed.at(-1),age=last?t-last.t-ARRIVAL:99;
 const latestInput=events.filter(e=>e.t<=t&&t-e.t<.75).at(-1);
 const retry=events.filter(e=>e.wrong&&t-e.t>=0&&t-e.t<.65).at(-1);
 let q=isManual?manualQ:completed.filter(e=>t>=e.t+ARRIVAL+.14).length;
 const streak=isManual?manualStreak:(last?.correct??2);
 return {completed,last,age,latestInput,retry,q:q%questions.length,streak,level:streak>=5?3:streak>=3?1:0};
}
function draw(g,t,events=inputs,isManual=false){
 const S=derive(t,events,isManual),q=questions[S.q],L=S.level;
 const peak=S.last&&(S.last.correct===3||S.last.correct===5)&&S.age<1.45;
 const big=peak&&S.last.correct===5;
 const pulse=scoreBeats.findLast(b=>b.t<=t);
 const beat=pulse?Math.max(0,1-(t-pulse.t)/.14):0;
 g.save();g.scale(g.canvas.width/430,g.canvas.height/860);g.clearRect(0,0,430,860);
 g.fillStyle=C.paper;g.fillRect(0,0,430,860);
 // A few large color shapes. No material bevel or brown diffuse shadow.
 g.fillStyle=L>=3?'#defbf2':'#ffe7ee';g.beginPath();g.ellipse(-28,163,161,147,-.25,0,Math.PI*2);g.fill();
 g.fillStyle=L>=1?'#e1eaff':'#edf1ff';g.beginPath();g.ellipse(426,96,110,126,.4,0,Math.PI*2);g.fill();
 g.strokeStyle='#23295009';g.lineWidth=1;
 for(let i=0;i<430;i+=28){g.beginPath();g.moveTo(i,0);g.lineTo(i,576);g.stroke();}
 for(let i=0;i<570;i+=28){g.beginPath();g.moveTo(0,i);g.lineTo(430,i);g.stroke();}
 // Compact top HUD. No timer or invented spendable currency.
 box(g,18,16,40,38,'#fff',13,3,2.5);g.strokeStyle=C.ink;g.lineWidth=2.5;g.beginPath();g.moveTo(41,27);g.lineTo(32,35);g.lineTo(41,43);g.stroke();
 text(g,'ぽこもこと',215,27,17);text(g,'けいさん',215,50,21,C.blue);
 box(g,371,16,40,38,'#fff',13,3,2.5);g.strokeStyle=C.ink;g.lineWidth=2;g.beginPath();g.moveTo(381,32);g.lineTo(385,32);g.lineTo(390,27);g.lineTo(390,43);g.lineTo(385,38);g.lineTo(381,38);g.closePath();g.stroke();g.beginPath();g.arc(390,35,8,-.9,.9);g.stroke();
 for(let i=0;i<5;i++){const fill=i<Math.min(5,S.streak)?C.yellow:'#fff';g.fillStyle=fill;g.strokeStyle=C.ink;g.lineWidth=2;g.beginPath();g.arc(159+i*28,84,10.5,0,Math.PI*2);g.fill();g.stroke();if(i<S.streak)star(g,159+i*28,84,6,C.yellow,0,1);}
 // At 4, the empty socket is a static preview, not a countdown.
 if(S.streak===4&&!peak){g.strokeStyle=C.pink;g.lineWidth=3;g.beginPath();g.arc(271,84,14,0,Math.PI*2);g.stroke();text(g,'あと1つ！',318,131,21,C.blue);}
 if(L>=1){g.strokeStyle=C.ink;g.lineWidth=1.8;g.beginPath();g.moveTo(-5,113);g.quadraticCurveTo(215,156,435,113);g.stroke();for(let i=0;i<12;i++){const x=8+i*37,y=115+14*Math.sin(i/11*Math.PI);g.beginPath();g.moveTo(x-11,y);g.lineTo(x+11,y+1);g.lineTo(x,y+20);g.closePath();g.fillStyle=[C.blue,C.pink,C.yellow,C.mint][i%4];g.fill();g.stroke();}}
 if(big){g.save();round(g,0,102,430,173,0);g.clip();g.translate(181,249);g.rotate(S.age*.13);for(let i=0;i<14;i++){g.rotate(Math.PI*2/14);g.fillStyle=[C.yellow,'#fff9d9',C.mint,'#fff'][i%4];g.beginPath();g.moveTo(0,0);g.lineTo(-31,-400);g.lineTo(31,-400);g.closePath();g.fill();}g.restore();}
 if(L>=3&&!big){star(g,52,205,14,C.mint,.2);star(g,382,184,11,C.pink,-.2);star(g,343,240,8,C.yellow,.2);}
 // Ground remains at the actual sheet edge in every pose.
 g.strokeStyle=C.ink;g.lineWidth=2;g.beginPath();g.moveTo(33,273);g.quadraticCurveTo(215,268,397,273);g.stroke();
 let bx=215,ground=278,size=145,pose=0,squash=1,turn=0;
 const active=events.filter(e=>!e.wrong&&t>=e.t&&t<e.t+ARRIVAL).at(-1);
 if(active){const d=t-active.t;pose=d<.17?1:3;turn=d<.22?-.07:.04;squash=d<.12?1.035:1;bx=215-6*Math.sin(d/ARRIVAL*Math.PI);}
 if(peak){
  bx=lerp(215,143,ease(clamp(S.age/.22)));size=138;
  if(S.age<.08){pose=1;squash=1.12;}
  else if(S.age<.6){pose=2;const k=(S.age-.08)/.52;ground-=Math.sin(k*Math.PI)*(big?18:13);turn=Math.sin(k*Math.PI*2)*.07;}
  else if(S.age<.76){pose=7;squash=1+.09*Math.sin((S.age-.6)/.16*Math.PI);}
  else {pose=4;turn=Math.sin((S.age-.76)*6)*.025;}
 }
 g.fillStyle='#191d4820';g.beginPath();g.ellipse(bx,274,39*(1-(278-ground)/180),5,0,0,Math.PI*2);g.fill();
 bear(g,bx,ground,size,pose,{turn,squash});
 if(peak){let s=S.age<.2?lerp(.15,1.09,ease(S.age/.2)):1+.04*Math.exp(-(S.age-.2)*6)*Math.sin((S.age-.2)*18);caption(g,String(S.last.correct),309,181,s);}
 else if(S.streak>=5){text(g,'ほしのり！',325,189,23,C.blue);star(g,323,226,17,C.yellow,-.1);}
 if(S.retry)text(g,'もういちど',313,198,19,C.blue);
 // Paper and keys never translate during an effect.
 box(g,15,282,400,279,'#fff',20,6,3.2);
 box(g,29,296,87,29,C.blue,14,0,0);text(g,q.op==='−'?'ひきざん':'たしざん',72,310,14,'#fff');
 const cols=[198,254];
 for(let i=0;i<2;i++){text(g,String(q.a)[i],cols[i],366,44,C.ink,'Round');text(g,String(q.b)[i],cols[i],420,44,C.ink,'Round');}
 text(g,q.op,144,420,39,C.blue,'Round');
 g.strokeStyle=C.ink;g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(128,453);g.lineTo(287,453);g.stroke();
 const received=events.filter(e=>!e.wrong&&e.question===(isManual?manualQ:S.q)&&t>=e.t+ARRIVAL);
 const accepted=events.filter(e=>!e.wrong&&e.question===(isManual?manualQ:S.q)&&t>=e.t).length;
 for(let i=0;i<2;i++){
  g.fillStyle='#eef2ff';round(g,cols[i]-24,468,48,53,10);g.fill();
  const value=received.find(e=>e.cell===i);if(value)text(g,String(value.digit),cols[i],495,37,C.ink,'Round');
  if(!value&&i===(accepted===0?1:0)){g.strokeStyle=C.blue;g.lineWidth=2.3;round(g,cols[i]-24,468,48,53,10);g.stroke();g.strokeStyle='#386bff33';g.lineWidth=6;round(g,cols[i]-25,467,50,55,11);g.stroke();}
 }
 text(g,accepted===0?'一の位から':accepted===1?'十の位へ':'',215,543,13,'#5266a4');
 const palette=L>=3?['#ffe1ed','#fff1b7','#e3eaff','#fff1b7','#e3eaff','#dcfaf0','#e3eaff','#dcfaf0','#ffe1ed']:Array(9).fill('#fff');
 for(const [i,k] of keys.entries()){
  const pressed=S.latestInput&&String(S.latestInput.digit)===k.label&&t-S.latestInput.t<.115;
  const fill=pressed?C.pink:i<9?palette[i]:i===10?(L>=1?'#ddfaef':'#fff'):'#ffe2ed';
  box(g,k.x,k.y+(pressed?3:0),k.w,k.h,fill,14,pressed?1:5,2.8);
  text(g,k.label,k.x+k.w/2,k.y+k.h/2+1+(pressed?3:0),k.label==='⌫'?26:30,C.ink,'Round');
 }
 // A digit is carried through one visible contact point; no anatomical stretching.
 for(const e of events){const d=t-e.t;if(e.wrong||d<0||d>.78)continue;const key=keys.find(k=>k.label===String(e.digit));const from={x:key.x+key.w/2,y:key.y+key.h/2},paw={x:169,y:200},to={x:cols[e.cell],y:493};
  if(d<ARRIVAL){let p,angle;
   if(d<.22){const k=ease(d/.22);p=bez(from,{x:80,y:230},paw,k);angle=lerp(-.2,.08,k);}
   else if(d<.27){p=paw;angle=.08;}
   else {const k=(d-.27)/(ARRIVAL-.27);p=bez(paw,{x:326,y:265},to,k*k);angle=lerp(.08,0,k);}
   g.save();g.globalAlpha=.38;g.strokeStyle=C.pink;g.lineWidth=4;g.setLineDash([3,11]);g.beginPath();g.moveTo(from.x,from.y);g.quadraticCurveTo(80,230,paw.x,paw.y);if(d>.22)g.quadraticCurveTo(326,265,to.x,to.y);g.stroke();g.restore();
   g.save();g.translate(p.x,p.y);g.rotate(angle);box(g,-22,-25,44,48,'#fff',11,3,2.5);text(g,String(e.digit),0,0,29,C.ink,'Round');g.restore();
   if(d>.20&&d<.32){for(let i=0;i<3;i++){g.strokeStyle=C.pink;g.lineWidth=3;const a=-2.6+i*.6;g.beginPath();g.moveTo(paw.x+Math.cos(a)*28,paw.y+Math.sin(a)*28);g.lineTo(paw.x+Math.cos(a)*37,paw.y+Math.sin(a)*37);g.stroke();}}
  }else if(d<.72){const k=(d-ARRIVAL)/.25;g.globalAlpha=1-k;for(let i=0;i<4;i++)star(g,to.x+Math.cos(i*Math.PI/2+.2)*(32+k*14),to.y+Math.sin(i*Math.PI/2+.2)*(28+k*12),5,C.yellow,k,1.2);g.globalAlpha=1;}
 }
 if(peak){const n=big?24:11;for(let i=0;i<n;i++){const u=(i*0.618)%1,v=(i*.381)%1,age=S.age;const x=215+(u-.5)*400*(.25+clamp(age/.5)*.75),y=160-80*Math.sin(clamp(age/1.45)*Math.PI)+v*90+age*35;g.globalAlpha=clamp((1.45-age)*2);g.save();g.translate(x,y);g.rotate(i+age*(i%2?2:-2));if(i%3===0)star(g,0,0,7,[C.pink,C.yellow,C.mint][i%3],0,1.6);else{g.fillStyle=[C.pink,C.yellow,C.mint,C.blue][i%4];g.fillRect(-3,-6,6,12);}g.restore();}g.globalAlpha=1;}
 // Small beat movement is limited to earned background marks, never the sheet.
 if(L>=1&&!peak){for(let i=0;i<3;i++)star(g,48+i*15,242-(i%2?4:0),4+beat*.7,[C.pink,C.yellow,C.mint][i],0,1);}
 g.restore();
}
function clock(){return manual?(performance.now()-manualStart)/1000:playing?clamp(startOffset+(performance.now()-startAt)/1000,0,DURATION):time;}
async function stopAudio(){const old=ac;ac=null;graph=null;if(old&&old.state!=='closed')await old.close();}
async function startAudio(offset){await stopAudio();if(audioMode!=='candidate')return;ac=new AudioContext();await ac.resume();graph=makeGraph(ac);schedule(graph,ac.currentTime+.025,offset);}
function setTime(t){time=clamp(t,0,DURATION);scrub.value=String(time);document.querySelector('#time').textContent=`${time.toFixed(2)} / 12.00`;}
async function pause(){time=clock();playing=false;ref.pause();play.textContent='12秒を再生';await stopAudio();}
async function seek(t){manual=false;document.querySelector('#try').setAttribute('aria-pressed','false');await pause();setTime(t);ref.currentTime=t;draw(ctx,t);}
async function begin(){if(playing){await pause();return;}manual=false;document.querySelector('#try').setAttribute('aria-pressed','false');if(time>=DURATION-.02)time=0;ref.currentTime=time;ref.muted=audioMode!=='reference';ref.volume=.18;await startAudio(time);await ref.play().catch(()=>{});startOffset=time;startAt=performance.now();playing=true;play.textContent='一時停止';status.textContent='同じ12秒を等速で再生しています。';}
function tick(){const t=clock();draw(ctx,t,manual?manualEvents:inputs,manual);if(playing){setTime(t);if(t>=DURATION){playing=false;ref.pause();play.textContent='12秒を再生';if(!recording)void stopAudio();status.textContent='12秒の比較が終わりました。音を切り替えて再生できます。';}}requestAnimationFrame(tick);}
play.addEventListener('click',()=>void begin());
document.querySelector('#reset').addEventListener('click',()=>void seek(0));
scrub.addEventListener('input',()=>void seek(Number(scrub.value)));
document.querySelectorAll('[data-at]').forEach(b=>b.addEventListener('click',()=>void seek(Number(b.dataset.at))));
document.querySelectorAll('[data-audio]').forEach(b=>b.addEventListener('click',async()=>{audioMode=b.dataset.audio;document.querySelectorAll('[data-audio]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));ref.muted=audioMode!=='reference';if(playing){const t=clock();await startAudio(t);}else await stopAudio();}));
async function startManual(){await pause();manual=true;manualEvents=[];manualQ=0;manualStep=0;manualStreak=2;manualNext=0;manualStart=performance.now();document.querySelector('#try').setAttribute('aria-pressed','true');status.textContent='27 + 35 を一の位から。画面のキーか、キーボードの数字で試せます。記録は保存しません。';canvas.focus();if(audioMode==='candidate'){ac=new AudioContext();await ac.resume();graph=makeGraph(ac);}}
document.querySelector('#try').addEventListener('click',()=>void startManual());
function pressKey(label){if(!manual)return;const t=clock();if(label==='C'||label==='⌫'){
  if(manualStep===2)return;
  if(label==='C'){manualEvents=manualEvents.filter(e=>e.question!==manualQ);manualStep=0;}
  else {const last=manualEvents.findLast(e=>e.question===manualQ&&!e.wrong);if(last){manualEvents=manualEvents.filter(e=>e!==last);manualStep=Math.max(0,manualStep-1);}}
  return;
 }
 if(!/^\d$/.test(label))return;
 if(t>=manualNext&&manualStep===2){manualQ++;manualStep=0;}
 if(manualStep===2)return;
 const q=questions[manualQ%questions.length],cell=1-manualStep,digit=Number(label),correct=digit===Number(q.answer[cell]);
 const e={t,digit,question:manualQ,cell,wrong:!correct};
 if(correct){manualStep++;if(manualStep===2){manualStreak++;e.correct=manualStreak;manualNext=t+ARRIVAL+.14;}}
 else manualStreak=0;
 manualEvents.push(e);
 if(graph){const at=ac.currentTime;cue(graph,'tap',at,{digit});if(correct){cue(graph,'catch',at+.22);cue(graph,'place',at+ARRIVAL);if(e.correct){cue(graph,'correct',at+ARRIVAL,{streak:e.correct});if(e.correct===3||e.correct===5)cue(graph,e.correct===5?'peak':'jump',at+ARRIVAL+.09);cue(graph,'land',at+ARRIVAL+.62);}}else cue(graph,'retry',at+.03);}
 if(manualStep===2){setTimeout(()=>{if(manual&&manualQ===e.question&&manualStep===2){manualQ++;manualStep=0;status.textContent='次の問題を入力できます。';}},(ARRIVAL+.14)*1000);}
}
canvas.addEventListener('pointerdown',e=>{if(!manual)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*430,y=(e.clientY-r.top)/r.height*860;const k=keys.find(k=>x>=k.x&&x<=k.x+k.w&&y>=k.y&&y<=k.y+k.h);if(k)pressKey(k.label);});
canvas.addEventListener('keydown',e=>{if(/^\d$/.test(e.key)||e.key==='Backspace'||e.key==='Delete'){e.preventDefault();pressKey(e.key==='Backspace'?'⌫':e.key==='Delete'?'C':e.key);}});
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);}
document.querySelector('#wav').addEventListener('click',async()=>{status.textContent='同じ譜面を音声ファイルへ書き出しています。';const r=await renderWav();download(r.blob,'pokomoko-pop-study.wav');status.textContent=`音を書き出しました。計算上の最大振幅 ${(20*Math.log10(r.peak)).toFixed(1)} dBFS。聴感の合格判定ではありません。`;});
document.querySelector('#frames').addEventListener('click',async()=>{const c=document.createElement('canvas');c.width=1720;c.height=860;const g=c.getContext('2d');for(const [i,t]of[0,1.12,2.08,8.9].entries()){const f=document.createElement('canvas');f.width=430;f.height=860;draw(f.getContext('2d'),t);g.drawImage(f,i*430,0);}c.toBlob(b=>download(b,'pokomoko-pop-study-four-states.png'));});
document.querySelector('#record').addEventListener('click',async()=>{
 if(recording)return;recording=true;const button=document.querySelector('#record');button.disabled=true;await pause();manual=false;time=0;audioMode='candidate';document.querySelectorAll('[data-audio]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.audio===audioMode)));
 ac=new AudioContext();await ac.resume();graph=makeGraph(ac);const dest=ac.createMediaStreamDestination();graph.out.connect(dest);
 const visual=canvas.captureStream(30),stream=new MediaStream([...visual.getVideoTracks(),...dest.stream.getAudioTracks()]);
 const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm';const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5500000});const chunks=[];
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{download(new Blob(chunks,{type:'video/webm'}),'pokomoko-pop-study.webm');stream.getTracks().forEach(x=>x.stop());void stopAudio();recording=false;button.disabled=false;status.textContent='音付き12秒の動画を書き出しました。';};
 recorder.start();schedule(graph,ac.currentTime+.06,0);ref.currentTime=0;ref.muted=true;void ref.play();startAt=performance.now()+60;startOffset=0;playing=true;play.textContent='収録中…';status.textContent='12秒の動画を収録しています。';setTimeout(()=>recorder.stop(),12120);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!recording)void pause();});
status.textContent='準備できました。再生すると画面と音が同時に始まります。';draw(ctx,0);requestAnimationFrame(tick);
