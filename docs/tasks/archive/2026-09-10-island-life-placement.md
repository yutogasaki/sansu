# 島の配置プレビュー

- Review By: 2026-09-17

## Goal

継続指示により、購入・移設時の確認を短くする。置く前の実物と利用経路、無効な配置の事前表示まで。住人の行動規則・学習・保存形式・経済は変えない。

## Plan

1. 仕様48へ仮表示と確定前判定を記載。
2. 同じ配置判定をworld/マス一覧/確定操作へ接続。
3. phone/tablet reduced motionで購入・移設・取消・通常学習への復帰を検査し、v3証拠を保存。

## Docs To Touch

仕様48、runtime-v3の実画面・版境界、月次完了記録。

## Verification

core、配置判定と描画のfocused checks、通常学習からの新島E2E。既存学習・旧島・PWAの入力に差がないことをv2と比較し、既存結果の版と今回の結果を区別する。最終アートと子どもN=0は引き続きHOLD。

## Result

配置の仮表示・全経路の事前確認・確定操作の近接を実装。core 3,467、phone/tablet新島、既存島11シナリオ、smoke31、classicPWA4、島PWA8+offline、固定80走行が通過。旧島の分数QAを整数表示へ合わせ、同じ保存問題の誤答/再試行で確認した。最初の配置UIタイムアウトは再現せず、原因未特定として保持。

[実画面と検証](../../design/2026-09-10-island-life/runtime-v3/README.md)。アートHOLD、子どもN=0、本番移行は後続。アプリは固定コピーと同じで、修正QAは別版として記録。共有indexのstage/commit/pushなし。
