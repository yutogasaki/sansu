import {test} from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkEntrySurface, checkEntryCards} from './check-portal-entry.mjs';
import {confirmationPresentation} from './integrated-portal.mjs';

const entry=()=>fs.readFileSync(new URL('../portal/index.html',import.meta.url),'utf8');
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
  for(const label of ['理由','選ぶと何が進むか'])
    assert.throws(()=>checkEntryCards(entry().replace(`<strong>${label}</strong>`,`<details><summary>詳細</summary><strong>${label}</strong></details>`)),/decision fact/);
});
test('Safari history is not confirmation of the latest real-device save',()=>{
  const copy=confirmationPresentation({title:'Safariの撮影・保存',risk:'一時WebKitでは失敗、保存付きブラウザでは成功した履歴あり'});
  assert(copy.done.includes('成功を記録'));assert(copy.remaining.includes('最新候補'));assert(copy.next.includes('再読込'));
  assert(confirmationPresentation({title:'新しい条件',risk:'新しい記録'}).remaining.includes('未確認'));
});
