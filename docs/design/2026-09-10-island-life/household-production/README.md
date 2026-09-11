# 暮らす島の家庭内本番利用

ユーザー承認により所有物の移行を省き、学習記録を保持して新しい島を空から始める。[実画面](review.html) / [仕様48](../../../product/48_island_life_spec.md)。

## 実装

- `VITE_ISLAND_LIFE_ENABLED=true` で本番でも表示し、VercelのbuildCommandに追加。
- 本番用 `SansuIslandLifeV1` とDEV用 `SansuIslandLifePreviewV1` を分離。旧所有物の換算も削除も行わず、登録以降の実回答だけを反映。
- 本番は時間送りを表示せず、保存層も拒否。
- 自動保存と、その後ろで待機する購入をPWA更新保護に含める。成功・失敗・取消で保護を解放。
- プロフィールを削除すると、その子の新しい島も削除。別の子の島は保持。バックアップへの所有物追加は今回行わず、別端末では新しい島から開始する。

## 版と対象

最終production targetは `http://127.0.0.1:5263`、新flag=true、DEV=false、visual candidateは `island-life-garden-v5`。[固定入力](source.json)のhashは `239c6d6b714b819b9e342ffc32dd166a9c5d0a237893fb1e050c2c019eb092bd`。基準HEADは70ad92cで、共有作業ツリーを固定したもの。ビルドの自己申告revisionは `development-local`、固有versionは[配信manifest](version.json)に記録。commit/push/deploy済みの証拠ではない。

## 確認結果

- [core](core.txt): 329 files / 3,484 tests、lint（既存warning1件）、typecheck、build、asset budget PASS。
- [smoke](smoke.txt): classicの31件PASS。
- [本番の2幅](report.json): 実初回設定→実回答3問で6しずく→花購入→reload→実SW制御下でoffline回答→offline reload。所有1個と学習保存を保持。時間送りなし、preview DBなし。タブレットはreduced motion。時刻送りや報酬fixtureで購入していない。
- [classic PWA](classic-pwa.txt): 4件PASS。[実2ビルド更新](two-build.json): 保護フォーム、1回reload、保存保持、旧SW復旧とoffline保持PASS。島固有の旧予約/更新8件と実SWのofflineも[旧島flag構成](legacy-pwa.txt)でPASS（中間v1、最終との差は新島hook内だけで、このflag構成では未使用）。
- [旧島回帰](legacy-island.json): 新flag=falseの同じ最終入力でPASS（成長49/47区間、初回導線、描画障害からの学習復帰、8入力構成）。[速度測定](throughput.json): 新flag=trueのDEVで80run、eligible=true/pass=true、追加操作0、正答・誤答・区間境界の全閾値PASS。DEV測定をproduction速度や実参加者の証拠にはしない。
- PWA保存保護はhook12件の中で通常保存・待機・失敗を検査。プロフィール削除のnative保存は既存mock、独立島DBはfake IndexedDBで所有者隔離を検査。実ブラウザーのプロフィール削除や実機iOSの証拠とは分ける。

## 最初の失敗と修正

- 時間送りのJSXを囲む編集で余分な閉じ括弧を入れ、lintで検出して修正。[初回ログ](diagnostics/initial-lint.txt)。
- プロフィール削除の既存テストはDB全体をmockしており、新しい独立DB用のIndexedDBがなかった。fake IndexedDBを追加し、削除対象だけ消えることを追加確認。[初回ログ](diagnostics/missing-test-indexeddb.txt)。
- 速度ハーネスは旧ホームのcanvasを待っていたため、新ホームでtimeout。新ホームの描画完了を待つようQAだけを修正。[初回ログ](diagnostics/old-home-harness.txt)。
- [中間production検査](diagnostics/interim-production.json)は最終版ではない。レビュー後、PWA holdを処理内部から待機を含む外側へ移し、最終版で2幅を再検査した。

## 判定の境界

runtimeは家庭内利用の最小範囲を検査する。視覚は前回v5の33/60 HOLDを引き継ぎ、今回美術を変更・承認していない。文字なし理解・継続意欲は子どもN=0、長期の経済バランスも未検証。ユーザーの家庭内利用承認と、一般公開の品質判定を分ける。学習記録のwriter・問題・SRSは今回変更していない。
