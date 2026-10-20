// Copy-only context handoff. No transport, source writes or approval transition.
(() => {
 'use strict';
 const dataNode=document.getElementById('context-data'),dialog=document.getElementById('context-dialog');
 if(!dataNode||!dialog)return;
 const $=id=>document.getElementById(id),data=JSON.parse(dataNode.textContent),target=$('context-target'),purpose=$('context-purpose'),excerpt=$('context-excerpt'),request=$('context-request'),preview=$('context-preview'),ack=$('context-ack'),status=$('context-status'),copy=dialog.querySelector('[data-context-copy]'),previewBox=dialog.querySelector('.context-preview');
 let opener,revision=0,busy=false,lastTarget;
 document.addEventListener('toggle',event=>{if(event.target.open){const row=event.target.closest('[data-task],#knowledge-refs li');if(row)lastTarget=row.id;}},true);
 for(const item of data.items){const option=document.createElement('option');option.value=item.ref;option.textContent=item.title+'（'+item.label+'）';target.append(option);}
 const current=()=>data.items.find(i=>i.ref===target.value);
 const rows=values=>(values||[]).map(v=>'- '+v).join('\n')||'記録なし';
 function invalidate(){revision++;preview.value='';previewBox.hidden=true;ack.checked=false;copy.disabled=true;status.textContent='内容を変更しました。「依頼文を確認する」で全文を確認してください。';}
 function showState(){const i=current();$('context-state').textContent=i?i.label+' · '+i.ref+'@'+i.version:'';}
 function text(){
  const i=current(),d=i.decision,f=i.fields||{};
  const details=d?'判断の問い：'+d.question+'\n推奨：'+(d.recommendation?.reason||d.recommendation||'未記入（回答依頼の準備不足）')+'\n対象範囲：'+(d.target?.scope||'未記録')+'\n選択肢：\n'+rows((d.options||[]).map(o=>o.label+'\n  内容：'+o.description+'\n  影響：'+(o.impact||'未記録')+'\n  戻し方：'+(o.rollback||'未記録')+'\n  次の仕事：'+(o.nextWork?.action||'未記録'))):'適用範囲：'+(i.scope||f.scope||'独立した記録なし。正本を確認')+'\n'+(i.rule?'原則：'+i.rule+'\n':'')+(i.kind==='work'?'実行者（既存記録）：'+(f.executor||'未記録')+'\n依存：\n'+rows(f.dependencies)+'\n障害：\n'+rows(f.blockers)+'\n完了条件（既存記録・今回の権限ではありません）：\n'+rows(f.completion)+'\n検証方法（既存記録）：\n'+rows(f.verification):'');
  return ['AIへの相談・確認依頼（未送信）','案件：'+data.project+' / '+data.repo,'対象：'+i.title,'参照ID・版：'+i.ref+'@'+i.version,'正本：'+i.path,'現在状態：'+i.label+'（元の値：'+(i.stateRaw||'未記録')+'）','版の意味：生成時の正本の内容hash。送信前に現在の正本との一致を確認する。','目的：'+purpose.value,'選んだ箇所・補足：\n'+(excerpt.value.trim()||'指定なし（本文全文は渡していません）'),details,'根拠：\n'+rows((i.evidence||[]).map(e=>(e.label||e.path)+(e.path?' / '+e.path:''))),'関連する知識・仕事：\n'+rows(i.relations.map(r=>r.label+'：'+r.to+' / '+(r.confirmed?'記録に明記':'関係は推定・未確認')+' / 根拠：'+(r.basis||'未記録')+(r.problem?' / '+r.problem:''))),'不足・警告：\n'+rows(i.warnings),'依頼内容：\n'+request.value.trim(),'許可範囲：読取り・照合・提案まで。実ファイル変更、承認状態の更新、外部送信、自動実行、commit・push・公開は許可していません。既存の正本と未コミット変更を保持してください。','接続先・担当：未指定・未接続。担当AI・技術スタック・正本の保存先・自律実行範囲をこの依頼文で確定しません。','回答に含めること：確認した対象と版、根拠、未確認、推奨と理由・影響、次の一手。判断の準備不足を回答済み・実行済みに読み替えない。'].join('\n\n');
 }
 document.querySelector('[data-context-open]').addEventListener('click',event=>{
  opener=event.currentTarget;
  const selected=window.getSelection();
  if(selected?.rangeCount&&document.getElementById('main').contains(selected.anchorNode)&&!dialog.contains(selected.anchorNode)){const s=selected.toString().trim();if(s)excerpt.value=s.slice(0,4000);}
  const fragment=decodeURIComponent(location.hash.slice(1)),expanded=document.querySelector('[data-task] details[open]')?.closest('[data-task]')?.id;
  const source=lastTarget||expanded||fragment,found=data.items.find(i=>i.anchor===source||i.href.split('#')[1]===source);
  if(found)target.value=found.ref;
  showState();invalidate();dialog.showModal();target.focus();
 });
 function openReference(){const id=decodeURIComponent(location.hash.slice(1)),el=document.getElementById(id);if(el?.querySelector('.ref-record'))el.querySelector('.ref-record').open=true;}
 addEventListener('hashchange',openReference);openReference();
 dialog.querySelector('[data-context-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{revision++;opener?.focus();});
 for(const input of [target,purpose,excerpt,request])input.addEventListener('input',()=>{showState();invalidate();});
 dialog.querySelector('[data-context-preview]').addEventListener('click',()=>{
  if(!request.value.trim()){status.textContent='依頼内容を入力してください。';request.focus();return;}
  revision++;preview.value=text();previewBox.hidden=false;ack.checked=false;copy.disabled=true;status.textContent='コピーする全文と対象の版、許可範囲を確認してください。';preview.focus();
 });
 ack.addEventListener('change',()=>{copy.disabled=!ack.checked||!preview.value||busy;});
 copy.addEventListener('click',async()=>{
  if(busy||!ack.checked||!preview.value)return;
  busy=true;copy.disabled=true;const at=revision,value=preview.value;status.textContent='コピーを確認しています…';
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(value);if(at===revision&&dialog.open)status.textContent='コピーしました。まだ送信していません。実行・承認状態は変わりません。';}
  catch{if(at===revision&&dialog.open){preview.focus();preview.select();status.textContent='コピーできませんでした。選択した全文を手動でコピーしてください。まだ送信していません。';}}
  finally{busy=false;copy.disabled=!ack.checked||!preview.value;}
 });
})();
