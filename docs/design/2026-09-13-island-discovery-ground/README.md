# 未成熟の花のまとまりと発見記録の下地

[仕様50](../../product/50_mysterious_island_discovery_spec.md)のG0を実景へ接続。3株以上を寄せると低い土がつながり、離すと草地へ戻る。成熟花壇の石縁と名前は使わない。個体の土台との二重表示と、土の接続部分の面の重なりを除いた。

## 対象

- URL: `http://127.0.0.1:5223`、既存DEV serverを現行sourceと照合して使用。
- 開始HEAD: `7a159d677ffa27db2ff031b8472cb8495c049fcb` ＋未commit変更。
- Flags: `VITE_ISLAND_ENABLED=true; VITE_ISLAND_LIFE_PREVIEW=true; DEV`。
- 描画候補: `island-life-discovery-a-ground-v1`。
- sourceの開始/終了SHA-256: `ce53b5e2464eff652a93f27d45fcf6fef9cae0dbb0cc47423c25ef880ae39b57`。パスと内容の計算法は `tools/e2e-island-discovery-ground.mjs`。
- Chromium 390×844、768×1024（後者はreduced motion）、音off、新規context。DEVの明示的な3株所有fixtureからの検査で、実学習による取得・production・SW offline・実機の証拠ではない。

## 実画面

[配置比較から再読込・学習復帰のcontact sheet](contact-sheet.html)。[phone結合](phone-joined.png)、[分割](phone-split.png)、[復元](phone-restored.png)、[tablet結合](tablet-joined.png)。旧月の島の[参考画像](../2026-09-12-island-moon-v8/reference.png)、直前の[実画面](../2026-09-13-island-world-first/phone-home.png)と比較し、家・住人・材質・画角を維持した。

## 検証

- 全体 `verify:core`: PASS、354 files / 3688 tests、docs/lint/typecheck/build/assets。これは接続面の最終幅調整前の入力。
- 最終の変更はG0接続面の幅 `.12` → `.06`。その後lint/typecheck、landscapeとdiscoveryJournalの16テスト、build/assetsを通過。
- 最終実画面: 両幅でPASS。[report](report.json)。実メニューとマス選択で分割/復元、残高0・3所有個体・購入額2保持、学習7storeの不変、再読込、通常学習へ復帰。pageerrorなし。
- Journalの11テスト: 可視1秒、非表示除外、snapshot複製、SHA-256、直近20件、本人12件、最初の記録保護、再演/模擬の出典、重複送信、保存abort/retry、owner削除/分離、競合。表示の有無を人間の理解へ変換しない。
- ログ: `/tmp/sansu-v3-journal-ground-core.log`、`/tmp/sansu-v3-ground-final-build.log`、`/tmp/sansu-v3-ground-runtime-3.log`。初回と二回目の画面は診断履歴として `/tmp/sansu-v3-ground-runtime-1` / `-2` に保持。

## 非補償ゲートと未完

- 視覚: G0の地面差分を作者が実画面で確認。全体美術の新規承認/採点ではない。
- 無説明理解/安全: Human N=0。子どもの理解・意欲・学習効果は未評価。
- Runtime: 上記DEVと単体範囲でPASS。全体releaseは未判定。今回フルsmokeは再実行しておらず、前の30/31と対象再試行5/5を引き継いだ合格とも扱わない。

記録writerと表示時間collectorはまだ画面から呼ばない。G0成立だけで発見を保存しない。R1/R3の視線、無料の現在観察、M2、記録UI、checkpoint移行、Bの商品と魔法/出会い、PWA/throughput等の全体受入は継続中。
