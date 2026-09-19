# Studyの次問境界と検証対象の修正

2026-09-19。Nature Town実装後に残った2件の未合格を調査した。町の美術・シミュレーションは変更せず、Studyの問題送りと検証ハーネスを修正。

## 原因と変更

1. **実装の不具合**：誤答／スキップの「次へ」はフェードアウト中も旧callbackを保持する。新問題の描画後にもう一度実行すると、未回答の問題を飛ばせた。callbackが属する問題と、現在表示中の問題が一致するときだけ進めるようにした。採点・出題・SRS・報酬の計算は変更していない。
2. **fixed-tenの入力契約のずれ**：Studyは最後のマス入力で自動採点するが、計測側が追加のEnterを送っていた。Enterがフォーカス中の「次へ」を押し、続く明示clickが退場中のボタンを再度実行していた。Studyだけ追加Enterを除去し、手動確定のExploreは維持。例外終了時も今回の失敗reportで出力先を置き換え、古いPASSを残さない。
3. **PWA検証対象のずれ**：classic専用ハーネスを島有効buildに対して実行していた。島の開始は「はじめる」であり、classicの「たんけんを はじめる」を待ってtimeoutしていた。起動前にversion.jsonのモードを確認し、対象外なら必要なbuild設定を明示して終了する。classic buildで元の4シナリオを実行する。

## 根拠

- [修正前](before.json)：旧ボタンの最初のclickでindex 1、退場中の再clickでindex 2へ飛んだ。未回答の2問目が失われる再現。
- [修正後](after.json)：誤答・スキップの両方で旧ボタンがDOMに残っていることを確認した上で再clickし、index 1を保持。次の正しい回答でindex 2へ進む。
- この回帰確認は390×844、reduced motion、音OFFのDEV固定fixtureで、既存DOMの退場中イベントを明示的に再実行する診断。参加者評価や通常plannerの達成証拠ではない。[実行script](../../../tools/e2e-study-feedback-boundary.mjs)。
- [PWA実行ログ](pwa.txt)：classic production buildでonboarding、保護ルート間遷移、battleの同一ルートcheckpoint、実SW制御下のversion drift recoveryの4件PASS。町の実two-buildとは別の検証。
- [対象違いの早期終了](pwa-wrong-target.txt)：島有効buildをブラウザ起動前に拒否することを確認。
- [失敗reportの更新](failure-overwrite.json)：以前のPASSを置いた出力へ意図的な例外を発生させ、今回の `pass:false` / `eligible:false` に置き換わることを確認した診断。
- [実装の版](source-manifest.json)：親コミット5e17ef7＋記載した変更のみの隔離sourceで検査。通常チェックはlint（エラー0・既存警告1）、typecheck/build、434ファイル/4,072テストPASS。学習回帰のため全体検査を1回実施し、文書追記だけで再実行しない。

## 対象を選ぶ

`npm run e2e:pwa-update` は `VITE_ISLAND_ENABLED=false VITE_BUILD_PLAY_ENABLED=false` で作ったproduction buildを使用する。別ディレクトリなら `SANSU_PWA_PREVIEW_DIR` を指定。島／Nature TownのbuildはそれぞれのPWAハーネスを使用する。

正式fixed-tenは10反復・全正解／Q4とQ8誤答・Study／Exploreの計40run。固定fixtureであり、通常plannerの真正性は別の根拠が必要。途中の試走を正式合格として扱わない。

Nature Townの受入46/47、独立観察0人・最終美術HOLD・実機iOS未確認は、この修正で変更しない。

## テンポ計測の初回結果

[10反復の隔離コピー診断](fixed-ten-diagnostic.json)は全40run完走、数値・保存の全gateがtrue。Explore Q1/Q2正答P95 122.1ms、誤答から同問再入力P95 451.5ms、全正解のExplore/Study処理量比2.160。ただしGitのないexportを使ったためcleanRevision=false、eligible=false／pass=false。正式PASSに読み替えず、同じコードをコミットしたクリーン作業コピーで計測のみ再実行する。
