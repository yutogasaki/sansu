# 島のズームと回転

[実画面の流れ](review.html) · [操作の記録](screens/report.json) · [固定ソース](build-source.json) · [ビルド](version.json)

横ドラッグ/横スワイプで360度回転、ピンチ・ホイール・ボタンで1〜2.5倍の拡大縮小と一操作の復帰を追加した。縦スワイプはページをスクロールする。学習・家具配置・比較・明示再演・工作中は既存の操作を優先する。

## 実画面の出所

- Target: `http://127.0.0.1:5397/` の固定production bundle。公開サイトへの配信ではない。
- Revision: `camera-20260908-007a34b47b5e`。未commitの作業コピーを固定し、全入力のhashと実versionを保存。
- Delivery: `mystic-island-v1`、Island flag=true、BuildPlay flag=false。
- World: `mystic-island-living-v5`、resident=`patchwork-otter-v1`、learning=`mystic-island-learning-v2`。
- Phone 390×844 / tablet 768×1024。操作検査では独立したnativeプロフィールfixtureを使い、音off。SWはブロック。起動・眺め変更・配置・次問・描画復旧を同一buildで撮影。
- 拡大・回転はカメラだけを変更し、家具の位置/向き・学習/成長データの不変を照合した。子どもの観察や通常の学習成果の証拠にはしない。

## 三つの判定

- 見た目: 作者目視では、既定の景色と素材を保ったまま住民へ寄り、家/木の裏側を見られる。上部の44px以上の補助ボタンと「もとの ながめ」をphone/tabletで確認。倍率を上げた時の周辺の見切れは拡大の結果で、既定に戻すと全景へ戻る。新しいアート候補の正式採点や子どもの魅力評価とはしない。
- 無音時の理解・安全: 音や慣性に依存しない直接操作、キーボードで使える補助ボタン、reduced motion、取消・家具の誤選択防止を検査済み。未説明の子どもが操作を発見できるかは未評価。
- Runtime: カメラ専用のphone/tablet E2EはPASS。mouse/touch/ピンチ/ホイール/キーボード、縦スクロール、取消、resize、DB不変、配置のdragと取消、学習の固定画角と次問、WebGL復旧を検査した。全体ゲートは下記の別作業中の不一致を含むためPARTIAL。

## 検証

- カメラ/既存画角/テーマのunit: 3ファイル37件PASS。
- lint: エラー0、既存の`IslandMilestone.tsx` Fast Refresh警告1件。
- 固定コピーの全unit: 2394件PASS、2件FAIL。`IslandCustomization.test.tsx` の価格不足表示、`experienceRepository.test.ts` の残高期待値が、並行作業の価格/ほし計算と不一致。
- `npm run build` / typecheck: 固定時点の別作業中`IslandStage.tsx`に追加された工作callback/第4引数をruntimeがまだ受け取らず、TS7006/TS2554で停止。カメラ実装直後のtypecheckと対象37件はPASS。未完成の工作を削除・差し戻して全体成功にはしていない。
- 共有workspaceの後続の工作接続後、typecheckを再確認してPASS。固定した上記bundle/全unit結果を、後続版全体の成功に読み替えない。
- 工作接続後の共有DEVでも、[カメラ専用phone/tablet E2E](current-workspace-report.json)を再実行してPASS。固定productionの画像と、この後続DEVの記録は分けて保存した。
- `vite build` のproduction bundle生成と `assets:check`: PASS。145 precache entries、10.30MiB / 12MiB。上記型エラーを含む通常buildの成功とは区別する。
- `verify:core` / docs:check: 別作業中`island-balance`の必須項目不足で停止したため、残りの検査を個別実行。
- 共有workspaceの最終docs:checkでは、カメラ文書のエラーは0。後続作業の`auto-answer`/`math-hints`の必須項目不足が残る。
- smoke: PASS。classic PWAの導線/保護/同一route/update drift: PASS。
- Island E2E: 固定DEVで初回onboarding待ちがtimeout。Island PWA: 新しい問題数ベースの成長に対して、既存helperが一律一区間分の増加を期待し `1 !== 2` で停止。PWA全体/offlineの新しいPASSは認定しない。
- [固定10問](throughput.json): 10反復×phone/tablet、適格な反復測定。全体FAIL。通常正解P95は399.5ms / 507.2ms、誤答から再入力336.2ms / 515.8ms、全正解のStudy比1.85 / 1.30、追加操作0。tabletの区間境界P95が808.7msで650msを超過した。他のgateはPASS。カメラを使わない学習中の測定だが、今回の変更との因果は未特定。区間境界の速度の新しいPASSは認定しない。

## 残る確認

並行作業の工作・価格・成長ペースと対応テストが揃った版で全体ゲートを再実行する。実機Safari/Androidの指操作と、子どもの無説明での操作発見・再遊び意欲は未確認。カメラ状態は保存せず、再読込/復旧で既定画角から再開する。
