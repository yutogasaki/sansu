# Nature Town 全身受渡し候補

候補 `nature-town-acting-s2`。対象は `/#/nature-town`、配信flagは `VITE_ISLAND_ENABLED` と `VITE_NATURE_TOWN_ENABLED`。旧Islandや学習入力は変更しない。公開候補の承認とは別の実装途中候補。

## 制作前の固定条件

| TRANSFER | DO NOT TRANSFER |
|---|---|
| 採用済みmoon-v8の接地する足、柔らかな立体、布と毛の素材差 | 顔だけの切り抜き、宙に浮く荷物バッジ |
| 既存Pokomokoの正確な形・配色、既存ウサギと自然色カワウソ | 別種モデルへの置換、顔や体型の描き直し |
| 同じカメラ・照明・縮尺で腕と体の向きを変える | 状態ごとの自動トリミング、体の伸縮 |
| 保存成功した実受渡しと在庫数 | 架空の食べ物、再読込時の受渡し再演、共同食への瞬間移動 |

物語：畑で受け取る → 両手で持つ → 食たくで手を差し出す → 荷物が食たくの在庫になる。

既存3D形状から事前にPNGを焼き出す。実行時WebGL不要。静止ポーズで受取・運搬・手放しを分け、reduced motionも同じ情報を保つ。荷物数はDOMで実在庫から描く。受渡しはそのtickか直後のtickかつ当該場所にいるときだけ、所持状態と矛盾しないポーズを使う。

基準画像：`../2026-09-12-island-moon-v8/reference.png`。比較前の実画面：`../2026-09-19-nature-town-silent-review/390-04-full.png`。

## ゲート

- 魅力：HOLD。全身表示は町全体の最終美術の代わりではない。
- 無文字理解・安全：独立回答0/5、SAFE-06 NOT_RUN。旧候補の観察セットを新候補の根拠に流用しない。
- 実装整合：検証後に追記。

## 実装・検証の境界

- 実装：16枚の既存形状の焼き出し、全身4ポーズ、イベントの位置・鮮度・所持状態の照合、実荷物の手元表示、立体の家・木・ベンチ・花。通常の44px操作領域を維持。
- 原子保存・シミュレーション・学習入力・報酬の変更なし。最新の所持数が優先され、イベントなしで過去の受渡しを再演しない。
- 初回実画面で木の上部が後続の地面セルに隠れる問題を修正。初回offline試験で新PNGがprecache対象外と判明し、町専用 `town-*.png` だけを追加した。失敗結果は `sprites-before-cache-fix.json` に保持。
- `npm run lint`: エラー0、既存IslandMilestoneのFast Refresh警告1件。`typecheck` / build PASS。全体テスト434ファイル・4,072件PASS。追加回帰は実シミュレーションに沿った1件。
- `npm run e2e:smoke`: 31シナリオPASS。一般の起動・学習・探索・保護ルートを確認。
- `npm run benchmark:fixed-ten`: **未合格**。1反復目のStudy誤答後、次問の入力可能待機が15秒timeout。原因は未確定、アプリの回帰とも既存不具合とも断定しない。途中の3laneを正式な10反復の結果として扱わず、以前の `latest.json` を今回の結果として引用しない。`fixed-ten-failed.txt` に実ログを保持。
- 今回のPNG追加後のprecacheは123ファイル、11.40 MiB / 12.00 MiB。実機iOS・独立参加者の評価は未実施。公開の承認や47/47の完了ではない。

## 画像としての判定

候補 `nature-town-acting-s2`、390×844 / 768×1024、2026-09-19の実画面。基準moon-v8と比較した実装者の評価（確信度：中）：世界への入りたさ6、キャラクターへの愛着7、素材感6、構図と奥行き5、色の焦点6、出来事と結果5。35/60、**HOLD**。人物と建物の素材はそろったが、広い格子地面、矢印への依存、小さい演技は次の改善対象。8点未満の軸を技術検証で補わない。

独立した無説明評価は0/5。[新候補の観察ページ](observer.html)で回答を集める。旧候補とはIDを分け、回答JSONにも候補IDを保存する。

## 最新runtime証跡

- 対象 `http://127.0.0.1:5343/#/nature-town`、revision `nt-acting-s2-0921d7a`（親コミット0921d7a＋今回の変更）、候補 `nature-town-acting-s2`。完全なUUID・flag・変更ファイルhashは [source-manifest.json](source-manifest.json)。一時的なローカルpreviewであり、本番公開ではない。
- [実操作report](report.json)：390×844 / 768×1024、cold browser context、音OFF・reduced motion。UIによる家と畑の配置、実受取→運搬→納品、保存後reload、不通→取り消し、入居まで。プロフィール以外のworld注入なし。診断用timer pulseを用いるため、実時間のテンポやfpsの証明ではない。
- [通常motion・タッチ・offline](sprites-report.json)：両幅で実住人をタップし選択、実SW制御下で通信を切りreload、住人・配置物の全画像が復元。runtime canvasは0。
- [重要経路の一覧](critical-path.jpg)：実起動→配置→受取→運搬→納品→入居。同一buildの最新スクリーンショットだけを並べた。
- [実two-build更新](two-build-report.json)：両幅PASS。画像cache追加前buildから追加後buildへ更新し、途中の学習では更新を保留、再開・配置・在庫・権利・offline継続を確認。レポート内の「same source commit」は元ハーネスの定型文で、この実行ではPNG名・precache設定が異なる。同じなのはシミュレーション／保存／学習ロジック。最後の台車CSS位置調整より前の比較なので、その2行は更新試験の対象外。
- `npm run e2e:pwa-update` は旧開始ボタン「たんけんを はじめる」の待機で30秒timeout。島有効buildへのこの汎用ハーネス実行をPASS扱いにしない。町の実two-build・offlineの結果とは区別する。ログは `pwa-hook-failed.txt`。

技術ゲートは町の変更範囲でPASS、全体releaseはPARTIAL（fixed-tenと汎用PWAハーネスが未合格）。視覚HOLD・独立観察未確認は別々に維持する。

後続調査で2件の原因を切り分けた。Studyの問題飛ばしと検証手順を修正し、classic PWA4件を確認。[後続の修正・計測記録](../2026-09-19-feedback-boundary/README.md)。本ページの失敗ログは当時の履歴として保持する。
