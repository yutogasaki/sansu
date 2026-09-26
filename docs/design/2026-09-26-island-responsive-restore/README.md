# 島の復元中の応答と追加学習の差分反映

## 対応範囲

iPhoneのホーム画面起動で長い白紙・操作不能、島を開けないという報告への修正。新しい学習で全履歴を再生する経路を削減し、必要な全再生・留守中の計算・保存を専用Workerへ移す。島の読込・描画例外は再読込と設定への案内で受け、ナビゲーションを残す。既存の読み込み分割、画面内の重複再生・非表示メニュー計算の削減、通常buildのLife既定値修正も統合した。

正本は[仕様48](../../product/48_island_life_spec.md)。価格、報酬、学習、成長、履歴順序、保存形式は変えない。学習追加が検証済みprefixの後に限る場合だけ再利用する。遅延到着、同時刻の既存操作、切替境界、別本人・履歴変更・cache欠落では全再生に戻す。

Workerの起動失敗は送信前のみ従来処理へfallback。送信後に返答が失われた場合は自動で二重書込みせず、既存の同一intent IDによるretryを維持する。120秒で返答がないWorkerは停止して再試行可能な失敗にする。PWA更新holdは応答まで維持する。

## 検証

作業ツリーのアプリ入力hash: `e0e78ff7faf61e6ae3b982cc376761d8d60cd957bfbc0c956902827c60448096`。
固定production: `development-local:1c88b12c-3781-466e-8e70-4bb4170ebd3b`。Island/Life有効、preview/Discovery無効、既存moon-garden表示。既存の作業中差分を含む統合候補を検査した。実機iPhoneではない。

- `npm run verify:core`: docs、入口ガード、lint、typecheck、468ファイル・4,212テスト、production build、asset budget PASS。
- `npm run e2e:smoke`: classic回帰31件 PASS。
- `creditPerformance.test.ts`: 7日合成履歴の学習1件追加は差分計算約0.42ms、全再生約3,503ms。同一状態、保存後の復元、二重付与なし、複数学習・成長・購入、危険なprefixへのfallbackを検査。端末の起動時間や全処理の改善倍率ではない。
- `lifeUpdateClient.test.ts` / `useIslandLife.test.ts`: Worker起動前fallback、起動待ち上限、送信後の成否不明・domain拒否に自動再送しないこと、PWA hold、CAS、同一操作retry、本人変更と未開始操作取消を検査。
- Life storage: phone 390×844 / tablet 768×1024で実初回回答、購入、実SW offline移動/収納/回答、再起動、再接続、学習と所有保持 PASS。
- Life storageのWorker内putへ明示的な保存障害を注入した別試行: 両幅で学習正本と元の所有を保持し、エラー案内からretry、追加学習の一度だけの反映とoffline再起動 PASS。既存ハーネスの障害注入先も実際のWorkerへ対応した。
- Life two-build interruption: 異なる実artifactへの更新を両幅で検査。学習中の更新待機、旧SW固定、検知後切断、offline旧版再開、再接続、更新後の同じ次問と所有保持 PASS。旧artifactのソースは本調査では未確定、artifact全ファイルと版は開始終了照合した。
- Desktop WebKit / Chromium、iPhone 13 viewport: 島↔家2往復、明示7日時計fixtureからのcacheなし復元、復元中の設定遷移、島の最終表示 PASS。設定遷移はWebKit 65ms / Chromium 28ms、約0.5秒の間にUI timer各11tick。実機応答時間の保証ではない。
- 同2エンジンでLifeWorld chunkを明示abortすると回復案内が現れ、設定へ移動できる。これはSWを意図的に無効にした障害診断。
- ChromiumはSW経由のWorkerのoffline起動も確認。WebKitはoffline reload自体が内部エラーとなったため、その試行はFAILのまま保持し、通常起動の再検査と分離。

詳細ログ・ブラウザー画像・manifestはローカルの `output/playwright/responsive-island-20260926/`。最初のstorage試行はmanifestのhash計算法の不一致でブラウザー前に停止し、同一アプリ入力で正しい計算法に直した別試行がPASS。結果を上書きしていない。

## 残る境界

今回の再生コード変更ではルールhashが変わるため、以前のsnapshotは最初の1回再構築する。Workerにより操作を塞がなくなるが、過去履歴の長さによって島の完成まで時間がかかる場合は残る。利用者本人の保存履歴や実機の30秒停止を直接再現した証拠ではない。

家の汎用3D生成、描画命令・影、毎フレームのコピー、15秒ごとの全件照合・整合性検査、PWA全資産量の最適化は残る。今回ですべての性能課題を解決したとはしない。描画の美術・ゲームルールは変えておらず、実画面で島の表示を確認したが、新しい美術の採用・子どもの無説明理解・実機評価は行っていない。

固定10問の正式80run、旧島固有の全旅程、classic専用PWAハーネスは今回未再実行。対象のLife実回答・保存・更新・offlineを優先した検証であり、全release matrix PASSとはしない。
