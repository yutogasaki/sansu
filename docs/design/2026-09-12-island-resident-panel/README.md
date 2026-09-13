# みんなの ようす：住人を主役にした情報パネル

2026-09-12。ユーザーの実画面フィードバックを受けたローカル改訂。公開・配布はしていない。

## 変更

3列の色付きカードを、島と同じモデルの姿・名前・現在の行動・好みを並べた縦の一覧に変更。ぽこもこのスカーフは保存済みの色を使う。描画画像はメモリ内で再利用し、追加WebGLコンテキストは生成後に解放する。画像が作れない場合も名前と行動は表示する。

育ち欄は淡く小さくし、しずく・ひかりの説明は44px以上の折りたたみ操作にまとめた。閉じる操作はスクロール本文の外に維持。獲得・日次目標・保存処理の変更はない。

## 検証対象

- 固定ローカルproduction: `http://127.0.0.1:5356`
- artifact: `/tmp/sansu-resident-panel-final-20260912`
- `VITE_ISLAND_ENABLED=true`, `VITE_ISLAND_LIFE_ENABLED=true`
- 共有の未コミット作業ツリーをビルド。HEADだけを検証済みコミットとは扱わない。
- ブラウザ検査: `tools/e2e-island-life-resources.mjs`。実初回設定、3住人の画像、説明の初期折りたたみと展開、閉じる操作、実学習と残高、再読込を確認。5桁の文字幅診断はDOMのみで実獲得とは別。

## 独立した評価

- 見た目：カードの面積と文の折返しを減らし、実モデルと行動に視線を集める案。ユーザーの採用判断は未取得。
- 理解・安全：名前と行動を常時表示。通貨説明は任意。未達に対する文言・判定は変更なし。参加者N=0、無文字理解の実証ではない。
- 実装：実行結果は同フォルダのレポートに記録。実機iOS・公開PWA更新の検証ではない。

## 実行結果

- lint: PASS（既存IslandMilestoneのFast Refresh警告1件）
- typecheck / build / assets:check: PASS
- 全351ファイル・3,665テスト: PASS
- production browser: 320 / 390 / 768 / 844幅すべて終了コード0、レポート保存。
- [phoneの初期表示](phone-information.png)、[tablet](tablet-information.png)、[狭幅](small-information.png)、[横向きの説明展開](landscape-resource-guide.png)
- [実行レポート](report.json) / [固定ビルド識別](artifact.json)
