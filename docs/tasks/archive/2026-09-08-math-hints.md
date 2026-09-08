# Math hint clarity

## Goal

「算数のヒント意味わからない」という指摘に対し、島のヒントを現在の問題で何をするか分かる文へ直す。

- Review By: 2026-09-15

## Docs To Touch

- `docs/product/01_app_spec.md`
- `docs/product/28_mystic_island_spec.md`
- `docs/done/2026-09.md`

## Scope

Islandの学習支援の文言・表示用の選択だけ。予約問題、採点、支援保存、SRS、入力形式は既存契約を使う。

## SSOT

- `docs/product/01_app_spec.md`
- `docs/product/28_mystic_island_spec.md` の段階的な学習支援
- `docs/product/02_math_skills.md`
- `docs/product/04_math_problems.md`

## Plan

1. 補数/数える問題の取り違えと、根拠のない分解指示を直す。
2. 図・基本四則/分数・現在の筆算段に対応する具体的な一手を示す。
3. 答えの非表示、予約不変、phone/tabletで支援から回答を続けられることを検査する。

## Verification

- Shared UI component: docs:check / lint / typecheck / test:run / build。
- 固定productionの既存支援ハーネスと、補数/通常数え/具体計算のphone/tablet画面確認。
- 作者による内容/表示確認とし、子どもの理解や定着の実測とはしない。

## Progress

- 調査: compose_5/10でも絵の数え上げを案内していた。8+7の分解理由がなく、未対応の問題は汎用的な励ましのみ。筆算は進行段にかかわらず演算別の定型文だった。
- 完了: 図の問い、分解の目的、基本四則/分数、現在の筆算段に沿うヒントへ変更。10マスのphone画面で操作面が出ない短さに調整した。
- 検証: 全体2,442件、最終文言67件、lint/typecheck/build/assets/docsと実UI21ケースPASS。詳細と未評価範囲は`docs/design/audits/2026-09-08-math-hints/README.md`。公開なし。
