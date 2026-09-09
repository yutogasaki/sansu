# 島の対象から操作する

2026-09-09、ユーザーが庭・動物・家の直接操作を実装しmainへ公開するよう指示。採用契約は[ナビゲーション仕様43](../product/43_island_navigation_spec.md#島の直接操作2026-09-09採用)。既存の3D候補と学習・保存契約を保ち、操作の入口を対象に近づける。

## 実装と境界

実3Dモデルから投影したDOM目印をホームに最大3つ置く。家は入室、庭は現在と次の姿の比較/育成先選択、住民は実配置済みの物で遊ぶ操作を開く。重なる目印と画面外の目印は表示しない。物自体のray hitも受け付け、カメラのドラッグ/ピンチと区別する。家具は選択後に遊ぶか動かすかを決め、移動/収納は既存編集画面を使う。もちものは常設する。

選んだ住民に限定した経路探索でも、他の住民の身体と占有中の席を障害物として保持する。到達できなければ既存の回復案内を示し、別の住民へすり替えない。成長予告ではreadOnlyにし、発見を記録しない。育成先の変更は既存writerのみ。学習入力・SRS・保存形式を変更しない。

| 引き継ぐもの | 今回変更するもの |
|---|---|
| `mystic-island-shore-garden-v18` の地形・素材・キャラクター・住民の接地 | 操作目印と対象別のDOMパネル |
| 現在/次成長の同画角の比較、実予約への学習復帰 | メニューを経由せず庭を選べる入口 |
| 通常の自主的な住民行動、保存ロック、WebGL復旧 | 明示的に選んだ住民への遊び要求 |

新規アート候補や学習中の演出は作成しない。静かな目印と44px以上の文字付き操作を使い、点滅・音・強制説明は加えない。音off/reduced motionでも同じ操作ができる。

## 開発中の確認

独立worktree `/tmp/sansu-direct-actions`、開始元 `6799249`。独立して実装・検証した後、今回のソース変更のみを共有作業ツリーへ3-wayで反映した。他タスクの未コミット変更とindexは保持。共有DEV対象 `http://127.0.0.1:5240/#/island` でもphone/tabletの直接操作検査を通過した。

DEV対象 `http://127.0.0.1:5340` でphone 390×844 / tablet 768×1024を確認。`tools/e2e-island-direct-actions.mjs` はプロフィールのみを明示fixtureにし、最初の3問を実回答して庭を獲得する。予告前後の保存データ一致、別育成先から庭へ変更した後の予約不変、ラベルのdrag抑止/Enter/Escape、カメラdrag、選んだ住民での遊び、家、もちもの、同予約の回答を検査する。

初版では説明captionがパネルに重なったため、対象パネル中はcaptionを隠した。タブレットで家のモデル部品から目印が二重生成されたため、家の目印を1件へ限定した。初回の遊び検査は、他の住民が占有する花へ行けると仮定して失敗。占有保護を緩めず、ベンチへ実際に移動する検査へ修正した。失敗記録はローカル `output/playwright/island-direct-actions/` と `island-direct-actions-v2/`、通過版は `island-direct-actions-final-dev/`。

## 判定の分離

- 視覚：既存島の素材/色/地形を維持する局所的な操作改善。島アート全体の品質合格には読み替えない。
- 理解/安全：作者によるtouch/keyboardと音off/reduced motionの確認。独立した子どもの理解・意欲は未検証（Human N=0）。
- Runtime：直接操作の固定production候補を検査する。全成長E2E未完了は別の残件として保持し、全release合格とはしない。

開始元6799249上の開発検査：docs・lint（既存Fast Refresh警告1件）・型・全unit/integration（400.14秒）・島有効build/assets:check・smokeがPASS。直接操作DEV検査はphone/tabletでPASS。全成長ハーネス `e2e:island` は前回の階層整理より前の手順でメニューを開いたままホームの比較ボタンを押そうとして失敗した。これは全成長E2Eの未完了として残し、今回の直接操作検査で代替合格とはしない。


## 統合検査

最新mainの室内歩行・入力即時判定・分数入力を取り込んだ候補で型、関連72テスト、build/assetsを確認。Classic別buildのPWA更新検査4項目、Island PWAの保護フロー8項目と実Service Worker経由のoffline reload/回答/復帰がPASS。PWAハーネスは既存の「ほかの あそび」入口を開くdetails操作を追従した。

固定10問ハーネスは、既存の即時判定に合わせて最終数字keydownから計測し、明示確定時だけEnterを送る。複数の未入力セルを空欄と判定する。10正解の実保存・各回答receiptとの対応・予約継続のassertは維持。初回失敗の「□□を残入力と誤認」「自動確定でもEnterを10回要求」はハーネス原因として区別した。共有node_modulesのVite cache競合によるReact例外は、独立worktreeのcacheを分離して解消した。


3Dタップ後はブラウザがfocusをbodyへ戻すため、パネル内だけのEscapeハンドラでは閉じられなかった。パネル表示中だけdocument captureでEscapeを扱い、解除時にlistenerを削除する。ラベルだけでなく実3D住民の投影位置をtapして、直後にEscapeで閉じる回帰を追加。共有DEVではphone/tabletでPASSした。

最終公開候補 `f984d55-direct-escape` は、`f984d55` のsrcにこのEscape修正を加えた固定snapshotからbuildした。型・lint（既存警告1件）・関連24テスト・build/assets:checkがPASS。画像と実runtime metadataは[固定候補の記録](audits/2026-09-09-island-direct-actions/README.md)に保存する。文書を含める最終commit SHAと、実際に焼き込んだbuild revisionを混同しない。

固定10問はphone/tablet各10反復、合計80 runsでPASS（evidence.eligible=true、全gate true、開始/終了source一致）。[集計と境界](audits/2026-09-09-island-direct-actions/throughput-summary.json)。最終のEscape処理だけが測定後差分で、学習ソースは同一。別候補のUI/build確認も並行したためGPU占有環境の性能保証とは扱わない。最終productionの直接操作は両viewportでPASS。

公開直前にmain `70ad92c` のDEV専用home journey統合を取り込み、型・build/assetsと両viewportの直接操作を再検査してPASS。最終の画像/manifestは統合後build `68b8d935862fe7530191f7ea1f1c376c5877e405` のものに更新。productionではhome journey flagは無効。固定10問の測定元とこの統合差分は記録上分離する。

push競合でmain `adf71f1` の分数入力/訂正変更も取り込んだ（コード競合なし）。画像・固定10問は撮影/計測元を維持し、この後続入力変更を再E2E済みとはしない。最終統合の型・関連unit・buildを別途確認する。

Final integration: typecheck, related unit tests, production build and assets:check PASS.
