# 住人の気づき通知 v1

花や遊具を置いた直後、住人の暮らしシミュレーションで新しい気づきが生まれた時だけ、短い観察通知を表示する。通知は `うさぎが おはなを みつけたよ !` のように、住人の `! / ?` のしぐさと同じ反応を伝える。島の全景と下部の「まなぶ」タブは維持し、通知を押した時だけ持ち物を開ける。

## 実装

- `observationTransitions` は、前回保存した住人ごとの `itemId:mood:at` と現在の `discovery` を比較し、新しく置かれたアイテムだけを通知へ変換する。
- 初回表示、再読込、同じ気づきの再演は `sessionStorage`（プロフィール単位）で抑止する。保存するのは通知抑止に必要な小さなスナップショットだけ。
- 収納中のアイテム、未配置の発見、未知のカタログ種別は通知しない。通知は7秒で消え、タブ切替でも消える。
- 学習量、しずく、ひかり、いぶき、住人の好み、活動履歴、所有物の保存形式は変更していない。

## 検証

`source.json` の `1b6ecaa` を元に `observation-cue-v1` をビルドし、`VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_ENABLED=true` の production preview（`http://127.0.0.1:5226`）で本番ハーネスを実行した。390×844 / 768×1024（tablet は reduced motion）とも、実回答3問→花購入→配置→住人の気づき通知→持ち物の成長表示→reload→実サービスワーカー制御下の offline 回答と再起動が PASS だった。結果は `production-report.json`、変更画面は `phone-observation.png` / `tablet-observation.png`、遷移先は `phone-growth-inventory.png` / `tablet-growth-inventory.png` に残している。

- **視覚**: `contact-sheet.png` は実際の production preview の phone/tablet 画面を並べ、通知カード、住人の `!`、島全景、持ち物への遷移、下部ナビが同時に読めることを示す。候補は `mystic-island-shore-garden-v18`、系譜は `pokko-field-v1`。最終アート承認と再訪意欲は未評価（N=0）。
- **無説明理解・安全**: 通知は配置した対象、住人、短い動詞、`! / ?` を同じカードに置き、任意の持ち物導線として扱う。罰、回収、連続日数、正誤による減衰、強制操作は追加していない。子どもの無説明理解は未観察（N=0）。
- **runtime**: `observationCue.test.ts` を含む focused tests 26 tests、typecheck、lint、フラグ付き build/assets:check、production harness phone/tablet が PASS。`npm run verify:core` の結果は `core.txt` に記録する。実機iOS、実参加者、長期の経済調整はこの証跡の対象外。

## 監査マニフェスト

```text
Visual candidate ID: mystic-island-shore-garden-v18
Delivery / feature-flag ID: mystic-island-v1 / VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_ENABLED=true
Actual app target: http://127.0.0.1:5226
Build revision: observation-cue-v1
Rendered candidate attributes: data-visual-candidate-id="mystic-island-shore-garden-v18"; data-life-candidate="island-life-garden-v6"
Viewports: phone 390×844; tablet 768×1024 (reduced motion)
Human N: 0
Evidence type: runtime screenshot, production interaction trace, automated regression
Visual magnetism: not rescored in this behavior-only slice; prior approved lineage retained
Silent test: not run (0/5)
Danger interpretations: 0 observed; independent observer sample is 0
Generatedness / continuity screen: PASS for the captured phone/tablet frames
Runtime integrity: PASS for the production harness; full core matrix in core.txt
Verdict: GO for this cue slice; visual and silent gates remain open for a future human review
```
