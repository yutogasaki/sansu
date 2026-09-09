# 島のタブ・集中画面・戻り先の実装確認

仕様は [島のタブと戻り先](../../../product/43_island_navigation_spec.md)。初回の実装検証と、後続のmain反映前の統合検証を区別して記録する。

## 実装

- 通常画面は「しま / まなぶ / きろく」。中央は学習を開く操作で、島の訪問だけでは問題を始めない。
- 現在のURLに `learn=1` を加えて学習を重ね、設定詳細等の元画面を保持する。非表示の元画面は操作不可にする。
- 学習・配置・撮影・写真拡大の間はタブを隠す。「とじる」は開始元、「もどる」は一段上へ戻る。
- 回答下書きは同じ起動中の同一プロフィールで保持。保存済み問題・回答・SRSの契約は変更しない。
- 記録・設定は学習から復帰したときに保存済み情報を読み直す。旧予約の報酬画面も同じ学習セッション内に留め、更新による途中再読込を防ぐ。

## 固定した実画面

- Target: `http://127.0.0.1:5290`、ローカルproduction preview。
- Runtime revision: `nav-20260909-final-fix`（ローカル検証識別子、Git commitではない）。
- Runtime version: `nav-20260909-final-fix:3a06f22d-a504-4764-8441-f3195a650aad`。
- App source hash: `42daefac62f9ee0059869d667c8f3b92e8cf368967329f1b42598e885e8944f5`。
- Delivery: `VITE_ISLAND_ENABLED=true` / `mystic-island-v1`。
- Shell: `island-navigation-v1`。既存の島は `mystic-island-shore-garden-v16`、学習は `mystic-island-learning-v2`。造形の変更は別作業の入力として保持した。
- 390×844 / 768×1024。設定のJSアニメーション終了後に撮影し、途中の高さ0のフレームを最終画像へ混ぜない。
- 実画面・レポート・contact sheetはローカルの `output/playwright/island-navigation-final/`。全景、設定詳細、学習、記録、写真拡大、写真一覧を両幅で保存する。

## 検証結果

| 検査 | 結果 |
|---|---|
| verify:core | 固定候補でPASS、297ファイル / 3,284 tests。最後の配置復帰・旧報酬画面修正は下記の実UI回帰とlint/typecheck/buildでも再検証 |
| ナビ・通常学習入口・PWA routeのfocused tests | 68 PASS |
| lint / typecheck / production build / assets | PASS。既存IslandMilestoneのFast Refresh警告1件 |
| 既存classic smoke | PASS |
| classic PWA update | 4経路PASS |
| ナビ独自E2E | DEV / productionのphone・tabletでPASS。閉じる前後の7storeと回答下書き、配置取消/保存、実写真、記録更新も確認 |
| Island E2E（成長全巡回を除く） | 表示復旧、初回設定、keyboard/touch、分数、筆算、算数選択、英語、reduced motion、初見の10シナリオPASS |
| Island PWA | 8保護経路PASS。旧予約・報酬移行と、フックなし実SWのoffline開始/回答/再読込を含む |
| fixed-ten throughput | PASS / eligible=true。両幅各10反復、80 runs。正答P95 210.1 / 209.2ms、誤答再入力P95 209.1 / 211.1ms、区間遷移P95 206.3 / 205.6ms。追加操作0、全遷移の入力クリア、保存receipt整合、source不変を確認。自動入力の測定で、子どもの学習速度・効果の測定ではない |

設定のレベル詳細（`/settings/curriculum`）を160pxスクロールして学習を開閉し、両幅で同じ位置へ戻る追加回帰もPASS。記録は1回答後に表示件数が0から1へ更新されることを確認した。最初のスクロール検査は、スクロール不要なコンパクトな記録画面を対象にして失敗したため、実際に長い設定詳細を使って検査し直した。

## トップからの自動学習開始の見直し

追加指示により、`/` の旧探索自動開始・active run優先を撤去した。Islandは島ホーム、BuildPlayのみ有効なら作品画面、両方無効なら探検基地を開く。トップと未知のURLはLayoutを起動する前に解決し、残留した `learn=1` 等による予約を防ぐ。各入口のPrivateRouteが未登録プロフィールを初回設定へ送る。明示的な学習URLでの再読込・再開は維持する。

- 固定候補: `nav-top-20260909-stable`、source hash `c56607ebedadae80ac3589d8a17574e6bf28b27d571ef9f597ba9157f0072084`、`http://127.0.0.1:5291`。
- Version: `nav-top-20260909-stable:870c4d44-8a30-40a8-bb3a-a1fe3ed0b92e`。Island有効、v16造形、navigation-v1、learning-v2。
- 別作業の地形変更が書込み途中だったため、確認済みv16に今回の起動変更を統合して固定。途中コピーのtypecheckは未作成の`connectedTerrain`参照で停止した。作業ツリー自体もその後のtypecheckはPASS。新しい地形の美術承認をこのナビ検証で代替しない。
- `verify:core` PASS、298ファイル / **3,288 tests**。focused 4ファイル / 72 tests PASS。classic smoke **31シナリオPASS**。
- Island・Park・classicの実ブラウザで、実探索のactive checkpointを作ってからトップ/未知URL/残留query/初回設定再訪/再読込へ戻る回帰がPASS。明示的な探索再開は同じrunへ戻る。IslandはproductionでもPASS。
- productionナビE2Eは390×844・768×1024でPASS。未完了学習ありの裸のトップ・hashトップ、残留query、初回設定済み再訪でも予約/回答/SRSを変更せず島を表示する。既存の下書き・詳細・スクロール・配置・実撮影の復帰も再確認。
- classic PWA 4経路、Island PWA 8経路と実SW offline、classicの異なる2実buildで更新・保護フォーム・保存維持・1回reloadを検査する2シナリオがPASS。
- トップ修正後の実画面一覧とレポートはローカル `output/playwright/island-navigation-top/`。学習区間の実装は前回固定候補と同じため、80 runsのthroughputは前回結果を保持し、今回版で再測定したとは扱わない。

旧モードのsmoke/PWA/benchmark補助も「ホーム到着→明示的に探索開始」へ合わせた。Park PWAと従来Explore throughput、visual-audit全体は補助の構文確認までで、今回の追加実行には含めない。

## main反映前の統合確認

ユーザーの「コミットメインプッシュ」指示を受け、島v17が入ったmain `569d1c0d67478676ef898cbae9bc16e8f9d4b351` に今回のナビ39ファイルを重ねて再確認した。

- `verify:core`: PASS、301ファイル / **3,311 tests**。docs / lint / typecheck / build / assetsもPASS。
- 配信と同じIsland・BuildPlay有効、Park Three構成で別production buildを作成。`http://127.0.0.1:5292`、revision `nav-v17-main-candidate`、version `nav-v17-main-candidate:7eef7bea-60de-4786-af39-0f978a0ca3a5`、Island `mystic-island-shore-garden-v17`。
- app source hash: `d2b44e9f066784d5547d792a9d6a377981e5d1962f1b94341e836e465c5714ba`。src / public / package / Vite入力を記録し、commit対象との一致を確認する。
- productionナビE2E: 390×844・768×1024ともPASS。トップ・残留query・保存済み学習・詳細/下書き/スクロール・配置取消/保存・実写真・学習後の記録更新を含む。
- Island production PWA: 8保護経路と実SW offline開始/回答/reloadがPASS。
- 実画面・app source manifest・レポートはローカル `output/playwright/island-navigation-main/`。既存の成長全巡回の未解決箇所と、別作業の美術・速度評価はこのコミット確認と区別する。

## 別に残る範囲

全成長巡回の `e2e:island` は、既存の学習集中CSSが隠している島内の成長通知を「表示される」と期待する箇所で停止した。成長通知の置き場の変更はこのタブ実装に混ぜていない。元の失敗ログを保持し、上表の限定シナリオ合格を全巡回合格とは扱わない。

初回の全体testで出たsky visibility 3件と旧造形hash 1件は別担当が修正し、その統合候補で3,284 testsが通った。失敗した旧固定版の結果は破棄していない。

見た目はタブの並び・選択状態・余白・各集中画面の入力領域を実画面で確認した。戻り方は自動テストと手動で確認し、子どもの無説明操作や好みは未観察。実端末のインストール、iOSの再起動、実二版更新、一般公開の承認を意味しない。
