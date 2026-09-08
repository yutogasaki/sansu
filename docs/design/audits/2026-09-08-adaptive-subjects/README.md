# 島の教科切り替え

[実画面レビュー](review.html) · [実操作の記録](ui-report.json) · [各画面の出所](capture-manifest.json) · [固定ソース](build-source.json) · [差分レビュー](diff-review.md)

## 対象と変更

島のmixを固定交互から、初見の短い継続・有効な復習の必要量・本人の次一区間への希望による選択へ変更した。初回3問、通常6問/複雑3問、追加操作なしの次問、既存の教科内plannerを維持する。自動の同一教科は同一学習日に最大2区間。本人の「つぎも やる」はそれより優先し、次予約の保存成功時だけ消費する。

初見IDは新規予約だけで記録し、独力正解3回未満のメイン項目を最大1問優先する。ヒント・訂正・unknownを独力と認定しない。旧予約、単教科設定、当日停止と解放範囲、SRS・成長・報酬を保つ。仕様は[28](../../../product/28_mystic_island_spec.md#教科の切り替え)。

## 実行対象

- 固定revision: `9300ea0-subjects-880a65a8d2ec`
- 実version: `9300ea0-subjects-880a65a8d2ec:235da1f6-a3f5-4859-b206-85bff2b8e8f8`
- Production preview: `http://127.0.0.1:5470/`
- DEV: `http://127.0.0.1:5471/`
- Flag: `VITE_ISLAND_ENABLED=true`, `VITE_BUILD_PLAY_ENABLED=false`, `moon-garden`
- Candidate: `mystic-island-living-v4` / `mystic-island-learning-v2`
- 保存済みの[version manifest](version.json)と各captureの版・候補・配信先を照合した。最終26画面は全て同一production build。
- ソース固定環境: `/var/folders/0z/bq5m0r1x4_59p55yrw1mx6fr0000gn/T/sansu-subjects-final-e386qosz`
- 784入力の開始/終了hashを照合。利用者のプロフィールを使わず、独立したnative fixtureから実予約・実回答・実保存を行った。

## 独立した判定

| Gate | 結果と範囲 |
|---|---|
| 見た目 | 既存v4と問題/入力の階層を比較。教科操作を44px以上に収め、スマホ/タブレットとも全数字キーと島の住民が見える。新しいアートの承認や子どもの再遊びの実証ではない |
| 操作理解・安全 | 文字とチェック、aria-pressed、フォーカス、音なし、reduced motionを確認。希望の選択/取消/再読込/保存失敗、入力途中の保持、Enterが回答を送らないこと、希望の一回消費を実UIで確認。子どもの無説明での理解・自発的利用は未観察 |
| Runtime | core・UI 6シナリオ・通常Island 11ケース・classic smoke/PWA・Island PWA・固定10問の全gateがPASS。保存済み問題/下書きと追加0操作の自動継続を確認 |

## 検証

- `verify:core`: PASS。182ファイル、2,128テスト。docs/lint/typecheck/build/assetsを含む。既存のFast Refresh警告、bundleサイズ通知、古い文書の棚卸し警告は残る。
- `e2e-island-subjects`: PASS。390×844・768×1024で、希望/期限復習/初見の3系列ずつ、計6シナリオ・26画面。スマホのtapと、入力済みの答えを保持したままのEnter操作も確認。
- `e2e:island-pwa`: PASS。保護された7経路と実service workerによるオフライン再読込・回答・再開。
- `e2e:island`: [11ケースPASS](island-report.json)。phone/tablet各25区間を実回答し、4地区成熟・配置/過去の姿・発見/アルバム/再演・再開、表示復旧、実初回設定と全入力8系列を確認。
- `benchmark:island-fixed-ten`: [80run・各10反復・全15gate PASS](throughput-summary.json)、`evidence.eligible=true`。[完全なraw記録](throughput-report.json.gz)も圧縮保存した。
- classic smoke: [31ケースPASS](logs/classic-smoke.log)。classic PWA: [4経路PASS](logs/classic-pwa.log)。最終固定ソースを別ディレクトリへ複製し、両flagをfalseにした回帰専用buildで実行。公開候補のIsland buildを上書きしていない。
- 島PWAの[集計](island-pwa-summary.json)と[完全な記録](island-pwa-report.json.gz)、[coreの出力](logs/core.log)を保存した。
- 全検証後も[固定入力784ファイルがmanifestと一致](source-check.json)。共有workspaceのtypecheckとdiffの空白検査もPASS。教科選択・希望保存・planner・UIの担当差分を保持し、その後の別作業の土地拡張変更はこの固定候補の証拠に含めない。

### 固定10問の集計

| 実行 | 正解後入力可能 P95 | 誤答後再入力 P95 | 区切り P95 | 普通の問題間の追加操作 |
|---|---:|---:|---:|---:|
| 390×844 | 194.0ms | 192.9ms | 306.5ms | 0 |
| 768×1024 | 194.1ms | 193.8ms | 202.5ms | 0 |

Studyとの問題数/分の比は2.196/2.177。DEVの同一revision・同一版・同一候補を両面から照合した。自動キーボードとreduced motionによる固定fixtureの測定で、教科選択の通常plannerは別のproduction UI検査で確認した。実学習速度・実機性能・継続率の保証には用いない。前半には別の回帰検査の同時実行があり、端末負荷を統制したベンチマークではない。

## 前段の検証と限界

前段の`9300ea0-subjects-1688b946ba1d`では、希望操作と初見/DueのUI、25区間×phone/tabletの島、全入力、classic smoke/PWA、島PWAを確認した。並行中の学習強化による旧テストの期待値更新と、当タスクの旧日付比較の修正を取り込み、最終候補を改めて固定した。前段の画面・結果を最終候補の実行として数えない。

初回の全テストでは並行変更の途中にある期待値・fixtureの不整合を検出した。更新後の一回は重い生成テストが15秒を超えたが、同一コードの該当12テストは単独実行で4.97秒でPASS。最終verify:coreは全体を通過している。失敗したraw出力も`/tmp/sansu-subject-*.log`に保持した。

最終Islandの最初の実行では、12区間後の成長比較ボタンのクリック後、albumへ30秒以内に遷移しなかった。[原FAIL](diagnostics/island-first-report.json)・[画面](diagnostics/island-first-failure.png)・[出力](diagnostics/island-first.log)を保存した。同じapp/QAで再実行し、phone/tablet各25区間と残り全ケースを通過。原因は未確定で、検査の閾値変更や自動クリックの追加で隠していない。通常島の全captureは`/tmp/sansu-subject-island-final-retry`に保持する。

2区間と3独力正解は製品の設計値。自発的な継続、学習負担、後日の初回正答率の改善を、この自動検査で認定しない。配信サービスへのデプロイはこの作業の範囲外。
