# パッチワークの住民を1体実装

- Review By: 2026-09-15

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/28_mystic_island_spec.md
- docs/design/references/2026-09-08-patchwork-residents/README.md
- docs/design/audits/2026-09-08-patchwork-resident/README.md
- docs/done/2026-09.md

## Goal / scope

ユーザーの「よろしく」を受け、既存カワウソ1体へパッチワークの布・縫い目・左右の大きな色面を実装する。顔の特徴、既存リグの歩行・着座・手元を維持する。追加の「しっぽへん」「まんまるしっぽで」に従い、尾は無地クリーム色でXYZ同径の小さな球体にする。ウサギとキツネを一律変更せず、新種・登場条件・保存の追加は行わない。

独立作業コピーで造形・検証を進め、担当するresidentRig、布素材モジュール、素材資源の管理と住民candidate識別だけを共有workspaceへ統合する。他作業の成長・学習・画角の変更を保持する。

## Art / interaction contract

採用済み方向は参考 `patchwork-residents-ref-20260908`。新しい画風の選択ではなく、既存3Dの同じ住民へ布素材を具体化する。比較ではカワウソの立つ・座る・歩く姿、同じ島と隣のウサギ、全景と近景を使う。元画像の暗い背景や写真用のボケは移さない。

全テンキー、追加0操作、正解650ms/誤答550ms、物理/タッチ入力、住民の経路・接地・家具の接点、reduced motion、PWAと保存契約は保持する。住民の候補IDを島全体の候補と別に記録し、並行中の島の版を上書きしない。

## Verification

- docs:check、lint、typecheck、全unit/integration、build/assets、smoke、PWA update/Island PWA、島の通常ループ、正式固定10問。
- 材質の再利用・破棄、UV維持、既存3種のリグ接点、実phone/tabletで起動→学習→帰島→遊び/着座→再学習、表示復旧を確認する。
- 最新runtimeと参考を比較。視覚的魅力、無説明理解/安全、runtime整合は別判定。独立した子どもの観察は未実施として報告し、ローカル実装・確認を進める。

## Progress

- ローカル実装として完了。固定10問80 run/15 gateも数値PASS。別テストと負荷が重複したため正式な公開速度認定へは用いず、実行条件を記録した。
- 原画像を保存し、カワウソ1体の布atlasとリグ、まんまるしっぽを実装。共有workspaceには学習・成長・音などの並行変更があり、検証済み固定v4ベースへ本件だけ重ねて検証後、共有v5を保持して統合した。
- 固定revision `patchwork-20260908-2732124deadc`。core 183ファイル/2,131テスト、専用実UI2サイズ/19画面、通常Island11、Island PWA7と実offline、classic smoke31/PWA4 PASS。共有統合後の型・関連64テスト・lintもPASS。
- 画角テストのviewport幅欠落と、専用QAのreload待機先を修正し、元の失敗と再検査を監査へ記録。runtime画角・学習・保存の契約は変更していない。
- [造形・実画面・検証と配布範囲](../../design/audits/2026-09-08-patchwork-resident/README.md)を保存。子どもの無説明理解と再遊びの独立観察はN=0。公開・commit・pushは未実施。

## Doc sync

- UI/造形の変更。親仕様01、UI07、島28とverification matrixを同期した。
- 保存schema・出題・進行の変更はなく、新規ADRや学習仕様への追記は不要。今回の一時的な検証手順は監査に置き、durable memoryへ重複保存しない。
