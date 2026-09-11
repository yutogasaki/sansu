# 住人の好きな場所の返事 v2

住人が自分の好きな家具へ到着した短い時間だけ、好みに合う一言を島の下部へ表示する。ぽこもこは「ひとやすみ」、うさぎは「におい すき」、カワウソは「ゆらゆら」。既存の `♪` と同じ時計で消え、学習、しずく、ひかり、発見、所有、活動履歴の保存は変えない。

## 実装

- `residentFavoriteReply` は現在の住人の好みから返事を決める。好みの表示と同じ導出元を使うため、住人と家具の対応がずれない。
- `residentReaction` は好きな家具への到着中だけこの返事を返し、到着前・期限後・好きでない家具では従来の活動文へ戻る。
- 返事は短くして、phoneの3住人チップでも原因（好きな家具）と同時に読み取れる長さへ寄せた。音off・reduced motionでも文字が残る。
- production harness は実学習3問→花の配置→気づき通知→うさぎの返事→成長表示→reload→service worker配下のoffline回答を、phone/tabletで確認する。

## 検証

`source.json` の `17fff50f07066794a290de09c7abe62f8b39bb48` を元に、`resident-reply-v2` と `VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_ENABLED=true` の production preview（`http://127.0.0.1:5228`）を作成した。両幅の production harness は PASS。`production-report.json` に、3住人の好み、うさぎの返事、学習後のしずく、花の成長表示、保存保持、offline再起動を残している。

- **視覚的魅力**: 既存の `mystic-island-shore-garden-v18` / `pokko-field-v1` の画角・島・住人を保持した。`contact-sheet.png` は返事中と持ち物への遷移を同じ実画面で比較できるようにした。最終アート承認と再訪意欲は未評価（Human N=0）。
- **無説明理解・安全**: 好み欄と一言を隣接させ、返事は短い肯定表現だけにした。報酬回収、罰、能力評価、学習中断は追加していない。音なし/reduced motionでもDOMの文字と `♪` で状態が分かる。子どもの無説明理解は未観察（N=0）。
- **runtime**: 3住人の反応を確認するfocused domain tests、`npm run verify:core`、フラグ付きbuild/assets、production harnessのphone/tabletがPASS。実機iOS、実参加者、長期の学習効果はこの証跡の対象外。

## 監査マニフェスト

```text
Visual candidate ID: mystic-island-shore-garden-v18
Delivery / feature-flag ID: mystic-island-v1 / VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_ENABLED=true
Actual app target: http://127.0.0.1:5228
Build revision: resident-reply-v2
Source revision: 17fff50f07066794a290de09c7abe62f8b39bb48
Rendered candidate attributes: data-life-candidate="island-life-garden-v6"; resident candidate="patchwork-otter-v1"
Viewports: phone 390x844; tablet 768x1024 (reduced motion)
Human N: 0
Evidence type: runtime screenshots, production interaction trace, automated regression
Visual magnetism: inherited local island candidate; not rescored in this behavior-only slice
Silent comprehension/safety: automated DOM/copy path PASS; child observation 0/5
Runtime integrity: PASS for production harness and full core matrix
Verdict: GO for the favorite-reply behavior slice; visual and silent human gates remain open
```
