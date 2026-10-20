'use strict';
// Shared presentation. All state and evidence come from the repo's projection.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const link=(r,base='')=>r.href?`<a href="${esc(base+r.href)}">${esc(r.title||r.label||r.href)}</a>`:esc(r.title||r.label||r.path||'未記録');
const list=values=>values?.length?`<ul>${values.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p class="muted">未記録</p>';
function panel(info,base=''){
 if(!info)return '<p class="ref-empty">参照索引には未登録です。状態・版・採用根拠は未確認です。</p>';
 return `<section class="reference-panel" aria-label="参照索引の状態と根拠"><div class="ref-status"><b>${esc(info.label)}</b><span>版 <code>${esc(info.version)}</code></span></div><p class="ref-id"><code>${esc(info.ref)}</code></p><p>正本：<code>${esc(info.path)}</code>${info.stateRaw?` · 元の状態：${esc(info.stateRaw)}`:''}</p>${info.warnings.length?`<ul class="ref-warnings">${info.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}${info.scope?`<p><b>適用範囲：</b>${esc(info.scope)}</p>`:'<p class="muted">適用範囲・例外：索引に独立した記録なし。本文・正本で確認してください。</p>'}${info.rule?`<p>${esc(info.rule)}</p>`:''}${info.checks?.length?`<details><summary>正本の確認条件（${info.checks.length}）</summary>${list(info.checks)}</details>`:''}${info.evidence?.length?`<details><summary>根拠・確認資料（${info.evidence.length}）</summary><ul>${info.evidence.map(e=>`<li>${e.href?link(e,base):esc(e.label||e.path)}${e.path?` <code>${esc(e.path)}</code>`:''}</li>`).join('')}</ul></details>`:'<p class="muted">独立した採用・検証の根拠：未記録</p>'}${info.relations.length?`<h4>関連する知識・仕事</h4><ul class="ref-relations">${info.relations.map(r=>`<li><b>${esc(r.label)}</b> · ${link(r,base)}<p>${r.version?`参照版 <code>${esc(r.version)}</code> · `:''}${r.confirmed?'記録に明記':'関係は推定・未確認'}${r.problem?' · '+esc(r.problem):''}</p><p class="muted">根拠：${esc(r.basis||'未記録')}</p></li>`).join('')}</ul>`:'<p class="muted">索引に記録された関連：なし</p>'}</section>`;
}
function launcher(site,kind,only){
 if(!site.references)return '';
 const items=only?[only]:kind==='work'?site.tasks.map(t=>t.reference).filter(Boolean):site.references.items.filter(i=>i.kind===kind);
 if(!items.length)return '';
 return `<div class="context-entry"><div><b>この文脈から次の依頼へ</b><p>未接続 · 依頼文の作成（送信も実行もしません）</p></div><button type="button" class="context-open" data-context-open>AIへの依頼文を作る</button></div><script type="application/json" id="context-data">${json({project:site.title,repo:site.references.repo,kind,items})}</script>`;
}
function dialog(){
 return `<dialog class="context-dialog" id="context-dialog" aria-labelledby="context-title"><div class="context-head"><div><h2 id="context-title">AIへの依頼文を確認</h2><p>接続先：未指定・未接続。コピー後の送信は手動です。</p></div><button type="button" data-context-close aria-label="依頼文を閉じる">閉じる</button></div><div class="context-form"><label>対象<select id="context-target"></select></label><p class="context-state" id="context-state"></p><label>目的<select id="context-purpose"><option>根拠・矛盾を確認する</option><option>停止理由と次の一手を整理する</option><option>AI開発手法・ハーネスの改善を検討する</option><option>選択肢と影響を比較する</option></select></label><label>選んだ箇所・補足（任意）<textarea id="context-excerpt" rows="2" maxlength="4000" placeholder="必要な箇所だけを入力してください"></textarea></label><label>依頼内容<textarea id="context-request" rows="3" maxlength="8000" placeholder="確認したい点、必要な成果、範囲を書いてください"></textarea></label><p class="context-boundary">許可範囲：読取り・照合・提案まで。実ファイル変更、承認状態の更新、送信、自動実行、commit・push・公開は含みません。追加の権限は別途確認します。</p><button type="button" data-context-preview>依頼文を確認する</button><div class="context-preview" hidden><label>コピーする依頼文（全文）<textarea id="context-preview" rows="13" readonly></textarea></label><label class="context-ack"><input type="checkbox" id="context-ack">対象・版・内容・許可範囲を確認しました</label><button type="button" data-context-copy disabled>依頼文をコピー</button></div><p id="context-status" role="status" aria-live="polite">依頼文はこの画面内で作成します。</p></div></dialog>`;
}
function indexSection(site){
 if(!site.references)return '';
 const items=site.references.items.filter(i=>i.kind==='knowledge');
 return `<section class="section" id="knowledge-refs"><h2>知識の参照索引（${items.length}件）</h2><p>状態と版は生成時点の正本に基づきます。生成後の変更確認には再生成・検証が必要です。</p><div class="card"><ul class="rows">${items.map(i=>`<li id="${esc(i.anchor)}"><details class="ref-record"><summary><span>${esc(i.title)}</span><span>${esc(i.label)} · <code>${esc(i.version)}</code></span></summary>${i.sourceHref?`<p>${link({href:i.sourceHref,title:'資料を読む'})}</p>`:''}${panel(i)}</details></li>`).join('')}</ul></div></section>`;
}
function environment(site){
 if(!site.references)return '';
 return `<section class="section ai-environment" id="ai-environment"><h2>AI開発能力と実行環境</h2><p>AI開発能力を育てる流れは、課題・外部研究 → 小規模実験 → 比較 → 採否 → 適用 → 効果確認です。下の一覧は現在参照できる環境の棚卸しです。研究や改善の実施・効果を示すものではありません。</p><p>確認範囲：このrepoの宣言済み資料と実在ファイル。利用者全体の設定・接続・実行履歴は未確認です。秘密情報や設定値は表示しません。</p><dl class="environment-rows">${site.references.environment.map(g=>`<div><dt>${esc(g.title)}</dt><dd><p>${esc(g.status)}</p>${g.items?.length?`<ul>${g.items.map(i=>`<li>${i.href?link(i):esc(i.title)}${i.version?` · 版 <code>${esc(i.version)}</code>`:''}${i.note?`<p class="muted">${esc(i.note)}</p>`:''}</li>`).join('')}</ul>`:''}</dd></div>`).join('')}</dl></section>`;
}
module.exports={panel,launcher,dialog,indexSection,environment};
