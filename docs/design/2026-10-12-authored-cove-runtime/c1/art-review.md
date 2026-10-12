# c1実画面 — 低い殻と矩形の共有床

**HOLD。** 二軒の家と低い入口は読みやすくなったが、追加床が四角い展示台として目立つ。殻を再び大きくせず、必要な通行幅と支持面を守りながら海側の輪郭を既存岸へ接する浅い弧として作り直す。

| 識別 | 記録 |
|---|---|
| 日付／証拠 | 2026-10-12／実browser screenshot、作者評価 |
| 対象 | 固定コピーのDEV本体renderer、`http://127.0.0.1:5354/prototypes/place-qa/authored.html?water=wide&reference=preflight32&cove=corner` |
| build／candidate | `authored-cove-c1`／`native05-authored-cove-corner-v3` |
| 配布 | Island=true、native診断=true、明示cove=true。通常production falseとは別 |
| 画面 | 1280×900の全景・p9近景。390／768幅・回転は未実行 |
| 保存／cache | 保存済み合成32所有物／8軒の明示fixture。fresh DEV context、SW登録／制御なし |
| 信頼範囲 | この2構図での輪郭・素材・読みやすさ。全配置や実機への一般化はしない |

[採用した完成像](../../2026-10-10-island-final-3d/whole-island-render.png)と[全景](shape/desktop-mature-whole-day.png)、[近景](shape/desktop-cove-close-day.png)を比較した。[比較画面](contact-sheet.html)と[実行記録](shape/report.json)に同じ版を記録する。

作者の全島評価は **37/60**：入りたさ7、人物への親しみ7、素材7、構図と奥行き5、色の焦点6、出来事への期待5。合格条件の各8に届かない。これは改善点を特定する主観評価で、参加者の測定ではない。別agentの批評も作者側の検討であり独立した無文字観察には数えない。

- 改善：殻が二軒を覆う大屋根から、人が入る小さな内庭の尺度へ戻った。青紫の肌と肋骨、左右の屋根が分かれ、入口から実あそびばが見える。
- 未達：淡灰色の長方形床が海へ突出し、自然な岸と切れている。入口の曲線より角と直線が先に読める。
- 全島の残件：中央の裸の丘、薄い森の層、直線的な道、単独の成熟花と小物の分布、大樹の内床／galleryが採用像の密度・空間に届かない。

美術HOLDと独立理解／安全N=0は、13件のgeometry/lifeテストやこの2画面のmetadata一致では解消しない。runtimeは限定粗形PASS、全core・編集・回帰は未達。初回coreのdocs失敗は[原ログ](core-first-failure/execution.log.txt)に残す。
