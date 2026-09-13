# 運搬の発見記録と再演

2026-09-13。DEV `http://127.0.0.1:5223` / `VITE_ISLAND_LIFE_PREVIEW=true`、world `canopy-dots-c3-v1`、表示 `carry-care-v1`、機能候補 `facility-relations-v1`。既存保存版11の実運搬をR5/R6の記録へ接続する。100件のQA creditと実購入・配置し直しによる明示開始を使う。自然初回発見、学習での実取得、実参加者、本番配信の証拠ではない。

新しいsnapshotは運搬版と表示版を保持する。出発元・実経路・同じ住民・到着後の実利用を照合し、住民の頭、本/道具、対象、出発施設が表示されている場合だけ候補とする。既存の1秒の実提示判定で保存し、条件だけ・道中だけ・無料観察をliveへ変換しない。記録から静止再演、本人保存、現在の島への入口をつなぐ。

施設の観察では既に利用している住民を表示し、空いている住民だけが無料で訪問できる。受け取り→道中→利用でobservationTestを維持し、終了しても利用ひかりを与えない。現物の対象を指定して別の関係へ切り替える全操作、全関係の優先順、同じ住民で近い/遠い/復元を比べる全受入は未完。

施設observe actionを実際に書く島だけ保存版12へ上げ、旧版への降格再生を拒否する。既存の利用を眺める通常旅程は版11のまま。無料呼び出しと旧版拒否/以後の版保持は純粋検査で確認し、実ブラウザーでは通常旅程の後に所有者APIへ観察を送る別の明示診断を行う。UIから空いた住民を新しく呼んだという証拠にはしない。

- **視覚:** HOLD。C3の光・奥行き・包まれる空間と、本/道具の通常画角での判別は不足。手入れ時だけ花への接近量を小さくし、道具と植物を見やすくした。キャラ造形・布や他の住民の通常姿勢は変えていない。版のない旧場面の距離/姿勢も維持する。
- **無文字理解/安全:** Human N=0。rayが頭の基準点や持ち物の一部に届く検査は、目/鼻・手元の判別、十分な視認面積、子どもの理解や愛着を保証しない。学習正本・報酬契約の保持は技術の確認として分ける。
- **runtime:** 対象の記録/再演の区切り。R5/R6全体、M1/M3/M4、出会い、所有/配置上限の実機検証、全PWA/offline/update/throughput/全smokeは未完。

診断1は編集中のsourceを含むため最終証拠にしない。R5の再演と現在入口を確認したが、R6の道具/植物が体や他の住民に隠れる状態を観測した。純粋な同一配置の検査で旧接近量は不可視、新しい手入れ距離は可視になることを確認して表示版を追加。初回coreも編集途中のmoduleとテストを含むため破棄し、固定版で再実行する。診断2は受け取り場面の撮影待ちでtimeoutし、到着後の読書は表示されていた。全体検査との同時実行だったが、それだけを原因と断定せず、アプリ時刻・動作を変えずブラウザーを単独再実行する。

最終source `cee1cea9c4c41806b3ff6b0db94e036cd61d1ecffe9f40a41ffd81f6de6163bc`、撮影元は `2b42a1502e14ef18b2c57b1b0386f4efcdf0c5dd` 上の差分。[report](report.json) の開始/終了hashは一致。[critical-path contact sheet](contact-sheet.png) / [C3比較HTML](contact-sheet.html) に受け取り・運搬・実記録・再演・現在・収納を並べた。別の新規QA contextで照合した[実DOM delivery](delivery-probe.json)のbuild revisionは `development-local`。Git親revisionを実ビルドの埋め込み値と混同せず、差分の同一性はsource hashで確認する。

phone390×844・tablet768×1024（reduced motion）×図書室/小屋の4旅程PASS。実運搬、live R5/R6、再演の実提示、本人保存、現在入口で既存利用の観察、対象収納後の過去event不変、通常保存版11を確認。各旅程の後の明示owner API観察では版12へ更新・再読込し、元の発見event・残高124/162・ひかり0・学習正本を保持した。最後に学習入力へ復帰し、pageerror/console error 0。版12の書込診断と、UIから新しい無料住民を呼ぶ操作は区別する。

最終 `verify:core` PASS（387 files /3857 tests、docs/lint/typecheck/build/assets）。既存の期限/Fast Refresh/chunk警告あり。precache98件/10.83MiB。ログ `/tmp/sansu-facility-relations-core3.log`、最終UI `/tmp/sansu-facility-relations-ui4.log`、原本 `/tmp/sansu-facility-relations-runtime-4`。core2/UI3も当時の版では通ったが、版12境界追加前のため最終sourceの証拠にしない。視覚HOLD・Human N=0・全release未完は継続する。
