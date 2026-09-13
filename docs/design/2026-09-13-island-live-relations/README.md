# 通常の島のR1/R3記録

## 対象

DEV `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true`、preview専用DB。HEAD `e0aac1b5c7e396c57372acb51be434cc5dcc4c59` に今回の未commit変更を加えた候補 `island-life-discovery-a-live-relations-v1`。phone390×844 / tablet768×1024（reduced motion）、fresh context、sound off。明示6credit/ベンチ/花またはブランコのDEV所有fixtureを使い、実取得や本番配布とは区別する。

## 経路

全面DOM被覆中は視線readyでも1.6秒未記録→覆いを外す→必要なら実「ながめ」の回転で遮蔽物の裏を見せる→通常島のliveを保存DBで確認→履歴から当時の実3Dを再演し元eventID付きreplayを保存→任意に本人保存→対象を遠くへ移設すると通常の休憩へ戻り、履歴は増えない→復元すると同じ着席住人が対象を再び見る→学習へ復帰。所有/残高/credit/actions/学習storeも検査する。

## 診断履歴

初回 `/tmp/sansu-v3-live-relations-runtime-1` はphone2ケースPASS後、tablet花の初期画角で実際の花が住人に隠れ、core=falseのためlive待ちでFAIL。アプリの判定を緩めず、ハーネスに実カメラ回転を追加した。初回は並行reviewのガード/テスト追加もあるため最終source一致の証拠には使わない。

無料観察訪問を閉じた後にliveへ付け替えないガードを追加。実Threeの単体テストで着席前/期限切れ、顔と対象、DOM/3D遮蔽、画角外、非表示geometry、対象利用者/訪問交代、無料観察訪問の除外を確認する。保存hookはPWA hold、失敗evidenceの再送、owner切替、退出後callbackを検査。

## 独立した判定

- 視覚: 既存の島/住人/物を継承し、今回は可視記録の接続。並行検討中の新しい環境アートを本実装の完了に含めない。最終contact sheetで通常島と当時の場面を比較する。
- 無説明理解/安全: Human N=0。子どもの理解・意欲・学習効果は未評価。
- Runtime: このDEV経路と単体/coreの範囲。GP3の順次巡回、v3成長/有限ひかり/土地checkpoint、B、production/PWA/offline/throughputを含むrelease全体は未完。

## 最終検証

- DEV全4ケースPASS。[統合report](report.json)、[phone](report-phone.json)、[tablet](report-tablet.json)、[benchmark付き比較画像](contact-sheet.html)。
- 両実行のsource開始/終了SHA-256 `78fa1893fc823eb0a4837d7ce879b407bd5e1ceac386f4faa4426b03afa0ee80` 一致。花の両画面は実カメラ左回転2回、ブランコは初期画角で成立。R3の実利用者もsnapshotへ保存。
- `npm run verify:core` PASS: 363 files / 3726 tests、docs/lint/typecheck/build/assets。既存Fast Refresh warning1件、error0。PWA precache10.79MiB/12MiB。ログ `/tmp/sansu-v3-live-relations-final2-core.log`。
- 全体smoke/PWA/offline/throughputのrelease認定は未完。今回の画面・表示記録の実装checkpointとして扱う。
