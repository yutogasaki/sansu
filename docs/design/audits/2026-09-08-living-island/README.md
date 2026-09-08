# 育つ島 — 実装検証

- Date: 2026-09-08
- Status: 実装・作者検証完了（公開操作なし）
- Product contract: [仕様30](../../../product/30_living_island_growth_spec.md)
- Candidate: `mystic-island-living-v3`
- Learning candidate: `mystic-island-learning-v2`
- Delivery: `mystic-island-v1`
- Art direction: `moon-garden`

[24枚の実画面比較](contact-sheet.html) · [各画面の版・hash](capture-manifest.json)

## 完成範囲

4つの居場所の段階成長、有限7個の自動設置、実経路を使う住民の自発的な暮らし、任意編集と以前の姿、東西の拡張、実際に表示された10種類の行動を記録する発見帳、同じ3Dを使う過去と現在の比較を実装した。新規の初回3問も通常3/6問も追加操作なしで育ち、次問へ続く。既定24区間で4地区が成熟し、25区間目に物・成長・節目を無限追加しない。

既存の未コミット変更がある共有worktreeで実施。並行する学習進級などの編集を保持し、配布候補の全入力を固定manifestと復元可能な圧縮archiveに保存した。DEVのfixtureとproductionの通常plannerを区別する。公開、commit、pushは行っていない。

## 固定した実行対象

| 項目 | 値 |
|---|---|
| Production target | `http://127.0.0.1:5502` |
| Revision | `0ea5c56-living-079459dcc679` |
| Version | `0ea5c56-living-079459dcc679:58031713-fb7f-425c-bae1-a601a24a9ef8` |
| Flags | `VITE_ISLAND_ENABLED=true`, `VITE_BUILD_PLAY_ENABLED=false`, `VITE_ISLAND_ART_DIRECTION=moon-garden` |
| Source hash | `079459dcc679ea9b3ef35c1326a9e8c3d5df5697d4ec0f7d623851a9127cac25` |
| Immutable build | `output/builds/island-living/0ea5c56-living-079459dcc679` |
| Evidence directory | `output/playwright/island-living/0ea5c56-living-079459dcc679` |

同evidence directoryの `build-source.json` が全app入力とflag、`archive-manifest.json` と `build-inputs.tar.gz` が721個のapp/QA入力とその復元用実体を特定する。以下のraw reportはこのdirectoryを起点に記す。

## Runtime integrity

- `npm run verify:core`: **164ファイル / 1,933テスト PASS**。docs・lint・typecheck・build・assetsもPASS。最終の屋根/ポーチ修正を含む。ログは `output/island-living-verify-final-079459.log`。
- `npm run e2e:smoke`: classic構成の30シナリオ PASS。
- `npm run e2e:pwa-update`: classic構成の保存保護・同一route・実SW version drift PASS。Islandの固定配布buildと混同しない。
- 最終 `living-01/report.json`: **phone/tablet各25区間 PASS**。空DBの実設定、通常plannerの実回答、4地区成熟、有限7物、自発発見、地区表示、実3D履歴、発見再演、以前の姿/移動/再読込を確認。両比較canvasがviewport内に収まり、過去/現在の同じ画角を検査。全app/QA入力の開始終了不変と実versionを照合。
- 全24区間の自動配置に対して7つの主要物の配置可能性・住民の到達可能性、3種類の共有行動の3経路を検査。成長した家の地面付近の頂点は既存の予約範囲内。花と木の輪郭変化、屋根の露出と実頂点色も対象テストに含む。

- 最終 `rhythm-01/report.json`: phone算数 / tablet筆算の実設定→初回3問→通常区切り→任意帰島/アルバム→同予約再開 PASS。成長区切りも自動継続。
- 最終 `onboarding-02/report.json`: 科目分岐、未操作の開始、reduced motion、プロフィール追加と旧Explore、保存abort/retry、実save callback保留とPWA holdの6ケース PASS。
- 最終 `recovery-01/report.json`: phone/tabletで初回予約・初回3問後の次予約・通常の次予約をnative IndexedDBで一度abortし、保存済み成長を残す次予約だけのretry/reload PASS。
- 最終 `pwa-01/pwa-report.json`: 7保護フローと実service workerによるoffline再読込・回答・自動成長・同予約再開 PASS。旧Island予約/未受取と旧Exploreも保持。
- 同じ最終app入力のDEV `core-ui-01/report.json`: 10ケース PASS。全入力、WebGL復旧、keyboard/touch、支援の再開、収納後の成長、旧外観、プロフィール分離を確認。25区間は重複実行せずproduction living専用結果を使う。
- 全結果の照合は `final-evidence.json`。`final-regression-02.json` はQA修正後の開始終了不変を記録。修正前のapp/QAと、修正後の `archive-manifest-qa02.json` / `build-inputs-qa02.tar.gz` の両方を保持する。

## 正式固定10問の速度比較

**80 run / 全15 gate PASS / eligible=true。** 同じ問題と物理keyboard入力でStudy/Islandを交互に実行。2 viewport × 2正誤条件 × 2レーン × 各10反復。各viewportで正解200、同問への誤答再入力20、区間境界20サンプルを含む。追加の通常操作0、報酬面0。

| Viewport | 正解→次入力 P95 | 誤答→再入力 P95 | 区間境界 P95 | 正解時のIsland/Study速度比 |
|---|---:|---:|---:|---:|
| phone | 195.9ms | 196.2ms | 197.4ms | 2.401 |
| tablet | 195.5ms | 195.3ms | 195.1ms | 2.394 |

Raw report: `benchmark-01.json`。DEV targetは `http://127.0.0.1:5501`、実revisionは最終productionと同じ `0ea5c56-living-079459dcc679`、実DEV versionは `0ea5c56-living-079459dcc679:10a22351-bfde-495d-8265-88a21750d3a5`。全app入力をproduction用manifestと照合し、app/QA fingerprintは開始・終了とも `17541ce958a48e466d71017e5bbf72ce4f4fd5db01ebdef8efd2ec2a787693df`。実行中に他のbuild/browser検査を重ねず、process sampleも保存した。

これは明示的に合成した初回済み状態と固定問題を使う自動操作の比較であり、通常plannerの証拠、実機の速度、子どもの解答速度・学力向上ではない。Studyの既存非記録fixtureと、Islandの実atomic writerという測定上の差はraw reportに記す。通常plannerは別のproduction `living-01` / `rhythm-01` で検査する。

## Visual appeal

**作者の実画面評価 PASS。** rootとUI担当が最終productionのphone/tabletを確認した。[採用済みmoon-garden](../2026-09-07-island-3d/README.md)の紫の樹冠、ピンク・黄・青の屋根、ミントの地面と明るい操作面を継承する。

- 小さい芽から背の高い花、より大きな樹冠、軒先と屋根窓という同じ物の変化が分かる。
- スマートフォンのアルバムでは、過去と今の同じ場所を同じ倍率で、両方画面内に表示できる。
- 全景は東西の拡張を示し、地区を選ぶと住民と物を近くで眺められる。学習開始は目立つ一つの主操作を保つ。

自発的な動作と保存の正しさは静止画から認定せず、runtime検査の別証拠にする。独立した美術審査・実参加者の魅力評価を実施したとは主張しない。

## Silent comprehension and safety

実参加者の観察は未実施（**human N=0、無説明理解/再遊び/学習効果は未検証**）。作者操作と機械検査では、追加操作0、支援時の成長保持、欠席/収納で損失を与えない保存契約、音off/reduced motionを確認する。技術や作者の視覚評価で、人の観察の未確認を相殺しない。今回は実装と作者検証の完成範囲であり、公開昇格や実機の熱/電池の承認ではない。

## 修正と以前の証拠の扱い

- `d608ed9bfc3c` の実UI25区間は機能PASSだったが、花・木・家の成長差が弱く、アルバムの倍率が不揃いだった。技術合格で済ませず、輪郭と比較カメラを修正した。
- `02e943f1ea16` の実UI25区間は機能PASSだったが、家の成熟屋根がほぼ黒い面となり、既存の配色を消していた。元の屋根を覆う層を除き、屋根窓へ既存の明るい配色を使った。ポーチの角も既存の通行予約内へ戻した。最終 `079459dcc679` は両修正後の再build・再実行であり、以前の画像を最新候補として流用していない。
- 初期の発見待ちの失敗は、検査側の非同期条件待ちがPromise自体をtruthyと扱ったことが原因。保存読取を実際にawaitして繰り返す観測へ修正した。以前のFAIL reportは残し、未観測の状態を「保存後に消失した」と扱わない。
- 旧予約の育成変更、実際に家へ行かず訪問を記録する経路、画面外の育成先が別の家具へ光を送る経路を修正し、対象テストを追加した。
- 以前の `d608ed9bfc3c` でcore UI10、PWA7保護フローと実offline、phone/tabletの初回/次予約abort回復がPASS。最終候補の再実行とは区別して保持する。

- 最終onboardingの初回実行では、学習済みの旧プロフィールがある場合も全ログ0件を要求する検査側の旧仮定が失敗した。新規プロフィール自身のログ0件へ限定し、既存ログ全体の厳密な保持比較は維持した。アプリ・benchmarkが使うQAは変えず、onboardingだけ再実行して6ケースPASS。`onboarding-01` / `final-regression.json` のFAILを削除・上書きしていない。
