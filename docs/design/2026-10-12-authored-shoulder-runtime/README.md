# 中央丘肩 — 本体接続の次候補

2026-10-12。作業ツリーへ接続し、固定候補 `authored-shoulder-c1` のcoreは610 files／5,296 testsとbuildまでPASS、肩なし陰影A/BもPASS。肩の全旅程は3苗購入後、18時間成熟の検証開始時にdriverのNode heapが約4GBへ達してabortしたためFAIL／未完了。固定成熟35所有物の全景と丘近景は、別の限定診断で確認した。分離実験で検証cacheの保持増大を確認し、外側cacheの削除と床検索indexの共有を含む固定c2は610 files／5,297 tests・buildまで通過した。c2は肩の全取得・診断成熟・編集20画面に加え、陰影A/B・元全島編集・水庭・花庭・入り江・通常Growing・classicの全8回帰がPASSした。美術採用・M1完了・通常土地購入・本人保存への接続を示さない。[制作判断](../2026-10-12-authored-whole-massing/next-production.md)と[編集可能なsource](../2026-10-12-authored-central-shoulder/README.md)から続く。

## 同じ世界への接続

追加地面→水庭→場所→入り江の順で組み立てる。元73配置権と支持域を保ち、新2地点と17歩行点を明示診断地区へ追加する。土地は木を移動／収納しても残る。上面6,615三角形は原本の2材質・法線を保つ共通worldだけで描画し、側面・底面8,569三角形と3根元108三角形を別assetから読み込む。全sourceの背景模型は本体へ読み込まない。

根元は実kit・owner・配置・成熟・実木の行列と支持床を照合する。予告で表示を隠した確定形は通行判定に残し、未来の根元を確定guardへ混ぜない。広い森は元の実木を使い続けるため根元も保ち、4本が一つの幹になる条件だけを確定と予告で共有する。移動先がsource接合の条件と違えば根元を表示せず、元へ戻すと同じ形を再接続する。

同じ候補には[原本床の法線／材質の保持](../2026-10-12-authored-floor-shading/README.md)と、単独木を含む全native樹木の実形状guardも含む。l14の大きい幹は、危険な近傍候補を通すのではなく、実床上の安全な外側の入口へ接近する。ownerAccess・接近・利用・退出は同じ候補を使う。

## 対象と比較

- 固定build: `authored-shoulder-c1`。検証app: `http://127.0.0.1:5358/prototypes/place-qa/authored.html?water=wide&cove=corner&shoulder=central&ground=source&reference=shoulder35`。
- Visual source: `native05-central-shoulder-sw-v3-source-v1`、appの陰影表示は `+source-shading-v1`。実build／version／flag／SW状態はbrowser実行時に取得する。
- 35所有物の固定入力と、元32所有物から通常3苗購入・60しずく・診断18時間で進む旅程を分ける。新2土地は診断worldの明示権利で、購入済みと偽らない。
- 法線比較は肩を無効にした同じ32所有物・同camera・同光のlegacy/source A/B。肩の形の効果と陰影の差を混ぜない。

## 現在の検証

[focused生記録](focused/archive-manifest.json)には最初の失敗と修正後の結果を保存した。地面／全樹木guardは別記録の10 files／94 tests PASS。肩composerは7件と追加source属性1件、抽出adapterは6件、実統合は4件と追加の広い森予告1件がPASS。その後の固定c1では全件を含む610 files／5,296 testsを再実行して通過した。6,398のlocal source入力と6つのinstalled dependency入力は、core実行前後で別々に同一性を確認した。

実統合は上面一重描画、側面・底面のpointer除外、根元108三角形のguard寄与、35 ownerの接近、追加35歩行辺のactor半幅＋余白を実dry床unionが支持すること、通常move／store／restore、初期予告中のlife同期と取消を確認した。広い森の追加caseは通常ベンチ購入でP01をgrownにし、予告／取消／確定の根元・通行判定を照合する。法線対応によるterrain型とsource narrowingの初回typecheck失敗を保存し、修正後app／node型検査と対象lintがPASS。

c1の[core確定結果](c1/core/terminal-summary.json)、[通常build境界](c1/build-boundary/report.json)、[原記録の保存証明](c1/archive-proof/report.json)を保持する。通常native=falseのprecacheは145 files／8.50 MiB。原本GLB／Blender／圧縮payloadと大型profileの混入は検出されなかったが、入り江床のinline JSON 147,435文字と一部adapter／metadataは残る。全native code/dataを配布から除去したという判定ではない。

静的React／解放レビューでは、広い森まで予告の根元を除外する不一致1件を発見し、実描画と同じcompact条件へ修正した。[肩なし陰影A/B](../2026-10-12-authored-floor-shading/README.md)は5組／10画面で通過した。

[肩の初回全旅程と原記録](c1/regression-summary/README.md)は `acquisition:explicit-diagnostic-18h` でNode/V8が `JavaScript heap out of memory`、exit -6。外側3600秒上限ではなく、約1,160秒で停止した。progressには3苗の各購入step成功が残り、初期32・各若木予告・若い35の5画像を保持したが、driver最終reportは生成されていない。成熟後の成功、固定35の編集、後続6回帰は認定しない。外側runnerが全6,398 sourceと6 installed入力の前後一致を確認した。新しいworldを保持する検証cacheと成熟計算を分けて調査し、固定c1を上書きしていない。

[保持量の分離診断](c1/memory-diagnostic/README.md)では、3状態に制限した系列は購入予告／確定／成熟の8状態を完走した。無制限の系列は4状態後に安全余白へ達して停止したため8対8の比較は未完。共通の4状態目では約328 MiBの余分な保持を確認し、成長処理とmilestone同期だけの増加は小さかった。ただし1状態でも約869 MiB、3状態系列も約2 GiBを保持し、本体のworld構築にもメモリ課題が残る。強制GCを使う縮小した純粋Node診断であり、全browserや性能の合格とはしない。[静的レビュー](c1/memory-diagnostic/driver-review.md)の最小修正は、検証専用の外側Mapを削除し本体の既存LRU3へ直接委譲する。所有・床・予告・編集のassertionは維持し、固定c1を変更していない。

[固定成熟の限定診断](c1/shape-after-first-oom/README.md)は約263秒、全景と丘近景の2画面でPASS。35所有物／8軒／75権利、実owner接近とpose、同じapp versionと入力の前後一致を確認した。購入・成熟・編集・回転・phone／tabletを含む全旅程の代替ではない。[採用原本との未加工画像比較](c1/shape-review.html)では、肩3木は右側のまとまりを増したが、左の森の薄さ、中央の裸地、角張った道、近景の細い床継ぎ目が残る。全景の海上に見える先端は、c4にもある `growing-next-boat` のマスト／帆がcanvas下端で切れたものと、保存cameraと生成座標から確認した。木の残存とは扱わず、船体の見切れは画角の課題として残す。元の所有幹を保った[樹冠3案](../2026-10-12-authored-forest-crowns/review.md)はsource全景で比較し、全案HOLDとした。b1の低い横面を次の方向とし、元の幹を保って葉面の層と入口を作り直す。

source美術29/60 HOLDを履歴として保持する。最新runtimeも作者の全島美術HOLD、独立理解／安全N=0。2画面だけで全幅の新しい点数を付けず、技術検査で美術を合格にしない。

## 固定c2のメモリ修正と検証

検証driverの外側cacheを削除するとともに、本体の床検索indexを、全ての三角形頂点で論理XZと実XZが完全一致するときだけ共有する。変形した床は従来の別indexを作る。候補順・許容差・支持・法線・材質・保存や遊びの規則は変えないため、製品契約の変更は不要と判断した。

[同条件の修正前後診断](index-sharing/README.md)は初期32→l33予告→通常l33購入の3状態を別々のNode processで比較し、各146,482床三角形、物理／source／描画payload、経路／権利／plan、合計18,837組の床／逆座標照会が完全一致した。保持量は初期952.43→888.57 MiB、予告1,436.59→1,355.45 MiB、購入後1,764.55→1,668.89 MiBへ減った。一方、初期frame直後のheap標本は増えており、一時的な最大量の削減とは主張しない。強制GCと縮小した旅程を使うため、前のLRU比較やbrowser性能とは測定条件が異なる。対象26テストとlintはPASS。

固定 `authored-shoulder-c2` の[core](c2/core/terminal-summary.json)は610 files／5,297 tests、docs・lint・typecheck・build・素材予算がPASSした。既存lint警告3件は残る。6,460 local sourceと6 installed dependencyの実行前後一致を確認した。[通常build境界](c2/build-boundary/report.json)もPASSし、dist 171 files／24,558,997 bytes、precache 145 files／8,907,889 bytes。原本GLB／Blender／大型profileは混入せず、入り江のinline JSON 147,435文字と一部codeは引き続き残る。[原記録33 filesの保存証明](c2/raw-archive-proof.json)を保持する。

c2の専用DEV serverは `http://127.0.0.1:5359`、revision `authored-shoulder-c2`、Island=true／native=false。同じ固定candidateに対する陰影A/B→肩の全取得・成熟・編集→元の全島／水庭／花庭／入り江→通常Growing→classicの[全8段階](c2/regressions/README.md)がPASSした。実画面のversion・candidateは各driverが取得し、coreやsource全景を全browser成功として扱わない。


c2の完了済み3回帰は[原記録48 files](c2/regressions/archive-01-03.json)へbyteを変えず保存した。肩なし陰影A/Bは10画面／5組、元27所有物の編集は6項目／7画面がPASS。肩の[全旅程](c2/regressions/02-shoulder-full/actual/report.json)は通常commandによる3苗取得と明示18時間の成熟、別の固定35所有物で取消・移動・収納・復元、回転・390幅・768幅／reduced motionを含む20画面がPASSした。6,460 local sourceと6 installed入力は各回帰の前後で一致した。肩の所要3,002.829秒は外側3,600秒以内の機能検査であり、実機性能の合格ではない。その後、水庭14画面、花庭12画面、入り江10画面、通常Growingの8旅程／22画面、classic32項目も個別に通過した。[後半と最終runnerの150 files](c2/regressions/archive-04-08-and-terminal.json)は原byteで保存し、前半48 filesはSHAを再照合して保持した。全段階・全体とも6,460 local入力と6 installed依存がcoreの確定値に一致した。停止やdeadline変更はなく、途中の限定source制作との時間重複は記録している。機能PASSを美術・操作性能・独立理解やM1の受入へ広げない。

[実20画面のcontact sheet](c2/visual-contact-sheet/index.html)は採用native-05の原本と未加工画像を並べる。実versionは `authored-shoulder-c2:79e9300a-ec58-4cfc-83fc-5dc24d2d4092`、対象は上記5359のDEV prototype、配布設定Island=true／native=false、authored診断の実rendererはnative=true。作者が個別に見たのは固定35の昼の全景／近景、回転、phone、tabletの8画面。肩の木のまとまりは改善したが、薄い左森林、中央の裸地、角張った道、近景の床線、空の大樹内側が残る。tabletはcanvas脇の操作領域と海の余白で島全体が小さく見える。新しい全幅の数値採点は行わず、美術HOLD・独立理解／安全N=0を維持する。
