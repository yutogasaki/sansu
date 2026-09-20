# Shared Blocked Queue

## Purpose

外部確認待ち・明示HOLDの一覧。タスク全体と一部ゲートの保留を区別する。確認待ち以外の実装は [共有キュー](TASKS.md) で継続できる。

## Current Blocked Items

- 家の写真保存 / Safari確認：Playwrightの非永続WebKitではBlobのIndexedDB保存が失敗し、新規の永続WebKit profileでは同じblobの保存が成功。実Safari通常profile/iOS PWAの確認が必要。WebKit 188438でも同じエラー報告あり -> docs/tasks/archive/2026-09-20-house-webkit-photo-save.md

- Nature Town S1 / SAFE-06・参加者評価：独立回答0人。観察セットは準備済み。独立観察の実回答を記録して再判定する。最終美術と実iOS作業まで停止した意味ではない -> docs/tasks/active/2026-09-16-nature-town-s1.md
- Cold-open Value Loop：既存候補は美術/再プレイ等がHOLD。現行の島・町と分けて保持し、採用候補と未達ゲートを再確認してから再開する。学習・保存の既存実装を廃止しない -> docs/tasks/active/2026-07-21-cold-open-value-loop.md
- Whole-app brand coherence：詳細の状態はAwaiting external validation。同一版の全経路で美術・無説明理解/安全・実装整合の外部確認が必要 -> docs/tasks/active/2026-07-23-whole-app-brand-coherence.md
