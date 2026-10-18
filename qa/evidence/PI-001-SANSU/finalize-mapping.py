from pathlib import Path
import json,hashlib,datetime
root=Path(__file__).resolve().parents[3];out=root/'qa/evidence/PI-001-SANSU'
read=lambda p:json.loads((root/p).read_text())
registry=read('portal/data/unification.json');audit=read('qa/evidence/PI-001-SANSU/library/audit.json');core=read('qa/evidence/PI-001-SANSU/parity.json')
view=read('qa/evidence/PI-001-SANSU/view-metrics.json')
view_issues={row['source'] for row in view['issues']}
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
badkeys={row.get('key') for row in audit['itemIssueDetails'] if row.get('key')};badresources={row['source'] for row in audit['itemIssueDetails'] if row.get('source')}
rows=[]
for row in registry['items']:
 rows.append({'source':row['source'],'key':row['key'],'kind':row['kind'],'destination':'portal/'+row['target']+'?item='+row['key'],'raw':'portal/data/unification.json → '+row['key'],'preserved':'原文・属性・元の識別子・出典・分類・元対象版。humanTitle/humanTextは同じ項目の表示用。','evidence':'library/audit.json → '+row['key']+' / library-stable/browser.json / view-metrics.json / independent-review-verified.md（限定範囲のみ）','verdict':'構造・全文・属性NG' if row['key'] in badkeys else '構造・全文・属性の機械保持PASS。'+('このページは横はみ出し/欠損画像の未達を view-metrics.json に記録。' if row['source'] in view_issues else '')+'表示/操作/独立審査は同ページの記録に依存。全体受入HOLD。'})
for row in registry['resources']:
 missing=row['source'] in badresources
 target=row.get('generatedTarget') or row.get('target') or '未統合'
 rows.append({'source':row['source'],'kind':'resource','destination':('portal/'+target if row.get('generatedTarget') else target),'preserved':'元ファイル・容量・hash・アクセス条件。出典や配布条件は元資料を保持し未登録を補作しない。','evidence':'library/audit.json / portal/data/unification.json → resources','verdict':'NG：開始時から参照先が欠損。該当版の復元待ち。別候補を代用しない。' if missing else '元資源またはフォルダの存在・対象版を機械照合。hub配布/利用可否は別判定。','bytes':row.get('bytes'),'sha256':row.get('sha256')})
css=json.loads((out/'css-assets.json').read_text())
for row in css['resources']:
 if row.get('alreadyInRegistry'):continue
 rows.append({'source':row['source'],'kind':'CSS dependency','destination':row['source'],'preserved':'元CSSが参照するフォント・内容hash・容量・参照元。原ファイルを保持。','evidence':'css-assets.json / check-css-assets.py / Git外の同hash復旧コピー','verdict':'存在・hash・開始時不変・復旧コピー照合PASS。既存native表示を維持。','bytes':row.get('bytes'),'sha256':row.get('sha256')})
for row in registry.get('folders',[]):
 rows.append({'source':row['source'],'kind':'folder','destination':'portal/'+row['target'],'preserved':'元フォルダの全項目・資料名原文・容量・hash・統合HTML/資料への操作。','evidence':'portal/data/folders.json / library-stable/browser.json','verdict':'元フォルダから生成。全体受入HOLD。'})
for row in registry.get('exclusions',[]):rows.append({'source':row['source'],'kind':'exclusion','destination':'元の非公開領域','preserved':'内容を転記しない','evidence':'portal/data/unification.json → exclusions','verdict':'除外：'+row['reason']})
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'acceptance':'HOLD：元資源欠損6件、全表示操作の受入・独立審査・hub整合を別判定。','candidate':core['candidate'],'manifestSha256':sha('portal/data/unification-manifest.json'),'unificationInputHash':sha('portal/data/unification.json'),'cssDependencyHash':sha('qa/evidence/PI-001-SANSU/css-assets.json'),'inputHash':hashlib.sha256((sha('portal/data/unification.json')+sha('qa/evidence/PI-001-SANSU/css-assets.json')).encode()).hexdigest(),'counts':{'sourceHTML':len(registry['pages']),'documents':len(registry['documents']),'searchableCoreDocuments':core['counts']['searchableDocuments'],'originalItems':len(registry['items']),'resources':len(registry['resources'])+sum(not row.get('alreadyInRegistry') for row in css['resources']),'registryResources':len(registry['resources']),'supplementalCSSResources':sum(not row.get('alreadyInRegistry') for row in css['resources']),'folderViews':len(registry.get('folders',[])),'missingResources':len(badresources),'rows':len(rows)},'coreOccurrenceTable':'parity.json / parity.md（元7画面の39,938 occurrenceと資源。全体数へ重複加算しない）','privacyExclusions':[{'scope':'端末内の児童/家族/個人メモ・IndexedDB/localStorage・実写真','reason':'生成元・試験入力にせず、内容を読取・転記・撮影しない。試験は新規contextの匿名データ。'},{'scope':'.env・秘密鍵・Git内部・node_modules・非公開領域','reason':'公開/統合本文に含めず、元領域のアクセス条件を維持。'}],'rows':rows}
(out/'complete-parity.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
cell=lambda v:str(v).replace('|','&#124;').replace('\n',' ')
with (out/'complete-parity.md').open('w') as f:
 f.write('# Sansu 全関連項目の対応表\n\n'+result['acceptance']+'\n\n候補: '+result['candidate']+'。統合manifest hash: '+result['manifestSha256']+'。入力hash: '+result['inputHash']+'。\n\n'+json.dumps(result['counts'],ensure_ascii=False)+'\n\n元7画面の細分化occurrence表は [parity.md](parity.md)。数え方が異なるため全体へ重複加算しない。\n\n| 元の場所・項目 | 統合先 | 保持する情報・操作・表現 | 検証方法・証拠 | 判定・除外理由 |\n| --- | --- | --- | --- | --- |\n')
 for row in rows:
  displayed=dict(row);displayed['source']=row['source']+(' / '+row['key'] if row.get('key') else '')
  f.write('| '+' | '.join(cell(displayed.get(k,'')) for k in ['source','destination','preserved','evidence','verdict'])+' |\n')
print(json.dumps({'status':'GENERATED_HOLD','candidate':result['candidate'],'counts':result['counts']},ensure_ascii=False))
