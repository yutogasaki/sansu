# 住人のすきなもの表示 v1

住人チップに、ぽこもこはベンチ、うさぎはおはな、カワウソはブランコが好きだと表示した。好みは個性を読む手がかりとして見せ、行き先の指定や報酬回収を増やさない。住人の自動行動、学習、しずく、時間成長、保存形式は変えていない。

## 実装

- `residentFavoriteLabel` が住人IDから短い表示名を返す。
- 各チップは `data-life-favorite` と「すき: …」を持ち、現在の活動は同じチップの省略表示とタイトルで確認できる。
- 名前・好み・活動を一行に収め、390×844でも島のワールドと下部ナビを縮めない。
- `tools/e2e-island-life-production.mjs` が3住人の好み、学習後の導線、購入、再読込、サービスワーカー下のオフライン回答を検査する。

## 検証

`source.json` の `7e9afef` を `SANSU_BUILD_REVISION` に固定した production preview（`VITE_ISLAND_ENABLED=true VITE_ISLAND_LIFE_ENABLED=true`）を使用した。`report.json` は phone/tablet ともPASSで、3問の実回答で6しずくを得て、好みの表示、花購入、再読込、オフライン回答と再起動まで確認した。

公開URL `https://sansu-seven.vercel.app`（配信revision `7e9afefdb5b5a9517c59aa5775c6e1ad887988e0`）でも同じハーネスを実行し、住人3人の好みと学習から配置・再読込・オフライン復帰まで phone/tablet ともPASSだった。結果は `live-report.json` と `live-*.png` に残している。

画像は実画面の初期島、空の制作メニュー、学習後通知である。

- [phone-initial.png](phone-initial.png) / [tablet-initial.png](tablet-initial.png): 一行の住人チップに好みを表示し、島全景と下部ナビを維持。
- [phone-build-empty.png](phone-build-empty.png) / [tablet-build-empty.png](tablet-build-empty.png): 好み表示と制作メニューの共存。
- [phone-earned.png](phone-earned.png) / [tablet-earned.png](tablet-earned.png): 学習後のしずく通知との共存。

**視覚**: 実画面で好みの色分け、文字の省略、島の全景、下部ナビを確認した。最終アート承認と実参加者の再訪意欲は未評価（N=0）。

**無説明理解・安全**: 好みは受動的な表示だけで、住人を手動操作したり報酬を回収したりしない。自動行動と学習導線を維持した。子どもの無説明理解は未観察（N=0）。

**runtime**: `core.txt` は docs:check PASS、lint 0 errors / 既存 warning 1、typecheck、339 files / 3609 tests、production build、assets:check PASS。`smoke.txt` は全ケースPASS。`smoke-first.txt` に初回の別領域Root Tangle縦タブレットの一過性タイムアウトを残し、同じコード・環境の再実行で全ケースPASSを確認した。`report.json` の本番相当ハーネスも両幅PASS。

この証跡は表示と操作整合の確認であり、長期の経済バランス、実参加者の学習効果、実機の描画品質を認定するものではない。
