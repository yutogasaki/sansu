import assert from 'node:assert/strict';
import {parse, textOf, technicalSurface, hasClass, elements} from './portal-html.mjs';

// Inspect the new entry and all its new sections. Preserved original documents
// are separate iframe documents and retain their original historical wording.
export function entrySurface(node) {
  if(['script','style','iframe'].includes(node.tag))return '';
  if(node.tag==='details'&&!Object.hasOwn(node.attrs,'open'))return entrySurface(node.children.find(n=>n.tag==='summary')||{raw:''});
  const labels=['aria-label','alt','title','placeholder'].map(k=>node.attrs?.[k]||'').join(' ');
  return labels+' '+(node.raw!==undefined?textOf(node):(node.children||[]).map(entrySurface).join(' '));
}
export function checkEntrySurface(html) {
  const doc=parse(html),body=elements(doc,n=>n.tag==='body')[0]||doc;
  const surface=entrySurface(body);
  const leak=surface.match(technicalSurface)||surface.match(/\b(?:trial[-_ ]?\d+|S-\d{3}|native-?\d+(?:[-:][\w.-]+)*|(?=[a-f\d]*[a-f])[a-f\d]{7,64}|GO\/PASS|BLOCKED|Unhandled rejection|Traceback|Timeout|Timed out|E[A-Z]{4,}|ERR_[A-Z_]+)\b/i);
  assert(!leak,`new entry exposes an internal ID or English log: ${leak?.[0]}`);
  return doc;
}
export function checkEntryCards(html) {
  const doc=checkEntrySurface(html);
  for(const decision of elements(doc,n=>hasClass(n,'decision'))) {
    const surface=entrySurface(decision);
    for(const label of ['採用して進める','直して比べる','保留する','おすすめ','理由','選ぶと何が進むか'])
      assert(surface.includes(label),`decision fact must stay outside closed details: ${label}`);
    const recommendation=elements(decision,n=>hasClass(n,'decision-recommendation'))[0];
    assert(recommendation&&entrySurface(recommendation).includes('理由'),'decision fact: recommendation reason stays visible');
    assert.equal(elements(decision,n=>hasClass(n,'compare-pair')).length,1,'comparison stays on the decision surface');
    for(const caption of ['以前の比較：四角い岸','以前の比較：丸い岸'])assert(surface.includes(caption),'comparison captions stay visible');
  }
  const confirmations=elements(doc,n=>hasClass(n,'confirmation'));
  assert(confirmations.length,'confirmation cards');
  for(const card of confirmations){
    const steps=elements(card,n=>hasClass(n,'confirmation-flow'))[0];
    assert(steps,'short confirmation flow');
    assert.deepEqual(steps.children.filter(n=>n.tag==='li').map(n=>textOf(elements(n,c=>c.tag==='strong')[0])),['確認済み','残り','次']);
    assert(!/上の1点|まだありません/.test(entrySurface(card)),'no ambiguous confirmation placeholders');
  }
}
