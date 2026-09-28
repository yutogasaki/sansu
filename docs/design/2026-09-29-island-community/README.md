# 学習・庭・家・仲間の統合

2026-09-29。ユーザーの「いっきに実装して」に対応。庭と家を同じ世界の表示へ揃え、自然の暮らしから仲間を招待できるようにした。元のぽこもこ・持ち物・学習・財布・土地は保持する。

[実画面の一覧](index.html) / [現在の残作業](../../../.agents/tasks/TASKS.md) / [現行仕様48](../../product/48_island_life_spec.md) / [保存仕様13](../../product/13_data_storage_migration_spec.md)

## 本番への反映

実装コミット `4002e67b45d7c0a3efe61c1b2e1c60e73337d773` をmainへpushし、[本番の島](https://sansu-seven.vercel.app/#/island)へ配信。[VercelのREADYと対象SHA](deployment.json)、[公開version/entry assetsのhash](public-artifact.json)を照合した。以下のローカル証拠と公開buildのUUIDは別に記録する。

公開版でも空DBからの実初回3問、花/水ばちの購入、明示訪問、カワウソの招待/入居、庭と家の昼夕夜、家のreload、実SW offline、同じ学習の次問を390/768幅で完走。両幅ともpage error 0。[本番report](production/report.json)、[本番26枚の一覧](index.html)。本番の所有者は隔離したテストプロフィールで、既存利用者のデータへ操作していない。

公開versionは `4002e67b45d7c0a3efe61c1b2e1c60e73337d773:cdf1cdf5-fa23-47b0-bf90-a92f20b8bba4`。全26 captureで公開SHAとrootのIsland=true / NatureTown=falseを一致確認。公開Git/build identityと取得したentry assetを根拠にし、ローカルと別ビルドの配信bytes全体が同一という検証には読み替えない。公開確認後の追記は文書・画像だけで、app入力は下記候補と同じ。

## 今回の変更

- 家のoverviewは庭と同じThree.jsの家、住人、所有物、昼夕夜を表示する。家の再読込中に旧stageを表示しない。棚や写真の既存画面は保持する。
- 新しい島はぽこもこ1人から始まる。花のそばのベンチ、水ばちへの明示的な訪問、または実配送と食事3回から友だちの招待が開く。本人が「いっしょに くらす」を選んで入居する。
- 既存の島は3人を保持する。新規の1人の間はぽこもこが食料を運び、仲間が入った後は既存の運搬役へ移る。土地12/24/48しずくの既存購入は独立して使える。
- 保存版21と本人・旧action prefix・初期住人・SHA-256を持つ切替境界を同時保存する。旧writerは拒否し、再送・競合・abort・再読込の重複を防ぐ。
- 同じ素材の静止した家具をまとめて描画する。形・色・三角形・アニメーション部分・現物のray hitは維持する。30品のdraw callsは223から110へ減った。

仕様51の部分実装であり、別の時計による成長、固定地形水源、全画面の美術、共有URLなどの全体完成ではない。旧Nature Town DBを合算せず、同じLifeへ取り込む。

## 対象版と実画面

| 項目 | 対象 |
|---|---|
| 基点 | main `42304f3f2b77cf46e54271d3b153714b22168ab9` に今回の差分を加えた候補 |
| app入力SHA-256 | `8077a3909579acd5594a9811a1887eff20522c69713437817e687c143f3e3f74` |
| production preview | `http://127.0.0.1:5400/#/island` |
| build version | `development-local:0275c14b-33b6-411c-9685-0e74bd96a8d7` |
| flags | Island/Life/Discovery/Fantasy=true、Life preview/NatureTown=false |
| 実candidate | 庭 `living-fantasy-garden-v2` / 家 `garden-house-continuity-v1` / 学習 `pokomoko-pop-live-v8` |
| 幅と操作 | 390×844・通常motion、768×1024・reduced motion、sound off |
| build manifest | [version.json](build-version.json)、[全入力・配信物のhash](candidate-manifest.json) |
| 公開との関係 | 上の本番確認を実施済み。この表は制作時の固定ローカル候補。[ローカル画像一覧](local.html)と本番を区別する |

[実操作のreport](runtime/report.json)と26枚の画像は、空DBの入口→実初回3問→花/水ばちの実購入→ぽこもこを呼ぶ→カワウソの招待→入居→庭と家の昼夕夜→家の再読込→実SW offline→同じ学習の続きまでを記録する。プロフィール・通貨・住人・時刻の注入はしない。昼夕夜は本人が選べる既存の見た目設定を操作する。

## 独立して判定する3項目

| 項目 | 結果と限界 |
|---|---|
| 見た目の連続性 | 作者による実画像の確認。承認済みの元モデル/庭v2と並べ、ぽこもこの造形・布・配色を保持し、同じ家へ近づく構図を確認。新しいモデルやsource画像だけでの合格は付けない |
| 理解・安心・楽しさ | 子ども/保護者の独立観察はN=0。無文字理解、魅力の点数、実機の聴感は未認定 |
| runtime整合 | 下記の単体・実操作・旧版更新・offline・学習テンポを確認。30品のフレーム時間と実iPhoneは残件。全release matrix合格とは呼ばない |

## 検証

| 検査 | 結果・証拠 |
|---|---|
| 全体単体 | 482 files / 4,281 tests PASS。[ログ](core-tests.log)。その後の家の読込表示と公開saveVersionメタデータ修正は最終build/typecheck・実旅程で再確認 |
| 型・build・asset budget | PASS。[buildログ](build.log)。167 precache files、8.52MiB / 12MiB、探索画像2.97MiB |
| lint | error 0。既存IslandMilestoneのfast-refresh warning 1件 |
| 保存21の境界 | 新規/既存、破損・降格拒否、同じ所有者、明示訪問、権利保持、同じcommandの再送/CAS/abort、reload/cache、カワウソ先行時のmodel対応を単体確認 |
| 実旧writer | [旧main版20からの検査](legacy-writer.json) PASS。旧writer拒否、所有保持、新しい学習事実の一度だけの回復 |
| 実購入・入居・庭/家・offline | 両幅PASS。[report](runtime/report.json)。native学習storeは世界の操作で不変、同じ予約へ回答を再開 |
| 実2ビルド更新 | [report](two-build.json) PASS。旧20→新21、学習中の更新待機、SW旧版固定、検知後切断、再接続、自動reload1回、既存3人/購入/全native store、offline同じ次問を保持 |
| classic PWA | 4 scenarios PASS。[ログ](classic-pwa.log)。別のclassic buildで検査し、配布用artifactと分離 |
| 学習テンポ | 固定10問×10反復×2幅×2結果条件×2レーン=80 run。`pass=true`、`evidence.eligible=true`、15 gates PASS。[集計](throughput-summary.json) |
| classic smoke | 31 scenarios PASS。[ログ](classic-smoke.log)。旧画面の回帰であり、現行庭の実旅程とは別 |
| 現行学習旅程 | 390/768/844横幅×通常/reducedの6条件PASS。[report](learning-production.json)、[ログ](learning-production.log)。実入力21問、誤答/支援、live originalモデル、同じ学習の再開、実SW offlineを確認。初期プロフィール/学習状態は明示fixture |
| 文書・ポータル | docs:check / agent:index:check PASS。旧ExploreのReview By切れ2件は既存warning。レビュー済みindexの外部export、app入力1,357ファイル一致、検査中のindex不変もPASS。[コミット照合](staged-verification.json) |

実2ビルドは現行v8の実入力へ合わせた専用harnessを使った。古い学習v2を固定した旧Island recovery/PWA旅程の全項目を通過したとの主張はしない。今回の変更点は現行community、2ビルド、学習旅程で確認し、旧モードの回帰はclassic smoke/PWAで分ける。

[使用QAのhash](qa-inputs.json)を保存。app入力1,357ファイルは全検査後にもmanifestとの一致を確認する。main反映前にはindex側でも同じ入力を照合し、文書だけの変更を理由に同じアプリ検査を繰り返さない。

### 学習テンポ

DEV `http://127.0.0.1:5401` の同じapp入力を固定。表示versionは `development-local:4b189394-6823-44b9-9854-fdfeef359180`。production previewのUUIDと混ぜない。固定した問題への自動入力であり、子どもの学習速度・通常plannerの真正性を測ったものではない。

| 幅 | 正解後P95 | 同じ問題の誤答retry P95 | 区間境界P95 | 追加操作 |
|---|---:|---:|---:|---:|
| phone | 202.7ms | 200.3ms | 202.1ms | 0 |
| tablet | 202.7ms | 201.6ms | 201.7ms | 0 |

Studyに対する全問正解throughput比は2.35 / 2.36。各幅の誤答sampleは20。誤答フローはStudyと島で意味が違うため、全問正解の比較と分けて記録する。

### 30品の描画

[比較report](render-comparison.json)の前後は、既存版20の同じ3住人、30品の同じkind/座標を使う明示負荷fixture。新規1人の島と旧3人の島を比べて軽量化とは言わない。

| 指標 | 変更前 | 変更後 |
|---|---:|---:|
| draw calls（両幅） | 223 | 110 |
| triangles | 139,536 | 139,536 |
| geometries | 166 | 93 |
| textures | 8 | 8 |

最終desktop rAF P95は390幅42.9ms / 768幅65.3msで、33.3ms基準は未達。前計測時は単体テストが同時実行、後計測は単独実行のため、経過時間の改善率を因果的に主張しない。描画回数約51%減と実機FPSは別。起動の最終1sampleは2,212.8 / 2,283.7msで、実iPhoneの30秒待ちを解消した証拠ではない。

## 最初の失敗と修正範囲

- communityの最初の2回は、配置セルのページ移動不足と呼出後の自動閉鎖に対する重複close操作でharnessが停止。保存失敗ではなかった。実操作手順を直し、最終候補を両幅で完走した。
- 最初の2ビルド試行は、旧QA helperの学習candidate v2固定が現行v8を拒否。現行answerUIの実入力へ変更し、更新・保存のassertionを保持して両幅完走した。
- build-envテストの最初の起動はNode test runnerを誤使用。Vitestで4 tests PASS。アプリの失敗へ読み替えない。
- 初回失敗log/trace、全throughput run、詳細計測はローカル `output/integration-20260929/` に保持する。追跡済み証拠だけを上のリンクにする。

## 継続する範囲

1. 30品の残るフレーム時間、実iPhoneの起動/GPU/電池負荷。
2. 実機の音・読み上げ、Safariの写真、実利用者の学習と庭の往復。
3. 棚/写真等を含む後続の美術、仕様51の成長時計・固定水源・共有等。

実装担当は既存4本に維持し、今回の統合を5本目の未着手タスクへ増やさない。
