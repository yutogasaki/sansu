# 7作品の遊びと成長のベンチマーク抽出

- Date: 2026-09-08
- Status: Completed
- Review By: 2026-09-09

## Docs To Touch

- `docs/wiki/game-experience-benchmark.md`
- `docs/wiki/index.md`
- Shared task queue and completion history

## Goal

ぽこ あ ポケモン、ヨッシーとフカシギの図鑑、Minecraft、SimCity、Forest、どうぶつの森、ポケモンから、機能・気持ちよさ・デザイン・成長・運などを広く抽出する。

## Scope

公式資料による仕組みの確認と、Sansuに向けた候補の整理。調査資料は `docs/wiki/` に保存する。製品仕様の採用決定・実装・公開は含めない。作品名の解釈はユーザーへ確認中で、ヨッシーとForestは仮定を明記する。

## SSOT

- `CONSTITUTION.md`
- `docs/product/01_app_spec.md`
- `docs/product/30_living_island_growth_spec.md`

## Plan

公式資料の調査、事実と解釈の分離、候補の分類と優先提案、文書確認。

## Verification

`npm run docs:check`、出典と作品版の照合、候補IDの重複・件数確認。

## Progress

- 2026-09-08: [調査資料](../../wiki/game-experience-benchmark.md)を作成。公式出典付き104項目、18観点の索引、気持ちよさ12分類、デザイン10観点、成長8軸、運と未知の区別、Sansu優先12候補を整理。
- 担当外レビューでYO05の直接出典とPK08の適用場面を修正。事実と解釈・提案、作品版、既存仕様と追加候補を分離した。作品名の解釈への返信は受領していないため仮定を資料に保持。
- 文書構造・件数・ID重複・全104行の出典：PASS。今回のactive taskの必須欄不足は補完。
- `npm run docs:check`：全体はPARTIAL。最終確認時のFAILは並行作業の `docs/tasks/active/2026-09-08-learning-feedback.md` のReview By / Docs To Touch / Verification不足のみ。既存の期限切れWARNも保持。別担当文書を変更せず記録した。
- 調査資料のみで製品の挙動・学習判定・保存の契約変更はないため、親子仕様・学習テスト・アプリbuildの追加変更は不要。
