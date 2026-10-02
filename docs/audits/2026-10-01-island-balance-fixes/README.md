# 島のしずく・育成バランスの修正

2026-10-01、[再監査B1〜B6](../2026-10-01-island-balance-recheck/README.md)の修正案をローカル実装。正本は[仕様52](../../product/52_growing_island_game_spec.md)と[バランス・保存契約](../../product/growing-island-balance.md)。本番への配布・commit/pushは行っていない。

## 実装したこと

| 指摘 | 修正 |
|---|---|
| B1 土地の5回上限 | 6回目以後も東・西・南へ3列/行ずつ追加。120しずくから24ずつ増加。既存5段階と所有座標を保持。広い島のカメラ、海、配置判定も追従 |
| B2 学習量による出来事の抽選 | 参加からの実時間24時間につき、その日の1回だけ判定。留守の日を一括抽選しない。未表示結果を保存し、本人の世界が描画されて表示を始めた後に日IDを確認して消す |
| B3 しずくの使い道 | 反復できる地区拡張を消費先に追加。報酬2しずくを保持。余剰を完全に回収する設計にはしていない |
| B4 まとめ学習の未使用時間 | 進められる仕事がなくなるとbankを保持。次の配置・供給・道の復旧で使用。たねの面で保存時間を案内 |
| B5 孤立した家・遊び | 家の配置予告・新規入居・成長・好み・遊びの到達条件を揃える。既存住人・成長段階・最高げんきは取り上げない |
| B6 同じ入力内の重複完了 | 同じIDは1件だけ加算。別バッチの再送も加算しない |

未表示の出来事は同期で再提示されるため、それだけで他タブへ再通知しない。これにより同期通知の往復を防ぐ。

## 長期の確認

固定seed・明示完了・奇数行に建物/偶数行に畑を置く脚本。利用者の平均値や絶対人口上限ではない。比較対象は新商品を優先しない同じ脚本で、装飾優先は毎回まず花を1個置く。

| 毎日12完了 | 90日: 人 / 土地 / しずく | 180日 | 365日 |
|---|---|---|---|
| 育成優先 | 51 / 120 / 1,644 | 77 / 168 / 3,374 | 116 / 216 / 7,314 |
| 花を先に置く | 50 / 312 / 26 | 76 / 432 / 168 | 115 / 624 / 358 |

修正前の同脚本は育成優先180日67人→365日67人、花優先90日26人→365日26人で停止していた。今回は両方が増え続ける。84日比較は毎日12完了49人、週頭84完了46人。配置する頻度の差は残り、完全等価な進行を保証しない。1日1完了でも30日から90日の間に増える回帰を確認。

育成優先のしずく余剰は依然大きい。成長停止と用途の打ち止めを解消したという評価で、長期経済の調整完了や継続意欲の認定ではない。

## 保存互換

Growingの保存1→2、独立DB schema3。旧 `islands` を新正本 `balancedIslands` へ一度だけ同じupgrade transactionで複製し、元tableも保持する。旧writerは元tableにしか書けず、新正本を上書きできない。写真・贈り物・native学習DB・旧Lifeを保持。新版の本人削除は両tableを削除する。

DexieはVersionErrorの後に版指定なしで接続し直すため、単純なschema増加だけを旧writer拒否とする案は回帰で棄却した。移行失敗の全rollback→再試行、未知版のread/sync/command拒否、写真/贈り物保持、再送、未表示出来事の再起動・日またぎ・表示済み確認を検査。

## 検証

- 標準 `npm run verify:core`: **512ファイル・4,563テスト PASS**、docs/current-entry/lint/typecheck/build/assets PASS。[ログ](core.log.txt)。最終のカメラ・海と保存回帰の追加後は、関連チェックと描画を再確認した。
- 最終関連: **14ファイル・88テスト PASS**。[ログ](targeted.log.txt)。最終lint（既存warning1件）・typecheck PASS。[lint](lint.log.txt)、[型](typecheck.log.txt)。
- `npm run e2e:smoke`: **31/31 PASS**。[ログ](smoke.log.txt)。初回/2回目の旧探索待機失敗は[初回](attempts/smoke-first.log.txt)、[2回目](attempts/smoke-second.log.txt)へ保存。
- Growingを明示した固定production build・asset budget PASS。PWA precache **8.76 MiB / 12 MiB**。[ログ](production-build.log.txt)、[入力・distのhash、flags、version](build-source.json)。共有のdirty作業を外側の固定directoryへ複製し、開始/終了の入力hash・実versionと照合。runtime入力は最終作業コピーとも一致。学習の並行変更を含む作業コピーの検証で、特定commitの検証とは扱わない。
- DEV 390×844 / 768×1024: 実UI3回答→購入/配置→reload→同じ予約へ復帰。別の明示保存fixtureで保存1→2、拡張6/7/8の各方向、追加土地への配置・保存時間の使用・reload・overflowなし。[結果](dev/report.json)、[画面](dev-contact-sheet.jpg)。
- 固定production 390×844 / 768×1024: **fixture書込なし**。初回設定→無料の家→実UI3回答→たね購入→実SW制御のoffline起動→同じ続きの2回答→建築・保存→offline再起動。完了5件・9しずく・所有と予約の保持、Preview DBなし。[結果](production/report.json)、[画面](production-contact-sheet.jpg)。タブレットはreduced motion、両幅は音OFF。

基点は `008e0c8b` の作業コピー。production実revisionは `008e0c8b-balance-working`、nonceを含む実versionはbuild-source/reportに記録。Growing flag=true、実world candidate=`growing-island-v1`。共通root/古いIsland祖先のcandidateは別rendererの値なので、Growingのworldとflagsを併記して識別する。

## ゲートと限界

| ゲート | 確認結果 |
|---|---|
| 視覚 | 既存の家・ぽこもこ・庭の素材を保持。[既存の基準画面](../../design/2026-09-27-pokomoko-restored/dev/390-initial.png)と初期の実画面を比較。新しい地区は全景と配置を確認し、海の四角い端が露出する問題を修正。大きな空き地で住人が小さくなることは残る。新美術・魅力の利用者認定は行わない |
| 無説明理解・安全 | 警告は道をあける案内、時間は消滅しない。既存住人/権利を保持する回帰PASS。子どもの無説明理解・続けたくなる気持ちは未評価（人の参加者0） |
| Runtime | 上記の関連回帰・実UI・実SW offline PASS。実2ビルド更新、実機iOS/Android、624マスの完成した島のGPU/電池負荷は未評価。full release合格には読み替えない |

Growing/Fantasyのflagを付けた全suiteでは、旧Lifeの4テストがdocumentのない環境で時計hookを起動して失敗した。[ログ](attempts/core-with-fantasy-env.log.txt)。標準coreと対象flagの実build/ブラウザを分けて検証した。独立buildの初回2失敗はsource素材のコピー不足で、[元画像](attempts/build-missing-source-art.log.txt)と[カタログ](attempts/build-missing-catalog-art.log.txt)を保存した。

DEV harnessの初期失敗は、揺れ続けるボタンへの安定待機、学習中に存在しないworldのcapture、建築前の銀行残高/段階、たね件数を含む「まなぶ」名の前提だった。[試行1](attempts/dev-v1.json)、[2](attempts/dev-v2.json)、[3](attempts/dev-v3.json)、[4](attempts/dev-v4.json)、[5](attempts/dev-v5.json)。production初回は設定後に直接学習へ入るという旧Lifeの前提で停止した。[記録](attempts/production-v1.json)。現行Growingの初回導線と実タッチを使い、アプリの保存失敗として扱わない。
