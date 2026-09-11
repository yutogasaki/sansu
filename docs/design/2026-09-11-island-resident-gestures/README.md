# 好きな場所での住人のしぐさ v1

住人が好きな家具へ到着した短い返事の時計を、種族ごとの頭のしぐさにも共有した。カワウソは二度の小さなうなずき、うさぎは首かしげから戻る姿勢を使う。ぽこもこは従来の体の反応を保つ。`prefers-reduced-motion`では時間に依存しない小さな静止姿勢にして、反応の終端・移動・着座で頭をrestへ戻す。報酬、学習記録、所有物、経路、接地、待機時間は変えない。

## 実画面

[production-report.json](production-report.json) は、空の本番島から実回答でしずくを得て花を置き、うさぎの返事と首かしげを確認した後、成長表示・reload・実SW制御下のoffline回答・再起動を両幅で通した記録である。[contact-sheet.html](contact-sheet.html) は、phone/tabletの初期・学習報酬・気づき・返事・持ち物・offlineを同じ実buildで並べる。返事中の最新画面は [phone](phone-resident-reply.png) / [tablet](tablet-resident-reply.png)。既存の `mystic-island-shore-garden-v18` の前候補との比較を行い、画角・島サイズ・住人の読みやすさ・下部の「まなぶ」導線が連続していることを作者が確認した。

## 実装と検証

- `favoriteReactionElapsed` が返事と姿勢の共通時計を持つ。好きでない家具、発見の `!` / `?`、期限後は頭を動かさない。
- 既存の `sampleResidentInterest` の種別samplerをlife rendererへ接続し、headの一時差分だけを適用する。`data-life-poses` には監査用の `headPitch` / `headRoll` を追加した。
- focused tests、`npm run verify:core`、フラグ付きproduction build/assets、本番ハーネスのphone/tabletがPASS。詳細は [core.txt](core.txt) と [source.json](source.json)。

## 判定

- **視覚的魅力**: 既存候補と同じ画角・配色・住人造形を保ち、返事と姿勢の因果を実画面で確認できる。最終アート承認と再訪意欲は未評価（Human N=0）。
- **無説明理解・安全**: `♪` と短い返事、reduced motionの静止姿勢で音なしでも状態を残す。能力評価、罰、回収、学習中断は追加していない。子どもの無説明理解は未観察（N=0）。
- **runtime**: 3,625テスト、build/assets、実学習→配置→返事→reload→offline再起動をPASS。実機iOS、実参加者、長期の経済調整は対象外。
