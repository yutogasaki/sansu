# 同じ4本から育つ岸 — 固定候補 c9

2026-10-12。`island-variation-c9` の限定実UI旅程は **PASS**。苗4本の通常購入→診断18時間→同じ所有ID・成熟の3配置→中央木の収納・再接続→回転・390／768幅を確認した。[採用native05と9実画面の比較](runtime-contact-sheet.html)を残す。**一つの追加地区内の検証であり、3つの完成した全島ではない。**

## 独立した判定

- **実行整合: 限定旅程PASS／全体PARTIAL。** coreは620 files／5,373 tests、docs・lint・型・build・asset budgetがPASS。coreと実UIの開始／終了25,798入力は一致。
- **美術: HOLD。** 作者がsingle／split／loopとphoneを採用原本と比較。枝の数と接続の差は見えるが、追加の岬は橋でつながる別の台座に見え、元の全島は同じ。細い枝の反復と小さな接続部、接合部の凹み・暗い折れ、中央から右の広い空地と少ない家が残る。小画面でも付属部の差であり、全島の作り分けには届かない。
- **独立理解／安全: 未検証、N=0。** 作者の比較・自動検証を独立観察に数えず、美術や理解の点数を推定しない。

## 実対象と結果

targetは `http://127.0.0.1:5366/prototypes/place-qa/authored.html?art=whole&terrain=grove`。本体共有rendererを使うDEV診断。build `island-variation-c9`、実host `visualCandidate=native05-growth-assembly-v1+source-shading-v1`、地形候補 `native05-growth-terrain-rough-v3`、catalog revision `d755b76f91f650ce9489408a1e49732e61c53ae0d13369f2df91275489108062`。runtimeのnative art=true、coreの通常buildはIsland=true／native art=false。

既存35所有物を保ち、20しずくの苗を4回購入してl36／l37／l38／l39を追加（9170→9090、計39所有物）。診断ボタンで自然時計252→270時間。既存35所有物の変化は0件だった。元の6配置権・取得grant・土地・時計・資源と、4本のセル以外の属性を全成熟構成で保持した。shapeボタン・DB／state注入は使わず、既存DOM操作と実canvas pointerで置き替えている。

| 配置 | l36／l37／l38／l39のlocal cell | 結果 |
| --- | --- | --- |
| single | (1,-1), (2,-1), (1,0), (2,0) | 1群、southの岬1本 |
| split | (1,-1), (2,-1), (1,1), (2,1) | 2群、south／northの枝2本、外側接続なし |
| loop | (2,-1), (2,0), (2,1), (1,0) | 1群、枝2本＋coastal-loop接続1本 |

地区原点は(16,-4)、turn 0、親のeast-entryから接続。loopの中央l37だけを収納すると3単独木となり派生床・接続は0。戻すとplan全体とhost／rendererのworld revision `authored-world:dd305dfe00eb79b4` が元通りになった。全captureでhostとrendererの版が一致する。[抽出記録](runtime/summary.json)、[原report](runtime/report.json.gz)、[実driver](runtime/e2e-authored-island-variation.mjs.txt)を参照。

実UIは2026-10-12 11:52:32–11:56:51 UTC、exit 0、`errors=[]`。Playwright付属full Chromium 145.0.7632.6、headless＋Metalを指定し、全画面の実WebGLからApple M4 Metalを確認。ソフトウェアGPUへのfallbackはなかった。実行259.858秒は操作・検証・描画・撮影を含み、操作性能の合格ではない。特にloopの67.652秒は複数の置き替えを含む。`errors`はpageerror記録であり、全console／network検査ではない。

9枚は無加工のviewport screenshot。desktop 1440×1000、phone 390×844、tablet 768×1024、reduced-motion指定。全景fit・回転・viewportによってカメラは異なるため、等寸pixel比較には使わない。取得直後の低岸は画像ではなくreportのcheckpointに記録した。

## 先行した失敗と住人検証

[focused初回](focused/first.log.txt)は45／46 PASS。integration fixtureの地区原点0が固定`HOUSE_CELLS`の(2,0)と重なり、unstoreが正しく拒否された。fixtureの論理／物理Xをともに+10へ移し、[訂正後integration 4／4 PASS](focused/corrected.log.txt)。この訂正で本体の拒否処理は変更していない。**初回失敗時のテストsourceは別保存されておらず、復元して原本扱いにしていない。**

保存した[実asset integration test](focused/authoredGrowthTerrainIntegration.test.ts.txt)と[住人test](focused/authoredGrowthTerrainLife.test.ts.txt)はc9 coreとSHA一致。住人の外側接続を通る実歩行は初回focusedでもPASSし、2件のlife testともc9 coreに含まれる。通常のlife経路と実障害物を使う限定診断で、自然な利用・全住人の全島到達の合格ではない。

## 保存した証拠と限界

[archive照合](archive-proof.json)は原本before／afterと保存byteを照合。大きなJSONはmtime 0のgzipで復号内容も一致。[core report](core/report.json.gz)・[実行log](core/execution.log.txt)・[入力一覧](core/inputs.json.gz)・[snapshot](core/snapshot.json.gz)、runtimeの[実行log](runtime/execution.log.txt)・[終了記録](runtime/execution.json)・[launch source](runtime/launch.py.txt)を保持した。実行済みテストは`.txt`として保存し、通常のtest探索へ混ぜない。

[c8からの203ファイル差分](core/source-delta-from-c8.tar.gz)は変更が進むmainではなく、固定 `/private/tmp/sansu-island-variation-c9/candidate` から作成。各memberはc9 core入力と一致。完全なc8基底が必要で、この差分単独から全repoを復元できるとは扱わない。削除trackedと旧入力残骸は0件で、不在も確認した。**後続c10などの現在のmain全体がc9と一致するという証拠ではない。**

最大成長範囲の取得時予約はdomain回帰に含むが、この実UIは追加1地区のみ。複数地区で育ち方に応じた全島の作り分け、16／32軒以上、通常土地購入・本人保存・学習往復・offline／更新・実機性能・全島美術は未完。包括ゴールとM1を完了扱いにしない。
