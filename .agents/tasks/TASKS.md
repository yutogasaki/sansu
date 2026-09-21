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
- Whole-app UX/UI coherence：旧Exploreとの取り違え原因を整理し、通常devをIsland (`/#/island`)へ固定。core guardで起動設定・runtime identity・現行入口仕様を検査。旧Exploreは任意副モード、Nature Town (`5233`)は別preview。`live-55/56/58/59/60/61/62`で保護者表示・2人ゲーム導線・全問題図5種・1024×768のIsland導線を確認。`live-63`の320×568初回、`live-64`の写真CTA 4サイズ、`live-65`のtablet portrait / desktop導線、`live-67`のBattle開始前提表示、`live-68/69`のcompact-phone経路・Battle結果、`live-70/72`のtablet/desktop Battle学年scroll cue、`live-76`の5サイズ・320pxナビ一行表示を確認。Welcome CTA・写真CTA・disabled Battle開始の説明不足・切れた結果label・隠れた必須学年群・狭幅ナビラベル折返しを修正。`verify:core`は457 files / 4,154 tests・build/assetsまでPASS。全体ナビcapture前に共通rootのIsland/NatureTown flag、revision/version、deliveryをIsland画面IDと照合するguardを追加。全ルート状態、自然な復習判定、実端末のスクロール発見性、実読み上げ・参加者評価は継続 -> docs/tasks/active/2026-09-20-whole-app-ux-coherence.md
