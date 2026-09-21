# Shared Task Queue

## Purpose

CodexとClaude Codeの共有実行キュー。詳細は `docs/tasks/active/`、全体の推奨順と実装済み項目は [バックログ](../../docs/tasks/backlog.md)、外部確認待ちは [保留キュー](BLOCKED.md) を参照。

## Rules

- 実行中のタスクを一行ずつ記す。履歴や将来候補を混ぜない。
- 同じ残件は既存の詳細へ集約し、横断目的ごとに重複起票しない。
- 閉じた区切りは `docs/done/YYYY-MM.md` に記録する。
- 実装済み・検証済み・公開済みを区別する。

## Current Queue

- Nature Town S1：受入46/47。次は町全体の空間構成・受渡し、実iOS。SAFE-06の独立回答待ちは保留キューを参照 -> docs/tasks/active/2026-09-16-nature-town-s1.md
- Mysterious island v3：島ホーム入口は局所改善済み。次は世界美術（巨大植物・局所陰・地形接続）と現行版の残件照合。C3/Human評価は未完 -> docs/tasks/active/2026-09-13-mysterious-island-v3.md
- Home journey connection preview：接続試作は検査済み、本制作・最終美術・公開範囲は未完。現行の家UI変更と対象系統を照合 -> docs/tasks/active/2026-09-09-home-journey-preview.md
- Full island experience from benchmark：採用項目の横断索引。Goal方式の追加分析は停止済み、既存の通常実装と残件を保持 -> docs/tasks/active/2026-09-08-island-experience.md
- Learning rhythm and island game experience：学習と暮らしの横断目的。個別実装はv3/家/S1と重複させず参照する -> docs/tasks/active/2026-09-07-experience-improvements.md
- Whole-app UX/UI coherence：旧画面との取り違え原因（flag-offの旧dev既定値、runtime identity未照合）と再発防止を記録。通常devはIsland (`/#/island`)、core guardで起動先を検査。旧Exploreは任意副モード、Nature Town (`5233`)は別preview。短横画面のscroll案内と共有補助文字のコントラスト改善を追加済み、参加者・読み上げ評価と未網羅routeは継続 -> docs/tasks/active/2026-09-20-whole-app-ux-coherence.md
