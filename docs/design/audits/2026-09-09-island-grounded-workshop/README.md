# 工作住民の接地と展示台の受け面 — 固定40の限定検証

固定40では、工作へ戻った住民が砂の外に浮いて見える状態を改善した。phone / tablet の保存作品 A で、実歩行→手接触→通水・水車・ベル→取消→同じ工作と学習予約への復帰を確認した。全 17 store は各 checkpoint で厳密一致、今回の回答は 0。これは明示 fixture による限定実行であり、新たな取得や仕様37全体の完了を示さない。

[前後比較](./before-after.html) / [実経路コンタクトシート](./contact-sheet.html) / [検証値・SHA](./verification.json)

展示台は同じ高さに重なっていた2枚の不透明な面を分離し、放射状の縞を解消した。[展示面の前後画像](./table-contact-sheet.html)と[別の検証記録](./table-verification.json)に、両幅で3仕事→運搬記憶1件再訪、全17storeを22回照合した結果を保存した。こちらは旧63回答データの明示復元で、工作の66回答fixtureとは別の実行。手の遮蔽とランプから影への意味の伝わり方はHOLDのまま残す。

## 実行対象と保存境界

- 固定 source: `companion-20260909-b80f785972fa`、1091 inputs、SHA `b80f785972fa1e8f41a15021e8fd1c28b0c0067bfdba5a039d98e6e81147d227`。main `19f7de15a8b0e22c912f63a3a5ea6ddcbf5ee49a` + 指定7 source/test files。家の導線と共有仕事カメラの作業中変更は含めていない。
- 実配信: `http://127.0.0.1:5434`、実 version `companion-20260909-b80f785972fa:0eae25e6-b2e3-459e-b04b-259c060d0cb1`。Island / BuildPlay 有効、Park legacy、world v17、住民 `workshop-grounded-residents-v1`。
- lint / type / build / asset budget と 303 files / 3336 tests は PASS。実ブラウザは両幅 PASS、専用 handle 70838 は exit 0、2 contexts と browser の閉鎖、source / QA と配信版の前後不変を確認した。正式速度測定ではない。
- 元の66回答を含む旧7 storeの記録を明示復元し、QA用 profile を作成した。その他の store は空から始め、現在の17 store全部を22 checkpointで比較した。過去の取得を今回の実取得として数えない。
- phone 390×844 / 通常 motion、tablet 768×1024 / reduced motion。各幅で同じカワウソ UUID による A の実運転、別住民選択・学習・工作退出の3取消、同じ caller・予約の入力 ready、reload保持を確認した。通常回答の続行は未実行。

## 見た目と実モデルの根拠

7原PNGをそれぞれ開いて読み取り、無加工・同 bytes で保存した。旧39の復帰画像は比較だけに使い、固定40の証拠へ付け替えていない。静止PNGだけで動作完了を主張せず、実 phase / 手と対象の距離 / 同一 UUID / flow・wheel・bell の記録と対応させた。

砂外の浮遊改善は局所 PASS。接地影は薄く、手元の小ささと無文字で因果が伝わるかは HOLD。Source A 全面の見た目、意欲・理解、安全性の人による検証は未完で、Human N=0。

独立した固定40実モデル診断では、3種 × 通常/reduced × A/B の12 cases、1836姿勢、赤道を含む1,550,808頂点 rayで支持外0、clearance < -1e-6 は0。保存変換と geometry は復元された。これは実モデルの頂点と最終砂三角形の鉛直支持の検査で、三角形内部の貫通や画面の接地影は検査していない。代理 CPU P95 最大0.771msは正式入力速度ではない。

## 原失敗と残る範囲

旧 `workshop-residents-02` は、運転後の同じ住民を再選択すれば watching が waiting へ戻るという QA 前提で timeout した原 FAIL を保持する。同じ選択は watching を保持する実契約なので、今回の QA は本人の停止操作を挟んで再試行した。原 report / fixture / PNG は変更していない。

B 配置・全3種の新しいブラウザ行列、native hidden、secondary touch、実1回答続行、新たな資格取得、全仕様37、Source A 全面、Human N0、全 Goal の完了はこの記録の合格範囲ではない。展示台・共有仕事の固定40 run は別記録であり、この verification には含めない。

原証拠は `output/island-experience/workshop-residents-ground40-01/`、`output/island-experience/workshop-residents-nav39-02/`、`output/island-experience/workshop-ground-40-review/`、`output/island-experience/companion-40-checks/` に保持。QA は `output/playwright/island-renewal/workshop-residents-ground40-01.mjs`。大きい raw はこの文書へ複製していない。
