# ベンチの現在観察・記録・再演

[仕様50](../../product/50_mysterious_island_discovery_spec.md)のR1/R3を観察面・可視記録・本人保存・再演へ接続。いまの実経路と住人を使い、離した物との関係は作らない。思い出は当時の配置/論理時刻を固定し、短い装飾の揺れだけを再現する。

## 対象

- `http://127.0.0.1:5223`、`VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV`。
- HEAD `7a159d677ffa27db2ff031b8472cb8495c049fcb` ＋未commit変更。Candidate `island-life-discovery-a-relation-observation-v1`。
- 開始/終了source hash `8b3ad346d256772de320baed00e8d48a9ff4f6d7e42489a22d4c3741d489cce5` が一致。[report](report.json)はsrc/public/package/viteのpath/NUL/content/NULを照合。
- fresh Chromium、phone390×844/tablet768×1024（reduced motion）、音off。明示的2個体/6credit/record版2 fixtureで、実学習による取得・production・SW offlineの証拠ではない。

## 実画面と検証

[参考画像とcritical path](contact-sheet.html)。家・島・住人・素材を引き継いで対象へ寄ったカメラにし、未経験の関係名は選択肢へ出さない。置いてある物は直接触るか、種類と個体だけの選択欄から指定できる。

- 最終実UI4ケースPASS。初回の即時学習退出で未記録、再度観察して1秒可視→任意保存、対象を遠くへ移設→同対象を選択しても未記録、当時の近い配置を再演→元eventID/source replay、復元→同じ住人の視線、学習復帰。学習store/所持数/残高の不変を照合。
- phone花では16秒待って定期refreshをまたぎ、同じ利用の保存済み表示とJournal revisionが増えないことを確認。
- record版2からの読取とJournal書込みも実UIで検査。`observe`初回の版上げは購入receipt/旧action/残高を保持する。旧版writerは既存の版guardで拒否する設計。v3価格/成長等のcheckpoint移行とは別。
- verify:core PASS: 358 files / 3704 tests、docs/lint/typecheck/build/assets。最終のDOM遮蔽点確認の追加後、実UI4ケースを再検査し、最終docs:check/lint/typecheck/build/assetsもPASS（lintは既存IslandMilestoneのFast Refresh warning 1件、error 0）。
- 対象testsは空き住人/実経路/他の活動を取消さないこと、試験訪問終了時の通貨/利用実績不変、版1→2、3住人の顔向き/座面、当時の利用時計を進めずに揺らすことを含む。
- 初回再演は記録されずFAIL。診断3で`core=true / preparation=empty / delivered=false`を確認。StrictModeの子effectが親の再準備に先行していたため、最初の描画を次のRAFへ移動。可視1秒の基準を変更せず、診断4・全ケース5・最終6が通過。失敗履歴 `/tmp/sansu-v3-relation-observation-runtime-1`〜`-3` を保持。
- ログ `/tmp/sansu-v3-relation-observation-core.log`、`/tmp/sansu-v3-relation-observation-runtime-6.log`。

## 非補償ゲートと残り

- 視覚: 作者のphone/tablet実画面確認。全体美術の新規承認ではない。
- 無説明理解/安全: Human N=0。子どもの理解・意欲・学習効果は未評価。
- Runtime: 上記単体/DEV範囲でPASS。production/PWA/offline/throughputを含むrelease全体は未判定。

現在の観察面でR1/R3を記録する。通常の島全体表示での自動可視記録、集まりの記録、配置undo、24h成長/有限ひかり/土地checkpoint、B追加8品と他ルールは継続中。
