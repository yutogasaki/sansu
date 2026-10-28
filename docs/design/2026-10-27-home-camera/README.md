# 室内を見回して触る

2026-10-27。利用者の「室内をいろいろみて、触ったりしたい」に対応するローカル変更。愛着と無料のくふうを強める。家具や部屋の造形、所有・学習・保存形式は変更しない。

## 変更

- 室内overviewでドラッグ移動、2本指の移動・拡縮・回転、ホイール拡縮。
- 右上「ながめ」に48px以上の移動4方向・回転・拡縮・初期画角への復帰をまとめる。閉じる、Escape、外側の操作で退出できる。狭い室内では操作面が内部スクロールする。
- 手動の眺めは住人の動きに追従せず、室内にカメラを保つ。模様替え・記念詳細・撮影の自動画角を維持し、家退出で手動状態を破棄する。
- 本・壁紙・来客・床の既存タップは描画中のカメラを使う。ドラッグ・複数指・取消の指離しはタップにしない。
- UIは手動状態と拡大率が変わるときだけ更新し、移動・回転のたびにReactを描き直さない。

正本は[画面仕様43](../../product/43_island_navigation_spec.md#室内を見回して触る2026-10-27)、レイアウトは[44](../../product/44_display_layout_spec.md#家の室内と模様替え2026-10-20)、親仕様01へ参照を追加した。恒久の保存判断は変わらないためADR・memoryへの重複は不要。

## 検証の境界

共有作業ツリーには他作業の変更が存在する。検査はその時点の作業ツリーを対象とし、未コミット全体のリリース合格とはしない。今回の入力は[inputs.json](inputs.json)で識別する。

- 対象unit：`npx vitest run src/components/island/three/homeCameraControls.test.ts src/components/island/three/homeInteriorCamera.test.ts` は初期候補27件PASS。境界を追加した最終controllerの単体5件もPASS。実室内の全周・viewport角の遮蔽、gesture取消、zoom/位置制限、同じsurfaceへのraycastを検査。
- 実画面CLI：`SANSU_HOME_CAMERA_URL=... SANSU_HOME_CAMERA_OUTPUT=新規パス node tools/e2e-home-camera.mjs`。隔離プロフィールを使い、ドラッグ、ボタン、実アルバム/床のhit、戻る、保存不変を検査。ChromiumではCDPの実touch入力でpinch/twist/cancel、WebKitではtap/mouse/wheelを確認する。iOS実機の複数指の検査ではない。
- 開発版の初期旅程は390/768幅で実アルバムhitと保存不変までPASS。320幅でパネル下端の切れ、WebKitでtouch後のEscapeが届かない問題を発見し、修正した。初回失敗と途中候補は `output/playwright/home-camera-dev-*` / `home-camera-small` / `home-camera-webkit` に保持する。後続候補の合格へ読み替えない。
- 最初の旅程の描画反映前の値取得とアルバム内の複数renderer locatorは検査側の問題として修正した。
- 全体 `verify:core` はdocs/current entryを通過後、別作業の `src/domain/island/navigation.ts:66` のlint 2件で停止。今回のファイルのlintを別実行する。
- 全体testはlearning/goal/receiptの無変更領域で5秒timeoutが多数発生。classic smokeも既存Light Bridgeのフィードバック時のreturn状態/15秒timeoutで失敗。並行の重い検証も走っている環境で、失敗が出た両runを中断した。原因を室内変更と断定せず、全体PASSとも扱わない。ログは `/tmp/sansu-home-camera-tests-final.log` と `/tmp/sansu-home-camera-smoke.log`。

実機・子どもの操作理解/再訪・全PWA更新・公開は未検証。見回せることで触れる対象を自分で見つけやすくなる、という面白さの仮説は実児童では未検証。

## 最終候補の検証

結果は **PARTIAL**。対象実装の型、lint、単体5件とIsland有効のVite build、asset予算、docsがPASS。buildは共有のdistを上書きしない `--outDir output/home-camera-production` に出力し、型チェックは別に実行した。production buildには既存のprecache glob未一致警告がある。`npm run build` 全体の合格へ読み替えない。

コマンドと実結果は[verification.json](verification.json)、対象入力hashは[inputs.json](inputs.json)、実行ログは `logs/`。全体core/test/classic smokeの失敗を保持した。agent index/portalの今回の再実行、固定productionでの全旅程と公開版の受入は未完。共有ツリー全体の配布判定は別途必要。

初回の最終320px旅程では移動・回転・拡縮・Escape・実床の歩行・実アルバムの遷移まで到達し、アルバムのスクリーンショットが30秒timeout。初回失敗は `output/playwright/home-camera-final/report.json`。操作失敗へ読み替えず、撮影待ちを60秒にした別runで全旅程を再検査し、Chromium / WebKitとも320px幅でPASSした。

レビューでは、学習・所有・写真の保存への書込みを追加していないこと、手動視点を家退出時に破棄し模様替え等では既存fitを使うこと、指離しのtap判定と描画カメラのraycastを維持することを確認した。新しい家具遊びや全家具の反応追加はこの変更には含まない。

最終実画面は[ブラウザ結果](browser-report.json)。両engineでドラッグ・ボタン・48px・パネル内収容・Escapeとfocus・実床歩行・実アルバムhit・reset/退出再入場・保存不変・pageerrorなし、開始終了の対象入力hash一致を確認。Chromiumは実CDP pinch/twist/cancel、WebKitはtap/mouse/wheel。最終390/768の再実行と実iOSの複数指は未確認。小画面の操作面は[Chromium](chromium-320-controls.png) / [WebKit](webkit-320-controls.png)。開発版の対象機能合格であり、固定production・全体回帰の合格ではない。
