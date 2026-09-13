# ベンチの影だけが挨拶するM3

DEV `http://127.0.0.1:5223` / `VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_PREVIEW=true`、world `canopy-dots-c3-v1`、機能候補 `shadow-greeting-v1`。実build labelとGit親checkpoint `cc91671a0a4b496c5d63bcc7a9b495046b47d523` は区別する。

実際にベンチを利用中の住民の形を、独立した地面の影へ投影する。触れると約4秒だけ影の腕が挨拶し、本人は休んだまま。本人の顔・輪郭・布・配色・頭身・姿勢・席予約を変更しない。影の描画が終わると元のcast設定を復元する。新しいキャラ設定・性格・好みは追加しない。

同じ影を観察画面で拡大し、見えている影への実タップと「かげに ふれる」の入口を用意する。挨拶する結果は事前に明かさない。連打で延長せず、住民の滞在終了や配置変更・非表示・画面終了で中断する。reduced motionでは影の挨拶姿勢を静止表示する。元の影が小さい場合の理解しやすさは利用者検証を要する。

本人・影・挨拶する腕の影の可視性を確かめ、1秒の実提示後にだけ無料のcurrent-context-testとして記録する。snapshotに表示版と触れた住民/ベンチIDをhash付きで保存。過去の再演を現在の配置で上書きせず、版のない旧snapshotにも追加しない。新しい通常関係のsnapshotでも同じ表示版の普通の影を保持する。

## 検証履歴

固定source `68b0d5ed05bc880f896d03154d15758c8753554168ffafdcb8052312159e58fd` でcore1は394 files /3894 tests、docs/lint/typecheck/build/assets PASS。precache98件/10.85MiB。既存の期限・Fast Refresh・Browserslist・chunk警告あり。続くUI4はphone390×844/通常motion、tablet768×1024/reduced motionの2旅程がPASS。開始/終了sourceはcoreと一致した。

両幅で3住民の実際の影へのタップ、本人の位置/席保持、明示入力前の未発見、連打の統合、4秒終了、保存と元の住民の再演、既存の30秒観察visitが終わった時の4秒未満の中断を確認。ベンチ収納の保存完了を待って再読込し、元のイベント・しずく20/ひかり0・学習正本を保持して学習入力へ戻った。console/page errorなし。期限検査に既存observe-relation actionを使ったため世界は保存版14。M3自体は行動版を追加しない。20件のQA creditから実購入/配置を行い、住民を再抽選したり時計を加速したりしていない。

診断1のスマホは保存・再演・終了・収納まで完走。診断2は終了直前の監査値の待機不足で、中断前後のvisit値を読めず失敗した。余裕のある残り時間で開始し、activeの監査値と実際の滞在期限を照合するよう修正。診断3はその中断を通過したが、追加ベンチを最前列に置こうとして必要な手前1マスがなく、正しく拒否された。検査用の配置を修正した。診断3中に腕の可視性と通常関係の再演を補強しているため、最終sourceの証拠にはしない。

純粋検査は3住民の元のgeometry/material/transform/seat不変、影だけの変化と通常形への復帰、cast設定復元を確認。domain検査は実際の着座・同一住民・終了/収納・表示版・明示入力とsnapshot保持を確認する。QA creditの初期化は実学習取得や自然初回の証拠にしない。

## 独立した判定

- 視覚: C3 HOLD。影の形の変化は確認できるが、世界全体の静止した光・空間の奥行き・包まれる構図は未達。小さな腕の形から挨拶を読み取れるかも別途改善対象。
- 無文字理解/安全: Human N=0。本人・残高・学習正本の不変を技術的に確かめても、子どもの理解・愛着を検証したことにはしない。
- Runtime: 対象のcoreと両幅DEV旅程はPASS、全受入はPARTIAL。今回の接続先は観察画面。島全景からの直接入力、最大数/混合配置の性能、自然初回、全体smoke/PWA/production島旅程/固定十問throughputと全releaseは残件。非表示/context loss解除のコードは接続しているが、この旅程で実ブラウザー背景遷移やPWA更新を検証したとは扱わない。

[実画面とC3の比較](contact-sheet.png)、[構造化結果](report.json)、[実配信ラベル](delivery-probe.json)。16枚の実画面と比較表を保持する。実buildは `development-local`、原本 `/tmp/sansu-shadow-runtime-4/report.json` のhashは構造化結果に記載。ログは `/tmp/sansu-shadow-core1.log` と `/tmp/sansu-shadow-ui4.log`。tabletの瞬間画像では通行中の住民が影を一部隠すため、瞬間画像だけを1秒可視の証拠にしない。保存判定は実描画後の腕の影を含む継続した可視性を使う。
