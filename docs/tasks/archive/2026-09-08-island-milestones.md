# 島の成長と節目を伝える

- Date: 2026-09-08
- Owner: Codex
- Status: Completed 2026-09-08
- Review By: 2026-09-15

## Scope

ユーザーの成長実感・記録密度の指摘と、大きなアップグレードは分かるようにしたいという追加指示を反映する。正本は[仕様30](../../product/30_living_island_growth_spec.md)。成長の輪郭差、節目の案内、成熟・拡張に絞る新規記録と地区別比較を実装する。

追加指示を受け、東西の土地も各3.0×3.4の半径へ大きく拡張。既存の岸・橋・配置を保ち、外側への配置と移動も検証する。

## Verification

Sansu verification matrixのIsland行を適用。core・smoke・classic/Island PWA・Island UI・固定10問、phone/tabletの実画面を確認する。学習の閾値・入力・報酬契約は保持。旧snapshotは削除しない。実参加者の理解・再遊びは未測定。

## Docs To Touch

- 親01、仕様30: 成長と記録・土地拡張の契約。
- docs/design/audits/: 固定した候補の実画面と検証結果。
- docs/done/2026-09.md: 完了時の検証記録への参照。

## Result

東西の広い土地、4地区の大きな成熟差、学習を止めない節目通知、帰島後の比較導線、標準24区間で14件から6件に絞った成長記録を実装した。保存済みのsnapshot・旧報酬予約・配置を保持する。

固定候補`9300ea0-milestones-cc26726dd0e3`でcore170ファイル/1,995テスト、smoke31、classic PWA4、Island DEV10、production living各25区間、Island PWA7と実offline、正式固定10問80run/15gateがPASS。最終画像は[実画面の比較](../../design/audits/2026-09-08-island-milestones/review.html)、原FAIL・再試行・版・測定範囲は[監査記録](../../design/audits/2026-09-08-island-milestones/README.md)へまとめた。

樹冠の上切れを実画面から修正し、最終画像でも全体の収まりを確認。比較クリックが一度遷移しなかった`living-01`を保持し、同一app/QAの`living-02`が両viewportで完走した。単発失敗の原因は未確定。子どもの無説明理解・再遊びは未測定N=0。別作業を含む共有workspace全体の公開認定ではなく、この固定候補の実装・検証完了とする。commit/push/deployなし。

共有workspaceの最終docs/diff/typecheckはPASS。対象9ファイルの統合テストは80/82 PASSで、並行中のSRS/英語独力履歴への変更に由来する既存学習期待値2件が不一致。今回の成長パッチは固定候補と一致し、別作業を変更せず監査へ記録した。
