const catalogUrl = new URL('../../product/island-place-goals.json', import.meta.url);
const $ = (id) => document.getElementById(id);
const roles = {
 tree:{name:'木',color:'#7174c2',glyph:'tree'},
 seat:{name:'ベンチ',color:'#b4895e',glyph:'seat'},
 home:{name:'家',color:'#bf7e9a',glyph:'home'},
 water:{name:'水ばち',color:'#488bc1',glyph:'water'},
 channel:{name:'みずみち',color:'#64a8c8',glyph:'channel'},
 flower:{name:'花',color:'#c987b1',glyph:'flower'},
 play:{name:'あそびば',color:'#cd9e5b',glyph:'play'}
};
const families = {
 grove:{name:'森',color:'#7272bd',glyph:'tree'},
 spring:{name:'泉',color:'#488bc1',glyph:'water'},
 community:{name:'集落',color:'#b37e9d',glyph:'home'},
 flowers:{name:'花',color:'#c987b1',glyph:'flower'},
 island:{name:'島',color:'#879bd0',glyph:'island'}
};
const maturity = {
 mature:'成熟した木', 'mature; at least 2 big':'成熟4本・うち大木2本',
 placed:'配置する', 'stage>=2; style=tree':'木の家・こや以上',
 supplied:'水源から通水', bloomed:'咲いた花', 'stage>=2':'こや以上',
 built:'建築が完成', 'placed; water reaches play':'あそびばに水が届く'
};
const shapes = {
 tree:'<path d="M12 14v7" stroke="currentColor" stroke-width="2"/><path d="M12 2c-5 0-8 4-8 8 0 4 3 6 8 6s8-2 8-6c0-4-3-8-8-8Z" fill="currentColor" opacity=".8"/>',
 seat:'<path d="M4 9h16v5H4z" fill="currentColor"/><path d="M5 4h14v4H5z" fill="currentColor" opacity=".65"/><path d="M6 14v6m12-6v6" stroke="currentColor" stroke-width="2"/>',
 home:'<path d="m2 10 10-8 10 8" fill="currentColor"/><path d="M5 9h14v12H5z" fill="currentColor" opacity=".65"/><path d="M10 15h4v6h-4z" fill="white"/>',
 water:'<ellipse cx="12" cy="15" rx="10" ry="6" fill="currentColor" opacity=".45"/><ellipse cx="12" cy="12" rx="8" ry="4" fill="currentColor"/><path d="M8 12h7" stroke="white" opacity=".8"/>',
 channel:'<path d="M3 5h18v14H3z" fill="currentColor" opacity=".3"/><path d="M3 12h18" stroke="currentColor" stroke-width="5"/>',
 flower:'<path d="M12 14v8" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="4" fill="currentColor"/><circle cx="7" cy="10" r="4" fill="currentColor" opacity=".7"/><circle cx="17" cy="10" r="4" fill="currentColor" opacity=".7"/><circle cx="9" cy="5" r="4" fill="currentColor" opacity=".8"/><circle cx="15" cy="5" r="4" fill="currentColor" opacity=".8"/><circle cx="12" cy="9" r="3" fill="#f2d888"/>',
 play:'<path d="m3 21 7-18h5l7 18M6 12h12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 5v10m-4 1h8" stroke="currentColor" stroke-width="2"/>',
 island:'<ellipse cx="12" cy="14" rx="11" ry="6" fill="currentColor" opacity=".4"/><path d="M3 13c2-3 3-2 5-4 3-3 5-1 6 0 4-1 5 0 7 4-5 4-13 4-18 0Z" fill="currentColor"/>'
};
function icon(glyph,cls='') { return '<svg '+(cls?'class="'+cls+'" ':'')+'viewBox="0 0 24 24" aria-hidden="true">'+shapes[glyph]+'</svg>'; }
function makeButton(text,cls,click) {
 const b=document.createElement('button'); b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',click);return b;
}
function setText(id,text) { $(id).textContent=text; }
function inputChip(input) {
 const meta=roles[input.role], el=document.createElement('div');
 el.className='input-chip';el.style.setProperty('--accent',meta.color);
 el.innerHTML=icon(meta.glyph)+'<div><b></b><small></small></div>';
 el.querySelector('b').textContent=meta.name+' × '+input.count;
 el.querySelector('small').textContent=maturity[input.state]||input.state;return el;
}
let catalog,selectedGoal='P02',selectedVariant=0,selectedStage=2;
function selectGoal(id) { selectedGoal=id;selectedVariant=0;selectedStage=2;renderGoal(); }
function renderGoal() {
 const g=catalog.goals.find(x=>x.id===selectedGoal);
 document.body.dataset.goal=g.id;document.body.dataset.variant=g.variants[0]?.id||'island';document.body.dataset.stage=g.stages[selectedStage].id;
 document.querySelectorAll('.goal-button,.hotspot').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.goal===g.id)));
 setText('goal-kicker',g.id+' · '+g.scale);setText('goal-name',g.name);setText('goal-intent',g.intent);
 $('goal-art').src=new URL(g.image,catalogUrl).href;$('goal-art').alt=g.name+'の成熟実3Dの一例';
 $('goal-art-link').href='../2026-10-10-island-final-3d/';
 $('inputs').replaceChildren(...g.inputs.map(inputChip));
 if(!g.inputs.length){const p=document.createElement('p');p.className='small-note';p.textContent='森・泉・花・集落から、好きな3系列以上を育てる。';$('inputs').append(p);}
 $('variant-buttons').replaceChildren(...g.variants.map((v,i)=>{
  const b=makeButton(v.label,'variant-button',()=>{selectedVariant=i;renderVariant(g);});
  b.dataset.variant=v.id;b.setAttribute('aria-pressed',String(i===selectedVariant));return b;
 }));
 $('stage-buttons').replaceChildren(...g.stages.map((s,i)=>{
  const b=makeButton('','stage-button',()=>{selectedStage=i;renderStage(g);renderVariant(g);});
  const n=document.createElement('span');n.textContent='0'+(i+1);b.append(n,document.createTextNode(s.label));
  b.dataset.stage=s.id;b.setAttribute('aria-pressed',String(i===selectedStage));return b;
 }));
 setText('space-rule',g.space);
 $('next-goals').replaceChildren(...g.next.map(id=>{
  const next=catalog.goals.find(x=>x.id===id);return makeButton(next.name+' →','next-button',()=>selectGoal(id));
 }));
 if(!g.next.length){const p=document.createElement('span');p.className='next-end';p.textContent='その先も、新しい地区へ広げられる。';$('next-goals').append(p);}
 renderStage(g);renderVariant(g);
}
function renderStage(g) {
 const s=g.stages[selectedStage];document.body.dataset.stage=s.id;
 document.querySelectorAll('.stage-button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedStage)));
 $('stage-detail').replaceChildren(...[['成立する条件',s.condition,''],['育つ形',s.changes,''],['できる遊び',s.play,' play']].map(([label,body,cls])=>{
  const d=document.createElement('div');d.className='stage-item'+cls;
  const h=document.createElement('small');h.textContent=label;const p=document.createElement('p');p.textContent=body;d.append(h,p);return d;
 }));
}
function connected(a,b,demo) {
 const dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);if(dx+dz===1)return true;
 if((dx===2&&dz===0)||(dx===0&&dz===2)){
  const middle=demo.find(p=>p.x===(a.x+b.x)/2&&p.z===(a.z+b.z)/2);
  return !middle||!['tree','home','seat','play'].includes(middle.role);
 }return false;
}
function diagram(g,v) {
 const demo=v.demo,step=44,px=x=>24+x*step+step/2,pz=z=>20+z*step+step/2;
 let grid='';for(let x=0;x<7;x++)for(let z=0;z<6;z++)grid+='<rect x="'+(24+x*step)+'" y="'+(20+z*step)+'" width="40" height="40" rx="7" fill="#ffffff" stroke="#dfe7f2"/>';
 let lines='',nature=demo.filter(p=>['tree','flower'].includes(p.role));
 if(selectedStage>0) {
  const candidates=g.family==='spring'?demo.filter(p=>['water','channel'].includes(p.role)):nature;
  candidates.forEach((a,i)=>candidates.slice(i+1).forEach(b=>{
   const yes=g.family==='spring'?Math.abs(a.x-b.x)+Math.abs(a.z-b.z)===1:connected(a,b,demo);
   if(yes)lines+='<path d="M'+px(a.x)+' '+pz(a.z)+'L'+px(b.x)+' '+pz(b.z)+'" stroke="'+(g.family==='spring'?'#80b9d4':'#b8b4d9')+'" stroke-width="12" stroke-linecap="round" opacity=".7"/>';
  }));
 }
 // This is a layout explanation. It does not assert runtime footprints, floors, or 3D maturity.
 let nodes=demo.map(p=>{
  const r=roles[p.role];return '<g transform="translate('+(px(p.x)-13)+' '+(pz(p.z)-13)+')" style="color:'+r.color+'"><rect x="-5" y="-5" width="36" height="36" rx="11" fill="#fff" stroke="'+r.color+'" stroke-opacity=".3"/><svg width="26" height="26" viewBox="0 0 24 24">'+shapes[r.glyph]+'</svg></g>';
 }).join('');
 return '<svg viewBox="0 0 356 304" role="img" aria-label="'+g.name+'、'+v.label+'の配置図"><title>'+g.name+'：'+v.result+'</title>'+grid+lines+nodes+'</svg>';
}
function routeDiagram() {
 const meta=['grove','spring','flowers','community'];let circles='',links='';
 const positions=[[85,76],[258,76],[85,224],[258,224]];
 positions.forEach(([x,z],i)=>{
  const f=families[meta[i]];circles+='<g transform="translate('+x+' '+z+')"><circle r="37"/><svg x="-13" y="-21" width="26" height="26" viewBox="0 0 24 24" style="color:'+f.color+'">'+shapes[f.glyph]+'</svg><text y="23" text-anchor="middle">'+f.name+'</text></g>';
 });
 links='<path class="route-path" d="M123 76h97M85 113v73M258 113v73M123 224h97"/>';
 return '<svg viewBox="0 0 356 304" role="img" aria-label="森、泉、花、集落の異なる場所を歩ける経路でつなぐ配置の説明図" class="island-route">'+links+circles+'<text x="178" y="157" text-anchor="middle">好きな3系列以上</text></svg>';
}
function renderVariant(g) {
 const v=g.variants[selectedVariant];document.body.dataset.variant=v?.id||'island';
 document.querySelectorAll('.variant-button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selectedVariant)));
 $('layout-diagram').innerHTML=v?diagram(g,v):routeDiagram();
 setText('variant-result',v?v.result:'違う場所をめぐる、自分だけの島');
 const terrain={slope:'段泉は、実際の段差と下降する水の経路がある場所で育つ。',shore:'海岸と入口の向きが、岸へ開く庭をつくる。',any:'空けた庭と入口が、列・塊・中庭の形を変える。'};
 setText('terrain-note',v?terrain[v.terrain]:'全種類を集めなくても成立。地区や人口の上限にはしない。');
 const distinct=[...new Set(g.inputs.map(i=>i.role))];
 $('legend').replaceChildren(...distinct.map(role=>{
  const r=roles[role],span=document.createElement('span');span.style.setProperty('--accent',r.color);span.innerHTML='<i></i>';span.append(document.createTextNode(r.name));return span;
 }));
}
function renderCatalog() {
 $('island-image').src=new URL(catalog.artBaseline.image,catalogUrl).href;
 $('goal-buttons').replaceChildren(...catalog.goals.map(g=>{
  const f=families[g.family],b=makeButton('','goal-button',()=>selectGoal(g.id));b.dataset.goal=g.id;b.style.setProperty('--accent',f.color);
  b.innerHTML=icon(f.glyph,'goal-icon')+'<strong></strong><small></small>';
  b.querySelector('strong').textContent=g.name;b.querySelector('small').textContent=g.scale;return b;
 }));
 $('hotspots').replaceChildren(...catalog.goals.filter(g=>g.id!=='P06').map(g=>{
  const b=makeButton('','hotspot',()=>{selectGoal(g.id);$('goal-detail').scrollIntoView({block:'start',behavior:'instant'});});
  b.dataset.goal=g.id;b.style.left=g.focus.x+'%';b.style.top=g.focus.y+'%';b.style.setProperty('--accent',families[g.family].color);
  const dot=document.createElement('i');b.append(dot,document.createTextNode(g.name));return b;
 }));
 $('combination-cards').replaceChildren(...catalog.combinations.map(c=>{
  const card=document.createElement('article');card.className='combination-card';
  const row=document.createElement('div');row.className='family-row';
  c.families.forEach((key,i)=>{
   if(i)row.append(document.createTextNode('＋'));
   const f=families[key],badge=document.createElement('span');badge.className='family-badge';badge.style.setProperty('--accent',f.color);badge.innerHTML=icon(f.glyph);badge.append(document.createTextNode(f.name));row.append(badge);
  });
  const h=document.createElement('h3');h.textContent=c.name;
  const p=document.createElement('p');p.textContent=c.visible;
  const play=document.createElement('div');play.className='relation-play';const small=document.createElement('small');small.textContent='ここでできること';const desc=document.createElement('p');desc.textContent=c.play;play.append(small,desc);
  const rule=document.createElement('p');rule.className='relation-condition';rule.textContent=c.condition;
  card.append(row,h,p,play,rule);return card;
 }));
 $('delivery-cards').replaceChildren(...catalog.delivery.map(d=>{
  const card=document.createElement('article');card.className='delivery-card';
  const small=document.createElement('small');small.textContent=d.id+' · '+d.goal;
  const h=document.createElement('h3');h.textContent=d.name;const p=document.createElement('p');p.textContent=d.done;card.append(small,h,p);return card;
 }));
 renderGoal();$('load-status').hidden=true;document.body.dataset.ready='true';
}
try { const response=await fetch(catalogUrl);if(!response.ok)throw new Error('HTTP '+response.status);catalog=await response.json();renderCatalog(); }
catch(error) {setText('load-status','資料を読み込めませんでした。ページを再読み込みしてください。');console.error(error);}

