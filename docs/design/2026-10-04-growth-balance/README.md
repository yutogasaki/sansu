# 来訪と成長の配分 — 2026-10-04

1日20問を基準に、来訪と解放を分散した。新しい船は48＋2×住人数のまち時間。遊具はブランコLv2、演奏Lv4、すべりだいLv6、トランポリンLv7、ふんすいLv8。独力習得の記念品は品名で案内し、収納の先頭へ置いて教科・レベルを添える。[現行仕様52](../../product/52_growing_island_game_spec.md)が規則の正本。

既に開いた品・所有物・船の保存済み到着時刻・残高/時間を保持。家の成長、げんきと土地条件、自然、学習の判定はそのまま。保存形式は変更しない。

## 成長の試算

同じ配置方針の20問/日では7日目5人、30日目16人/Lv6、90日目36人/Lv8、365日目95人/Lv10・216マス。6問/日は30日目6人/Lv3。装飾優先も365日目93人・192マスまで育つ。30→90日で解放品が21→23へ増える。家の待ち時間を3倍にした比較でも初回の段階変化はレベル条件に左右されたため据え置いた。子どもの任意の次の学習や再訪を示すデータではない。

## 検証と範囲

- core: 537 files / 4,693 tests、docs/current-entry/lint/typecheck/build/assets PASS。lintの既存Fast Refresh警告1件。
- Growing対象: 34 files / 174 tests PASS。既得解放と保存済み船、1問/日、6問/日、週まとめ、装飾優先、365日成長を含む。
- DEV `http://127.0.0.1:5272/#/island`、Growing flag-on、390×844/通常motion・768×1024/reduced motion。実回答10問で家の不足→累計20問で購入→reload/同予約への復帰が両幅PASS。
- 記念品の先頭表示→配置→reload保持と、旧版1→3/3方向の地区拡張/bank保持は明示fixture。実際の独力習得や豊富な資源の獲得の証拠とは分ける。
- classic smoke初回30/31。1024×1366の旧Root Tangleヒント待ちがtimeout。コード変更なしのRoot Tangle対象再検査は5/5 PASS。初回を全PASSへ置き換えない。
- [検証metadataとsource SHA](verification.json)に実target、DEV revision/version、delivery/visual candidate、app root flagとGrowing markerを保存。QA開始/終了のapp・QA source一致を確認。生ログは `/tmp/sansu-growth-core.log`、`/tmp/sansu-growth-focused2.log`、`/tmp/sansu-growth-smoke.log`、`/tmp/sansu-growth-smoke-root.log`。raw capture/reportは `output/playwright/2026-10-04-growth-balance`。

実SW/offline/two-build・実機・子どもの理解/自発的な次の学習・翌日再訪は未検証。UI画像は収納の表示確認で、美術全体の承認を示さない。

## 実画面

[スマホの記念品](390-learning-keepsake.png) / [タブレットの記念品](768-learning-keepsake.png) / [スマホ購入後](390-saved.png) / [タブレット購入後](768-saved.png)。
