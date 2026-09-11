# ぽこもことカワウソの識別修正

本番でカワウソにもぽこもこと同じパッチワーク材質が割り当たり、主役が2体に見えていた。新しい島だけカワウソを茶色・クリーム色に変更。ぽこもこの姿、住人数、行動、学習・保存・報酬の契約は維持する。

- 対象: production preview http://127.0.0.1:5275
- delivery: VITE_ISLAND_ENABLED=true / VITE_ISLAND_LIFE_ENABLED=true
- candidate: island-life-garden-v6 / natural-otter-v1
- 基底revisionと検証した入力hash: [source.json](source.json)。ローカルbuild ID: [version.json](version.json)
- 実画面: [contact-sheet.html](contact-sheet.html)。390×844、768×1024。tabletはreduced motion。
- runtime: [report.json](report.json)。両幅で通常初回3問→6しずく→花購入→再読込→SW offline回答/再読込がPASS。
- core: 339 files / 3,608 tests PASS、docs・lint・typecheck・build・assets PASS。lintの既存Fast Refresh警告1件あり。
- 追加回帰: 新しい島のぽこもこのみ布texture、カワウソの無textureと茶/クリーム、住人数3を確認。旧画面の布カワウソの既存テストもPASS。

## 独立した判定

- 視覚: 実画面の目視で主役とカワウソの色・材質の取り違えを解消。島全体の魅力改善を意味しない。
- 無文字理解/安全: 識別の目視確認のみ。実参加者N=0、子どもが理解したという認定ではない。
- runtime: 上記チェックPASS。今回変更しない経済・保存・PWA更新機構の広範検証は前回main-releaseに帰属し、今回の再検証とは扱わない。

スモークテストもPASS。実行ログ: [core.txt](core.txt)、[smoke.txt](smoke.txt)。
