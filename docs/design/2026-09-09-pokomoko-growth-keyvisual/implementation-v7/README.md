[Final main integration evidence](main-integration/README.md) / [latest runtime screens](main-integration/review.html)

# 家の外・室内・学習の接続7

2026-09-09。mainへ採用する独立候補は[コミット検証](commit-check/README.md)と[その実画面](commit-check/review.html)を参照。以下は先行の共有snapshot。[実画面の一周と基準比較](review.html)。[統合仕様47](../../../product/47_home_island_integration_spec.md)に従うDEV実装。初回公開候補と引継ぎ契約を先に定義し、本番移行を自動実行しない。

## 実装

同じThree Scene内の家に閉じた室内を置き、外/中/撮影で家のObject3DとCanvasを保持する。室内には同じぽこもこを置き、実資格のある既存の賞を展示する。既存の写真writerで実景を保存し、外へ戻った後も同じ学習予約を再開する。DEVで未対応の床タップ歩行は案内しない。カメラの撮影対象は実際に表示できる家/島に限定し、住民の近景や工作は対応する既存画面から利用する。

成長演出は最初の可視描画成功で消費する。親の未消費値と描画中の演出を分け、直後に学習へ退出して再訪しても再演しない。対象がない時の空文字検索が無名のworldを返し、島全体を縮める不具合も修正した。描画・撮影・閲覧から成長や学習量を付与しない。

## 対象と証拠

- 候補：`home-journey-connected-house-v7`
- 配信：DEV＋`VITE_ISLAND_ENABLED=true`＋`VITE_HOME_JOURNEY_PREVIEW=true`。公開切替なし。
- 実target：`http://127.0.0.1:5218`。実DOMのrevisionは `development-local`、起動versionは[source.json](source.json)のruntime欄。基準コミットに未コミット変更を含む固定snapshotで、コミット単体の検証とはしない。
- app/QA入力：957ファイル、fingerprint `f42966e5bd747f2e61b21a4dbc69371da96e471efe496c9fa5761ce0021a429a`。ブラウザ終了後も同一。
- キャッシュ：新しいブラウザcontextからDEV起動。インストール済みPWA/二版更新の証拠ではない。
- [ブラウザ結果](browser-report.json)：390×844通常モーション、768×1024 reduced motionの各レーンで空DBの初回設定→通常plannerの実回答45問分→成長→家/室内/記念/実写真→再読込→同予約再開。pageerror 0。家/Canvas同一、初期成長直後の退出と非反復、カメラ切替の保存不変を確認。
- 保存比較は既存helperの7store（島/予約/イベント/ログ/算数memory/英語memory/探索）に限定する。写真保存では正当な `photo_changed` receipt1件だけを許容し、それ以外を比較する。全DBや全プロフィールの検証とはしない。

## 診断からの修正

固定最終版の検査：型検査・build/assets・対象lint・対象7ファイル31テスト・全314ファイル3,376テスト・classicスモーク31項目が通過。全体lintは先行snapshotで既存warning1/エラー0、その後の差分は最終版の対象lintで確認した。全テストの初回はmaxWorkersだけを指定して既定minWorkersと競合し、テスト未実行。min=1/max=4を明示した再実行で全件通過した。[検証記録](verification.json)に対象とコマンドを保持する。資料検査も通過。

1. 初回の再訪検査が失敗。成長対象の空文字検索がworldに一致していたアプリ不具合を修正。
2. 初回の室内画像で地形が床へ出たため、部屋の床を地形より上へ置いた。スマホの室内高を抑え、棚と操作を見渡す。
3. 撮影ボタンのQA文言が実UIと違いtimeout。実際の「しゃしんに のこす」へ修正。
4. 写真保存時に全イベント不変を要求したQAが失敗。正当な写真receipt1件を検査してから、残る7storeの不変を比較するよう修正。保存失敗を無視したものではない。

以上は先行の作業ツリー診断。正式な両幅の通過は固定snapshotの結果に限定する。

## 独立判定と残り

- 視覚：HOLD。外景の海・植栽・素材密度はキービジュアル未達。室内も造形・照明の最終調整が必要。今回の接続通過をアート承認にしない。
- 無説明理解・安全：音なし/動きを減らす経路は確認したが、独立した子どもの確認はN=0。意欲・継続・学習効果は未検証。
- Runtime：上記のDEV経路は通過。初回公開候補の全21通常＋3レア、旧データの具体的変換、きせかえ/配置/工作の新景観への接続、本番offline/PWA・速度の総合ゲートは未完。

全体の残作業は[整合監査](../../2026-09-09-home-island-consistency-audit.md)を参照。今回は1の統合仕様を作成、2の引継ぎ契約を定義、3の家/室内/撮影/学習をDEV接続、4の成長演出の再訪不具合を修正した。2の移行実装と3の全メニュー統合は未完。
