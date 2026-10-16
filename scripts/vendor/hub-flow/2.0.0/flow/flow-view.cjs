'use strict';
const fs = require('node:fs'), path = require('node:path');
const {assertGraph} = require('./graph-check.cjs');
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states = {active:'進行中',queued:'順番待ち',stopped:'停止中',done:'完了',unknown:'未確認',pass:'合格',fail:'不合格',proposal:'提案・未採用'};
const css = () => fs.readFileSync(path.join(__dirname,'graph.css'),'utf8');
function graphIds(flow,prefix='work-flow') {
  return [prefix,prefix+'-title',...['goals','stages','items','artifacts','checks'].flatMap(k=>flow[k].map(x=>`${prefix}-${k}-${x.id}`))];
}
function renderWorkGraph(flow,{prefix='work-flow',compact=false,href='/flow/'}={}) {
  assertGraph(flow);
  if (!/^[a-z][\w-]*$/.test(prefix)) throw Error('Unsafe graph prefix');
  if (!/^\/(?!\/)[\w/-]*$/.test(href)) throw Error('Unsafe graph link');
  const id = (kind,x) => `${prefix}-${kind}-${x.id}`;
  const state = x => `<span class="wg-state wg-${x.status}">${esc(states[x.status])}</span>${x.basis === 'proposal' ? '<span class="wg-muted">推測・提案</span>' : ''}`;
  const nodes = new Map(flow.nodes.map(n=>[n.id,n]));
  const details = x => `<details class="wg-details"><summary>詳しく：根拠と作業用の記録</summary><pre>${esc(JSON.stringify(x,null,2))}</pre></details>`;
  const itemCard = item => {
    const dependencies = flow.dependencies.filter(d=>d.to === item.id);
    const at = nodes.get(item.current_node);
    if (compact) return `<li><a href="${esc(href)}#work-flow-items-${esc(item.id)}">${esc(item.title)}</a><span>現在地：${esc(at.title)} · ${esc(states[item.status])}${item.needs_yu.required?' · Yuの判断待ち':''}</span>${item.why_stopped?`<span class="wg-stop">止まった理由：${esc(item.why_stopped)}</span>`:''}</li>`;
    const outputs = flow.artifacts.filter(a=>a.item_id === item.id);
    return `<li class="wg-task" id="${id('items',item)}"><h4>${esc(item.title)}</h4>${state(item)}<p>現在地：${esc(at.title)}</p>${item.why_stopped?`<p class="wg-stop"><strong>止まった理由：</strong>${esc(item.why_stopped)}</p>`:''}${item.needs_yu.required?`<p class="wg-decision"><strong>Yuが決めること：</strong>${esc(item.needs_yu.content)}</p>`:''}${dependencies.length?`<ul class="wg-dependencies" aria-label="先に解くべきこと">${dependencies.map(d=>`<li>先に <a href="#${prefix}-items-${esc(d.from)}">${esc(flow.items.find(x=>x.id===d.from).title)}</a> → この作業${d.basis==='proposal'?'（推測・提案）':''}<p>${esc(d.reason)}</p></li>`).join('')}</ul>`:'<p class="wg-muted">先に解く作業の指定なし</p>'}<ol class="wg-outputs" aria-label="成果物から検査結果へ">${outputs.map(a=>`<li id="${id('artifacts',a)}"><h5>成果物：${esc(a.title)}</h5>${state(a)}<p>${esc(a.description)}</p>${flow.checks.filter(c=>c.artifact_id===a.id).map(c=>`<div class="wg-check" id="${id('checks',c)}"><h5>検査結果：${esc(c.title)}</h5>${state(c)}<p>${esc(c.result)}</p>${details(c)}</div>`).join('')}${details(a)}</li>`).join('')}</ol><details class="wg-details"><summary>次の一手・根拠・作業用の記録</summary><p>${esc(item.next)}</p><pre>${esc(JSON.stringify(item,null,2))}</pre></details></li>`;
  };
  const counts = compact ? `<p class="wg-current-summary">進行中 ${flow.items.filter(i=>i.status==='active').length}件 · 停止 ${flow.items.filter(i=>i.status==='stopped').length}件 · <strong>Yuの判断待ち ${flow.items.filter(i=>i.needs_yu.required).length}件</strong></p>` : '';
  const goals = flow.goals.map(goal=>`<div class="wg-goal"${compact?'':` id="${id('goals',goal)}"`}><strong>目標：${esc(goal.title)}</strong>${state(goal)}</div>`).join('');
  const stages = flow.stages.map(stage=>`<li class="wg-stage"${compact?'':` id="${id('stages',stage)}"`}><h3>${esc(stage.title)}</h3>${state(stage)}${compact?'':`<p class="wg-muted">目標：${esc(flow.goals.find(g=>g.id===stage.goal_id).title)}</p>`}<ol class="wg-tasks">${flow.items.filter(i=>i.stage_id===stage.id).sort((a,b)=>a.order-b.order).map(itemCard).join('')}</ol>${compact?'':details(stage)}</li>`).join('');
  return `<section class="work-graph${compact?' wg-compact':''}" id="${prefix}" aria-labelledby="${prefix}-title"><div class="wg-heading"><h2 id="${prefix}-title">作業の流れ${compact?'の要約':'（グラフ）'}</h2>${compact?`<a href="${esc(href)}">流れと判断の詳しい内容へ →</a>`:''}</div>${counts}${goals}${compact?'':'<p>目標 → 段階 → 作業 → 成果物 → 検査結果。青は進行中、赤は停止、紫は判断待ち。状態は文字でも示します。</p>'}<ol class="wg-stages" aria-label="段階ごとの作業と現在地">${stages}</ol>${compact?'':flow.goals.map(details).join('')}</section>`;
}
module.exports = {renderWorkGraph,graphIds,css,states};
