'use strict';
// Editorial views of the improvement plan. These diagrams never run the island simulation.
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const planLink = (plan, label) => `<a href="../${esc(plan.source)}">${esc(label)} ↗</a>`;
function renderPolicy(plan) {
  if (!plan) return '';
  return `<div class="pp-refinement" id="simple-depth" aria-labelledby="simple-depth-title">
    <div class="pp-refinement-intro"><p class="pp-kicker">FEWER RULES TO REMEMBER, MORE WAYS TO PLAY</p><h3 id="simple-depth-title">${esc(plan.title)}</h3><p>${esc(plan.core)}</p><p class="pp-plan-label">${esc(plan.status)}</p></div>
    <div class="pp-core-verbs">${plan.verbs.map((v,i)=>`<article><span>0${i+1}</span><h4>${esc(v.title)}</h4><p>${esc(v.detail)}</p><small>${esc(v.example)}</small></article>`).join('')}</div>
    <div class="pp-refinement-decisions">${plan.decisions.map((d,i)=>`<details${i===0?' open':''}><summary><span>0${i+1}</span><strong>${esc(d.title)}</strong><span class="pp-decision-action">${esc(d.action)}</span><span aria-hidden="true">＋</span></summary><div><p class="pp-decision-before"><b>気になる重さ</b>${esc(d.before)}</p><p><b>こう整理する</b>${esc(d.after)}</p><p class="pp-decision-guard"><b>守ること</b>${esc(d.guard)}</p></div></details>`).join('')}</div>
    <p class="pp-small">${planLink(plan,'採用した改善方針と具体条件')} · 項目数の削減を目標にせず、本人が覚える規則と、試した結果の違いで判断します。</p>
  </div>`;
}
function woodDiagram(view) {
  const points={open:[[80,55],[235,50],[95,157],[255,165]],row:[[65,100],[140,100],[215,100],[290,100]],court:[[100,55],[250,55],[100,160],[250,160]]}[view];
  const path={open:'M25 195 Q60 125 180 115 T330 45',row:'M30 150 H330',court:'M175 210 V85'}[view];
  const canopy=view==='row'?'<rect x="46" y="77" width="265" height="57" rx="28" fill="#e6e0f1"/>':view==='court'?'<rect x="120" y="70" width="110" height="100" rx="28" fill="#eee8f6"/>':'';
  const bench={open:[175,115],row:[240,155],court:[175,115]}[view];
  const connection=view==='row'?'<path d="M65 100H290" fill="none" stroke="#9a86bc" stroke-width="3"/>':view==='court'?'<path d="M100 160V55H250V160" fill="none" stroke="#9a86bc" stroke-width="3"/>':'';
  return `<svg viewBox="0 0 360 235" class="pp-depth-svg" role="img" aria-label="同じ木4本とベンチ1つを${esc({open:'離す',row:'列にする',court:'庭を囲む'}[view])}配置の模式図"><path d="M20 30Q170 0 340 30L346 215Q170 238 14 215Z" fill="#f8f6fb" stroke="#dcd5e8"/>${canopy}${connection}<path d="${path}" fill="none" stroke="#b7b0c8" stroke-width="3" stroke-dasharray="5 6"/>${points.map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M0 0v21" stroke="#9a8199" stroke-width="7"/><circle cx="0" cy="-9" r="24" fill="#b0a1d0"/><circle cx="-8" cy="-15" r="13" fill="#c5b9df"/></g>`).join('')}<g transform="translate(${bench[0]-17} ${bench[1]})"><rect width="34" height="12" rx="3" fill="#ba8c83"/><path d="M5 12v9m24-9v9" stroke="#907479" stroke-width="3"/></g><text x="180" y="224" text-anchor="middle" fill="#625a70" font-size="11">同じ所有物 ／ 配置だけ変える</text></svg>`;
}
function waterDiagram(view) {
  const farm=view==='farm';
  const pipe=farm?'M85 65H275V135':'M85 65V185H225';
  const joints=farm?[[130,65],[180,65],[230,65],[275,100]]:[[85,115],[85,165],[130,185],[180,185]];
  return `<svg viewBox="0 0 360 235" class="pp-depth-svg" role="img" aria-label="同じ水源1つ・水路4つ・畑1つで${farm?'畑に水を届ける':'畑への接続を外し、岸へ水を回す'}配置の模式図"><path d="M20 30Q170 0 340 30L346 215Q170 238 14 215Z" fill="#f8f6fb" stroke="#dcd5e8"/><rect x="240" y="110" width="70" height="64" rx="12" fill="${farm?'#d8d4a7':'#e4d4bc'}"/><path d="M250 128h50m-50 14h50m-50 14h50" stroke="#a89376" stroke-width="2"/><text x="275" y="99" text-anchor="middle" fill="#625a70" font-size="12">畑</text>${farm?'':'<ellipse cx="225" cy="189" rx="39" ry="15" fill="#d4e7f3"/>'}<path d="${pipe}" fill="none" stroke="#d4e7f3" stroke-width="23" stroke-linejoin="round"/><path d="${pipe}" fill="none" stroke="#7fafd0" stroke-width="9" stroke-linejoin="round"/>${joints.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#eaf6fc"/>`).join('')}<ellipse cx="85" cy="65" rx="26" ry="18" fill="#8eb7d5" stroke="#a89dba" stroke-width="5"/><text x="85" y="34" text-anchor="middle" fill="#625a70" font-size="12">水源</text><text x="268" y="213" text-anchor="middle" fill="#625a70" font-size="11">${farm?'給水先：畑':'給水先：岸'}</text><text x="180" y="231" text-anchor="middle" fill="#625a70" font-size="11">波紋と、時間で変わる湿りを区別</text></svg>`;
}
function renderLab(plan) {
  if (!plan) return '';
  return `<div class="pp-depth-labs" id="depth-experiments"><div class="pp-lab-heading"><p class="pp-kicker">SAME THINGS, DIFFERENT CHOICES</p><h3>増やす前に、置き直したくなる。</h3><p>持ち物を増やさず、位置とつながりを変えて比べる。すぐ返る反応と、時間をかけて育つ変化を分けます。</p></div>${plan.experiments.map((lab,index)=>`<section class="pp-depth-lab" data-depth-lab="${esc(lab.id)}" aria-labelledby="depth-${esc(lab.id)}"><div class="pp-lab-description"><span class="pp-kicker">EXPERIMENT 0${index+1}</span><h4 id="depth-${esc(lab.id)}">${esc(lab.title)}</h4><p>${esc(lab.materials)}</p><small>${esc(lab.precondition)}</small><ol>${lab.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p class="pp-small">${esc(lab.boundary)}</p></div><div class="pp-lab-compare"><fieldset data-depth-controls hidden><legend>配置を切り替えて比べる</legend>${lab.views.map((v,i)=>`<label><input type="radio" name="depth-${esc(lab.id)}" aria-controls="lab-${esc(lab.id)}-${esc(v.id)}" value="${esc(v.id)}"${i===0?' checked':''}><span>${esc(v.title)}</span></label>`).join('')}</fieldset>${lab.views.map(v=>`<div id="lab-${esc(lab.id)}-${esc(v.id)}" role="region" aria-label="${esc(v.title)}の配置" data-depth-view="${esc(v.id)}">${lab.id==='wood'?woodDiagram(v.id):waterDiagram(v.id)}<h5>${esc(v.title)}</h5><dl><div><dt>すぐ見える</dt><dd>${esc(v.now)}</dd></div><div><dt>暮らしへの違い</dt><dd>${esc(v.consequence)}</dd></div><div><dt>次に試す</dt><dd>${esc(v.next)}</dd></div></dl></div>`).join('')}</div></section>`).join('')}<p class="pp-diagram-note">説明用の配置図。実際の通水・成熟・歩行・所有の計算は行いません。${esc(plan.experimentNote)}</p></div>`;
}
function renderRoutes(plan) {
  if (!plan) return '';
  return `<div class="pp-route-depth"><h3>初めて触る。その先も、工夫が続く。</h3><p>6島の固有種を受け取ったあとも、同じ仕掛けを別の置き方で楽しむ計画です。</p><div class="pp-route-depth-grid">${plan.islands.map((island,index)=>`<article><div class="pp-route-number"><span>ISLAND 0${index+1}</span><span aria-hidden="true">${["≈","♧","◇","☁","⚙","☆"][index]}</span></div><h4>${esc(island.title)}</h4><dl><div><dt>着いたら</dt><dd>${esc(island.first)}</dd></div><div><dt>ひと工夫</dt><dd>${esc(island.change)}</dd></div><div><dt>獲得したあと</dt><dd>${esc(island.return)}</dd></div></dl><small>${esc(island.status)}</small></article>`).join('')}</div><p class="pp-small">${esc(plan.routeBoundary)}</p></div>`;
}
function renderMemory(plan) {
  if (!plan) return '';
  return `<div class="pp-memory-plan"><h3>思い出は一か所から、3つの使い方へ。</h3><p>${esc(plan.memory.summary)}</p><div>${plan.memory.actions.map(a=>`<article><span>${esc(a.title)}</span><p>${esc(a.detail)}</p></article>`).join('')}</div><p class="pp-small">${esc(plan.memory.boundary)}</p></div>`;
}
function renderDelivery(plan) {
  if (!plan) return '';
  return `<div class="pp-refinement-delivery"><h3>この順で、遊びの違いまで確かめる。</h3><ol>${plan.delivery.map(p=>`<li><span>${esc(p.id)}</span><div><h4>${esc(p.title)}</h4><p>${esc(p.scope)}</p><small>合格条件：${esc(p.acceptance)}</small></div></li>`).join('')}</ol><details><summary>困った時も、元の続きを守る</summary><dl>${plan.recovery.map(r=>`<div><dt>${esc(r.state)}</dt><dd>${esc(r.behavior)}</dd></div>`).join('')}</dl></details></div>`;
}
module.exports={renderPolicy,renderLab,renderRoutes,renderMemory,renderDelivery};
