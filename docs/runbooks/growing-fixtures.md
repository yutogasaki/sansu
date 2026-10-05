# 育つ島の固定検証データ

## Purpose

初期・育ち途中・混雑したGrowingの保存を一度生成し、同じデータを別buildのUI比較へ使う。配置・人口が変わった比較を防ぎ、毎回の購入や成長待ちを減らす。すべて明示的なQA合成データで、実取得/学習/既存利用者の証拠にはしない。

## Contract

- 固定profile ID、乱数seed、時計、所有/座標/人口を持つ3ケースを、現行の純粋domainから作る。配置は正式commandを使い、残高・成熟/人口/解放は合成条件として記録する。学習履歴・SRS・実利用者の保存は取り込まない。
- packにschema、payload hash、生成domain/lockのhashを保存。上書きせず新規directoryへ生成する。読込時にhash・owner・保存版・学習履歴なし・配置/住宅/人口の整合を確認する。domain/lockが変わったpackは再生成し、同一条件比較に混ぜない。
- 撮影先はloopbackの本番形式buildのみ。`--build-dir` のversionと配信versionを照合し、各実画面のroot/Island identityとGrowing candidateを保存する。新しい隔離browser contextだけにデータを復元する。既存browser、外部URL、利用者のDBには触れない。
- 撮影reportは `sansu-growing-captures-v1` とし、固定epoch/timezone・音off・touch/DPR/engine、各PNG/native保存のSHAを明記する。比較はこのreportと同じpackを読み、6ケース・本人/所有/配置/人口/学習正本・画面サイズ/motion・runtimeの版/flagを再照合する。旧reportや改変/欠落した画像、native保存、条件の混在は拒否する。
- 各ケースを390/768幅で復元。固定日時（Asia/Tokyo、音off、tablet reduced motion）の明示診断でhome画面を撮影し、reload後の所有/人口/土地/時計と学習正本の不変を確認する。各幅/ケースのsource pack/hash、build revision/flags、画像・native保存を新規outputへ残す。
- viewportエミュレーションと固定時計の診断。実FPS/実機/実獲得/offline更新/子どもの理解/再訪の合格にはしない。runtimeのfixture再現、視覚的魅力、理解/安全は独立し、後二つは未評価とする。

## 1コマンドで候補を撮影する

```bash
npm run snapshot:growing
npm run snapshot:growing -- --fixtures /absolute/path/to/pack/fixtures.json --before /absolute/path/to/before/report.json --output-dir /absolute/path/to/new-snapshot
```

作業ツリー（未コミットを含む）をwatch対象外へ固定し、build入力archive/hashを保存。Growingのflagsとrevisionを指定してbuildし、専用loopback previewで6画面を撮影する。`--fixtures` がなければ新しいpackを生成し、指定時は元のpackを照合してコピーする。`--before` は同じ `--fixtures` と組み合わせ、撮影後に横並び比較を作る。前版のreport/PNG/native原本も実行前後の不変を確認する。

新規outputだけを使用し、repo内ならignoreされた `output/` 配下へ置く。既存のdistやpreview、利用中browserは使用しない。終了・失敗・SIGINT/SIGTERM時に自分のpreview/子processと一時コピーを片付け、ログ/pack/画像/子report・入力archiveを残す。中断やcleanup失敗ではPASSにせず、後続を止める。版と配信version、候補/生成物の実行前後一致を照合する。

`report.json` / `summary.md` に撮影結果、比較の有無、cleanupと未評価項目を記録する。build/撮影用の診断コマンドで、`verify:core` や実取得/PWA更新/美術/子ども/公開の合格を代行しない。比較を指定しなければ `comparisonIntegrity` は未評価。

## Usage

```bash
npm run fixtures:growing -- --output-dir /absolute/path/to/new-pack
npm run e2e:growing-fixtures -- --url http://127.0.0.1:5298 --build-dir /absolute/path/to/dist --fixtures /absolute/path/to/new-pack/fixtures.json --output-dir /absolute/path/to/new-captures
```

Growingを有効にして作った固定production buildをpreviewで配信する。例：

```bash
VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true VITE_GROWING_ISLAND_ENABLED=true VITE_ISLAND_FANTASY_ENABLED=true VITE_NATURE_TOWN_ENABLED=false VITE_ISLAND_LIFE_PREVIEW=false npm run build
npm run preview -- --host 127.0.0.1 --port 5298 --strictPort
```

別のterminalで上記の生成/撮影を実行する。DEVや旧Lifeの保存は対象外。画像と `report.json` / `contact-sheet.html` を読む。比較の両側へ同じfixtures.jsonを指定し、payload hashと各ケースの所有・座標・人口を照合する。pack/captureは `output/` 等のローカル証拠に置き、個人の保存を追加しない。

## 2版を横並びで比較する

```bash
npm run compare:growing-fixtures -- --before /absolute/path/to/before/report.json --after /absolute/path/to/after/report.json --fixtures /absolute/path/to/new-pack/fixtures.json --output-dir /absolute/path/to/new-comparison
```

新規directoryへ12画像をコピーし、6組の `comparison.html` と入力report/pack/画像/native保存のhashを持つ `report.json` を作る。元の撮影結果は変更しない。出力は入力directoryの外へ置く。両側のversion/revision/候補を表示し、異なる版の混同を防ぐ。同一buildの反復撮影も可能だが、別build更新の証拠にしない。

PNG/native保存の撮影時hashがない旧reportは再撮影する。比較中にも入力を再読込して変更を拒否する。固定するのは保存の所有/座標/人口、Date/timezone、viewport/motion等の条件。一時通知・保存待機の表示・アニメーション位相は固定しない。同じアプリの反復でもそれらの差が見えるため、静止画の差をそのままUI回帰と判定しない。判定は `comparisonIntegrity` のみで、画像の差分点数や美術の自動合格を出さない。視覚の魅力・理解/安全・公開は別評価。

## Verification

packの決定性、現在の保存への読込、配置/住宅/人口の整合、hash破損・owner混在・学習履歴/版/生成source不一致の拒否を回帰で確認する。tooling行のcoreと、新しいpack/同じpackの再利用・6ケースの本番形式撮影を実行する。snapshotでは生成packと既存pack/前版の2経路、既存output/旧reportの拒否、失敗/中断のprocess cleanupを検査する。比較では実撮影2組をCLIへ入力し、横並びの12画像と版情報をブラウザで確認する。欠落/破損/条件不一致/別owner/旧report/上書き/path escapeの拒否を検査する。生成・復元・比較が成功しただけで公開の合格としない。
