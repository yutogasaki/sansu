# 英語基礎 F01 / F02 の実装と検証

[実画面一覧](index.html) · [仕様](../../product/english-foundation.md) · [実行タスク](../../tasks/active/2026-10-20-english-foundation.md)

## できたこと

F01「A・B・Cに あおう」とF02「えいごの おとを きこう」を、既存英単語とは別のコースとして実装。導入・3問・支援・独力・遅延・中断再開、コース変更の次予約適用、子どもの短い記録と保護者の形式別記録を接続した。旧記録から基礎の能力を推測しない。

学習DBはschema10へ追加移行。元の完了とoutboxは原子保存し、Growingのprofile共通台帳と財布/時間を原子受信する。Growingはschema12へ移行し、旧cultivated保存をコピーして旧writerの書込先と分離する。完了日時と初回受信島を保持し、古い正当receipt・再送・航海でも二重加算しない。削除は永続フェンスと起動後の再開を持つ。

固定音声13（英語6/日本語案内7）と原作SVG3を版付きで同梱。manifestのhashとPWA precacheを検査し、出題前にも教材hashを照合する。音オフ・退出・背景化で再生を停止し、代替表示は独力と区別する。既存の1,184語・算数・写真を自動合算しない。

## 対象と証拠

2026-10-20、Chromiumの390×844通常motionと768×1024 reduced motion。`VITE_ISLAND_ENABLED=true`、Growing本体、学習candidate `foundation-v1`。最終版は`development-local:7202afc5-906f-42a2-833b-11bdff4460fb`（正確な値は[build manifest](build-manifest.json)のversion）。共有checkoutの統合内容で、独立したコミットや公開版とは主張しない。

[browser verification](browser-verification.json)は実初回設定→導入→誤答→帰島/同予約→お手本の支援完了→通常音声回答→F02→次予約のコース変更→受信4回/しずく8→実SW更新→offline同予約→音オフ/代替表示を両幅で確認した結果。完了前の破損教材が採点/報酬を作らないことは、実precacheの1音声を変更して復元した明示故障診断。通常の利用経路と区別する。

2つの独立production buildを同一originへ切替し、実Service Worker更新を行った。更新前後の予約全体を比較し、同じF02の問題・支援・コースpendingを保持。旧buildは今回の基礎実装途中の版であり、過去の全deploymentや全保存の移行を検査した意味ではない。新旧schemaの移行/旧writerは別の対象unit testsで確認した。

実行コマンド：`SANSU_FOUNDATION_OUTPUT=<新規出力先> SANSU_FOUNDATION_OLD_DIR=<旧build> SANSU_FOUNDATION_NEW_DIR=<新build> node tools/e2e-english-foundation-update.mjs`。単独版は`SANSU_FOUNDATION_URL=<preview URL> SANSU_FOUNDATION_OUTPUT=<新規出力先> node tools/e2e-english-foundation.mjs`。

## 技術検証

- 専用保存/復習/予約境界/受信/教材位置の最終35件、音声所有2件がPASS。旧互換の対象222件、Growing全410件も各対象版でPASS。
- typecheck、lint（既存warningのみ）、docs:check、通常build、最終固定production buildとassets:checkがPASS。precache158ファイル/8.80MiB、上限12MiB。
- classic smoke32件、PWA checkpoint4件、classic実2-build更新とstale-worker/通信不能時の保存保持がPASS。最初のPWA checkpoint呼出しはIsland buildを指定して対象guardで停止し、classic buildを指定して再実行した。
- 追加検証で文言期待2件を正本42へ合わせ、対象59件がPASS。未完だったnative coreも458.76秒でPASS。前回の合格済み結果との合算は648ファイル/5,506件、失敗0・未完0（今回単独の全件再実行ではない）。ポータルも現在の正本を再照合して参照版を更新・再生成し、入口/portal検査をPASS。[追加検証](verification-recheck.json)・[全体集計](unit-verification.json)に記録する。

再生成可能な生ログと途中画面は `output/playwright/english-foundation-2026-10-20-v1`、`output/playwright/english-foundation-2026-10-20-v2`、`output/playwright/english-foundation-2026-10-20-update`、`output/playwright/english-foundation-2026-10-20-final`、`/tmp/sansu-foundation-*.log`。リンク先の最小証拠はこのフォルダへ保存した。

## 未確認とリリース境界

音声はmacOSの固定音声生成によるローカル確認素材。発音/アクセント/自然さの人による採用、音声の再配布権利確認、3枚の絵の子どもによる識別確認は未完。[音声の技術確認](audio-technical-check.json)はdecode可能性/秒数/容量だけを示す。実スピーカー/実機、視覚支援利用者、子どもの無説明理解/2〜4分の所要時間/翌日の自発再訪も未確認。A–Z・大小文字・フォニックス・発話/書字は次の範囲。公開・push・commitは行っていない。

古いSansu schema9 writerはDexie fallbackでschema10を開ける。schema番号だけの旧writer排除とは主張しない。旧普通プロフィール書込で基礎予約が消えないこと、owner消失時に基礎書込/receipt検証を拒むこと、新しい削除のtombstoneを保持することを検査した。確認したGrowing v10 writerは新正本を上書きできず、古いreset transactionがabortすることを検査した。全旧binaryや旧アプリによる同一ID再利用までは保証しない。

## 利用者の「検証」による再確認

実行コードと最終build全ファイルのhash不変を確認し、同じ版の実画面/SW/offline証拠を再利用。対象59件、型/lint/docs/素材検査、native coreと入口/portalを検査した。対象テスト（ローカル記録 `recheck-focused.log`）・native実行（ローカル記録 `recheck-native-core.log`）・portal実行（ローカル記録 `recheck-portal.log`）。初回の文言FAILとportalの古い参照は初回記録として保持し、仕様へ合わせた期待値と[参照版の監査](portal-reference-audit.json)を別に残した。製品コードの変更、公開、採用判断の引上げは行っていない。
