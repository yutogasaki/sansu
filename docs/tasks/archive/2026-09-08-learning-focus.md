# 学習中の表示領域とテンキー固定

- Review By: 2026-09-15

## Goal

学習中は島の景色を隠し、iPadの筆算でも全テンキーをスクロールなしで操作できるようにする。

## Docs To Touch

- docs/product/01_app_spec.md
- docs/product/07_ui_design_guideline.md
- docs/product/28_mystic_island_spec.md
- docs/product/30_living_island_growth_spec.md
- design-system/MASTER.md

## Scope / SSOT

- 親仕様01の3.1、UI仕様07、島仕様28、成長仕様30。
- 既存のiPad横向きの左右配置を保持して、縦向きも表示高内で問題側だけを伸縮する。
- 出題・採点・保存・PWA・3D素材は変更しない。

## Verification

- docs:check / lint / typecheck / test:run / build。
- 実ブラウザのiPad横/縦、低いブラウザ表示高、phoneで通常・図・分数・筆算・英語・ヒント/お手本を確認。
- 全キーの44px以上、画面内のhit、問題スクロール前後のテンキー位置、帰島・再開を確認。

## Progress

- ユーザーの学習優先・テンキーのスクロール不要という方針をSSOTへ反映。
- 学習中の島を非表示にし、問題側だけを伸縮・scrollするレイアウトを実装。既存の横向き配置と同時作業の筆算切替UIを保持。
- 固定ビルドのChromium/WebKitで各196状態PASS。共通smokeの部分失敗と検証の限界は[監査記録](../../design/audits/2026-09-08-learning-focus/README.md)に保存。
- ローカル実装完了。公開・commit・pushなし。
