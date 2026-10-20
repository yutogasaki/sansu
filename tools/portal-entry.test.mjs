import {test} from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkEntrySurface, checkEntryCards} from './check-portal-entry.mjs';
import {confirmationPresentation} from './integrated-portal.mjs';

const entry=()=>fs.readFileSync(new URL(fs.existsSync(new URL('../portal/data/workspace-legacy.json',import.meta.url))?'../portal/overview-legacy.html':'../portal/index.html',import.meta.url),'utf8');
const current=()=>fs.readFileSync(new URL('../portal/index.html',import.meta.url),'utf8');
test('six-entry workspace keeps the current summary human readable and the complete old decision accessible',()=>{
 checkEntrySurface(current());
 if(fs.existsSync(new URL('../portal/data/workspace-legacy.json',import.meta.url))) {
  for(const label of ['概要','企画・成長','開発・仕事','成果・評価','知識・記憶','AI開発能力'])assert(current().includes('>'+label+'</a>'));
  assert(current().includes('overview-legacy.html'));
 }
});
test('new entry and decisions expose plain facts, choices and the confirmation sequence',()=>checkEntryCards(entry()));
test('entry rejects IDs/logs in visible text, captions, accessibility labels and open details',()=>{
  for(const html of ['<p>trial6 · PASS</p>','<figcaption>trial-6</figcaption>','<p>Command failed: npm run build</p>',
    '<img alt="confirmation-1">','<details><summary>AssertionError: failed</summary></details>',
    '<details open><summary>元の記録</summary><p>trial6</p></details>', '<p>S-005</p>', '<p>native05-authored-cove</p>', '<p>83210fd</p>'])
    assert.throws(()=>checkEntrySurface(entry().replace('</main>',html+'</main>')),/internal ID or English log/);
});
test('closed raw records and preserved original iframes keep their evidence',()=>{
  checkEntrySurface('<body><details><summary>元の記録</summary><pre>trial6 PASS</pre></details><iframe src="original/overview.html"></iframe></body>');
});
test('hiding the recommendation or choice consequence fails the inspection',()=>{
  // This negative test needs a decision even when the live queue has none.
  // Keep production inspection unchanged and validate a controlled positive first.
  const decision='<body><main><section class="decision"><div class="decision-recommendation"><strong>おすすめ</strong><p>案を比べる</p><p><strong>理由</strong>同じ対象版で確認した材料。</p></div><ul><li>採用して進める</li><li>直して比べる</li><li>保留する</li></ul><p><strong>選ぶと何が進むか</strong>次の確認へ進む。</p><div class="compare-pair"><p>以前の比較：四角い岸</p><p>以前の比較：丸い岸</p></div></section><section class="confirmation"><ol class="confirmation-flow"><li><strong>確認済み</strong></li><li><strong>残り</strong></li><li><strong>次</strong></li></ol></section></main></body>';
  assert.doesNotThrow(()=>checkEntryCards(decision));
  for(const label of ['理由','選ぶと何が進むか']) {
    const target='<strong>'+label+'</strong>';
    assert(decision.includes(target),'the mutation must change a real fixture fact');
    assert.throws(()=>checkEntryCards(decision.replace(target,'<details><summary>詳細</summary>'+target+'</details>')),/decision fact/);
  }
});
test('Safari history is not confirmation of the latest real-device save',()=>{
  const copy=confirmationPresentation({title:'Safariの撮影・保存',risk:'一時WebKitでは失敗、保存付きブラウザでは成功した履歴あり'});
  assert(copy.done.includes('成功を記録'));assert(copy.remaining.includes('最新候補'));assert(copy.next.includes('再読込'));
  assert(confirmationPresentation({title:'新しい条件',risk:'新しい記録'}).remaining.includes('未確認'));
});
