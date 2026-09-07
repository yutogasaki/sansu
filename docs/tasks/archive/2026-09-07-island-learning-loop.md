# 島を通してスムーズさ・楽しさ・学習を改善する

## Goal

ユーザーのactive goal「全体を通して、スムーズさ、楽しさ、学力向上をあっとうして」に対応する。現在の不思議な島の起動、連問、支援、復習、報酬、配置、再遊びを一続きで検証し、根拠のある欠落を修正する。追加の美術指示で採用した大胆な色と水玉の`moon-garden`を維持する。

## SSOT

- [親仕様01](../../product/01_app_spec.md)
- [島仕様28](../../product/28_mystic_island_spec.md)
- [verification matrix](../../ai/verification_matrix.md)

## Plan

1. 学習整合、再遊び/配置、入力/保存を独立したread-only監査で確認し、根拠を持つ修正へ絞る。
2. 挙動を変える部分を先に正本へ追記し、所有範囲を分けて実装する。
3. 実問題・誤答・支援・次の復習・再開と実画面の全ループを同じbuildで検証する。
4. 速度、楽しさの作者確認、独立した利用者観察、定着の測定を別々に報告する。

## Verification

変更範囲に応じた学習/保存の回帰、verify:core、smoke、PWA、島の全ループ、正式固定10問比較。phone/tabletの同一buildと候補を照合する。過去の3D監査・固定build・証拠は上書きしない。

## Outcome boundary

入力速度や自動回答数を学力向上と呼ばない。SRS・支援・独力の判定は実装と記録で検証し、実際の理解/遅延定着/自発的再遊びは観察が必要。未測定の成果を測定済みとしない。

## Progress

- 2026-09-07: 前回3D改善の最終sourceを出発点に監査開始。既存未コミット変更を保持。3担当へ独立調査を依頼。
- 調査で3つの欠落を再現: 入力readyとkeyboard購読の間の隙間、同問題訂正で消える算数フォロー/一語に偏る英語Due、住民の利用と配置可能性の不一致。新規マクロ解放の水増しより、既存の暮らしで自分から遊べる操作を実装する。
- 入力probeは同じ9ケースで修正前3/9→修正後9/9。実useIslandActionsの二重Enter等を加えて13/13。既存180ms guardを維持。
- rootの通常支援と繰上がり実例2+9のphone DEV診断はPASS。支援/再開でも全キーが表示され、元Problemは不変。playの実UI選択でカワウソが花へ歩くことを確認。これらはsource変更中の診断で、正式な同一build証拠は別に取得する。
- 旧fdf5 buildのcoreは121ファイル/1311テストまでPASS（出力フォルダーに重複した18テストを含む旧件数）。別タスクの筆算/印刷改修が進行中のため、現行一致549ファイルと正確な旧blob/patch復元23ファイルから、572source完全一致の独立QA copyを作成。共有checkoutの後続変更は戻していない。
- 初回の独立DEV5219は80レーンの数値上は全12 gateを通過したが、後でPostCSS設定の欠落とキー44px未達を発見したため、速度値を正式証拠から除外。rawを保持し、設定を復元した577ファイルの最終sourceで再測定する。
- 最終32cbのcore1299・学習入力23・critical path16場面・再確認4・自由遊び2・Island PWA4と実offline・通常島11・Park6・Park PWA3・classic PWA4・smoke31がPASS。全577入力と実画面を照合し、48枚のレビューを作成。正式80レーンも同sourceの隔離DEVで13ゲートすべてPASS。正解後入力P95はphone194.1ms、tablet195.4ms。

## Learning rationale

支援の考え方、具体/記号の接続、時間を空けて思い出す機会は、[IES 小学校算数の介入ガイド](https://ies.ed.gov/ncee/wwc/practiceguide/26) と [学習と指導の組み方](https://ies.ed.gov/ncee/wwc/PracticeGuide/1) の推奨を参照した。ここからアプリ内の短い支援と再確認へ応用する判断は実装上の推論であり、このアプリの効果量を示す研究ではない。家庭利用の結果は別に測定する。

## Docs To Touch

- `docs/product/28_mystic_island_spec.md`: 入力、再演、支援と再確認の契約。
- `docs/product/13_data_storage_migration_spec.md`: optional再確認状態。
- `docs/design/audits/2026-09-07-island-loop/README.md`: 実画面、学習/保存/速度の証拠と利用者観察の境界。
- `docs/index.md` / `docs/wiki/memory.md`: 最新の検証と運用上の注意への案内。

## Review By

- Review By: 2026-09-14

## Completion

- 2026-09-07: ローカル実装と必要な検証を完了。32cb固定ビルド、577入力archive、48実画面、失敗原本と再検証を保持。
- [完成画面](../../design/audits/2026-09-07-island-loop/review.html) / [検証と境界](../../design/audits/2026-09-07-island-loop/README.md)。
- 子どもの理解・定着・自発的再遊びは未測定。公開配布やcommit/pushは行っていない。
