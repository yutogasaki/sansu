# 学習単元の対応とLv11比較試作

## 目的

全教材を概念と表現へ対応させ、新規回答から確認できる証拠を保存し、Lv11の7単元を独立に評価できる最初の段階を完成する。

- Review By: 2026-09-15
- 状態: 2026-09-08完了。第一段階の実装と検証を完了し、通常の学習進行への適用は次段階とする。

## Docs To Touch

- [親仕様](../../product/01_app_spec.md)
- [単元と習得証拠](../../product/31_learning_units_spec.md)
- [算数の単元対応表](../../product/32_math_unit_catalog.md)
- [英語の単元対応表](../../product/33_english_unit_catalog.md)
- [英語仕様](../../product/03_english_skills.md)と[単語リスト](../../product/05_english_words.md)
- [検証マトリクス](../../ai/verification_matrix.md)
- 完了時: `docs/done/2026-09.md`、`.agents/tasks/DONE.md`、`.agents/tasks/TASKS.md`、`docs/wiki/memory.md`

## 実行

1. 全算数・英語の単元対応と前提の検査。
2. 版付き問題文脈とoptionalな回答証拠の接続。
3. Lv11の独力・表現・遅延確認の比較と再現可能なレポート。
4. verify:core、保存・予約・既存出題の回帰、必要なbrowser検証。

共有作業ツリーには並行した島の変更がある。他の差分を取り消さず、この目的のファイルだけ編集する。

## 実装した範囲

- `curriculum-v1`で算数118教材を74既存単元へ対応させ、未実装の基礎9単元を区別した。合計83単元。色名・日本語の読み・数量・空間などの系統を分け、必須前提と推奨順序の参照・循環を検査する。
- 算数Lv11の19教材を7単元へ整理した。2桁−2桁は繰下なし/ありを別の型として記録する。式・筆算・図などの表現を混ぜず、同じ方式で必要な型を確認する。
- 英語1,184項目を保存IDごとの訳語認識単元へ1対1で対応させた。異なる綴り1,173、旧category49分類、旧20レベルの件数を棚卸しAPIで確認できる。同綴りの項目や`properly`の再登場を統合しない。`positive`と`local`の明白なかな誤記2点を漢字訳に合わせて校訂した。
- 通常Study・島・遊園地の新規問題へ版付き文脈を凍結し、既存の回答transactionへ全問の証拠を追加した。島・遊園地の支援付き完了や途中の誤り・支援開始は既存イベントへ保持し、SRS用の正答を増やさない。再送と再開は既存receipt・予約の契約を維持する。
- `readMathLevel11Pilot(database, profileId, asOf)`でプロフィールの記録を読み取り専用で比較できる。通常の回答ごとに全履歴を再集計しない。新判定からプロフィール・planner・昇格・SRSを書き換えない。
- `npm run learning:report`で検索可能な`output/learning-units/report.html`とJSONを生成する。全教材・単元・旧レベルを検索し、足し算のみ、同問反復、支援、同日、後日、定着後の支援、旧記録の7合成シナリオを比較する。

## 判定と収集の境界

- 既存の保存ID、29/20レベル、通常出題、SRS、解放・昇格、保護者範囲を保持する。今回の単元対応はレベルの再採番や通常plannerの切替ではない。未実装の前提を通常出題の必須関門にしない。
- 異なる3問の独力正解と24時間以上空いた確認は試作の設計値であり、最適と実証された閾値ではない。同問の即時反復や日付境界だけで定着を認めない。誤答・支援・スキップ後は当該単元を再確認する。
- 英語は綴りから訳語を選ぶ`recognition`のみ。聞く・話す・書く能力や、幼児向けの音声カリキュラムの完成を意味しない。
- 旧ログ、紙テスト合計点、初期retired、島の演出観測から新単元の達成を作らない。文脈のない旧予約へ後付けしない。DB schema・index・既存プロフィールの一括変換は追加していない。
- 旧Explore、および通常Studyで予約後に表現を変更した回答は新証拠の認定対象外。通常Studyの未完了途中操作は新しい永続イベントを増やさないため、中断直後まで完全に評価できるとはしない。
- 合成シナリオと自動ブラウザ操作は実参加者の学習成果・翌週の定着・自発的再遊びの証明ではない。子ども向け画面の追加、公開、commit、pushはこの段階の作業に含めていない。

## Verification

固定コピーは`/tmp/sansu-learning-units-verification`。revisionは`units-20260908-5925126f4021`、744ファイルのsource hashは`5925126f4021d67e5c0624d20c317fecccadfe7d43def3faeb3f022c69569a4f`。manifestと証拠は`output/learning-units/verification/`に保持する。

| 確認 | 確定した結果 | 証拠 |
|---|---|---|
| `verify:core` | PASS。170ファイル・1,989テスト、docs/lint/typecheck/build/assets。Node22 | `verify-core.log` |
| 単元レポート | 対応表エラー0、合成7ケース。検索・教科/旧レベル/提供状況・単元/教材切替・ページ送り、HTML/JSONの安全な埋込みを確認 | `output/learning-units/report.html`、`report.json` |
| DEVの既存導線 | 54/54 PASS。smoke31、learning-progress6、Park6、Island11。受理runにHMR/reloadなし | `dev/summary.json` |
| 島の成長を含むDEV | phone/tablet各25区間、4地区成熟・有限7物・発見・3D履歴/再演、WebGL復帰、全入力形式を確認 | `dev/island/report.json` |
| production/PWA | classic4、Park3、Island7の計14保護フロー＋実Service Worker offline回答・再開がPASS | `production/runs.json`、`production/island/pwa-report.json` |
| 実生成問題の新証拠 | 5/5 PASS。式の独力、訂正後reload、筆算独力、筆算支援後reload、英語recognition。実問題・回答・保存の証拠を照合 | `evidence-browser/report.json` |
| source維持 | DEV終了時に744ファイルをmanifestと再照合し差異0。productionと証拠ブラウザも開始/終了を記録 | `dev/summary.json`、`production/source-before.json`、`production/source-after.json`、`evidence-browser/report.json` |
| 正式固定10問throughput | 全80run・15gate PASS、eligible。source差異0・同一描画revision。正解→入力P95 phone194.5ms/tablet194.7ms、区間境界189.6/196.1ms、追加操作0 | `throughput.json`、`throughput.log` |

DEVのsmoke/learning-progressはNode24.14.0、Park/IslandはNode22.22.3。production/PWAはNode24.14.0。双方とも`engines >=22`の範囲内で、実版を各結果へ記録した。実ブラウザはPlaywright1.58.1、productionのChromium145.0.7632.6。

初回smokeの31PASSには同時production buildによる3回のVite page reloadがあったため、正式な受理対象をbuild完了後の`dev/smoke-stable/`へ差し替えた。初回Parkは両flag有効のrootが島へ進むため待機に失敗した。Park実行時はIsland無効・Park有効とし、`dev/park-stable/`で全6件を再確認した。元のログを削除せず、検査やソースを緩めていない。

## 完了記録と後続

正式throughputは他の担当ブラウザ・buildを終了してから単独で実行した。Node24.14.0 / Chromium145.0.7632.6のDEV固定fixtureによる自動keyboard測定であり、実機や子どもの解答速度ではない。rendererの候補は`mystic-island-living-v3`、学習候補は`mystic-island-learning-v2`。新しい外観の承認とはしない。使用したブラウザと検証サーバーは終了した。

月次doneと共有indexへ記録し、本タスクをarchiveへ移動した。長期契約は仕様31とmemoryへ保持する。次段階の位取り問題、Lv11の実際の選択順、英語の音声・絵の単元は仕様31の後続範囲。今回の完了を、全学年の最適な境界や学習効果の実証とは扱わない。
