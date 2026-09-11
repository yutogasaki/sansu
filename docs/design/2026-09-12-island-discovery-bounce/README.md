# 発見した瞬間の小さな反応 v1

花を置いて新しいものを見つけたとき、住人の `!` は最初の650msだけ一度小さく跳ねる。`?` は静かな疑問表示のままで、通常の活動や資源・学習記録・所有物・経路には影響しない。`prefers-reduced-motion`では `!` も静止姿勢にして、読みやすさを保つ。

## 実画面

[production-report.json](production-report.json) は、空の本番島から実回答でしずくを得て花を置き、発見の `!`、住人の返事と種族別の姿勢を確認した後、成長表示・reload・実SW制御下のoffline回答・再起動をphone/tabletで通した記録である。[contact-sheet.html](contact-sheet.html) は同じproduction buildのクリティカルパス14枚と、前候補のtablet画面を並べる。今回の変更点は `phone-observation.png` の動く場面と `tablet-observation.png` の静止場面で比較できる。

## 実装と検証

- 発見時計の範囲だけで `!` の hop をサンプルし、`?` と期限後は hop 0 にする。
- reduced motionでは時間に依存する跳ねを無効にする。
- focused tests、`npm run verify:core`、フラグ付きproduction build/assets、本番ハーネスのphone/tabletがPASS。詳細は [core.txt](core.txt) と [source.json](source.json)。

## 判定

- **視覚的魅力**: 発見の瞬間に小さな因果が加わり、前候補の画角・配色・島の見え方・下部の「まなぶ」導線は維持した。最終アート承認と再訪意欲は未評価（Human N=0）。
- **無説明理解・安全**: `!` は発見、`?` は疑問という既存の意味を変えず、reduced motionでも状態が残る。能力評価、罰、回収、学習中断は追加していない。子どもの無説明理解は未観察（N=0）。
- **runtime**: 3,625テスト、build/assets、実学習→配置→発見→返事→reload→offline再起動をPASS。実機iOS、実参加者、長期の経済調整は対象外。
