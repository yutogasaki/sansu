'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local=(file,label)=>`<a href="../${esc(file)}">${esc(label)} ↗</a>`;
function inputs(data) {
  return [...data.benchmarks.games.map(g=>g.source),...data.benchmarks.inspirations.map(g=>g.source),...data.benchmarks.reading.map(r=>r.source),'scripts/portal-proposal-benchmarks.cjs'];
}
function validate(root,data) {
  const b=data.benchmarks;
  if(!b||b.games.length!==5||b.inspirations.length!==5||b.synthesis.length!==3||!b.checkedAt)throw Error('Incomplete benchmark overview');
  const ids=new Set();
  const ledgerPath=data.sources.benchmarkReferences;
  const ledger=JSON.parse(fs.readFileSync(path.join(root,ledgerPath),'utf8'));
  for(const game of b.games){
    if(!/^[a-z]+(?:-[a-z]+)*$/.test(game.id)||ids.has(game.id)||!game.name||!game.creator||!game.role||!game.observation||!game.translation||!game.boundary||!game.evidence||!game.studyDate||!game.links.length)throw Error('Invalid benchmark: '+game.id);
    ids.add(game.id);
    for(const ref of game.links){const url=new URL(ref.url);if(url.protocol!=='https:'||!ref.label)throw Error('Invalid benchmark reference');}
    if(game.asset){
      const asset=data.assets[game.asset],ref=ledger.references.find(r=>r.id===game.referenceId);
      if(!asset||!ref||asset.source!==ledgerPath||asset.path!==path.posix.join(path.posix.dirname(ledgerPath),ref.image)||ref.sourceUrl!==game.links[0].url)throw Error('Benchmark image provenance mismatch: '+game.id);
      const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,asset.path))).digest('hex');
      if(hash!==ref.sha256)throw Error('Benchmark image changed: '+game.id);
    }
  }
  for(const item of b.inspirations)if(!/^[a-z]+(?:-[a-z]+)*$/.test(item.id)||!item.name||!item.kind||!item.axis||!item.translation||!item.boundary||new URL(item.url).protocol!=='https:')throw Error('Invalid inspiration source');
  if(b.games.filter(g=>g.asset).length!==3)throw Error('Expected three illustrated benchmarks');
  for(const file of inputs(data))if(path.isAbsolute(file)||file.split('/').includes('..')||!fs.statSync(path.join(root,file)).isFile())throw Error('Missing/unsafe benchmark source: '+file);
  for(const item of b.synthesis)if(!/^#[a-z-]+$/.test(item.target))throw Error('Invalid benchmark destination');
}
function image(data,game) {
  const asset=data.assets[game.asset];
  return `<figure><a class="pp-benchmark-image" href="../${esc(asset.path)}" aria-label="${esc(game.name)}の参考画像を原寸で見る"><img src="../${esc(asset.path)}" alt="${esc(asset.note)}" width="1920" height="1080" loading="lazy" decoding="async"></a><figcaption><span>${esc(asset.label)}</span><span>${esc(asset.date)} · ${esc(game.creator)}</span></figcaption></figure>`;
}
function description(game) {
  return `<div class="pp-benchmark-copy"><p class="pp-benchmark-role">${esc(game.role)}</p><h4 id="benchmark-${esc(game.id)}-title">${esc(game.name)}</h4><p class="pp-benchmark-evidence">${esc(game.evidence)}<span>調査：${esc(game.studyDate)}</span></p><dl><div><dt>参考にしたこと</dt><dd>${esc(game.observation)}</dd></div><div><dt>ぽこもこへの取り入れ方</dt><dd>${esc(game.translation)}</dd></div></dl><details class="pp-benchmark-boundary"><summary>確認した範囲</summary><p>${esc(game.boundary)}</p></details><div class="pp-benchmark-links">${game.links.map(ref=>`<a href="${esc(ref.url)}">${esc(ref.label)} ↗</a>`).join('')}${local(game.source,'調査・設計の記録')}</div></div>`;
}
function origins(b) {
  return `<div class="pp-benchmark-origins" id="benchmark-origins"><p class="pp-kicker">LIVING, DISCOVERY & LEARNING</p><h3>暮らし・育成・学びにも、発想源がある。</h3><p>${esc(b.inspirationIntro)}</p><div class="pp-inspiration-list">${b.inspirations.map(item=>`<article id="inspiration-${esc(item.id)}"><div><span>${esc(item.kind)}</span><h4>${esc(item.name)}</h4><a href="${esc(item.url)}">${esc(item.linkLabel)} ↗</a></div><div><h5>${esc(item.axis)}</h5><p>${esc(item.translation)}</p><small>${esc(item.boundary)}</small></div></article>`).join('')}</div><p class="pp-small">${local(b.inspirations[0].source,'企画段階の発想源を確認する')} · 実操作した比較作品と、資料から得た発想を区別しています。</p></div>`;
}
function render(data) {
  const b=data.benchmarks;
  return `<section class="pp-section pp-benchmark-section" id="benchmarks" aria-labelledby="benchmarks-title"><div class="pp-benchmark-heading"><p class="pp-kicker">REFERENCE / 企画を支えるゲーム</p><h2 id="benchmarks-title">${esc(b.title)}</h2><p class="pp-lead">${esc(b.intro)}</p></div><nav class="pp-benchmark-nav" aria-label="参考ゲームへ移動">${b.games.map(g=>`<a href="#benchmark-${esc(g.id)}">${esc(g.name)}</a>`).join('')}<a href="#benchmark-origins">暮らし・育成・学びの発想源</a></nav><div class="pp-benchmark-gallery">${b.games.filter(g=>g.asset).map((g,i)=>`<article id="benchmark-${esc(g.id)}" class="pp-benchmark-game${i===0?' pp-benchmark-primary':''}" aria-labelledby="benchmark-${esc(g.id)}-title">${image(data,g)}${description(g)}</article>`).join('')}</div><div class="pp-benchmark-support-heading"><span class="pp-kicker">GROWTH & MAKING</span><h3>成長の仕組みと、暮らせる場所のつくり方。</h3><p>見た目の参照に加えて、公式の設計・制作資料から考えたこと。</p></div><div class="pp-benchmark-support">${b.games.filter(g=>!g.asset).map(g=>`<article id="benchmark-${esc(g.id)}" class="pp-benchmark-game" aria-labelledby="benchmark-${esc(g.id)}-title">${description(g)}</article>`).join('')}</div>${origins(b)}<div class="pp-benchmark-synthesis"><p class="pp-kicker">IN POKOMOKO</p><h3>参考から、自分たちの遊びへ。</h3><div>${b.synthesis.map((item,i)=>`<article><span>0${i+1}</span><h4>${esc(item.title)}</h4><p>${esc(item.detail)}</p><a href="${esc(item.target)}">${esc(item.label)} ↗</a></article>`).join('')}</div></div><details class="pp-benchmark-reading"><summary>詳しい調査・出典と掲載画像について</summary><p>${esc(b.scope)}</p><ul>${b.reading.map(ref=>`<li>${local(ref.source,ref.label)}</li>`).join('')}</ul><p>${esc(b.methodNote)}</p><p>${esc(b.note)}</p></details><a class="pp-back" href="#proposal-contents">目次へ戻る ↑</a></section>`;
}
module.exports={inputs,validate,render};
