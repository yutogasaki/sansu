# 配置の「もどす」検証

## 対象

- 実app DEV `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true` / `VITE_ISLAND_LIFE_PREVIEW=true`。fresh browser、preview専用DB、sound off。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb`＋未commit変更。Candidate `island-life-discovery-a-placement-undo-v1`。
- 明示プロフィール/6credit fixtureから実購入・配置UIを操作。実学習での獲得や本番配布を証明しない。phone390×844、tablet768×1024（reduced motion）。

## 検査

購入配置→もどす（返金せず収納）、収納から配置→移設→もどす（元セル）、収納→もどす（元セル）、未確定移設から学習へ退出→戻る→reload。所有個体1・残高10・3件のundoOf・学習ログ不変を保存DBと照合する。

単体6ケースは、経過時間/育ち/既得ひかり/学習の維持、旧receipt保持、1段階のみ、内容差し替え拒否、並行writer CAS、別owner拒否、最新revisionでも古い編集IDを拒否、現在の通行安全判定による旧edge家具の復元拒否を確認する。

## 診断履歴

- 初回は3件の保存後、戻しで閉じたメニューを開かず「うごかす」を待つharnessの前提でFAIL。操作を修正。`/tmp/sansu-v3-undo-runtime-1.log`。
- 2回目のphone/tablet操作はPASS。ただし実行中にsrcの安全判定回帰テストを追加して開始/終了hash不一致となったため、候補全体はFAIL扱い。アプリ挙動は変更せず入力を固定した3回目で両幅PASS。

## 独立した判定

- 視覚: 既存の島・住人を保ち、44px以上の「もどす」を島下の操作領域へ表示。phone/tabletの移設画面で主操作・ナビゲーションと重ならないことを確認。[最終画像とbenchmark](contact-sheet.html)を比較。
- 無説明理解/安全: Human N=0。子どもの理解・意欲は未評価。
- Runtime: 取り消し範囲の単体/DEV検査。production/PWA/offline/throughputを含むrelease全体は未判定。

## 最終結果

- 実UI phone/tablet PASS。[report](report.json)。source開始/終了SHA-256 `72acc6ce0d8a323892b8a8d575692693bbc33d4c55fe84de3a2af4f584df56e1` 一致。
- `npm run verify:core` PASS、359 files / 3710 tests、docs/lint/typecheck/build/assets。既存Fast Refresh warning 1件、error 0。PWA precache10.78MiB/12MiB。
