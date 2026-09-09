# 家の現在地と操作復帰

2026-09-09。ユーザーの「エッジケースを踏まえてもっと、家も」という指示に基づく局所改善。採用仕様は[学習の記念42](../../../product/42_island_learning_keepsakes_spec.md)と[ナビ43](../../../product/43_island_navigation_spec.md)。[実画面一覧](review.html)と[コンタクトシート](contact-sheet.png)で確認できる。

## 変更

- 家の棚・掲示板を `house=keepsakes` / `house=notices` で表す。ブラウザの戻る/進む、再読み込み、学習からの復帰で家内の現在地を保持する。未知の値は全体を表示し、直接詳細URLの戻り先も全体にする。
- 「いえを みわたす」は全体へ戻り、開いた入口へフォーカスを返す。棚の下方から賞を選ぶと、選んだ詳細と操作を画面内へ移しフォーカスを渡す。
- 未取得の賞は「まなぶ」を主操作にする。空の棚に0件の集計や無効な一括展示を並べず、一品だけなら個別の展示を使う。
- 保存結果不明の操作と再確認を家の全sectionに表示する。再確認待ちを保存実行中と表示せず、別の品への展示と3D側の賞選択を止める。既存の保存receipt/資格/採点・予約を再利用する。
- 高さ600px以下では室内の固定表示を解除し、見出しの戻る操作を残す。844×390で部屋と下部ナビの間にメニューが閉じ込められる不具合を修正した。320pxでは棚と主操作を一列にする。

## 実行対象

固定ローカルproduction `http://127.0.0.1:5388`。revision `70ad92c-house-edges-v2`、version `70ad92c-house-edges-v2:aee47378-e840-4723-a7a6-29742e457062`。`VITE_ISLAND_ENABLED=true`、delivery `mystic-island-v1`、visual `mystic-island-shore-garden-v18`、learning `mystic-island-learning-v2`、art direction `moon-garden`。[artifact hash一覧](artifact.json)が検査した配布物を識別する。共有の変更中checkoutから作った固定buildで、独立commitや公開済み版とは扱わない。

## 検証

[4サイズの結果と画面metadata](verification.json)。390×844 / 320×568 / 768×1024 / 844×390、音off / reduced motion、通常のservice workerを許可したChromiumで全ケース通過。

- 新規nativeプロフィールを作り、家内の閲覧・履歴・再読込前後で7store不変を確認。
- 通常plannerの実初回3問を回答し、最初の賞状を展示。家内の学習開始元へ戻り、無料展示を保存した。実際の初回回答であり、色などの初期課題も含む。
- 「いえを みわたす」、アルバム・写真棚・カメラからの帰還、直接詳細URL、未知sectionを確認。戻った入口と選んだ賞のフォーカス、スクロール後の44px以上の操作領域と実hit targetを確認。
- 累計1000区間は明示したaggregate fixture。16品の長い棚の末尾選択を検査し、1000区間を実際に学習した証拠とは扱わない。
- `IDBObjectStore.put` を一度だけ失敗させる診断で、7store不変、新たな展示の無効化、家全体/掲示板からの再確認、一回だけの保存とreceiptを確認。保存後の実service workerによるオフライン再読込でも展示を保持。
- 390pxでroot fontを32pxにした文字拡大診断を実施。操作の遮蔽と横溢れなし。OSやブラウザの全アクセシビリティズームの代用にはしない。

| 確認 | 結果 |
|---|---|
| 単体/保存/Hookの対象回帰 | 56件通過 |
| 全unit | 318ファイル・3,428件通過 |
| lint / typecheck | errorなし。既存IslandMilestoneのFast Refresh warning 1件 |
| production build / assets | 通過。専用outDirを使用、precache 94件 / 10.54 MiB |
| 既存smoke | classic DEVの31項目通過 |
| 既存ナビ | v1固定productionの390/768で下書き保持・履歴・配置・実写真等が通過。v2の差分は短い家画面のCSSで、家の4サイズはv2で再確認 |
| 新しい家のDEV | [限定診断](dev-preview.json)。5213の `home-journey-connected-house-v7`、390/844で棚/掲示板・戻る・再読込・全体復帰を確認。上記の固定productionとは別対象 |

完全なログはローカルの `output/playwright/house-edges/` と同prefixのlog。4サイズの正式記録は `portrait-v3` / `landscape-v3`。コンタクトシートの01〜05は `contact-v4` の同じ新規プロフィールで実初回3問まで通した画面。文字拡大と全品は別診断fixture。写真の新規保存自体は今回の家QAでは行わず、カメラからの帰還を検査した。

最初のrun-v1はQAが実カタログと違う名前を待ったため停止した。選択IDと実フォーカスに直したrun-v2は縦3サイズを通過したが、844×390で実操作が下部ナビに遮蔽された。最初の失敗traceは保持し、短い画面の室内固定を解除したv2アプリをv3で検証した。

## 独立した判定

- 視覚：実画面で空状態・長い棚・短い横画面の情報階層を確認。世界の造形は変更しておらず、既存のart HOLDを解除しない。新しい数値採点は行わない。
- 無説明理解・安全：音off/reduced motion、戻る操作、保存失敗の回復は技術的に確認。独立した子どもの観察はN=0。
- Runtime：上記の家・ナビ・保存保持の局所範囲は通過。全島の成熟、全教科throughput、実機PWA二版更新、公開用の全体ゲートは今回再実行していない。世界の新旧統合と公開をこの結果で認定しない。

本番公開は行っていない。共有checkoutの他の変更は保持し、学習・保存schema・新ホーム配信flagは変更していない。
